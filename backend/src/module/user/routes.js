import 'dotenv/config';
import mongoose from 'mongoose';
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { notifyDatabaseChange } from '../../shared/realtime.js';
import { searchNamasteCodes, getOrFetchDiseaseRecord, getIcdToNamasteMapping, getNamasteToIcdMapping } from './services/namasteService.js';
import { searchICDAPI, lookupICDCode, fetchICDEntityDetails, buildWhoLinks, cleanWhoText, cleanWhoList } from './services/icdService.js';
import { getNearbyHospitals } from './services/hospitalService.js';
import { User, UserSession } from '../auth/model/model.js';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../../shared/cloudinary.js';
import SocratesAssessment from './model/socratesModel.js';
import ConsentRequest from '../doctor/model/consentRequestModel.js';
import DoctorAccessLog from '../doctor/model/doctorAccessLogModel.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'user.json');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
let mongoCollection;
let mongoConnecting;
let mongoUnavailableUntil = 0;
const MAX_DOCUMENT_IMPORT_BYTES = 15 * 1024 * 1024;

function buildCloudDownloadUrl(source, rawUrl) {
  let sharedUrl;
  try { sharedUrl = new URL(rawUrl); } catch { throw new Error('Enter a valid shared file URL.'); }
  if (source === 'gdrive') {
    if (!['drive.google.com', 'docs.google.com'].includes(sharedUrl.hostname)) throw new Error('Enter a valid Google Drive shared-file link.');
    const fileId = sharedUrl.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || sharedUrl.searchParams.get('id');
    if (!fileId) throw new Error('That Google Drive link does not contain a file ID.');
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
  }
  if (source === 'dropbox') {
    if (!['www.dropbox.com', 'dropbox.com', 'dl.dropboxusercontent.com'].includes(sharedUrl.hostname)) throw new Error('Enter a valid Dropbox shared-file link.');
    sharedUrl.searchParams.set('dl', '1');
    return sharedUrl.toString();
  }
  throw new Error('Choose Google Drive or Dropbox.');
}

function importedFileName(response, fallback) {
  const attachmentName = response.headers.get('content-disposition')?.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i)?.[1];
  return decodeURIComponent(attachmentName || fallback).replace(/[\\/:*?"<>|]/g, '_');
}
const seed = {
  profile: {
    id: 'user-1',
    name: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    maritalStatus: '',
    occupation: '',
    primaryLanguage: '',
    contact: {
      phone: '',
      email: '',
      address: '',
      emergencyContactName: '',
      emergencyContactRelation: '',
      emergencyContactPhone: ''
    },
    medications: [],
    allergies: [],
    conditions: [],
    criticalAlerts: []
  },
  abha: {
    number: '',
    phrAddress: '',
    verificationStatus: 'Unlinked',
    issuedDate: ''
  },
  consents: [],
  documents: []
};
const copySeed = () => JSON.parse(JSON.stringify(seed));
const getCollection = async () => {
  if (mongoose.connection?.readyState === 1 && mongoose.connection.db) {
    return mongoose.connection.db.collection('user_profiles');
  }
  if (!mongoUri) return null;
  if (mongoCollection) return mongoCollection;
  if (Date.now() < mongoUnavailableUntil) return null;
  if (!mongoConnecting) {
    mongoConnecting = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 })
      .connect()
      .then((client) => {
        mongoCollection = client.db(process.env.MONGODB_DB || 'aesix').collection('user_profiles');
        return mongoCollection;
      })
      .catch((error) => {
        mongoConnecting = null;
        mongoUnavailableUntil = Date.now() + 30000;
        console.error(`MongoDB unavailable; using local demo data: ${error.message}`);
        return null;
      });
  }
  return mongoConnecting;
};
const readMock = async () => { try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; const data = copySeed(); await fs.writeFile(dataFile, JSON.stringify(data, null, 2)); return data; } };
const resolveAuthUser = async (req) => {
  try {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const session = await UserSession.findOne({ xToken: token }).sort({ createdAt: -1 });
        if (session?.userId) {
          const user = await User.findOne({ userId: session.userId });
          if (user) return user;
          if (mongoose.Types.ObjectId.isValid(session.userId)) {
            const userById = await User.findById(session.userId);
            if (userById) return userById;
          }
        }
      }
    }

    const headerUserId = req.headers?.['x-user-id'] || req.body?.userId || req.query?.userId;
    const headerAbha = req.headers?.['x-abha-number'] || req.body?.patientAbha || req.body?.abhaNumber || req.query?.abhaNumber;

    if (headerUserId || headerAbha) {
      const or = [];
      if (headerUserId) {
        or.push({ userId: headerUserId });
        if (mongoose.Types.ObjectId.isValid(headerUserId)) {
          or.push({ _id: headerUserId });
        }
      }
      if (headerAbha) {
        or.push({ abhaNumber: headerAbha });
      }
      const user = await User.findOne({ $or: or });
      if (user) return user;
    }

    return null;
  } catch (err) {
    console.error('Error resolving authenticated user:', err.message);
    return null;
  }
};

