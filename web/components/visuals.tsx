/* Icon-first figures.

   components/diagrams.tsx already carries the rigorous version of each of these
   claims — labelled boxes, full stage names, an exhaustive table under every
   figure. Those are correct and they are also walls of prose. The five figures
   here are the at-a-glance layer that sits above them: shape first, number
   second, sentence third. Nothing here replaces a diagram in that file; each one
   is meant to be read before it.

   Rules this file follows, and why:

   - Server components. Nothing here has state, so nothing here ships JavaScript.
   - No motion. Every element is at rest on load, and the animations skill
     forbids animating things that simply sit where they belong. There is no
     hover state either, because none of these figures is a control.
   - Colour is never the only signal. Every filled block, every valve and every
     verdict carries a word or a glyph saying the same thing.
   - Every figure has a text alternative that is real text, not a description:
     an ordered list, a legend, or a <table> in a .table-wrap.
   - Numbers are derived from the capture at render time. No figure in this file
     contains a hardcoded measurement.

   Responsive technique. globals.css is the only stylesheet and inline styles
   cannot carry a media query, so the two figures that need a genuine layout
   change at phone width use a fluid-breakpoint clamp:

       clamp(A, (T - 100vw) * 999, B)

   Below viewport width T the middle term is a large positive length and the
   value pins to B; above T it is negative and the value pins to A. It is a
   static layout expression evaluated by the CSS engine, not a script and not an
   animation. Each use site says which of A or B is the phone case. */

import type { CSSProperties } from 'react'
import type { Capture, ErrorCase } from '@/lib/types'
import { CLASSICAL_PHASES, ZERO_PHASES, phaseForCode } from '@/lib/phases'
import { Figure } from '@/components/charts'
import { Icon, PHASE_ICON, type IconName } from '@/components/icons'

/* ------------------------------------------------------------ shared atoms */

/* Present in the accessibility tree, absent from the page. Same technique the
   charts use for their fallback tables. */
