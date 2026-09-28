export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID || '';
  const configured = Boolean(clientId && process.env.STRAVA_CLIENT_SECRET);
  return res.json({ clientId, configured });
}
