import { AccountDeletionSummary, AccountStatus, AccountType, AuthTokens, AuthUser, Vehicle } from '@/src/types';
import { isVehicleType, VehicleType } from '@/src/constants/vehicleTypes';
import { request, requestMultipart } from './client';
import { appendLocalFile } from './formDataFile';

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
  status?: string | null;
  deletion_scheduled_at?: string | null;
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
    status: (u.status as AccountStatus | null) ?? 'ACTIVE',
    deletionScheduledAt: u.deletion_scheduled_at ?? undefined,
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

/** Sends the signup code. Returns true when there's nothing to send because this email
 * was verified a moment ago (coming back to an unfinished signup) -- skip its code step. */
export async function requestEmailRegistration(email: string): Promise<boolean> {
  const response = await request<{ already_verified?: boolean }>('/auth/registration/email/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return response?.already_verified === true;
}

export async function confirmEmailRegistration(email: string, code: string): Promise<void> {
  await request('/auth/registration/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

/** Sends the signup code. Returns true when there's nothing to send because this phone
 * was verified a moment ago (coming back to an unfinished signup) -- skip its code step. */
export async function requestPhoneRegistration(phone: string): Promise<boolean> {
  const response = await request<{ already_verified?: boolean }>('/auth/registration/phone/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  return response?.already_verified === true;
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

/** The "yes, reactivate it" answer when logging in to an account whose deletion is
 * scheduled (ACCOUNT_DELETION_SCHEDULED): cancels the deletion and logs in. */
export async function reactivateAccount(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const tokenResponse = await request<TokenResponse>('/auth/reactivate', {
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
  await appendLocalFile(formData, 'file', asset);
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
interface AccountDeletionSummaryResponse {
  blocked: boolean;
  blocked_reason?: string | null;
  in_progress_count: number;
  driver_bookings_to_cancel: number;
  owner_bookings_to_cancel: number;
  owner_requests_to_reject: number;
  pending_payout_count: number;
  pending_payout_amount: number;
  spot_count: number;
  deletion_date: string;
}

/** What deleting the account would do: bookings cancelled, money still owed, and whether
 * a booking in progress blocks it right now. */
export async function getAccountDeletionSummary(userId: string): Promise<AccountDeletionSummary> {
  const r = await request<AccountDeletionSummaryResponse>(`/users/${userId}/deletion`);
  return {
    blocked: r.blocked,
    blockedReason: r.blocked_reason ?? undefined,
    inProgressCount: r.in_progress_count,
    driverBookingsToCancel: r.driver_bookings_to_cancel,
    ownerBookingsToCancel: r.owner_bookings_to_cancel,
    ownerRequestsToReject: r.owner_requests_to_reject,
    pendingPayoutCount: r.pending_payout_count,
    pendingPayoutAmount: r.pending_payout_amount / 100,
    spotCount: r.spot_count,
    deletionDate: r.deletion_date,
  };
}

/** Schedules the account's deletion (7 days from now) -- every session is closed. Until
 * then, logging in offers to reactivate it (reactivateAccount). */
export async function requestAccountDeletion(userId: string, password: string): Promise<AuthUser> {
  const user = await request<UserOutResponse>(`/users/${userId}/deletion`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return toAuthUser(user);
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

// -------------------------
// Vehicles (a driver's own saved vehicles, picked when booking a spot: required when the
// spot asks for it or charges per vehicle type). See auth-service's
// GET/POST /users/{id}/vehicles, PATCH (fill in a missing type) and DELETE
// /users/{id}/vehicles/{vehicleId}.
// -------------------------

export interface VehicleApiResponse {
  id: string;
  type: string | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  country: string;
  created_at: string;
}

function toVehicle(r: VehicleApiResponse): Vehicle {
  // auth-service only ever accepts a country from its own fixed allowlist (see
  // schemas.VEHICLE_COUNTRIES), so this cast is safe -- it's never arbitrary user input.
  return {
    id: r.id,
    type: isVehicleType(r.type) ? r.type : null,
    plate: r.plate,
    brand: r.brand,
    model: r.model,
    country: r.country as Vehicle['country'],
  };
}

export async function getVehicles(userId: string): Promise<Vehicle[]> {
  const response = await request<VehicleApiResponse[]>(`/users/${userId}/vehicles`);
  return response.map(toVehicle);
}

export async function createVehicle(
  userId: string,
  // A bicycle has no plate, and its brand/model are optional.
  input: { type: VehicleType; plate?: string; brand?: string; model?: string; country: string }
): Promise<Vehicle> {
  const response = await request<VehicleApiResponse>(`/users/${userId}/vehicles`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toVehicle(response);
}

/** Fills in the type of a vehicle saved before vehicles had one. */
export async function updateVehicleType(userId: string, vehicleId: string, type: VehicleType): Promise<Vehicle> {
  const response = await request<VehicleApiResponse>(`/users/${userId}/vehicles/${vehicleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ type }),
  });
  return toVehicle(response);
}

export async function deleteVehicle(userId: string, vehicleId: string): Promise<void> {
  await request(`/users/${userId}/vehicles/${vehicleId}`, { method: 'DELETE' });
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
