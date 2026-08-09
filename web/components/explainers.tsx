'use client'

/* Two interactive exhibits. Both are evidence, not illustration: every state
   either component can display is read straight out of data/capture.json, and
   where the capture reports nothing the panel says so rather than filling in.

   1. GateWalkthrough — one malformed program at a time, walked past the three
      admission gates (import, check, build), showing which gate turned it away
      and the structured diagnostic that gate emitted.
   2. PhaseCostExplainer — one program at a time, showing the eight phase times
      the compiler reports and the size of the IR that lowering produced, against
      the whole corpus.

   Heading contract: the page owns <h1> and its sections own <h2>, so each
   component here opens at <h3> and nests downward from there. */

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  Capture, CompilerPhase, CorpusEntry, Diagnostic, ErrorCase,
} from '@/lib/types'
import { phaseForCode } from '@/lib/phases'
import { Figure, StatStrip } from '@/components/charts'
import { ZeroCode } from '@/components/zero-code'

/* ------------------------------------------------------------- formatting */

const DASH = '—'
const int = (n: number) => n.toLocaleString('en-US')

/* `backend.size` mirrors the compiler's own --json payload, so it is typed as an
   open record. Narrow the one field this file reads instead of asserting it. */
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function loweredIrBytes(program: CorpusEntry): number | null {
  return asNumber(program.backend.size?.loweredIrBytes)
}

/* `phases.coldTimed` comes from a cold run driven through emission, so it
   attributes lowering cost. `phases.cold` comes from `check`, which can return
   before lowering finishes — used only if the timed run captured nothing. */
function timedPhases(program: CorpusEntry): CompilerPhase[] {
  return program.phases.coldTimed.length > 0 ? program.phases.coldTimed : program.phases.cold
}

/* ---------------------------------------------------------------- controls */

const choiceBase: CSSProperties = {
  font: 'inherit',
  fontSize: '0.8125rem',
  lineHeight: 1.3,
  color: 'var(--text)',
  border: '1px solid',
  borderRadius: 4,
  padding: '0.375rem 0.5625rem',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '0.0625rem',
  maxWidth: '100%',
}

/* Selection is carried by weight, border colour, background and aria-pressed
   together, so it survives grayscale, forced colours and screen readers. */
function ChoiceButton({
  pressed, onClick, controls, label, primary, secondary,
}: {
  pressed: boolean
  onClick: () => void
  controls: string
  label: string
  primary: string
  secondary: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-controls={controls}
      aria-label={label}
      style={{
        ...choiceBase,
        fontWeight: pressed ? 560 : 460,
        background: pressed ? 'var(--bg-raised)' : 'transparent',
        borderColor: pressed ? 'var(--text)' : 'var(--border)',
      }}
    >
      <span className="mono" style={{ fontSize: '0.75rem' }}>{primary}</span>
      <span
        className="meta"
        style={{ color: pressed ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
      >
        {secondary}
      </span>
    </button>
  )
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-strong)',
        borderLeftWidth: 3,
        borderLeftColor: 'var(--accent)',
        borderRadius: 6,
        background: 'var(--bg-raised)',
        padding: '0.9375rem 1rem',
      }}
    >
      {children}
    </div>
  )
}

/* ==========================================================================
   1. Gate walkthrough
   ======================================================================== */

type GateKey = 'import' | 'check' | 'build'

const GATES: { key: GateKey; n: number; command: string; role: string }[] = [
  {
    key: 'import',
    n: 1,
    command: 'zero import',
    role:
      'Admits text into the graph. Scanning, parsing, name binding, type, effect and ' +
      'frame-budget checking all run here, before anything is written to zero.graph.',
  },
  {
    key: 'check',
    n: 2,
    command: 'zero check',
    role:
      'Re-checks the stored graph and reports target readiness alongside a top-level verdict.',
  },
  {
    key: 'build',
    n: 3,
    command: 'zero build',
    role: 'Lowers the checked graph to MIR and emits an artifact for the selected target.',
  },
]

type GateStatus = 'passed' | 'rejected' | 'not reached'

function gateStatus(ok: boolean | null): GateStatus {
  if (ok === null) return 'not reached'
  return ok ? 'passed' : 'rejected'
}

function gateVerdict(c: ErrorCase, key: GateKey): boolean | null {
  if (key === 'import') return c.importOk
  if (key === 'check') return c.checkOk
  return c.buildOk
}