const mergeUserWithData = (data, authUser) => {
  if (!authUser) return data;
  const fullName = `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() || authUser.fullName || data.profile.name || 'User';
  return {
    ...data,
    profile: {
      ...data.profile,
      id: authUser.userId || authUser._id?.toString() || data.profile.id,
      name: fullName,
      dob: authUser.dob || authUser.dateOfBirth || data.profile.dob || '',
      gender: authUser.gender === 'M' ? 'Male' : (authUser.gender === 'F' ? 'Female' : (authUser.gender || data.profile.gender || '')),
      bloodGroup: authUser.bloodGroup || data.profile.bloodGroup || '',
      contact: {
        ...data.profile.contact,
        phone: authUser.mobile || authUser.phone || data.profile.contact?.phone || '',
        email: authUser.email || data.profile.contact?.email || '',
        address: authUser.city || authUser.address || data.profile.contact?.address || '',
        emergencyContactName: authUser.emergencyContactName || data.profile.contact?.emergencyContactName || '',
        emergencyContactRelation: authUser.emergencyContactRelation || data.profile.contact?.emergencyContactRelation || '',
        emergencyContactPhone: authUser.emergencyContactPhone || data.profile.contact?.emergencyContactPhone || '',
      },
    },
    abha: {
      ...data.abha,
      number: authUser.abhaNumber || data.abha.number || '',
      phrAddress: authUser.abhaAddress || (authUser.phrAddress?.[0]) || data.abha.phrAddress || '',
      verificationStatus: authUser.kycVerified ? 'Verified' : (authUser.abhaStatus || 'Linked'),
    },
  };
};

const read = async (req = null) => {
  const collection = await getCollection();
  let authUser = null;
  if (req) {
    authUser = await resolveAuthUser(req);
  }
  const userId = authUser ? (authUser._id?.toString() || authUser.userId) : null;

  let data;
  if (userId && collection) {
    const stored = await collection.findOne({ _id: userId });
    if (stored) {
      const { _id: _, ...rest } = stored;
      void _;
      data = rest;
    } else {
      data = copySeed();
      await collection.insertOne({ _id: userId, ...data, createdAt: new Date() });
    }
  } else if (!collection) {
    data = await readMock();
  } else {
    data = copySeed();
  }

  if (authUser) {
    data = mergeUserWithData(data, authUser);
  }
  return data;
};

const write = async (data, req = null) => {
  let authUser = null;
  if (req) {
    authUser = await resolveAuthUser(req);
  }
  const userId = authUser ? (authUser._id?.toString() || authUser.userId) : 'user-1';

  const collection = await getCollection();
  if (!collection) {
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
  } else {
    await collection.replaceOne({ _id: userId }, { _id: userId, ...data, updatedAt: new Date() }, { upsert: true });
  }
  notifyDatabaseChange('update', 'users', userId);
};
const respond = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, error, status = 400) => res.status(status).json({ success: false, error });

router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await read(req);
    respond(res, {
      profile: data.profile,
      abha: data.abha,
      pendingConsents: data.consents.filter((item) => item.status === 'pending'),
      documentCount: data.documents.length,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/nearby-hospitals', async (req, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : 28.6139;
    const lng = req.query.lng ? parseFloat(req.query.lng) : 77.2090;
    const radius = req.query.radius ? parseInt(req.query.radius, 10) : 5000;
    const type = req.query.type || 'hospital';
    const keyword = req.query.keyword || '';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

    const hospitals = await getNearbyHospitals({ lat, lng, radius, type, keyword, limit });
    respond(res, hospitals);
  } catch (e) {
    next(e);
  }
});

router.route('/profile')
  .get(async (req, res, next) => {
    try {
      const data = await read(req);
      respond(res, data.profile);
    } catch (e) {
      next(e);
    }
  })
  .patch(upload.single('photo'), async (req, res, next) => {
    try {
      const data = await read(req);
      const authUser = await resolveAuthUser(req);
      let photoUrl = req.body.photoUrl || req.body.photo || data.profile.photoUrl || null;

      if (req.file) {
        try {
          const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname, 'aesix_profile_photos');
          photoUrl = result.secure_url;
        } catch (uploadErr) {
          console.error('Cloudinary photo upload error:', uploadErr);
          photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
      }

      const bodyData = { ...req.body };
      if (photoUrl) bodyData.photoUrl = photoUrl;

      if (!bodyData.contact) bodyData.contact = {};
      if (typeof bodyData.contact === 'string') {
        try { bodyData.contact = JSON.parse(bodyData.contact); } catch { /* ignore JSON parse error */ }
      }
      ['emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'phone', 'email', 'address'].forEach((key) => {
        if (req.body[`contact[${key}]`]) bodyData.contact[key] = req.body[`contact[${key}]`];
        if (req.body[key] && key.startsWith('emergency')) bodyData.contact[key] = req.body[key];
      });

      Object.assign(data.profile, bodyData);
      if (bodyData.contact) {
        data.profile.contact = { ...data.profile.contact, ...bodyData.contact };
      }
      if (bodyData.phone || bodyData.mobile) {
        data.profile.contact.phone = bodyData.phone || bodyData.mobile;
      }
      if (bodyData.address || bodyData.city) {
        data.profile.contact.address = bodyData.address || bodyData.city;
      }
      if (bodyData.name || bodyData.fullName) {
        data.profile.name = bodyData.name || bodyData.fullName;
      }
      if (photoUrl) data.profile.photoUrl = photoUrl;

      await write(data, req);

      if (authUser) {
        const nameParts = (bodyData.name || bodyData.fullName || '').trim().split(' ');
        const firstName = nameParts[0] || authUser.firstName;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : authUser.lastName;

        const updateAuth = {
          ...(firstName ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(bodyData.contact?.phone || bodyData.phone || bodyData.mobile ? { mobile: bodyData.contact?.phone || bodyData.phone || bodyData.mobile } : {}),
          ...(bodyData.contact?.email || bodyData.email ? { email: bodyData.contact?.email || bodyData.email } : {}),
          ...(bodyData.gender ? { gender: bodyData.gender } : {}),
          ...(bodyData.dob || bodyData.dateOfBirth ? { dob: bodyData.dob || bodyData.dateOfBirth } : {}),
          ...(bodyData.contact?.address || bodyData.address || bodyData.city ? { city: bodyData.contact?.address || bodyData.address || bodyData.city } : {}),
          ...(bodyData.bloodGroup ? { bloodGroup: bodyData.bloodGroup } : {}),
          ...(bodyData.contact?.emergencyContactName !== undefined ? { emergencyContactName: bodyData.contact.emergencyContactName } : {}),
          ...(bodyData.contact?.emergencyContactRelation !== undefined ? { emergencyContactRelation: bodyData.contact.emergencyContactRelation } : {}),
          ...(bodyData.contact?.emergencyContactPhone !== undefined ? { emergencyContactPhone: bodyData.contact.emergencyContactPhone } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        };

        const updatedUser = await User.findByIdAndUpdate(authUser._id, { $set: updateAuth }, { new: true });

        try {
          const { User: MongoUser } = await import('./model/userModel.js');
          await MongoUser.findByIdAndUpdate(authUser._id, {
            fullName: data.profile.name,
            email: data.profile.contact.email,
            phone: data.profile.contact.phone,
            address: data.profile.contact.address,
            gender: data.profile.gender,
            bloodGroup: data.profile.bloodGroup,
            ...(photoUrl ? { photoUrl } : {}),
          }, { upsert: true });
        } catch { /* ignore mongo user update error */ }

        const merged = mergeUserWithData(data, updatedUser || authUser);
        return respond(res, { ...merged.profile, photoUrl });
      }

      respond(res, data.profile);
    } catch (e) {
      next(e);
    }
  });

router.get('/abha', async (req, res, next) => {
  try {
    const data = await read(req);
    respond(res, {
      ...data.abha,
      name: data.profile.name,
      dob: data.profile.dob,
      gender: data.profile.gender,
      bloodGroup: data.profile.bloodGroup,
      contact: data.profile.contact,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/consents', async (req, res, next) => { try { const data = await read(req); respond(res, data.consents.filter((item) => !req.query.status || item.status === req.query.status).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))); } catch (e) { next(e); } });
router.patch('/consents/:id', async (req, res, next) => { try { if (!['accepted', 'rejected'].includes(req.body.status)) return fail(res, 'status must be accepted or rejected'); const data = await read(req); const consent = data.consents.find((item) => item.id === req.params.id); if (!consent) return fail(res, 'Consent not found', 404); consent.status = req.body.status; consent.respondedAt = new Date().toISOString(); await write(data, req); respond(res, consent); } catch (e) { next(e); } });
router.get('/documents', async (req, res, next) => { try { const { documents } = await read(req); const q = req.query.q?.toLowerCase(); const items = documents.filter((item) => (!req.query.type || item.type === req.query.type) && (!q || item.title.toLowerCase().includes(q) || item.fileName.toLowerCase().includes(q))).sort((a, b) => (req.query.order === 'oldest' ? 1 : -1) * a.createdAt.localeCompare(b.createdAt)).map(({ content: _, ...item }) => { void _; return item; }); respond(res, items); } catch (e) { next(e); } });
router.post('/documents', async (req, res, next) => { try { const { title, type, fileName, mimeType, size, content } = req.body; if (!title || !fileName || !content || !['disease', 'prescription', 'discharge summary', 'lab report'].includes(type)) return fail(res, 'title, type, fileName, and content are required'); const data = await read(req); const item = { id: randomUUID(), title: title.trim(), type, fileName, mimeType: mimeType || 'application/octet-stream', size: Number(size) || 0, content, createdAt: new Date().toISOString() }; data.documents.push(item); await write(data, req); const { content: _, ...saved } = item; void _; respond(res, saved, 201); } catch (e) { next(e); } });
router.post('/documents/import-cloud', async (req, res, next) => {
  try {
    const downloadUrl = buildCloudDownloadUrl(req.body?.source, req.body?.url);
    const response = await fetch(downloadUrl, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return fail(res, 'The shared file could not be downloaded. Confirm that anyone with the link can view it.', 400);
    if (Number(response.headers.get('content-length') || 0) > MAX_DOCUMENT_IMPORT_BYTES) return fail(res, 'The shared file is larger than the 15 MB upload limit.', 400);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return fail(res, 'The shared link did not return a file.', 400);
    if (buffer.length > MAX_DOCUMENT_IMPORT_BYTES) return fail(res, 'The shared file is larger than the 15 MB upload limit.', 400);
    const fallback = req.body.source === 'gdrive' ? 'google-drive-document' : 'dropbox-document';
    respond(res, { fileName: importedFileName(response, fallback), mimeType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream', content: buffer.toString('base64') });
  } catch (error) {
    if (error.name === 'TimeoutError') return fail(res, 'The shared file took too long to download.', 408);
    if (/^(Enter a valid|That Google Drive link|Choose Google Drive)/.test(error.message || '')) return fail(res, error.message, 400);
    next(error);
  }
});
router.get('/documents/:id/download', async (req, res, next) => { try { const item = (await read(req)).documents.find((doc) => doc.id === req.params.id); if (!item) return fail(res, 'Document not found', 404); res.type(item.mimeType).attachment(item.fileName).send(Buffer.from(item.content, 'base64')); } catch (e) { next(e); } });
router.delete('/documents/:id', async (req, res, next) => { try { const data = await read(req); const index = data.documents.findIndex((doc) => doc.id === req.params.id); if (index < 0) return fail(res, 'Document not found', 404); data.documents.splice(index, 1); await write(data, req); res.status(204).end(); } catch (e) { next(e); } });

// SOCRATES Symptom Assessment & Cloudinary Document Upload
router.post('/socrates', upload.array('documents', 5), async (req, res, next) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in to submit a SOCRATES assessment.' });
    }
    const data = await read(req);
    const userObjectId = authUser._id ? authUser._id.toString() : '';
    const userUuid = authUser.userId || '';
    const userId = userUuid || userObjectId;
    const patientAbha = authUser.abhaNumber || req.body?.patientAbha || req.body?.abhaNumber || '';
    const userName = data.profile.name || `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() || authUser.fullName || req.body.userName || 'Patient';

    const {
      site,
      onset,
      character,
      radiation,
      associations,
      timeCourse,
      exacerbatingFactors,
      severity,
      priorHistory,
      additionalNotes
    } = req.body;

    if (!site || !onset || !character || !timeCourse || !severity) {
      return res.status(400).json({ success: false, error: 'Site, Onset, Character, Time course, and Severity are required fields.' });
    }

    const uploadedDocs = [];
    const uploadWarnings = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadBufferToCloudinary(file.buffer, file.originalname);
          uploadedDocs.push({
            name: file.originalname,
            url: result.secure_url,
            publicId: result.public_id,
            fileType: file.mimetype,
            uploadedAt: new Date()
          });
        } catch (uploadErr) {
          console.error(`Failed to upload ${file.originalname} to Cloudinary:`, uploadErr?.message || uploadErr);
          const SMALL_FILE_BYTES = 1.5 * 1024 * 1024;
          if (file.buffer && file.buffer.length <= SMALL_FILE_BYTES) {
            uploadedDocs.push({
              name: file.originalname,
              url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
              fileType: file.mimetype,
              uploadedAt: new Date()
            });
            uploadWarnings.push(`${file.originalname}: Cloudinary unavailable, stored inline`);
          } else {
            uploadWarnings.push(
              `${file.originalname}: Cloudinary upload failed (${uploadErr?.message || 'upload error'}) — form saved without this file. Fix CLOUDINARY_API_SECRET in backend/.env, then re-upload.`
            );
          }
        }
      }
    }

    const assessment = new SocratesAssessment({
      userId,
      userObjectId,
      patientAbha,
      userName,
      site,
      onset,
      character,
      radiation: radiation || '',
      associations: associations || '',
      timeCourse,
      exacerbatingFactors: exacerbatingFactors || '',
      severity: Number(severity),
      priorHistory: priorHistory || '',
      additionalNotes: additionalNotes || '',
      documents: uploadedDocs
    });

    await assessment.save();
    notifyDatabaseChange('socrates_submission', { id: assessment._id, userId });

    res.status(201).json({
      success: true,
      message: uploadWarnings.length
        ? `SOCRATES assessment saved; ${uploadWarnings.length} file(s) not uploaded to Cloudinary`
        : 'SOCRATES assessment saved successfully',
      uploadWarnings,
      assessment
    });
  } catch (error) {
    console.error('Error saving SOCRATES assessment:', error);
    next(error);
  }
});

