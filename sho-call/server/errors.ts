// Typed API errors. `code` is stable for clients; `error` is a readable message.

export class HttpError extends Error {
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

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = () => new HttpError(401, 'unauthenticated', 'Sign in to continue.');
export const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, 'forbidden', message);
export const notFound = (what = 'Not found.') => new HttpError(404, 'not_found', what);
export const conflict = (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details);
export const unprocessable = (message: string, details?: unknown) => new HttpError(422, 'invalid', message, details);
