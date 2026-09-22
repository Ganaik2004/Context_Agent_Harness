# AI Notepad — Complete Project Reference

> A local-first AI notepad: a block editor (text + resizable images) inside a folder system, with a Perplexity-style AI chat sidebar that can read the note you're working on. Opens to a "My Folders" Home dashboard; folders hold notes; the AI sidebar appears only inside the note editor. Everything lives on your disk — no account, no cloud.

---

## 1. Tech Stack (all decisions are firm — do not change without reason)

| Layer | Technology | Version / note |
|---|---|---|
| Language | TypeScript | **strict** mode everywhere: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all ON |
| Frontend | React | **19** |
| Build tool | Vite | **8** (Rolldown bundler) |
| Editor engine | TipTap | **v3** (ProseMirror under the hood) — defines the document schema |
| State | Zustand | **5** — three SEPARATE stores: `document`, `prefs`, `ai` |
| Styling | Tailwind CSS | **v4** — CSS-first config: `@import "tailwindcss"` + `@theme` in `src/index.css` |
| Icons | Lucide React | **ALL** icons, never inline SVG or emoji |
| AI reply rendering | react-markdown + remark-gfm | headings/lists/links/tables/code |
| AI streaming | native fetch + ReadableStream | hand-rolled SSE parser, **no** AI SDK |
| Server | FastAPI | **Python** — ONE process serves static + API |
| CLI / launcher | Node ESM bin | `bin/ai-note.js`, command name `Ai_note`, uses `open` lib to launch browser |
| Persistence | Disk via Python `pathlib` | `~/.ai_note/` (override `AI_NOTE_HOME`) — source of truth, NOT localStorage/IndexedDB |
| Lint + format | Biome | **2** — single tool, replaces ESLint+Prettier |
| Tests | Vitest | **5** |
| Node | >= 20 | ESM (`"type": "module"`) |

---

## 2. Commands

```sh
npm run dev        # dev launcher: tsx watch (API :4311) + Vite (:5173, proxies /api → :4311)
npm run build      # typecheck + build client (dist/) and server (dist-server/)
npm start          # serve the built app on http://localhost:4311
npm test           # Vitest (runs shared + server + src tests)
npm run lint       # Biome check (lint:fix to auto-fix)
npm run typecheck  # tsc --noEmit across 3 tsconfig projects (client, node, server)
```

---

## 3. Complete File Structure (every file, annotated)

