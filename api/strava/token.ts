import { cookieHeader, seal } from './_session';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { code, refreshToken, grantType } = req.body || {};
  if ((grantType === 'authorization_code' && !code) || (grantType === 'refresh_token' && !refreshToken)) {
    return res.status(400).json({ message: 'Invalid Strava token request' });
  }
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || '',
      client_secret: process.env.STRAVA_CLIENT_SECRET || '',
      grant_type: grantType,
      ...(code ? { code } : { refresh_token: refreshToken })
    })
  });
  const payload = await response.json();
  if (!response.ok) return res.status(response.status).json(payload);
  res.setHeader('Set-Cookie', cookieHeader(seal({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    athlete: payload.athlete
  })));
  return res.json({ access_token: 'session', refresh_token: '', expires_at: payload.expires_at, athlete: payload.athlete });
}
