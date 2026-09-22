import type {
  AIMessage,
  FolderMeta,
  NoteDoc,
  NoteMeta,
  NoteRecord,
  PrefsFile,
  SearchResult,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      // not a JSON error body
    }
    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<T>
}

const jsonBody = (body: unknown): RequestInit => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  listNotes: () => json<{ notes: NoteMeta[] }>('/api/notes/'),
  createNote: (title?: string, folderId?: string, color?: string) =>
    json<NoteRecord>('/api/notes/', { method: 'POST', ...jsonBody({ title, folderId, color }) }),
  getNote: (id: string) => json<NoteRecord>(`/api/notes/${id}`),
  saveNote: (id: string, title: string, doc: NoteDoc, folderId?: string, color?: string) =>
    json<{ ok: true; note: NoteMeta }>(`/api/notes/${id}`, {
      method: 'PUT',
      ...jsonBody({ title, doc, folderId, color }),
    }),
  deleteNote: (id: string) => json<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),
  getPrefs: () => json<PrefsFile>('/api/prefs/'),
  putPrefs: (patch: PrefsFile) =>
    json<PrefsFile>('/api/prefs/', { method: 'PUT', ...jsonBody(patch) }),
  getChat: () => json<{ messages: AIMessage[] }>('/api/chat/'),
  putChat: (messages: AIMessage[]) =>
    json('/api/chat/', { method: 'PUT', ...jsonBody({ messages }) }),
  search: (q: string) =>
    json<{ results: SearchResult[] }>(`/api/search/?q=${encodeURIComponent(q)}`),
  listFolders: () => json<{ folders: FolderMeta[] }>('/api/folders/'),
  createFolder: (name: string, color: string) =>
    json<FolderMeta>('/api/folders/', { method: 'POST', ...jsonBody({ name, color }) }),
  updateFolder: (id: string, patch: { name?: string; color?: string }) =>
    json<FolderMeta>(`/api/folders/${id}`, { method: 'PUT', ...jsonBody(patch) }),
  deleteFolder: (id: string) => json<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' }),
}

export interface UploadedImage {
  url: string
  width: number
  height: number
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth || 600, height: img.naturalHeight || 400 })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 600, height: 400 })
    }
    img.src = url
  })
}

/** Uploads an image to the server and reports its natural size. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const { width, height } = await imageDimensions(file)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/images/?width=${width}&height=${height}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let message = `Image upload failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<UploadedImage>
}
