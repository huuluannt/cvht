import { signAdminToken, isAdminEmail, createAdminCookie, createLogoutCookie } from '../../utils';

async function getJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth lỗi: ${res.status} ${text}`);
  }
  return res.json();
}

import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '', 'http://localhost');
  const code = url.searchParams.get('code');
  if (!code) {
    res.statusCode = 400;
    res.end('Thiếu mã xác thực Google.');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    res.statusCode = 500;
    res.end('Google OAuth chưa được cấu hình.');
    return;
  }

  try {
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

    const userInfo = await getJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    const email = String(userInfo.email || '').toLowerCase();
    if (!email || !isAdminEmail(email)) {
      res.setHeader('Set-Cookie', createLogoutCookie());
      res.statusCode = 403;
      res.end('Email chưa được phép truy cập admin.');
      return;
    }

    const token = await signAdminToken(email);
    res.setHeader('Set-Cookie', createAdminCookie(token));
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
  } catch (error) {
    res.statusCode = 500;
    res.end(`Đăng nhập admin thất bại: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
  }
}
