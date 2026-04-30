import { SOURCIFY_BASE, SOURCIFY_REPO_BASE, SOURCIFY_SUPPORTED_CHAIN_IDS } from '../config/constants'
import type { AbiItem, ContractSource, VerificationStatus } from '../types/hook'

const SOURCIFY_SUPPORTED_CHAINS = new Set(SOURCIFY_SUPPORTED_CHAIN_IDS)

interface SourcifyContractResponse {
  matchId?: string
  creationMatch?: 'exact_match' | 'match' | null
  runtimeMatch?: 'exact_match' | 'match' | null
  match?: 'exact_match' | 'match'
  verifiedAt?: string
  chainId?: string
  address?: string
  abi?: AbiItem[]
  sources?: Record<string, { content: string }>
  compilerSettings?: { compiler?: { version?: string } }
  compilation?: { compilerVersion?: string }
  deployedBytecode?: string | SourcifyBytecode
  runtimeBytecode?: string | SourcifyBytecode
  creationBytecode?: string | SourcifyBytecode
}

interface SourcifyBytecode {
  onchainBytecode?: string
  recompiledBytecode?: string
}

interface SourcifyFile {
  name: string
  path: string
  content: string
}

export function isSourcifySupported(chainId: number): boolean {
  return SOURCIFY_SUPPORTED_CHAINS.has(chainId)
}

export async function fetchContractFromSourcify(
  address: string,
  chainId: number,
): Promise<ContractSource> {
  if (!isSourcifySupported(chainId)) {
    return {
      verification: {
        isVerified: false,
        matchType: 'unverified',
      },
    }
  }

  try {
    const url = `${SOURCIFY_BASE}/v2/contract/${chainId}/${address}?fields=all`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (res.status === 404) {
      return {
        verification: {
          isVerified: false,
          matchType: 'unverified',
        },
      }
    }

    if (!res.ok) {
      throw new Error(`Sourcify error ${res.status}`)
    }

    const data = (await res.json()) as SourcifyContractResponse
    const matchType =
      data.match === 'exact_match' ? 'exact_match' : data.match === 'match' ? 'match' : 'unverified'

    const verification: VerificationStatus = {
      isVerified: matchType !== 'unverified',
      matchType,
      verifiedAt: data.verifiedAt,
      sourcifyUrl: `${SOURCIFY_REPO_BASE}/${chainId}/${address}`,
    }

    return {
      verification,
      abi: data.abi ?? [],
      sources: data.sources ?? {},
      deployedBytecode: normalizeBytecode(data.deployedBytecode ?? data.runtimeBytecode),
      creationBytecode: normalizeBytecode(data.creationBytecode),
      compilerVersion:
        data.compilerSettings?.compiler?.version ?? data.compilation?.compilerVersion,
    }
  } catch {
    return fetchContractFallback(address, chainId)
  }
}

function normalizeBytecode(bytecode: string | SourcifyBytecode | undefined): string | undefined {
  if (typeof bytecode === 'string') return bytecode
  return bytecode?.onchainBytecode ?? bytecode?.recompiledBytecode
}

async function fetchContractFallback(address: string, chainId: number): Promise<ContractSource> {
  try {
    const url = `${SOURCIFY_BASE}/files/any/${chainId}/${address}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      return {
        verification: { isVerified: false, matchType: 'unverified' },
      }
    }

    const data = (await res.json()) as SourcifyFile[] | { files?: SourcifyFile[] }
    const files = Array.isArray(data) ? data : (data.files ?? [])
    const sources: Record<string, { content: string }> = {}

    for (const file of files) {
      if (file.name.endsWith('.sol') || file.name.endsWith('.vy')) {
        sources[file.name] = { content: file.content }
      }
    }

    let abi: AbiItem[] = []
    const metaFile = files.find((file) => file.name === 'metadata.json')
    if (metaFile) {
      try {
        const meta = JSON.parse(metaFile.content) as { output?: { abi?: AbiItem[] } }
        abi = meta.output?.abi ?? []
      } catch {
        // Metadata is best-effort on the fallback endpoint.
      }
    }

    const hasSources = Object.keys(sources).length > 0

    return {
      verification: {
        isVerified: hasSources,
        matchType: hasSources ? 'match' : 'unverified',
        sourcifyUrl: hasSources ? `${SOURCIFY_REPO_BASE}/${chainId}/${address}` : undefined,
      },
      abi,
      sources,
    }
  } catch {
    return {
      verification: { isVerified: false, matchType: 'unverified' },
    }
  }
}

export function getAllSourceCode(sources: Record<string, { content: string }>): string {
  return Object.values(sources)
    .map((source) => source.content)
    .join('\n')
}
