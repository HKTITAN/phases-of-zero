'use client'

/* The corpus, in full — and one recorded compile replayed step by step.

   Two components:

   `ProgramGallery` reproduces all eight programs. Every source file in every
   package is rendered whole (no scroll box: a paper you cannot read the bottom
   of is not a paper), beside the measurements the capture actually carries for
   that program and the real output of running it.

   `RunEmulation` walks one program through the eight phases the compiler itself
   reports in `phases.coldTimed`, then a ninth step for the run. It is a replay
   of recorded numbers, not a compile — Zero 0.3.4 has no browser target, and
   pretending otherwise would undermine the only thing this paper is for.

   Heading contract: the enclosing section owns the <h2> and the page owns the
   <h3> that introduces the replay, so programs are <h3> and nothing here goes
   deeper. Titles inside figures are spans, not headings, to keep the outline
   free of one entry per code block.

   Every number below is read from data/capture.json. Where the capture has no
   value — p05_errors has no host artifact, because the direct COFF backend
   rejects its MIR with BLD004 — the component says so instead of printing a
   zero, which would be a different and false claim. */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Capture, CorpusEntry } from '@/lib/types'
import { ZERO_PHASES } from '@/lib/phases'
import { Icon, type IconName } from '@/components/icons'
import { ZeroCode } from '@/components/zero-code'
import { ViewOnGithub, githubUrl, OPEN_FILE_EVENT, type OpenFileDetail } from '@/components/file-ref'

/* ------------------------------------------------------------- formatting */

const DASH = '—'
const int = (n: number) => n.toLocaleString('en-US')
const orDash = (n: number | null | undefined) => (n == null ? DASH : int(n))

/* `backend.size` is typed as an open record because the real payload is a
   212 KB stdlib catalogue; only `loweredIrBytes` is read here. */
function loweredIrBytes(p: CorpusEntry): number | null {
  const v = p.backend.size?.loweredIrBytes
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/* `coldTimed` is a cold build driven through emission, so it attributes the
   cost of lowering. `cold` comes from `check`, which can return first. */
function timedPhases(p: CorpusEntry) {
  return p.phases.coldTimed.length > 0 ? p.phases.coldTimed : p.phases.cold
}

function phaseMs(p: CorpusEntry, name: string): number | null {
  const entry = timedPhases(p).find((x) => x.name === name)
  return entry ? entry.elapsedMs : null
}

function testCount(p: CorpusEntry): number | null {
  const m = p.execution.testStdout.match(/(\d+) test\(s\) ok/)
  return m ? Number(m[1]) : null
}

/* Captured on Windows, so stdout arrives with CRLF. Rendering the CR inside a
   <pre> leaves a stray control character in the copy buffer. */
const clean = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()

/* --------------------------------------------------------- what it exercises

   Derived from the capture, never from the program's name. `p07_generics` is
   the only package that declares a generic; `p04`, `p06` and `p08` merely use
   parameterised types in signatures, and the two facts are reported apart. */

const GENERIC_DECL = /\b(?:fn|type)\s+[A-Za-z_][A-Za-z0-9_]*\s*</

type Tag = { text: string; note: string }

function exercises(p: CorpusEntry): Tag[] {
  const tags: Tag[] = []
  const root = p.syntax?.root
  const counts = p.semantic.counts

  if (root) {
    if (root.functionCount > 0) {
      tags.push({
        text: `functions ${root.functionCount}`,
        note: 'Function declarations reported by zero parse --json for src/main.0.',
      })
    }
    if (root.shapeCount > 0) {
      tags.push({ text: `shapes ${root.shapeCount}`, note: 'type declarations in src/main.0.' })
    }
    if (root.enumCount > 0) {
      tags.push({ text: `enums ${root.enumCount}`, note: 'enum declarations in src/main.0.' })
    }
    if (root.choiceCount > 0) {
      tags.push({ text: `choices ${root.choiceCount}`, note: 'choice declarations in src/main.0.' })
    }
  }

  if (counts) {
    if (counts.fallibleCalls > 0) {
      tags.push({
        text: `fallible calls ${counts.fallibleCalls}`,
        note: 'Calls the checker marks as able to raise (semantic.counts.fallibleCalls).',
      })
    }
    if (counts.borrowing > 0) {
      tags.push({
        text: `borrowing ${counts.borrowing}`,
        note: 'Borrow facts recorded by the checker (semantic.counts.borrowing).',
      })
    }
    if (counts.ownership > 0) {
      tags.push({
        text: `ownership ${counts.ownership}`,
        note: 'Ownership facts recorded by the checker (semantic.counts.ownership).',
      })
    }
    if (counts.effects > 0) {
      tags.push({
        text: `effects ${counts.effects}`,
        note: 'Effect rows the checker attributes to this package.',
      })
    }
  }

  if (p.sources.some((s) => GENERIC_DECL.test(s.text))) {
    tags.push({
      text: 'generic declarations',
      note: 'A fn or type declared with a type parameter list in the source.',
    })
  }

  const parameterised = p.semantic.functions.filter(
    (f) => f.returnType.includes('<') || f.params.some((x) => x.type.includes('<'))
  ).length
  if (parameterised > 0) {
    tags.push({
      text: `parameterised signatures ${parameterised}`,
      note: 'Checked functions whose parameter or return type carries a type argument.',
    })
  }

  return tags
}

/* --------------------------------------------------------------- fragments */

function PillRow({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return <p className="meta" style={{ margin: 0 }}>No distinguishing facts recorded.</p>
  }
  return (
    <ul
      /* `list-style: none` drops list semantics in Safari; the role puts them
         back, so the count of facts is still announced. */
      role="list"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
        listStyle: 'none', margin: 0, padding: 0,
      }}
    >
      {tags.map((t) => (
        <li key={t.text}>
          <span className="pill" title={t.note}>{t.text}</span>
        </li>
      ))}
    </ul>
  )
}

