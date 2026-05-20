import { SignJWT, jwtVerify } from 'jose';
import { parse, serialize } from 'cookie';
import type { IncomingMessage, ServerResponse } from 'http';

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim()).filter(Boolean);

function getSessionSecret() {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required for admin authentication.');
  }
  return new TextEncoder().encode(SESSION_SECRET);
}

export function getClientIp(req: IncomingMessage) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket.remoteAddress ?? 'unknown').replace(/^.*:/, '');
}

export async function signAdminToken(email: string) {
  const secret = getSessionSecret();
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyAdminToken(token: string) {
  const secret = getSessionSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as { email: string };
}

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email);
}

export function parseCookies(req: IncomingMessage) {
  return parse(req.headers.cookie || '');
}

export function createLogoutCookie() {
  return serialize('cvht_admin', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
  });
}

export function createAdminCookie(token: string) {
  return serialize('cvht_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'strict',
  });
}
