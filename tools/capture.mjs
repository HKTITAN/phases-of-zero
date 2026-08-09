#!/usr/bin/env node
// Capture real compiler-phase telemetry from the Zero 0.3.4 toolchain.
// Every number the paper cites comes from this script. Re-run to reproduce.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import os from 'node:os'

const ROOT = resolve(process.cwd())
const CORPUS = join(ROOT, 'corpus')
const ERRORS = join(ROOT, 'errors')
const OUT = join(ROOT, 'web', 'data')
const ZERO = join(os.homedir(), '.zero', 'bin', 'zero.exe')

mkdirSync(OUT, { recursive: true })

function zero(args, { cwd = CORPUS, allowFail = false } = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(ZERO, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }),
      stderr: '',
    }
  } catch (err) {
    if (!allowFail) console.warn(`  ! zero ${args.join(' ')} exited ${err.status}`)
    return { ok: false, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' }
  }
}

function zeroJson(args, opts) {
  const r = zero(args, opts)
  const text = r.stdout.trim() || r.stderr.trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    if (start >= 0) {
      try { return JSON.parse(text.slice(start)) } catch { /* fall through */ }
    }
    return { _parseError: true, raw: text.slice(0, 4000) }
  }
}

// Wall-clock a command properly: hrtime around the process, median of n runs.
function timeRuns(args, cwd, runs) {
  const samples = []
  for (let i = 0; i < runs; i++) {
    const t0 = process.hrtime.bigint()
    zero(args, { cwd, allowFail: true })
    const t1 = process.hrtime.bigint()
    samples.push(Number(t1 - t0) / 1e6)
  }
  samples.sort((a, b) => a - b)
  return {
    runs,
    medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2),
    minMs: +samples[0].toFixed(2),
    maxMs: +samples[samples.length - 1].toFixed(2),
    samples: samples.map((s) => +s.toFixed(2)),
  }
}

function sourceOf(pkgDir) {
  const src = join(pkgDir, 'src')
  if (!existsSync(src)) return []
  return readdirSync(src)
    .filter((f) => f.endsWith('.0'))
    .sort()
    .map((f) => {
      const text = readFileSync(join(src, f), 'utf8')
      return {
        file: `src/${f}`,
        text,
        lines: text.split('\n').length,
        nonEmptyLines: text.split('\n').filter((l) => l.trim().length > 0).length,
        bytes: Buffer.byteLength(text, 'utf8'),
      }
    })
}

function artifactBytes(pkgDir) {
  const candidates = [join(pkgDir, '.zero', 'out'), join(pkgDir, '.zero', 'ship')]
  let best = null
  for (const dir of candidates) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      const s = statSync(p)
      if (s.isFile() && (best === null || s.size > best.bytes)) best = { path: `${dir.split(/[\\/]/).slice(-2).join('/')}/${f}`, bytes: s.size }
    }
  }
  return best
}

// ---------------------------------------------------------------- corpus

const packages = existsSync(CORPUS)
  ? readdirSync(CORPUS).filter((d) => existsSync(join(CORPUS, d, 'zero.toml'))).sort()
  : []

// Read the target list from the compiler rather than hardcoding it, so the
// matrix stays correct if a future build adds or drops a target.
const targetList = zeroJson(['targets'], { cwd: ROOT, allowFail: true })
const ALL_TARGETS = (targetList?.targets ?? []).map((t) => t.name)
// The compiler appends the target's exeSuffix to --out, so the artifact is not
// necessarily at the path we passed. Getting this wrong reads as a build failure.
const EXE_SUFFIX = Object.fromEntries((targetList?.targets ?? []).map((t) => [t.name, t.exeSuffix ?? '']))
console.log(`targets: ${ALL_TARGETS.join(', ')}\n`)

console.log(`capturing ${packages.length} corpus packages\n`)

