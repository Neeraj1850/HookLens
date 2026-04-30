import type { AbiItem, ContractSource, HookFlags, SafetyAnalysis, SafetyCheck } from '../types/hook'
import { getAllSourceCode } from './sourcify'

const DEDUCTIONS: Record<SafetyCheck['severity'], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  info: 0,
}

const HOOK_CALLBACK_NAMES = [
  'beforeSwap',
  'afterSwap',
  'beforeInitialize',
  'afterInitialize',
  'beforeAddLiquidity',
  'afterAddLiquidity',
  'beforeRemoveLiquidity',
  'afterRemoveLiquidity',
  'beforeDonate',
  'afterDonate',
]

function checkVerification(source: ContractSource): SafetyCheck {
  const verified = source.verification.isVerified
  return {
    id: 'verified',
    name: 'Source Verified',
    description: 'Contract source code is verified on Sourcify',
    passed: verified,
    severity: 'high',
    category: 'verification',
    detail: verified
      ? `Verified at ${source.verification.verifiedAt ?? 'unknown date'}. Match type: ${
          source.verification.matchType
        }`
      : 'Source not found on Sourcify. Cannot verify what this hook does.',
  }
}

function checkNoSelfdestruct(source: string): SafetyCheck {
  const found = /\bselfdestruct\b|\bsuicide\b/.test(source)
  return {
    id: 'no-selfdestruct',
    name: 'No selfdestruct',
    description: 'Hook does not contain selfdestruct or suicide calls',
    passed: !found,
    severity: 'critical',
    category: 'access-control',
    detail: found
      ? 'selfdestruct found; owner or caller may be able to permanently destroy hook logic'
      : 'No selfdestruct detected',
  }
}

