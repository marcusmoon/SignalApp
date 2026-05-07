import { signalApiRequest } from '@/integrations/signal-api/client';

export type SignalAppUser = {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl: string;
  authProvider: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SignalAuthSession = {
  user: SignalAppUser;
  token: string;
  expiresAt: string;
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
