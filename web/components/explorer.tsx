'use client'

/* The paper's centrepiece: one program walked through all six classical phases,
   showing the artifact Zero 0.3.4 actually emitted at each one.

   Every number rendered here comes from data/capture.json. Nothing is computed
   from an idea of what a compiler should report — where Zero reports nothing
   (optimization, textual IR) the panel says so rather than inventing a stand-in.

   Heading contract: the component owns an <h2> and gives each panel an <h3>,
   so it should be placed inside a page whose own heading is an <h1>. */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  Capture, CompilerPhase, CorpusEntry, GraphTables, SemanticCounts,
} from '@/lib/types'
import { CLASSICAL_PHASES } from '@/lib/phases'
import { BarChart, Figure, PhaseBar, StatStrip } from '@/components/charts'
import { TokenStream, ZeroCode } from '@/components/zero-code'

/* ------------------------------------------------------------- formatting */

const int = (n: number) => n.toLocaleString('en-US')
const ms1 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const yesNo = (b: boolean) => (b ? 'yes' : 'no')
const orDash = (s: string | null | undefined) => (s && s.length > 0 ? s : '—')

/* capture.json carries more fields than lib/types.ts declares — the type file
   mirrors only what the rest of the paper reads. These narrow the extra fields
   without loosening the declared shapes. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
/* `phases.coldTimed` is a cold build driven through emission, so it attributes
   lowering cost; `phases.cold` comes from `check`, which can return before
   lowering completes. Prefer the timed run, falling back when it is empty. */
function coldTimedPhases(program: CorpusEntry): CompilerPhase[] {
  const timed = program.phases.coldTimed
  return timed.length > 0 ? timed : program.phases.cold
}

const KIND_ORDER = ['word', 'symbol', 'number', 'string', 'comment', 'newline', 'eof']

/* Kinds are read from the data, not hardcoded: the capture contains `comment`
   and `eof` alongside the five kinds the prose names. */
function tokenKinds(perFile: CorpusEntry['lexical']['perFile']): string[] {
  const seen = new Set<string>()
  for (const f of perFile) for (const k of Object.keys(f.byKind)) seen.add(k)
  const known = KIND_ORDER.filter((k) => seen.has(k))
  const rest = [...seen].filter((k) => !KIND_ORDER.includes(k)).sort()
  return [...known, ...rest]
}

const GRAPH_TABLES: (keyof GraphTables)[] = [
  'module', 'declaration', 'scope', 'symbol', 'type', 'effect',
  'capability', 'ownership', 'resource', 'node', 'edge', 'sourceMap',
]
const OTHER_TABLES: (keyof GraphTables)[] = ['schema', 'package', 'import', 'projection']

const COUNT_KEYS: (keyof SemanticCounts)[] = [
  'typedNodes', 'functions', 'calls', 'fallibleCalls', 'effects', 'contracts',
  'ownership', 'borrowing', 'resources', 'targetRequirements', 'repairs', 'diagnostics',
]

const CALL_LIMIT = 12

/* ---------------------------------------------------------------- controls */

const controlStyle: CSSProperties = {
  font: 'inherit',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  background: 'var(--bg-raised)',
  border: 'var(--rule)',
  borderRadius: 4,
  padding: '0.4375rem 0.625rem',
  maxWidth: '100%',
}

