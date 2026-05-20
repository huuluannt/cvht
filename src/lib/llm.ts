import { SYSTEM_INSTRUCTION } from './constants';
import type { ChunkRecord, Provider } from '../types';

export function buildPrompt(question: string, chunks: ChunkRecord[]): string {
  const contextText = chunks
    .map(
      (chunk) => `=== Nguồn: ${chunk.file_name} - ${chunk.chunk_id}\n${chunk.text}`
    )
    .join('\n\n');

  return `${SYSTEM_INSTRUCTION}\n\nContext:\n${contextText}\n\nHỏi: ${question}\n\nTrả lời ngắn gọn bằng tiếng Việt, chỉ dùng thông tin trong dữ liệu. Luôn ghi \"Nguồn dữ liệu:\" với tên file và chunk id.`;
}

export async function callGeminiApi(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const url = `https://api.gemini.google.com/v1/models/${encodeURIComponent(model)}:generateText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: {
        text: prompt,
      },
      temperature: 0.2,
      max_output_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API lỗi: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (typeof data?.candidates?.[0]?.content === 'string') {
    return data.candidates[0].content.trim();
  }
  if (typeof data?.output?.text === 'string') {
    return data.output.text.trim();
  }
  throw new Error('Không đọc được phản hồi từ Gemini.');
}

export async function callGroqApi(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const url = 'https://api.groq.ai/v1/llama/generate';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      max_output_tokens: 800,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API lỗi: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (typeof data?.results?.[0]?.content === 'string') {
    return data.results[0].content.trim();
  }
  if (typeof data?.text === 'string') {
    return data.text.trim();
  }
  throw new Error('Không đọc được phản hồi từ Groq.');
}

export async function callProvider(
  provider: Provider,
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (provider === 'gemini') {
    return callGeminiApi(prompt, apiKey, model);
  }
  return callGroqApi(prompt, apiKey, model);
}
