// src/module/auth/controller/controller.js
import { Router } from 'express';
import { randomUUID } from 'crypto';
import loginService from '../service/auth.loginService.js';
import registerService from '../service/auth.registerService.js';
import { validate } from '../../../shared/middleware/validate.js';
import { checkOtpCooldown } from '../../../shared/utils/otpCooldown.js';
import {
  loginRequestOtpSchema,
  loginVerifySchema,
  loginVerifyUserSchema,
  registerRequestOtpSchema,
  registerEnrollSchema,
} from '../../../shared/validator/authSchema.js';
import { logger } from '../../../shared/logger.js';
import { User, UserSession, OtpTxn } from '../model/model.js';

function buildResponseProfile(user, profile = {}) {
  const firstName = user.firstName || profile.firstName || '';
  const lastName = user.lastName !== undefined ? user.lastName : (profile.lastName || '');
  const fullName = `${firstName} ${lastName}`.trim() || profile.fullName || profile.name || 'User';
  const mobile = user.mobile || profile.mobile || profile.contact?.phone || '';
  const rawGender = user.gender || profile.gender || '';
  const gender = rawGender === 'M' ? 'Male' : (rawGender === 'F' ? 'Female' : (rawGender === 'O' ? 'Other' : rawGender));
  const abhaNum = user.abhaNumber || profile.ABHANumber || profile.abhaNumber || '';
  const abhaAddr = user.abhaAddress || profile.phrAddress?.[0] || profile.abhaAddress || '';
  const dob = user.dob || profile.dob || profile.dateOfBirth || '';
  const city = user.city || profile.city || profile.address || profile.contact?.address || '';

  return {
    id: user._id ? user._id.toString() : user.userId,
    userId: user.userId,
    aadhaar: user.aadhaar || '',
    fullName,
    firstName,
    lastName,
    name: fullName,
    dob,
    dateOfBirth: dob,
    gender,
    mobile,
    phone: mobile,
    email: user.email || profile.email || '',
    city,
    address: city,
    abhaNumber: abhaNum,
    ABHANumber: abhaNum,
    abhaAddress: abhaAddr,
    phrAddress: abhaAddr,
    emergencyContactName: user.emergencyContactName || '',
    emergencyContactRelation: user.emergencyContactRelation || '',
    emergencyContactPhone: user.emergencyContactPhone || '',
    abhaStatus: user.abhaStatus || profile.abhaStatus || 'ACTIVE',
    photoUrl: user.photoUrl || profile.photoUrl || profile.photo || null,
    bloodGroup: user.bloodGroup || profile.bloodGroup || '',
  };
}