function gateDiagnostics(c: ErrorCase, key: GateKey): Diagnostic[] {
  if (key === 'import') return c.importDiagnostics
  if (key === 'check') return c.checkDiagnostics
  return c.buildDiagnostics
}

/* The status word is the signal. The pill and the marker glyph repeat it in
   shape and weight; neither is load-bearing on its own. */
function StatusPill({ status }: { status: GateStatus }) {
  const accent = status === 'rejected'
  return (
    <span
      className={accent ? 'pill pill-accent' : 'pill'}
      style={accent ? undefined : { color: status === 'passed' ? 'var(--text-secondary)' : 'var(--text-faint)' }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: status === 'passed' ? '50%' : 1,
          background: accent ? 'currentColor' : 'transparent',
          border: '1px solid currentColor',
          display: 'inline-block',
        }}
      />
      {status}
    </span>
  )
}

function FieldRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="label" style={{ color: 'var(--text-tertiary)', margin: 0 }}>{term}</dt>
      <dd style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</dd>
    </>
  )
}

function DiagnosticDetail({ d }: { d: Diagnostic }) {
  const phase = phaseForCode(d.code)
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 5,
        background: 'var(--bg-sunken)',
        padding: '0.75rem 0.875rem',
      }}
    >
      <p className="meta" style={{ margin: '0 0 0.25rem' }}>
        {d.severity} · <span style={{ color: 'var(--text)' }}>{d.code}</span> · {phase.label}
      </p>
      <p className="heading-16" style={{ margin: '0 0 0.625rem' }}>{d.message}</p>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(4.5rem, auto) minmax(0, 1fr)',
          columnGap: '0.75rem',
          rowGap: '0.3125rem',
          margin: 0,
          fontSize: '0.8125rem',
        }}
      >
        <FieldRow term="Location">
          <span className="mono" style={{ fontSize: '0.75rem' }}>
            {d.path}:{d.line}:{d.column}
          </span>
        </FieldRow>
        {d.expected ? (
          <FieldRow term="Expected">
            <span className="mono" style={{ fontSize: '0.75rem' }}>{d.expected}</span>
          </FieldRow>
        ) : null}
        {d.actual ? (
          <FieldRow term="Actual">
            <span className="mono" style={{ fontSize: '0.75rem' }}>{d.actual}</span>
          </FieldRow>
        ) : null}
        {d.help ? <FieldRow term="Help">{d.help}</FieldRow> : null}
        {d.fixSafety ? (
          <FieldRow term="Fix safety">
            <span className="mono" style={{ fontSize: '0.75rem' }}>{d.fixSafety}</span>
          </FieldRow>
        ) : null}
        {d.repair ? (
          <FieldRow term="Repair">
            <span className="mono" style={{ fontSize: '0.75rem' }}>{d.repair.id}</span>
            {' — '}
            {d.repair.summary}
          </FieldRow>
        ) : null}
        {d.related && d.related.length > 0 ? (
          <FieldRow term="Related">
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {d.related.map((r, i) => (
                <li key={`${r.path}:${r.line}:${r.column}:${i}`}>
                  <span className="mono" style={{ fontSize: '0.75rem' }}>
                    {r.path}:{r.line}:{r.column}
                  </span>{' '}
                  {r.message}
                </li>
              ))}
            </ul>
          </FieldRow>
        ) : null}
      </dl>
    </div>
  )
}

