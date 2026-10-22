import { useSessionStore } from '@/src/store/useSessionStore';
import { mocksEnabled } from '@/src/mock/flag';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// Paths that either don't require a session or that a session-refresh retry
// would make no sense for (retrying a failed login/register with a rotated
// token is meaningless, and /auth/refresh retrying itself would loop).
const NO_RETRY_PATHS = ['/auth/register', '/auth/login', '/auth/reactivate', '/auth/refresh'];

export class ApiError extends Error {
  status: number;
  detail: string;
  // Machine-readable reason when the backend sends one (e.g. auth-service's
  // ACCOUNT_SUSPENDED, booking-service's error codes).
  code?: string;
  // The whole error body, for the few errors that carry more than a message (e.g.
  // ACCOUNT_DELETION_SCHEDULED's deletion_scheduled_at).
  data: Record<string, unknown>;

  constructor(status: number, detail: string, code?: string, data: Record<string, unknown> = {}) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.data = data;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Error ${response.status}`;
  let code: string | undefined;
  let data: Record<string, unknown> = {};
  try {
    const body = await response.json();
    if (body && typeof body === 'object') data = body;
    if (typeof body.code === 'string') code = body.code;
    // Each backend puts its real human-readable text in a different field --
    // `detail` first: auth-service (FastAPI problem-details: {title, detail})
    //   and payment-service (Express, when both `message` and `detail` are
    //   present -- `message` there is a generic label and `detail` the
    //   actual reason, e.g. {message: 'Error creating preference', detail: ...}).
    // `message` next: parking-service (NestJS's default exception body is
    //   {statusCode, message, error} -- `error` there is just the generic
    //   HTTP reason phrase like "Conflict"/"Bad Request", NOT the real
    //   message, so it must lose to `message` here) and payment-service's
    //   single-field errors ({message: 'amount must be a positive number'}).
    // `error` last: booking-service's ONLY content field ({code, error}) --
    //   it never sets `message`, so this never shadows the parking-service case above.
    detail = body.detail || body.message || body.error || body.title || detail;
  } catch {
    // Not a JSON body -- keep the generic message.
  }
  return new ApiError(response.status, detail, code, data);
}

async function rawFetch(
  path: string,
  options: RequestInit,
  accessToken: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // The backend sends an ETag on every GET with no Cache-Control -- on web
  // that's enough for the browser to keep serving a stale cached body after
  // an update elsewhere (e.g. re-opening a spot's detail screen right after
  // editing it, with no way for the browser to know that PUT invalidated
  // this GET). The client always wants the current server state, never an
  // HTTP-cache guess at it.
  const real = () => fetch(`${API_URL}${path}`, { ...options, headers, cache: 'no-store' });
  // Demo/capturas: con EXPO_PUBLIC_MOCKS_ENABLED=true se le suman datos de ejemplo a lo real
  // (src/mock). Con false no se carga nada de eso.
  if (mocksEnabled) return require('@/src/mock').withMocks(path, options, real);
  return real();
}

// auth-service rotates refresh tokens on every use (revokes the used one,
// issues a new pair) -- if two requests 401 around the same time (e.g. two
// screens fetching in parallel right when the access token expires), each
// independently calling /auth/refresh with the same refresh token would let
// only the first succeed; the second would arrive with an already-revoked
// token, fail, and clearSession() the user out from under the first call's
// brand-new session. Sharing one in-flight promise means every concurrent
// 401 awaits the same single refresh instead of racing each other.
let refreshInFlight: Promise<string | null> | null = null;

// Codes the backend uses when the account itself can't be used anymore (suspended, or
// being deleted) -- any request of a logged-in user getting one of these means the
// session is over, and the user is told why.
const ACCOUNT_BLOCKED_CODES = new Set([
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETION_SCHEDULED',
  'ACCOUNT_DELETION_IN_PROGRESS',
]);

type AccountBlockedListener = (error: ApiError) => void;
let accountBlockedListener: AccountBlockedListener | null = null;

/** Registered once by the root layout: logs the user out and shows them why. */
export function onAccountBlocked(listener: AccountBlockedListener | null) {
  accountBlockedListener = listener;
}

// True (and the user notified) when `error` means the account can't be used anymore.
function reportIfAccountBlocked(error: ApiError): boolean {
  if (!error.code || !ACCOUNT_BLOCKED_CODES.has(error.code)) return false;
  if (!useSessionStore.getState().user) return false;
  accountBlockedListener?.(error);
  return true;
}

async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, setTokens } = useSessionStore.getState();
    if (!refreshToken) return null;

    const response = await rawFetch(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
      null
    );
    if (!response.ok) {
      // Suspended or closing meanwhile: hand it to the account-blocked flow (it says why
      // and logs out) instead of the silent session wipe below.
      if (reportIfAccountBlocked(await toApiError(response))) throw new AccountBlockedSignal();
      return null;
    }

    const data = await response.json();
    setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
    return data.access_token as string;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string
): Promise<T> {
  // A caller-supplied token (e.g. login() fetching the profile right after
  // getting a brand-new access token, before it's stored) is used as-is,
  // skipping the refresh-retry dance -- it can't be stale yet.
  if (tokenOverride) {
    const response = await rawFetch(path, options, tokenOverride);
    if (!response.ok) throw await toApiError(response);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  const { accessToken } = useSessionStore.getState();
  let response = await rawFetch(path, options, accessToken);

  if (response.status === 401 && accessToken && !NO_RETRY_PATHS.includes(path)) {
    let newToken: string | null;
    try {
      newToken = await refreshSession();
    } catch (err) {
      if (err instanceof AccountBlockedSignal) return undefined as T; // being logged out
      throw err;
    }
    if (newToken) {
      response = await rawFetch(path, options, newToken);
    } else {
      useSessionStore.getState().clearSession();
      // Session is gone; abandon the request silently — the router will
      // redirect to login in reaction to the store's user becoming null.
      return undefined as T;
    }
  }

  if (!response.ok) {
    const error = await toApiError(response);
    // The account was suspended or is closing: the user is being logged out (and told
    // why), so the screen that asked shouldn't show an error of its own.
    if (reportIfAccountBlocked(error)) return undefined as T;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Thrown by refreshSession when the refresh failed because the account itself is blocked
// (already reported), so request() can bail out quietly.
class AccountBlockedSignal extends Error {}

// Multipart uploads (e.g. avatar) can't go through `request()`: it always
// forces `Content-Type: application/json`, but FormData needs fetch to set
// its own `multipart/form-data; boundary=...` instead.
async function rawMultipartFetch(
  path: string,
  formData: FormData,
  accessToken: string | null
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, { method: 'POST', body: formData, headers, cache: 'no-store' });
}

export async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const { accessToken } = useSessionStore.getState();
  let response = await rawMultipartFetch(path, formData, accessToken);

  if (response.status === 401 && accessToken) {
    let newToken: string | null;
    try {
      newToken = await refreshSession();
    } catch (err) {
      if (err instanceof AccountBlockedSignal) return undefined as T; // being logged out
      throw err;
    }
    if (newToken) {
      response = await rawMultipartFetch(path, formData, newToken);
    } else {
      useSessionStore.getState().clearSession();
      return undefined as T;
    }
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (reportIfAccountBlocked(error)) return undefined as T;
    throw error;
  }
  return (await response.json()) as T;
}
