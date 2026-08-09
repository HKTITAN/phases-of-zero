/* Pipeline and loop diagrams.

   Four figures, all server components. Every one of them is built from semantic
   HTML boxes rather than hand-positioned SVG: the layouts reflow at 375px for
   free, the text stays selectable and searchable, and the reading order that
   assistive technology gets is the reading order a sighted reader gets. The only
   drawn marks are the connectors, and those are CSS borders — a 1px rule plus a
   rotated square for the arrowhead — so they scale with the box they sit under.

   Composition: each component's root is a plain <div>. None of them wraps itself
   in <figure>, so a page may put any of them inside <Figure> from components/charts
   without nesting figures. The page owns <h1>, sections own <h2>, so every heading
   below is an <h3>.

   Colour: only CSS variables, and never as the sole signal. A stage that does not
   exist on a path is a dashed box that says so in words; the accent appears once,
   on the relocation annotation and the repeat edge, always next to text naming it. */

import type { CSSProperties } from 'react'
import type { Capture, ErrorCase } from '@/lib/types'
import { CLASSICAL_PHASES, CROSS_CUTTING, phaseForCode } from '@/lib/phases'
import { Icon, PHASE_ICON, type IconName } from '@/components/icons'

/* ------------------------------------------------------------ shared atoms */

/* Visually hidden but present in the accessibility tree. Same technique the
   charts use for their fallback tables. */
const SR: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/* A stage that runs on this path. */
const NODE: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg-sunken)',
  padding: '0.5rem 0.625rem 0.5625rem',
  minWidth: 0,
  flex: '1 1 auto',
}

/* A stage that does not run on this path. Dashed outline, no fill, and the cell
   always carries text saying why — the border alone never has to carry it. */
const VOID_NODE: CSSProperties = {
  ...NODE,
  border: '1px dashed var(--border-strong)',
  background: 'transparent',
}

/* Downward flow arrow: a hairline with a rotated-square head. */
function Connector({ tone = 'solid' }: { tone?: 'solid' | 'dashed' }) {
  const ink = tone === 'dashed' ? 'var(--text-faint)' : 'var(--text-tertiary)'
  return (
    <span
      aria-hidden="true"
      style={{ display: 'block', position: 'relative', height: 18, flex: '0 0 auto' }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: 1,
          bottom: 6,
          width: 0,
          borderLeft: `1px ${tone} ${ink}`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 3,
          width: 6,
          height: 6,
          marginLeft: -3,
          borderRight: `1px solid ${ink}`,
          borderBottom: `1px solid ${ink}`,
          transform: 'rotate(45deg)',
        }}
      />
    </span>
  )
}

function StepIndex({ children }: { children: string }) {
  return (
    <span
      className="meta"
      style={{ display: 'block', color: 'var(--text-faint)', marginBottom: '0.125rem' }}
    >
      {children}
    </span>
  )
}

/* ============================================================== 1. compile path */

/* The two documented stage sequences, verbatim and in order. These arrays are the
   source of truth for both the diagram and the table below it. */
const TRAD_PATH = [
  'source files',
  'lexer/parser',
  'AST',
  'name resolution',
  'type checking',
  'IR lowering',
  'optimization',
  'codegen',
  'artifact',
] as const

const ZERO_PATH = [
  'zero.graph',
  'repository graph tables',
  'semantic validation',
  'type checking',
  'MIR and backend facts',
  'direct codegen',
  'artifact',
] as const

type PathCell =
  /* A stage that runs, carrying its 1-based index in its own sequence. */
  | { t: 'stage'; n: number; name: string; note?: string }
  /* This path has no stage in this slot. */
  | { t: 'void'; text: string }

type ZeroCell =
  | PathCell
  /* Slot 2 of the Zero column: the relocation annotation, spanning slots 2-4. */
  | { t: 'moved' }
  /* Slots 3 and 4 of the Zero column, covered by the spanning annotation. */
  | { t: 'covered' }

/* Slot-by-slot alignment of the two sequences. Slots where one side is `void` are
   the finding: three traditional stages have no Zero counterpart on this path, one
   more is folded away, and two Zero stages have no traditional counterpart. */
