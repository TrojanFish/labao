import crypto from 'crypto';

const COOKIE_NAME = 'labao_strava_session';
const key = () => crypto.createHash('sha256').update(process.env.STRAVA_SESSION_SECRET || 'labao_strava_salt').digest();

function seal(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
}

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

const cookieHeader = (value: string, maxAge = 60 * 60 * 24 * 30) =>
  `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''} SameSite=Lax`;

const allowed = /^\/(athlete|athlete\/activities|athlete\/routes|activities\/\d+\/streams|segments\/starred|segments\/\d+)$/;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const path = String(req.query?.path || '');
    if (!allowed.test(path)) return res.status(400).json({ message: 'Unsupported Strava endpoint' });
    const session = unseal(readCookie(req.headers?.cookie || ''));
    if (!session?.refreshToken) return res.status(401).json({ message: 'Strava session expired' });
    let accessToken = session.accessToken;
    if (!accessToken || session.expiresAt < Math.floor(Date.now() / 1000) + 300) {
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID || '',
          client_secret: process.env.STRAVA_CLIENT_SECRET || '',
          refresh_token: session.refreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (!tokenResponse.ok) return res.status(401).json({ message: 'Strava authorization expired' });
      const refreshed = await tokenResponse.json();
      session.accessToken = refreshed.access_token;
      session.refreshToken = refreshed.refresh_token;
      session.expiresAt = refreshed.expires_at;
      res.setHeader('Set-Cookie', cookieHeader(seal(session)));
      accessToken = session.accessToken;
    }
    const query = new URLSearchParams(req.query || {});
    query.delete('path');
    const upstream = await fetch(`https://www.strava.com/api/v3${path}${query.toString() ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.status(upstream.status).send(await upstream.text());
  } catch (err: any) {
    return res.status(500).json({ message: `Proxy error: ${err.message || 'Server error'}` });
  }
}
