// Fetch wrapper. Every mutation sends the X-Sho-Call header (CSRF guard).

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thrown when the request may or may not have reached the server. */
export class NetworkError extends Error {}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-sho-call': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError('Could not reach the Sho Call server.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    if (res.ok) throw new NetworkError('The server response was cut off.');
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string; details?: unknown };
    throw new ApiError(res.status, d.code ?? 'error', d.error ?? `Request failed (${res.status}).`, d.details);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
