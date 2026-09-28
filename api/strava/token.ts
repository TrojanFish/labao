import { cookieHeader, seal } from './_session';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { code, refreshToken, grantType } = req.body || {};
  if ((grantType === 'authorization_code' && !code) || (grantType === 'refresh_token' && !refreshToken)) {
    return res.status(400).json({ message: 'Invalid Strava token request' });
  }
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID || '';
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    const missing = [!clientId && 'STRAVA_CLIENT_ID', !clientSecret && 'STRAVA_CLIENT_SECRET'].filter(Boolean).join(', ');
    return res.status(500).json({
      message: `服务端环境变量配置缺失: ${missing}。请在 Vercel 控制台检查环境变量并重新部署 (Redeploy)。`
    });
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
      ...(code ? { code } : { refresh_token: refreshToken })
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(payload?.errors) && payload.errors.length > 0
      ? payload.errors.map((e: any) => `${e.field || e.resource}: ${e.code}`).join('; ')
      : payload?.message || 'Strava 鉴权拒绝';
    return res.status(response.status).json({
      ...payload,
      message: `Strava 鉴权失败 (${response.status}): ${detail}`
    });
  }
  res.setHeader('Set-Cookie', cookieHeader(seal({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    athlete: payload.athlete
  })));
  return res.json({ access_token: 'session', refresh_token: '', expires_at: payload.expires_at, athlete: payload.athlete });
}
