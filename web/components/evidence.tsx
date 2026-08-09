/* Evidence tables.

   These are the paper's primary exhibits. Every number here is read straight out
   of data/capture.json — nothing is recomputed from a summary, and nothing is
   rounded away. Server components on purpose: the tables are static facts about a
   fixed capture, so there is no state to hydrate.

   Encoding rules followed throughout, per the project's design brief:
   - No cell relies on colour. Failure is spelled with the diagnostic code, absence
     with an em dash, and admission with the words "ok" / "rejected".
   - Numeric columns carry className="n" on both the <th> and the <td> so the
     header sits over its figures, and className="num" for tabular numerals.
   - Every table states its population and its units in the <caption>. */

import type { Capture } from '@/lib/types'
import { CLASSICAL_PHASES } from '@/lib/phases'

const DASH = '—'

function fmt(n: number | null | undefined): string {
  return n == null ? DASH : n.toLocaleString('en-US')
}

/* toolchain.version is Record<string, unknown> because it mirrors the compiler's
   own --json payload. Read it defensively rather than asserting a shape. */
function compilerVersion(capture: Capture): string {
  const raw = capture.toolchain.version['version']
  return typeof raw === 'string' ? raw : 'unknown'
}

/* ------------------------------------------------------- 1. phase mapping */

/* The central claim of the paper, as a table: six canonical phases against the
   phase names Zero actually reports. The divergence sits on its own full-width
   row so the mapping stays scannable at a glance and the argument stays legible
   when you stop to read it. */