const corpus = []
for (const pkg of packages) {
  const pkgDir = join(CORPUS, pkg)
  console.log(`-> ${pkg}`)

  const sources = sourceOf(pkgDir)
  const mainFile = sources.find((s) => s.file.endsWith('main.0'))?.file ?? sources[0]?.file

  // Phase 1 — lexical analysis. Run per source file so token counts are attributable.
  const tokensPerFile = sources.map((s) => {
    const t = zeroJson(['tokens', '--json', join(pkg, s.file)])
    return { file: s.file, tokens: Array.isArray(t.tokens) ? t.tokens : [], syntax: t.syntax ?? null }
  })

  // Phase 2 — syntax analysis.
  const parse = mainFile ? zeroJson(['parse', '--json', join(pkg, mainFile)]) : null

  // Cold build: clear caches so the first check measures a full pipeline.
  zero(['clean', '--all'], { cwd: pkgDir, allowFail: true })
  const coldCheck = zeroJson(['check', '--json', pkg])
  const coldWall = timeRuns(['check', pkg], CORPUS, 1)

  // Warm: caches now populated. Median of 5.
  const warmCheck = zeroJson(['check', '--json', pkg])
  const warmWall = timeRuns(['check', pkg], CORPUS, 5)

  // `zero time` is the purpose-built phase-timing command and drives the full
  // pipeline through emit, so it reports non-zero `lower` where `check` does not.
  // Cold reading first, then warm, to expose the cache effect.
  zero(['clean', '--all'], { cwd: pkgDir, allowFail: true })
  const coldTime = zeroJson(['time', '--json', pkg], { allowFail: true })
  const warmTime = zeroJson(['time', '--json', pkg], { allowFail: true })

  // Semantic graph + source map.
  const query = zeroJson(['query', '--json', '--full', pkg])
  const sourceMap = zeroJson(['source-map', '--json', pkg])

  // Backend: emit LLVM IR so the paper can show a real intermediate representation.
  const irPath = join(pkgDir, '.zero', 'out', `${pkg}.ll`)
  mkdirSync(join(pkgDir, '.zero', 'out'), { recursive: true })
  const irRun = zero(['build', '--emit', 'llvm-ir', '--out', irPath, pkg], { allowFail: true })
  const ir = existsSync(irPath) ? readFileSync(irPath, 'utf8') : null

  // Native artifact + measurements.
  const exePath = join(pkgDir, '.zero', 'out', pkg)
  zero(['build', '--emit', 'exe', '--profile', 'release-small', '--out', exePath, pkg], { allowFail: true })
  const size = zeroJson(['size', '--json', pkg], { allowFail: true })
  const mem = zeroJson(['mem', '--json', pkg], { allowFail: true })
  const time = zeroJson(['time', '--json', pkg], { allowFail: true })

  const runResult = zero(['run', pkg], { allowFail: true })
  const testResult = zero(['test', pkg], { allowFail: true })

  // Backend coverage matrix. The front end accepts one language; each target's
  // emitter accepts its own subset. Building every program for every target is
  // the only way to state that difference as a measurement rather than an anecdote.
  const buildMatrix = {}
  for (const target of ALL_TARGETS) {
    const out = join(pkgDir, '.zero', 'matrix', target.replace(/[^a-z0-9]/gi, '_'))
    mkdirSync(join(pkgDir, '.zero', 'matrix'), { recursive: true })
    const t0 = process.hrtime.bigint()
    const r = zero(['build', '--emit', 'exe', '--target', target, '--profile', 'release-small', '--out', out, pkg],
      { allowFail: true })
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    const text = (r.stdout + r.stderr)
    const code = text.match(/\b([A-Z]{3}\d{3})\b/)?.[1] ?? null
    const actual = text.match(/actual:\s*(.+)/)?.[1]?.trim() ?? null
    const artifact = existsSync(out + EXE_SUFFIX[target]) ? out + EXE_SUFFIX[target]
      : existsSync(out) ? out : null
    buildMatrix[target] = {
      ok: r.ok && artifact !== null,
      bytes: artifact ? statSync(artifact).size : null,
      ms: +ms.toFixed(1),
      code,
      actual,
    }
  }

  const totalTokens = tokensPerFile.reduce((n, f) => n + f.tokens.length, 0)
  const codeTokens = tokensPerFile.reduce(
    (n, f) => n + f.tokens.filter((t) => t.kind !== 'newline').length, 0)

  const gc = coldCheck?.graphCompiler ?? null
  const gcWarm = warmCheck?.graphCompiler ?? null

  corpus.push({
    id: pkg,
    sources,
    metrics: {
      files: sources.length,
      lines: sources.reduce((n, s) => n + s.lines, 0),
      nonEmptyLines: sources.reduce((n, s) => n + s.nonEmptyLines, 0),
      bytes: sources.reduce((n, s) => n + s.bytes, 0),
      totalTokens,
      codeTokens,
      graphNodes: query?.counts?.nodes ?? null,
      graphEdges: query?.counts?.edges ?? null,
      graphHash: coldCheck?.graph?.graphHash ?? null,
      artifact: artifactBytes(pkgDir),
    },
    lexical: {
      perFile: tokensPerFile.map((f) => ({
        file: f.file,
        count: f.tokens.length,
        byKind: f.tokens.reduce((acc, t) => ((acc[t.kind] = (acc[t.kind] ?? 0) + 1), acc), {}),
      })),
      // Full token stream of the main file drives the explorer's phase-1 view.
      sample: tokensPerFile.find((f) => f.file === mainFile)?.tokens ?? [],
    },
    syntax: parse,
    // These live under `graphCompiler`, not at the top level: the graph compiler
    // owns the symbol/type tables because they are stored, not rebuilt.
    semantic: {
      tables: gc?.tables ?? null,
      resolution: gc?.resolution ?? null,
      checking: gc?.checking ?? null,
      counts: gc?.semanticFacts?.counts ?? null,
      types: gc?.semanticFacts?.types ?? [],
      functions: gc?.semanticFacts?.functions ?? [],
      calls: gc?.semanticFacts?.calls ?? [],
      effects: gc?.semanticFacts?.effects ?? [],
      ownership: gc?.semanticFacts?.ownership ?? [],
      resources: gc?.semanticFacts?.resources ?? [],
      targetRequirements: gc?.semanticFacts?.targetRequirements ?? [],
    },
    graph: {
      modules: query?.modules ?? [],
      functions: query?.functions ?? [],
      counts: query?.counts ?? null,
    },
    sourceMap: Array.isArray(sourceMap?.entries) ? sourceMap.entries.slice(0, 200) : sourceMap,
    phases: {
      cold: coldCheck?.compilerPhases ?? [],
      warm: warmCheck?.compilerPhases ?? [],
      // `zero time` drives the pipeline through emit and is the honest source
      // for lowering and codegen cost.
      coldTimed: coldTime?.compilerPhases ?? [],
      warmTimed: warmTime?.compilerPhases ?? [],
      coldCacheSummary: coldTime?.cacheSummary ?? null,
      warmCacheSummary: warmTime?.cacheSummary ?? null,
      requiresCapabilities: coldTime?.requiresCapabilities ?? [],
      selfHostRouting: coldTime?.selfHostRouting ?? null,
      coldGraphTimings: gc?.timings ?? null,
      warmGraphTimings: gcWarm?.timings ?? null,
      caches: (coldCheck?.compilerCaches ?? []).map((c) => ({
        name: c.name, key: c.key, hit: c.hit, stored: c.stored, invalidatesOn: c.invalidatesOn,
      })),
      warmCaches: (warmCheck?.compilerCaches ?? []).map((c) => ({ name: c.name, hit: c.hit })),
      coldCacheHits: coldCheck?.incrementalInvalidation?.cacheHits ?? null,
      coldCacheMisses: coldCheck?.incrementalInvalidation?.cacheMisses ?? null,
      warmCacheHits: warmCheck?.incrementalInvalidation?.cacheHits ?? null,
      warmCacheMisses: warmCheck?.incrementalInvalidation?.cacheMisses ?? null,
    },
    wallClock: { cold: coldWall, warm: warmWall },
    backend: {
      target: coldCheck?.targetReadiness ?? null,
      irEmitted: ir !== null,
      irLines: ir ? ir.split('\n').length : 0,
      // Keep a readable excerpt; the full module is too large to ship to the browser.
      irExcerpt: ir ? ir.split('\n').slice(0, 120).join('\n') : null,
      irError: ir ? null : (irRun.stderr || irRun.stdout).slice(0, 600),
      size, mem, time,
    },
    safety: coldCheck?.safetyFacts ?? null,
    interfaces: coldCheck?.interfaceFingerprints ?? null,
    buildMatrix,
    execution: {
      ranOk: runResult.ok,
      stdout: runResult.stdout.trim(),
      testsOk: testResult.ok,
      testStdout: testResult.stdout.trim(),
    },
  })
}

