import { readCookie, unseal, seal, cookieHeader } from './_session';

const allowed = /^\/(athlete|athlete\/activities|athlete\/routes|activities\/\d+\/streams|segments\/starred|segments\/\d+)$/;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  const path = String(req.query?.path || '');
  if (!allowed.test(path)) return res.status(400).json({ message: 'Unsupported Strava endpoint' });
  const session = unseal(readCookie(req.headers.cookie));
  if (!session?.refreshToken) return res.status(401).json({ message: 'Strava session expired' });
  let accessToken = session.accessToken;
  if (!accessToken || session.expiresAt < Math.floor(Date.now() / 1000) + 300) {
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  const upstream = await fetch(`https://www.strava.com/api/v3${path}${query.toString() ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.status(upstream.status).send(await upstream.text());
}
