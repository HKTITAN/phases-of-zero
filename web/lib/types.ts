/* Shapes emitted by tools/capture.mjs. These mirror the Zero 0.3.4 --json
   schemas (schemaVersion 1) rather than inventing an abstraction over them:
   the paper's claim is that the compiler reports its own structure, so the
   report should read the compiler's own field names. */

export type Token = {
  kind: 'word' | 'symbol' | 'number' | 'string' | 'newline' | string
  text: string
  line: number
  column: number
  offset: number
  length: number
}

export type SourceFile = {
  file: string
  text: string
  lines: number
  nonEmptyLines: number
  bytes: number
}

export type CompilerPhase = { name: string; elapsedMs: number; cacheable: boolean }

export type CacheSummary = {
  hits: number; misses: number; entries: number; warmRebuildExpected: boolean
}

export type GraphTables = {
  schema: number; package: number; module: number; declaration: number
  scope: number; import: number; symbol: number; type: number
  effect: number; capability: number; ownership: number; resource: number
  node: number; edge: number; projection: number; sourceMap: number
}

export type SemanticCounts = {
  typedNodes: number; functions: number; calls: number; fallibleCalls: number
  effects: number; contracts: number; ownership: number; borrowing: number
  resources: number; targetRequirements: number; repairs: number; diagnostics: number
}

export type Diagnostic = {
  severity: string
  code: string
  message: string
  path: string
  line: number
  column: number
  length: number
  expected?: string
  actual?: string
  help?: string
  fixSafety?: string
  repair?: { id: string; summary: string } | null
  related?: { path: string; line: number; column: number; message: string }[]
}

export type WallClock = {
  runs: number; medianMs: number; minMs: number; maxMs: number; samples: number[]
}

/* `zero sourcemap --json`. Every graph node carries a range back into the file it
   came from, which is what lets a diagnostic be positioned after the text has
   been discarded. `mappings` is by far the largest thing in the capture — 2,216
   rows, ~690 KB of a 3.3 MB file — so the client projection keeps the counts and
   drops the rows. */
export type SourceMapReport = {
  schemaVersion: number
  ok: boolean
  artifact: string
  canonicalSource: boolean
  moduleIdentity: string
  graphHash: string
  counts: { files: number; mappings: number }
  files: {
    path: string
    sourceHash: string
    lineCount: number
    nodeCount: number
    columnUnit: string
    /* False across the corpus: the graph is the artifact, and the source text is
       not required to be present for the map to resolve. */
    readable: boolean
  }[]
  mappings: {
    nodeId: string; kind: string; name: string; type: string; value: string
    nodeHash: string; symbolId: string; typeId: string; effectId: string
    sourceAvailable: boolean
    sourceRange: {
      path: string
      start: { line: number; column: number }
      end: { line: number; column: number }
      columnUnit: string
    }
  }[]
  diagnostics: Diagnostic[]
}

/* `zero interface --json`. The hashed public surface of each module — what a
   downstream package is allowed to depend on, and the key that decides whether a
   rebuild can be skipped. */
export type InterfaceReport = {
  schemaVersion: number
  algorithm: string
  targetFactsHash: string
  importedPackageMetadataHash: string
  sourceKind: string
  graphHash: string
  modules: {
    name: string
    path: string
    sourceHash: string
    publicInterfaceHash: string
    publicSymbolCount: number
    publicSymbols: { name: string; kind: string }[]
    imports: { module: string; path: string }[]
  }[]
}

