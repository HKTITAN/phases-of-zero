import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Capture, CorpusEntry } from './types'

/* Read at module scope on the server. The dataset is a build-time artifact
   produced by tools/capture.mjs, so it is inlined into the static render and
   the deployed site needs no runtime filesystem or database access. */
let cached: Capture | null = null

export function getCapture(): Capture {
  if (!cached) {
    cached = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'capture.json'), 'utf8')
    ) as Capture
  }
  return cached
}

export function programById(capture: Capture, id?: string): CorpusEntry {
  return capture.corpus.find((c) => c.id === id) ?? capture.corpus[0]
}

/* Anything handed to a client component is serialised into the RSC payload and
   shipped over the wire. The full capture is 3.3 MB — dominated by per-program
   stdlib catalogues in `backend.size` (~212 KB each) and source maps (~700 KB
   total), none of which the explorer renders. Server components read the full
   object for free; only this projection crosses to the client. */
export function explorerCapture(capture: Capture): Capture {
  return {
    ...capture,
    toolchain: { ...capture.toolchain, doctor: {}, version: capture.toolchain.version },
    /* The gate walkthrough renders these on the client, so they cross the wire —
       but only the fields it reads. `explains` and `fixPlan` are separate command
       payloads no component displays, and `buildRaw` is the unparsed stderr the
       structured diagnostics already carry. Together those are ~11 KB of the
       33 KB the corpus of ten cases would otherwise cost. */
    errorCases: capture.errorCases.map((e) => ({
      ...e,
      explains: {},
      fixPlan: {},
      buildRaw: null,
    })),
    corpus: capture.corpus.map((c) => ({
      ...c,
      /* Source maps are summarised by `counts` in the tables and never listed
         row by row, so the rows are dropped and the report kept. This is the
         single largest saving in the projection: 2,216 mappings, ~690 KB. */
      sourceMap: { ...c.sourceMap, mappings: [] },
      safety: null,
      // The explorer renders calls and tables, never the raw graph node list.
      graph: { modules: c.graph.modules, functions: [], counts: c.graph.counts },
      lexical: {
        perFile: c.lexical.perFile,
        // TokenStream shows 140 by default; a small margin covers its elision line.
        sample: c.lexical.sample.slice(0, 160),
      },
      semantic: {
        ...c.semantic,
        types: c.semantic.types.slice(0, 12),
        calls: c.semantic.calls.slice(0, 16),
        functions: c.semantic.functions.slice(0, 12),
        effects: [],
        ownership: c.semantic.ownership.slice(0, 8),
        resources: c.semantic.resources.slice(0, 8),
        targetRequirements: c.semantic.targetRequirements.slice(0, 8),
      },
      phases: {
        ...c.phases,
        // The panels read coldTimed and the cold cache list. Warm figures are
        // provenance for the paper's prose, which renders on the server.
        warm: [],
        warmTimed: [],
        warmCaches: [],
        coldGraphTimings: c.phases.coldGraphTimings,
        warmGraphTimings: null,
        selfHostRouting: null,
      },
      backend: {
        ...c.backend,
        // `size` is 212 KB per program, almost all of it a stdlib catalogue.
        // The explorer reads exactly four fields from it, so keep only those.
        size: c.backend.size
          ? {
              loweredIrBytes: c.backend.size.loweredIrBytes ?? null,
              profile: c.backend.size.profile ?? null,
              profileSemantics: c.backend.size.profileSemantics ?? null,
              profileCatalog: c.backend.size.profileCatalog ?? null,
            }
          : null,
        mem: null,
        time: null,
      },
    })),
  }
}

/* Derived figures the prose cites. Computed here rather than hardcoded so the
   text can never drift from the dataset. */
export function summarise(capture: Capture) {
  const c = capture.corpus
  const targets = capture.toolchain.targets.map((t) => t.name)

  let builds = 0
  let attempts = 0
  const failures: Record<string, number> = {}
  for (const p of c) {
    for (const t of targets) {
      const m = p.buildMatrix[t]
      if (!m) continue
      attempts++
      if (m.ok) builds++
      else {
        const key = `${m.code ?? 'unknown'}: ${m.actual ?? 'unspecified'}`
        failures[key] = (failures[key] ?? 0) + 1
      }
    }
  }

  const loweredMs = c.map((p) => p.phases.coldTimed.find((x) => x.name === 'lower')?.elapsedMs ?? 0)
  const totalPhaseMs = c.map((p) => p.phases.coldTimed.reduce((s, x) => s + x.elapsedMs, 0))

  const testCount = c.reduce((n, p) => {
    const m = p.execution.testStdout.match(/(\d+) test\(s\) ok/)
    return n + (m ? Number(m[1]) : 0)
  }, 0)

  return {
    programs: c.length,
    lines: c.reduce((n, p) => n + p.metrics.nonEmptyLines, 0),
    tokens: c.reduce((n, p) => n + p.metrics.codeTokens, 0),
    nodes: c.reduce((n, p) => n + (p.metrics.graphNodes ?? 0), 0),
    edges: c.reduce((n, p) => n + (p.metrics.graphEdges ?? 0), 0),
    testCount,
    targets: targets.length,
    builds,
    attempts,
    buildRate: attempts ? Math.round((builds / attempts) * 100) : 0,
    failures: Object.entries(failures).sort((a, b) => b[1] - a[1]),
    /* The share of measurable phase time spent in lowering, across the corpus. */
    lowerShare:
      totalPhaseMs.reduce((s, v) => s + v, 0) === 0
        ? 0
        : Math.round(
            (loweredMs.reduce((s, v) => s + v, 0) / totalPhaseMs.reduce((s, v) => s + v, 0)) * 100
          ),
    errorCases: capture.errorCases.length,
    rejectedAtImport: capture.errorCases.filter((e) => e.rejectedAt === 'import').length,
    rejectedAtCheck: capture.errorCases.filter((e) => e.rejectedAt === 'check').length,
    rejectedAtBuild: capture.errorCases.filter((e) => e.rejectedAt === 'build').length,
    contaminated: capture.errorCases.filter((e) => e.storeContaminated).length,
  }
}
