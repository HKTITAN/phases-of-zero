#!/usr/bin/env node
/* Measure how closely the browser lexer and parser match the real compiler.

   The paper claims the client-side reimplementation agrees with Zero's own
   `zero tokens --json`. A claim like that has to be regenerable, not typed in
   by hand, so this writes the comparison to a JSON file the page reads — the
   same rule every other number in the paper follows.

   Runs the TypeScript module directly through tsx so there is exactly one lexer
   in the repository: the one the browser ships. */

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'web')
const TMP = join(WEB, '.fidelity')
const OUT = join(WEB, 'data', 'lexer-fidelity.json')

mkdirSync(TMP, { recursive: true })

// The probe lives inside web/ so the '@/'-free relative import resolves and tsx
// picks up the project's tsconfig.
writeFileSync(join(TMP, 'probe.ts'), `
import { readFileSync, writeFileSync } from 'node:fs'
import { tokenize, parse, type ZeroToken } from '../lib/zero-lang'

type RealTok = { kind: string; text: string; line: number; column: number; offset: number; length: number }
const cap = JSON.parse(readFileSync('data/capture.json', 'utf8')) as {
  toolchain: { version: Record<string, unknown> }
  corpus: {
    id: string
    sources: { file: string; text: string }[]
    lexical: { sample: RealTok[] }
    syntax: { functions?: { name: string }[] } | null
  }[]
}

const FIELDS = ['kind', 'text', 'line', 'column', 'offset', 'length'] as const

const programs = cap.corpus.map((c) => {
  const main = c.sources.find((s) => s.file.endsWith('main.0'))
  if (!main) return null
  const ours: ZeroToken[] = tokenize(main.text)
  const real = c.lexical.sample
  const compared = Math.min(ours.length, real.length)

  let firstMismatch: string | null = null
  let matched = 0
  for (let i = 0; i < compared; i++) {
    const a = ours[i] as unknown as Record<string, unknown>
    const b = real[i] as unknown as Record<string, unknown>
    const bad = FIELDS.find((f) => a[f] !== b[f])
    if (bad) {
      if (!firstMismatch) {
        firstMismatch = \`token #\${i}: \${bad} ours=\${JSON.stringify(a[bad])} real=\${JSON.stringify(b[bad])}\`
      }
    } else matched++
  }

  const p = parse(ours)
  const realFns = (c.syntax?.functions ?? []).map((f) => f.name).sort()
  const ourFns = p.functions.map((f) => f.name).sort()
  const fnMatch = realFns.join(',') === ourFns.join(',')

  return {
    program: c.id,
    realTokens: real.length,
    ourTokens: ours.length,
    countsMatch: ours.length === real.length,
    compared,
    matched,
    exact: matched === compared && ours.length === real.length,
    firstMismatch,
    functionsMatch: fnMatch,
    realFunctions: realFns,
    ourFunctions: ourFns,
  }
}).filter((x): x is NonNullable<typeof x> => x !== null)

const totalCompared = programs.reduce((n, p) => n + p.compared, 0)
const totalMatched = programs.reduce((n, p) => n + p.matched, 0)

const result = {
  comparedFields: FIELDS,
  note:
    'Each corpus program\\'s src/main.0 is re-tokenized by the browser lexer and compared, ' +
    'token by token and field by field, against the stream zero tokens --json produced for ' +
    'the same file. Agreement on this corpus is evidence of correctness on the constructs ' +
    'it uses, not a proof of equivalence with the native scanner.',
  compilerVersion: String(cap.toolchain.version.version ?? ''),
  programs,
  totals: {
    programs: programs.length,
    programsExact: programs.filter((p) => p.exact).length,
    programsFunctionsMatch: programs.filter((p) => p.functionsMatch).length,
    tokensCompared: totalCompared,
    tokensMatched: totalMatched,
    tokenAgreementPct: totalCompared === 0 ? 0 : +((totalMatched / totalCompared) * 100).toFixed(2),
  },
}

writeFileSync('data/lexer-fidelity.json', JSON.stringify(result, null, 2))
for (const p of programs) {
  console.log(
    p.program.padEnd(14),
    String(p.ourTokens).padStart(4) + '/' + String(p.realTokens).padEnd(5),
    p.exact ? 'exact' : 'MISMATCH ' + (p.firstMismatch ?? ''),
    '| fns', p.functionsMatch ? 'match' : 'DIFFER',
  )
}
console.log(
  '\\n' + result.totals.programsExact + '/' + result.totals.programs + ' programs exact · ' +
  result.totals.tokensMatched + '/' + result.totals.tokensCompared + ' tokens (' +
  result.totals.tokenAgreementPct + '%) · functions match on ' +
  result.totals.programsFunctionsMatch + '/' + result.totals.programs,
)
`)

const run = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', 'tsx', '.fidelity/probe.ts'],
  { cwd: WEB, stdio: 'inherit', shell: process.platform === 'win32' },
)

// Leave no scratch directory behind; the JSON is the artifact.
try {
  const { rmSync } = await import('node:fs')
  rmSync(TMP, { recursive: true, force: true })
} catch { /* best effort */ }

if (run.status !== 0) {
  console.error('lexer fidelity probe failed')
  process.exit(1)
}
console.log(`\nwrote ${OUT}`)