function checkNoDelegatecall(source: string): SafetyCheck {
  const hookCallbacks = extractHookCallbackBodies(source)
  const found = /\.delegatecall\s*\(/.test(hookCallbacks)
  return {
    id: 'no-delegatecall',
    name: 'No delegatecall in callbacks',
    description: 'Hook callbacks do not use delegatecall',
    passed: !found,
    severity: 'critical',
    category: 'reentrancy',
    detail: found
      ? 'delegatecall found in hook callback; can be used for storage hijacking'
      : 'No delegatecall in hook callbacks',
  }
}

function checkAccessControl(source: string, abi: AbiItem[]): SafetyCheck {
  const writeFunctions = abi.filter(
    (item) =>
      item.type === 'function' &&
      (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable') &&
      item.name !== undefined &&
      !HOOK_CALLBACK_NAMES.includes(item.name),
  )

  if (writeFunctions.length === 0) {
    return {
      id: 'access-control',
      name: 'Access Control',
      description: 'Admin functions are access controlled',
      passed: true,
      severity: 'high',
      category: 'access-control',
      detail: 'No non-hook write functions found, or ABI does not expose admin writes',
    }
  }

  const hasAccessControl = writeFunctions.every((fn) => {
    if (!fn.name) return true
    const fnPattern = new RegExp(`function\\s+${fn.name}\\s*\\([^)]*\\)[^{]*\\{[\\s\\S]{0,500}`)
    const match = source.match(fnPattern)
    if (!match) return true
    return /onlyOwner|onlyRole|onlyManager|requiresAuth|require\s*\(\s*msg\.sender/.test(match[0])
  })

  return {
    id: 'access-control',
    name: 'Access Control',
    description: 'Admin functions are access controlled',
    passed: hasAccessControl,
    severity: 'high',
    category: 'access-control',
    detail: hasAccessControl
      ? 'Write functions appear to have access control modifiers'
      : `${writeFunctions.length} write function(s) may lack access control: ${writeFunctions
          .map((fn) => fn.name)
          .join(', ')}`,
  }
}

function checkReentrancy(source: string): SafetyCheck {
  const callbacks = extractHookCallbackBodies(source)
  const hasExternalCallBeforeStateChange =
    /\.(call|transfer|send)\s*[({][\s\S]{0,200}(?:=\s*[^=]|\.push\s*\()/.test(callbacks)

  return {
    id: 'no-reentrancy',
    name: 'Reentrancy Safety',
    description: 'No obvious reentrancy paths in hook callbacks',
    passed: !hasExternalCallBeforeStateChange,
    severity: 'critical',
    category: 'reentrancy',
    detail: hasExternalCallBeforeStateChange
      ? 'External call followed by state change detected in hook callbacks'
      : 'No obvious reentrancy pattern found in callbacks',
  }
}

function checkBeforeSwapDelta(source: string, flags: HookFlags): SafetyCheck {
  if (!flags.beforeSwap) {
    return {
      id: 'beforeswap-delta',
      name: 'beforeSwap Delta Type',
      description: 'beforeSwap returns correct BeforeSwapDelta',
      passed: true,
      severity: 'medium',
      category: 'callback-safety',
      detail: 'beforeSwap not active; check not applicable',
    }
  }

  const returnPattern = /function\s+beforeSwap\s*\([^)]*\)[^{]*returns\s*\(([^)]+)\)/
  const match = source.match(returnPattern)

  if (!match) {
    return {
      id: 'beforeswap-delta',
      name: 'beforeSwap Delta Type',
      description: 'beforeSwap returns correct BeforeSwapDelta',
      passed: false,
      severity: 'medium',
      category: 'callback-safety',
      detail: 'Could not verify beforeSwap return type from source',
    }
  }

  const returnTypes = match[1] ?? ''
  const hasCorrectReturn = /bytes4|BeforeSwapDelta/.test(returnTypes)

  return {
    id: 'beforeswap-delta',
    name: 'beforeSwap Delta Type',
    description: 'beforeSwap returns correct BeforeSwapDelta',
    passed: hasCorrectReturn,
    severity: 'medium',
    category: 'callback-safety',
    detail: hasCorrectReturn
      ? `Return types: ${returnTypes.trim()}`
      : `Unexpected return types: ${returnTypes.trim()}`,
  }
}

function checkNoTxOrigin(source: string): SafetyCheck {
  const found = /\btx\.origin\b/.test(source)
  return {
    id: 'no-tx-origin',
    name: 'No tx.origin',
    description: 'Hook does not rely on tx.origin for authentication',
    passed: !found,
    severity: 'high',
    category: 'access-control',
    detail: found ? 'tx.origin usage found; phishing attack vector' : 'No tx.origin usage detected',
  }
}

function checkNoArbitraryExternalCalls(source: string): SafetyCheck {
  const body = extractFunctionBody(source, 'afterSwap')

  if (!body) {
    return {
      id: 'no-arbitrary-external',
      name: 'No Arbitrary External Calls',
      description: 'afterSwap does not make arbitrary external calls',
      passed: true,
      severity: 'medium',
      category: 'reentrancy',
      detail: 'afterSwap not found in source or not active',
    }
  }

  const suspiciousCalls = /\.(call\s*\{|call\s*\(|delegatecall\s*\()/.test(body)
  const knownManagerCall = /(poolManager|manager)\s*\.\s*(call|unlock|take|settle|sync|mint|burn)/.test(body)
  const found = suspiciousCalls && !knownManagerCall

  return {
    id: 'no-arbitrary-external',
    name: 'No Arbitrary External Calls',
    description: 'afterSwap does not make arbitrary external calls',
    passed: !found,
    severity: 'medium',
    category: 'reentrancy',
    detail: found
      ? 'afterSwap appears to make non-poolManager external calls'
      : 'afterSwap external calls appear absent or constrained',
  }
}

function checkCentralizationRisk(source: string): SafetyCheck {
  const hasOwner = /\bowner\b|\bOwnable\b|\bAccessControl\b/i.test(source)

  if (!hasOwner) {
    return {
      id: 'centralization',
      name: 'Centralization Risk',
      description: 'No single owner can rug the hook configuration',
      passed: true,
      severity: 'info',
      category: 'centralization',
      detail: 'No owner pattern detected; appears permissionless',
    }
  }

  const ownerImmutable = /immutable\s+(?:public\s+)?owner|address\s+public\s+immutable/.test(source)
  const ownerCanChangeFees = /function\s+set(?:Fee|Threshold|Config|Param|Manager|Owner)/i.test(source)
  const isConcerning = ownerCanChangeFees && !ownerImmutable

  return {
    id: 'centralization',
    name: 'Centralization Risk',
    description: 'No single owner can rug the hook configuration',
    passed: !isConcerning,
    severity: 'info',
    category: 'centralization',
    detail: isConcerning
      ? 'Owner can modify fee/config parameters. Consider this a trust assumption.'
      : 'Owner privileges appear limited or constrained',
  }
}

function checkFlagsMatchImplementation(source: string, flags: HookFlags): SafetyCheck {
  const issues: string[] = []

  if (flags.beforeSwap && !/function\s+beforeSwap\s*\(/.test(source)) {
    issues.push('beforeSwap flag set but function not found in source')
  }
  if (flags.afterSwap && !/function\s+afterSwap\s*\(/.test(source)) {
    issues.push('afterSwap flag set but function not found in source')
  }
  if (flags.beforeAddLiquidity && !/function\s+beforeAddLiquidity\s*\(/.test(source)) {
    issues.push('beforeAddLiquidity flag set but function not found')
  }
  if (flags.afterAddLiquidity && !/function\s+afterAddLiquidity\s*\(/.test(source)) {
    issues.push('afterAddLiquidity flag set but function not found')
  }

  return {
    id: 'flags-match',
    name: 'Flags Match Implementation',
    description: 'Hook permission flags match actual function implementations',
    passed: issues.length === 0,
    severity: 'medium',
    category: 'hook-specific',
    detail:
      issues.length > 0
        ? issues.join('; ')
        : 'Active callback flags have corresponding implementations',
  }
}

function checkAssemblySafety(source: string): SafetyCheck {
  const hasAssembly = /\bassembly\s*\{/.test(source)

  if (!hasAssembly) {
    return {
      id: 'assembly-safety',
      name: 'Assembly Safety',
      description: 'No inline assembly with dangerous patterns',
      passed: true,
      severity: 'medium',
      category: 'hook-specific',
      detail: 'No inline assembly found',
    }
  }

  const assemblyBlocks = source.match(/assembly\s*\{[^}]+\}/g) ?? []
  const dangerousOps = assemblyBlocks.some((block) =>
    /\bcalldatacopy\b|\bmemcpy\b|\bextcodecopy\b/.test(block),
  )

  return {
    id: 'assembly-safety',
    name: 'Assembly Safety',
    description: 'No inline assembly with dangerous patterns',
    passed: !dangerousOps,
    severity: 'medium',
    category: 'hook-specific',
    detail: dangerousOps
      ? 'Assembly with dangerous memory operations detected'
      : 'Assembly present but no obviously dangerous ops found',
  }
}

function checkNoFlashLoanVector(source: string): SafetyCheck {
  const readsSpotPrice = /slot0\s*\(\)|getSpotPrice|getSqrtPriceX96/i.test(source)
  const hasTwapProtection = /observe\s*\(|TWAP|twap|TimeWeighted/i.test(source)
  const vulnerable = readsSpotPrice && !hasTwapProtection

  return {
    id: 'flash-loan-safety',
    name: 'Flash Loan Safety',
    description: 'Hook does not use spot price without TWAP protection',
    passed: !vulnerable,
    severity: 'high',
    category: 'hook-specific',
    detail: vulnerable
      ? 'Spot price read without TWAP; vulnerable to flash loan manipulation'
      : readsSpotPrice
        ? 'Spot price read found with TWAP protection'
        : 'No spot price manipulation vector detected',
  }
}

function extractHookCallbackBodies(source: string): string {
  return HOOK_CALLBACK_NAMES.map((callback) => extractFunctionBody(source, callback) ?? '').join('\n')
}

function extractFunctionBody(source: string, functionName: string): string | null {
  const signature = new RegExp(`function\\s+${functionName}\\s*\\(`)
  const match = signature.exec(source)
  if (!match) return null

  const bodyStart = source.indexOf('{', match.index)
  if (bodyStart === -1) return null

  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(bodyStart + 1, index)
      }
    }
  }

  return null
}

function computeScore(checks: SafetyCheck[]): number {
  const deductions = checks
    .filter((check) => !check.passed)
    .reduce((sum, check) => sum + (DEDUCTIONS[check.severity] ?? 0), 0)
  return Math.max(0, 10 - deductions)
}

export async function analyzeHook(source: ContractSource, flags: HookFlags): Promise<SafetyAnalysis> {
  const sourceCode = source.sources ? getAllSourceCode(source.sources) : ''
  const abi = source.abi ?? []

  const checks: SafetyCheck[] = [
    checkVerification(source),
    ...(sourceCode
      ? [
          checkNoSelfdestruct(sourceCode),
          checkNoDelegatecall(sourceCode),
          checkAccessControl(sourceCode, abi),
          checkReentrancy(sourceCode),
          checkBeforeSwapDelta(sourceCode, flags),
          checkNoTxOrigin(sourceCode),
          checkNoArbitraryExternalCalls(sourceCode),
          checkCentralizationRisk(sourceCode),
          checkFlagsMatchImplementation(sourceCode, flags),
          checkAssemblySafety(sourceCode),
          checkNoFlashLoanVector(sourceCode),
        ]
      : [checkBytecodeSelfdestruct(source.deployedBytecode ?? '')]),
  ]

  const score = computeScore(checks)

  return {
    score,
    checks,
    hasCriticalIssues: checks.some((check) => !check.passed && check.severity === 'critical'),
    hasHighIssues: checks.some((check) => !check.passed && check.severity === 'high'),
    source,
    analyzedAt: Date.now(),
  }
}

function checkBytecodeSelfdestruct(bytecode: string): SafetyCheck {
  const normalized = bytecode.toLowerCase().replace(/^0x/, '')
  const found = normalized.includes('ff')
  return {
    id: 'bytecode-selfdestruct',
    name: 'Bytecode Selfdestruct Check',
    description: 'No selfdestruct opcode in deployed bytecode',
    passed: !found,
    severity: 'critical',
    category: 'verification',
    detail:
      'Note: bytecode-only analysis is imprecise. ' +
      (found ? '0xff opcode found; may indicate selfdestruct' : 'No obvious selfdestruct opcode pattern'),
  }
}
