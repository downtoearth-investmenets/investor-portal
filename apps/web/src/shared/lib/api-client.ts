import { readToken } from '@/shared/auth/session-storage';

export const UNAUTHORIZED_EVENT = 'dte:unauthorized';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

type ApiInit = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const token = auth ? readToken() : null;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string> | undefined)
      }
    });
  } catch {
    throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(body?.error ?? 'Something went wrong. Please try again.', response.status);
  }

  return body as T;
}

/** Fetches a file (for example a CSV export) with the signed-in user's token. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = readToken();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(body?.error ?? 'The file could not be created. Please try again.', response.status);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'down-to-earth-report.csv';
  return { blob: await response.blob(), filename };
}
