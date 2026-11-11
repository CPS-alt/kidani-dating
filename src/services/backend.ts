import type { LocalMessage, MatchProfile, ProfileUpdate, SignupDetails, UserProfile } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error(`Unable to reach the Kidani service at ${path}.`, error);
    throw new Error('Kidani could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Kidani request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const result = await request<{ profile: UserProfile | null }>('/api/auth/me');
  return result.profile;
}

export async function signUp(details: SignupDetails) {
  const result = await request<{ profile: UserProfile }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(details),
  });
  return result.profile;
}

export async function signIn(email: string, password: string) {
  const result = await request<{ profile: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result.profile;
}

export function signOut() {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export async function getProfiles() {
  const result = await request<{ profiles: MatchProfile[] }>('/api/profiles');
  return result.profiles;
}

export async function interactWithProfile(profileId: string) {
  const result = await request<{ profile: MatchProfile }>(`/api/interactions/${encodeURIComponent(profileId)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return result.profile;
}

export async function getConversations() {
  const result = await request<{ profiles: MatchProfile[] }>('/api/conversations');
  return result.profiles;
}

export async function getMessages(profileId: string) {
  const result = await request<{ messages: LocalMessage[] }>(`/api/messages/${encodeURIComponent(profileId)}`);
  return result.messages;
}

export async function sendMessage(profileId: string, text: string) {
  const result = await request<{ message: LocalMessage }>(`/api/messages/${encodeURIComponent(profileId)}`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return result.message;
}

export async function saveProfile(profile: ProfileUpdate) {
  const result = await request<{ profile: UserProfile }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  return result.profile;
}
