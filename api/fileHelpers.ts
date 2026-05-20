import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);

  if (ext === '.txt' || ext === '.md') {
    return fileBuffer.toString('utf-8');
  }

  if (ext === '.pdf') {
    const data = await pdfParse(fileBuffer);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  throw new Error('Unsupported file type.');
}
