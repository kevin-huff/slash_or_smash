const API_BASE = '/api/auth';

export interface AuthStatus {
  passwordSet: boolean;
  isAuthenticated: boolean;
}

class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public requiresAuth: boolean = false
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

let authToken: string | null = localStorage.getItem('producerToken');

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('producerToken', token);
  } else {
    localStorage.removeItem('producerToken');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${API_BASE}/status`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to check auth status');
  }

  const data = await response.json();
  return data;
}

export async function setupPassword(password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthError(data.error || 'Failed to set password', response.status);
  }

  setAuthToken(data.token);
  return data.token;
}

export async function login(password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthError(data.error || 'Login failed', response.status);
  }

  setAuthToken(data.token);
  return data.token;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  setAuthToken(null);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE}/change-password`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthError(data.error || 'Failed to change password', response.status);
  }
}

export { AuthError };