function GateCard({
  gate, status, rejectedHere, ranAfterRejection, diagnostics, children,
}: {
  gate: (typeof GATES)[number]
  status: GateStatus
  rejectedHere: boolean
  ranAfterRejection: boolean
  diagnostics: Diagnostic[]
  children?: ReactNode
}) {
  return (
    <li
      style={{
        border: '1px solid',
        borderColor: rejectedHere ? 'var(--border-strong)' : 'var(--border-faint)',
        borderRadius: 6,
        background: 'var(--bg-raised)',
        padding: '0.875rem 1rem 1rem',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
          justifyContent: 'space-between', gap: '0.5rem',
        }}
      >
        <h6 className="heading-16" style={{ margin: 0 }}>
          <span className="mono" style={{ color: 'var(--text-tertiary)', marginRight: '0.4em' }}>
            {gate.n}
          </span>
          <span className="mono">{gate.command}</span>
        </h6>
        <StatusPill status={status} />
      </div>

      <p className="caption" style={{ marginTop: '0.4375rem' }}>{gate.role}</p>

      {rejectedHere ? (
        <p className="label" style={{ margin: '0.625rem 0 0', color: 'var(--text)' }}>
          This is the gate that turned the program away.
        </p>
      ) : null}
      {ranAfterRejection ? (
        <p className="caption" style={{ marginTop: '0.375rem' }}>
          Ran after the earlier rejection, so it judged the graph as it then stood, not the
          submitted text.
        </p>
      ) : null}

      {children}

      {diagnostics.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.625rem', marginTop: '0.75rem' }}>
          {diagnostics.map((d, i) => (
            <DiagnosticDetail key={`${d.code}-${d.line}-${d.column}-${i}`} d={d} />
          ))}
        </div>
      ) : (
        <p className="caption" style={{ marginTop: '0.625rem' }}>
          No diagnostic recorded at this gate.
        </p>
      )}
    </li>
  )
}

function boolWord(v: boolean | null): string {
  return v === null ? DASH : String(v)
}

