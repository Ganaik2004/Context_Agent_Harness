# AI Notepad Backend — Complete Flow Guide

## What is this?

This is the **backend** (server side) of the AI Notepad app. It's written in **Python** using a framework called **FastAPI**. Its job is to:

- Store notes, folders, images, chat history, and user preferences on disk
- Serve the frontend (the web page you see in the browser)
- Handle all API requests from the frontend

---

## Folder Structure

```
backend/
├── main.py              ← Entry point — starts the server
├── app.py               ← Creates the FastAPI app, wires everything together
├── config.py            ← Default paths and port settings
├── store.py             ← File-system database (reads/writes JSON files)
├── seed.py              ← Creates sample data on first run
├── static.py            ← Serves the frontend HTML/JS/CSS files
├── requirements.txt     ← Python packages to install
├── routes/              ← API endpoints (one file per feature)
│   ├── notes.py         ← Create, read, update, delete notes
│   ├── folders.py       ← Create, read, update, delete folders
│   ├── images.py        ← Upload and serve images
│   ├── search.py        ← Search through all notes
│   ├── chat.py          ← Save and load AI chat history
│   └── prefs.py         ← Save and load user preferences
└── lib/                 ← Helper functions
    ├── doctext.py       ← Extract plain text from note documents
    └── search.py        ← Build search snippets
```

---

## How the Server Starts

### Step 1: `main.py` runs

When you run `python main.py`, this happens:

1. It reads the port from the `PORT` environment variable (default: `4311`)
2. It calls `create_app()` from `app.py`
3. It starts the Uvicorn server (a Python web server) on `127.0.0.1:4311`

### Step 2: `app.py` — `create_app()` does the setup

This is the **heart of the backend**. Here's what it does in order:

```
1. Determine data directory (where files are stored)
   → Default: ~/.ai_note (your home folder)
   → Override with AI_NOTE_HOME environment variable

2. Determine frontend directory (where HTML/JS/CSS lives)
   → Default: <project_root>/dist

3. Create a FsStore object (the file-system database)
   → store = FsStore(data_dir)

4. Initialize the store
   → Creates notes/ and images/ subdirectories if they don't exist

5. Seed the database (first-run setup)
   → If no notes exist, creates a "Notes" folder and a welcome note

6. Create the FastAPI app

7. Register all API routes:
   → /api/notes     — note CRUD
   → /api/folders   — folder CRUD
   → /api/prefs     — user preferences
   → /api/chat      — AI chat history
   → /api/images    — image upload/serving
   → /api/search    — full-text search

8. Add a catch-all route to serve the frontend
   → Any URL that doesn't match an API route serves the web page

9. Return the app
```

---

## How Data is Stored

The backend uses a **file-system database** — no MySQL, no MongoDB. Everything is stored as JSON files in one folder.

### Default location: `~/.ai_note/`

```
~/.ai_note/
├── notes.json          ← Index of all notes (metadata only, no content)
├── folders.json        ← Index of all folders
├── prefs.json          ← User preferences (sidebar width, AI settings, etc.)
├── chat.json           ← AI chat history
├── notes/              ← Individual note files
│   ├── <id-1>.json     ← Full note with content (TipTap JSON)
│   ├── <id-2>.json
│   └── ...
└── images/             ← Uploaded images
    ├── <id>.png
    ├── <id>.jpg
    └── ...
```

### What is `notes.json`?

This is the **index** — a list of note metadata (no content). It's like a table of contents:

```json
{
  "notes": [
    {
      "id": "abc-123",
      "title": "My First Note",
      "folderId": "folder-1",
      "color": "#8b7cf6",
      "createdAt": 1695000000000,
      "updatedAt": 1695000000000
    }
  ]
}
```

### What is a note file (`notes/<id>.json`)?

This is the **full note** including the document content:

```json
{
  "id": "abc-123",
  "title": "My First Note",
  "folderId": "folder-1",
  "color": "#8b7cf6",
  "createdAt": 1695000000000,
  "updatedAt": 1695000000000,
  "doc": {
    "type": "doc",
    "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Hello world" }] }
    ]
  }
}
```

The `doc` field is **TipTap JSON** — the same format the editor produces.

---

## API Endpoints — Complete Reference

