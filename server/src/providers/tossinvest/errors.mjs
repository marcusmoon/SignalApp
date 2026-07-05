export class TossInvestError extends Error {
  constructor(code, message, { status = null, requestId = null, data = null, cause = null } = {}) {
    super(message || code || 'TOSSINVEST_ERROR');
    this.name = 'TossInvestError';
    this.code = String(code || 'TOSSINVEST_ERROR');
    this.status = status;
    this.requestId = requestId;
    this.data = data;
    if (cause) this.cause = cause;
  }
}

export function throwFromResponse(status, body, requestId = null) {
  const envelope = body && typeof body === 'object' ? body : {};
  const error = envelope.error && typeof envelope.error === 'object' ? envelope.error : {};
  throw new TossInvestError(
    error.code || `HTTP_${status}`,
    error.message || `Toss Invest API HTTP ${status}`,
    {
      status,
      requestId: error.requestId || requestId || null,
      data: error.data ?? null,
    },
  );
}