export function GateWalkthrough({ capture }: { capture: Capture }) {
  const cases = capture.errorCases
  const [caseId, setCaseId] = useState<string>(() => cases[0]?.id ?? '')

  const selected = useMemo(
    () => cases.find((c) => c.id === caseId) ?? cases[0],
    [cases, caseId],
  )

  const panelId = 'gate-walkthrough-panel'

  if (!selected) {
    return (
      <p className="body">
        This capture carries no error corpus, so there are no rejections to walk through.
      </p>
    )
  }

  const rejectedIndex = GATES.findIndex((g) => g.key === selected.rejectedAt)

  return (
    <section aria-labelledby="gate-walkthrough-title">
      <h3 className="heading-20" id="gate-walkthrough-title">
        Which gate stopped it, and what it said
      </h3>
      <p className="body" style={{ maxWidth: 'var(--measure)', marginBottom: '1.25rem' }}>
        Pick one of the {cases.length} deliberately malformed programs. Zero offers three places
        to refuse it — admitting text into the graph, checking the stored graph, and building an
        artifact — and each panel below reports what that gate actually returned for this case.
      </p>

      <div
        role="group"
        aria-labelledby="gate-walkthrough-choose"
        style={{ marginBottom: '1.5rem' }}
      >
        <p className="label" id="gate-walkthrough-choose" style={{ margin: '0 0 0.5rem' }}>
          Error case
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {cases.map((c) => (
            <ChoiceButton
              key={c.id}
              pressed={c.id === selected.id}
              onClick={() => setCaseId(c.id)}
              controls={panelId}
              label={`Case ${c.id}, targets ${c.phase ?? 'no declared phase'}`}
              primary={c.id}
              secondary={c.phase ?? 'no declared phase'}
            />
          ))}
        </div>
      </div>

      <div id={panelId}>
        <h4 className="heading-20" style={{ marginBottom: '0.375rem' }}>
          <span className="mono">{selected.id}</span>
        </h4>
        <p className="body" style={{ maxWidth: 'var(--measure)', margin: '0 0 0.625rem' }}>
          {selected.intent ?? 'The capture records no stated intent for this case.'}
        </p>
        <p className="meta" style={{ margin: '0 0 1.25rem' }}>
          targets phase {selected.phase ?? DASH} · expected code{' '}
          {selected.expectedCode ?? DASH} · target {selected.target ?? 'host default'} · rejected at{' '}
          {selected.rejectedAt} · codes {selected.codes.length > 0 ? selected.codes.join(', ') : DASH}
        </p>

        {selected.checkKnewButReportedOk ? (
          <div style={{ margin: '0 0 1.5rem' }}>
            <Callout>
              <h5 className="heading-16" style={{ margin: '0 0 0.5rem' }}>
                One payload, two verdicts: check reported ok true and buildable false at the same
                time
              </h5>
              <div
                className="mono"
                style={{
                  fontSize: '0.8125rem', display: 'grid', gap: '0.1875rem',
                  margin: '0 0 0.625rem', overflowWrap: 'anywhere',
                }}
              >
                <span>ok: {boolWord(selected.checkTopLevelOk)}</span>
                <span>targetReadiness.ok: {boolWord(selected.checkReadinessOk)}</span>
                <span>targetReadiness.buildable: {boolWord(selected.checkReadinessBuildable)}</span>
                <span>targetReadiness.stage: {selected.checkReadinessStage ?? DASH}</span>
              </div>
              <p className="body" style={{ maxWidth: 'var(--measure)', margin: 0 }}>
                A tool that reads only the top-level <span className="mono">ok</span> field
                concludes this program is fine and proceeds to build it. The nested{' '}
                <span className="mono">targetReadiness</span> block, in the same JSON object,
                already names <span className="mono">{selected.checkReadinessStage ?? DASH}</span>{' '}
                as the phase that will refuse it, and carries{' '}
                {selected.readinessDiagnostics.length === 1
                  ? 'the diagnostic'
                  : `${int(selected.readinessDiagnostics.length)} diagnostics`}{' '}
                in full. The build then fails exactly as the readiness block said it would. The
                checker knew; the headline verdict did not say so.
              </p>
            </Callout>
          </div>
        ) : null}

        <h5 className="heading-16">Source as submitted</h5>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {selected.sources.map((s) => (
            <ZeroCode
              key={s.file}
              src={s.text}
              file={s.file}
              meta={`${int(s.lines)} lines · ${int(s.bytes)} B`}
            />
          ))}
        </div>

        <details style={{ marginTop: '0.75rem' }}>
          <summary className="label" style={{ cursor: 'pointer' }}>
            Graph store after the attempt — storeContaminated: {String(selected.storeContaminated)}
          </summary>
          <div style={{ marginTop: '0.625rem' }}>
            <p className="caption" style={{ marginTop: 0 }}>
              The <span className="mono">src/main.0</span> that{' '}
              <span className="mono">zero.graph</span> held once the attempt finished. Where a case
              is rejected at import, the malformed text never reaches the store, so this is the
              previous good program.
            </p>
            <ZeroCode src={selected.storedMain} file="stored src/main.0" />
          </div>
        </details>

        <h5 className="heading-16" style={{ marginTop: '1.75rem' }}>Three gates, in order</h5>
        <ol
          style={{
            listStyle: 'none', margin: '0 0 0.625rem', padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 19rem), 1fr))',
            gap: '0.75rem',
            alignItems: 'start',
          }}
        >
          {GATES.map((gate, i) => {
            const verdict = gateVerdict(selected, gate.key)
            return (
              <GateCard
                key={gate.key}
                gate={gate}
                status={gateStatus(verdict)}
                rejectedHere={selected.rejectedAt === gate.key}
                ranAfterRejection={rejectedIndex >= 0 && i > rejectedIndex && verdict !== null}
                diagnostics={gateDiagnostics(selected, gate.key)}
              >
                {gate.key === 'check' ? (
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.75rem', display: 'grid', gap: '0.125rem',
                      marginTop: '0.625rem', color: 'var(--text-secondary)',
                    }}
                  >
                    <span>ok: {boolWord(selected.checkTopLevelOk)}</span>
                    <span>targetReadiness.ok: {boolWord(selected.checkReadinessOk)}</span>
                    <span>
                      targetReadiness.buildable: {boolWord(selected.checkReadinessBuildable)}
                    </span>
                    <span>targetReadiness.stage: {selected.checkReadinessStage ?? DASH}</span>
                  </div>
                ) : null}
              </GateCard>
            )
          })}
        </ol>

        <div className="table-wrap">
          <table>
            <caption>
              The same three verdicts as a table, for the case shown above. Values are the raw{' '}
              <span className="mono">importOk</span>, <span className="mono">checkOk</span> and{' '}
              <span className="mono">buildOk</span> fields: {DASH} means the capture recorded null,
              which is the gate never being reached. No units.
            </caption>
            <thead>
              <tr>
                <th scope="col">Gate</th>
                <th scope="col">Command</th>
                <th scope="col">Field</th>
                <th scope="col">Value</th>
                <th scope="col">Outcome</th>
                <th scope="col" className="n">Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {GATES.map((gate) => {
                const verdict = gateVerdict(selected, gate.key)
                return (
                  <tr key={gate.key}>
                    <th scope="row" className="n num">{gate.n}</th>
                    <td className="mono">{gate.command}</td>
                    <td className="mono">{gate.key}Ok</td>
                    <td className="mono">{boolWord(verdict)}</td>
                    <td>
                      {gateStatus(verdict)}
                      {selected.rejectedAt === gate.key ? ' — rejected here' : ''}
                    </td>
                    <td className="n num">{int(gateDiagnostics(selected, gate.key).length)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="caption" style={{ maxWidth: 'var(--measure)' }}>
          Each diagnostic above is the compiler&rsquo;s own record, not a rendering of its prose: a
          stable code, a span, an expected and an actual fact, a fix-safety rating and, where the
          compiler has one, a named repair. That is what makes a rejection something a program can
          act on rather than a paragraph a human must read.
        </p>
      </div>
    </section>
  )
}

/* ==========================================================================
   2. Phase cost explainer
   ======================================================================== */

function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / mag) * mag
}

type Point = { id: string; lines: number; bytes: number }

/* An HTML scatter rather than an SVG one. Axis labels stay real DOM text, so
   they hold their type size at 375px instead of being scaled down by a viewBox
   the way an SVG label would be. The table below carries the same numbers. */
function IrScatter({ points, selectedId }: { points: Point[]; selectedId: string }) {
  const maxX = niceMax(Math.max(...points.map((p) => p.lines)))
  const maxY = niceMax(Math.max(...points.map((p) => p.bytes)))
  const ticks = 4
  const sel = points.find((p) => p.id === selectedId)

  return (
    <div>
      <p className="meta" style={{ margin: '0 0 0.625rem' }}>
        Lowered IR bytes (vertical) against non-empty source lines (horizontal), all{' '}
        {int(points.length)} programs
      </p>

      <div
        role="img"
        aria-label={
          `Scatter of lowered IR bytes against non-empty source lines for ${points.length} ` +
          'programs. ' +
          (sel ? `${sel.id} is highlighted at ${int(sel.lines)} lines and ${int(sel.bytes)} bytes. ` : '') +
          'The same values are listed in the table below.'
        }
        style={{
          display: 'grid',
          /* The tick labels are absolutely positioned, so they contribute no
             intrinsic width. The gutter is reserved explicitly instead. */
          gridTemplateColumns: '4rem minmax(0, 1fr)',
          columnGap: '0.5rem',
          rowGap: '0.25rem',
        }}
      >
        <div style={{ position: 'relative' }}>
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span
              key={i}
              className="meta"
              style={{
                position: 'absolute',
                right: 0,
                top: `${(1 - i / ticks) * 100}%`,
                transform: 'translateY(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {int(Math.round((maxY / ticks) * i))}
            </span>
          ))}
        </div>

        <div
          /* Width comes from the grid column and height from the clamp. An
             aspect-ratio here would fight the column: once a min-height raised
             the box, the ratio would widen it past its track and the tick row
             below — which is a plain grid item — would no longer line up. */
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(160px, 22vw, 240px)',
            borderLeft: '1px solid var(--border-strong)',
            borderBottom: '1px solid var(--border-strong)',
          }}
        >
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(1 - i / ticks) * 100}%`,
                height: 1,
                background: 'var(--data-grid)',
              }}
            />
          ))}

          {points.map((p) => {
            const on = p.id === selectedId
            const size = on ? 15 : 9
            return (
              <span
                key={p.id}
                title={`${p.id}: ${int(p.lines)} non-empty lines, ${int(p.bytes)} lowered IR bytes`}
                style={{
                  position: 'absolute',
                  left: `${(p.lines / maxX) * 100}%`,
                  bottom: `${(p.bytes / maxY) * 100}%`,
                  transform: 'translate(-50%, 50%)',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: on ? 'var(--data-4)' : 'var(--data-1)',
                  border: on ? '2px solid var(--text)' : '1px solid var(--border-strong)',
                }}
              />
            )
          })}
        </div>

        <div />
        <div style={{ position: 'relative', height: '1.125rem' }}>
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span
              key={i}
              className="meta"
              style={{
                position: 'absolute',
                left: `${(i / ticks) * 100}%`,
                transform:
                  i === 0 ? 'none' : i === ticks ? 'translateX(-100%)' : 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {int(Math.round((maxX / ticks) * i))}
            </span>
          ))}
        </div>
      </div>

      {sel ? (
        <p className="caption">
          Highlighted, drawn larger and ringed: <span className="mono">{sel.id}</span> at{' '}
          <span className="num">{int(sel.lines)}</span> non-empty lines and{' '}
          <span className="num">{int(sel.bytes)}</span> bytes of lowered IR.
        </p>
      ) : null}
    </div>
  )
}

export function PhaseCostExplainer({ capture }: { capture: Capture }) {
  /* Smallest to largest by non-empty lines, so stepping through the buttons is
     stepping up the size gradient. */
  const programs = useMemo(
    () => [...capture.corpus].sort((a, b) => a.metrics.nonEmptyLines - b.metrics.nonEmptyLines),
    [capture.corpus],
  )
  const [programId, setProgramId] = useState<string>(() => programs[0]?.id ?? '')
  const selected = useMemo(
    () => programs.find((p) => p.id === programId) ?? programs[0],
    [programs, programId],
  )

  const points = useMemo<Point[]>(
    () =>
      programs
        .map((p) => ({ id: p.id, lines: p.metrics.nonEmptyLines, bytes: loweredIrBytes(p) }))
        .filter((p): p is Point => p.bytes !== null),
    [programs],
  )

  const panelId = 'phase-cost-panel'

  if (!selected) {
    return <p className="body">This capture contains no corpus, so there is no cost to account for.</p>
  }

  const phases = timedPhases(selected)
  const total = phases.reduce((n, p) => n + p.elapsedMs, 0)
  const max = Math.max(...phases.map((p) => p.elapsedMs), 0)
  const nonZero = phases.filter((p) => p.elapsedMs > 0)
  const zeroCount = phases.length - nonZero.length
  const irBytes = loweredIrBytes(selected)

  return (
    <section aria-labelledby="phase-cost-title">
      <h3 className="heading-20" id="phase-cost-title">
        Where the milliseconds go
      </h3>
      <p className="body" style={{ maxWidth: 'var(--measure)', marginBottom: '1.25rem' }}>
        Pick a program, smallest to largest. The left panel is every phase time the compiler
        reported for it; the right panel is the size of the IR that lowering produced, placed
        against the whole corpus.
      </p>

      <div role="group" aria-labelledby="phase-cost-choose" style={{ marginBottom: '1.5rem' }}>
        <p className="label" id="phase-cost-choose" style={{ margin: '0 0 0.5rem' }}>
          Program, by non-empty source lines
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {programs.map((p) => (
            <ChoiceButton
              key={p.id}
              pressed={p.id === selected.id}
              onClick={() => setProgramId(p.id)}
              controls={panelId}
              label={`Program ${p.id}, ${p.metrics.nonEmptyLines} non-empty lines`}
              primary={p.id}
              secondary={`${int(p.metrics.nonEmptyLines)} lines`}
            />
          ))}
        </div>
      </div>

      <div id={panelId}>
        <StatStrip
          stats={[
            { value: int(selected.metrics.nonEmptyLines), label: 'Non-empty source lines' },
            { value: int(total), unit: 'ms', label: 'Total reported phase time' },
            {
              value: int(phases.find((p) => p.name === 'lower')?.elapsedMs ?? 0),
              unit: 'ms',
              label: 'Of which lower',
            },
            {
              value: irBytes === null ? DASH : int(irBytes),
              unit: irBytes === null ? undefined : 'B',
              label: 'Lowered IR bytes',
            },
          ]}
        />

        <div className="split" style={{ marginTop: '1.75rem' }}>
          <Figure
            title="Reported phase time"
            meta={`${selected.id} · phases.coldTimed`}
            caption={
              <>
                {int(zeroCount)} of the {int(phases.length)} phases returned{' '}
                <span className="num">0</span> ms; the bar for each is an empty track with a tick at
                the origin, not a missing row. Only{' '}
                <span className="mono">{nonZero.map((p) => p.name).join(', ') || DASH}</span>{' '}
                registered any time at all.
              </>
            }
          >
            <div
              role="presentation"
              aria-hidden="true"
              style={{ display: 'grid', gap: '0.4375rem' }}
            >
              {phases.map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(4.25rem, 24%) minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: '0.625rem',
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      position: 'relative',
                      height: 16,
                      background: 'var(--data-grid)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {p.elapsedMs > 0 ? (
                      <span
                        style={{
                          display: 'block',
                          width: `${max === 0 ? 0 : (p.elapsedMs / max) * 100}%`,
                          height: '100%',
                          background: 'var(--data-4)',
                          borderRadius: 2,
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: 'var(--border-strong)',
                        }}
                      />
                    )}
                  </span>
                  <span
                    className="mono num"
                    style={{
                      fontSize: '0.75rem',
                      minWidth: '5.5ch',
                      textAlign: 'right',
                      color: p.elapsedMs > 0 ? 'var(--text)' : 'var(--text-tertiary)',
                    }}
                  >
                    {int(p.elapsedMs)} ms
                  </span>
                </div>
              ))}
            </div>
          </Figure>

          <Figure
            title="Lowered IR size across the corpus"
            meta={`${int(points.length)} programs · backend.size.loweredIrBytes`}
            caption={
              <>
                Source size on the horizontal axis, the size of the MIR lowering produced on the
                vertical. The IR itself is never printed —{' '}
                <span className="mono">--emit llvm-ir</span> fails with{' '}
                <span className="mono">BLD004</span> on every target — so its byte count is the only
                observable the compiler offers.
              </>
            }
          >
            {points.length > 0 ? (
              <IrScatter points={points} selectedId={selected.id} />
            ) : (
              <p className="caption" style={{ marginTop: 0 }}>
                No program in this capture reported a lowered IR size.
              </p>
            )}
          </Figure>
        </div>

        <div className="table-wrap" style={{ marginTop: '1.75rem' }}>
          <table>
            <caption>
              Every phase <span className="mono">{selected.id}</span> reported, in the order the
              compiler lists them, from <span className="mono">phases.coldTimed</span>. Times are
              whole milliseconds as reported: a <span className="num">0</span> means the phase
              returned inside one millisecond, not that it was skipped. Share is that phase as a
              percentage of the {int(total)} ms total.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="n">#</th>
                <th scope="col">Phase</th>
                <th scope="col" className="n">Reported</th>
                <th scope="col" className="n">Share</th>
                <th scope="col">Cacheable</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p, i) => (
                <tr key={p.name}>
                  <th scope="row" className="n num">{i + 1}</th>
                  <td className="mono">{p.name}</td>
                  <td className="n num">{int(p.elapsedMs)} ms</td>
                  <td className="n num">
                    {total === 0 ? DASH : `${Math.round((p.elapsedMs / total) * 100)}%`}
                  </td>
                  <td>{p.cacheable ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>All phases</th>
                <td className="n num">{int(total)} ms</td>
                <td className="n num">{total === 0 ? DASH : '100%'}</td>
                <td>{DASH}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="table-wrap">
          <table>
            <caption>
              The corpus ordered by non-empty source lines, smallest first, with the lowered IR size
              each program produced and the time its <span className="mono">lower</span> phase
              reported. Bytes per line is derived by division and is stated only to show the ratio
              is roughly stable. The selected program is marked in the first column.
            </caption>
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col" className="n">Non-empty lines</th>
                <th scope="col" className="n">Lowered IR bytes</th>
                <th scope="col" className="n">Bytes per line</th>
                <th scope="col" className="n">lower</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const bytes = loweredIrBytes(p)
                const lower = timedPhases(p).find((x) => x.name === 'lower')?.elapsedMs ?? 0
                const on = p.id === selected.id
                return (
                  <tr key={p.id}>
                    <th scope="row" className="mono" style={{ fontWeight: on ? 640 : undefined }}>
                      {p.id}
                      {on ? (
                        <span className="meta" style={{ color: 'var(--text)' }}> · selected</span>
                      ) : null}
                    </th>
                    <td className="n num">{int(p.metrics.nonEmptyLines)}</td>
                    <td className="n num">{bytes === null ? DASH : int(bytes)}</td>
                    <td className="n num">
                      {bytes === null || p.metrics.nonEmptyLines === 0
                        ? DASH
                        : int(Math.round(bytes / p.metrics.nonEmptyLines))}
                    </td>
                    <td className="n num">{int(lower)} ms</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="caption" style={{ maxWidth: 'var(--measure)' }}>
          Read the two panels together: the front end costs nothing measurable because it reads
          facts already stored in <span className="mono">zero.graph</span> rather than re-deriving
          them from text, and <span className="mono">lower</span> is the only phase whose time, and
          whose output, grows with the size of the program.
        </p>
      </div>
    </section>
  )
}