// ------------------------------------------- human vs machine read cost
//
// The paper argues that Zero's output is designed to be read by programs rather
// than people. That claim is testable: for the same question, measure what a
// human-oriented answer costs to read versus a machine-oriented one. Bytes are
// exact; LLM tokens are estimated at the usual ~4 chars/token for English-like
// text, which is stated as an estimate wherever it is cited.

const estTokens = (s) => Math.ceil(s.length / 4)

console.log('\nmeasuring read cost (human projection vs structured query)\n')

const readCost = []
for (const pkg of packages) {
  const pkgDir = join(CORPUS, pkg)
  const sources = sourceOf(pkgDir)
  const wholeFile = sources.map((s) => s.text).join('\n')

  // Question 1: "show me one function." Text answer = read the file it lives in.
  const fnName = 'main'
  const viewFn = zero(['view', '--fn', fnName, pkg], { allowFail: true }).stdout
  const queryFn = zero(['query', '--json', '--fn', fnName, pkg], { allowFail: true }).stdout

  // Question 2: "what does this program call, and is each call checked?"
  // Text answer = read every file and infer. Structured answer = one query.
  const queryCalls = zero(['query', '--json', '--calls', 'std', pkg], { allowFail: true }).stdout

  // Question 3: "is this program correct?" prose vs structured.
  const checkText = zero(['check', pkg], { allowFail: true }).stdout
  const checkJson = zero(['check', '--json', pkg], { allowFail: true }).stdout

  readCost.push({
    id: pkg,
    // What a text-first agent must ingest to answer anything about the program.
    wholeSourceBytes: Buffer.byteLength(wholeFile, 'utf8'),
    wholeSourceTokensEst: estTokens(wholeFile),
    // Targeted answers.
    viewFnBytes: Buffer.byteLength(viewFn, 'utf8'),
    viewFnTokensEst: estTokens(viewFn),
    queryFnBytes: Buffer.byteLength(queryFn, 'utf8'),
    queryFnTokensEst: estTokens(queryFn),
    queryCallsBytes: Buffer.byteLength(queryCalls, 'utf8'),
    // Verdict cost.
    checkTextBytes: Buffer.byteLength(checkText, 'utf8'),
    checkJsonBytes: Buffer.byteLength(checkJson, 'utf8'),
    // The compiler's own token accounting for this program.
    compilerTokens: corpus.find((c) => c.id === pkg)?.metrics.codeTokens ?? null,
  })
}

