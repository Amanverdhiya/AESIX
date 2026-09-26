import { fetchApi } from '../../../shared/apiBase';

async function request(path, options = {}) {
  const { timeoutMs = 10000, signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const token = localStorage.getItem('token');
    const response = await fetchApi(path, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...fetchOptions,
    });
    if (response.status === 204) return null;
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body.data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Search timed out — please retry');
    console.warn(`Doctor API request failed for ${path}`, err);
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener?.('abort', onExternalAbort);
  }
}

export const doctorApi = {
  /**
   * Search patients by ABHA ID from the real database
   */
  searchByAbha: async (abhaId = '', { signal } = {}) => {
    if (!abhaId || abhaId.trim().length < 2) return [];
    const result = await request(`/doctor/search-abha?abhaId=${encodeURIComponent(abhaId)}`, { signal, timeoutMs: 8000 });
    return result || [];
  },

  /**
   * Get patient profile from database
   */
  getPatientProfile: async (userId) => {
    return await request(`/doctor/patient-profile/${userId}`);
  },

  /**
   * Get SOCRATES forms list for a patient (metadata + consent status)
   */
  getPatientForms: async (userId) => {
    const result = await request(`/doctor/patient-forms/${userId}`);
    return result || [];
  },

  /**
   * Send a consent/access request for a specific form
   */
  requestFormAccess: async ({ patientId, patientAbha, formId, formSite }) => {
    return await request('/doctor/request-access', {
      method: 'POST',
      body: JSON.stringify({ patientId, patientAbha, formId, formSite }),
    });
  },

  /**
   * Get all consent requests made by this doctor
   */
  getMyRequests: async () => {
    const result = await request('/doctor/my-requests');
    return result || [];
  },

  /**
   * Get full SOCRATES form data (only works if consent is accepted)
   */
  getFormData: async (formId) => {
    return await request(`/doctor/form/${formId}`);
  },

  /**
   * Legacy: search patients (for directory/search bar)
   */
  searchPatients: async (query = '', { signal } = {}) => {
    // Use ABHA search as primary
    const results = await request(`/doctor/search-abha?abhaId=${encodeURIComponent(query)}`, { signal, timeoutMs: 8000 });
    return results || [];
  },

  /**
   * Legacy: get patient data (kept for backward compat)
   */
  getPatientData: async (patientId) => {
    const profile = await request(`/doctor/patient-profile/${patientId}`);
    if (profile) {
      return {
        patient: profile,
        consultationResults: [],
        alerts: [],
      };
    }
    return null;
  },
};
