import { signalApiRequest } from '@/integrations/signal-api/client';

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
  token: string;
  expiresAt: string;
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

export async function registerSignalUser(params: {
  email: string;
  password: string;
  nickname: string;
  profileImageUrl?: string;
  locale?: string;
  acceptedTerms?: Array<{ type: string; locale: string; version: string }>;
}): Promise<SignalAuthSession> {
  const json = await signalApiRequest<{ data: SignalAuthSession }>('/v1/auth/register', {
    method: 'POST',
    body: params,
  });
  return json.data;
}

export async function loginSignalUser(params: { email: string; password: string }): Promise<SignalAuthSession> {
  const json = await signalApiRequest<{ data: SignalAuthSession }>('/v1/auth/login', {
    method: 'POST',
    body: params,
  });
  return json.data;
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

export async function disconnectSignalMyIdentity(token: string, identityId: string): Promise<SignalUserIdentity> {
  const json = await signalApiRequest<{ data: SignalUserIdentity }>(`/v1/auth/me/identities/${encodeURIComponent(identityId)}`, {
    method: 'DELETE',
    token,
  });
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