async function upsertUserFromProfile(profile, { aadhaar, mobile, loginMethod, city, abhaIdentifier }) {
  const isMockAbha = profile.ABHANumber === '91-0000-1111-2222';
  
  let targetAbha = profile.ABHANumber;
  let targetAbhaAddress = profile.phrAddress?.[0] || profile.abhaAddress;

  if (isMockAbha && abhaIdentifier) {
    if (abhaIdentifier.includes('@')) {
      targetAbhaAddress = abhaIdentifier;
      targetAbha = undefined; 
    } else {
      targetAbha = abhaIdentifier;
    }
  }

  let user = null;
  if (aadhaar) {
    user = await User.findOne({ aadhaar });
  }
  
  if (!user && abhaIdentifier) {
    user = await User.findOne({
      $or: [
        { abhaAddress: abhaIdentifier },
        { mobile: abhaIdentifier },
        { abhaNumber: abhaIdentifier },
      ],
    });
  }

  if (!user && targetAbha) {
    user = await User.findOne({ abhaNumber: targetAbha });
  }

  if (!user && profile.mobile) {
    user = await User.findOne({ mobile: profile.mobile });
  }

  let canSetAbha = Boolean(targetAbha);
  if (canSetAbha && user) {
    const existingWithAbha = await User.findOne({ abhaNumber: targetAbha, _id: { $ne: user._id } });
    if (existingWithAbha) {
      canSetAbha = false;
    }
  }

  const isRegister = loginMethod === 'register';

  const updateFields = {
    ...(canSetAbha ? { abhaNumber: targetAbha } : {}),
    ...(aadhaar ? { aadhaar } : {}),
    firstName: isRegister ? (profile.firstName || user?.firstName) : (user?.firstName || profile.firstName),
    lastName: isRegister ? (profile.lastName !== undefined ? profile.lastName : user?.lastName) : (user?.lastName !== undefined ? user.lastName : profile.lastName),
    mobile: isRegister ? (mobile || profile.mobile || user?.mobile) : (user?.mobile || mobile || profile.mobile),
    gender: isRegister ? (profile.gender || user?.gender) : (user?.gender || profile.gender),
    dob: isRegister ? (profile.dob || user?.dob) : (user?.dob || profile.dob),
    abhaAddress: isRegister ? (targetAbhaAddress || user?.abhaAddress) : (user?.abhaAddress || targetAbhaAddress),
    abhaStatus: profile.abhaStatus || user?.abhaStatus || 'ACTIVE',
    kycVerified: profile.kycVerified ?? user?.kycVerified ?? true,
    loginMethod,
    ...(city ? { city } : profile.city ? { city: profile.city } : {}),
    ...(isRegister ? { bloodGroup: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', photoUrl: null } : {}),
  };

  if (user) {
    user = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { returnDocument: 'after' }
    );
  } else {
    user = await User.create({
      userId: randomUUID(),
      ...updateFields,
    });
  }

  // Sync / create matching MongoDB User in user module schema
  try {
    const { User: MongoUser } = await import('../../user/model/userModel.js');
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User';
    const genderCode = user.gender || profile.gender || '';
    const genderLabel = genderCode === 'M' ? 'Male' : genderCode === 'F' ? 'Female' : genderCode === 'O' ? 'Other' : '';
    await MongoUser.findByIdAndUpdate(
      user._id,
      {
        fullName,
        ...(user.email || profile.email ? { email: user.email || profile.email } : {}),
        phone: user.mobile || mobile || profile.mobile || '',
        dateOfBirth: user.dob ? new Date(user.dob) : (profile.dob ? new Date(profile.dob) : undefined),
        ...(genderLabel ? { gender: genderLabel } : {}),
        ...(city ? { address: city } : profile.city ? { address: profile.city } : {}),
      },
      { upsert: true }
    );
  } catch (err) {
    logger.warn(`Failed to sync user module database record: ${err.message}`);
  }

  // If registering, reset/initialize clean user profile record in user_profiles collection
  if (isRegister) {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection?.readyState === 1) {
        const profileCol = mongoose.connection.db.collection('user_profiles');
        const emptyCleanProfile = {
          profile: {
            id: user._id.toString(),
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
            dob: user.dob || '',
            gender: user.gender === 'M' ? 'Male' : (user.gender === 'F' ? 'Female' : (user.gender || '')),
            bloodGroup: '',
            maritalStatus: '',
            occupation: '',
            primaryLanguage: 'English',
            contact: {
              phone: user.mobile || '',
              email: user.email || '',
              address: user.city || '',
              emergencyContactName: '',
              emergencyContactRelation: '',
              emergencyContactPhone: '',
            },
            medications: [],
            allergies: [],
            conditions: [],
            criticalAlerts: [],
          },
          abha: {
            number: user.abhaNumber || '',
            phrAddress: user.abhaAddress || '',
            verificationStatus: 'Verified',
            issuedDate: new Date().toISOString(),
          },
          consents: [],
          documents: [],
          updatedAt: new Date(),
        };

        await profileCol.replaceOne(
          { _id: user._id.toString() },
          { _id: user._id.toString(), ...emptyCleanProfile },
          { upsert: true }
        );
      }
    } catch (cleanErr) {
      logger.warn(`Could not initialize clean user_profiles doc: ${cleanErr.message}`);
    }
  }

  return user;
}

function sendServiceError(res, error) {
  const status = error.status >= 400 && error.status < 600 ? error.status : 500;
  return res.status(status).json({ error: error.message || 'Internal Server Error' });
}

