import { createReadStream, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(__dirname, 'dist')
const port = Number(process.env.PORT ?? 8080)
const uniswapApiKey = process.env.UNISWAP_API_KEY || process.env.VITE_UNISWAP_API_KEY || ''
const ollamaHost = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function proxyRequest(req, res, prefix, upstreamBase, headers) {
  const path = req.url.slice(prefix.length) || '/'
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)

  try {
    const upstream = await fetch(`${upstreamBase}${path}`, {
      method: req.method,
      headers,
      body,
    })

    res.statusCode = upstream.status
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json')

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res)
    } else {
      res.end()
    }
  } catch (error) {
    sendJson(res, 502, {
      message: error instanceof Error ? error.message : 'Proxy request failed',
    })
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(distDir, requestedPath)

  if (!filePath.startsWith(distDir)) {
    sendJson(res, 400, { message: 'Invalid path' })
    return
  }

  if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) {
    filePath = join(distDir, 'index.html')
  }

  const type = mimeTypes[extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: 'Missing URL' })
    return
  }

  if (req.url.startsWith('/hooklens-uniswap')) {
    if (!uniswapApiKey) {
      sendJson(res, 500, { message: 'UNISWAP_API_KEY is not configured on the server.' })
      return
    }

    await proxyRequest(req, res, '/hooklens-uniswap', 'https://trade-api.gateway.uniswap.org', {
      'content-type': req.headers['content-type'] || 'application/json',
      accept: req.headers.accept || 'application/json',
      'x-api-key': uniswapApiKey,
      'x-universal-router-version': req.headers['x-universal-router-version'] || '2.0',
      'x-erc20eth-enabled': req.headers['x-erc20eth-enabled'] || 'false',
      'x-permit2-disabled': req.headers['x-permit2-disabled'] || 'false',
    })
    return
  }

  if (req.url.startsWith('/hooklens-ollama')) {
    await proxyRequest(req, res, '/hooklens-ollama', ollamaHost, {
      'content-type': req.headers['content-type'] || 'application/json',
      accept: req.headers.accept || 'application/json',
    })
    return
  }

  try {
    await serveStatic(req, res)
  } catch (error) {
    const fallback = await readFile(join(distDir, 'index.html'))
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(fallback)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`HookLens listening on http://0.0.0.0:${port}`)
})