// The same comparison for diagnostics: prose vs structured, and what each carries.
const diagnosticCost = []
for (const pkg of errorPackagesPeek()) {
  const prose = zero(['import', pkg], { cwd: ERRORS, allowFail: true })
  const json = zero(['import', '--json', pkg], { cwd: ERRORS, allowFail: true })
  const proseText = (prose.stdout + prose.stderr).trim()
  const jsonText = (json.stdout + json.stderr).trim()
  let parsed = null
  try { parsed = JSON.parse(jsonText) } catch { /* leave null */ }
  const d = parsed?.diagnostics?.[0] ?? null
  diagnosticCost.push({
    id: pkg,
    proseBytes: Buffer.byteLength(proseText, 'utf8'),
    jsonBytes: Buffer.byteLength(jsonText, 'utf8'),
    // Fields a program can act on without parsing English.
    machineFields: d
      ? ['code', 'path', 'line', 'column', 'length', 'expected', 'actual', 'help', 'fixSafety', 'repair']
          .filter((k) => d[k] !== undefined && d[k] !== null && d[k] !== '')
      : [],
    hasTypedRepair: Boolean(d?.repair?.id),
    fixSafety: d?.fixSafety ?? null,
    proseSample: proseText.split('\n')[0] ?? '',
  })
}

