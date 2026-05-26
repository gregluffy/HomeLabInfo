const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const getApiUrl = () => API_URL;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('homelab_token');
}

export function setToken(token: string): void {
  localStorage.setItem('homelab_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('homelab_token');
  localStorage.removeItem('homelab_username');
}

export function setUsername(username: string): void {
  localStorage.setItem('homelab_username', username);
}

export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('homelab_username');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    window.location.href = '/login';
  }

  return res;
}
