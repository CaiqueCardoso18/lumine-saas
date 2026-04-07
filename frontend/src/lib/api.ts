import { ApiResponse, PaginatedResponse } from '@/types';

// Em produção o Next.js proxia /api/* para o backend via rewrites no next.config.js
// Em dev local, aponta diretamente para localhost:4000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new ApiError(
      response.status,
      json.error || 'Erro inesperado',
      json.details
    );
  }

  return json;
}

export const api = {
  get: <T>(path: string) =>
    request<ApiResponse<T>>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<ApiResponse<T>>(path, { method: 'DELETE' }),

  paginated: <T>(path: string) =>
    request<PaginatedResponse<T>>(path, { method: 'GET' }),

  upload: <T>(path: string, formData: FormData) =>
    request<ApiResponse<T>>(path, {
      method: 'POST',
      body: formData,
      headers: {}, // Deixa o browser definir Content-Type com boundary
    }),
};

export { ApiError };