function OutputBlock({
  title, meta, text, empty,
}: {
  title: string; meta?: string; text: string; empty: ReactNode
}) {
  const body = clean(text)
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{title}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      {body.length > 0 ? (
        <pre><code>{body}</code></pre>
      ) : (
        <div style={{ padding: '0.8125rem 1rem' }}>{empty}</div>
      )}
    </div>
  )
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">
        {value}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------ the gallery */

const selectorBase: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '0.0625rem',
  font: 'inherit',
  fontSize: '0.8125rem',
  lineHeight: 1.3,
  color: 'var(--text)',
  border: '1px solid',
  borderRadius: 4,
  padding: '0.4375rem 0.625rem',
  minHeight: 44,
  justifyContent: 'center',
  cursor: 'pointer',
  textAlign: 'left',
}

function ProgramPanel({ program, host }: { program: CorpusEntry; host: string | null }) {
  const artifact = program.metrics.artifact
  const ir = loweredIrBytes(program)
  const lower = phaseMs(program, 'lower')
  const hostBuild = host ? program.buildMatrix[host] : undefined
  const tests = testCount(program)

  return (
    <div>
      <h3 className="heading-20 mono" style={{ marginBottom: '0.25rem' }}>{program.id}</h3>
      <p className="meta" style={{ margin: '0 0 1.125rem' }}>
        {program.metrics.files} files · {int(program.metrics.lines)} lines ·{' '}
        {int(program.metrics.totalTokens)} tokens including trivia ·{' '}
        {orDash(program.metrics.graphEdges)} graph edges
      </p>

      <div className="stat-strip">
        <Stat value={int(program.metrics.nonEmptyLines)} label="Non-empty lines" />
        <Stat value={int(program.metrics.codeTokens)} label="Code tokens" />
        <Stat value={orDash(program.metrics.graphNodes)} label="Graph nodes" />
        <Stat value={orDash(ir)} unit="B" label="Lowered IR" />
        {artifact ? (
          <Stat value={int(artifact.bytes)} unit="B" label={`Artifact (${host ?? 'host'})`} />
        ) : (
          <Stat
            value="none"
            label={`No artifact · ${hostBuild?.code ?? 'build refused'} on ${host ?? 'the host target'}`}
          />
        )}
        <Stat value={orDash(lower)} unit="ms" label="lower phase" />
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <span className="label">What it exercises</span>
        <div style={{ marginTop: '0.4375rem' }}>
          <PillRow tags={exercises(program)} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        {program.sources.map((s) => (
          <div key={s.file} id={`file-${program.id}-${s.file.replace(/\W/g, '-')}`}>
            <ZeroCode
              src={s.text}
              file={`${program.id}/${s.file}`}
              meta={`${int(s.nonEmptyLines)} of ${int(s.lines)} lines · ${int(s.bytes)} B`}
            />
            {/* The paper is a claim about a repository; every file it shows can
                be checked against the copy that produced the measurements. */}
            <div className="no-print" style={{ marginTop: '0.4375rem' }}>
              <ViewOnGithub href={githubUrl(program.id, s.file)} what={s.file} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div>
          <div
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              gap: '0.5rem', marginBottom: '0.5rem',
            }}
          >
            <span className="label">Tests</span>
            <span className={program.execution.testsOk ? 'pill pill-ok' : 'pill pill-bad'}>
              <Icon name={program.execution.testsOk ? 'check' : 'cross'} size={13} />
              {program.execution.testsOk ? 'passed' : 'failed'}
              {tests == null ? '' : tests === 0 ? ' · no test blocks' : ` · ${tests} tests`}
            </span>
          </div>
          <OutputBlock
            title="zero test"
            text={program.execution.testStdout}
            empty={<span className="meta">The command produced no output.</span>}
          />
        </div>

        <div>
          <div
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              gap: '0.5rem', marginBottom: '0.5rem',
            }}
          >
            <span className="label">Run</span>
            <span className={program.execution.ranOk ? 'pill pill-ok' : 'pill pill-bad'}>
              <Icon name={program.execution.ranOk ? 'check' : 'cross'} size={13} />
              {program.execution.ranOk ? 'ran' : 'did not run'}
            </span>
          </div>
          <OutputBlock
            title={artifact ? artifact.path : 'no artifact'}
            text={program.execution.stdout}
            empty={
              <p className="meta" style={{ margin: 0, whiteSpace: 'normal' }}>
                {hostBuild && !hostBuild.ok
                  ? `The front end accepted this program, but the direct backend refused to
                     lower it for ${host}: ${hostBuild.code ?? 'build error'}, unsupported
                     construct ${hostBuild.actual ?? 'unspecified'}. There is no executable to
                     run, so there is no output — not zero bytes of output.`
                  : 'No executable was produced for the host target, so there is no output.'}
              </p>
            }
          />
        </div>
      </div>
    </div>
  )
}

