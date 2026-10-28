/** A controlled error can be returned to a caller; unknown errors get a generic message. */
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
