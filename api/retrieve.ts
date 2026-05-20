import { rateLimit } from './rateLimit';
import { retrieveChunks } from '../src/lib/serverData';
import { sendJson } from './utils';
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const rate = rateLimit(req);
  res.setHeader('Retry-After', String(rate.retryAfter));
  if (!rate.allowed) {
    sendJson(res, 429, { message: rate.message });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { message: 'Phương thức không được hỗ trợ.' });
    return;
  }

  try {
    const body = await parseJson(req);
    const question = String(body.question || '').trim();
    if (!question) {
      sendJson(res, 400, { message: 'Câu hỏi không được để trống.' });
      return;
    }
    const chunks = retrieveChunks(question);
    sendJson(res, 200, { chunks });
  } catch (error) {
    sendJson(res, 400, { message: 'Không thể xử lý yêu cầu.' });
  }
}

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
