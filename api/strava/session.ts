import crypto from 'crypto';

const COOKIE_NAME = 'labao_strava_session';
const key = () => crypto.createHash('sha256').update(process.env.STRAVA_SESSION_SECRET || 'labao_strava_salt').digest();

function unseal(value?: string): any | null {
  if (!value) return null;
  try {
    const [iv, tag, body] = value.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

function readCookie(header = '') {
  return header.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
}

export default function handler(req: any, res: any) {
  try {
    const session = unseal(readCookie(req.headers?.cookie || ''));
    if (!session) return res.status(401).json({ connected: false });
    return res.json({ connected: true, athlete: session.athlete, expiresAt: session.expiresAt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Session verification failed' });
  }
}
