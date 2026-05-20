import { verifyAdminToken, parseCookies, createLogoutCookie, sendJson } from './utils';
import { retrieveChunks } from '../src/lib/serverData';
import { buildPrompt, callGeminiApi, callGroqApi } from '../src/lib/llm';
import { rateLimit } from './rateLimit';

import type { IncomingMessage, ServerResponse } from 'http';

async function parseJson(req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function getAdminEmail(req: IncomingMessage) {
  const cookies = parseCookies(req);
  const token = cookies.cvht_admin;
  if (!token) {
    throw new Error('Unauthorized');
  }
  const payload = await verifyAdminToken(token);
  if (!payload?.email) {
    throw new Error('Unauthorized');
  }
  return payload.email;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const rate = rateLimit(req);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    sendJson(res, 429, { message: rate.message });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { message: 'Phương thức không được hỗ trợ.' });
    return;
  }

  try {
    await getAdminEmail(req);
  } catch (error) {
    res.setHeader('Set-Cookie', createLogoutCookie());
    sendJson(res, 401, { message: 'Yêu cầu đăng nhập admin.' });
    return;
  }

  try {
    const body = await parseJson(req);
    const question = String(body.question || '').trim();
    const provider = String(body.provider || 'gemini');
    if (!question) {
      sendJson(res, 400, { message: 'Câu hỏi không được để trống.' });
      return;
    }
    const envKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
    const model = provider === 'groq' ? process.env.GROQ_MODEL : process.env.GEMINI_MODEL;
    if (!envKey || !model) {
      sendJson(res, 500, { message: 'API key hoặc model server chưa được cấu hình cho admin.' });
      return;
    }
    const chunks = retrieveChunks(question);
    if (!chunks.length) {
      sendJson(res, 200, { answer: 'Tôi không tìm thấy thông tin này trong dữ liệu CVHT hiện có.' });
      return;
    }
    const prompt = buildPrompt(question, chunks);
    const answer = provider === 'groq'
      ? await callGroqApi(prompt, envKey, model)
      : await callGeminiApi(prompt, envKey, model);
    sendJson(res, 200, { answer });
  } catch (error) {
    sendJson(res, 500, { message: error instanceof Error ? error.message : 'Lỗi không xác định khi gọi mô hình.' });
  }
}
