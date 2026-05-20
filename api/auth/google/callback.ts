import { signAdminToken, isAdminEmail, createAdminCookie, createLogoutCookie } from '../../utils';
import type { IncomingMessage, ServerResponse } from 'http';

async function getJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth lỗi: ${res.status} ${text}`);
  }
  return res.json();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '', 'http://localhost');
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Thiếu mã xác thực Google.');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Google OAuth chưa được cấu hình.');
    return;
  }

  try {
    console.log('Google OAuth callback invoked', { url: req.url, hasClientId: !!clientId, hasClientSecret: !!clientSecret, redirectUri });

    const tokenResponse = await getJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse?.access_token) {
      throw new Error('Không nhận được access_token từ Google.');
    }

    const userInfo = await getJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    const email = String(userInfo.email || '').toLowerCase();

    if (!email || !isAdminEmail(email)) {
      console.error('Google OAuth callback rejected email:', email);
      res.setHeader('Set-Cookie', createLogoutCookie());
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Email chưa được phép truy cập admin.');
      return;
    }

    const token = await signAdminToken(email);
    res.setHeader('Set-Cookie', createAdminCookie(token));
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Đăng nhập admin thất bại: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
  }
}
