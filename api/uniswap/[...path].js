const UPSTREAM = 'https://trade-api.gateway.uniswap.org'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const apiKey = process.env.UNISWAP_API_KEY || process.env.VITE_UNISWAP_API_KEY

  if (!apiKey) {
    res.status(500).json({ message: 'UNISWAP_API_KEY is not configured on the server.' })
    return
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    } else if (value != null) {
      query.set(key, value)
    }
  }

  const upstreamUrl = `${UPSTREAM}/${path ?? ''}${query.size ? `?${query.toString()}` : ''}`
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        accept: req.headers.accept || 'application/json',
        'x-api-key': apiKey,
        'x-universal-router-version': req.headers['x-universal-router-version'] || '2.0',
        'x-erc20eth-enabled': req.headers['x-erc20eth-enabled'] || 'false',
        'x-permit2-disabled': req.headers['x-permit2-disabled'] || 'false',
      },
      body,
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    res.send(text)
  } catch (error) {
    res.status(502).json({
      message: error instanceof Error ? error.message : 'Uniswap proxy request failed',
    })
  }
}
