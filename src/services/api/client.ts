import type { Activity, Preferences, RunnerProfile } from '@/types/domain';

const baseURL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function apiEnabled(): boolean {
  return baseURL.length > 0;
}

const memory = {
  access: null as string | null,
  refresh: null as string | null,
};

let persistTokens: (access: string, refresh: string) => void = () => undefined;

export function setAuthTokens(access: string | null, refresh: string | null): void {
  memory.access = access;
  memory.refresh = refresh;
}

export function bindTokenPersistence(listener: (access: string, refresh: string) => void): void {
  persistTokens = listener;
}

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
};

export type MeResponse = {
  user: { id: string; email: string; name: string };
  profile: RunnerProfile | null;
  preferences: Preferences;
};

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super('request failed');
    this.status = status;
    this.body = body;
  }
}

async function refreshAccess(): Promise<string | null> {
  if (!memory.refresh || !apiEnabled()) return null;
  const response = await fetch(`${baseURL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: memory.refresh }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  memory.access = data.accessToken;
  memory.refresh = data.refreshToken;
  persistTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (memory.access) headers.set('Authorization', `Bearer ${memory.access}`);
  let response: Response;
  try {
    response = await fetch(`${baseURL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, { message: 'Não foi possível conectar ao servidor.' });
  }
  if (response.status === 401 && retry && memory.refresh) {
    const access = await refreshAccess();
    if (access) return request(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function registerAccount(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function loginAccount(input: { email: string; password: string }): Promise<AuthResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMe(): Promise<MeResponse> {
  return request('/me');
}

export function saveProfile(profile: RunnerProfile, name?: string): Promise<MeResponse> {
  return request('/me/profile', { method: 'PUT', body: JSON.stringify({ ...profile, name }) });
}

export function savePreferences(preferences: Preferences): Promise<Preferences> {
  return request('/me/preferences', { method: 'PATCH', body: JSON.stringify(preferences) });
}

export function generatePlan(): Promise<void> {
  return request('/plans/current/generate', { method: 'POST' });
}

export function uploadActivity(activity: Activity): Promise<void> {
  return request(`/activities/${activity.clientId}`, {
    method: 'PUT',
    body: JSON.stringify({
      sessionId: activity.sessionId,
      source: activity.source,
      title: activity.title,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      movingSeconds: Math.round(activity.movingSeconds),
      distanceMeters: activity.distanceMeters,
      averagePaceSecondsPerKm: activity.averagePaceSecondsPerKm,
      calories: activity.calories,
      points: activity.points,
      splits: activity.splits,
    }),
  });
}

export async function downloadActivities(): Promise<Activity[]> {
  const list = await request<{ clientId: string }[]>('/activities');
  const activities: Activity[] = [];
  for (const item of list.slice(0, 20)) {
    activities.push(await request<Activity>(`/activities/${item.clientId}`));
  }
  return activities;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = (error.body as { message?: string | string[] } | null)?.message;
    if (Array.isArray(message)) return message[0] ?? fallback;
    if (typeof message === 'string' && message.length > 0) return message;
    if (error.status === 0) return 'Não foi possível conectar ao servidor.';
  }
  if (error instanceof Error && error.message && error.message !== 'request failed') return error.message;
  return fallback;
}
