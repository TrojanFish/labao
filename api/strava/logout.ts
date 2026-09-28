const COOKIE_NAME = 'labao_strava_session';
const clearCookieHeader = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''} SameSite=Lax`;

export default function handler(req: any, res: any) {
  res.setHeader('Set-Cookie', clearCookieHeader);
  return res.status(204).end();
}