const SR: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`
}

/* The one repeated mark in this file: an icon centred in a ring. `tone` is
   always accompanied by text at the use site, so the ring never has to carry
   meaning on its own. */
function IconRing({
  name,
  size = 38,
  tone = 'quiet',
}: {
  name: IconName
  size?: number
  tone?: 'quiet' | 'strong' | 'void'
}) {
  const skin =
    tone === 'strong'
      ? { border: '1.5px solid var(--accent-line)', background: 'var(--accent-quiet)', color: 'var(--accent-text)' }
      : tone === 'void'
        ? { border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-faint)' }
        : { border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--text-secondary)' }

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 999,
        flex: '0 0 auto',
        ...skin,
      }}
    >
      <Icon name={name} size={Math.round(size * 0.47)} />
    </span>
  )
}

/* Downward flow: a hairline with a rotated-square head. Matches the connector
   used in components/diagrams.tsx so the two files draw flow identically. */
function DownFlow({ tone = 'solid', height = 18 }: { tone?: 'solid' | 'dashed'; height?: number }) {
  const ink = tone === 'dashed' ? 'var(--text-faint)' : 'var(--text-tertiary)'
  return (
    <span aria-hidden="true" style={{ display: 'block', position: 'relative', height, flex: '0 0 auto' }}>
      <span
        style={{ position: 'absolute', left: '50%', top: 0, bottom: 5, width: 0, borderLeft: `1px ${tone} ${ink}` }}
      />
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 2,
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

/* ============================================================ 1. pipeline ribbon */

type Stage = { short: string; full: string; icon: IconName }

/* Stage names and glyphs are the ones components/diagrams.tsx uses for the same
   stages, so a reader can match a ribbon node to a row of the detailed table by
   shape. `short` is what fits an 84px node; `full` is what the caption and the
   accessible name say. */
const TRAD_STAGES: Stage[] = [
  { short: 'source', full: 'source files', icon: 'book' },
  { short: 'lex + parse', full: 'lexer/parser', icon: 'scan' },
  { short: 'AST', full: 'AST', icon: 'tree' },
  { short: 'resolve', full: 'name resolution', icon: 'link' },
  { short: 'type check', full: 'type checking', icon: 'check' },
  { short: 'IR lower', full: 'IR lowering', icon: 'layers' },
  { short: 'optimize', full: 'optimization', icon: 'gauge' },
  { short: 'codegen', full: 'codegen', icon: 'chip' },
  { short: 'artifact', full: 'artifact', icon: 'bytes' },
]

const ZERO_STAGES: Stage[] = [
  { short: 'zero.graph', full: 'zero.graph', icon: 'graph' },
  { short: 'graph tables', full: 'repository graph tables', icon: 'graph' },
  { short: 'validate', full: 'semantic validation', icon: 'gate' },
  { short: 'type check', full: 'type checking', icon: 'check' },
  { short: 'MIR', full: 'MIR and backend facts', icon: 'layers' },
  { short: 'codegen', full: 'direct codegen', icon: 'chip' },
  { short: 'artifact', full: 'artifact', icon: 'bytes' },
]

/* Below 560px each node takes a full row and the ribbon becomes a vertical
   stack; above it, nodes sit side by side at 84px and grow to fill. */
const NODE_BASIS = 'clamp(84px, (560px - 100vw) * 999, 100%)'
/* The mirror of the same switch: above 560px the label is forced onto its own
   line beneath the ring; below it, the label sits beside the ring so a stack of
   nine nodes stays about 400px tall instead of 700px. */
const LABEL_BASIS = 'clamp(0px, (100vw - 560px) * 999, 100%)'
/* And a cap on the label box in stack mode only, so the label sits next to its
   ring instead of being centred in the whole row — which would leave a hole
   between the two and push the connector off the left edge. */
const LABEL_MAX = 'clamp(132px, (100vw - 560px) * 999, 100%)'

export function PipelineRibbon({ variant }: { variant: 'traditional' | 'zero' }) {
  const zero = variant === 'zero'
  const stages = zero ? ZERO_STAGES : TRAD_STAGES

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '0.625rem',
        }}
      >
        <span className="label" style={{ color: 'var(--text)' }}>
          {zero ? 'Zero graph-first compile path' : 'Traditional parse-first compile path'}
        </span>
        <span className="meta">
          {stages.length} stages · {zero ? 'per zero build' : 'per invocation'}
        </span>
      </div>

      <ol
        style={{
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          /* Centred rather than stretched: when nine nodes do not fit on one
             row, a grown node would make the orphan on row two as wide as the
             whole figure. Fixed-width nodes keep a wrapped ribbon reading as a
             ribbon. */
          justifyContent: 'center',
          gap: '0.375rem 0.5rem',
          margin: 0,
          padding: '0.75rem 0.5rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-raised)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {stages.map((s, i) => (
          <li
            key={s.full}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              rowGap: '0.3125rem',
              minWidth: 0,
              flexGrow: 0,
              flexShrink: 1,
              flexBasis: NODE_BASIS,
            }}
          >
            {/* The ring keeps its own line so it stays centred over the label in
                ribbon mode. The connector is absolutely positioned against the
                ring rather than laid out beside it, which keeps the ring on the
                node centreline in both modes. */}
            <span
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(calc(-50% - 32px), -50%)',
                    color: 'var(--text-faint)',
                    display: 'flex',
                  }}
                >
                  <Icon name="arrowRight" size={13} />
                </span>
              ) : null}
              <IconRing name={s.icon} size={38} />
            </span>
            <span
              style={{
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: LABEL_BASIS,
                maxWidth: LABEL_MAX,
                minWidth: 0,
                textAlign: 'center',
                /* Two lines are reserved whether or not the label needs them,
                   so the ribbon's baseline never moves between variants. */
                minHeight: '2.5em',
                fontSize: '0.6875rem',
                lineHeight: 1.25,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                padding: '0 0.125rem',
              }}
            >
              {s.short}
              {s.short === s.full ? null : <span style={SR}> ({s.full})</span>}
            </span>
          </li>
        ))}
      </ol>

      <p className="caption">
        {zero ? (
          <>
            Stages in order: {ZERO_STAGES.map((s) => s.full).join(' → ')}. There is no lexer, parser or
            name-resolution stage here — those ran once, at the ingestion gate, when text entered the
            graph. Figure 2 is the stage-by-stage comparison.
          </>
        ) : (
          <>
            Stages in order: {TRAD_STAGES.map((s) => s.full).join(' → ')}. All nine run on every
            invocation, as documented for Rust, Go, Zig and C. Figure 2 aligns them against Zero&apos;s
            sequence.
          </>
        )}{' '}
        Below 560px the ribbon becomes a vertical stack; the order is unchanged.
      </p>
    </div>
  )
}

/* ================================================================ 2. phase wheel */

/* Attribution rule for measured time. `zero time --json` reports the compiler's
   own eight phases; ZERO_PHASES states which classical phase each one carries.
   A Zero phase that carries two classical phases splits its milliseconds evenly
   between them. This is stated in the caption because it is a choice, not a
   measurement — and because it is the only place a number in this figure is not
   read straight off the capture. */
const CLASSICAL_OF_ZERO: Record<string, string[]> = Object.fromEntries(
  ZERO_PHASES.map((z) => [z.name, z.maps === 'lexical/syntax' ? ['lexical', 'syntax'] : [z.maps]])
)

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const a = polar(cx, cy, r, fromDeg)
  const b = polar(cx, cy, r, toDeg)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/* Consecutive arcs laid end to end from twelve o'clock. Written as a plain loop
   in its own function so the running offset never escapes into a callback. */
function stackArcs(slices: { id: string; share: number }[]) {
  const out: { id: string; from: number; to: number; full: boolean }[] = []
  let cursor = 0
  for (const s of slices) {
    if (s.share <= 0) continue
    const from = cursor * 360
    cursor += s.share
    const to = cursor * 360
    out.push({ id: s.id, from, to, full: to - from >= 359.9 })
  }
  return out
}

export function PhaseWheel({ capture, activePhase }: { capture: Capture; activePhase?: string }) {
  /* Milliseconds per classical phase, summed across the whole corpus. */
  const ms: Record<string, number> = Object.fromEntries(CLASSICAL_PHASES.map((p) => [p.id, 0]))
  const carriedBy: Record<string, string[]> = Object.fromEntries(CLASSICAL_PHASES.map((p) => [p.id, []]))
  for (const z of ZERO_PHASES) {
    for (const id of CLASSICAL_OF_ZERO[z.name]) {
      if (!carriedBy[id].includes(z.name)) carriedBy[id].push(z.name)
    }
  }
  for (const program of capture.corpus) {
    for (const phase of program.phases.coldTimed) {
      const owners = CLASSICAL_OF_ZERO[phase.name]
      if (!owners) continue
      for (const id of owners) ms[id] += phase.elapsedMs / owners.length
    }
  }

  const total = CLASSICAL_PHASES.reduce((n, p) => n + ms[p.id], 0)
  const rows = CLASSICAL_PHASES.map((p) => {
    const value = ms[p.id]
    const reported = carriedBy[p.id]
    return {
      ...p,
      ms: value,
      share: total === 0 ? 0 : value / total,
      reported,
      /* Two different zeroes, and the figure must not conflate them: a phase the
         compiler reports at 0 ms, and a phase it does not report at all. */
      state: reported.length === 0 ? ('unreported' as const) : value > 0 ? ('measured' as const) : ('subms' as const),
      active:
        activePhase != null &&
        (activePhase === p.id || activePhase === p.name || reported.includes(activePhase) || p.zeroPhases.includes(activePhase)),
    }
  })

  const dominant = rows.reduce((best, r) => (r.share > best.share ? r : best), rows[0])
  const timedPrograms = capture.corpus.filter((p) => p.phases.coldTimed.length > 0).length

  /* Ring geometry. 280 units square, so at the container's 300px cap the SVG
     renders at roughly 1:1 and the stroke weights are the ones drawn here. */
  const C = 140
  const R = 76
  const STROKE = 22
  const CHIP_R = 110

  const arcs = stackArcs(rows.map((r) => ({ id: r.id, share: r.share })))

  return (
    <Figure
      title="Where measured compile time goes"
      meta="zero time --json, cold"
      caption={
        <>
          The ring is one continuous arc, not six segments: {dominant.name.toLowerCase()}, which the
          compiler reports as <span className="mono">{dominant.reported.join(' + ')}</span>, accounts for{' '}
          {pct(dominant.share)} of every millisecond it reports across{' '}
          <span className="num">{timedPrograms}</span> programs. The six markers around the ring name the
          classical phases in order, clockwise from the top; they do not divide it. Milliseconds are
          attributed by the ZERO_PHASES mapping, and a Zero phase carrying two classical phases splits
          its time evenly between them — only <span className="mono">parse</span> does, and it reports
          0 ms.
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
          gap: 'clamp(1rem, 3vw, 2rem)',
          alignItems: 'center',
        }}
      >
        {/* ---- the wheel */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 300,
            aspectRatio: '1 / 1',
            margin: '0 auto',
          }}
        >
          <svg
            viewBox="0 0 280 280"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            role="img"
            aria-label={
              `Ring showing share of measured compile time by classical phase. ` +
              rows
                .map(
                  (r) =>
                    `${r.name}: ${r.state === 'unreported' ? 'no reported phase' : `${fmt(Math.round(r.ms))} milliseconds, ${pct(r.share)}`}`
                )
                .join('. ') +
              `. Total ${fmt(Math.round(total))} milliseconds.`
            }
          >
            <title>Share of measured compile time by classical phase</title>

            <circle cx={C} cy={C} r={R} fill="none" stroke="var(--data-grid)" strokeWidth={STROKE} />

            {arcs.map((a) =>
              a.full ? (
                <circle
                  key={a.id}
                  cx={C}
                  cy={C}
                  r={R}
                  fill="none"
                  stroke="var(--data-4)"
                  strokeWidth={STROKE}
                />
              ) : (
                <path
                  key={a.id}
                  d={arcPath(C, C, R, a.from, a.to)}
                  fill="none"
                  stroke="var(--data-4)"
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                />
              )
            )}

            {/* Start-of-ring tick at twelve o'clock, so a full ring still reads
                as a ring that begins and ends somewhere. */}
            <line
              x1={C}
              y1={C - R - STROKE / 2 - 3}
              x2={C}
              y2={C - R + STROKE / 2 + 3}
              stroke="var(--bg-raised)"
              strokeWidth="2"
            />
          </svg>

          {/* Chip ring. Everything here is repeated verbatim in the legend, so
              the whole overlay is hidden from assistive technology. */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            {rows.map((r, i) => {
              const deg = i * 60
              const p = polar(C, C, CHIP_R, deg)
              const strong = r.share > 0
              return (
                <span
                  key={r.id}
                  style={{
                    position: 'absolute',
                    left: `${(p.x / 280) * 100}%`,
                    top: `${(p.y / 280) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 999,
                    boxShadow: r.active ? '0 0 0 2px var(--accent)' : undefined,
                  }}
                >
                  <IconRing
                    name={PHASE_ICON[r.id]}
                    size={strong ? 42 : 32}
                    tone={strong ? 'strong' : r.state === 'unreported' ? 'void' : 'quiet'}
                  />
                </span>
              )
            })}
          </div>

          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              width: '44%',
            }}
          >
            <span className="num" style={{ display: 'block', fontSize: '1.5rem', lineHeight: 1.05, fontWeight: 540 }}>
              {pct(dominant.share)}
            </span>
            <span className="meta" style={{ display: 'block', marginTop: '0.25rem' }}>
              in {dominant.reported.join(' + ') || '—'}
            </span>
          </div>
        </div>

        {/* ---- legend, which is also the figure's text alternative */}
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '0.4375rem',
            minWidth: 0,
          }}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              aria-current={r.active ? 'true' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5625rem',
                minWidth: 0,
                padding: '0.3125rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: r.active ? '1px solid var(--accent-line)' : '1px solid transparent',
                background: r.active ? 'var(--accent-quiet)' : undefined,
              }}
            >
              <IconRing
                name={PHASE_ICON[r.id]}
                size={28}
                tone={r.share > 0 ? 'strong' : r.state === 'unreported' ? 'void' : 'quiet'}
              />
              <span style={{ minWidth: 0, flex: '1 1 auto' }}>
                <span className="label" style={{ display: 'block', color: 'var(--text)' }}>
                  {r.n}. {r.name}
                </span>
                <span className="meta" style={{ display: 'block' }}>
                  {r.reported.length > 0 ? r.reported.join(', ') : 'no reported phase'}
                </span>
              </span>
              <span style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <span className="mono num" style={{ display: 'block', fontSize: '0.8125rem' }}>
                  {r.state === 'unreported' ? '—' : `${fmt(Math.round(r.ms))} ms`}
                </span>
                <span className="meta" style={{ display: 'block' }}>
                  {r.state === 'unreported'
                    ? 'not reported'
                    : r.state === 'subms'
                      ? 'under 1 ms'
                      : pct(r.share)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <caption>
            Text alternative to the ring above. Measured milliseconds per classical phase, summed over
            the <span className="num">{timedPrograms}</span> corpus programs on the cold path. &ldquo;Under 1 ms&rdquo;
            is a reported phase whose elapsed time rounds to zero at the compiler&apos;s own reporting
            resolution; &ldquo;not reported&rdquo; is a classical phase the compiler does not name at all.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="n">#</th>
              <th scope="col">Classical phase</th>
              <th scope="col">Reported as</th>
              <th scope="col" className="n">ms</th>
              <th scope="col" className="n">Share</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="n num">{r.n}</th>
                <td>{r.name}</td>
                <td className="mono">{r.reported.length > 0 ? r.reported.join(', ') : '—'}</td>
                <td className="n num">{r.state === 'unreported' ? '—' : fmt(Math.round(r.ms))}</td>
                <td className="n num">{r.state === 'unreported' ? '—' : pct(r.share)}</td>
                <td>
                  {r.state === 'unreported' ? 'Not reported' : r.state === 'subms' ? 'Under 1 ms' : 'Measured'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>Total reported</th>
              <td className="n num">{fmt(Math.round(total))}</td>
              <td className="n num">100%</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Figure>
  )
}