const ALIGN: { trad: PathCell; zero: ZeroCell }[] = [
  { trad: { t: 'stage', n: 1, name: 'source files' }, zero: { t: 'stage', n: 1, name: 'zero.graph' } },
  { trad: { t: 'stage', n: 2, name: 'lexer/parser' }, zero: { t: 'moved' } },
  { trad: { t: 'stage', n: 3, name: 'AST' }, zero: { t: 'covered' } },
  { trad: { t: 'stage', n: 4, name: 'name resolution' }, zero: { t: 'covered' } },
  {
    trad: { t: 'void', text: 'No counterpart. The parse-first path has no persisted store to read.' },
    zero: { t: 'stage', n: 2, name: 'repository graph tables', note: 'Read, not rebuilt.' },
  },
  {
    trad: { t: 'void', text: 'No counterpart. Nothing validates an edit before the front end runs.' },
    zero: { t: 'stage', n: 3, name: 'semantic validation', note: 'Rejects an invalid graph edit.' },
  },
  {
    trad: { t: 'stage', n: 5, name: 'type checking' },
    zero: { t: 'stage', n: 4, name: 'type checking', note: 'Over stored type facts.' },
  },
  {
    trad: { t: 'stage', n: 6, name: 'IR lowering' },
    zero: { t: 'stage', n: 5, name: 'MIR and backend facts', note: 'Contracts verified before emission.' },
  },
  {
    trad: { t: 'stage', n: 7, name: 'optimization' },
    zero: { t: 'void', text: 'Not a reported stage. Folded into lowering and codegen, selected by build profile.' },
  },
  {
    trad: { t: 'stage', n: 8, name: 'codegen' },
    zero: { t: 'stage', n: 6, name: 'direct codegen', note: 'Per-format emitters, no C bridge.' },
  },
  { trad: { t: 'stage', n: 9, name: 'artifact' }, zero: { t: 'stage', n: 7, name: 'artifact' } },
]

const LAST_SLOT = ALIGN.length - 1

/* Each stage gets the same glyph in both tracks, so a reader can match
   counterparts across the two columns by shape before reading a word — which is
   the comparison the figure exists to make. Keyed by stage name because the two
   sequences number their stages differently. */
const STAGE_ICON: Record<string, IconName> = {
  'source files': 'book',
  'zero.graph': 'graph',
  'lexer/parser': 'scan',
  'AST': 'tree',
  'name resolution': 'link',
  'repository graph tables': 'graph',
  'semantic validation': 'gate',
  'type checking': 'check',
  'IR lowering': 'layers',
  'MIR and backend facts': 'layers',
  'optimization': 'gauge',
  'codegen': 'chip',
  'direct codegen': 'chip',
  'artifact': 'bytes',
}

function PathNode({
  cell,
  track,
  prefix,
}: {
  cell: PathCell
  track: string
  prefix: string
}) {
  if (cell.t === 'void') {
    return (
      <span className="dia-node" style={VOID_NODE}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem' }}>
          <StepIndex>{'—'}</StepIndex>
          <span aria-hidden="true" style={{ color: 'var(--text-faint)', display: 'flex' }}>
            <Icon name="minus" size={14} />
          </span>
        </span>
        <span style={SR}>{track}: </span>
        <span className="label" style={{ display: 'block', color: 'var(--text-tertiary)', marginTop: '0.3125rem' }}>
          {cell.text}
        </span>
      </span>
    )
  }
  const icon = STAGE_ICON[cell.name]
  return (
    <span className="dia-node" style={NODE}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <StepIndex>{`${prefix}${cell.n}`}</StepIndex>
        {icon ? (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 999,
              background: 'var(--bg-sunken)', border: '1px solid var(--border-faint)',
              color: 'var(--text-secondary)', flexShrink: 0,
            }}
          >
            <Icon name={icon} size={15} />
          </span>
        ) : null}
        <span style={SR}>{track}, stage {cell.n}: </span>
        <span
          className="mono"
          style={{ fontSize: '0.8125rem', lineHeight: 1.3, color: 'var(--text)', minWidth: 0 }}
        >
          {cell.name}
        </span>
      </span>
      {cell.note ? (
        <span className="meta" style={{ display: 'block', marginTop: '0.375rem' }}>{cell.note}</span>
      ) : null}
    </span>
  )
}