### Health Check

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/health` | Returns `{"ok": true}` — used to check if server is running |

---

### Notes (`/api/notes`)

Notes are the core of the app. Each note has a title, content (TipTap JSON), optional folder, and optional color.

#### GET `/api/notes` — List all notes

**What it does:** Returns the index of all notes (metadata only, no content).

**Response:**
```json
{
  "notes": [
    { "id": "abc", "title": "Note 1", "folderId": "f1", "color": "#8b7cf6", "createdAt": 1695000000000, "updatedAt": 1695000000000 },
    { "id": "def", "title": "Note 2", "folderId": null, "color": null, "createdAt": 1695000001000, "updatedAt": 1695000001000 }
  ]
}
```

**Flow:**
1. Read `notes.json` from disk
2. Return the list

---

#### POST `/api/notes` — Create a new note

**What it does:** Creates a new note with an empty document.

**Request body (optional):**
```json
{
  "title": "My Note",
  "folderId": "folder-1",
  "color": "#8b7cf6"
}
```

**Flow:**
1. Read the current index from `notes.json`
2. Generate a unique ID (UUID)
3. Create a note object with an empty document (`{"type": "doc", "content": [{"type": "paragraph"}]}`)
4. Save the full note to `notes/<id>.json`
5. Add the note's metadata to the index in `notes.json`
6. Return the full note object

**Response (201):**
```json
{
  "id": "abc-123",
  "title": "My Note",
  "doc": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "folderId": "folder-1",
  "color": "#8b7cf6",
  "createdAt": 1695000000000,
  "updatedAt": 1695000000000
}
```

---

#### GET `/api/notes/{id}` — Get a single note

**What it does:** Returns the full note including its document content.

**Flow:**
1. Validate the ID (must be alphanumeric, 1-64 chars)
2. Read `notes/<id>.json` from disk
3. If not found, return 404
4. Return the full note

**Response (200):** The full note object

---

#### PUT `/api/notes/{id}` — Update a note

**What it does:** Updates a note's title, content, folder, and color.

**Request body:**
```json
{
  "title": "Updated Title",
  "doc": { "type": "doc", "content": [...] },
  "folderId": "folder-2",
  "color": "#ec6a9f"
}
```

**Flow:**
1. Read the existing note from `notes/<id>.json`
2. If not found, return 404
3. Validate the `doc` field (must be a valid TipTap document)
4. Update the note with new values (keep old values for anything not provided)
5. Save the updated note to `notes/<id>.json`
6. Update the note's metadata in `notes.json` index
7. Return `{"ok": true, "note": {...}}`

---

#### DELETE `/api/notes/{id}` — Delete a note

**What it does:** Permanently deletes a note.

**Flow:**
1. Check if the note exists
2. Delete `notes/<id>.json` from disk
3. Remove the note's metadata from `notes.json` index
4. Return `{"ok": true}`

---

### Folders (`/api/folders`)

Folders organize notes. Each folder has a name and a color.

#### GET `/api/folders` — List all folders

**Response:**
```json
{
  "folders": [
    { "id": "f1", "name": "Notes", "color": "#8b7cf6", "createdAt": 1695000000000, "updatedAt": 1695000000000 }
  ]
}
```

---

#### POST `/api/folders` — Create a folder

**Request body (optional):**
```json
{
  "name": "Work",
  "color": "#34d399"
}
```

**Flow:**
1. Generate a unique ID
2. If no color provided, pick a random one from a preset list
3. Save to `folders.json`
4. Return the new folder

---

#### GET `/api/folders/{id}` — Get a single folder

Returns the folder object, or 404 if not found.

---

#### PUT `/api/folders/{id}` — Update a folder

Updates the name and/or color of a folder.

---

#### DELETE `/api/folders/{id}` — Delete a folder

Removes the folder from `folders.json`. Notes in that folder are NOT deleted — they just lose their folder assignment.

---

### Images (`/api/images`)

Images are uploaded by the user and stored on disk.

#### POST `/api/images` — Upload an image

**What it does:** Accepts an image file upload and saves it to disk.

**Request:** Multipart form data with a `file` field

**Query params (optional):**
- `width` — natural width of the image (0-20000)
- `height` — natural height of the image (0-20000)

**Flow:**
1. Read the uploaded file
2. Determine the file extension from the MIME type or filename
3. Validate it's a supported image type (png, jpg, gif, webp, svg, bmp, avif)
4. Check file size (max 25 MB)
5. Generate a unique filename: `<uuid>.<ext>`
6. Save to `images/<uuid>.<ext>`
7. Return `{"url": "/api/images/<uuid>.<ext>", "width": ..., "height": ...}`

**Response (201):**
```json
{
  "url": "/api/images/abc-123.png",
  "width": 800,
  "height": 600
}
```

---

#### GET `/api/images/{name}` — Serve an image

**What it does:** Returns the raw image bytes with the correct Content-Type header.

**Flow:**
1. Validate the filename (prevents directory traversal attacks)
2. Read `images/<name>` from disk
3. If not found, return 404
4. Return the image bytes with proper MIME type and cache headers

---

### Search (`/api/search`)

#### GET `/api/search?q=query` — Search notes

**What it does:** Searches through all notes for a query string.

**Flow:**
1. Get the query parameter `q`
2. If empty, return empty results
3. Read the notes index from `notes.json`
4. For each note (up to 50 results):
   - Read the full note from `notes/<id>.json`
   - Extract plain text from the TipTap document using `doc_to_text()`
   - Check if the query appears in the title or content
   - If found, create a snippet around the match
5. Return the list of results

**Response:**
```json
{
  "results": [
    {
      "noteId": "abc-123",
      "title": "My Note",
      "snippet": "...some text around the match…"
    }
  ]
}
```

**How `doc_to_text()` works:**
- TipTap documents are nested JSON trees
- This function walks the tree and collects all `text` nodes
- Returns one line per top-level block

**How `make_snippet()` works:**
- Takes the full text and the position of the match
- Extracts ~36 characters before and after the match
- Collapses whitespace and adds `…` at the edges

---

### Chat (`/api/chat`)

Stores the AI chat history so it survives page refreshes.

#### GET `/api/chat` — Get chat history

**Response:**
```json
{
  "messages": [
    { "id": "msg-1", "role": "user", "content": "Hello" },
    { "id": "msg-2", "role": "assistant", "content": "Hi there!" }
  ]
}
```

---

#### PUT `/api/chat` — Save chat history

**Request body:**
```json
{
  "messages": [
    { "id": "msg-1", "role": "user", "content": "Hello" },
    { "id": "msg-2", "role": "assistant", "content": "Hi there!" }
  ]
}
```

**Flow:**
1. Validate that `messages` is an array
2. Filter out invalid messages (must have role + content)
3. Keep only the last 400 messages
4. Save to `chat.json`
5. Return `{"ok": true, "kept": <number>}`

---

### Preferences (`/api/prefs`)

Stores UI settings and AI configuration.

#### GET `/api/prefs` — Get preferences

**Response:**
```json
{
  "sidebarOpen": true,
  "sidebarWidth": 280,
  "fontSize": 16,
  "ai": {
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "sk-...",
    "model": "openai/gpt-4.1-mini",
    "includeContext": true
  },
  "openTabs": ["note-1", "note-2"],
  "activeNoteId": "note-1"
}
```

---

#### PUT `/api/prefs` — Update preferences

**What it does:** Merges the provided patch with existing preferences.

**Request body (partial update):**
```json
{
  "sidebarWidth": 320,
  "fontSize": 18
}
```

**Flow:**
1. Read current preferences from `prefs.json`
2. Merge: `{...current, ...patch}` — new values override old ones
3. Save back to `prefs.json`
4. Return the merged preferences

---

## How the Frontend is Served

Any URL that doesn't start with `/api/` is handled by the static file server.

**Flow:**
1. Take the URL path (e.g., `/`, `/assets/index.js`, `/some/spa/route`)
2. Remove empty segments and `.` / `..` (security: prevents directory traversal)
3. Try to find the file in the `dist/` directory
4. If it's a directory, look for `index.html` inside it
5. If the file doesn't exist, fall back to `dist/index.html` (SPA routing)
6. Return the file with the correct Content-Type

**Special caching:**
- Files under `/assets/` get `Cache-Control: public, max-age=31536000, immutable` (cached forever)
- Everything else gets `Cache-Control: no-cache` (always revalidated)

---

## First-Run Seeding

When the server starts and the data directory is empty, `seed_if_empty()` runs:

1. Creates a default folder called "Notes" with a random color
2. Creates two sample SVG images (`welcome-4-3.svg`, `welcome-16-9.svg`)
3. Creates a welcome note with:
   - Some explanatory text
   - Two sample images
   - Assigned to the "Notes" folder

This only runs once — if `notes.json` and `folders.json` already have data, it skips.

---

## Request Flow Summary

Here's what happens when the frontend makes a request:

```
Frontend (browser)
    │
    │  GET /api/notes
    ▼
