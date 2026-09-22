/** Generates filesystem-safe unique ids (used for note ids and image names). */
export function newId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  // Fallback for very old runtimes without WebCrypto.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