export function CompilePathDiagram() {
  const maxLen = Math.max(TRAD_PATH.length, ZERO_PATH.length)

  return (
    <div className="dia dia-tall dia-keep-grid">
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            minWidth: 288,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            columnGap: '0.75rem',
            alignItems: 'stretch',
          }}
        >
          {/* Track headers occupy grid row 1; slot i therefore sits on row i + 2. */}
          <div style={{ gridRow: 1, gridColumn: 1, paddingBottom: '0.625rem' }}>
            <h3 className="heading-16" style={{ margin: 0 }}>Traditional parse-first path</h3>
            <p className="meta" style={{ margin: '0.1875rem 0 0' }}>
              as documented for Rust, Go, Zig, C · {TRAD_PATH.length} stages
            </p>
          </div>
          <div style={{ gridRow: 1, gridColumn: 2, paddingBottom: '0.625rem' }}>
            <h3 className="heading-16" style={{ margin: 0 }}>Zero graph-first path</h3>
            <p className="meta" style={{ margin: '0.1875rem 0 0' }}>
              Zero 0.3.4 package compilation · {ZERO_PATH.length} stages
            </p>
          </div>

          {/* Traditional column: every slot is occupied. */}
          {ALIGN.map((row, i) => (
            <div
              key={`t-${i}`}
              style={{
                gridRow: i + 2,
                gridColumn: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              <PathNode cell={row.trad} track="Traditional parse-first path" prefix="T" />
              {i < LAST_SLOT ? <Connector tone={row.trad.t === 'void' ? 'dashed' : 'solid'} /> : null}
            </div>
          ))}

          {/* Zero column. Slots 1-3 are replaced by one annotation spanning them. */}
          {ALIGN.map((row, i) => {
            if (row.zero.t === 'covered') return null
            if (row.zero.t === 'moved') {
              return (
                <div
                  key={`z-${i}`}
                  style={{
                    gridRow: `${i + 2} / span 3`,
                    gridColumn: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      border: '1px dashed var(--accent)',
                      borderRadius: 4,
                      background: 'var(--accent-quiet)',
                      padding: '0.625rem',
                      minWidth: 0,
                      flex: '1 1 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    {/* .pill sets white-space: nowrap, which cannot survive a
                        145px column at 375px. Let this one wrap. */}
                    <span
                      className="pill pill-accent"
                      style={{ alignSelf: 'flex-start', whiteSpace: 'normal', maxWidth: '100%' }}
                    >
                      moved off this path
                    </span>
                    <span style={SR}>Zero graph-first path: </span>
                    <span className="label" style={{ color: 'var(--text)' }}>
                      Lexing, parsing and name resolution run once, at the ingestion gate, when text
                      enters the graph. Package compilation reads a binary store, so none of the three
                      stages at left runs here.
                    </span>
                    <span className="meta" style={{ color: 'var(--accent-text)' }}>
                      probe: zero import · zero parse --json
                    </span>
                  </span>
                  <Connector tone="dashed" />
                </div>
              )
            }
            return (
              <div
                key={`z-${i}`}
                style={{
                  gridRow: i + 2,
                  gridColumn: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                }}
              >
                <PathNode cell={row.zero} track="Zero graph-first path" prefix="Z" />
                {i < LAST_SLOT ? <Connector tone={row.zero.t === 'void' ? 'dashed' : 'solid'} /> : null}
              </div>
            )
          })}
        </div>
      </div>

      <p className="caption">
        Both tracks read top to bottom. Slots are aligned, so a dashed box marks a stage one path has
        and the other does not: three traditional stages leave the Zero build path entirely, one more
        (optimization) is folded into two others, and two Zero stages have no traditional counterpart.
        Stage labels are the documented names, unabbreviated.
      </p>

      <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
        <table>
          <caption>
            Text alternative to the diagram above: the two compile paths as ordered stage sequences,
            {' '}{TRAD_PATH.length} stages against {ZERO_PATH.length}. Rows are positional only — row{' '}
            <span className="num">n</span> holds stage <span className="num">n</span> of each sequence
            and does not assert a correspondence between them. {'—'} means the sequence has ended. No
            units; this table is definitional.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="n">#</th>
              <th scope="col" className="wrap">Traditional parse-first stage</th>
              <th scope="col" className="wrap">Zero graph-first stage</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxLen }, (_, i) => (
              <tr key={i}>
                <th scope="row" className="n num">{i + 1}</th>
                <td className="wrap mono">{TRAD_PATH[i] ?? '—'}</td>
                <td className="wrap mono">{ZERO_PATH[i] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================ 2. agent loops */

const TRAD_LOOP: { step: string; note: string }[] = [
  { step: 'agent writes text', note: 'Free-form source. Nothing has checked it yet.' },
  { step: 'check', note: 'Re-lexes and re-parses every file it touches.' },
  { step: 'format', note: 'A second full pass over the same text.' },
  { step: 'build', note: 'A third pass, then lowering and codegen.' },
  { step: 'inspect failures', note: 'Diagnostics arrive as prose to be read and guessed at.' },
]

const ZERO_LOOP: { step: string; note: string }[] = [
  { step: 'agent queries graph', note: 'Reads stored facts. There is no text to parse.' },
  { step: 'agent submits checked patch', note: 'A graph edit addressed by node handle, not a file write.' },
  {
    step: 'compiler rejects invalid graph edits immediately',
    note: 'The store never holds a state that would fail later.',
  },
  { step: 'agent runs only task validation', note: 'What the task needs, not the whole toolchain.' },
  { step: 'human reviews projection when useful', note: 'Text is a rendering of the graph, not its source.' },
]

/* The connector lives inside the <li> so the <ol> has none but list items as
   children — a flow arrow is part of the step it leaves, not a sibling of it. */
function LoopStep({
  n,
  step,
  note,
  connect,
}: {
  n: number
  step: string
  note: string
  connect: boolean
}) {
  return (
    <li style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span className="dia-node" style={NODE}>
        <StepIndex>{`step ${n}`}</StepIndex>
        <span
          className="mono"
          style={{ display: 'block', fontSize: '0.8125rem', lineHeight: 1.35 }}
        >
          {step}
        </span>
        <span className="meta" style={{ display: 'block', marginTop: '0.25rem' }}>{note}</span>
      </span>
      {connect ? <Connector /> : null}
    </li>
  )
}

export function AgentLoopDiagram() {
  const RAIL = 30
  const GUTTER: CSSProperties = { position: 'relative', paddingLeft: RAIL + 6 }
  const LIST: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }

  return (
    <div className="dia dia-tall">
      <div className="grid-2">
        {/* ------------------------------------------------ traditional: a cycle */}
        <section>
          <h3 className="heading-16" style={{ margin: 0 }}>Traditional agent source loop</h3>
          <p className="meta" style={{ margin: '0.1875rem 0 0.875rem' }}>
            a cycle · {TRAD_LOOP.length} steps · repeats until the build passes
          </p>

          <div style={GUTTER}>
            {/* The return edge: a bracket down the left, arrowhead into step 1. */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                top: 16,
                bottom: 18,
                width: RAIL,
                borderLeft: '1px solid var(--accent)',
                borderTop: '1px solid var(--accent)',
                borderBottom: '1px solid var(--accent)',
                borderRadius: '3px 0 0 3px',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: RAIL - 5,
                top: 13,
                width: 6,
                height: 6,
                borderTop: '1px solid var(--accent)',
                borderRight: '1px solid var(--accent)',
                transform: 'rotate(45deg)',
              }}
            />
            <span
              aria-hidden="true"
              className="meta"
              style={{
                position: 'absolute',
                left: 7,
                top: '50%',
                transform: 'translateY(-50%) rotate(180deg)',
                writingMode: 'vertical-rl',
                color: 'var(--accent-text)',
                background: 'var(--bg)',
                padding: '0.25rem 0',
                letterSpacing: '0.04em',
              }}
            >
              repeat
            </span>

            <ol style={LIST}>
              {TRAD_LOOP.map((s, i) => (
                <LoopStep
                  key={s.step}
                  n={i + 1}
                  step={s.step}
                  note={s.note}
                  connect={i < TRAD_LOOP.length - 1}
                />
              ))}
            </ol>
          </div>

          <p className="caption">
            After step {TRAD_LOOP.length} the loop returns to step 1: <span className="mono">(repeat)</span>.
            Every pass re-derives the same tokens, the same tree and the same bindings from text that
            has already been read, and the agent only learns an edit was invalid at the end of the pass.
          </p>
        </section>

        {/* ----------------------------------------------- zero: linear, terminating */}
        <section>
          <h3 className="heading-16" style={{ margin: 0 }}>Zero graph loop</h3>
          <p className="meta" style={{ margin: '0.1875rem 0 0.875rem' }}>
            largely linear · {ZERO_LOOP.length} steps · terminates
          </p>

          <div style={GUTTER}>
            {/* Same gutter width as the left track, deliberately holding no return
                edge. The absence is the point, so it is labelled in words. */}
            <span
              aria-hidden="true"
              className="meta"
              style={{
                position: 'absolute',
                left: 7,
                top: '50%',
                transform: 'translateY(-50%) rotate(180deg)',
                writingMode: 'vertical-rl',
                color: 'var(--text-faint)',
                letterSpacing: '0.04em',
              }}
            >
              no repeat
            </span>

            <ol style={LIST}>
              {ZERO_LOOP.map((s, i) => (
                <LoopStep
                  key={s.step}
                  n={i + 1}
                  step={s.step}
                  note={s.note}
                  connect={i < ZERO_LOOP.length - 1}
                />
              ))}
            </ol>

            <Connector />
            {/* Terminal bar. A stop, not another step, so it is not in the list. */}
            <p
              style={{
                margin: 0,
                borderBottom: '2px solid var(--border-strong)',
                paddingBottom: '0.5rem',
              }}
            >
              <span className="label" style={{ color: 'var(--text)' }}>
                Terminates. No edge back to step 1.
              </span>
            </p>
          </div>

          <p className="caption">
            There is no <span className="mono">(repeat)</span> edge. An invalid edit is refused at step 3,
            at submission time, rather than discovered at the end of a build; the store therefore never
            holds a state the next pass would have to find and undo.
          </p>
        </section>
      </div>
    </div>
  )
}

/* ================================================================== 3. gates */

type GateId = 'import' | 'check' | 'build'

const GATES: { id: GateId; command: string; role: string; checks: string[] }[] = [
  {
    id: 'import',
    command: 'zero import',
    role: 'Front end',
    checks: ['lexical', 'syntax', 'name resolution', 'type', 'mutability', 'effect', 'memory'],
  },
  {
    id: 'check',
    command: 'zero check --target',
    role: 'Target capability',
    checks: ['target capability'],
  },
  {
    id: 'build',
    command: 'zero build',
    role: 'MIR lowering',
    checks: ['MIR lowering'],
  },
]

function gateDiagnostics(e: ErrorCase, gate: GateId) {
  if (gate === 'import') return e.importDiagnostics
  if (gate === 'check') return e.checkDiagnostics
  return e.buildDiagnostics
}

/* Codes are read off the diagnostics the gate itself emitted; `codes` is the
   union across all three gates, so it is only the fallback when a gate rejected a
   case without attaching a diagnostic of its own. Duplicates within one case are
   collapsed, so a count is a count of cases, not of diagnostic lines. */
function gateCodes(cases: ErrorCase[], gate: GateId) {
  const tally = new Map<string, number>()
  for (const e of cases) {
    const own = gateDiagnostics(e, gate).map((d) => d.code).filter(Boolean)
    for (const code of new Set(own.length > 0 ? own : e.codes)) {
      tally.set(code, (tally.get(code) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([code, count]) => ({ code, count, label: phaseForCode(code).label }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

export function GateDiagram({ capture }: { capture: Capture }) {
  const cases = capture.errorCases

  /* The population entering gate n is everything not already turned away by
     gates 1..n-1, so each gate's figures are a running subtraction over the
     corpus rather than a hardcoded funnel. */
  const turnedAway = GATES.map((g) => cases.filter((e) => e.rejectedAt === g.id))
  const gates = GATES.map((g, i) => {
    const rejected = turnedAway[i]
    const before = turnedAway.slice(0, i).reduce((n, r) => n + r.length, 0)
    const entered = cases.length - before
    return {
      ...g,
      ordinal: i + 1,
      entered,
      rejected: rejected.length,
      continued: entered - rejected.length,
      codes: gateCodes(rejected, g.id),
      next: GATES[i + 1]?.command ?? 'artifact',
    }
  })
  const reachedArtifact = cases.length - turnedAway.reduce((n, r) => n + r.length, 0)

  return (
    <div className="dia dia-tall">
      <p className="label" style={{ marginBottom: '0.75rem' }}>
        <span className="num">{cases.length}</span> deliberately malformed programs enter at the left.
        Each gate admits what it cannot fault and turns the rest away downward.
      </p>

      <div
        style={{
          display: 'grid',
          /* 188px keeps all three gates on one row down to roughly 680px, so a
             tablet still reads the funnel left to right. Below that they stack,
             and each rejected branch stays directly under its own gate. */
          gridTemplateColumns: 'repeat(auto-fit, minmax(188px, 1fr))',
          gap: '0.875rem',
          alignItems: 'start',
        }}
      >
        {gates.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ ...NODE, flex: '0 0 auto' }}>
              <StepIndex>{`gate ${g.ordinal} of ${gates.length}`}</StepIndex>
              <h3 className="heading-16 mono" style={{ margin: '0 0 0.125rem', fontSize: '0.875rem' }}>
                {g.command}
              </h3>
              <p className="label" style={{ margin: '0 0 0.5rem' }}>{g.role}</p>

              <ul
                style={{
                  listStyle: 'none',
                  margin: '0 0 0.625rem',
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                }}
              >
                {g.checks.map((c) => (
                  <li className="pill" key={c}>{c}</li>
                ))}
              </ul>

              <dl
                style={{
                  margin: 0,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  rowGap: '0.1875rem',
                  columnGap: '0.5rem',
                  borderTop: '1px solid var(--border-faint)',
                  paddingTop: '0.5rem',
                }}
              >
                <dt className="meta">entered</dt>
                <dd className="mono num" style={{ margin: 0, fontSize: '0.75rem', textAlign: 'right' }}>
                  {g.entered}
                </dd>
                <dt className="meta">rejected here</dt>
                <dd className="mono num" style={{ margin: 0, fontSize: '0.75rem', textAlign: 'right' }}>
                  {g.rejected}
                </dd>
                <dt className="meta" style={{ color: 'var(--text-secondary)' }}>
                  continue to {g.next}
                </dt>
                <dd
                  className="mono num"
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    textAlign: 'right',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {g.continued}
                </dd>
              </dl>
            </div>

            <Connector tone={g.rejected > 0 ? 'solid' : 'dashed'} />

            <div style={{ ...VOID_NODE, flex: '1 1 auto' }}>
              <span className="label" style={{ display: 'block', color: 'var(--text)' }}>
                Rejected: <span className="num">{g.rejected}</span> of{' '}
                <span className="num">{g.entered}</span>
              </span>
              {g.codes.length === 0 ? (
                <p className="meta" style={{ margin: '0.375rem 0 0' }}>
                  No case in the corpus is turned away here.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: '0.4375rem 0 0', padding: 0, display: 'grid', gap: '0.25rem' }}>
                  {g.codes.map((c) => (
                    <li key={c.code} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                        {c.code}
                      </span>
                      <span className="meta" style={{ flex: '1 1 auto', minWidth: 0 }}>{c.label}</span>
                      <span className="mono num" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {'×'}{c.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="caption">
        Counts and codes are derived at render time from{' '}
        <span className="mono">capture.errorCases</span>: a case is attributed to the gate its{' '}
        <span className="mono">rejectedAt</span> field names, and the codes are the diagnostics that
        gate itself emitted. <span className="num">{reachedArtifact}</span> of{' '}
        <span className="num">{cases.length}</span> malformed programs reach an artifact. On a narrow
        screen the gates stack, so the left-to-right flow becomes top to bottom; the rejected branch
        stays directly beneath its gate either way.
      </p>

      <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
        <table>
          <caption>
            Text alternative to the diagram above: the three admission gates in order, with the
            population entering each, the number it rejected, the number it passed on, and the
            diagnostic codes it rejected them with. Population: the{' '}
            <span className="num">{cases.length}</span> error-corpus programs. Counts are programs, not
            diagnostic lines.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="n">#</th>
              <th scope="col">Gate</th>
              <th scope="col" className="wrap">Checks</th>
              <th scope="col" className="n">Entered</th>
              <th scope="col" className="n">Rejected</th>
              <th scope="col" className="n">Continued</th>
              <th scope="col" className="wrap">Codes rejected with</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((g) => (
              <tr key={g.id}>
                <th scope="row" className="n num">{g.ordinal}</th>
                <td className="mono">{g.command}</td>
                <td className="wrap">{g.checks.join(', ')}</td>
                <td className="n num">{g.entered}</td>
                <td className="n num">{g.rejected}</td>
                <td className="n num">{g.continued}</td>
                <td className="wrap mono">
                  {g.codes.length === 0
                    ? '—'
                    : g.codes.map((c) => `${c.code} ×${c.count}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>Reached an artifact</th>
              <td className="n num">{'—'}</td>
              <td className="n num">{reachedArtifact}</td>
              <td className="wrap">{'—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ====================================================== 4. phase relocation */

const LOCUS_NOTE: Record<string, string> = {
  ingestion: 'Runs at the ingestion gate only.',
  'compile-path': 'Runs on the compile path only.',
  both: 'Runs at both: admitted at ingestion, re-consulted from stored facts on the compile path.',
}

function PhaseGroup({
  heading,
  command,
  cadence,
  rationale,
  phases,
}: {
  heading: string
  command: string
  cadence: string
  rationale: string
  phases: typeof CLASSICAL_PHASES
}) {
  return (
    <section style={{ position: 'relative', paddingLeft: '0.75rem' }}>
      {/* The bracket the textbook draws around a group of phases. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 2,
          bottom: 2,
          width: 4,
          borderLeft: '2px solid var(--border-strong)',
          borderTop: '2px solid var(--border-strong)',
          borderBottom: '2px solid var(--border-strong)',
          borderRadius: '3px 0 0 3px',
        }}
      />
      <h3 className="heading-16" style={{ margin: 0 }}>{heading}</h3>
      <p className="meta" style={{ margin: '0.1875rem 0 0.75rem' }}>
        <span className="mono">{command}</span> · {cadence}
      </p>

      {/* Numbering is the classical phase number, so the list starts where the
          group starts rather than at 1. */}
      <ol start={phases[0]?.n} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {phases.map((p, i) => (
          <li key={p.id} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="dia-node" style={NODE}>
              {/* The glyph carries the phase before the words do; the same mark
                  identifies this phase everywhere else in the paper. */}
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5625rem' }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Icon name={PHASE_ICON[p.id] ?? 'info'} size={16} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <StepIndex>{`phase ${p.n}`}</StepIndex>
                  <span className="heading-16" style={{ display: 'block', margin: 0, fontSize: '0.875rem' }}>
                    {p.name}
                  </span>
                </span>
              </span>
              <span className="meta" style={{ display: 'block', marginTop: '0.375rem' }}>
                {p.input} {'→'} {p.output}
              </span>
              <span
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  marginTop: '0.4375rem',
                }}
              >
                {p.zeroPhases.map((z) => (
                  <span className="pill" key={z}>{z}</span>
                ))}
                <span className="pill" style={{ borderStyle: 'dashed' }}>locus: {p.locus}</span>
              </span>
              {p.locus === 'both' ? (
                <span className="meta" style={{ display: 'block', marginTop: '0.375rem' }}>
                  {LOCUS_NOTE[p.locus]}
                </span>
              ) : null}
            </span>
            {i < phases.length - 1 ? <Connector /> : null}
          </li>
        ))}
      </ol>

      <p className="caption" style={{ marginTop: '0.625rem' }}>{rationale}</p>
    </section>
  )
}

export function PhaseRelocationDiagram() {
  const ingestion = CLASSICAL_PHASES.filter((p) => p.n <= 3)
  const compilePath = CLASSICAL_PHASES.filter((p) => p.n >= 4)

  return (
    <div className="dia dia-tall">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', alignItems: 'stretch' }}>
        {/* The stack: six classical phases, drawn once, split at the admission
            boundary rather than duplicated per path. */}
        {/* A 560px basis is wide enough that the stack takes its own flex line
            before either bar has to shrink below reading width; the two bars then
            sit side by side beneath it, and only below ~460px do they stack too. */}
        <div style={{ flex: '3 1 560px', minWidth: 0, display: 'grid', gap: '0.875rem' }}>
          <PhaseGroup
            heading="Phases 1–3 · at the ingestion gate"
            command="zero import"
            cadence="once per edit"
            rationale="These three run when text enters the graph and are not re-run to produce a build. Phase 3 is the boundary case: it is admitted here and then re-consulted on the compile path from stored symbol, type and scope tables rather than rebuilt."
            phases={ingestion}
          />

          {/* The admission boundary itself. */}
          <div
            style={{
              borderTop: '1px dashed var(--border-strong)',
              paddingTop: '0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <span className="label" style={{ color: 'var(--text)' }}>The admission boundary</span>
            <span className="meta">
              above: once per edit · below: once per build
            </span>
          </div>

          <PhaseGroup
            heading="Phases 4–6 · on the compile path"
            command="zero build"
            cadence="once per build"
            rationale="These three are what a build actually costs. They read a graph whose names are already bound and whose types are already recorded, which is why the compile path can begin at lowering."
            phases={compilePath}
          />
        </div>

        {/* The two vertical bars the textbook draws beside the stack. */}
        {CROSS_CUTTING.map((c) => (
          <section
            key={c.id}
            style={{
              flex: '1 1 200px',
              minWidth: 0,
              border: '1px solid var(--border)',
              borderTop: '2px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--bg-sunken)',
              padding: '0.75rem 0.75rem 0.875rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
            }}
          >
            <div>
              <StepIndex>cross-cutting · spans phases 1–6</StepIndex>
              <h3 className="heading-16" style={{ margin: 0 }}>{c.name}</h3>
            </div>

            <div>
              <p className="label" style={{ margin: '0 0 0.1875rem', color: 'var(--text-tertiary)' }}>
                Classical
              </p>
              <p className="label" style={{ margin: 0 }}>{c.classical}</p>
            </div>

            <div>
              <p className="label" style={{ margin: '0 0 0.1875rem', color: 'var(--text-tertiary)' }}>
                As Zero realises it
              </p>
              <p className="label" style={{ margin: 0, color: 'var(--text)' }}>{c.zero}</p>
            </div>

            <p className="meta" style={{ margin: 'auto 0 0', paddingTop: '0.5rem', borderTop: '1px solid var(--border-faint)' }}>
              probe: {c.probe}
            </p>
          </section>
        ))}
      </div>

      <p className="caption">
        The classical six-phase stack, drawn once. The split is not a redrawing of the phases but a
        statement about cadence: phases 1–3 are paid when an edit is admitted, phases 4–6 when an
        artifact is requested. The two panels are the cross-cutting concerns the textbook draws as
        vertical bars beside the stack; in Zero both are persisted and directly inspectable, which is
        why the split above is observable rather than asserted. Phase numbering, input/output pairs,
        Zero phase names and locus values are read from{' '}
        <span className="mono">lib/phases.ts</span>. On a narrow screen the two bars move underneath
        the stack rather than beside it.
      </p>
    </div>
  )
}
