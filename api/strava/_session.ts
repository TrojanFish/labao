import crypto from 'crypto';

export const COOKIE_NAME = 'labao_strava_session';
const key = () => crypto.createHash('sha256').update(process.env.STRAVA_SESSION_SECRET || 'labao_strava_salt').digest();

export function seal(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
}

export function unseal(value?: string): any | null {
  if (!value) return null;
  try {
    const [iv, tag, body] = value.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  } catch { return null; }
}

export function readCookie(header = '') {
  return header.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
}

export const cookieHeader = (value: string, maxAge = 60 * 60 * 24 * 30) =>
  `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''} SameSite=Lax`;

export const clearCookieHeader = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''} SameSite=Lax`;