const router = Router();

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login/request-otp',
  validate(loginRequestOtpSchema),
  async (req, res) => {
    try {
      const { method, identifier } = req.body;

      const cooldown = checkOtpCooldown(identifier);
      if (!cooldown.allowed) {
        return res.status(429).json({
          error: 'Too many OTP requests',
          retryAfter: cooldown.retryAfter,
        });
      }

      // For mobile login, verify that at least one account exists in the database
      if (method === 'mobile') {
        const mobileClean = identifier.replace(/\D/g, '').slice(-10);
        const existingUsers = await User.find({
          $or: [
            { mobile: mobileClean },
            { mobile: new RegExp(mobileClean + '$') },
            { phone: mobileClean },
            { phone: new RegExp(mobileClean + '$') },
          ],
        }).lean();

        if (!existingUsers || existingUsers.length === 0) {
          return res.status(404).json({
            error: 'No account found linked with this mobile number. Please check the number or create an account.',
          });
        }
      }

      const result = await loginService.requestOTP(method, identifier);

      // Track the txn so /verify can validate it
      await OtpTxn.create({
        txnId: result.txnId,
        identifier,
        method,
      });

      res.json(result);
    } catch (e) {
      logger.error('[auth/login/request-otp]', e);
      sendServiceError(res, e);
    }
  }
);

router.post('/login/verify',
  validate(loginVerifySchema),
  async (req, res) => {
    try {
      const { method, txnId, otp } = req.body;

      // Validate txnId exists and matches method
      const txn = await OtpTxn.findOne({ txnId });
      if (!txn) {
        return res.status(400).json({ error: 'Invalid or expired txnId' });
      }
      if (txn.method !== method) {
        return res.status(400).json({ error: 'Method mismatch' });
      }
      txn.attempts += 1;
      await txn.save();

      const result = await loginService.verify(method, txnId, otp);

      // Mobile: query real database records linked with this mobile number
      if (method === 'mobile') {
        const mobileClean = txn.identifier.replace(/\D/g, '').slice(-10);
        const matchedUsers = await User.find({
          $or: [
            { mobile: mobileClean },
            { mobile: new RegExp(mobileClean + '$') },
            { phone: mobileClean },
            { phone: new RegExp(mobileClean + '$') },
          ],
        }).lean();

        if (!matchedUsers || matchedUsers.length === 0) {
          return res.status(404).json({
            error: 'No account found linked with this mobile number in database.',
          });
        }

        // If multiple accounts are linked with this mobile, provide account selector
        if (matchedUsers.length > 1) {
          return res.json({
            needsSelection: true,
            txnId,
            abhaProfiles: matchedUsers.map((u) => {
              const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.fullName || 'User';
              return {
                userId: u.userId,
                abhaNumber: u.abhaNumber || '',
                name,
                firstName: u.firstName || '',
                lastName: u.lastName || '',
                abhaAddress: u.abhaAddress || (u.phrAddress?.[0]) || '',
                gender: u.gender || '',
                dob: u.dob || '',
              };
            }),
          });
        }

        // Exactly 1 account linked with this mobile number: log in directly
        const user = matchedUsers[0];
        const tokens = {
          token: result.tokens?.token || randomUUID(),
          refreshToken: result.tokens?.refreshToken || randomUUID(),
          expiresIn: result.tokens?.expiresIn || 1800,
        };

        await UserSession.create({
          userId: user.userId,
          xToken: tokens.token,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          refreshExpiresAt: new Date(Date.now() + (tokens.refreshExpiresIn || 1296000) * 1000),
          loginMethod: 'mobile',
        });

        txn.verifiedAt = new Date();
        await txn.save();

        const responseProfile = buildResponseProfile(user);

        return res.json({
          needsSelection: false,
          profile: responseProfile,
          tokens,
          userId: user.userId,
        });
      }

      // Single profile for other methods (aadhaar/abha) — persist
      const profile = result.profile;
      const tokens = result.tokens;

      const user = await upsertUserFromProfile(profile, {
        aadhaar: method === 'aadhaar' ? txn.identifier : undefined,
        abhaIdentifier: method !== 'aadhaar' ? txn.identifier : undefined,
        loginMethod: method,
      });

      await UserSession.create({
        userId: user.userId,
        xToken: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        refreshExpiresAt: new Date(Date.now() + (tokens.refreshExpiresIn || 1296000) * 1000),
        loginMethod: method,
      });

      // Mark txn as verified
      txn.verifiedAt = new Date();
      await txn.save();

      const responseProfile = buildResponseProfile(user, profile);

      res.json({
        needsSelection: false,
        profile: responseProfile,
        tokens,
        userId: user.userId,
      });

    } catch (e) {
      logger.error('[auth/login/verify]', e);
      sendServiceError(res, e);
    }
  }
);

