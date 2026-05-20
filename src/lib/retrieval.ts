import type { ChunkRecord } from '../types';
import { SYSTEM_INSTRUCTION } from './constants';

const STOP_WORDS = new Set([
  'và', 'là', 'của', 'được', 'cho', 'với', 'trong', 'một', 'mỗi', 'đi', 'đến', 'này', 'vì', 'khi', 'vậy', 'như', 'rất', 'cần', 'sẽ', 'có', 'không', 'những', 'vẫn', 'đã', 'từ', 'còn'
]);

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function splitTextToChunks(
  documentId: string,
  fileName: string,
  text: string
): ChunkRecord[] {
  const normalized = normalizeText(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const chunkSize = 700;
  const overlap = 120;
  const chunks: ChunkRecord[] = [];

  for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
    const slice = tokens.slice(i, i + chunkSize);
    const chunkText = slice.join(' ');
    const chunkId = `${documentId}-${chunks.length + 1}`;
    chunks.push({
      document_id: documentId,
      file_name: fileName,
      chunk_id: chunkId,
      text: chunkText,
      created_at: new Date().toISOString(),
    });
  }

  if (chunks.length === 0) {
    const chunkId = `${documentId}-1`;
    chunks.push({
      document_id: documentId,
      file_name: fileName,
      chunk_id: chunkId,
      text: normalized,
      created_at: new Date().toISOString(),
    });
  }

  return chunks;
}

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

export function scoreChunk(query: string, chunk: ChunkRecord): number {
  const queryTokens = tokenizeQuery(query);
  const content = chunk.text.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (content.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function retrieveRelevantChunks(
  query: string,
  chunks: ChunkRecord[],
  maxResults = 5
): ChunkRecord[] {
  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(query, chunk),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.chunk);

  return scored;
}

export function buildUserPrompt(question: string, chunks: ChunkRecord[]): string {
  const content = chunks
    .map((chunk) => `Nguồn: ${chunk.file_name} - ${chunk.chunk_id}\n${chunk.text}`)
    .join('\n\n');

  return `${SYSTEM_INSTRUCTION}\n\nContext:\n${content}\n\nHỏi: ${question}\n\nTrả lời bằng tiếng Việt, chỉ dựa trên thông tin trên. Nếu thiếu thông tin, trả lời chính xác: 'Tôi không tìm thấy thông tin này trong dữ liệu CVHT hiện có.'\n\nNguồn dữ liệu:`;
}