router.get('/socrates', async (req, res, next) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, error: 'Not authenticated', assessments: [] });
    const userObjectId = authUser._id ? authUser._id.toString() : '';
    const userUuid = authUser.userId || '';
    const abha = authUser.abhaNumber || '';

    const or = [];
    if (userUuid) { or.push({ userId: userUuid }); or.push({ userObjectId: userUuid }); }
    if (userObjectId) { or.push({ userId: userObjectId }); or.push({ userObjectId: userObjectId }); }
    if (abha) or.push({ patientAbha: abha });
    const query = or.length ? { $or: or } : { userId: '__none__' };
    const assessments = await SocratesAssessment.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, assessments });
  } catch (error) {
    next(error);
  }
});

router.get('/socrates/patient/:userId', async (req, res, next) => {
  try {
    const pid = String(req.params.userId || '').trim();
    if (!pid || pid === 'undefined' || pid === 'null') {
      return res.json({ success: true, assessments: [] });
    }
    let user = null;
    try { user = await User.findById(pid).lean(); } catch { /* ignore user lookup error */ }
    if (!user) {
      user = await User.findOne({ $or: [{ userId: pid }, { abhaNumber: pid }] }).lean();
    }
    const or = [{ userId: pid }, { userObjectId: pid }, { patientAbha: pid }];
    if (user) {
      const oid = user._id ? user._id.toString() : '';
      const uuid = user.userId || '';
      const abha = user.abhaNumber || '';
      if (oid) or.push({ userId: oid }, { userObjectId: oid });
      if (uuid) or.push({ userId: uuid }, { userObjectId: uuid });
      if (abha) or.push({ patientAbha: abha });
    }
    const assessments = await SocratesAssessment.find({ $or: or }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, assessments });
  } catch (error) {
    next(error);
  }
});

