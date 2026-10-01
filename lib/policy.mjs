export function validCode(code) { return typeof code === 'string' && /^\d{6}$/.test(code); }
export function validDhikr(id) { return Number.isInteger(id) && id >= 0 && id < 7; }
export function validSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  let endpoint;
  try { endpoint = new URL(value.endpoint); } catch { return false; }
  const host=endpoint.hostname;
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port || endpoint.hash) return false;
  if (!(host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com')) return false;
  // Strict key size checks before attempting cryptographic operations.
  return typeof value.keys?.p256dh === 'string' && /^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh) &&
    typeof value.keys?.auth === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value.keys.auth);
}
export async function digest(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
}
export function randomCode() {
  // Rejection sampling avoids modulo bias.
  let n; do {n=crypto.getRandomValues(new Uint32Array(1))[0];} while(n>=4294800000);
  return String(100000+n%900000);
}
export function deviceCookie(request) {
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-dhekr=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token || null;
}