export type CorpusEntry = {
  id: string
  sources: SourceFile[]
  metrics: {
    files: number
    lines: number
    nonEmptyLines: number
    bytes: number
    totalTokens: number
    codeTokens: number
    graphNodes: number | null
    graphEdges: number | null
    graphHash: string | null
    artifact: { path: string; bytes: number } | null
  }
  lexical: {
    perFile: { file: string; count: number; byKind: Record<string, number> }[]
    sample: Token[]
  }
  syntax: {
    root?: { kind: string; shapeCount: number; enumCount: number; choiceCount: number; functionCount: number }
    shapes?: unknown[]
    enums?: unknown[]
    choices?: unknown[]
    functions?: {
      kind: string; name: string; returnType: string
      paramCount: number; bodyKinds: string[]; line: number; column: number
    }[]
  } | null
  semantic: {
    tables: GraphTables | null
    resolution: { state: string; ok: boolean; references: number; diagnostics: number } | null
    checking: { state: string; ok: boolean; authority: string; sourceTextAuthority: boolean } | null
    counts: SemanticCounts | null
    types: {
      node: string; kind: string; name: string; type: string; typeId: string
      sourceRange?: { path: string; start: { line: number; column: number } }
    }[]
    functions: {
      node: string; name: string; symbolId: string; returnType: string
      public: boolean; fallible: boolean
      params: { name: string; type: string }[]
      effects: { name: string; effectId: string }[]
    }[]
    calls: {
      node: string; kind: string; name: string; qualifiedName: string
      returnType: string; fallible: boolean; checked: boolean
      contract?: { kind: string; capability: string; targetSupport: string }
      resolution?: { resolved: boolean; targetKind: string; symbolId: string }
    }[]
    effects: unknown[]
    ownership: { node: string; kind: string; name: string; type: string; ownership: string }[]
    resources: { node: string; kind: string; resourceKind: string; capability?: string }[]
    targetRequirements: { qualifiedName: string; capability: string; targetSupport: string }[]
  }
  graph: {
    modules: { id: string; name: string; path: string }[]
    functions: {
      id: string; name: string; returnType: string; public: boolean
      fallible: boolean; test: string | null
      params: { id: string; name: string; type: string; order: number }[]
      statements: { id: string; kind: string; order: number }[]
    }[]
    counts: { nodes: number; edges: number } | null
  }
  phases: {
    cold: CompilerPhase[]
    warm: CompilerPhase[]
    /* From `zero time --json`, which drives the pipeline through emission and so
       attributes lowering cost. `check` can return before lowering completes. */
    coldTimed: CompilerPhase[]
    warmTimed: CompilerPhase[]
    coldCacheSummary: CacheSummary | null
    warmCacheSummary: CacheSummary | null
    requiresCapabilities: string[]
    selfHostRouting: {
      contractVersion: number
      subsetCompatible: boolean
      mode: string
      phases: Record<string, string>
      removed: Record<string, boolean>
      cBridge?: { required: boolean; policy: string; explicitDirectFallback: string }
    } | null
    coldGraphTimings: Record<string, number | boolean> | null
    warmGraphTimings: Record<string, number | boolean> | null
    caches: { name: string; key: string; hit: boolean; stored: boolean; invalidatesOn: string }[]
    warmCaches: { name: string; hit: boolean }[]
    coldCacheHits: number | null
    coldCacheMisses: number | null
    warmCacheHits: number | null
    warmCacheMisses: number | null
  }
  wallClock: { cold: WallClock; warm: WallClock }
  sourceMap: SourceMapReport
  interfaces: InterfaceReport
  backend: {
    target: {
      ok: boolean; target: string; emit: string; objectFormat: string
      backend: string; stage: string; buildable: boolean
    } | null
    irEmitted: boolean
    irLines: number
    irExcerpt: string | null
    irError: string | null
    size: Record<string, unknown> | null
    mem: Record<string, unknown> | null
    time: Record<string, unknown> | null
  }
  safety: Record<string, unknown> | null
  /* One entry per target the installed compiler advertises. `ok` false with a
     BLD004 code is the backend refusing to lower a program the front end accepted. */
  buildMatrix: Record<string, {
    ok: boolean
    bytes: number | null
    ms: number
    code: string | null
    actual: string | null
  }>
  execution: { ranOk: boolean; stdout: string; testsOk: boolean; testStdout: string }
}

export type ErrorCase = {
  id: string
  phase: string | null
  intent: string | null
  expectedCode: string | null
  target: string | null
  sources: SourceFile[]
  rejectedAt: 'import' | 'check' | 'build' | 'none'
  importOk: boolean | null
  checkOk: boolean | null
  buildOk: boolean | null
  storeContaminated: boolean
  storedMain: string
  importDiagnostics: Diagnostic[]
  checkDiagnostics: Diagnostic[]
  buildDiagnostics: Diagnostic[]
  buildRaw: string | null
  /* `zero check --json` reports two verdicts that can disagree: a top-level `ok`
     and a nested `targetReadiness`. Both are recorded so the discrepancy is
     stated as data rather than asserted in prose. */
  checkTopLevelOk: boolean | null
  checkReadinessOk: boolean | null
  checkReadinessBuildable: boolean | null
  checkReadinessStage: string | null
  readinessDiagnostics: Diagnostic[]
  checkKnewButReportedOk: boolean
  diagnostics: Diagnostic[]
  codes: string[]
  explains: Record<string, unknown>
  fixPlan: Record<string, unknown>
}

export type TargetInfo = {
  name: string; os: string; arch: string; abi: string
  objectFormat: string; libc: string
  capabilities: string[]
  directBackend: string | null
}

export type Capture = {
  capturedAt: string
  toolchain: {
    version: Record<string, unknown>
    doctor: Record<string, unknown>
    targetCount: number | null
    host: string | null
    targets: TargetInfo[]
  }
  machine: {
    platform: string; arch: string; cpu: string | null
    cores: number; totalMemGB: number; node: string
  }
  corpus: CorpusEntry[]
  errorCases: ErrorCase[]
  /* Measured cost of answering the same question as human text versus as
     structured data. Token figures are estimates at ~4 chars/token and are
     labelled as such wherever they are cited. */
  readCost: ReadCost[]
  diagnosticCost: DiagnosticCost[]
}

export type ReadCost = {
  id: string
  /* What a text-first reader must ingest to answer anything about the program. */
  wholeSourceBytes: number
  wholeSourceTokensEst: number
  /* Targeted answers to "show me one function". */
  viewFnBytes: number
  viewFnTokensEst: number
  queryFnBytes: number
  queryFnTokensEst: number
  queryCallsBytes: number
  /* Cost of the verdict "is this program correct?" in each form. */
  checkTextBytes: number
  checkJsonBytes: number
  compilerTokens: number | null
}

export type DiagnosticCost = {
  id: string
  proseBytes: number
  jsonBytes: number
  /* Fields a program can act on without parsing English. */
  machineFields: string[]
  hasTypedRepair: boolean
  fixSafety: string | null
  proseSample: string
}