function ScrollBox({
  label, maxHeight, children,
}: { label: string; maxHeight: string; children: ReactNode }) {
  // Scrollable regions must be reachable by keyboard, so the box is focusable
  // and named rather than being a bare overflow container.
  return (
    <div role="group" aria-label={label} tabIndex={0} style={{ maxHeight, overflow: 'auto' }}>
      {children}
    </div>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="caption">{children}</p>
}

/* ---------------------------------------------------------- 1. lexical */

function LexicalPanel({ program }: { program: CorpusEntry }) {
  const files = program.lexical.perFile
  const kinds = tokenKinds(files)
  const totalOf = (kind: string) => files.reduce((n, f) => n + (f.byKind[kind] ?? 0), 0)
  const grandTotal = files.reduce((n, f) => n + f.count, 0)

  return (
    <div>
      <div className="split">
        <Figure
          title="Token stream"
          meta={`src/main.0 · ${int(program.lexical.sample.length)} tokens captured`}
        >
          <ScrollBox label="Token stream for src/main.0" maxHeight="clamp(200px, 38vh, 340px)">
            <TokenStream tokens={program.lexical.sample} />
          </ScrollBox>
        </Figure>

        <div className="table-wrap">
          <table>
            <caption>
              Token counts by kind. {int(program.metrics.totalTokens)} tokens across{' '}
              {int(program.metrics.files)} files, of which{' '}
              {int(program.metrics.codeTokens)} are code tokens.
            </caption>
            <thead>
              <tr>
                <th scope="col">Kind</th>
                {files.map((f) => (
                  <th scope="col" className="n" key={f.file}>{f.file}</th>
                ))}
                <th scope="col" className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((kind) => (
                <tr key={kind}>
                  <th scope="row" className="mono">{kind}</th>
                  {files.map((f) => (
                    <td className="n" key={f.file}>{int(f.byKind[kind] ?? 0)}</td>
                  ))}
                  <td className="n">{int(totalOf(kind))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" style={{ borderTop: '1px solid var(--border-strong)' }}>
                  All kinds
                </th>
                {files.map((f) => (
                  <td className="n" key={f.file}>{int(f.count)}</td>
                ))}
                <td className="n">{int(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Caption>
        Output of <code>zero tokens --json</code>: the character stream of{' '}
        <code>src/main.0</code> classified into {kinds.length} kinds, counted per file.
      </Caption>
    </div>
  )
}

/* ----------------------------------------------------------- 2. syntax */

function SyntaxPanel({ program }: { program: CorpusEntry }) {
  const syntax = program.syntax
  const root = syntax?.root
  const functions = syntax?.functions ?? []

  if (!syntax || !root) {
    return (
      <div>
        <p className="body">
          The capture holds no parse tree for this program, so nothing can be shown here.
        </p>
        <Caption>Would be the output of <code>zero parse --json</code>.</Caption>
      </div>
    )
  }

  const declCounts: { label: string; value: number }[] = [
    { label: 'functions', value: root.functionCount },
    { label: 'shapes', value: root.shapeCount },
    { label: 'enums', value: root.enumCount },
    { label: 'choices', value: root.choiceCount },
  ]

  return (
    <div>
      <ul
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
          listStyle: 'none', margin: '0 0 1.25rem', padding: 0,
        }}
      >
        <li><span className="pill">root <span className="mono">{root.kind}</span></span></li>
        {declCounts.map((d) => (
          <li key={d.label}>
            <span className="pill">{d.label} <span className="num">{int(d.value)}</span></span>
          </li>
        ))}
      </ul>

      <div className="table-wrap">
        <table>
          <caption>
            Declarations the parser admitted, in source order.
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Return type</th>
              <th scope="col" className="n">Params</th>
              <th scope="col" className="wrap">Body kinds</th>
              <th scope="col" className="n">Line</th>
            </tr>
          </thead>
          <tbody>
            {functions.map((fn) => (
              <tr key={`${fn.name}:${fn.line}`}>
                <th scope="row" className="mono">{fn.name}</th>
                <td className="mono">{orDash(fn.returnType)}</td>
                <td className="n">{int(fn.paramCount)}</td>
                <td className="wrap mono">{orDash(fn.bodyKinds.join(', '))}</td>
                <td className="n">{int(fn.line)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Caption>
        Output of <code>zero parse --json</code>. The tree is not the compiler&rsquo;s working
        representation — parsing exists to admit text into the graph, after which structure is
        stored rather than re-derived.
      </Caption>
    </div>
  )
}

/* --------------------------------------------------------- 3. semantic */

function SemanticPanel({ program }: { program: CorpusEntry }) {
  const { tables, counts, resolution, checking, calls } = program.semantic
  const shown = calls.slice(0, CALL_LIMIT)

  return (
    <div>
      {resolution || checking ? (
        <ul
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
            listStyle: 'none', margin: '0 0 1.25rem', padding: 0,
          }}
        >
          {resolution ? (
            <>
              <li><span className="pill">resolve <span className="mono">{resolution.state}</span></span></li>
              <li><span className="pill">references <span className="num">{int(resolution.references)}</span></span></li>
            </>
          ) : null}
          {checking ? (
            <>
              <li><span className="pill">check <span className="mono">{checking.state}</span></span></li>
              <li><span className="pill">authority <span className="mono">{checking.authority}</span></span></li>
              <li>
                <span className="pill">
                  source text is authority <span className="mono">{yesNo(checking.sourceTextAuthority)}</span>
                </span>
              </li>
            </>
          ) : null}
        </ul>
      ) : null}

      <div className="grid-2">
        <div className="table-wrap">
          <table>
            <caption>
              Persisted graph tables. This is the symbol table: rows in{' '}
              <code>zero.graph</code>, carried between runs rather than rebuilt per compile.
            </caption>
            <thead>
              <tr>
                <th scope="col">Table</th>
                <th scope="col" className="n">Rows</th>
              </tr>
            </thead>
            <tbody>
              {tables
                ? GRAPH_TABLES.map((name) => (
                    <tr key={name}>
                      <th scope="row" className="mono">{name}</th>
                      <td className="n">{int(tables[name])}</td>
                    </tr>
                  ))
                : (
                  <tr>
                    <th scope="row">—</th>
                    <td>No graph tables were captured.</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <table>
            <caption>Facts the checker recorded, using the compiler&rsquo;s own field names.</caption>
            <thead>
              <tr>
                <th scope="col">Fact</th>
                <th scope="col" className="n">Count</th>
              </tr>
            </thead>
            <tbody>
              {counts
                ? COUNT_KEYS.map((key) => (
                    <tr key={key}>
                      <th scope="row" className="mono">{key}</th>
                      <td className="n">{int(counts[key])}</td>
                    </tr>
                  ))
                : (
                  <tr>
                    <th scope="row">—</th>
                    <td>No checker counts were captured.</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {tables ? (
        <p className="meta" style={{ marginTop: '0.75rem' }}>
          The four remaining tables hold{' '}
          {OTHER_TABLES.map((name, i) => (
            <span key={name}>
              {i > 0 ? ', ' : ''}
              {name} {int(tables[name])}
            </span>
          ))}
          .
        </p>
      ) : null}

      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            {calls.length === 0
              ? 'This program makes no calls.'
              : `Call sites ${calls.length > shown.length
                  ? `1–${shown.length} of ${int(calls.length)}`
                  : `(all ${int(calls.length)})`}. Every one carries a resolved contract.`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Qualified name</th>
              <th scope="col">Return type</th>
              <th scope="col">Fallible</th>
              <th scope="col">Checked</th>
              <th scope="col">Capability</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((call) => (
              <tr key={call.node}>
                <th scope="row" className="mono">{call.qualifiedName}</th>
                <td className="mono">{orDash(call.returnType)}</td>
                <td>{yesNo(call.fallible)}</td>
                <td>{yesNo(call.checked)}</td>
                <td className="mono">{orDash(call.contract?.capability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Caption>
        Output of <code>zero check --json</code> and <code>zero query --json --full</code>. Name
        binding, typing and contract checking are three reported phases writing into one stored
        graph, which is why the symbol table survives the run.
      </Caption>
    </div>
  )
}

/* --------------------------------------------------------------- 4. ir */

function IrPanel({ program }: { program: CorpusEntry }) {
  const timed = coldTimedPhases(program)
  const total = timed.reduce((n, p) => n + p.elapsedMs, 0)
  const mir = program.phases.caches.find((c) => c.name === 'mappedFinalMir')
  const loweredIrBytes = asNumber(asRecord(program.backend.size)?.loweredIrBytes)
  const excerpt = program.backend.irExcerpt

  return (
    <div>
      <Figure
        title="Cold build, phase by phase"
        meta={`${program.id} · ${program.backend.target?.target ?? 'host target'}`}
      >
        {total > 0 ? (
          <PhaseBar
            phases={timed.map((p) => ({ name: p.name, ms: p.elapsedMs }))}
            totalLabel="Cold build"
          />
        ) : (
          <p className="meta" style={{ margin: 0 }}>
            Every reported phase measured 0 ms on this run.
          </p>
        )}

        <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
          <table>
            <caption>
              All eight reported phases. <code>lower</code> is the only one with measurable cost;
              the other seven read stored facts.
            </caption>
            <thead>
              <tr>
                <th scope="col">Phase</th>
                <th scope="col" className="n">Elapsed (ms)</th>
                <th scope="col">Cacheable</th>
              </tr>
            </thead>
            <tbody>
              {timed.map((p) => (
                <tr key={p.name}>
                  <th scope="row" className="mono">{p.name}</th>
                  <td className="n">{int(p.elapsedMs)}</td>
                  <td>{yesNo(p.cacheable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" style={{ borderTop: '1px solid var(--border-strong)' }}>
                  Total
                </th>
                <td className="n">{int(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Figure>

      <div style={{ marginTop: '1.5rem' }}>
        {excerpt ? (
          <div className="code-block">
            <div className="code-head">
              <span>llvm-ir excerpt</span>
              <span>{int(program.backend.irLines)} lines</span>
            </div>
            <ScrollBox label="Textual IR excerpt" maxHeight="clamp(200px, 38vh, 340px)">
              <pre>{excerpt}</pre>
            </ScrollBox>
          </div>
        ) : (
          <>
            <p className="body" style={{ maxWidth: 'var(--measure)' }}>
              This build emits no textual IR. The direct backend lowers graph HIR straight to MIR
              and refuses <code>--emit llvm-ir</code>
              {loweredIrBytes !== null ? (
                <>
                  , so the intermediate representation is measurable only by size:{' '}
                  <span className="num">{int(loweredIrBytes)}</span> bytes of lowered MIR
                </>
              ) : null}
              . The compiler says so itself:
            </p>
            {program.backend.irError ? (
              <div className="code-block" style={{ marginTop: '0.75rem' }}>
                <div className="code-head">
                  <span>zero build --emit llvm-ir</span>
                  <span>stderr</span>
                </div>
                <pre>{program.backend.irError.replace(/\r\n/g, '\n').trimEnd()}</pre>
              </div>
            ) : null}
          </>
        )}
      </div>

      {mir ? (
        <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
          <table>
            <caption>
              The lowered module is cached on disk, so a second build of the same graph skips
              lowering entirely.
            </caption>
            <thead>
              <tr>
                <th scope="col">Cache</th>
                <th scope="col">Key</th>
                <th scope="col">Hit</th>
                <th scope="col">Stored</th>
                <th scope="col" className="wrap">Invalidates on</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="mono">{mir.name}</th>
                <td className="mono">{mir.key}</td>
                <td>{yesNo(mir.hit)}</td>
                <td>{yesNo(mir.stored)}</td>
                <td className="wrap">{mir.invalidatesOn}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <Caption>
        Timings from <code>zero build --json</code>; the IR message from{' '}
        <code>zero build --emit llvm-ir</code>. Lowering is the one phase that does work
        proportional to the program.
      </Caption>
    </div>
  )
}

/* --------------------------------------------------------- 5. optimize */

type ProfileRow = {
  requested: string
  canonical: string
  goal: string
  codegen: string
  link: string
  budgetBytes: number | null
}

function profileCatalog(size: Record<string, unknown> | null): ProfileRow[] {
  const raw = size?.profileCatalog
  if (!Array.isArray(raw)) return []
  const rows: ProfileRow[] = []
  for (const entry of raw) {
    const r = asRecord(entry)
    if (!r) continue
    const requested = asString(r.requested)
    if (!requested) continue
    rows.push({
      requested,
      canonical: asString(r.canonical) ?? requested,
      goal: asString(r.optimizationGoal) ?? '—',
      codegen: asString(r.codegenOptimization) ?? '—',
      link: asString(r.linkOptimization) ?? '—',
      budgetBytes: asNumber(asRecord(r.profileBudget)?.maxHelloArtifactBytes),
    })
  }
  return rows
}

function OptimizePanel({ program }: { program: CorpusEntry }) {
  const size = asRecord(program.backend.size)
  const catalog = profileCatalog(size)
  const semantics = asRecord(size?.profileSemantics)
  const builtCanonical = asString(semantics?.canonical)
  const requested = asString(semantics?.requested) ?? asString(size?.profile)
  const reported = coldTimedPhases(program).map((p) => p.name)

  const built = Object.entries(program.buildMatrix)
    .filter(([, r]) => r.ok && r.bytes !== null)
    .map(([target, r]) => ({
      label: target,
      value: r.bytes ?? 0,
      emphasis: target === program.backend.target?.target,
    }))

  return (
    <div>
      <p className="body" style={{ maxWidth: 'var(--measure)' }}>
        Zero does not report optimization as a phase. The {reported.length} phases it names for
        this build are <span className="mono">{reported.join(', ')}</span> — there is no{' '}
        <span className="mono">optimize</span> among them. Optimization is selected by build
        profile, and its cost is folded into <span className="mono">lower</span> and{' '}
        <span className="mono">codegen</span>. What follows is therefore not a pass pipeline but
        the profile catalogue the compiler advertises.
      </p>

      {catalog.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
          <table>
            <caption>
              Build profiles. {requested ? (
                <>
                  This program was built with <code>--profile {requested}</code>
                  {builtCanonical && builtCanonical !== requested ? (
                    <> (canonically <code>{builtCanonical}</code>)</>
                  ) : null}
                  , marked &ldquo;built here&rdquo; below.
                </>
              ) : null}
            </caption>
            <thead>
              <tr>
                <th scope="col">Profile</th>
                <th scope="col">Canonical</th>
                <th scope="col">Optimization goal</th>
                <th scope="col">Codegen</th>
                <th scope="col">Link</th>
                <th scope="col" className="n">Hello budget (bytes)</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((row) => {
                const isBuilt = builtCanonical !== null && row.canonical === builtCanonical
                return (
                  <tr key={row.requested} aria-current={isBuilt ? 'true' : undefined}>
                    <th scope="row" className="mono" style={{ fontWeight: isBuilt ? 560 : undefined }}>
                      {row.requested}
                      {isBuilt ? (
                        <span className="meta" style={{ marginLeft: '0.5rem' }}>built here</span>
                      ) : null}
                    </th>
                    <td className="mono">{row.canonical}</td>
                    <td className="mono">{row.goal}</td>
                    <td className="mono">{row.codegen}</td>
                    <td className="mono">{row.link}</td>
                    <td className="n">{row.budgetBytes === null ? '—' : int(row.budgetBytes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="body" style={{ maxWidth: 'var(--measure)' }}>
          No profile catalogue was captured for this program.
        </p>
      )}

      {built.length > 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <Figure
            title="Artifact size by target"
            meta={`${built.length} of ${Object.keys(program.buildMatrix).length} targets built`}
            caption={
              <>
                Only one profile was built per program, so size cannot be compared across profiles.
                What can be compared is the same profile across targets: the spread here is object
                format overhead, not optimization. Targets that failed are omitted from the chart
                and listed in the target code generation panel.
              </>
            }
          >
            <BarChart data={built} unit="B" tableLabel="Artifact size" />
          </Figure>
        </div>
      ) : null}

      <Caption>
        Profiles from <code>zero size --json</code>; sizes from{' '}
        <code>zero build --target … --json</code>. The probe for this phase is{' '}
        <code>zero build --profile release-small | tiny</code>, which changes the output without
        naming a pass.
      </Caption>
    </div>
  )
}

/* ---------------------------------------------------------- 6. codegen */

function CodegenPanel({ program }: { program: CorpusEntry }) {
  const target = program.backend.target
  const artifact = program.metrics.artifact
  const matrix = Object.entries(program.buildMatrix)
  const okCount = matrix.filter(([, r]) => r.ok).length

  const facts: { field: string; value: string }[] = target
    ? [
        { field: 'target', value: target.target },
        { field: 'emit', value: target.emit },
        { field: 'objectFormat', value: target.objectFormat },
        { field: 'backend', value: target.backend },
        { field: 'stage', value: target.stage },
        { field: 'buildable', value: yesNo(target.buildable) },
      ]
    : []

  return (
    <div>
      <div className="split">
        <div className="table-wrap">
          <table>
            <caption>
              Backend selection for the host target, as the compiler reports it.
            </caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {facts.length > 0 ? (
                facts.map((f) => (
                  <tr key={f.field}>
                    <th scope="row" className="mono">{f.field}</th>
                    <td className="mono">{f.value}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <th scope="row">—</th>
                  <td>No backend target was captured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {artifact ? (
            <StatStrip
              stats={[
                { value: int(artifact.bytes), unit: 'B', label: `Artifact · ${artifact.path}` },
              ]}
            />
          ) : (
            <p className="body">
              No artifact: <span className="mono">metrics.artifact</span> is null, so nothing was
              linked for the host target. The matrix below names the construct the backend refused.
            </p>
          )}
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Every target the installed compiler advertises. {int(okCount)} of{' '}
            {int(matrix.length)} produced an artifact. A failed row shows the BLD004{' '}
            <span className="mono">actual</span> field — the backend naming the construct it
            cannot lower.
          </caption>
          <thead>
            <tr>
              <th scope="col">Target</th>
              <th scope="col">Result</th>
              <th scope="col" className="n">Elapsed (ms)</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(([name, row]) => (
              <tr key={name}>
                <th scope="row" className="mono">{name}</th>
                <td>
                  {row.ok && row.bytes !== null ? (
                    <>
                      <span className="num">{int(row.bytes)}</span> bytes
                    </>
                  ) : (
                    <>
                      not built — <span className="mono">{row.code ?? 'no code'}</span>
                      {row.actual ? <>: <span className="mono">{row.actual}</span></> : null}
                    </>
                  )}
                </td>
                <td className="n">{ms1(row.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Caption>
        Output of <code>zero build --emit exe</code> and <code>zero size --json</code>, run once
        per advertised target. Acceptance by the front end does not imply the backend can lower
        the program.
      </Caption>
    </div>
  )
}

/* ------------------------------------------------------------ container */

function resolveProgramId(corpus: CorpusEntry[], wanted?: string): string {
  const match = corpus.find((p) => p.id === wanted)
  return match?.id ?? corpus[0]?.id ?? ''
}

function resolvePhaseId(wanted?: string): string {
  const match = CLASSICAL_PHASES.find((p) => p.id === wanted)
  return match?.id ?? CLASSICAL_PHASES[0].id
}

export function PhaseExplorer({
  capture, initialProgram, initialPhase,
}: {
  capture: Capture
  initialProgram?: string
  initialPhase?: string
}) {
  const corpus = capture.corpus
  const [programId, setProgramId] = useState<string>(() => resolveProgramId(corpus, initialProgram))
  const [phaseId, setPhaseId] = useState<string>(() => resolvePhaseId(initialPhase))

  /* The page is statically rendered, so `searchParams` is empty at build time and
     the props above cannot carry a deep link. Read the real query string once on
     mount instead, and only start writing state back to the URL afterwards —
     otherwise the first write would clobber the link the reader arrived on. */
  const [urlAdopted, setUrlAdopted] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const p = q.get('program')
    const ph = q.get('phase')
    /* The query string is an external system that cannot be read during render on
       a statically rendered page: reading it in a lazy initialiser would make the
       hydration render disagree with the server HTML. Adopting it once on mount is
       the intended shape here, so the set-state-in-effect rule is waived for this
       block only — it runs a single time and is gated by `urlAdopted` below. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p) setProgramId(resolveProgramId(corpus, p))
    if (ph) setPhaseId(resolvePhaseId(ph))
    setUrlAdopted(true)
  }, [corpus])

  /* Deep-linkable state. replaceState rather than pushState: stepping through six
     phases should not fill the back button with history entries. */
  useEffect(() => {
    if (!urlAdopted) return
    const url = new URL(window.location.href)
    url.searchParams.set('program', programId)
    url.searchParams.set('phase', phaseId)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [programId, phaseId, urlAdopted])

  const program: CorpusEntry | undefined = useMemo(
    () => corpus.find((p) => p.id === programId) ?? corpus[0],
    [corpus, programId],
  )
  const phase = CLASSICAL_PHASES.find((p) => p.id === phaseId) ?? CLASSICAL_PHASES[0]

  if (!program) {
    return <p className="body">No corpus was captured, so there is nothing to walk through.</p>
  }

  const main = program.sources.find((s) => s.file === 'src/main.0') ?? program.sources[0]
  const panelId = 'phase-explorer-panel'

  return (
    <section aria-labelledby="phase-explorer-title">
      <h2 className="heading-24" id="phase-explorer-title">
        One program through six phases
      </h2>
      <p className="lede" style={{ maxWidth: 'var(--measure)', marginBottom: '1.75rem' }}>
        Pick a program and a phase. Each panel shows the artifact Zero 0.3.4 emitted for that
        program at that phase, together with the command that produced it.
      </p>

      {/* ------------------------------------------------------- controls */}

      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: '0.3125rem', marginBottom: '1.25rem',
        }}
      >
        <label className="label" htmlFor="phase-explorer-program">
          Program
        </label>
        <select
          id="phase-explorer-program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          aria-describedby="phase-explorer-program-hint"
          style={controlStyle}
        >
          {corpus.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {int(p.metrics.lines)} lines
            </option>
          ))}
        </select>
        <p className="meta" id="phase-explorer-program-hint" style={{ margin: 0 }}>
          Line counts cover every file in the package; the source shown below is src/main.0.
        </p>
      </div>

      <ol
        aria-label="Classical compiler phases"
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.375rem',
          listStyle: 'none', margin: '0 0 1.75rem', padding: 0,
        }}
      >
        {CLASSICAL_PHASES.map((p, i) => {
          const selected = p.id === phase.id
          return (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <button
                type="button"
                onClick={() => setPhaseId(p.id)}
                aria-current={selected ? 'step' : undefined}
                aria-controls={panelId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  font: 'inherit',
                  fontSize: '0.8125rem',
                  fontWeight: selected ? 560 : 460,
                  lineHeight: 1.3,
                  color: 'var(--text)',
                  background: selected ? 'var(--bg-raised)' : 'transparent',
                  border: '1px solid',
                  borderColor: selected ? 'var(--text)' : 'var(--border)',
                  borderRadius: 4,
                  padding: '0.375rem 0.625rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* The selected step inverts its numeral. Weight, border and the
                    inverted block all change together, so the state survives
                    grayscale and forced-colour rendering. */}
                <span
                  aria-hidden="true"
                  className="mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: 3,
                    fontSize: '0.6875rem',
                    background: selected ? 'var(--text)' : 'transparent',
                    color: selected ? 'var(--bg)' : 'var(--text-tertiary)',
                    border: selected ? '1px solid var(--text)' : '1px solid var(--border)',
                  }}
                >
                  {p.n}
                </span>
                <span>{p.name}</span>
              </button>
              {i < CLASSICAL_PHASES.length - 1 ? (
                <span aria-hidden="true" className="meta">&rarr;</span>
              ) : null}
            </li>
          )
        })}
      </ol>

      {/* ----------------------------------------------- always-visible source */}

      {main ? (
        <ScrollBox
          label={`Source of ${main.file} in ${program.id}`}
          maxHeight="clamp(220px, 42vh, 420px)"
        >
          <ZeroCode src={main.text} file={main.file} />
        </ScrollBox>
      ) : null}

      <div style={{ marginTop: '1.25rem' }}>
        <StatStrip
          stats={[
            { value: int(program.metrics.lines), label: 'Source lines, all files' },
            { value: int(program.metrics.totalTokens), label: 'Tokens' },
            {
              value: program.metrics.graphNodes === null ? '—' : int(program.metrics.graphNodes),
              label: 'Graph nodes',
            },
            {
              value: program.metrics.artifact === null ? '—' : int(program.metrics.artifact.bytes),
              unit: program.metrics.artifact === null ? undefined : 'B',
              label: 'Artifact bytes',
            },
          ]}
        />
      </div>

      {/* --------------------------------------------------------- the panel */}

      <div id={panelId} style={{ marginTop: '2rem' }}>
        <h3 className="heading-20">
          <span className="mono" style={{ color: 'var(--text-tertiary)', marginRight: '0.5em' }}>
            {phase.n}
          </span>
          {phase.name}
        </h3>
        <p className="label" style={{ maxWidth: 'var(--measure)', margin: '0 0 1.5rem' }}>
          {phase.input} &rarr; {phase.output}. Carried by{' '}
          <span className="mono">{phase.zeroPhases.join(', ')}</span>.
        </p>

        {phase.id === 'lexical' ? <LexicalPanel program={program} /> : null}
        {phase.id === 'syntax' ? <SyntaxPanel program={program} /> : null}
        {phase.id === 'semantic' ? <SemanticPanel program={program} /> : null}
        {phase.id === 'ir' ? <IrPanel program={program} /> : null}
        {phase.id === 'optimize' ? <OptimizePanel program={program} /> : null}
        {phase.id === 'codegen' ? <CodegenPanel program={program} /> : null}
      </div>
    </section>
  )
}