// ─── Doctor Access Requests (Patient side) ────────────────────────────────────
router.get('/access-requests', async (req, res, next) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const patientId = authUser._id.toString();
    const requests = await ConsentRequest.find({ patientId }).sort({ requestedAt: -1 }).lean();
    // Enrich with form info
    const enriched = await Promise.all(requests.map(async (r) => {
      let formInfo = null;
      try {
        const form = await SocratesAssessment.findById(r.formId).lean();
        if (form) {
          formInfo = { site: form.site, severity: form.severity, createdAt: form.createdAt };
        }
      } catch { /* ignore form info lookup error */ }
      return { ...r, _id: r._id.toString(), formInfo };
    }));
    res.json({ success: true, data: enriched });
  } catch (e) {
    next(e);
  }
});

router.patch('/access-requests/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be accepted or rejected' });
    }
    const authUser = await resolveAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const patientId = authUser._id.toString();
    const request = await ConsentRequest.findOne({ _id: req.params.id, patientId });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    request.status = status;
    request.respondedAt = new Date();
    await request.save();
    res.json({ success: true, data: request });
  } catch (e) {
    next(e);
  }
});

// ─── Doctor Access Logs (Patient side: "who opened my data") ─────────────────
router.get('/access-logs', async (req, res, next) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const ids = new Set();
    if (authUser._id) ids.add(authUser._id.toString());
    if (authUser.userId) ids.add(String(authUser.userId));
    if (authUser.abhaNumber) ids.add(String(authUser.abhaNumber));
    const or = [{ patientId: { $in: [...ids] } }];
    if (authUser.abhaNumber) or.push({ patientAbha: String(authUser.abhaNumber) });
    const logs = await DoctorAccessLog.find({ $or: or }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, data: logs.map((l) => ({ ...l, _id: l._id.toString() })) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {

  try {
    const id = req.params.id;
    let foundUser = null;
    if (id && id !== 'user-1') {
      try {
        foundUser = await User.findById(id);
      } catch { /* ignore findById error */ }
      if (!foundUser) {
        foundUser = await User.findOne({ $or: [{ userId: id }, { aadhaar: id }, { abhaNumber: id }] });
      }
    }
    const data = await read(req);
    if (foundUser) {
      const merged = mergeUserWithData(data, foundUser);
      return respond(res, {
        ...merged.profile,
        fullName: merged.profile.name,
        abhaNumber: merged.abha.number,
        phrAddress: merged.abha.phrAddress,
      });
    }
    respond(res, data.profile);
  } catch (e) {
    next(e);
  }
});

// CDSS / Health Codes (NAMASTE & WHO ICD-11)
router.get('/cdss/search/namaste', (req, res) => {
  try {
    const results = searchNamasteCodes(req.query.q || '', req.query.system || '');
    respond(res, { results });
  } catch (e) {
    fail(res, e.message, 500);
  }
});

router.get('/cdss/search/icd11', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (/^[A-Za-z0-9][A-Za-z0-9./&-]*$/.test(query)) {
      const exactMatch = await lookupICDCode(query.toUpperCase());
      if (exactMatch) return respond(res, { destinationEntities: [exactMatch], source: 'WHO ICD-11 codeinfo' });
    }
    const icdData = await searchICDAPI(query);
    respond(res, icdData);
  } catch (error) {
    fail(res, error.message, 502);
  }
});

