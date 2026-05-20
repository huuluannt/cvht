# CVHT Chatbot

CVHT Chatbot is an academic advisor chatbot for Khoa Sinh học - CNSH, Trường Đại học Khoa học tự nhiên, ĐHQG-HCM.

## Tech Stack

- Vite + React + TypeScript
- Vercel serverless API
- Google OAuth admin login
- Gemini / Groq support
- RAG over uploaded documents

## Features

- User mode with local browser API key storage
- Admin mode with Google OAuth and server-side keys
- Document upload: `.txt`, `.md`, `.pdf`, `.docx`
- Keyword retrieval-based RAG
- Strict anti-hallucination behavior
- Admin document management: upload, list, delete, re-index
- Per-IP rate limiting and validation

## Local Setup

1. Clone repository and install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Fill in required values in `.env`:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ADMIN_EMAILS`
- `SESSION_SECRET`

4. Run the app locally:

```bash
npm run dev
```

Open `http://localhost:4173`.

## Google OAuth Setup

1. Open Google Cloud Console and create a new project or use an existing one.
2. In the OAuth consent screen, configure app name and support email, then publish the app for internal use if only admin emails are allowed.
3. Create OAuth credentials for a **Web application**.
4. Set **Authorized redirect URIs** to:

```
https://cvht.vercel.app/api/auth/google/callback
```

5. Set **Authorized JavaScript origins** to:

```
https://cvht.vercel.app
```

6. Copy the generated `Client ID` and `Client Secret` into `.env`.
7. Add allowed admin emails to `ADMIN_EMAILS` as a comma-separated list.
8. For local testing, you can also add `http://localhost:4173` as an additional redirect URI and origin.

## Deployment to Vercel

1. Push your repository to GitHub.
2. Create a new Vercel project and connect the repo.
3. Set build command:

```bash
npm run build
```

4. Set output directory:

```bash
dist
```

5. In Vercel Environment Variables, add the same keys from `.env.example` and use production values.
6. Use the `Production` environment for `GEMINI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, and `SESSION_SECRET`.
7. Deploy the project.

> Note: For Vercel Hobby free, the app runs as a static build with serverless API routes. Keep uploaded documents small, and remember that in-memory document storage may reset after redeploys or cold starts.

## Important Notes

- User API keys are stored only in browser `localStorage`.
- Server-side admin keys are never exposed to the frontend.
- Uploaded documents are stored in server memory during runtime and may be lost after cold starts or redeploys.
- The chatbot answers strictly from the uploaded document context; if no context is found, it replies:

```
Tôi không tìm thấy thông tin này trong dữ liệu CVHT hiện có.
```