```
AI_NOTEPAD/
├── index.html                       # SPA shell, mounts /src/main.tsx, color-scheme dark
├── package.json                     # deps, scripts, "bin": { "Ai_note": "bin/ai-note.js" }
├── biome.json                       # formatter + linter; CSS linter/formatter DISABLED;
│                                    # files.includes excludes dist, coverage, reference, .commandcode
├── vite.config.ts                   # client build: react + tailwind plugins, @ + @shared aliases,
│                                    #   dev proxy /api → localhost:4311, target es2022
├── vite.config.server.ts            # server SSR build → dist-server/index.js (node20, minify off)
├── vitest.config.ts                 # node env, includes shared/** + server/** + src/**
├── tsconfig.json                    # client: strict, paths @/* → src/*, @shared/* → shared/*
├── tsconfig.server.json             # server: strict, includes server + shared, types node
├── tsconfig.node.json               # config files: vite configs + vitest config
│
├── src/                             # FRONTEND (React 19 + TypeScript strict)
│   ├── main.tsx                     # React 19 createRoot, StrictMode, imports index.css
│   ├── index.css                    # @import "tailwindcss"; @theme tokens; @layer base + @layer components
│   │                                  (ALL ~1040 lines of visual styles live here — see §5)
│   ├── App.tsx                      # composition root: boot sequence, layout shell, view-based rendering
│   │                                  (home/folder/note), conditional AiSidebar + StatusBar (note view only)
│   │
│   ├── components/
│   │   ├── TitleBar.tsx             # brand logo + name (clickable → Home), dynamic breadcrumbs
│   │   │                              (My Folders > [folder] > [note]; folder name clickable → folder
│   │   │                              view), AI connection pill, sidebar toggle (visible only in note view)
│   │   ├── NoteTabs.tsx             # open-note tab strip: active highlight, per-tab ✕ close,
│   │   │                              + new note; closing last tab auto-creates a fresh note
│   │   ├── Toolbar.tsx              # +Text, +Image, Undo/Redo (can()-aware disabled states),
│   │   │                              Search dropdown (debounced /api/search, jump-to-select),
│   │   │                              font size A−/A+ (13–22px via prefs store)
│   │   ├── DocCanvas.tsx            # scrollable canvas; mounts EditorContent; FLOATING GUTTER (＋/grip)
│   │   │                              tracks hovered block via onMouseMove; insert menu (Text/Image/
│   │   │                              Delete); DELETE BLOCK feature (§6.5); insert-menu + delete
│   │   │                              positioning
│   │   ├── AiSidebar.tsx            # resizable (200px min – 50% container max, div drag handle with
│   │   │                              grip) + collapsible; Perplexity-style redesign: header + status
│   │   │                              chip, auto-hide connection settings, centered empty state,
│   │   │                              rounded composer card (auto-grow textarea to 160px, Enter-to-send),
│   │   │                              toolbar (Include-current-file pill / Model picker pill / circular
│   │   │                              send-stop button), floating model panel. Rendered ONLY in note
│   │   │                              view; chat uses react-markdown for assistant; clear history
│   │   ├── HomePage.tsx            # "My Folders" dashboard: folder count + note count, search/filter,
│   │   │                              New Folder button, folder card grid (accent color swatch, note
│   │   │                              count, edit/delete actions, click → folder view)
│   │   ├── FolderView.tsx          # folder contents: back button, folder name + note count, search,
│   │   │                              New Note button, note card grid (click → editor, inline rename,
│   │   │                              delete with confirm modal)
│   │   ├── NewFolderModal.tsx      # create/rename folder modal (name input + color swatch picker)
│   │   ├── ConfirmModal.tsx        # reusable destructive-action confirmation (delete note/folder)
│   │   ├── StatusBar.tsx           # words · chars (shared/count), note title, save indicator
│   │   │                              (Saving amber → Saved green HH:MM:SS / Save failed red / Ready
│   │   │                              muted). Rendered ONLY in note view — hidden on Home/folder
│   │   ├── HintChip.tsx             # dismissible bottom-left hint (Ctrl+V, drag edges, + menu);
│   │   │                              dismissal persisted via prefs store
│   │   └── ImageBlockView.tsx       # React node view: relative "stage" with aspect-ratio height;
│   │                                  left + right resize handles (pointer capture, touch-action none);
│   │                                  size badge "W × H px"; setNodeMarkup with addToHistory:false
│   │
│   ├── editor/
│   │   ├── EditorProvider.tsx       # owns TipTap editor per note (recreated on note change via key);
│   │   │                              extensions: StarterKit + MultilineEnter + Placeholder + ImageBlockNode;
│   │   │                              handlePaste/handleDrop for images; global window paste handler;
│   │   │                              exposes editor via context + activeEditorRef + editorNoteMap;
│   │   │                              onUpdate → store.updateDoc (debounced save)
│   │   ├── ImageBlockNode.ts        # custom TipTap node "imageBlock" (atom, block, selectable):
│   │   │                              attrs src, width, left, natW, natH; rendered by ImageBlockView
│   │   ├── MultilineEnter.ts        # Enter → hard break (same paragraph); Shift+Enter → new paragraph;
│   │   │                              ENTER ON IMAGE (NodeSelection) → new paragraph AFTER image + focus;
│   │   │                              priority 1001; Backspace UNTOUCHED
│   │   ├── insert.ts                # defaultImageWidth, imageFilesFrom, insertImageFiles (uses
│   │   │                              blockLevelPosition so images NEVER go inside text — always a
│   │   │                              sibling block below the current paragraph; async-safe check
│   │   │                              view.dom.isConnected), posAfterBlock, posAfterSelectionBlock,
│   │   │                              insertParagraphAt, logUploadError, posBeforeBlock,
│   │   │                              blockRangeForElement (delete support)
│   │   └── *.test.ts                # MultilineEnter.test.ts (4), insert.test.ts (4), delete.test.ts (7)
│   │
│   ├── stores/
│   │   ├── document.ts              # notes, openTabs, activeNoteId, docs, saveStatus, savedAt;
│   │   │                              600ms debounced disk writes; bootstrap/openNote/createNote/
│   │   │                              closeTab/renameNote/updateDoc/flushNote/flushAll; tab layout
│   │   │                              persisted to prefs.json
│   │   ├── prefs.ts                 # sidebarOpen, sidebarWidth (200px min, no hardcoded max — component
│   │   │                              clamps to 50% of container), fontSize (13–22), showHint;
│   │   │                              hydrate/toggleSidebar/setSidebarWidth/changeFontSize/dismissHint;
│   │   │                              persisted to prefs.json; applies --doc-fs to documentElement
│   │   └── ai.ts                    # baseUrl, apiKey, model, includeContext, status (disconnected/
│   │   │                              connecting/connected/error), error, models[], messages[],
│   │   │                              streaming; hydrate/setters/connect (GET /models), send (POST
│   │   │                              /chat/completions, streams via SSEParser), stop (abort),
│   │   │                              clearHistory; builds system context from active note when
│   │   │                              includeContext; persisted to chat.json + prefs.json
│   │
│   └── lib/
│       └── api.ts                   # typed REST client (listNotes, createNote, getNote, saveNote [+folderId],
│                                      deleteNote, listFolders, createFolder, updateFolder, deleteFolder,
│                                      getPrefs, putPrefs, getChat, putChat, search); uploadImage (FormData);
│                                      imageDimensions; ApiError class
│
├── backend/                          # PYTHON FASTAPI SERVER
│   ├── main.py                      # Entry point — starts Uvicorn on 127.0.0.1:4311
│   ├── app.py                       # create_app(): FsStore init, seedIfEmpty, mounts all routes,
│   │                                  static SPA fallback with index.html
│   ├── config.py                    # defaultDataDir (~/.ai_note or $AI_NOTE_HOME), defaultDistDir
│   ├── store.py                     # FsStore: read_json (FileNotFound→fallback), write_json (atomic
│   │                                  temp+rename), write_image/read_image; NOTE_ID_RE, IMAGE_NAME_RE
│   ├── seed.py                      # welcomeDoc() + seedIfEmpty (creates default "Notes" folder +
│   │                                  welcome note + 2 sample SVGs)
│   ├── static.py                    # Static file handler: SPA fallback, MIME map, immutable cache
│   ├── routes/
│   │   ├── notes.py                 # GET / (list), POST / (create), GET /:id, PUT /:id, DELETE /:id
│   │   ├── folders.py               # GET / (list), POST / (create), GET /:id, PUT /:id, DELETE /:id
│   │   ├── prefs.py                 # GET /, PUT / (shallow-merge patch)
│   │   ├── chat.py                  # GET / (chat.json), PUT / (filter valid, slice last 400)
│   │   ├── images.py                # POST / (multipart, validates MIME/ext, max 25MB), GET /:name
│   │   └── search.py                # GET /?q= (full-text search, max 50 results, snippets)
│   ├── lib/
│   │   ├── doctext.py               # docToText (extract plain text from TipTap JSON), asNoteDoc
│   │   └── search.py                # findTextRange, makeSnippet
│   ├── requirements.txt             # fastapi, uvicorn, python-multipart
│   └── backend.md                   # Detailed flow documentation (beginner-friendly)
│
├── shared/                          # dependency-free, used by frontend AND server AND tests
│   ├── types.ts                     # DocNode, NoteDoc, NoteMeta (+folderId), NoteRecord, FolderMeta,
│   │                                  AIPrefs, PrefsFile, AIMessage, SearchResult, DEFAULT_BASE_URL,
│   │                                  DEFAULT_MODEL
│   ├── count.ts                     # countWords, docStats (words + chars from doc)
│   ├── doctext.ts                   # nodeSize, eachTextNode (text + ProseMirror pos), docToText
│   │                                  (one line per block), asNoteDoc (safe fallback)
│   ├── search.ts                    # findTextRange (case-insensitive, maps back to PM positions),
│   │                                  makeSnippet
│   ├── sse.ts                       # SSEParser (incremental, handles \n/\r\n/\r, comment lines,
│   │                                  final flush), parseChatEvent ([DONE], delta content, error
│   │                                  payloads)
│   ├── id.ts                        # newId (crypto.randomUUID with fallback)
│   └── *.test.ts                    # doctext (11), sse (15), search (8), count (5) unit tests
│
├── bin/
│   └── ai-note.js                   # #!/usr/bin/env node; guards missing build; imports
│                                      dist-server/index.js; startServer({openBrowser:true});
│                                      EADDRINUSE message
│
├── scripts/
│   └── dev.mjs                      # spawns `npm run dev:server` + `npm run dev:web`, prefixed
│                                      colored output, kills both tree (taskkill on win32) on
│                                      exit/SIGINT/SIGTERM
│
├── public/
│   └── favicon.svg
│
├── dist/                            # built client (after npm run build)
├── dist-server/                     # built server: dist-server/index.js
│
└── reference/                       # ORIGINAL PROTOTYPE (HTML/CSS/React) — reference only, NOT built
    ├── index.html
    ├── App.tsx                     # the contentEditable-based prototype the production app was built from
    └── styles.css                  # the EXACT design tokens + component CSS that src/index.css ports
```

