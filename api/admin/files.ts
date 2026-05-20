import { IncomingMessage, ServerResponse } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import formidable from 'formidable';
import { addDocument, deleteDocument, getDocuments, reindexDocument } from '../../src/lib/serverData';
import { parseCookies, verifyAdminToken, createLogoutCookie, sendJson } from '../utils';
import { rateLimit } from '../rateLimit';
import { extractTextFromFile } from '../fileHelpers';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  try {
    await getAdminEmail(req);
  } catch (error) {
    res.setHeader('Set-Cookie', createLogoutCookie());
    sendJson(res, 401, { message: 'Yêu cầu đăng nhập admin.' });
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, { documents: getDocuments() });
    return;
  }

  const url = new URL(req.url ?? '', `http://localhost`);
  const documentId = url.searchParams.get('documentId');

  if (req.method === 'POST') {
    const form = formidable({
      multiples: false,
      uploadDir: os.tmpdir(),
      keepExtensions: true,
    });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        sendJson(res, 500, { message: 'Không thể phân tích tệp tải lên.' });
        return;
      }
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file || !file.filepath || !file.originalFilename) {
        sendJson(res, 400, { message: 'Không tìm thấy tệp hợp lệ.' });
        return;
      }
      const fileName = file.originalFilename;
      const ext = path.extname(fileName).toLowerCase();
      if (!['.txt', '.md', '.pdf', '.docx'].includes(ext)) {
        sendJson(res, 400, { message: 'Định dạng tệp không được hỗ trợ.' });
        return;
      }
      try {
        const text = await extractTextFromFile(file.filepath, fileName);
        const summary = addDocument(fileName, file.size ?? 0, text);
        await fs.unlink(file.filepath).catch(() => undefined);
        sendJson(res, 200, { document: summary });
      } catch (ex) {
        sendJson(res, 500, { message: 'Trích xuất văn bản thất bại. Vui lòng thử lại với tệp khác.' });
      }
    });
    return;
  }

  if (!documentId) {
    sendJson(res, 400, { message: 'documentId không được để trống.' });
    return;
  }

  if (req.method === 'DELETE') {
    const deleted = deleteDocument(documentId);
    if (!deleted) {
      sendJson(res, 404, { message: 'Tài liệu không tìm thấy.' });
      return;
    }
    sendJson(res, 200, { message: 'Xóa tài liệu thành công.' });
    return;
  }

  if (req.method === 'PUT') {
    const ok = reindexDocument(documentId);
    if (!ok) {
      sendJson(res, 404, { message: 'Tài liệu không tìm thấy để tái chỉ mục.' });
      return;
    }
    sendJson(res, 200, { message: 'Tái chỉ mục thành công.' });
    return;
  }

  res.setHeader('Allow', 'GET, POST, DELETE, PUT');
  sendJson(res, 405, { message: 'Phương thức không được hỗ trợ.' });
}