FastAPI (app.py)
    │
    │  Matches route: /api/notes
    ▼
Router (routes/notes.py)
    │
    │  Calls store.read_json("notes.json")
    ▼
FsStore (store.py)
    │
    │  Reads file from disk
    ▼
~/.ai_note/notes.json
    │
    │  Returns JSON data
    ▼
Router formats response
    │
    ▼
Frontend receives data
```

---

## How Data Flows from Frontend to Backend — Detailed Explanation

This section explains the **complete journey** of data: from the moment the user does something in the browser, through the network, into the backend, down to the file system, and back again.

---

### The Big Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                          │
│                                                                     │
│  User clicks button / types text / uploads image                    │
│       │                                                             │
│       ▼                                                             │
│  JavaScript code runs (React components)                            │
│       │                                                             │
│       ▼                                                             │
│  fetch() API call → HTTP request sent over network                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  HTTP Request (JSON / multipart)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                           │
│                                                                     │
│  1. Uvicorn receives the raw HTTP request                           │
│  2. FastAPI parses it (URL, headers, body)                          │
│  3. Route matching — which function handles this URL?               │
│  4. The route function runs (calls store, validates, etc.)          │
│  5. Store reads/writes files on disk                                │
│  6. Route function returns a Python dict                            │
│  7. FastAPI serializes it to JSON                                   │
│  8. HTTP response sent back over network                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  HTTP Response (JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                          │
│                                                                     │
│  fetch() receives the response                                      │
│       │                                                             │
│       ▼                                                             │
│  JSON is parsed into JavaScript objects                              │
│       │                                                             │
│       ▼                                                             │
│  React state is updated                                             │
│       │                                                             │
│       ▼                                                             │
│  UI re-renders with the new data                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Part 1: How the Frontend Sends Data

The frontend is a **React app** (built with Vite). When the user interacts with the app, JavaScript code uses the browser's built-in `fetch()` function to talk to the backend.

#### Example 1: Loading all notes when the app starts

```javascript
// This runs inside a React component (e.g., App.tsx)
async function loadNotes() {
  // Step 1: Send GET request to the backend
  const response = await fetch("http://127.0.0.1:4311/api/notes")

  // Step 2: Parse the JSON response
  const data = await response.json()

  // Step 3: Update React state with the notes
  setNotes(data.notes)
}
```

**What happens on the wire:**
```
GET /api/notes HTTP/1.1
Host: 127.0.0.1:4311
Accept: application/json
```

**What comes back:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "notes": [
    { "id": "abc", "title": "Note 1", ... },
    { "id": "def", "title": "Note 2", ... }
  ]
}
```