---

## 4. How the App Boots (data flow, end to end)

```
App.tsx mounts
  └─ boot() runs ONCE (module-level promise, StrictMode-safe)
       ├─ api.getPrefs() → prefsStore.hydrate(prefs)        # sidebar, font, hint, tabs
       ├─ aiStore.hydrate(prefs)                            # ai connection + chat history
       └─ documentStore.bootstrap(prefs.openTabs, prefs.activeNoteId)
             ├─ api.listNotes() → notes index
             ├─ api.listFolders() → folders index (seeds default "Notes" folder if none)
             ├─ if no folders AND no folders exist: create default folder + migrate unfiled notes into it
             ├─ if notes empty: api.createNote('Note 1') assigned to default folder + seed
             └─ set view: 'home'  ← startup is ALWAYS Home (My Folders), never auto-opens a note

State-based navigation (no router): documentStore.view ∈ {'home','folder','note'} + activeFolderId.
  view='home' → HomePage (folder grid)
  view='folder' → FolderView (note cards in a folder; openFolder(id) sets this)
  view='note' → EditorProvider > Toolbar > DocCanvas (openNote(id) sets this)

Layout: TitleBar(brand→Home, breadcrumbs, AI pill, toggle[note only]) >
  <flex-1>
    <main>
      NoteTabs[note only]
      { home: HomePage | folder: FolderView | note: Editor }
    </main>
    AiSidebar[note only]
  </flex-1>
  StatusBar[note only]
  HintChip
```

