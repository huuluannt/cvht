import { createLogoutCookie } from '../utils';
import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Set-Cookie', createLogoutCookie());
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
}
