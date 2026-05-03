import react from '@vitejs/plugin-react'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function localTradeApiProxy(apiKey: string): Plugin {
  return {
    name: 'hooklens-local-trade-api-proxy',
    configureServer(server) {
      server.middlewares.use('/hooklens-uniswap', async (req, res) => {
        const chunks: Buffer[] = []

        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          const path = req.url ?? ''
          const body = Buffer.concat(chunks)

          try {
            const upstream = await fetch(`https://trade-api.gateway.uniswap.org${path}`, {
              method: req.method,
              headers: {
                'content-type': String(req.headers['content-type'] ?? 'application/json'),
                accept: String(req.headers.accept ?? 'application/json'),
                'x-api-key': apiKey || String(req.headers['x-api-key'] ?? ''),
                'x-universal-router-version': String(req.headers['x-universal-router-version'] ?? '2.0'),
                'x-erc20eth-enabled': String(req.headers['x-erc20eth-enabled'] ?? 'false'),
                'x-permit2-disabled': String(req.headers['x-permit2-disabled'] ?? 'false'),
              },
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            })
            const text = await upstream.text()

            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                hooklensProxy: true,
                ok: upstream.ok,
                status: upstream.status,
                statusText: upstream.statusText,
                body: parseMaybeJson(text),
              }),
            )
          } catch (err) {
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                hooklensProxy: true,
                ok: false,
                status: 0,
                statusText: 'Proxy Network Error',
                body: {
                  message: err instanceof Error ? err.message : 'Proxy request failed',
                },
              }),
            )
          }
        })
      })
    },
  }
}

function localOllamaProxy(ollamaHost: string): Plugin {
  return {
    name: 'hooklens-local-ollama-proxy',
    configureServer(server) {
      server.middlewares.use('/hooklens-ollama', async (req, res) => {
        const chunks: Buffer[] = []

        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          const path = req.url ?? ''
          const body = Buffer.concat(chunks)

          try {
            const upstream = await fetch(`${ollamaHost}${path}`, {
              method: req.method,
              headers: {
                'content-type': String(req.headers['content-type'] ?? 'application/json'),
                accept: String(req.headers.accept ?? 'application/json'),
              },
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            })

            res.statusCode = upstream.status
            res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')

            if (upstream.body) {
              Readable.fromWeb(upstream.body).pipe(res)
            } else {
              res.end()
            }
          } catch (err) {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                message: err instanceof Error ? err.message : 'Ollama proxy request failed',
              }),
            )
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.UNISWAP_API_KEY || env.VITE_UNISWAP_API_KEY || ''
  const ollamaHost = (env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')

  return {
    plugins: [react(), localTradeApiProxy(apiKey), localOllamaProxy(ollamaHost)],
  }
})