**Editor:** `EditorProvider` creates one TipTap editor per note (recreated via `key={activeId}` on switch). Extensions: `StarterKit` + `MultilineEnter` + `Placeholder` + `ImageBlockNode`. Every edit → `onUpdate` → `asNoteDoc(editor.getJSON())` → `store.updateDoc()` → **600ms debounced** → `api.saveNote()` → `FsStore.writeJson()` (atomic) to `~/.ai_note/notes/<id>.json` + updates `notes.json`.

**Images:** paste/drop → `uploadImage()` (POST `/api/images`, FormData) → file saved to `images/<uuid>.<ext>` → returns `{url, width, height}` → `insertImageFiles()` → `blockLevelPosition` (§6.3) → insert `imageBlock` node as a **sibling block** after the current paragraph.

**AI chat:** `send()` → POST `/chat/completions` with `stream:true` + last 20 messages + optional system context → `ReadableStream` → `SSEParser` → `parseChatEvent()` → incremental state. Connect validates via GET `/models`.

---

## 5. Visual Design (from reference/styles.css, ported to src/index.css)

Dark theme. Design tokens (Tailwind `@theme`):
- `--color-bg #14161b`, `--color-panel #1b1e25`, `--color-panel2 #20242c`, `--color-border #2a2e39`, `--color-text #e8eaf0`, `--color-muted #8b93a7`, `--color-accent #7c6ff0`, `--color-accent2 #8b7cf7`, `--color-green #34d399`, `--color-amber #f5b83d`, `--color-pink #ec6a9f`, `--color-red #e06c75`, `--color-field #101318`.
- `--doc-fs: 16px` (driven by prefs A−/A+).

Heights: titlebar 48px, tabs 38px, toolbar 46px, statusbar 28px. Document column: `.doc` has `padding-inline: 56px` (side margins); `.tiptap` is `width: 100%` with **NO max-width cap** so content fills available canvas width. Floating `.gutter` at `left: 0` of `.doc`.

**Biome formatting rules:** no semicolons, single quotes, trailing commas, 2-space indent, LF, line width 100. CSS linter + formatter are DISABLED in biome.json.

---

## 6. Key Implementation Details