---

#### Example 2: Creating a new note

```javascript
async function createNote(title) {
  const response = await fetch("http://127.0.0.1:4311/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, folderId: "folder-1" })
  })

  const newNote = await response.json()
  setNotes([...notes, newNote])
}
```

**What happens on the wire:**
```
POST /api/notes HTTP/1.1
Host: 127.0.0.1:4311
Content-Type: application/json

{ "title": "My New Note", "folderId": "folder-1" }
```

**What comes back:**
```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My New Note",
  "doc": { "type": "doc", "content": [{ "type": "paragraph" }] },
  "folderId": "folder-1",
  "color": null,
  "createdAt": 1695000000000,
  "updatedAt": 1695000000000
}
```

---

#### Example 3: Updating a note (saving content)

```javascript
async function saveNote(id, title, doc) {
  const response = await fetch(`http://127.0.0.1:4311/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, doc: doc })
  })

  const result = await response.json()
  // result = { ok: true, note: { ... } }
}
```

**What happens on the wire:**
```
PUT /api/notes/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: 127.0.0.1:4311
Content-Type: application/json

{
  "title": "Updated Title",
  "doc": {
    "type": "doc",
    "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Hello world" }] }
    ]
  }
}
```

---

#### Example 4: Uploading an image

```javascript
async function uploadImage(file) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("http://127.0.0.1:4311/api/images", {
    method: "POST",
    body: formData  // No Content-Type header — browser sets it automatically
  })

  const result = await response.json()
  // result = { url: "/api/images/abc.png", width: 800, height: 600 }
}
```

**What happens on the wire:**
```
POST /api/images HTTP/1.1
Host: 127.0.0.1:4311
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXYZ

