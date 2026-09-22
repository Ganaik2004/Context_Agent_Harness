/**
 * Hand-rolled parsing for Server-Sent Events (the `text/event-stream` wire
 * format used by OpenAI-compatible chat streaming endpoints). No libraries —
 * the AI store feeds network chunks in and gets parsed events out.
 */

export interface SSEEvent {
  event?: string
  data: string
}

function parseBlock(block: string): SSEEvent | null {
  const data: string[] = []
  let event: string | undefined
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue // blank lines and comments
    if (line.startsWith('data:')) {
      data.push(line.slice(5).replace(/^ /, ''))
    } else if (line.startsWith('event:')) {
      event = line.slice(6).replace(/^ /, '')
    }
    // `id:` and `retry:` lines are ignored.
  }
  if (data.length === 0 && event === undefined) return null
  return { event, data: data.join('\n') }
}

/** Incremental SSE parser — feed it decoded chunks, receive complete events. */
export class SSEParser {
  private buffer = ''

  push(chunk: string): SSEEvent[] {
    this.buffer += chunk
    return this.drain(false)
  }

  /** Flushes any buffered (unterminated) event once the stream has ended. */
  final(): SSEEvent[] {
    return this.drain(true)
  }

  private drain(flush: boolean): SSEEvent[] {
    // SSE allows \n, \r\n and \r line endings. \r\n pairs are combined first;
    // a trailing lone \r is held back because it may be the first half of a
    // \r\n pair split across two chunks (or a terminator in its own right,
    // resolved by the next chunk / final()).
    let s = this.buffer.replace(/\r\n/g, '\n')
    let pendingCR = ''
    if (s.endsWith('\r')) {
      s = s.slice(0, -1)
      pendingCR = '\r'
    }
    s = s.replace(/\r/g, '\n')
    if (flush && pendingCR) {
      s += '\n'
      pendingCR = ''
    }
    this.buffer = s + pendingCR

    const out: SSEEvent[] = []
    let sep = this.buffer.indexOf('\n\n')
    while (sep >= 0) {
      const block = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep + 2)
      const parsed = parseBlock(block)
      if (parsed) out.push(parsed)
      sep = this.buffer.indexOf('\n\n')
    }
    if (flush && this.buffer.trim()) {
      const parsed = parseBlock(this.buffer)
      this.buffer = ''
      if (parsed) out.push(parsed)
    }
    return out
  }
}

export interface ChatDelta {
  /** Assistant text from this chunk. */
  content?: string
  /** True when the stream signalled completion ([DONE]). */
  done?: boolean
  /** Error message when the provider sent an error payload. */
  error?: string
}

/** Parses one `data:` payload from a chat-completions stream. */
export function parseChatEvent(data: string): ChatDelta {
  if (data === '[DONE]') return { done: true }
  try {
    const json = JSON.parse(data) as {
      choices?: { delta?: { content?: unknown } }[]
      error?: { message?: unknown } | string
    }
    if (json.error !== undefined) {
      const error =
        typeof json.error === 'string' ? json.error : String(json.error?.message ?? 'Unknown error')
      return { error }
    }
    const content = json.choices?.[0]?.delta?.content
    if (typeof content === 'string' && content.length > 0) return { content }
    return {}
  } catch {
    return { error: 'Could not parse streaming response' }
  }
}
