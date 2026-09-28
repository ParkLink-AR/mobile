import { Platform } from 'react-native';
import { AccountType, AuthTokens, AuthUser } from '@/src/types';
import { request, requestMultipart } from './client';

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
  account_type?: string | null;
}

function toAccountType(raw?: string | null): AccountType {
  if (raw === 'OWNER') return 'owner';
  if (raw === 'BOTH') return 'both';
  return 'driver';
}

function toAuthUser(u: UserOutResponse): AuthUser {
  return {
    id: u.id,
    name: u.first_name ?? '',
    lastName: u.last_name ?? '',
    email: u.email,
    phone: u.phone ?? '',
    dni: u.dni ?? undefined,
    // avatar_url is already an absolute R2 URL (see app/utils/storage.py in
    // auth-service) -- unlike the old local-disk path, it's not relative to
    // the gateway anymore, so it's used as-is.
    avatarUrl: u.avatar_url ?? undefined,
    emailVerified: u.email_verified,
    phoneVerified: u.phone_verified,
    accountType: toAccountType(u.account_type),
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

export async function updateAccountType(
  userId: string,
  accountType: AccountType
): Promise<AuthUser> {
  const accountTypeMap: Record<AccountType, string> = {
    driver: 'DRIVER',
    owner: 'OWNER',
    both: 'BOTH',
  };
  const userResponse = await request<UserOutResponse>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ account_type: accountTypeMap[accountType] }),
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
  if (Platform.OS === 'web') {
    // react-native-web's FormData is the browser's real implementation, which
    // has no idea what to do with RN's {uri, name, type} object -- it just
    // stringifies it (into the literal text "[object Object]"), so the
    // actual file bytes have to be fetched into a real Blob first.
    const blob = await (await fetch(asset.uri)).blob();
    formData.append('file', blob, asset.name);
  } else {
    // On native, this {uri, name, type} shape is exactly what RN's bridge
    // expects and turns into a proper multipart file part.
    formData.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.type,
    } as unknown as Blob);
  }
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

export async function verifyCurrentPassword(userId: string, currentPassword: string): Promise<void> {
  await request(`/users/${userId}/password/verify`, {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword }),
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request(`/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// Permanent: hard-deletes the user row plus every parking spot they own
// (and all the R2 photos on both) -- see auth-service's delete_user. There's
// no undo, unlike logout.
export async function deleteAccount(userId: string, password: string): Promise<void> {
  await request(`/users/${userId}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

// -------------------------
// Payout info (owner's CBU/titular/CUIL) -- see auth-service's
// GET/PUT /users/{id}/payout-info. parking-service refuses to publish a NEW
// spot for an owner who hasn't set this (existing spots are unaffected).
// -------------------------

export interface PayoutInfoApiResponse {
  cbu: string | null;
  payout_titular: string | null;
  cuil: string | null;
  has_payout_info: boolean;
}

export interface PayoutInfo {
  cbu: string | null;
  titular: string | null;
  cuil: string | null;
  hasPayoutInfo: boolean;
}

function toPayoutInfo(r: PayoutInfoApiResponse): PayoutInfo {
  return { cbu: r.cbu, titular: r.payout_titular, cuil: r.cuil, hasPayoutInfo: r.has_payout_info };
}

export async function getPayoutInfo(userId: string): Promise<PayoutInfo> {
  const response = await request<PayoutInfoApiResponse>(`/users/${userId}/payout-info`);
  return toPayoutInfo(response);
}

export async function updatePayoutInfo(
  userId: string,
  input: { cbu: string; titular: string; cuil: string }
): Promise<PayoutInfo> {
  const response = await request<PayoutInfoApiResponse>(`/users/${userId}/payout-info`, {
    method: 'PUT',
    body: JSON.stringify({ cbu: input.cbu, payout_titular: input.titular, cuil: input.cuil }),
  });
  return toPayoutInfo(response);
}

export interface PublicProfileApiResponse {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

// Unlike GET /users/{id} (self only), this is viewable for anyone -- see
// auth-service's get_public_profile. Used to show who owns a spot, or who's
// requesting/made a booking.
export async function getPublicProfileApi(userId: string): Promise<PublicProfileApiResponse> {
  return request(`/users/${userId}/public-profile`);
}
