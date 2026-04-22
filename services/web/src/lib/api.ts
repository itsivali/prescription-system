import axios from 'axios';

/**
 * Centralized Axios instance.
 *
 * - `withCredentials: true` sends HttpOnly cookies on every request.
 * - Request interceptor lazily attaches X-CSRF-Token on mutations.
 * - Response interceptor silently refreshes expired access tokens.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// CSRF — lazy fetch, cached in memory. Never blocks the UI.
// ---------------------------------------------------------------------------
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export async function fetchCsrfToken(): Promise<string> {
  // Deduplicate concurrent calls.
  if (csrfPromise) return csrfPromise;
  csrfPromise = api
    .get('/auth/csrf')
    .then((res) => {
      csrfToken = res.data.csrfToken;
      return csrfToken!;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const mutating = ['post', 'put', 'patch', 'delete'];
  if (config.method && mutating.includes(config.method)) {
    if (!csrfToken) {
      try {
        await fetchCsrfToken();
      } catch {
        // CSRF fetch failed — still send the request and let backend return 403.
        // This avoids blocking the UI when the backend is temporarily unreachable.
      }
    }
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// ---------------------------------------------------------------------------
// 401 interceptor — silent token refresh with request queuing.
// ---------------------------------------------------------------------------

// Auth-related endpoints that should NEVER trigger the refresh flow.
// If these get a 401, it means the user is genuinely unauthenticated.
const AUTH_ENDPOINTS = ['/auth/me', '/auth/login', '/auth/refresh', '/auth/csrf'];
function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((ep) => url.includes(ep));
}

let isRefreshing = false;
let refreshQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Auth endpoints fail through — no retry, no redirect.
    if (isAuthEndpoint(original?.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;

      if (isRefreshing) {
        // Queue while another refresh is in-flight.
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: () => resolve(api(original)),
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        await api.post('/auth/refresh');
        // New access token is now in cookies. Refresh CSRF token too.
        csrfToken = null;
        refreshQueue.forEach((p) => p.resolve());
        refreshQueue = [];
        return api(original);
      } catch (refreshError) {
        refreshQueue.forEach((p) => p.reject(refreshError));
        refreshQueue = [];
        // Don't hard-redirect here — let React Router handle it via auth context.
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // On 403 csrf_missing / csrf_invalid, refetch CSRF and retry once.
    if (
      error.response?.status === 403 &&
      ['csrf_missing', 'csrf_invalid'].includes(error.response?.data?.error) &&
      !original._csrfRetried
    ) {
      original._csrfRetried = true;
      csrfToken = null;
      try {
        await fetchCsrfToken();
        if (csrfToken) original.headers['X-CSRF-Token'] = csrfToken;
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