export function ProgramGallery({ capture }: { capture: Capture }) {
  const corpus = capture.corpus
  const host = capture.toolchain.host
  const [id, setId] = useState(corpus[0]?.id ?? '')

  /* The panel enter runs for a pointer press only. A keyboard user moving
     through the list gets the swap immediately: animating a keyboard-initiated
     change puts 220 ms between the key and the answer. */
  const [animate, setAnimate] = useState(false)

  /* A reference anywhere in the paper can ask the gallery to open a file. The
     two components stay ignorant of each other: the reference broadcasts, this
     listens, and the scroll is handled by the caller so the gallery does not
     have to know why it was opened. The requested file is then brought into
     view within the panel, because selecting the program alone can still leave
     src/lib.0 below the fold. */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenFileDetail>).detail
      if (!detail || !corpus.some((c) => c.id === detail.program)) return
      setAnimate(false)
      setId(detail.program)
      // Wait for the panel to render the newly selected program.
      requestAnimationFrame(() => {
        const target = document.getElementById(
          `file-${detail.program}-${detail.file.replace(/\W/g, '-')}`,
        )
        target?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
        })
      })
    }
    window.addEventListener(OPEN_FILE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_FILE_EVENT, onOpen)
  }, [corpus])

  const program = corpus.find((p) => p.id === id) ?? corpus[0]
  const panelId = 'program-gallery-panel'

  if (!program) {
    return <p className="body">No corpus was captured, so there is nothing to show.</p>
  }

  return (
    <div>
      <div className="no-print">
        <div
          role="group"
          aria-label="Corpus programs"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1.5rem' }}
        >
          {corpus.map((p) => {
            const selected = p.id === program.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                aria-controls={panelId}
                onClick={(e) => {
                  /* detail is 0 when a button is activated from the keyboard. */
                  setAnimate(e.detail > 0)
                  setId(p.id)
                }}
                style={{
                  ...selectorBase,
                  fontWeight: selected ? 560 : 460,
                  background: selected ? 'var(--bg-raised)' : 'transparent',
                  borderColor: selected ? 'var(--text)' : 'var(--border)',
                  boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <span className="mono" style={{ fontSize: '0.75rem' }}>{p.id}</span>
                <span
                  className="meta"
                  style={{ color: selected ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
                >
                  {int(p.metrics.nonEmptyLines)} lines
                </span>
              </button>
            )
          })}
        </div>

        <div id={panelId} key={program.id} className={animate ? 'swap-enter' : undefined}>
          <ProgramPanel program={program} host={host} />
        </div>
      </div>

      {/* In print the tab strip is meaningless and only the selected program
          would survive, so the printed edition carries every source instead.
          Both blocks are never visible at once: one is display:none in each
          medium, which also keeps it out of the accessibility tree. */}
      <div className="print-only">
        {corpus.map((p) => {
          const artifact = p.metrics.artifact
          return (
            <section key={p.id} style={{ marginBottom: '1.5rem' }}>
              <h3 className="heading-20 mono">{p.id}</h3>
              <p className="meta">
                {int(p.metrics.nonEmptyLines)} non-empty lines ·{' '}
                {int(p.metrics.codeTokens)} code tokens ·{' '}
                {orDash(p.metrics.graphNodes)} graph nodes ·{' '}
                {orDash(loweredIrBytes(p))} B lowered IR ·{' '}
                {artifact ? `${int(artifact.bytes)} B artifact` : 'no artifact (BLD004)'} ·{' '}
                {orDash(phaseMs(p, 'lower'))} ms in lower
              </p>
              {p.sources.map((s) => (
                <div className="code-block" key={s.file} style={{ marginBottom: '0.75rem' }}>
                  <div className="code-head">
                    <span>{p.id}/{s.file}</span>
                    <span>{int(s.nonEmptyLines)} non-empty lines</span>
                  </div>
                  <pre><code>{s.text}</code></pre>
                </div>
              ))}
              <p className="meta">
                Tests: {p.execution.testsOk ? 'passed' : 'failed'}. Output:{' '}
                {clean(p.execution.stdout) || 'none — the host target refuses to build it.'}
              </p>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- run emulation */

const STEP_MS = 450

const PHASE_ICON: Record<string, IconName> = {
  resolve: 'graph',
  parse: 'tree',
  interface: 'gate',
  check: 'check',
  lower: 'layers',
  codegen: 'chip',
  object: 'bytes',
  link: 'link',
  run: 'terminal',
}

const PHASE_NOTE: Record<string, string> = Object.fromEntries(
  ZERO_PHASES.map((p) => [p.name, p.note])
)

type Fact = { label: string; value: string }

type Step = {
  name: string
  ms: number | null
  facts: Fact[]
  note: string
  warning: string | null
  /* Always present, so the stdout panel occupies the same space at every step
     and the last step does not shove the page down as it arrives. */
  output: { text: string; empty: string }
}

function factsFor(name: string, p: CorpusEntry, host: string | null): Fact[] {
  const t = p.semantic.tables
  const c = p.semantic.counts
  const target = p.backend.target
  const artifact = p.metrics.artifact
  const hostBuild = host ? p.buildMatrix[host] : undefined

  switch (name) {
    case 'resolve':
      return [
        { label: 'symbol rows', value: orDash(t?.symbol) },
        { label: 'scope rows', value: orDash(t?.scope) },
        { label: 'references bound', value: orDash(p.semantic.resolution?.references) },
        { label: 'diagnostics', value: orDash(p.semantic.resolution?.diagnostics) },
      ]
    case 'parse':
      return [
        { label: 'tokens', value: int(p.metrics.totalTokens) },
        { label: 'code tokens', value: int(p.metrics.codeTokens) },
        { label: 'declarations', value: orDash(t?.declaration) },
        { label: 'functions in main', value: orDash(p.syntax?.root?.functionCount) },
      ]
    case 'interface':
      return [
        { label: 'modules', value: orDash(t?.module) },
        { label: 'imports', value: orDash(t?.import) },
        { label: 'public functions', value: int(p.semantic.functions.filter((f) => f.public).length) },
        { label: 'projections', value: orDash(t?.projection) },
      ]
    case 'check':
      return [
        { label: 'typed nodes', value: orDash(c?.typedNodes) },
        { label: 'type rows', value: orDash(t?.type) },
        { label: 'contracts', value: orDash(c?.contracts) },
        { label: 'diagnostics', value: orDash(c?.diagnostics) },
      ]
    case 'lower':
      return [
        { label: 'graph nodes in', value: orDash(p.metrics.graphNodes) },
        { label: 'lowered IR out', value: `${orDash(loweredIrBytes(p))} B` },
        { label: 'printable IR', value: p.backend.irEmitted ? `${int(p.backend.irLines)} lines` : 'none' },
        { label: 'ownership rows', value: orDash(t?.ownership) },
      ]
    case 'codegen':
      return [
        { label: 'backend', value: target?.backend ?? DASH },
        { label: 'target', value: target?.target ?? DASH },
        { label: 'emit', value: target?.emit ?? DASH },
        { label: 'stage', value: target?.stage ?? DASH },
      ]
    case 'object':
      return [
        { label: 'object format', value: target?.objectFormat ?? DASH },
        { label: 'buildable', value: target ? (target.buildable ? 'yes' : 'no') : DASH },
        { label: 'host build', value: hostBuild ? (hostBuild.ok ? 'ok' : hostBuild.code ?? 'failed') : DASH },
        { label: 'host build time', value: hostBuild ? `${hostBuild.ms} ms` : DASH },
      ]
    case 'link':
      return [
        { label: 'artifact', value: artifact ? `${int(artifact.bytes)} B` : 'none' },
        { label: 'path', value: artifact?.path ?? DASH },
        { label: 'cacheable', value: 'no' },
        { label: 'targets that link', value: `${Object.values(p.buildMatrix).filter((b) => b.ok).length} of ${Object.keys(p.buildMatrix).length}` },
      ]
    default:
      return [
        { label: 'exit', value: p.execution.ranOk ? 'ran' : 'no artifact' },
        { label: 'tests', value: p.execution.testsOk ? `${testCount(p) ?? 0} ok` : 'failed' },
        { label: 'artifact', value: artifact ? `${int(artifact.bytes)} B` : 'none' },
        { label: 'target', value: host ?? DASH },
      ]
  }
}

function buildSteps(p: CorpusEntry, host: string | null): Step[] {
  const hostBuild = host ? p.buildMatrix[host] : undefined
  const blocked = hostBuild != null && !hostBuild.ok

  const compilePhases: Step[] = timedPhases(p).map((phase) => ({
    name: phase.name,
    ms: phase.elapsedMs,
    facts: factsFor(phase.name, p, host),
    note: PHASE_NOTE[phase.name] ?? '',
    warning:
      blocked && (phase.name === 'codegen' || phase.name === 'object' || phase.name === 'link')
        ? `The compiler reports this phase, but on ${host} the build stops before it completes: ` +
          `${hostBuild?.code ?? 'build error'} on ${hostBuild?.actual ?? 'an unsupported construct'}.`
        : null,
    output: { text: '', empty: 'Nothing has run yet. Standard output arrives at the run step.' },
  }))

  return [
    ...compilePhases,
    {
      name: 'run',
      ms: null,
      facts: factsFor('run', p, host),
      note: blocked
        ? 'No artifact reached the host, so there was nothing to execute.'
        : 'The artifact executed on the host, with its stdout captured verbatim.',
      warning: blocked
        ? `${p.id} never runs on ${host}. There is no executable, so there is no output.`
        : null,
      output: {
        text: p.execution.stdout,
        empty: blocked
          ? `No artifact was produced (${hostBuild?.code ?? 'build error'}), so nothing ran.`
          : 'The program produced no output on stdout.',
      },
    },
  ]
}

/* Glyphs the shared icon set has no member for. Same construction rules —
   24-unit box, 1.75 stroke, round caps, whole and half coordinates — so they
   sit beside an Icon without reading as a second set. Each is decorative: the
   word beside it in the button is what carries the meaning. */
function Glyph({ d, size = 16 }: { d: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: '-0.145em', flex: '0 0 auto' }}
    >
      {d}
    </svg>
  )
}

/* `.btn` paints its own background, so the user agent's disabled rendering
   never shows through. A control at the end of its range has to look spent as
   well as report `disabled`, or the only signal is the click doing nothing. */
function spent(off: boolean): CSSProperties | undefined {
  return off ? { opacity: 0.45, cursor: 'default', boxShadow: 'none' } : undefined
}

const PAUSE = <path d="M9.5 6V18M14.5 6V18" />
const STEP_BACK = (
  <>
    <path d="M17.5 6.5L8.5 12L17.5 17.5Z" />
    <path d="M6 6.5V17.5" />
  </>
)
const STEP_FORWARD = (
  <>
    <path d="M6.5 6.5L15.5 12L6.5 17.5Z" />
    <path d="M18 6.5V17.5" />
  </>
)

export function RunEmulation({
  capture, programId,
}: {
  capture: Capture; programId?: string
}) {
  const corpus = capture.corpus
  const host = capture.toolchain.host
  const [id, setId] = useState(programId ?? corpus[0]?.id ?? '')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(q.matches)
    apply()
    q.addEventListener('change', apply)
    return () => q.removeEventListener('change', apply)
  }, [])

  const program = corpus.find((p) => p.id === id) ?? corpus[0]
  const steps = useMemo(
    () => (program ? buildSteps(program, host) : []),
    [program, host]
  )
  const last = steps.length - 1

  /* One timer per step, cancelled on every state change, so pausing, stepping
     or jumping mid-flight takes effect on the next frame rather than after the
     current interval drains. The run stops itself from inside the timer rather
     than from the effect body, which would cascade a render. */
  useEffect(() => {
    if (!playing || index >= last) return
    const t = window.setTimeout(() => {
      const next = Math.min(index + 1, last)
      setIndex(next)
      if (next >= last) setPlaying(false)
    }, STEP_MS)
    return () => window.clearTimeout(t)
  }, [playing, index, last])

  if (!program || steps.length === 0) {
    return <p className="body">No phase timings were captured, so there is nothing to replay.</p>
  }

  const step = steps[Math.min(index, last)]
  const listId = 'run-emulation-steps'

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    /* With reduced motion requested the control still works — it resolves the
       whole sequence at once instead of being taken away. */
    if (reduced) {
      setIndex(last)
      return
    }
    if (index >= last) setIndex(0)
    setPlaying(true)
  }

  const goTo = (n: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(n, last)))
  }

  return (
    <figure className="figure">
      <div className="figure-head">
        <span className="heading-16" style={{ margin: 0 }}>
          Recorded replay — not a live compile
        </span>
        <span className="meta">{program.id}</span>
      </div>

      <div className="figure-body">
        {/* ------------------------------------------------------- controls */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
            gap: '0.75rem', marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label className="label" htmlFor="run-emulation-program">Program</label>
            <select
              id="run-emulation-program"
              value={program.id}
              onChange={(e) => {
                setPlaying(false)
                setIndex(0)
                setId(e.target.value)
              }}
              style={{
                font: 'inherit',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                background: 'var(--bg-raised)',
                border: 'var(--rule)',
                borderRadius: 'var(--radius-sm)',
                minHeight: 40,
                padding: '0.4375rem 0.625rem',
                maxWidth: '100%',
              }}
            >
              {corpus.map((p) => (
                <option key={p.id} value={p.id}>{p.id}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            <button type="button" className="btn btn-accent" onClick={togglePlay}>
              {playing ? <Glyph d={PAUSE} /> : <Icon name="play" size={16} />}
              {playing ? 'Pause' : index >= last ? 'Replay' : 'Play'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              style={spent(index === 0)}
            >
              <Glyph d={STEP_BACK} />
              Back
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => goTo(index + 1)}
              disabled={index >= last}
              style={spent(index >= last)}
            >
              <Glyph d={STEP_FORWARD} />
              Forward
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => goTo(0)}
              disabled={index === 0 && !playing}
              style={spent(index === 0 && !playing)}
            >
              Reset
            </button>
          </div>
        </div>

        <p className="meta" role="status" style={{ margin: '0 0 0.5rem' }}>
          Step {index + 1} of {steps.length} — {step.name}
          {reduced ? ' · reduced motion is on, so play resolves the whole sequence at once' : ''}
        </p>

        {/* Transform only, from a left origin, so the fill grows without a
            layout pass. The textual counter above carries the same value. */}
        <div
          aria-hidden="true"
          style={{
            height: 4, borderRadius: 2, background: 'var(--data-grid)',
            overflow: 'hidden', marginBottom: '1rem',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--accent)',
              transformOrigin: 'left center',
              transform: `scaleX(${(index + 1) / steps.length})`,
              transition: reduced ? 'none' : 'transform var(--dur-move) var(--ease-in-out)',
            }}
          />
        </div>

        {/* ---------------------------------------------------- step chooser */}
        <ol
          id={listId}
          role="list"
          aria-label="Reported phases"
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.3125rem',
            listStyle: 'none', margin: '0 0 1.25rem', padding: 0,
          }}
        >
          {steps.map((s, i) => {
            const current = i === index
            const done = i < index
            return (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current ? 'step' : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    font: 'inherit', fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: current ? 560 : 460,
                    minHeight: 32,
                    padding: '0.25rem 0.5rem',
                    color: current ? 'var(--text)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    background: current ? 'var(--bg-raised)' : 'transparent',
                    border: '1px solid',
                    borderColor: current ? 'var(--text)' : done ? 'var(--border)' : 'var(--border-faint)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <Icon name={done ? 'check' : PHASE_ICON[s.name] ?? 'graph'} size={13} />
                  {s.name}
                </button>
              </li>
            )
          })}
        </ol>

        {/* ------------------------------------------------------ step detail
            Height is reserved, and the stdout panel below is rendered at every
            step, so advancing does not reflow the page under the reader. */}
        <div style={{ minHeight: 200 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              gap: '0.5rem', marginBottom: '0.375rem',
            }}
          >
            <Icon name={PHASE_ICON[step.name] ?? 'graph'} size={18} />
            <span className="heading-16 mono" style={{ margin: 0 }}>{step.name}</span>
            {step.ms != null ? (
              <span className="pill">
                <Icon name="clock" size={13} />
                {int(step.ms)} ms
              </span>
            ) : (
              <span className="pill">host execution</span>
            )}
            {step.warning ? (
              <span className="pill pill-bad">
                <Icon name="warning" size={13} />
                blocked
              </span>
            ) : null}
          </div>

          {step.note ? (
            <p className="caption" style={{ margin: '0 0 0.875rem', maxWidth: 'var(--measure)' }}>
              {step.note}
            </p>
          ) : null}

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
              gap: '0.875rem',
              margin: 0,
            }}
          >
            {step.facts.map((f) => (
              <div key={f.label}>
                <dt className="meta" style={{ marginBottom: '0.125rem' }}>{f.label}</dt>
                <dd
                  className="mono"
                  style={{ margin: 0, fontSize: '0.9375rem', overflowWrap: 'anywhere' }}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          {step.warning ? (
            <p
              className="body"
              style={{
                margin: '0.875rem 0 0',
                padding: '0.625rem 0.75rem',
                fontSize: '0.8125rem',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--bad)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bad-quiet)',
                maxWidth: 'var(--measure)',
              }}
            >
              {step.warning}
            </p>
          ) : null}

        </div>

        <div style={{ marginTop: '0.875rem' }}>
          <OutputBlock
            title={`${program.id} stdout`}
            meta={host ?? undefined}
            text={step.output.text}
            empty={<span className="meta">{step.output.empty}</span>}
          />
        </div>
      </div>

      <figcaption className="caption" style={{ padding: '0 1rem 1rem', margin: 0 }}>
        The eight steps are the phases <code>zero time --json</code> reported for this package on
        a cold run; the ninth is the captured run. Nothing compiles in the browser — the values
        advance at a fixed {STEP_MS} ms and can be paused, stepped or jumped at any point. Seven
        of the eight phases report 0 ms; only <code>lower</code> is resolvable at millisecond
        granularity, which is the measurement the paper builds on.
      </figcaption>
    </figure>
  )
}
