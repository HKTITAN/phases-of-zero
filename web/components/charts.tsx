/* Hand-rolled SVG charts.

   No charting dependency on purpose: the brand guidelines require zero baselines,
   direct labels over legends, honest encodings, and legibility in both themes.
   Every chart here also ships a semantic <table> alternative for assistive tech,
   because a picture of a number is not the number. */

import type { ReactNode } from 'react'

export type Series = { label: string; value: number; note?: string; emphasis?: boolean }

function fmt(n: number, digits = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/* ------------------------------------------------------------------ figure */

export function Figure({
  id, title, meta, caption, children, full,
}: {
  id?: string; title: string; meta?: ReactNode; caption?: ReactNode
  children: ReactNode; full?: boolean
}) {
  return (
    <figure id={id} className="figure" style={full ? undefined : { maxWidth: '100%' }}>
      <div className="figure-head">
        <span className="heading-16" style={{ margin: 0 }}>{title}</span>
        {meta ? <span className="meta">{meta}</span> : null}
      </div>
      <div className="figure-body">{children}</div>
      {caption ? (
        <figcaption className="caption" style={{ padding: '0 1rem 1rem', margin: 0 }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/* --------------------------------------------------------------- bar chart */

export function BarChart({
  data, unit, digits = 0, tableLabel = 'Value',
}: {
  data: Series[]; unit?: string; digits?: number; tableLabel?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 0)
  // Zero baseline is non-negotiable: bar length must be proportional to value.
  const pct = (v: number) => (max === 0 ? 0 : (v / max) * 100)

  return (
    <>
      <div role="presentation" style={{ display: 'grid', gap: '0.5rem' }}>
        {data.map((d) => (
          <div
            key={d.label}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(88px, 21%) minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span className="label" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
              {d.label}
            </span>
            <span
              style={{
                display: 'block',
                height: 18,
                background: 'var(--data-grid)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${pct(d.value)}%`,
                  height: '100%',
                  background: d.emphasis ? 'var(--data-4)' : 'var(--data-2)',
                  borderRadius: 2,
                }}
              />
            </span>
            <span
              className="num"
              style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', minWidth: '4.5ch', textAlign: 'right' }}
            >
              {fmt(d.value, digits)}
              {unit ? <span style={{ color: 'var(--text-tertiary)' }}>{' '}{unit}</span> : null}
            </span>
          </div>
        ))}
      </div>

      <table className="sr-table" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        <caption>Data for the chart above</caption>
        <thead><tr><th scope="col">Item</th><th scope="col" className="n">{tableLabel}{unit ? ` (${unit})` : ''}</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th scope="row">{d.label}</th><td className="n">{fmt(d.value, digits)}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* -------------------------------------------------- stacked phase timeline */

export type PhaseSlice = { name: string; ms: number }

/* One horizontal bar per program, segmented by compiler phase. This is the
   chart the whole paper turns on, so it labels segments directly rather than
   deferring to a legend, and it degrades to a table when a phase is sub-1 ms. */
export function PhaseBar({
  phases, totalLabel, showLabels = true,
}: {
  phases: PhaseSlice[]; totalLabel?: string; showLabels?: boolean
}) {
  const total = phases.reduce((n, p) => n + p.ms, 0)
  const ramp = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)']

  return (
    <div>
      <div
        style={{ display: 'flex', height: 30, borderRadius: 3, overflow: 'hidden', background: 'var(--data-grid)' }}
        role="img"
        aria-label={
          `Phase breakdown totalling ${fmt(total, 1)} milliseconds: ` +
          phases.map((p) => `${p.name} ${fmt(p.ms, 1)} ms`).join(', ')
        }
      >
        {phases.map((p, i) => {
          const w = total === 0 ? 0 : (p.ms / total) * 100
          if (w === 0) return null
          return (
            <span
              key={p.name}
              title={`${p.name}: ${fmt(p.ms, 1)} ms`}
              style={{
                width: `${w}%`,
                background: ramp[i % ramp.length],
                borderRight: '1px solid var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {showLabels && w > 12 ? (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.6875rem',
                    color: 'var(--bg)', whiteSpace: 'nowrap', padding: '0 0.375rem',
                    fontWeight: 500,
                  }}
                >
                  {p.name}
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
      {totalLabel ? (
        <p className="meta" style={{ marginTop: '0.5rem' }}>
          {totalLabel} · total {fmt(total, 1)} ms
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------- scaling scatter */

export function ScalingChart({
  points, xLabel, yLabel, xUnit, yUnit,
}: {
  points: { x: number; y: number; label: string }[]
  xLabel: string; yLabel: string; xUnit?: string; yUnit?: string
}) {
  const W = 620, H = 300
  const pad = { t: 14, r: 16, b: 42, l: 54 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b

  // Zero-baselined axes. Nice round maxima so gridlines land on readable values.
  const rawMaxX = Math.max(...points.map((p) => p.x), 1)
  const rawMaxY = Math.max(...points.map((p) => p.y), 1)
  const niceMax = (v: number) => {
    const mag = 10 ** Math.floor(Math.log10(v))
    return Math.ceil(v / mag) * mag
  }
  const maxX = niceMax(rawMaxX), maxY = niceMax(rawMaxY)

  const sx = (x: number) => pad.l + (x / maxX) * iw
  const sy = (y: number) => pad.t + ih - (y / maxY) * ih

  const ticks = 4
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')

  return (
    <>
      {/* SVG text scales with the viewBox, so on a 375px screen a 10.5px label
          would render at ~6px. Give the chart a floor and let it scroll inside
          its own container instead of shrinking the type below legibility. */}
      <div style={{ overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: W, height: "auto", display: "block" }}
        role="img"
        aria-label={`${yLabel} against ${xLabel} for ${points.length} programs`}
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (maxY / ticks) * i
          const y = sy(v)
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--data-grid)" strokeWidth="1" />
              <text
                x={pad.l - 9} y={y + 3.5} textAnchor="end"
                fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)"
              >
                {fmt(v)}
              </text>
            </g>
          )
        })}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (maxX / ticks) * i
          return (
            <text
              key={i} x={sx(v)} y={H - pad.b + 16} textAnchor="middle"
              fill="var(--text-tertiary)" fontSize="11" fontFamily="var(--font-mono)"
            >
              {fmt(v)}
            </text>
          )
        })}

        <path d={path} fill="none" stroke="var(--data-2)" strokeWidth="1.5" strokeLinejoin="round" />

        {sorted.map((p) => (
          <g key={p.label}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="4" fill="var(--data-4)" />
            <title>{`${p.label}: ${fmt(p.x)} ${xUnit ?? ''} → ${fmt(p.y)} ${yUnit ?? ''}`}</title>
          </g>
        ))}

        <text
          x={pad.l + iw / 2} y={H - 6} textAnchor="middle"
          fill="var(--text-secondary)" fontSize="12.5"
        >
          {xLabel}{xUnit ? ` (${xUnit})` : ''}
        </text>
        <text
          x={-(pad.t + ih / 2)} y={13} textAnchor="middle" transform="rotate(-90)"
          fill="var(--text-secondary)" fontSize="12.5"
        >
          {yLabel}{yUnit ? ` (${yUnit})` : ''}
        </text>
      </svg>
      </div>

      <table style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        <caption>Data for the chart above</caption>
        <thead>
          <tr>
            <th scope="col">Program</th>
            <th scope="col" className="n">{xLabel}</th>
            <th scope="col" className="n">{yLabel}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td className="n">{fmt(p.x)}</td>
              <td className="n">{fmt(p.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ----------------------------------------------------------- stat display */

export function StatStrip({ stats }: { stats: { value: string; unit?: string; label: string }[] }) {
  return (
    <div className="stat-strip">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <span className="stat-value">
            {s.value}
            {s.unit ? <span className="stat-unit">{s.unit}</span> : null}
          </span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