function errorPackagesPeek() {
  return existsSync(ERRORS)
    ? readdirSync(ERRORS).filter((d) => existsSync(join(ERRORS, d, 'zero.toml'))).sort()
    : []
}

// ------------------------------------------------------- error corpus

const errorPackages = existsSync(ERRORS)
  ? readdirSync(ERRORS).filter((d) => existsSync(join(ERRORS, d, 'zero.toml'))).sort()
  : []

console.log(`\ncapturing ${errorPackages.length} error cases\n`)

const errorCases = []
for (const pkg of errorPackages) {
  const pkgDir = join(ERRORS, pkg)
  console.log(`-> ${pkg}`)
  const sources = sourceOf(pkgDir)
  const meta = existsSync(join(pkgDir, 'case.json'))
    ? JSON.parse(readFileSync(join(pkgDir, 'case.json'), 'utf8'))
    : {}

  // The admission gate. In a graph-first compiler this is where the whole front end
  // runs: an invalid program is refused entry to the graph store rather than being
  // carried into the compile path.
  const importResult = zeroJson(['import', '--json', pkg], { cwd: ERRORS, allowFail: true })
  const importDiagnostics = Array.isArray(importResult?.diagnostics) ? importResult.diagnostics : []

  // The compile path, run against whatever the store actually holds.
  const checkArgs = meta.target
    ? ['check', '--json', '--target', meta.target, pkg]
    : ['check', '--json', pkg]
  const check = zeroJson(checkArgs, { cwd: ERRORS, allowFail: true })
  const checkDiagnostics = Array.isArray(check?.diagnostics) ? check.diagnostics : []

  // `check` reports two levels of truth that can disagree: a top-level `ok` and a
  // nested `targetReadiness`. Recording both is the only way to state precisely
  // what the compiler knew versus what it advertised.
  const readiness = check?.targetReadiness ?? null
  const readinessDiagnostics = Array.isArray(readiness?.diagnostics) ? readiness.diagnostics : []

  // The back end. Some programs clear the whole front end and are still refused
  // here, which is the sharpest available evidence that the phases are distinct.
  const buildArgs = ['build', '--json', '--emit', 'exe', ...(meta.target ? ['--target', meta.target] : []),
    '--out', join(pkgDir, '.zero', 'out', pkg), pkg]
  mkdirSync(join(pkgDir, '.zero', 'out'), { recursive: true })
  const build = zeroJson(buildArgs, { cwd: ERRORS, allowFail: true })
  const buildDiagnostics = Array.isArray(build?.diagnostics) ? build.diagnostics : []
  const buildRaw = build?._parseError ? build.raw : null

  // Which stage actually refused the program?
  const rejectedAt =
    importResult?.ok === false ? 'import'
      : check?.ok === false ? 'check'
        : (build?.ok === false || buildDiagnostics.length > 0 || buildRaw) ? 'build'
          : 'none'

  const diagnostics =
    rejectedAt === 'check' ? checkDiagnostics
      : rejectedAt === 'build' ? buildDiagnostics
        : importDiagnostics

  // Did the bad program contaminate the store? Compare what the graph still projects.
  const storedMain = zero(['view', '--fn', 'main', pkg], { cwd: ERRORS, allowFail: true }).stdout.trim()

  const codes = [...new Set(diagnostics.map((d) => d.code).filter(Boolean))]
  const explains = {}
  for (const code of codes) explains[code] = zeroJson(['explain', '--json', code], { cwd: ERRORS, allowFail: true })
  const fixPlan = zeroJson(['fix', '--plan', '--json', pkg], { cwd: ERRORS, allowFail: true })

  errorCases.push({
    id: pkg,
    phase: meta.phase ?? null,
    intent: meta.intent ?? null,
    expectedCode: meta.expectedCode ?? null,
    target: meta.target ?? null,
    sources,
    rejectedAt,
    importOk: importResult?.ok ?? null,
    checkOk: check?.ok ?? null,
    buildOk: build?.ok ?? (buildRaw ? false : null),
    buildDiagnostics,
    buildRaw,
    // The disagreement: top-level ok true while nested readiness says unbuildable.
    checkTopLevelOk: check?.ok ?? null,
    checkReadinessOk: readiness?.ok ?? null,
    checkReadinessBuildable: readiness?.buildable ?? null,
    checkReadinessStage: readiness?.stage ?? null,
    readinessDiagnostics,
    checkKnewButReportedOk: check?.ok === true && readiness?.ok === false,
    // Evidence for the containment claim: the store still projects the prior program.
    storeContaminated: rejectedAt === 'import' && storedMain.includes('unreachable'),
    storedMain,
    importDiagnostics,
    checkDiagnostics,
    diagnostics,
    codes,
    explains,
    fixPlan,
  })
}