### 6.1 Document model (TipTap / ProseMirror)
- `NoteDoc = { type: 'doc', content: DocNode[] }`. Each top-level node is a block: a `paragraph` (text) or `imageBlock`.
- `imageBlock` attrs: `src, width, left, natW, natH`. It's an **atom** (no children, selectable).
- TipTap renders blocks flat inside `.doc`. ProseMirror positions are **content-relative** (first child starts at position 0, NOT 1).
- `posAfterBlock` / `posBeforeBlock` map a DOM element to a doc position by walking `editor.view.dom.children`.

### 6.2 Enter key (MultilineEnter.ts)
- **Enter inside text** → `setHardBreak()` (new `<br>` line, same paragraph — multiline support).
- **Shift+Enter** → `splitBlock()` (new paragraph / text block).
- **Enter on a selected image** (NodeSelection on imageBlock) → insert empty paragraph AFTER image (`selection.from + nodeSize`), focus + set caret.
- **Backspace** → UNTOUCHED (TipTap native). `priority: 1001` so these shortcuts win over StarterKit.
- Placeholder text: `Type here…  (Shift+Enter = new block)`.

### 6.3 Image insertion — NEVER inside text (insert.ts)
- `blockLevelPosition(doc, pos)`: if `pos` is inside a textblock (`$pos.depth >= 1 && $pos.parent.isTextblock`), returns `$pos.after($pos.depth)` — i.e. AFTER the whole paragraph. Otherwise returns `pos` unchanged. This guarantees images are always independent sibling blocks, even when pasted/dropped mid-sentence in a multiline paragraph.
- `insertImageFiles` resolves position via `blockLevelPosition`, uploads each file, inserts nodes, advancing `insertAt` by `node.nodeSize` per file. Async-safety: checks `view.dom.isConnected` before each dispatch (stops if user switched notes mid-upload).

### 6.4 Resize handles (ImageBlockView.tsx)
- Image sits in a relative `.img-stage`; height = `round(width / aspect)`. Two handles (left + right) at the vertical center. Right handle changes width (left pinned); left handle changes both `left` and `width` (right edge pinned). Clamped to `[140, container width]`. Updates via `setNodeMarkup` with `addToHistory: false` so pixel drags are one undo gesture.

### 6.5 Delete block (NEW — DocCanvas.tsx)
- Gutter now stores the hovered block's DOM element (`gutter.el`) alongside `top` and `pos`.
- **Delete block menu item** (`.menu-danger`, red Trash2 icon) appears as the 3rd option in the `+` menu.
- **Hidden when only 1 block** (`editor.state.doc.childCount <= 1`) — document can never be emptied.
- `deleteBlock` → `blockRangeForElement(editor, el)` re-resolves `{from, to}` from the LIVE DOM element (robust against position shifts) → `tr.delete(from, to)`. Guards: `el.isConnected`, non-null range, childCount > 1. Uses native ProseMirror transaction (undoable, autosave-friendly).

### 6.6 Stores (Zustand, three separate stores)
- **document**: note/tab/folder state + docs + debounced writes. Holds `notes`, `openTabs`, `activeNoteId`, `docs`, `saveStatus`, `savedAt` PLUS `folders: FolderMeta[]`, `view: 'home'|'folder'|'note'`, `activeFolderId`. Navigation actions: `setView`, `openFolder(id)`, `goHome`. Folder actions: `createFolder`, `updateFolder`, `deleteFolder` (reassigns notes to another folder, never deletes them), `notesInFolder(id)`. Note actions: `openNote` (sets `view:'note'`), `createNote` (assigns to active folder), `renameNote`, `deleteNote` (removes from store, re-opens another note or returns to Home). `bootstrap()` always starts on `view:'home'` and migrates pre-folder notes into a default "Notes" folder.
- **prefs**: UI prefs (sidebar, font, hint) + tab layout. `sidebarWidth` persisted raw (min 200 only); max is computed at render time. Persisted to `prefs.json` via `api.putPrefs` (300ms debounce).
- **ai**: connection + chat. Debounced persists to `chat.json` (600ms) and `prefs.json` (400ms for ai prefs).

