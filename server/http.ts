/** Error that carries an HTTP status; the error handler turns it into { error: message }. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