// ----------------------------------------------------------- toolchain

const version = zeroJson(['--version', '--json'], { cwd: ROOT, allowFail: true })
const targets = zeroJson(['targets'], { cwd: ROOT, allowFail: true })
const doctor = zeroJson(['doctor', '--json'], { cwd: ROOT, allowFail: true })

const bundle = {
  capturedAt: new Date().toISOString(),
  toolchain: {
    version,
    doctor,
    targetCount: Array.isArray(targets?.targets) ? targets.targets.length : null,
    host: targets?.host ?? null,
    targets: (targets?.targets ?? []).map((t) => ({
      name: t.name, os: t.os, arch: t.arch, abi: t.abi, objectFormat: t.objectFormat,
      libc: t.libc, capabilities: t.capabilities ?? [],
      directBackend: t.directBackend?.status ?? null,
    })),
  },
  machine: {
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model ?? null,
    cores: os.cpus().length,
    totalMemGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    node: process.version,
  },
  corpus,
  errorCases,
  readCost,
  diagnosticCost,
}

writeFileSync(join(OUT, 'capture.json'), JSON.stringify(bundle, null, 2))

// A slim bundle for the client: no IR, no full token streams except the explorer sample.
const slim = {
  ...bundle,
  corpus: corpus.map((c) => ({
    ...c,
    semantic: { ...c.semantic, types: c.semantic.types.slice(0, 40) },
    sourceMap: Array.isArray(c.sourceMap) ? c.sourceMap.slice(0, 60) : c.sourceMap,
  })),
}
writeFileSync(join(OUT, 'capture.slim.json'), JSON.stringify(slim))

console.log(`\nwrote ${join(OUT, 'capture.json')}`)
console.log(`corpus: ${corpus.length} packages, errors: ${errorCases.length} cases`)
for (const c of corpus) {
  console.log(
    `  ${c.id.padEnd(14)} ${String(c.metrics.nonEmptyLines).padStart(4)} loc  ` +
    `${String(c.metrics.codeTokens).padStart(5)} tok  ` +
    `${String(c.metrics.graphNodes).padStart(4)} nodes  ` +
    `cold ${String(c.wallClock.cold.medianMs).padStart(7)}ms  ` +
    `warm ${String(c.wallClock.warm.medianMs).padStart(7)}ms  ` +
    `${c.metrics.artifact ? c.metrics.artifact.bytes + 'B' : 'no artifact'}`
  )
}
