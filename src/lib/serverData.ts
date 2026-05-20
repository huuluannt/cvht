import { v4 as uuidv4 } from 'uuid';
import type { ChunkRecord, DocumentSummary } from '../types';
import { splitTextToChunks, retrieveRelevantChunks } from './retrieval';

interface DocumentRecord {
  document_id: string;
  file_name: string;
  uploaded_at: string;
  size: number;
  status: 'ready' | 'failed';
  chunk_count: number;
  text: string;
}

interface Store {
  documents: DocumentRecord[];
  chunks: ChunkRecord[];
}

const globalAny = globalThis as any;
if (!globalAny.__CVHT_STORE) {
  globalAny.__CVHT_STORE = {
    documents: [] as DocumentRecord[],
    chunks: [] as ChunkRecord[],
  };
}

const store: Store = globalAny.__CVHT_STORE;

export function getDocuments(): DocumentSummary[] {
  return store.documents.map((doc) => ({
    document_id: doc.document_id,
    file_name: doc.file_name,
    uploaded_at: doc.uploaded_at,
    size: doc.size,
    status: doc.status,
    chunk_count: doc.chunk_count,
  }));
}

export function getAllChunks(): ChunkRecord[] {
  return store.chunks;
}

export function addDocument(fileName: string, size: number, text: string): DocumentSummary {
  const document_id = uuidv4();
  const chunks = splitTextToChunks(document_id, fileName, text);
  const record = {
    document_id,
    file_name: fileName,
    uploaded_at: new Date().toISOString(),
    size,
    status: 'ready' as const,
    chunk_count: chunks.length,
    text,
  };
  store.documents.push(record);
  store.chunks.push(...chunks);
  return {
    document_id,
    file_name: fileName,
    uploaded_at: record.uploaded_at,
    size,
    status: record.status,
    chunk_count: record.chunk_count,
  };
}

export function deleteDocument(documentId: string): boolean {
  const docIndex = store.documents.findIndex((doc) => doc.document_id === documentId);
  if (docIndex === -1) return false;
  store.documents.splice(docIndex, 1);
  store.chunks = store.chunks.filter((chunk) => chunk.document_id !== documentId);
  return true;
}

export function reindexDocument(documentId: string): boolean {
  const record = store.documents.find((doc) => doc.document_id === documentId);
  if (!record) return false;
  store.chunks = store.chunks.filter((chunk) => chunk.document_id !== documentId);
  const chunks = splitTextToChunks(documentId, record.file_name, record.text);
  record.chunk_count = chunks.length;
  store.chunks.push(...chunks);
  return true;
}

export function retrieveChunks(question: string): ChunkRecord[] {
  return retrieveRelevantChunks(question, store.chunks, 5);
}
