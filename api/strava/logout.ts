import { clearCookieHeader } from './_session';
export default function handler(req: any, res: any) {
  res.setHeader('Set-Cookie', clearCookieHeader);
  return res.status(204).end();
}
