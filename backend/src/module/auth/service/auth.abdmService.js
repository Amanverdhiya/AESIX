// src/module/auth/service/abdmClient.js
import config from '../../../shared/config.js';
import tokenManager from '../../../shared/tokenManager.js';
import { rsaEncrypt } from '../../../shared/rsa.js';
import { buildAbdmHeaders } from '../../../shared/utils/abdmHeader.js';
import { logger } from '../../../shared/logger.js';

// ─── MOCK RESPONSES ───────────────────────────────────────────────────────────
import { randomUUID } from 'crypto';

const MOCK = {
  requestOTP: () => ({ txnId: `mock-txn-${Date.now()}` }),

  verifyOTP: ({ scope }) => {
    const uniqueToken = `mock-token-${Date.now()}-${randomUUID()}`;
    const uniqueRefresh = `mock-refresh-${Date.now()}-${randomUUID()}`;

    if (scope === 'abha-enrol') {
      return {
        ABHAProfile: {
          ABHANumber: '91-0000-1111-2222',
          firstName: 'Mock',
          lastName: 'Patient',
          dob: '01-01-1990',
          gender: 'M',
          mobile: '9999999999',
          abhaStatus: 'ACTIVE',
          phrAddress: ['mock@sbx'],
        },
        tokens: {
          token: uniqueToken,
          refreshToken: uniqueRefresh,
          expiresIn: 1800,
        },
      };
    }

    // Login fallback: return minimal mock payload (real accounts resolved from DB)
    return {
      ABHAProfile: {
        ABHANumber: '91-0000-1111-2222',
        firstName: 'User',
        lastName: '',
        dob: '01-01-1990',
        gender: 'M',
        mobile: '9999999999',
        abhaStatus: 'ACTIVE',
        phrAddress: ['user@sbx'],
        kycVerified: true,
      },
      tokens: {
        token: uniqueToken,
        refreshToken: uniqueRefresh,
        expiresIn: 1800,
      },
      abhaProfiles: [],
    };
  },

  verifyUser: (txnId, abhaNumber) => ({
    ABHAProfile: {
      ABHANumber: abhaNumber || '91-0000-1111-2222',
      firstName: 'User',
      lastName: '',
      dob: '01-01-1990',
      gender: 'M',
    },
    tokens: {
      token: `mock-token-${Date.now()}-${randomUUID()}`,
      refreshToken: `mock-refresh-${Date.now()}-${randomUUID()}`,
      expiresIn: 1800,
    },
  }),

  enrollByAadhaar: ({ name, mobile, gender, dob }) => {
    const [firstName, ...lastNameParts] = (name || '').trim().split(/\s+/);
    const genderCode = { MALE: 'M', FEMALE: 'F', OTHER: 'O' }[gender] || gender || 'M';
    const abhaSuffix = String(Date.now()).slice(-8);
    const cleanFirstName = (firstName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');

    return {
      ABHAProfile: {
        ABHANumber: `91-${abhaSuffix.slice(0, 4)}-${abhaSuffix.slice(4)}-0001`,
        firstName: firstName || 'User',
        lastName: lastNameParts.join(' '),
        dob: dob || '',
        gender: genderCode,
        mobile: mobile || '',
        abhaStatus: 'ACTIVE',
        phrAddress: [`${cleanFirstName}${abhaSuffix.slice(-4)}@sbx`],
      },
      tokens: {
        token: `mock-token-${Date.now()}-${randomUUID()}`,
        refreshToken: `mock-refresh-${Date.now()}-${randomUUID()}`,
        expiresIn: 1800,
      },
    };
  },
};

// ─── REAL CALL ────────────────────────────────────────────────────────────────
async function post(path, body, { auth = true } = {}) {
  const url = `${config.abdm.baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...buildAbdmHeaders(),
  };

  if (auth) {
    const token = await tokenManager.getToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  logger.debug(`[abdmClient] POST ${path}`);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || data.error || `ABDM error ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }

  return data;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export default {

  async requestOTP({ scope, loginHint, loginId, otpSystem }) {
    if (config.abdm.mockMode) return MOCK.requestOTP();

    const publicKey = await tokenManager.getPublicKey();
    const encryptedId = rsaEncrypt(loginId, publicKey);

    const path = scope === 'abha-enrol'
      ? '/enrollment/request/otp'
      : '/profile/login/request/otp';

    return post(path, { scope, loginHint, loginId: encryptedId, otpSystem });
  },

  async verifyOTP({ scope, txnId, otpValue, otpSystem }) {
    if (config.abdm.mockMode) return MOCK.verifyOTP({ scope });

    const path = scope === 'abha-enrol'
      ? '/enrollment/enrol/byAadhaar'
      : '/profile/login/verify';

    const body = scope === 'abha-enrol'
      ? { txnId, otp: otpValue }
      : {
          scope,
          authData: {
            authMethods: ['otp'],
            otp: { txnId, otpValue, ...(otpSystem && { otpSystem }) },
          },
        };

    return post(path, body);
  },

  async enrollByAadhaar({ txnId, otp, aadhaar, name, mobile, gender, dob }) {
    if (config.abdm.mockMode) return MOCK.enrollByAadhaar({ name, mobile, gender, dob });

    const publicKey = await tokenManager.getPublicKey();

    return post('/enrollment/enrol/byAadhaar', {
      txnId,
      otp,
      aadhaar: rsaEncrypt(aadhaar, publicKey),
      name,
      mobile: rsaEncrypt(mobile, publicKey),
      gender,
      dob,
    });
  },

  async verifyUser(txnId, abhaNumber) {
    if (config.abdm.mockMode) return MOCK.verifyUser(txnId, abhaNumber);

    return post('/profile/login/verify/user', { txnId, abhaNumber });
  },
};
