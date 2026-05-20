import { parseCookies, verifyAdminToken, sendJson } from '../utils';
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const cookies = parseCookies(req);
  const token = cookies.cvht_admin;
  if (!token) {
    sendJson(res, 200, { admin: false });
    return;
  }

  try {
    const payload = await verifyAdminToken(token);
    sendJson(res, 200, { admin: true, email: payload.email });
  } catch (error) {
    sendJson(res, 200, { admin: false });
  }
}
