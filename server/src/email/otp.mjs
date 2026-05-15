import { config } from '../config.mjs';

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return 'unknown';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(2, local.length - head.length))}@${domain}`;
}

export async function deliverEmailOtp({ to, code, purpose, expiresAt }) {
  const provider = config.emailDeliveryProvider || 'mock';
  if (provider !== 'mock') {
    console.warn('[email:otp] unsupported provider, falling back to mock', { provider, purpose, to: maskEmail(to) });
  }
  const maskedTo = maskEmail(to);
  console.log('[email:otp:mock]', {
    to: maskedTo,
    purpose,
    expiresAt,
    ...(config.emailOtpDebug ? { code } : {}),
  });
  return {
    provider: 'mock',
    delivered: false,
    debug: config.emailOtpDebug ? { code } : null,
  };
}
