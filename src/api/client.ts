import { useSessionStore } from '@/src/store/useSessionStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// Paths that either don't require a session or that a session-refresh retry
// would make no sense for (retrying a failed login/register with a rotated
// token is meaningless, and /auth/refresh retrying itself would loop).
const NO_RETRY_PATHS = ['/auth/register', '/auth/login', '/auth/refresh'];

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Error ${response.status}`;
  try {
    const body = await response.json();
    detail = body.detail || body.title || detail;
  } catch {
    // Not a JSON (problem+json) body -- keep the generic message.
  }
  return new ApiError(response.status, detail);
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
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

async function refreshSession(): Promise<string | null> {
  const { refreshToken, setTokens } = useSessionStore.getState();
  if (!refreshToken) return null;

  const response = await rawFetch(
    '/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    null
  );
  if (!response.ok) return null;

  const data = await response.json();
  setTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });
  return data.access_token as string;
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
    const newToken = await refreshSession();
    if (newToken) {
      response = await rawFetch(path, options, newToken);
    } else {
      useSessionStore.getState().clearSession();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