### 6.8 Sidebar resize handle (AiSidebar.tsx)
- A `<div>` handle (`.sidebar-resize-handle`) with a child grip (`.sidebar-resize-grip`) sits on the sidebar's left vertical edge (`left: -6px`, full height, 12px hit area). `<hr>` was replaced because it cannot host a child grip or reliably receive pointer capture.
- `maxWidth = max(MIN_WIDTH, floor(containerWidth / 2))` where `containerWidth` is tracked via `ResizeObserver` on the parent flex container — so the 50% cap is always accurate and updates on viewport resize.
- Drag updates are throttled through `requestAnimationFrame`; persistence stays on the existing 300ms debounce in the prefs store.
- `displayWidth = min(savedWidth, maxWidth)` — the store keeps the raw saved value (so a width saved on a large screen is restored when the user returns to it), while the clamped value is used for rendering.

### 6.9 Conditional sidebar / status / toggle visibility
The AI sidebar, the StatusBar (editor footer), and the sidebar toggle button are all rendered ONLY in note view — never on Home or folder pages, with no reserved layout space:
- `App.tsx`: `{view === 'note' && <AiSidebar />}` and `{view === 'note' && <StatusBar />}`.
- `TitleBar.tsx`: `{view === 'note' && <button sidebar-toggle>}`. The AI connection pill stays visible on all pages.
- `NoteTabs` is also rendered only in note view.
This means Home and folder pages get the full content width; the editor gets the sidebar + footer. AI state (connection, chat, models) is preserved across view changes because the stores are global — only the components unmount/remount.

### 6.10 Breadcrumb navigation (TitleBar.tsx)
Dynamic breadcrumb driven by `view` + `activeFolderId`:
- Always: `My Folders` (button → `goHome()`).
- `view === 'folder'`: `My Folders > {folder.name}` (folder button → `openFolder(id)`).
- `view === 'note'`: `My Folders > {folder.name} > {note.title}` — folder name is a clickable button → `openFolder(id)` (returns to that folder's note list); the note title is a non-clickable `<b>` identifying the current note. If the note has no folder, the folder segment shows "Notes" and is disabled.
The brand logo + "AI Notepad" is also a clickable button → `goHome()` from any page.

### 6.7 Persistence (FsStore)
- Atomic writes: temp file + rename. Files: `notes.json` (index), `notes/<id>.json` (docs), `folders.json` (folder index), `prefs.json`, `chat.json`, `images/<uuid>.<ext>`.
- Data dir: `~/.ai_note/` or `$AI_NOTE_HOME`. Default data dir for tests is a temp dir.

---

## 7. Data on Disk (`~/.ai_note/`)

```
~/.ai_note/
  notes.json         # { notes: NoteMeta[] } — index of all notes (each has folderId)
  notes/<id>.json    # NoteRecord (id, title, folderId, createdAt, updatedAt, doc) — one per note
  folders.json       # { folders: FolderMeta[] } — id, name, color, createdAt, updatedAt
  prefs.json         # PrefsFile — sidebar, font, hint, tabs, AI endpoint/key/model
  chat.json          # { messages: AIMessage[] } — AI chat history
  images/<uuid>.<ext>  # uploaded/pasted images, served at /api/images/<name>
```

---

## 8. Conventions to Follow When Making Changes

- **No semicolons**, single quotes, trailing commas, 2-space indent (Biome enforces).
- **All icons from lucide-react** — never inline SVG or emoji.
- **Strict TypeScript** — no implicit any, no unused vars/params. Type returns explicitly.
- **Tailwind v4 CSS-first**: design tokens in `@theme`; component/global styles in `@layer base`/`@layer components` in `src/index.css`.
- **Disk is source of truth** — all persistence via `api.ts` → Hono routes → `FsStore`. Never localStorage/IndexedDB.
- **Comments only where logic isn't self-evident** — codebase is sparsely commented by design.
- **One editor per note**, recreated on note switch; live instance via `activeEditorRef.current`.
- **Three separate Zustand stores** — don't merge them.
- Path aliases: `@/*` → `src/*`, `@shared/*` → `shared/*`. Config: `@` → `src`, `baseUrl` `.`.

---

## 9. Current Verified State (all passing as of last build)

| Check | Result |
|---|---|
| `npm run typecheck` | clean (3 tsconfig projects) |
| `npx biome check` | clean |
| `npm test` | **76 passed** (shared 39 + server API 22 + MultilineEnter 4 + insert 4 + delete 7) |
| `npm run build` | client (dist/) + server (dist-server/) build OK |

