export type Provider = 'gemini' | 'groq';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export interface ChunkRecord {
  document_id: string;
  file_name: string;
  chunk_id: string;
  text: string;
  created_at: string;
}

export interface DocumentSummary {
  document_id: string;
  file_name: string;
  uploaded_at: string;
  size: number;
  status: 'ready' | 'failed';
  chunk_count: number;
}
