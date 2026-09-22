#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const entry = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist-server',
  'index.js',
)

if (!existsSync(entry)) {
  console.error('AI Notepad has not been built yet. Run `npm run build` first.')
  process.exit(1)
}

const { startServer } = await import(entry)

try {
  // PORT is read from the environment by startServer; the URL is printed there.
  await startServer({ openBrowser: true })
} catch (err) {
  if (err?.code === 'EADDRINUSE') {
    console.error(`Port ${process.env.PORT ?? 4311} is already in use.`)
    console.error('Pick another one, e.g. `PORT=4524 ai-note`.')
  } else {
    console.error('Failed to start AI Notepad:', err)
  }
  process.exit(1)
}