router.get('/cdss/disease/:code', async (req, res) => {
  try {
    const record = await getOrFetchDiseaseRecord(req.params.code, req.query.entityUri);
    let icd11Details = null;
    let icd11Encyclopedia = null;
    if (record.icd11EntityUri) {
      try {
        icd11Details = await fetchICDEntityDetails(record.icd11EntityUri);
        // Clean WHO payload into encyclopedia-ready plain text + verification links.
        const title = cleanWhoText(icd11Details.title) || cleanWhoText(icd11Details.code) || record.englishEquivalent;
        icd11Encyclopedia = {
          title,
          code: icd11Details.code || record.icd11PrimaryCode || record.code,
          definition: cleanWhoText(icd11Details.definition) || null,
          synonyms: cleanWhoList(icd11Details.synonym),
          inclusion: cleanWhoList(icd11Details.inclusion),
          exclusion: cleanWhoList(icd11Details.exclusion),
          ...buildWhoLinks(record.icd11EntityUri, record.icd11PrimaryCode || record.code),
        };
      } catch (error) {
        icd11Details = { unavailable: true, message: error.message };
        icd11Encyclopedia = {
          title: record.englishEquivalent || record.code,
          code: record.icd11PrimaryCode || record.code,
          definition: null,
          synonyms: [],
          inclusion: [],
          exclusion: [],
          ...buildWhoLinks(record.icd11EntityUri, record.icd11PrimaryCode || record.code),
        };
      }
    } else if (record.icd11PrimaryCode) {
      icd11Encyclopedia = {
        title: record.englishEquivalent || record.code,
        code: record.icd11PrimaryCode,
        definition: null,
        synonyms: [],
        inclusion: [],
        exclusion: [],
        ...buildWhoLinks(null, record.icd11PrimaryCode),
      };
    }
    respond(res, { ...record, icd11Details, icd11Encyclopedia });
  } catch (error) {
    fail(res, error.message, 502);
  }
});

// Bidirectional mapping APIs used by the Kindle encyclopedia.
// ICD -> NAMASTE (reverse lookup across curated DB + catalog)
router.get('/cdss/mapping/icd/:code', (req, res) => {
  try {
    const mappings = getIcdToNamasteMapping(req.params.code, req.query.title || '');
    respond(res, {
      icdCode: req.params.code,
      ...buildWhoLinks(null, req.params.code),
      namasteMappings: mappings,
    });
  } catch (e) {
    fail(res, e.message, 500);
  }
});

// NAMASTE -> ICD (forward lookup)
router.get('/cdss/mapping/namaste/:code', (req, res) => {
  try {
    const mappings = getNamasteToIcdMapping(req.params.code);
    respond(res, { namasteCode: req.params.code, icdMappings: mappings });
  } catch (e) {
    fail(res, e.message, 500);
  }
});

export default router;