/* ================================================================= 3. gate flow */

type GateId = 'import' | 'check' | 'build'

const GATE_SPEC: { id: GateId; command: string; role: string; admits: string }[] = [
  { id: 'import', command: 'zero import', role: 'Front end', admits: 'text into the graph store' },
  { id: 'check', command: 'zero check --target', role: 'Target capability', admits: 'a graph for one target' },
  { id: 'build', command: 'zero build', role: 'MIR lowering', admits: 'a module to the emitter' },
]

function gateDiagnostics(e: ErrorCase, gate: GateId) {
  if (gate === 'import') return e.importDiagnostics
  if (gate === 'check') return e.checkDiagnostics
  return e.buildDiagnostics
}

/* One count per case, not per diagnostic line: a case that emits the same code
   twice is still one rejected program. `codes` is the union across all three
   gates, so it is only the fallback when a gate rejected a case without
   attaching a diagnostic of its own. */
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

export function GateFlow({ capture }: { capture: Capture }) {
  const cases = capture.errorCases
  const turnedAway = GATE_SPEC.map((g) => cases.filter((e) => e.rejectedAt === g.id))

  const gates = GATE_SPEC.map((g, i) => {
    const before = turnedAway.slice(0, i).reduce((n, r) => n + r.length, 0)
    const entered = cases.length - before
    const rejected = turnedAway[i].length
    return { ...g, ordinal: i + 1, entered, rejected, continued: entered - rejected, codes: gateCodes(turnedAway[i], g.id) }
  })
  const reachedArtifact = cases.length - turnedAway.reduce((n, r) => n + r.length, 0)

  return (
    <Figure
      title="Three valves on one pipe"
      meta={`${cases.length} malformed programs`}
      caption={
        <>
          Every count and every code is derived at render time from{' '}
          <span className="mono">capture.errorCases</span>: a case is attributed to the gate its{' '}
          <span className="mono">rejectedAt</span> field names. The pipe carries programs left to right;
          what a valve refuses drops out of the pipe beneath it. On a narrow screen the segments stack
          and the pipe runs top to bottom instead; each segment still carries its own in and out counts.
        </>
      }
    >
      {/* ---- inlet */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.625rem',
          flexWrap: 'wrap',
        }}
      >
        <span className="pill">
          <Icon name="terminal" size={13} />
          in
        </span>
        <span className="label" style={{ color: 'var(--text)' }}>
          <span className="num">{cases.length}</span> deliberately malformed programs enter the pipe.
        </span>
      </div>

      {/* ---- the pipe. gap 0 so adjacent segments join across the 1px divider. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(174px, 1fr))',
          gap: 0,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          background: 'var(--bg-raised)',
        }}
      >
        {gates.map((g, i) => (
          <div
            key={g.id}
            style={{
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: i === 0 ? undefined : '1px solid var(--border-faint)',
            }}
          >
            {/* pipe segment with its valve */}
            <div
              style={{
                position: 'relative',
                height: 62,
                background: 'var(--bg-sunken)',
                borderBottom: '1px solid var(--border-faint)',
                flex: '0 0 auto',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: 20,
                  marginTop: -10,
                  background: 'var(--bg-raised)',
                  borderTop: '1px solid var(--border-strong)',
                  borderBottom: '1px solid var(--border-strong)',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: '1.5px solid var(--border-strong)',
                  background: 'var(--bg-raised)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="gate" size={19} />
              </span>
              <span
                className="meta"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
              >
                in {g.entered}
              </span>
              <span
                className="meta"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
              >
                out {g.continued}
              </span>
            </div>

            {/* verdicts */}
            <div style={{ padding: '0.6875rem 0.75rem 0.875rem', display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
              <span
                className="meta"
                style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                valve {g.ordinal} of {gates.length}
              </span>
              <span className="mono" style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text)', marginTop: '0.125rem' }}>
                {g.command}
              </span>
              <span className="meta" style={{ display: 'block', marginBottom: '0.5rem' }}>
                {g.role} · admits {g.admits}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem', color: 'var(--ok)' }}>
                <Icon name="check" size={15} />
                <span className="label" style={{ color: 'var(--ok)' }}>
                  Admitted <span className="num">{g.continued}</span>
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem', color: 'var(--bad)', marginTop: '0.1875rem' }}>
                <Icon name="cross" size={15} />
                <span className="label" style={{ color: 'var(--bad)' }}>
                  Rejected <span className="num">{g.rejected}</span>
                </span>
              </span>

              <DownFlow tone={g.rejected > 0 ? 'solid' : 'dashed'} />

              {/* the branch out of the pipe */}
              <div
                style={{
                  border: g.rejected > 0 ? '1px solid var(--border)' : '1px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  background: g.rejected > 0 ? 'var(--bad-quiet)' : 'transparent',
                  padding: '0.5rem 0.5625rem 0.5625rem',
                  flex: '1 1 auto',
                }}
              >
                <span className="label" style={{ display: 'block', color: 'var(--text)' }}>
                  {g.rejected > 0 ? (
                    <>
                      Dropped here: <span className="num">{g.rejected}</span> of{' '}
                      <span className="num">{g.entered}</span>
                    </>
                  ) : (
                    'Nothing dropped here'
                  )}
                </span>
                {g.codes.length === 0 ? (
                  <span className="meta" style={{ display: 'block', marginTop: '0.3125rem' }}>
                    No case in the corpus is turned away by this valve.
                  </span>
                ) : (
                  <ul style={{ listStyle: 'none', margin: '0.4375rem 0 0', padding: 0, display: 'grid', gap: '0.25rem' }}>
                    {g.codes.map((c) => (
                      <li key={c.code} style={{ display: 'flex', gap: '0.4375rem', alignItems: 'baseline', minWidth: 0 }}>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{c.code}</span>
                        <span className="meta" style={{ flex: '1 1 auto', minWidth: 0 }}>{c.label}</span>
                        <span className="mono num" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          ×{c.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---- outlet */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.625rem',
          flexWrap: 'wrap',
        }}
      >
        <span className="pill">
          <Icon name="bytes" size={13} />
          out
        </span>
        <span className="label" style={{ color: 'var(--text)' }}>
          <span className="num">{reachedArtifact}</span> of <span className="num">{cases.length}</span> reach
          an artifact.
        </span>
      </div>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <caption>
            Text alternative to the pipe above: each valve in order, the population reaching it, what it
            admitted, what it dropped, and the codes it dropped them with. Counts are programs, not
            diagnostic lines.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="n">#</th>
              <th scope="col">Valve</th>
              <th scope="col" className="n">In</th>
              <th scope="col" className="n">Admitted</th>
              <th scope="col" className="n">Rejected</th>
              {/* Not `wrap`: a wrapped code list in a 120px column turns one row
                  eight lines tall while the rest of the table scrolls past it. */}
              <th scope="col">Codes</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((g) => (
              <tr key={g.id}>
                <th scope="row" className="n num">{g.ordinal}</th>
                <td className="mono">{g.command}</td>
                <td className="n num">{g.entered}</td>
                <td className="n num">{g.continued}</td>
                <td className="n num">{g.rejected}</td>
                <td className="mono">
                  {g.codes.length === 0 ? '—' : g.codes.map((c) => `${c.code} ×${c.count}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>Reached an artifact</th>
              <td className="n num">{reachedArtifact}</td>
              <td className="n num">—</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Figure>
  )
}

/* ============================================================ 4. artifact scale */

const BLOCK_MAX = 88

export function ArtifactScale({ capture }: { capture: Capture }) {
  const targets = capture.toolchain.targets

  /* The reference program is the one that builds on the most targets, tied by
     the fewest lines — so the block row shows every target rather than a row
     with holes in it. Chosen from the data, not named here. */
  const ranked = [...capture.corpus].sort((a, b) => {
    const ok = (p: typeof a) => targets.filter((t) => p.buildMatrix[t.name]?.ok).length
    return ok(b) - ok(a) || a.metrics.nonEmptyLines - b.metrics.nonEmptyLines
  })
  const base = ranked[0]

  const cells = targets.map((t) => {
    const m = base.buildMatrix[t.name]
    return { target: t, ok: Boolean(m?.ok), bytes: m?.ok ? (m.bytes ?? 0) : null, code: m?.code ?? null }
  })
  const maxBytes = Math.max(...cells.map((c) => c.bytes ?? 0), 1)
  const minCell = cells.filter((c) => c.bytes != null).sort((a, b) => (a.bytes ?? 0) - (b.bytes ?? 0))[0]
  const maxCell = cells.filter((c) => c.bytes != null).sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0]

  /* Per-target behaviour across the whole corpus, which is where the anomaly
     lives: a target that emits one single size for every program it builds. */
  const perTarget = targets.map((t) => {
    const built = capture.corpus
      .map((p) => ({ id: p.id, lines: p.metrics.nonEmptyLines, bytes: p.buildMatrix[t.name]?.ok ? p.buildMatrix[t.name].bytes : null }))
      .filter((r): r is { id: string; lines: number; bytes: number } => typeof r.bytes === 'number')
    const sizes = [...new Set(built.map((b) => b.bytes))].sort((a, b) => a - b)
    const byLines = [...built].sort((a, b) => a.lines - b.lines)
    return {
      name: t.name,
      objectFormat: t.objectFormat,
      built,
      sizes,
      attempted: capture.corpus.filter((p) => p.buildMatrix[t.name]).length,
      constant: sizes.length === 1 && built.length > 1,
      paged: sizes.length > 1 && sizes.every((s) => s % 512 === 0),
      smallest: byLines[0],
      largest: byLines[byLines.length - 1],
    }
  })
  const anomalies = perTarget.filter((t) => t.constant)
  const paged = perTarget.filter((t) => t.paged)

  const side = (bytes: number) => Math.max(6, Math.round(BLOCK_MAX * Math.sqrt(bytes / maxBytes)))

  return (
    <Figure
      title="Artifact size across targets"
      meta={`${base.id} · ${fmt(base.metrics.nonEmptyLines)} non-empty lines`}
      caption={
        <>
          Block side is proportional to the square root of the byte count, so block <em>area</em> is
          proportional to artifact size. The same program is{' '}
          <span className="num">{fmt(minCell?.bytes ?? 0)}</span> bytes on{' '}
          <span className="mono">{minCell?.target.name}</span> and{' '}
          <span className="num">{fmt(maxCell?.bytes ?? 0)}</span> bytes on{' '}
          <span className="mono">{maxCell?.target.name}</span> —{' '}
          <span className="num">{Math.round((maxCell?.bytes ?? 0) / (minCell?.bytes || 1))}×</span>, from one
          graph and one front end.
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
          gap: '0.75rem 0.5rem',
        }}
      >
        {cells.map((c) => (
          <div key={c.target.name} style={{ minWidth: 0, textAlign: 'center' }}>
            <div
              style={{
                height: BLOCK_MAX + 4,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              {c.ok && c.bytes != null ? (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    width: side(c.bytes),
                    height: side(c.bytes),
                    background: 'var(--data-3)',
                    borderRadius: 2,
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 2,
                    color: 'var(--text-faint)',
                  }}
                >
                  <Icon name="cross" size={14} />
                </span>
              )}
            </div>
            {/* Two lines are reserved for the target name whether or not it
                wraps, so the byte figures beneath stay on one baseline. */}
            <span
              className="mono"
              style={{
                display: 'block',
                fontSize: '0.6875rem',
                lineHeight: 1.3,
                minHeight: '2.6em',
                marginTop: '0.375rem',
                color: 'var(--text-secondary)',
                overflowWrap: 'anywhere',
              }}
            >
              {c.target.name}
            </span>
            <span className="mono num" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text)' }}>
              {c.ok && c.bytes != null ? `${fmt(c.bytes)} B` : `not built`}
            </span>
            {!c.ok ? (
              <span className="meta" style={{ display: 'block' }}>{c.code ?? 'no result'}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* ---- the called-out anomaly. One box even when several targets show it:
             the blocks are drawn for the first, and the sentence names them all. */}
      {anomalies.slice(0, 1).map((t) => (
        <div
          key={t.name}
          style={{
            marginTop: '1.125rem',
            border: '1px solid var(--accent-line)',
            borderRadius: 'var(--radius)',
            background: 'var(--accent-quiet)',
            padding: '0.875rem 0.9375rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
            gap: '0.875rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.75rem' }}>
            {[t.smallest, t.largest].map((p, i) => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    width: 56,
                    height: 56,
                    background: 'var(--data-4)',
                    borderRadius: 2,
                    margin: '0 auto',
                  }}
                />
                <span className="meta" style={{ display: 'block', marginTop: '0.375rem' }}>
                  {p.id}
                </span>
                <span className="mono num" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text)' }}>
                  {fmt(p.lines)} lines
                </span>
                {i === 0 ? <span style={SR}> and </span> : null}
              </div>
            ))}
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="pill pill-accent" style={{ whiteSpace: 'normal' }}>
              <Icon name="warning" size={13} />
              page quantisation
            </span>
            <p className="label" style={{ margin: '0.5rem 0 0', color: 'var(--text)' }}>
              <span className="mono">{t.name}</span> emits exactly{' '}
              <span className="num">{fmt(t.sizes[0])}</span> bytes for all{' '}
              <span className="num">{t.built.length}</span> programs it builds — from{' '}
              <span className="num">{fmt(t.smallest.lines)}</span> non-empty lines to{' '}
              <span className="num">{fmt(t.largest.lines)}</span>. The two blocks at left are drawn to
              scale and are the same size because the artifacts are the same size, to the byte. Program
              content does not reach the output size on this target at all;{' '}
              <span className="mono">{t.objectFormat}</span> padding does.
              {anomalies.length > 1 ? (
                <>
                  {' '}
                  The same holds on{' '}
                  {anomalies.slice(1).map((o, i) => (
                    <span key={o.name}>
                      {i > 0 ? ', ' : ''}
                      <span className="mono">{o.name}</span> at{' '}
                      <span className="num">{fmt(o.sizes[0])}</span> bytes for all{' '}
                      <span className="num">{o.built.length}</span> programs
                    </span>
                  ))}
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
      ))}

      {paged.length > 0 ? (
        <p className="caption">
          A weaker form of the same effect on{' '}
          {paged.map((t, i) => (
            <span key={t.name}>
              {i > 0 ? ', ' : ''}
              <span className="mono">{t.name}</span>
            </span>
          ))}
          : every artifact size there is a whole multiple of 512 bytes, so size moves in steps rather
          than with the program. The distinct-size column in the table below separates the three
          behaviours — one size for the whole corpus, a few 512-byte steps, and a size per program.
        </p>
      ) : null}

      <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
        <table>
          <caption>
            Text alternative to the blocks above, extended to the whole corpus. &ldquo;Distinct sizes&rdquo; is
            the number of different byte counts a target produced across the programs it built: 1 means
            the target emits the same artifact size for every program.
          </caption>
          <thead>
            <tr>
              <th scope="col">Target</th>
              <th scope="col">Format</th>
              <th scope="col" className="n">{base.id} (B)</th>
              <th scope="col" className="n">Min (B)</th>
              <th scope="col" className="n">Max (B)</th>
              <th scope="col" className="n">Distinct sizes</th>
              <th scope="col" className="n">Built</th>
            </tr>
          </thead>
          <tbody>
            {perTarget.map((t, i) => (
              <tr key={t.name}>
                <th scope="row" className="mono">{t.name}</th>
                <td className="mono">{t.objectFormat}</td>
                <td className="n num">{cells[i].bytes != null ? fmt(cells[i].bytes as number) : '—'}</td>
                <td className="n num">{t.sizes.length > 0 ? fmt(t.sizes[0]) : '—'}</td>
                <td className="n num">{t.sizes.length > 0 ? fmt(t.sizes[t.sizes.length - 1]) : '—'}</td>
                <td className="n num">{t.sizes.length}</td>
                <td className="n num">{t.built.length} / {t.attempted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Figure>
  )
}

/* ============================================================= 5. read cost */

const LOG_DECADES = 6
/* Bare magnitudes, not "100 kB": at 375px the seven labels have about 43px each
   and a unit on every one of them collides. The unit is stated once, under the
   axis. */
const DECADE_LABEL = ['1', '10', '100', '1k', '10k', '100k', '1M']

function logPos(bytes: number) {
  const v = Math.max(bytes, 1)
  return Math.min(100, (Math.log10(v) / LOG_DECADES) * 100)
}

function LinearRow({
  label,
  note,
  bytes,
  max,
  tone,
}: {
  label: string
  note: string
  bytes: number
  max: number
  tone: 'data' | 'accent'
}) {
  return (
    <div style={{ display: 'grid', gap: '0.3125rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <span className="label" style={{ color: 'var(--text)' }}>{label}</span>
        <span className="mono num" style={{ fontSize: '0.8125rem', flex: '0 0 auto' }}>{fmt(bytes)} B</span>
      </div>
      <span
        style={{ display: 'block', height: 16, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}
      >
        <span
          style={{
            display: 'block',
            width: `${(bytes / max) * 100}%`,
            height: '100%',
            background: tone === 'accent' ? 'var(--data-4)' : 'var(--data-2)',
            borderRadius: 2,
          }}
        />
      </span>
      <span className="meta">{note}</span>
    </div>
  )
}

export function ReadCostVisual({ capture }: { capture: Capture }) {
  const rc = capture.readCost
  const sum = (pick: (r: Capture['readCost'][number]) => number) => rc.reduce((n, r) => n + pick(r), 0)

  const whole = sum((r) => r.wholeSourceBytes)
  const view = sum((r) => r.viewFnBytes)
  const query = sum((r) => r.queryFnBytes)
  const linearMax = Math.max(whole, view, query)
  const viewRatio = view === 0 ? 0 : whole / view

  const perRatio = rc
    .map((r) => ({ id: r.id, ratio: r.viewFnBytes === 0 ? 0 : r.wholeSourceBytes / r.viewFnBytes }))
    .sort((a, b) => a.ratio - b.ratio)
  const queryLarger = rc.filter((r) => r.queryFnBytes > r.wholeSourceBytes).length

  const textSizes = [...new Set(rc.map((r) => r.checkTextBytes))]
  const textBytes = Math.max(...rc.map((r) => r.checkTextBytes))
  const jsonSorted = [...rc].sort((a, b) => a.checkJsonBytes - b.checkJsonBytes)
  const jsonMin = jsonSorted[0]
  const jsonMax = jsonSorted[jsonSorted.length - 1]
  const ordersMin = Math.log10(jsonMin.checkJsonBytes / Math.max(textBytes, 1))
  const ordersMax = Math.log10(jsonMax.checkJsonBytes / Math.max(textBytes, 1))

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* ---------------------------------------------------- direction one */}
      <Figure
        title="Reading one function instead of the whole program"
        meta={`${rc.length} programs, linear scale`}
        caption={
          <>
            Totals across all <span className="num">{rc.length}</span> corpus programs.{' '}
            <span className="mono">zero view --fn</span> is the projection a reader actually needs, and
            it costs <span className="num">{viewRatio.toFixed(1)}×</span> less than reading every source
            file — but only for large programs: the ratio runs from{' '}
            <span className="num">{perRatio[0].ratio.toFixed(1)}×</span> on{' '}
            <span className="mono">{perRatio[0].id}</span> to{' '}
            <span className="num">{perRatio[perRatio.length - 1].ratio.toFixed(1)}×</span> on{' '}
            <span className="mono">{perRatio[perRatio.length - 1].id}</span>.
          </>
        }
      >
        <div style={{ display: 'grid', gap: '0.875rem' }}>
          <LinearRow
            label="Whole source, every file"
            note="what a text-first reader must ingest before answering anything"
            bytes={whole}
            max={linearMax}
            tone="data"
          />
          <LinearRow
            label="One function, zero view --fn"
            note={`the same question answered from a projection — ${viewRatio.toFixed(1)}× less to read`}
            bytes={view}
            max={linearMax}
            tone="data"
          />
          <LinearRow
            label="One function, zero query --json"
            note={`the structured form of the same projection — larger than the entire source for ${queryLarger} of ${rc.length} programs`}
            bytes={query}
            max={linearMax}
            tone="accent"
          />
        </div>

        <div
          style={{
            marginTop: '0.875rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-sunken)',
            padding: '0.625rem 0.6875rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', display: 'flex', flex: '0 0 auto', marginTop: 1 }}>
            <Icon name="info" size={16} />
          </span>
          <p className="label" style={{ margin: 0 }}>
            The third bar cuts against the premise. Structured retrieval only pays off once a program is
            large: <span className="num">{queryLarger}</span> of <span className="num">{rc.length}</span>{' '}
            programs cost more to query one function from than to read end to end.
          </p>
        </div>
      </Figure>

      {/* ---------------------------------------------------- direction two */}
      <Figure
        title="Asking for the verdict"
        meta="logarithmic scale"
        caption={
          <>
            <strong>This axis is logarithmic: each gridline is ten times the one before it.</strong> A
            linear axis cannot hold both values on one page.{' '}
            <span className="mono">zero check</span> answers in{' '}
            <span className="num">{textBytes}</span> bytes
            {textSizes.length === 1 ? ' for every program in the corpus' : ''};{' '}
            <span className="mono">zero check --json</span> answers the same question in{' '}
            <span className="num">{fmt(jsonMin.checkJsonBytes)}</span> to{' '}
            <span className="num">{fmt(jsonMax.checkJsonBytes)}</span> bytes — between{' '}
            <span className="num">{ordersMin.toFixed(1)}</span> and{' '}
            <span className="num">{ordersMax.toFixed(1)}</span> orders of magnitude more.
          </>
        }
      >
        <div style={{ display: 'grid', gap: '0.875rem' }}>
          {/* prose row */}
          <div style={{ display: 'grid', gap: '0.3125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
              <span className="label" style={{ color: 'var(--text)' }}>
                <span className="mono">zero check</span> — the word &ldquo;ok&rdquo;
              </span>
              <span className="mono num" style={{ fontSize: '0.8125rem', flex: '0 0 auto' }}>
                {textBytes} B
              </span>
            </div>
            <span style={{ display: 'block', height: 16, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
              <span
                style={{
                  display: 'block',
                  width: `${logPos(textBytes)}%`,
                  height: '100%',
                  background: 'var(--data-2)',
                  borderRadius: 2,
                }}
              />
            </span>
            <span className="meta">
              identical for all <span className="num">{rc.length}</span> programs, correct and unactionable
            </span>
          </div>

          {/* json row, drawn as a range because every program differs */}
          <div style={{ display: 'grid', gap: '0.3125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
              <span className="label" style={{ color: 'var(--text)' }}>
                <span className="mono">zero check --json</span> — the same verdict, structured
              </span>
              <span className="mono num" style={{ fontSize: '0.8125rem', flex: '0 0 auto' }}>
                {fmt(jsonMin.checkJsonBytes)}–{fmt(jsonMax.checkJsonBytes)} B
              </span>
            </div>
            <span
              style={{
                display: 'flex',
                height: 16,
                background: 'var(--bg-inset)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${logPos(jsonMin.checkJsonBytes)}%`,
                  height: '100%',
                  background: 'var(--data-4)',
                }}
              />
              <span
                style={{
                  display: 'block',
                  width: `${logPos(jsonMax.checkJsonBytes) - logPos(jsonMin.checkJsonBytes)}%`,
                  height: '100%',
                  background: 'var(--data-1)',
                  borderLeft: '1px solid var(--bg-raised)',
                }}
              />
            </span>
            <span className="meta">
              solid to the smallest ({jsonMin.id}), pale band out to the largest ({jsonMax.id})
            </span>
          </div>

          {/* the axis */}
          <div style={{ marginTop: '0.125rem' }}>
            <div style={{ position: 'relative', height: 7, borderTop: '1px solid var(--border)' }}>
              {DECADE_LABEL.map((_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${(i / LOG_DECADES) * 100}%`,
                    top: 0,
                    width: 0,
                    height: 6,
                    borderLeft: '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
            <div style={{ position: 'relative', height: '1.1rem' }}>
              {DECADE_LABEL.map((d, i) => (
                <span
                  key={d}
                  className="meta"
                  style={{
                    position: 'absolute',
                    left: `${(i / LOG_DECADES) * 100}%`,
                    transform:
                      i === 0
                        ? 'none'
                        : i === LOG_DECADES
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    fontSize: '0.6875rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="meta" style={{ margin: '0.375rem 0 0', color: 'var(--text-secondary)' }}>
              Bytes, logarithmic — each gridline is ten times the last.
            </p>
          </div>
        </div>
      </Figure>

      <div className="table-wrap">
        <table>
          <caption>
            Text alternative to both figures above. Measured bytes per program for each way of asking the
            same two questions: &ldquo;show me one function&rdquo; and &ldquo;is this program correct?&rdquo;. Token figures
            in the paper are estimates at roughly four characters per token; these are bytes, measured.
          </caption>
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col" className="n">Whole source</th>
              <th scope="col" className="n">view --fn</th>
              <th scope="col" className="n">query --json</th>
              <th scope="col" className="n">check</th>
              <th scope="col" className="n">check --json</th>
            </tr>
          </thead>
          <tbody>
            {rc.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="mono">{r.id}</th>
                <td className="n num">{fmt(r.wholeSourceBytes)}</td>
                <td className="n num">{fmt(r.viewFnBytes)}</td>
                <td className="n num">{fmt(r.queryFnBytes)}</td>
                <td className="n num">{fmt(r.checkTextBytes)}</td>
                <td className="n num">{fmt(r.checkJsonBytes)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="n num">{fmt(whole)}</td>
              <td className="n num">{fmt(view)}</td>
              <td className="n num">{fmt(query)}</td>
              <td className="n num">{fmt(sum((r) => r.checkTextBytes))}</td>
              <td className="n num">{fmt(sum((r) => r.checkJsonBytes))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