router.post('/login/verify-user',
  validate(loginVerifyUserSchema),
  async (req, res) => {
    try {
      const { txnId, abhaNumber } = req.body;

      // Validate txn still exists
      const txn = await OtpTxn.findOne({ txnId });
      if (!txn) {
        return res.status(400).json({ error: 'Invalid or expired txnId' });
      }

      // Look up real user from database by abhaNumber
      let user = await User.findOne({ abhaNumber });
      if (!user && txn.identifier) {
        const mobileClean = txn.identifier.replace(/\D/g, '').slice(-10);
        user = await User.findOne({
          $and: [
            { abhaNumber },
            {
              $or: [
                { mobile: mobileClean },
                { mobile: new RegExp(mobileClean + '$') },
                { phone: mobileClean },
                { phone: new RegExp(mobileClean + '$') },
              ],
            },
          ],
        });
      }

      if (!user) {
        return res.status(404).json({ error: `Account with ABHA ${abhaNumber} not found in database.` });
      }

      const tokens = {
        token: randomUUID(),
        refreshToken: randomUUID(),
        expiresIn: 1800,
      };

      await UserSession.create({
        userId: user.userId,
        xToken: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        refreshExpiresAt: new Date(Date.now() + 1296000 * 1000),
        loginMethod: txn.method || 'mobile',
      });

      txn.verifiedAt = new Date();
      await txn.save();

      const responseProfile = buildResponseProfile(user);

      res.json({
        profile: responseProfile,
        tokens,
        userId: user.userId,
      });

    } catch (e) {
      logger.error('[auth/login/verify-user]', e);
      sendServiceError(res, e);
    }
  }
);

// ─── REGISTER ─────────────────────────────────────────────────────────────────

router.post('/register/request-otp',
  validate(registerRequestOtpSchema),
  async (req, res) => {
    try {
      const { aadhaar } = req.body;
      console.log('Received register request OTP for Aadhaar:', aadhaar);
      const cooldown = checkOtpCooldown(aadhaar);
      if (!cooldown.allowed) {
        return res.status(429).json({
          error: 'Too many OTP requests',
          retryAfter: cooldown.retryAfter,
        });
      }

      const result = await registerService.requestOtp(aadhaar);

      await OtpTxn.create({
        txnId: result.txnId,
        identifier: aadhaar,
        method: 'register',
      });

      res.json(result);
    } catch (e) {
      logger.error('[auth/register/request-otp]', e);
      sendServiceError(res, e);
    }
  }
);

router.post('/register/enroll',
  validate(registerEnrollSchema),
  async (req, res) => {
    try {
      const { txnId } = req.body;

      // Validate txn
      const txn = await OtpTxn.findOne({ txnId });
      if (!txn) {
        return res.status(400).json({ error: 'Invalid or expired txnId' });
      }
      if (txn.method !== 'register') {
        return res.status(400).json({ error: 'Not a registration txn' });
      }

      const result = await registerService.enroll(req.body);

      const profile = result.ABHAProfile;
      const tokens = result.tokens;

      const user = await upsertUserFromProfile(profile, {
        aadhaar: req.body.aadhaar || txn.identifier,
        mobile: req.body.mobile,
        loginMethod: 'register',
        city: req.body.city,
      });

      await UserSession.create({
        userId: user.userId,
        xToken: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        refreshExpiresAt: new Date(Date.now() + (tokens.refreshExpiresIn || 1296000) * 1000),
        loginMethod: 'register',
      });

      txn.verifiedAt = new Date();
      await txn.save();

      const responseProfile = buildResponseProfile(user, profile);

      res.json({
        profile: responseProfile,
        tokens,
        userId: user.userId,
      });

    } catch (e) {
      logger.error('[auth/register/enroll]', e);
      sendServiceError(res, e);
    }
  }
);

export default router;
