import { getOrCreateAppDeviceId } from '@/services/appDeviceId';

import { signalApiRequest } from '@/integrations/signal-api/httpClient';

export type SignalAppUser = {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl: string;
  authProvider: string;
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SignalAuthSession = {
  user: SignalAppUser;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  deviceId: string;
};

export type SignalUserTermAcceptance = {
  id: string;
  userId: string;
  type: string;
  locale: string;
  version: string;
  title: string;
  required: boolean;
  active: boolean;
  acceptedAt: string;
  termUpdatedAt?: string | null;
};

export type SignalUserIdentity = {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  displayName: string;
  profileImageUrl: string;
  linkedAt?: string | null;
  disconnectedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AuthPayloadWire = {
  user: SignalAppUser;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  deviceId?: string;
  token?: string;
  expiresAt?: string;
};

export function normalizeAuthSession(data: AuthPayloadWire, fallbackDeviceId: string): SignalAuthSession {
  const accessToken = data.accessToken || data.token || '';
  const accessExpiresAt = data.accessExpiresAt || data.expiresAt || '';
  const refreshExpiresAt = data.refreshExpiresAt || accessExpiresAt;
  return {
    user: data.user,
    accessToken,
    refreshToken: data.refreshToken || '',
    accessExpiresAt,
    refreshExpiresAt,
    deviceId: data.deviceId || fallbackDeviceId,
  };
}

export async function registerSignalUser(params: {
  email: string;
  password: string;
  nickname: string;
  profileImageUrl?: string;
  locale?: string;
  acceptedTerms?: Array<{ type: string; locale: string; version: string }>;
  deviceId?: string;
}): Promise<SignalAuthSession> {
  const deviceId = params.deviceId ?? (await getOrCreateAppDeviceId());
  const json = await signalApiRequest<{ data: AuthPayloadWire }>('/v1/auth/register', {
    method: 'POST',
    body: {
      email: params.email,
      password: params.password,
      nickname: params.nickname,
      profileImageUrl: params.profileImageUrl,
      locale: params.locale,
      acceptedTerms: params.acceptedTerms,
      deviceId,
    },
  });
  return normalizeAuthSession(json.data, deviceId);
}

export async function loginSignalUser(params: {
  email: string;
  password: string;
  deviceId?: string;
}): Promise<SignalAuthSession> {
  const deviceId = params.deviceId ?? (await getOrCreateAppDeviceId());
  const json = await signalApiRequest<{ data: AuthPayloadWire }>('/v1/auth/login', {
    method: 'POST',
    body: { email: params.email, password: params.password, deviceId },
  });
  return normalizeAuthSession(json.data, deviceId);
}

export async function fetchSignalMe(token: string): Promise<SignalAppUser> {
  const json = await signalApiRequest<{ data: { user: SignalAppUser } }>('/v1/auth/me', { token });
  return json.data.user;
}

export async function fetchSignalMyTerms(token: string): Promise<SignalUserTermAcceptance[]> {
  const json = await signalApiRequest<{ data: SignalUserTermAcceptance[] }>('/v1/auth/me/terms', { token });
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchSignalMyIdentities(token: string): Promise<SignalUserIdentity[]> {
  const json = await signalApiRequest<{ data: SignalUserIdentity[] }>('/v1/auth/me/identities', { token });
  return Array.isArray(json.data) ? json.data : [];
}

export async function setSignalMyPassword(token: string, password: string): Promise<SignalAppUser> {
  const json = await signalApiRequest<{ data: { user: SignalAppUser } }>('/v1/auth/me/password', {
    method: 'PATCH',
    token,
    body: { password },
  });
  return json.data.user;
}

export type SignalEmailChangeRequest = {
  requestId: string;
  email: string;
  maskedEmail: string;
  expiresAt: string;
  delivery?: { provider: string; delivered: boolean };
  debug?: { code?: string };
};

export async function requestSignalMyEmailChange(token: string, email: string): Promise<SignalEmailChangeRequest> {
  const json = await signalApiRequest<{ data: SignalEmailChangeRequest }>('/v1/auth/me/email-change/request', {
    method: 'POST',
    token,
    body: { email },
  });
  return json.data;
}

export async function confirmSignalMyEmailChange(
  token: string,
  params: { requestId: string; code: string },
): Promise<SignalAppUser> {
  const json = await signalApiRequest<{ data: { user: SignalAppUser } }>('/v1/auth/me/email-change/confirm', {
    method: 'POST',
    token,
    body: params,
  });
  return json.data.user;
}

export async function disconnectSignalMyIdentity(token: string, identityId: string): Promise<SignalUserIdentity> {
  const json = await signalApiRequest<{ data: SignalUserIdentity }>(
    `/v1/auth/me/identities/${encodeURIComponent(identityId)}`,
    {
      method: 'DELETE',
      token,
    },
  );
  return json.data;
}

export async function updateSignalMe(
  token: string,
  patch: { nickname?: string; profileImageUrl?: string },
): Promise<SignalAppUser> {
  const json = await signalApiRequest<{ data: { user: SignalAppUser } }>('/v1/auth/me', {
    method: 'PATCH',
    token,
    body: patch,
  });
  return json.data.user;
}

export async function logoutSignalUser(token: string): Promise<void> {
  await signalApiRequest('/v1/auth/logout', { method: 'POST', token });
}

export async function deleteSignalMe(token: string): Promise<void> {
  await signalApiRequest('/v1/auth/me', { method: 'DELETE', token });
}

export async function registerSignalAppDevice(
  token: string,
  params: { platform: string; pushToken: string; deviceName?: string },
): Promise<{ pushToken: string; updatedAt: string }> {
  const json = await signalApiRequest<{ data: { pushToken: string; updatedAt: string } }>('/v1/auth/devices', {
    method: 'POST',
    token,
    body: params,
  });
  return json.data;
}