export function PhaseMappingTable({ capture }: { capture: Capture }) {
  const COLS = 6
  return (
    <div className="table-wrap">
      <table>
        <caption>
          The six canonical front-to-back compiler phases (Aho, Lam, Sethi and Ullman) against the
          phase names Zero {compilerVersion(capture)} reports in its own <span className="mono">--json</span>{' '}
          output. One mapping row per phase, followed by a row stating where the realisation departs
          from the textbook. Counts and units: none — this table is definitional.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="n">#</th>
            <th scope="col">Classical phase</th>
            <th scope="col">Input {'→'} output</th>
            <th scope="col">Zero phases</th>
            <th scope="col">Probe</th>
            <th scope="col">Locus</th>
          </tr>
        </thead>
        <tbody>
          {CLASSICAL_PHASES.map((p) => (
            <RowGroup key={p.id} cols={COLS} phase={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({
  phase,
  cols,
}: {
  phase: (typeof CLASSICAL_PHASES)[number]
  cols: number
}) {
  const hasDivergence = phase.divergence.trim().length > 0
  return (
    <>
      <tr style={hasDivergence ? { borderBottom: 'none' } : undefined}>
        <th scope="row" className="n num">{phase.n}</th>
        <td>{phase.name}</td>
        <td>
          {phase.input} <span style={{ color: 'var(--text-tertiary)' }}>{'→'}</span> {phase.output}
        </td>
        <td>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3125rem' }}>
            {phase.zeroPhases.map((z) => (
              <span className="pill" key={z}>{z}</span>
            ))}
          </span>
        </td>
        <td><span className="mono">{phase.probe}</span></td>
        <td>{phase.locus}</td>
      </tr>
      {hasDivergence ? (
        <tr>
          <td className="wrap caption" colSpan={cols} style={{ paddingTop: 0 }}>
            <span className="label" style={{ color: 'var(--text-secondary)' }}>Divergence</span>
            {' — '}
            {phase.divergence}
          </td>
        </tr>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------- 2. backend matrix */

/* Programs down, targets across. The front end accepted every one of these
   programs; the cells that carry a code are the backend declining to lower a
   program that already passed every semantic gate. */
export function BackendMatrixTable({ capture }: { capture: Capture }) {
  const targets = capture.toolchain.targets
  const programs = capture.corpus
  const total = programs.length

  const okCount = (target: string) =>
    programs.filter((p) => p.buildMatrix[target]?.ok === true).length

  /* Distinct (code, actual) pairs and how often each occurs across the whole
     matrix. The pair matters: one code covers several different refusals. */
  const reasons = new Map<string, { code: string; actual: string; count: number }>()
  for (const p of programs) {
    for (const t of targets) {
      const cell = p.buildMatrix[t.name]
      if (!cell || cell.ok) continue
      const code = cell.code ?? 'no code'
      const actual = cell.actual ?? 'no detail'
      const key = `${code}::${actual}`
      const prev = reasons.get(key)
      if (prev) prev.count += 1
      else reasons.set(key, { code, actual, count: 1 })
    }
  }
  const reasonList = [...reasons.values()].sort((a, b) => b.count - a.count)
  const failures = reasonList.reduce((n, r) => n + r.count, 0)

  return (
    <>
      <div className="table-wrap">
        <table>
          <caption>
            Build outcome for every corpus program on every target the installed toolchain advertises
            ({total} programs {'×'} {targets.length} targets = {total * targets.length} builds,{' '}
            {failures} of them refused). A cell holding a number is the emitted artifact size in bytes;
            a cell holding a diagnostic code is a refusal, and the code is the marker.
          </caption>
          <thead>
            <tr>
              <th scope="col">Program</th>
              {targets.map((t) => (
                <th scope="col" className="n mono" key={t.name}>{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="mono">{p.id}</th>
                {targets.map((t) => {
                  const cell = p.buildMatrix[t.name]
                  if (!cell) {
                    return <td className="n" key={t.name}>{DASH}</td>
                  }
                  if (cell.ok) {
                    return <td className="n num" key={t.name}>{fmt(cell.bytes)}</td>
                  }
                  return (
                    <td className="n" key={t.name}>
                      <span className="mono" style={{ color: 'var(--text-tertiary)' }}>
                        {cell.code ?? 'refused'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" style={{ borderTop: '1px solid var(--border-strong)' }}>
                Built
              </th>
              {targets.map((t) => (
                <td className="n num" key={t.name}>
                  {okCount(t.name)}/{total}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <ul
        className="caption"
        style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.25rem' }}
      >
        {reasonList.map((r) => (
          <li key={`${r.code}::${r.actual}`}>
            <span className="mono">{r.code}</span>
            {' · '}
            <span className="mono">{r.actual}</span>
            {' — '}
            <span className="num">{r.count}</span> {r.count === 1 ? 'build' : 'builds'}
          </li>
        ))}
      </ul>
    </>
  )
}

/* --------------------------------------------------------- 3. error corpus */

/* Three admission gates, not one. A program can be turned away when text is
   imported into the graph, when the graph is checked, or when the backend is
   asked to lower it — and the corpus contains cases that prove each. */
export function ErrorCorpusTable({ capture }: { capture: Capture }) {
  const cases = capture.errorCases

  const gate = (v: boolean | null): string => (v === null ? DASH : v ? 'ok' : 'rejected')

  return (
    <div className="table-wrap">
      <table>
        <caption>
          The {cases.length} deliberately malformed programs in the error corpus, one row each. The
          three gate columns record the outcome of <span className="mono">zero import</span>,{' '}
          <span className="mono">zero check</span> and <span className="mono">zero build</span>: “ok”
          passed, “rejected” was refused, {DASH} was never reached. No units.
        </caption>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Targets phase</th>
            <th scope="col">Import</th>
            <th scope="col">Check</th>
            <th scope="col">Build</th>
            <th scope="col">Rejected at</th>
            <th scope="col">Codes</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((e) => (
            <tr key={e.id}>
              <th scope="row" className="mono">{e.id}</th>
              <td>{e.phase ?? DASH}</td>
              <td>{gate(e.importOk)}</td>
              <td>{gate(e.checkOk)}</td>
              <td>{gate(e.buildOk)}</td>
              <td>{e.rejectedAt}</td>
              <td>
                <span className="mono">{e.codes.length > 0 ? e.codes.join(', ') : DASH}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------- 4. capability matrix */

/* What each target declares it can do. This is the table the TAR002 case in the
   error corpus is decided against: capability is a property of the target, and
   the checker consults it before the backend is ever invoked. */
export function CapabilityMatrixTable({ capture }: { capture: Capture }) {
  const targets = capture.toolchain.targets
  const caps = [...new Set(targets.flatMap((t) => t.capabilities))].sort()

  return (
    <div className="table-wrap">
      <table>
        <caption>
          The {targets.length} targets the installed toolchain advertises, against the union of{' '}
          {caps.length} capability names declared across them. “yes” means the target declares that
          capability; {DASH} means it does not. No units.
        </caption>
        <thead>
          <tr>
            <th scope="col">Target</th>
            <th scope="col">OS</th>
            <th scope="col">Arch</th>
            <th scope="col">Object format</th>
            <th scope="col">libc</th>
            {caps.map((c) => (
              <th scope="col" key={c}>{c}</th>
            ))}
            <th scope="col" className="n">Declared</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => (
            <tr key={t.name}>
              <th scope="row" className="mono">{t.name}</th>
              <td>{t.os}</td>
              <td>{t.arch}</td>
              <td>{t.objectFormat}</td>
              <td>{t.libc}</td>
              {caps.map((c) => (
                <td key={c}>{t.capabilities.includes(c) ? 'yes' : DASH}</td>
              ))}
              <td className="n num">{t.capabilities.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------- 5. scaling */

/* The size gradient. Source size at the left, graph size in the middle, artifact
   size at the right — the same program measured at each stage of the pipeline,
   which is what lets the paper argue about where cost actually accumulates. */
export function ScalingTable({ capture }: { capture: Capture }) {
  const programs = capture.corpus

  return (
    <div className="table-wrap">
      <table>
        <caption>
          All {programs.length} corpus programs in corpus order, measured at each stage of the
          pipeline. Lines and bytes are source text; tokens are the total emitted by{' '}
          <span className="mono">zero tokens</span> including newlines; nodes, edges, declarations,
          symbols and types are row counts in the persisted graph; typed nodes and calls come from{' '}
          <span className="mono">zero check</span>; artifact is the host-target executable in bytes,
          or {DASH} where the backend refused to build it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Program</th>
            <th scope="col" className="n">Lines</th>
            <th scope="col" className="n">Bytes</th>
            <th scope="col" className="n">Tokens</th>
            <th scope="col" className="n">Nodes</th>
            <th scope="col" className="n">Edges</th>
            <th scope="col" className="n">Decls</th>
            <th scope="col" className="n">Symbols</th>
            <th scope="col" className="n">Types</th>
            <th scope="col" className="n">Typed nodes</th>
            <th scope="col" className="n">Calls</th>
            <th scope="col" className="n">Artifact bytes</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => {
            const tables = p.semantic.tables
            const counts = p.semantic.counts
            return (
              <tr key={p.id}>
                <th scope="row" className="mono">{p.id}</th>
                <td className="n num">{fmt(p.metrics.lines)}</td>
                <td className="n num">{fmt(p.metrics.bytes)}</td>
                <td className="n num">{fmt(p.metrics.totalTokens)}</td>
                <td className="n num">{fmt(p.metrics.graphNodes)}</td>
                <td className="n num">{fmt(p.metrics.graphEdges)}</td>
                <td className="n num">{fmt(tables?.declaration)}</td>
                <td className="n num">{fmt(tables?.symbol)}</td>
                <td className="n num">{fmt(tables?.type)}</td>
                <td className="n num">{fmt(counts?.typedNodes)}</td>
                <td className="n num">{fmt(counts?.calls)}</td>
                <td className="n num">{fmt(p.metrics.artifact?.bytes)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
