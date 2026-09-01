/* ════════════════════════════════════════════════
   api.js — Central API utility for IEEE EMBS website
   All pages must use these functions instead of fetch() directly.
   ════════════════════════════════════════════════ */

// Base URL for all API requests.
// Change this to your deployed backend URL after deployment.
const API_BASE = window.EMBS_API_BASE;

/* ── Token helpers ─────────────────────────────── */

// Reads the JWT token stored in localStorage after login.
// Returns null if no token is found.
const getToken = () => localStorage.getItem('token') || null;

// Builds reusable request headers for all API calls.
// If isFormData is true, omits Content-Type so the browser sets the multipart boundary.
// Automatically includes Authorization header if a JWT token exists.
const authHeaders = (isFormData = false) => {
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/* ── Internal fetch helper ─────────────────────── */

// Shared logic used by all public API functions.
// Sends the request, parses JSON, and throws on failure.
const _request = async (method, endpoint, body, isFormData) => {
  let res;

  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: authHeaders(isFormData),
      credentials: 'include',
      // Body is only attached for methods that carry a payload
      ...(body !== undefined && { body: isFormData ? body : JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection.');
  }

  const parsed = await res.json();

  if (!res.ok) {
    throw new Error(parsed.message || `Request failed (${res.status})`);
  }

  return parsed;
};

/* ════════════════════════════════════════════════
   PUBLIC API FUNCTIONS
   ════════════════════════════════════════════════ */

const apiGet = (endpoint) =>
  _request('GET', endpoint, undefined, false);

const apiPost = (endpoint, data, isFormData = false) =>
  _request('POST', endpoint, data, isFormData);

const apiPut = (endpoint, data, isFormData = false) =>
  _request('PUT', endpoint, data, isFormData);

const apiDelete = (endpoint) =>
  _request('DELETE', endpoint, undefined, false);

/* ════════════════════════════════════════════════
   EXPORTS
   ════════════════════════════════════════════════ */
export { apiGet, apiPost, apiPut, apiDelete };
