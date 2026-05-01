import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function localTradeApiProxy(): Plugin {
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
                'x-api-key': String(req.headers['x-api-key'] ?? ''),
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localTradeApiProxy()],
})
