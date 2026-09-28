import { readCookie, unseal } from './_session';
export default function handler(req: any, res: any) {
  const session = unseal(readCookie(req.headers.cookie));
  if (!session) return res.status(401).json({ connected: false });
  return res.json({ connected: true, athlete: session.athlete, expiresAt: session.expiresAt });
}
