import { AuthTokens, AuthUser } from '@/src/types';
import { API_URL, request, requestMultipart } from './client';

interface RegisterInput {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  birthDate: string; // 'YYYY-MM-DD'
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserOutResponse {
  id: string;
  email: string;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  dni?: string | null;
  avatar_url?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
}

function toAuthUser(u: UserOutResponse): AuthUser {
  return {
    id: u.id,
    name: u.first_name ?? '',
    lastName: u.last_name ?? '',
    email: u.email,
    phone: u.phone ?? '',
    dni: u.dni ?? undefined,
    // The backend returns a path relative to its own /static mount (e.g.
    // "/static/avatars/xxx.jpg"); the app only ever talks to the gateway,
    // so it needs the full URL to actually fetch the image.
    avatarUrl: u.avatar_url ? `${API_URL}${u.avatar_url}` : undefined,
    emailVerified: u.email_verified,
    phoneVerified: u.phone_verified,
  };
}

function toAuthTokens(t: TokenResponse): AuthTokens {
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in };
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// `atob` isn't reliably available on Hermes (RN's JS engine) across all
// platforms, so this decodes base64url by hand instead of depending on it.
function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = '';
  for (const char of normalized) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return decodeURIComponent(bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''));
}

// Decodes a JWT payload without verifying it -- the app never trusts this for
// authorization (the backend re-verifies every request), it's only used to
// read the `sub` claim so we know which /users/{id} to fetch after login.
function decodeJwtPayload(token: string): { sub: string } {
  const payload = token.split('.')[1];
  return JSON.parse(base64UrlDecode(payload));
}

export async function register(input: RegisterInput): Promise<void> {
  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      dni: input.dni,
      email: input.email,
      phone: input.phone,
      birth_date: input.birthDate,
      password: input.password,
    }),
  });
}

// -------------------------
// Registration wizard: verify email, then phone, before the account exists
// -------------------------

export async function requestEmailRegistration(email: string): Promise<void> {
  await request('/auth/registration/email/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmEmailRegistration(email: string, code: string): Promise<void> {
  await request('/auth/registration/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function requestPhoneRegistration(phone: string): Promise<void> {
  await request('/auth/registration/phone/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function confirmPhoneRegistration(phone: string, code: string): Promise<void> {
  await request('/auth/registration/phone/confirm', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export async function login(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const tokenResponse = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const tokens = toAuthTokens(tokenResponse);
  const { sub } = decodeJwtPayload(tokens.accessToken);
  const userResponse = await request<UserOutResponse>(`/users/${sub}`, {}, tokens.accessToken);
  return { user: toAuthUser(userResponse), tokens };
}

export async function confirmEmailCode(email: string, code: string): Promise<void> {
  await request('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerificationCode(email: string): Promise<void> {
  await request('/auth/email-verification/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await request('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// -------------------------
// Profile: name, and the (separately verified) email/phone changes
// -------------------------

export async function updateUserProfile(
  userId: string,
  updates: { firstName?: string; lastName?: string }
): Promise<AuthUser> {
  const body: Record<string, string> = {};
  if (updates.firstName !== undefined) body.first_name = updates.firstName;
  if (updates.lastName !== undefined) body.last_name = updates.lastName;
  const userResponse = await request<UserOutResponse>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return toAuthUser(userResponse);
}

export interface AvatarAsset {
  uri: string;
  name: string;
  type: string;
}

export async function uploadAvatar(userId: string, asset: AvatarAsset): Promise<AuthUser> {
  const formData = new FormData();
  // React Native's FormData accepts this {uri, name, type} file-object shape
  // (unlike the web File/Blob API), which is what expo-image-picker's result
  // asset maps onto directly.
  formData.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);
  const userResponse = await requestMultipart<UserOutResponse>(`/users/${userId}/avatar`, formData);
  return toAuthUser(userResponse);
}

export async function requestEmailChange(userId: string, newEmail: string): Promise<void> {
  await request(`/users/${userId}/email`, {
    method: 'POST',
    body: JSON.stringify({ new_email: newEmail }),
  });
}

export async function confirmEmailChange(userId: string, code: string): Promise<AuthUser> {
  const userResponse = await request<UserOutResponse>(`/users/${userId}/email/confirm`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return toAuthUser(userResponse);
}

export async function requestPhoneChange(userId: string, newPhone: string): Promise<void> {
  await request(`/users/${userId}/phone`, {
    method: 'POST',
    body: JSON.stringify({ new_phone: newPhone }),
  });
}

export async function confirmPhoneChange(userId: string, code: string): Promise<AuthUser> {
  const userResponse = await request<UserOutResponse>(`/users/${userId}/phone/confirm`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return toAuthUser(userResponse);
}
