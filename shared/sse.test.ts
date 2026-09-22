import { describe, expect, it } from 'vitest'
import { parseChatEvent, SSEParser } from './sse'

describe('SSEParser', () => {
  it('parses events separated by blank lines', () => {
    const parser = new SSEParser()
    expect(parser.push('data: hello\n\ndata: world\n\n')).toEqual([
      { event: undefined, data: 'hello' },
      { event: undefined, data: 'world' },
    ])
  })

  it('buffers chunks split mid-token', () => {
    const parser = new SSEParser()
    expect(parser.push('data: {"choices":[{"delta":{"content":"He')).toEqual([])
    expect(parser.push('llo"}}]}\n\n')).toEqual([
      { event: undefined, data: '{"choices":[{"delta":{"content":"Hello"}}]}' },
    ])
  })

  it('ignores comment lines (OpenRouter keep-alives)', () => {
    const parser = new SSEParser()
    const events = parser.push(': OPENROUTER PROCESSING\n\ndata: x\n\n')
    expect(events).toEqual([{ event: undefined, data: 'x' }])
  })

  it('supports CRLF line endings', () => {
    const parser = new SSEParser()
    expect(parser.push('data: one\r\n\r\ndata: two\r\n\r\n')).toEqual([
      { event: undefined, data: 'one' },
      { event: undefined, data: 'two' },
    ])
  })

  it('handles a CR/NL pair split across chunks', () => {
    const parser = new SSEParser()
    expect(parser.push('data: one\r')).toEqual([])
    // The \r\n pair joins into one line terminator, so both data lines belong
    // to the same event.
    expect(parser.push('\ndata: two\n\n')).toEqual([{ event: undefined, data: 'one\ntwo' }])
  })

  it('joins multiple data lines with newlines', () => {
    const parser = new SSEParser()
    expect(parser.push('data: a\ndata: b\n\n')).toEqual([{ event: undefined, data: 'a\nb' }])
  })

  it('parses named events', () => {
    const parser = new SSEParser()
    expect(parser.push('event: ping\ndata: 1\n\n')).toEqual([{ event: 'ping', data: '1' }])
  })

  it('flushes an unterminated trailing event on final()', () => {
    const parser = new SSEParser()
    expect(parser.push('data: tail')).toEqual([])
    expect(parser.final()).toEqual([{ event: undefined, data: 'tail' }])
  })

  it('drops comment-only blocks', () => {
    const parser = new SSEParser()
    expect(parser.push(': keepalive\n\n: another\n\n')).toEqual([])
  })
})

describe('parseChatEvent', () => {
  it('detects the [DONE] sentinel', () => {
    expect(parseChatEvent('[DONE]')).toEqual({ done: true })
  })

  it('extracts delta content', () => {
    expect(parseChatEvent('{"choices":[{"delta":{"role":"assistant","content":"Hi"}}]}')).toEqual({
      content: 'Hi',
    })
  })

  it('returns nothing for role-only chunks', () => {
    expect(parseChatEvent('{"choices":[{"delta":{"role":"assistant"}}]}')).toEqual({})
    expect(parseChatEvent('{"choices":[{"delta":{}}]}')).toEqual({})
  })

  it('returns empty-content chunks as empty', () => {
    expect(parseChatEvent('{"choices":[{"delta":{"content":""}}]}')).toEqual({})
  })

  it('surfaces provider error payloads', () => {
    expect(parseChatEvent('{"error":{"message":"Rate limited"}}')).toEqual({
      error: 'Rate limited',
    })
    expect(parseChatEvent('{"error":"bad key"}')).toEqual({ error: 'bad key' })
  })

  it('flags malformed json', () => {
    const result = parseChatEvent('{not json')
    expect(result.error).toBeDefined()
  })
})
