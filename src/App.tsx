import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChunkRecord, Provider } from './types';
import { PROVIDER_LABELS, SYSTEM_INSTRUCTION, MAX_QUESTION_LENGTH } from './lib/constants';
import { buildPrompt, callProvider } from './lib/llm';

const STORAGE_KEY = 'cvht_api_key';
const STORAGE_PROVIDER = 'cvht_provider';

interface AdminStatus {
  admin: boolean;
  email?: string;
}

interface RetrieveResponse {
  chunks: ChunkRecord[];
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào, tôi là chatbot CVHT của Khoa Sinh học - CNSH, Trường Đại học Khoa học tự nhiên, ĐHQG-HCM! Bạn có thắc mắc gì không?',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({ admin: false });
  const [documents, setDocuments] = useState<Array<{ document_id: string; file_name: string; uploaded_at: string; size: number; status: string; chunk_count: number; }>>([]);
  const [uploading, setUploading] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY) || '';
    const savedProvider = (localStorage.getItem(STORAGE_PROVIDER) as Provider) || 'gemini';
    setApiKey(savedKey);
    setProvider(savedProvider);
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.admin) {
          setAdminStatus(data);
          fetchDocuments();
        }
      })
      .catch(() => {
        setAdminStatus({ admin: false });
      });
  }, []);

  const providerOptions = useMemo(
    () => [
      { value: 'gemini' as Provider, label: PROVIDER_LABELS.gemini },
      { value: 'groq' as Provider, label: PROVIDER_LABELS.groq },
    ],
    []
  );

  const chatMode = adminStatus.admin ? 'admin' : 'user';

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  const saveProvider = (next: Provider) => {
    setProvider(next);
    localStorage.setItem(STORAGE_PROVIDER, next);
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/admin/files');
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    setError('');
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Vui lòng nhập câu hỏi.');
      return;
    }
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      setError(`Câu hỏi không được vượt quá ${MAX_QUESTION_LENGTH} ký tự.`);
      return;
    }

    appendMessage({ id: uuidv4(), role: 'user', text: trimmed });
    setQuestion('');
    setLoading(true);

    try {
      if (chatMode === 'admin') {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, provider }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Lỗi máy chủ.');
        }
        appendMessage({ id: uuidv4(), role: 'assistant', text: data.answer });
      } else {
        if (!apiKey) {
          throw new Error('API key bị thiếu. Vui lòng thêm API key trước khi chat.');
        }
        const retrieveRes = await fetch('/api/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed }),
        });
        const retrieveData: RetrieveResponse = await retrieveRes.json();
        if (!retrieveRes.ok) {
          throw new Error(retrieveData?.toString() || 'Lỗi khi tìm kiếm dữ liệu.');
        }
        if (!retrieveData.chunks.length) {
          appendMessage({
            id: uuidv4(),
            role: 'assistant',
            text: 'Tôi không tìm thấy thông tin này trong dữ liệu CVHT hiện có.',
          });
        } else {
          const prompt = buildPrompt(trimmed, retrieveData.chunks);
          const providerModel = provider === 'gemini' ? import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash' : import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';
          const answer = await callProvider(provider, prompt, apiKey, providerModel);
          appendMessage({ id: uuidv4(), role: 'assistant', text: answer });
        }
      }
    } catch (catchError) {
      const message = catchError instanceof Error ? catchError.message : 'Lỗi không xác định.';
      setError(message);
      appendMessage({ id: uuidv4(), role: 'assistant', text: `Lỗi: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleKeySave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('API key không thể để trống.');
      return;
    }
    saveApiKey(trimmed);
    setError('');
  };

  const handleDeleteKey = () => {
    setApiKey('');
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setAdminMessage('Đang tải tệp lên...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Upload thất bại.');
      }
      setAdminMessage('Tải tệp thành công.');
      fetchDocuments();
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : 'Lỗi khi tải tệp.');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleDocumentAction = async (documentId: string, action: 'delete' | 'reindex') => {
    setAdminMessage(action === 'delete' ? 'Đang xóa...' : 'Đang tái chỉ mục...');
    try {
      const res = await fetch(`/api/admin/files?documentId=${encodeURIComponent(documentId)}`, {
        method: action === 'delete' ? 'DELETE' : 'PUT',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Thao tác thất bại.');
      }
      setAdminMessage(data.message || 'Thành công.');
      fetchDocuments();
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : 'Lỗi khi thực hiện thao tác.');
    }
  };

  return (
    <div className="page-shell">
      <main className={adminStatus.admin ? 'admin-shell' : 'user-shell'}>
        <section className="chat-panel">
          <header className="app-header">
            <div>
              <h1>CVHT Chatbot</h1>
              <p>Academic advisor chatbot for Khoa Sinh học - CNSH, ĐHQG-HCM.</p>
            </div>
            <div className="mode-pill">{chatMode === 'admin' ? 'Admin mode' : 'User mode'}</div>
          </header>

          <div className="chat-window">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="message-role">{message.role === 'user' ? 'Bạn' : 'CVHT'}</div>
                <div className="message-text">{message.text}</div>
              </div>
            ))}
          </div>

          <div className="chat-controls">
            <label className="input-group">
              <span>Câu hỏi của bạn</span>
              <textarea
                value={question}
                rows={4}
                maxLength={MAX_QUESTION_LENGTH}
                placeholder="Nhập câu hỏi..."
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>

            <div className="settings-row">
              {!adminStatus.admin && (
                <div className="provider-stack">
                  <label>
                    Nhà cung cấp
                    <select value={provider} onChange={(e) => saveProvider(e.target.value as Provider)}>
                      {providerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {!adminStatus.admin && (
                <div className="key-actions">
                  <button type="button" onClick={() => setShowGuide(true)}>
                    How to get API key?
                  </button>
                  <button type="button" onClick={handleKeySave}>
                    Add API Key
                  </button>
                </div>
              )}
            </div>

            {!adminStatus.admin && (
              <div className="key-box">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Dán Gemini hoặc Groq API key vào đây"
                />
                <button type="button" className="delete-key" onClick={handleDeleteKey}>
                  Xóa API key
                </button>
              </div>
            )}

            {error && <div className="error-box">{error}</div>}
            <div className="action-row">
              {adminStatus.admin ? (
                <button type="button" onClick={() => (window.location.href = '/api/auth/logout')}>
                  Đăng xuất admin
                </button>
              ) : (
                <a className="admin-link" href="/api/auth/google">
                  Đăng nhập admin
                </a>
              )}
              <button type="button" onClick={handleSend} disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi câu hỏi'}
              </button>
            </div>
          </div>
        </section>

        {adminStatus.admin && (
          <aside className="admin-panel">
            <h2>Bảng điều khiển admin</h2>
            <div className="upload-card">
              <label className="file-upload">
                <span>Upload tài liệu (.txt, .md, .pdf, .docx)</span>
                <input type="file" accept=".txt,.md,.pdf,.docx" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <div className="admin-hint">{adminMessage || 'Quản lý file để cập nhật dữ liệu RAG.'}</div>
            <div className="document-list">
              {documents.length === 0 ? (
                <div className="empty-state">Chưa có tài liệu nào được tải lên.</div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.document_id} className="document-item">
                    <div className="doc-main">
                      <strong>{doc.file_name}</strong>
                      <span>{doc.status === 'ready' ? 'Sẵn sàng' : 'Lỗi'}</span>
                    </div>
                    <div className="doc-meta">
                      <span>Uploaded: {new Date(doc.uploaded_at).toLocaleString('vi-VN')}</span>
                      <span>Size: {Math.round(doc.size / 1024)} KB</span>
                      <span>Chunks: {doc.chunk_count}</span>
                    </div>
                    <div className="doc-actions">
                      <button type="button" onClick={() => handleDocumentAction(doc.document_id, 'reindex')}>
                        Re-index
                      </button>
                      <button type="button" onClick={() => handleDocumentAction(doc.document_id, 'delete')}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </main>

      {showGuide && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Hướng dẫn lấy API key</h2>
            <p>
              Để sử dụng chế độ người dùng, bạn cần thêm Gemini hoặc Groq API key của riêng bạn. API key sẽ chỉ được lưu trong trình duyệt của bạn.
            </p>
            <div className="modal-section">
              <h3>Gemini</h3>
              <ol>
                <li>Đăng nhập vào Google Cloud Console hoặc Gemini API dashboard.</li>
                <li>Tạo key mới và sao chép giá trị.</li>
                <li>Dán vào ô API key trên ứng dụng.</li>
              </ol>
            </div>
            <div className="modal-section">
              <h3>Groq</h3>
              <ol>
                <li>Đăng nhập vào Groq AI dashboard.</li>
                <li>Tạo API key và sao chép giá trị.</li>
                <li>Dán vào ô API key trên ứng dụng.</li>
              </ol>
            </div>
            <div className="modal-note">
              <strong>Lưu ý:</strong> Free tier có giới hạn tốc độ. Không chia sẻ API key với người khác.
            </div>
            <button type="button" onClick={() => setShowGuide(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
