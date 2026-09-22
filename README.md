# AI Notepad

Local-first AI notepad: a block editor (text + resizable images) with an AI chat
sidebar that can read the note you're working on. Notes, images, chat history and
preferences live on your disk — no account, no cloud.

## Stack

- **Frontend** — React 19, TipTap v3 (ProseMirror) editor with a custom resizable
  image block, Zustand stores, Tailwind CSS v4, react-markdown for AI replies
- **Server** — Hono on Node.js: REST API for notes, images, prefs, chat history
  and full-text search, plus static hosting of the built frontend
- **AI** — any OpenAI-compatible chat endpoint (default: OpenRouter), streamed
  over SSE with a hand-rolled parser (`shared/sse.ts`)
- **Shared** — pure, dependency-free document/search/count utilities in
  `shared/`, unit-tested with Vitest

## Scripts

```sh
npm run dev        # dev launcher: tsx watch (API :4311) + Vite (:5173, proxies /api)
npm run build      # typecheck + build client (dist/) and server (dist-server/)
npm start          # serve the built app on http://localhost:4311
npm test           # Vitest unit + API tests
npm run lint       # Biome check (lint:fix to auto-fix)
npm run typecheck  # tsc across client, server and config projects
```

Installed as a package, the `Ai_note` bin (`bin/ai-note.js`) starts the built
server and opens the browser. `PORT` overrides the default port 4311.

## Data

Everything is stored under `~/.ai_note/` (override with `AI_NOTE_HOME`):

```
~/.ai_note/
  notes/           one JSON file per note (TipTap document JSON)
  images/          uploaded/pasted images, served at /api/images/…
  prefs.json       sidebar size, font size, tabs, AI endpoint/key/model
  chat.json        AI chat history
```

Images you paste (Ctrl+V) or drop into a note are uploaded to the server and
inserted as blocks whose width and offset you can adjust by dragging their edges.
