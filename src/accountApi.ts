import type { DesignDocument } from './model';

export interface AxisUser {
  id: string;
  username: string;
  email: string;
  createdAt: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
  });
  const value = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(value.error || 'Não foi possível concluir a solicitação.');
  return value;
}

export async function getSession() {
  return request<{ user: AxisUser | null }>('/api/auth/session');
}
export async function registerAccount(input: { username: string; email: string; password: string }) {
  return request<{ user: AxisUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function loginAccount(input: { email: string; password: string }) {
  return request<{ user: AxisUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function logoutAccount() {
  return request<{ ok: true }>('/api/auth/session', { method: 'DELETE' });
}
export async function listDesigns() {
  return request<{ designs: DesignDocument[] }>('/api/designs');
}
export async function saveDesign(document: DesignDocument) {
  return request<{ document: DesignDocument }>(`/api/designs/${document.id}`, {
    method: 'PUT',
    body: JSON.stringify({ document }),
  });
}
export async function deleteDesign(id: string) {
  return request<{ ok: true }>(`/api/designs/${id}`, { method: 'DELETE' });
}
export async function setDesignVisibility(id: string, visibility: 'private' | 'link' | 'public') {
  return request<{ document: DesignDocument }>(`/api/designs/${id}/share`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  });
}
export async function getSharedDesign(shareId: string) {
  return request<{ document: DesignDocument }>(`/api/shared/${encodeURIComponent(shareId)}`);
}
export async function getPublicDesign(id: string) {
  return request<{ document: DesignDocument }>(`/api/public/${encodeURIComponent(id)}`);
}