------WebKitFormBoundaryXYZ
Content-Disposition: form-data; name="file"; filename="photo.png"
Content-Type: image/png

<binary image data>
------WebKitFormBoundaryXYZ--
```

---

#### Example 5: Searching notes

```javascript
async function searchNotes(query) {
  const response = await fetch(
    `http://127.0.0.1:4311/api/search?q=${encodeURIComponent(query)}`
  )

  const data = await response.json()
  setSearchResults(data.results)
}
```

**What happens on the wire:**
```
GET /api/search?q=hello%20world HTTP/1.1
Host: 127.0.0.1:4311
```

---

### Part 2: How the Backend Receives and Processes Data

When an HTTP request arrives at the backend, it goes through several layers:

```
HTTP Request arrives
    │
    ▼
┌─────────────────────────────────────┐
│  Layer 1: Uvicorn (Web Server)      │
│  - Receives raw HTTP bytes          │
│  - Parses HTTP headers              │
│  - Passes to FastAPI                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Layer 2: FastAPI (Framework)       │
│  - Matches URL to a route           │
│  - Validates request body (JSON)    │
│  - Calls the route function         │
│  - Catches errors, formats response │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Layer 3: Router (routes/*.py)      │
│  - Contains the business logic      │
│  - Calls store to read/write data   │
│  - Validates data                   │
│  - Returns Python dict              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Layer 4: FsStore (store.py)        │
│  - Reads/writes JSON files          │
│  - Handles atomic writes            │
│  - Returns Python objects           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Layer 5: File System (disk)        │
│  - ~/.ai_note/notes.json            │
│  - ~/.ai_note/notes/<id>.json       │
│  - ~/.ai_note/images/<name>.png     │
└─────────────────────────────────────┘
```

---

### Part 3: Detailed Walkthrough — Creating a Note

Let's trace the **entire lifecycle** of a "create note" request:

```
STEP 1: User clicks "New Note" button in the frontend
    │
    ▼
STEP 2: React component calls createNote("My Note")
    │
    ▼
STEP 3: fetch("http://127.0.0.1:4311/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "My Note" })
  })
    │
    ▼
STEP 4: Browser sends HTTP request over the network
    │
    │  POST /api/notes HTTP/1.1
    │  Host: 127.0.0.1:4311
    │  Content-Type: application/json
    │
    │  { "title": "My Note" }
    │
    ▼
STEP 5: Uvicorn receives the request
    │
    ▼
STEP 6: FastAPI matches the URL to the route in routes/notes.py
    │
    │  @router.post("/")  ← matches POST /api/notes
    │  async def create_note(body: dict = None):
    │
    ▼
STEP 7: FastAPI parses the JSON body into a Python dict
    │
    │  body = {"title": "My Note"}
    │
    ▼
STEP 8: The route function runs
    │
    │  8a. Read current index from disk:
    │      index = store.read_json("notes.json", {"notes": []})
    │      → {"notes": [...existing notes...]}
    │
    │  8b. Generate unique ID:
    │      note_id = new_id()
    │      → "550e8400-e29b-41d4-a716-446655440000"
    │
    │  8c. Create note object:
    │      note = {
    │        "id": "550e8400-...",
    │        "title": "My Note",
    │        "doc": {"type": "doc", "content": [{"type": "paragraph"}]},
    │        "folderId": None,
    │        "color": None,
    │        "createdAt": 1695000000000,
    │        "updatedAt": 1695000000000
    │      }
    │
    │  8d. Save full note to disk:
    │      store.write_json("notes/550e8400-....json", note)
    │      → File written to ~/.ai_note/notes/550e8400-....json
    │
    │  8e. Update the index:
    │      index["notes"].append({ "id": "550e8400-...", "title": "My Note", ... })
    │      store.write_json("notes.json", index)
    │      → File written to ~/.ai_note/notes.json
    │
    │  8f. Return the note dict
    │
    ▼
STEP 9: FastAPI serializes the return value to JSON
    │
    │  {
    │    "id": "550e8400-...",
    │    "title": "My Note",
    │    "doc": { "type": "doc", "content": [{ "type": "paragraph" }] },
    │    "folderId": null,
    │    "color": null,
    │    "createdAt": 1695000000000,
    │    "updatedAt": 1695000000000
    │  }
    │
    ▼
STEP 10: FastAPI sends HTTP response
    │
    │  HTTP/1.1 201 Created
    │  Content-Type: application/json
    │
    │  { ...note JSON... }
    │
    ▼
STEP 11: Browser receives the response
    │
    ▼
STEP 12: fetch() promise resolves with the response
    │
    ▼
STEP 13: React updates state with the new note
    │
    ▼
STEP 14: UI re-renders — the new note appears in the sidebar
```

---

### Part 4: Detailed Walkthrough — Loading a Note's Content

When the user opens a note, the frontend needs the full content (the TipTap document):

```
STEP 1: User clicks on a note in the sidebar
    │
    ▼
STEP 2: React component calls loadNote(noteId)
    │
    ▼
STEP 3: fetch(`http://127.0.0.1:4311/api/notes/${noteId}`)
    │
    ▼
STEP 4: Browser sends HTTP request
    │
    │  GET /api/notes/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
    │
    ▼
STEP 5: FastAPI matches the route
    │
    │  @router.get("/{id}")  ← matches GET /api/notes/{id}
    │  async def get_note(id: str):
    │
    ▼
STEP 6: Route function runs
    │
    │  6a. Validate the ID:
    │      if not NOTE_ID_RE.match(id): return None
    │      → "550e8400-..." passes the regex check
    │
    │  6b. Read the note file from disk:
    │      note = store.read_json("notes/550e8400-....json", None)
    │      → Returns the full note object with doc content
    │
    │  6c. If not found, raise HTTPException(404)
    │
    │  6d. Return the note dict
    │
    ▼
STEP 7: FastAPI sends response
    │
    │  HTTP/1.1 200 OK
    │  Content-Type: application/json
    │
    │  {
    │    "id": "550e8400-...",
    │    "title": "My Note",
    │    "doc": {
    │      "type": "doc",
    │      "content": [
    │        { "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }
    │      ]
    │    },
    │    ...
    │  }
    │
    ▼
STEP 8: Frontend receives the note
    │
    ▼
STEP 9: React passes the doc to the TipTap editor
    │
    ▼
STEP 10: Editor renders the content — user sees their note
```

---

### Part 5: Detailed Walkthrough — Saving a Note

When the user types in the editor, the frontend periodically saves:

```
STEP 1: User types in the editor
    │
    ▼
STEP 2: TipTap editor produces a JSON document
    │
    │  doc = {
    │    "type": "doc",
    │    "content": [
    │      { "type": "paragraph", "content": [{ "type": "text", "text": "Hello world" }] }
    │    ]
    │  }
    │
    ▼
STEP 3: React component calls saveNote(id, title, doc)
    │
    ▼
STEP 4: fetch(`http://127.0.0.1:4311/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, doc: doc })
  })
    │
    ▼
STEP 5: Backend receives PUT request
    │
    │  @router.put("/{id}")
    │  async def update_note(id: str, body: dict = None):
    │
    ▼
STEP 6: Route function runs
    │
    │  6a. Read existing note:
    │      existing = store.read_json("notes/550e8400-....json", None)
    │
    │  6b. Validate the doc:
    │      if doc.get("type") != "doc": raise HTTPException(400)
    │
    │  6c. Update the note:
    │      store.write_json("notes/550e8400-....json", {
    │        **existing,
    │        "title": "Updated Title",
    │        "doc": { "type": "doc", "content": [...] },
    │        "updatedAt": 1695000001000
    │      })
    │
    │  6d. Update the index:
    │      index = store.read_json("notes.json", {"notes": []})
    │      # Update the matching note's metadata in the index
    │      store.write_json("notes.json", updated_index)
    │
    │  6e. Return { "ok": true, "note": {...} }
    │
    ▼
STEP 7: Frontend receives confirmation
    │
    ▼
STEP 8: Note is saved — no visible change to user (it just works)
```

---

### Part 6: Detailed Walkthrough — Uploading an Image

```
STEP 1: User drags an image into the editor
    │
    ▼
STEP 2: React creates a FormData object
    │
    │  const formData = new FormData()
    │  formData.append("file", imageFile)
    │
    ▼
STEP 3: fetch("http://127.0.0.1:4311/api/images", {
    method: "POST",
    body: formData
  })
    │
    ▼
STEP 4: Browser sends multipart request
    │
    │  POST /api/images HTTP/1.1
    │  Content-Type: multipart/form-data; boundary=----XYZ
    │
    │  ------XYZ
    │  Content-Disposition: form-data; name="file"; filename="photo.png"
    │  Content-Type: image/png
    │
    │  <binary data>
    │  ------XYZ--
    │
    ▼
STEP 5: FastAPI receives the request
    │
    │  @router.post("/")
    │  async def upload_image(file: UploadFile, width: int = 0, height: int = 0):
    │
    ▼
STEP 6: Route function runs
    │
    │  6a. Read the file content:
    │      content = await file.read()
    │      → b'\x89PNG\r\n\x1a\n...' (raw bytes)
    │
    │  6b. Determine extension:
    │      ext = MIME_TO_EXT.get("image/png") → "png"
    │
    │  6c. Validate:
    │      if len(content) > 25 * 1024 * 1024: raise HTTPException(400)
    │
    │  6d. Generate filename:
    │      name = f"{new_id()}.png" → "abc-123.png"
    │
    │  6e. Save to disk:
    │      store.write_image("abc-123.png", content)
    │      → File written to ~/.ai_note/images/abc-123.png
    │
    │  6f. Return { "url": "/api/images/abc-123.png", "width": 0, "height": 0 }
    │
    ▼
STEP 7: Frontend receives the URL
    │
    ▼
STEP 8: Frontend inserts an image block into the note's doc:
    │
    │  {
    │    "type": "imageBlock",
    │    "attrs": { "src": "/api/images/abc-123.png", "width": 560, ... }
    │  }
    │
    ▼
STEP 9: When the note is saved, the image URL is stored in the note
    │
    ▼
STEP 10: When the note is loaded, the browser requests the image:
    │
    │  GET /api/images/abc-123.png HTTP/1.1
    │
    ▼
STEP 11: Backend serves the image:
    │
    │  @router.get("/{name}")
    │  async def get_image(name: str):
    │      data = store.read_image("abc-123.png")
    │      return Response(data, media_type="image/png")
    │
    ▼
STEP 12: Browser displays the image
```

---

### Part 7: Detailed Walkthrough — Searching

```
STEP 1: User types in the search box
    │
    ▼
STEP 2: React calls searchNotes("hello")
    │
    ▼
STEP 3: fetch("http://127.0.0.1:4311/api/search?q=hello")
    │
    ▼
STEP 4: Backend receives GET request
    │
    │  @router.get("/")
    │  async def search(q: str = ""):
    │
    ▼
STEP 5: Route function runs
    │
    │  5a. Read the index:
    │      index = store.read_json("notes.json", {"notes": []})
    │
    │  5b. For each note in the index:
    │      - Read the full note from notes/<id>.json
    │      - Extract plain text using doc_to_text()
    │      - Check if "hello" appears in title or text
    │      - If found, create a snippet
    │
    │  5c. Return { "results": [...] }
    │
    ▼
STEP 6: Frontend displays search results
```

---

### Part 8: How the Frontend Handles Errors

```javascript
async function loadNotes() {
  try {
    const response = await fetch("http://127.0.0.1:4311/api/notes")

    if (!response.ok) {
      // Backend returned an error (404, 500, etc.)
      const error = await response.json()
      console.error("Error:", error.detail)
      return
    }

    const data = await response.json()
    setNotes(data.notes)
  } catch (err) {
    // Network error (server not running, connection refused)
    console.error("Network error:", err)
  }
}
```

**Common errors:**
- `404` — Note or folder not found
- `400` — Invalid request body (bad JSON, missing fields)
- `500` — Server error (file system issue, unexpected exception)
- Network error — Backend not running

---

### Part 9: Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  React      │    │  TipTap     │    │  Zustand    │    │  fetch()    │  │
│  │  Components │◄──►│  Editor     │    │  Store      │    │  API calls  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘  │
│                                                                  │          │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
                              HTTP Request (JSON / multipart)      │
                                                                   │
┌──────────────────────────────────────────────────────────────────┼──────────┐
│                              BACKEND                             │          │
│                                                                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FastAPI App (app.py)                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ /api/    │ │ /api/    │ │ /api/    │ │ /api/    │ │ /api/    │ │   │
│  │  │ notes    │ │ folders  │ │ images   │ │ search   │ │ chat     │ │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │   │
│  │       │            │            │            │            │       │   │
│  │       └────────────┴────────────┴────────────┴────────────┘       │   │
│  │                              │                                    │   │
│  │                              ▼                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │  FsStore (store.py)                                        │  │   │
│  │  │  - read_json()  → reads JSON from disk                     │  │   │
│  │  │  - write_json() → writes JSON to disk (atomic)              │  │   │
│  │  │  - read_image()  → reads image bytes from disk              │  │   │
│  │  │  - write_image() → writes image bytes to disk               │  │   │
│  │  └─────────────────────────┬───────────────────────────────────┘  │   │
│  └────────────────────────────┼──────────────────────────────────────┘   │
│                               │                                          │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   File System (disk)  │
                    │                       │
                    │  ~/.ai_note/          │
                    │  ├── notes.json       │
                    │  ├── folders.json     │
                    │  ├── prefs.json       │
                    │  ├── chat.json        │
                    │  ├── notes/           │
                    │  │   ├── <id>.json    │
                    │  │   └── ...          │
                    │  └── images/          │
                    │      ├── <id>.png    │
                    │      └── ...         │
                    └───────────────────────┘
```

---

### Part 10: Summary — What Happens When...

| User Action | Frontend Calls | Backend Route | Files Touched |
|-------------|---------------|---------------|---------------|
| App loads | `GET /api/notes` | `list_notes()` | Reads `notes.json` |
| App loads | `GET /api/folders` | `list_folders()` | Reads `folders.json` |
| App loads | `GET /api/prefs` | `get_prefs()` | Reads `prefs.json` |
| App loads | `GET /api/chat` | `get_chat()` | Reads `chat.json` |
| Click "New Note" | `POST /api/notes` | `create_note()` | Writes `notes/<id>.json` + `notes.json` |
| Open a note | `GET /api/notes/{id}` | `get_note()` | Reads `notes/<id>.json` |
| Type in editor | `PUT /api/notes/{id}` | `update_note()` | Writes `notes/<id>.json` + `notes.json` |
| Delete note | `DELETE /api/notes/{id}` | `delete_note()` | Deletes `notes/<id>.json` + updates `notes.json` |
| Create folder | `POST /api/folders` | `create_folder()` | Writes `folders.json` |
| Upload image | `POST /api/images` | `upload_image()` | Writes `images/<id>.<ext>` |
| View image | `GET /api/images/{name}` | `get_image()` | Reads `images/<name>` |
| Search | `GET /api/search?q=...` | `search()` | Reads `notes.json` + all `notes/<id>.json` |
| Save chat | `PUT /api/chat` | `put_chat()` | Writes `chat.json` |
| Change settings | `PUT /api/prefs` | `put_prefs()` | Writes `prefs.json` |

---

## Key Concepts for Beginners

### What is an API?
An API (Application Programming Interface) is a set of URLs that the frontend calls to get or save data. Each URL does one specific thing.

### What is CRUD?
CRUD stands for **C**reate, **R**ead, **U**pdate, **D**elete — the four basic operations:
- **Create** → POST
- **Read** → GET
- **Update** → PUT
- **Delete** → DELETE

### What is JSON?
JSON (JavaScript Object Notation) is a format for storing and transmitting data. It looks like a Python dictionary or a JavaScript object. All data in this backend is stored and transmitted as JSON.

### What is TipTap JSON?
TipTap is the text editor used in the frontend. It stores documents as nested JSON:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello" }
      ]
    }
  ]
}
```

### What is UUID?
UUID (Universally Unique Identifier) is a random string like `550e8400-e29b-41d4-a716-446655440000`. It's used for note IDs, folder IDs, and image filenames so nothing ever collides.

---

## Running the Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The server starts on `http://127.0.0.1:4311`.

To use a different port:
```bash
PORT=4524 python main.py
```

To use a different data directory:
```bash
AI_NOTE_HOME=/path/to/data python main.py
```
