'use client'

/* Section 9. A two-pane playground: a Zero editor on the left, a terminal on
   the right.

   The honesty constraint is the whole design. Two of the six classical phases
   can genuinely run in a browser, because lib/zero-lang.ts reimplements them and
   that reimplementation is diffed token-for-token against the compiler's own
   `zero tokens --json` and `zero parse --json` output for every corpus program.
   The other four cannot: Zero 0.3.4 ships no WebAssembly target and its own
   `selfHostRouting` report marks `browserCompiler` as removed.

   So the terminal splits its commands in two, and says which is which:
     - `zero tokens`, `zero parse` and `zero check` run here, on whatever is in
       the buffer, including text no compiler has ever seen;
     - `zero graph`, `zero time`, `zero build` and `zero run` replay the recorded
       capture, and are refused the moment the buffer stops matching the program
       that recording belongs to. Showing a captured graph beside edited source
       would be the one lie this paper cannot afford.

   Motion: none. Typing in an editor and submitting a command are the
   hundred-times-a-day interactions the animations skill names explicitly, so
   output appears in the same frame it is produced — no typing effect, no
   staged reveal, no artificial latency. The only moving thing is the text
   caret, which is the browser's own and therefore already obeys the reader's
   system settings.

   Heading contract: the page owns <h1> and the section owns <h2>, so the two
   panes own <h3>. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Capture, CorpusEntry } from '@/lib/types'
import type { ZeroParse, ZeroToken } from '@/lib/zero-lang'
import { parse, tokenize, ZERO_KEYWORDS, ZERO_TYPES } from '@/lib/zero-lang'
import { Icon } from '@/components/icons'
import { play } from '@/lib/sound'

/* --------------------------------------------------------------- constants */

/* One size for every monospace surface here, so the highlight layer behind the
   textarea can never drift from the text in front of it. It has to be a single
   literal rather than a class, because globals.css raises form-control text to
   16px under 720px to stop iOS zooming on focus — which would move one layer
   and not the other. The expression does that job itself: 13px on a desktop
   column, ramping to the 16px floor by the time the panes have stacked. */
const MONO_SIZE = 'clamp(13px, calc(13px + (900px - 100vw) * 0.0075), 16px)'
const MONO_LEADING = 1.55
const PAD_Y = '0.6875rem'
const PAD_X = '0.75rem'

/* The terminal wraps its own prose at a fixed column count rather than relying
   on soft wrapping, so an indented note stays indented and a table never
   reflows into nonsense. 48 is what fits without a horizontal scrollbar in the
   narrower of the two panes at the width this section actually gets — the
   article column is 878px on a 1280px screen, not 1280px — so every table below
   is built to land inside it. */
const COLS = 48

const MAIN_FILE = 'src/main.0'
const START_PROGRAM = 'p02_arith'

const int = (n: number) => n.toLocaleString('en-US')
const ms1 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/* Greedy word wrap. `indent` applies to continuation lines only, so a wrapped
   sentence hangs under its own first line instead of squaring off. */
function wrapText(s: string, width: number, indent = ''): string[] {
  const words = s.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  const pad = () => (lines.length === 0 ? '' : indent)
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && pad().length + next.length > width) {
      lines.push(pad() + cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(pad() + cur)
  return lines
}

function clip(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

/* ------------------------------------------------------------- highlighting */

/* A second, deliberately separate pass over the same text. `tokenize` reports
   byte offsets, which cannot be used to slice a JavaScript string safely, and it
   drops whitespace — an overlay needs every character back in order. So this
   walks the source directly and emits runs that concatenate to exactly the
   input. It borrows the two word sets from lib/zero-lang so a keyword is never
   coloured here and treated as an identifier there. */
type Piece = { cls: string; text: string }

const IDENT_START = /[A-Za-z_]/
const IDENT_PART = /[A-Za-z0-9_]/
const NUM_PART = /[0-9A-Za-z_]/

function highlight(src: string): Piece[] {
  const out: Piece[] = []
  const push = (cls: string, text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.cls === cls) last.text += text
    else out.push({ cls, text })
  }

  let i = 0
  while (i < src.length) {
    const c = src[i]

    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      const stop = nl === -1 ? src.length : nl
      push('tok-com', src.slice(i, stop))
      i = stop
      continue
    }

    if (c === '"') {
      let j = i + 1
      while (j < src.length) {
        const d = src[j]
        if (d === '\\') { j += 2; continue }
        if (d === '"') { j += 1; break }
        if (d === '\n') break
        j += 1
      }
      push('tok-str', src.slice(i, j))
      i = j
      continue
    }

    if (c >= '0' && c <= '9') {
      let j = i + 1
      while (j < src.length && (NUM_PART.test(src[j]) || (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')))) j += 1
      push('tok-num', src.slice(i, j))
      i = j
      continue
    }

    if (IDENT_START.test(c)) {
      let j = i + 1
      while (j < src.length && IDENT_PART.test(src[j])) j += 1
      const word = src.slice(i, j)
      const cls =
        ZERO_KEYWORDS.has(word) ? 'tok-kw'
          : ZERO_TYPES.has(word) ? 'tok-type'
            : src[j] === '(' ? 'tok-fn'
              : ''
      push(cls, word)
      i = j
      continue
    }

    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') {
      push('', c)
      i += 1
      continue
    }

    push('tok-punc', c)
    i += 1
  }

  return out
}

/* --------------------------------------------------------------- analysis */

type Analysis = {
  tokens: ZeroToken[]
  parsed: ZeroParse
  lines: number
  codeTokens: number
}

/* `codeTokens` matches the capture's own definition: every token except
   newline. Verified against metrics.codeTokens for all eight programs. */
function analyse(src: string): Analysis {
  const tokens = tokenize(src)
  return {
    tokens,
    parsed: parse(tokens),
    lines: src.length === 0 ? 1 : src.split('\n').length,
    codeTokens: tokens.reduce((n, t) => n + (t.kind === 'newline' ? 0 : 1), 0),
  }
}

const KIND_ORDER = ['word', 'symbol', 'number', 'string', 'comment', 'newline', 'error', 'eof']

function countByKind(tokens: ZeroToken[]): { kind: string; n: number }[] {
  const seen = new Map<string, number>()
  for (const t of tokens) seen.set(t.kind, (seen.get(t.kind) ?? 0) + 1)
  const known = KIND_ORDER.filter((k) => seen.has(k))
  const rest = [...seen.keys()].filter((k) => !KIND_ORDER.includes(k)).sort()
  return [...known, ...rest].map((kind) => ({ kind, n: seen.get(kind) ?? 0 }))
}

/* The line the buffer first departs from the recording, 1-based, or 0 when the
   two are identical. Reported instead of a bare "edited" so the reader can see
   what the refusal is about. */
function firstDiffLine(a: string, b: string): number {
  const x = a.split('\n')
  const y = b.split('\n')
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i + 1
  return 0
}

/* --------------------------------------------------------------- terminal */

type LineKind = 'cmd' | 'out' | 'key' | 'dim' | 'ok' | 'bad'
type Out = { kind: LineKind; text: string }
type Line = Out & { id: number }

const line = (text: string, kind: LineKind = 'out'): Out => ({ kind, text })
const blank = (): Out => ({ kind: 'out', text: '' })
const note = (text: string): Out[] =>
  wrapText(text, COLS - 6, '').map((t, i) => line(i === 0 ? `note: ${t}` : `      ${t}`, 'dim'))
const flow = (text: string, indent = ''): Out[] =>
  wrapText(text, COLS, indent).map((t) => line(t))
/* Errors hang under the `error: ` prefix so the second line is obviously a
   continuation and not a second failure. */
const fail = (text: string): Out[] =>
  wrapText(`error: ${text}`, COLS, '       ').map((t) => line(t, 'bad'))

/* Every report opens the same way: what was read, then how it was produced. */
const header = (what: string, how: string): Out[] => [
  line(what, 'key'),
  line(how, 'dim'),
  blank(),
]

const LINE_COLOR: Record<LineKind, string> = {
  cmd: 'var(--text)',
  out: 'var(--text-secondary)',
  key: 'var(--text)',
  dim: 'var(--text-tertiary)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
}

const BANNER: Out[] = [
  line('zero playground', 'key'),
  line('phases 1 and 2 run here; 3 to 6 are replayed', 'dim'),
  line('type `help` for the command list', 'dim'),
  blank(),
]

/* ------------------------------------------------------------- command help */

const HELP_ROWS: [string, string, string][] = [
  ['zero tokens', 'token stream, counts', 'here'],
  ['zero parse', 'declarations', 'here'],
  ['zero check', 'what this parser decides', 'here'],
  ['zero graph', 'stored graph tables', 'replay'],
  ['zero time', 'phase timings, cold', 'replay'],
  ['zero build', 'one build per target', 'replay'],
  ['zero run', 'recorded stdout', 'replay'],
  ['load <prog>', 'swap the buffer', ''],
  ['clear', 'empty the scrollback', ''],
  ['help', 'this list', ''],
]

function helpOutput(ids: string[]): Out[] {
  const out: Out[] = [line(`${'command'.padEnd(16)}${'does'.padEnd(26)}runs`, 'key')]
  for (const [cmd, what, where] of HELP_ROWS) {
    out.push(line(`${cmd.padEnd(16)}${what.padEnd(26)}${where}`))
  }
  out.push(blank())
  out.push(...note(
    'a replayed command reads the recorded capture, so it is refused once ' +
    'the buffer stops matching the program that recording belongs to.'
  ))
  out.push(blank())
  out.push(line('programs', 'key'))
  for (const t of wrapText(`${ids.join(' ')} scratch`, COLS - 2)) out.push(line(`  ${t}`))
  return out
}

/* -------------------------------------------------- phase 1 and 2 commands */

function tokensOutput(a: Analysis, label: string): Out[] {
  const counts = countByKind(a.tokens)
  const out: Out[] = header(label, 'client lexer, run on the buffer as typed')
  out.push(line(`${'kind'.padEnd(12)}${'count'.padStart(6)}`, 'key'))
  for (const { kind, n } of counts) {
    out.push(line(`${kind.padEnd(12)}${int(n).padStart(6)}`))
  }
  out.push(line(`${'total'.padEnd(12)}${int(a.tokens.length).padStart(6)}`, 'key'))
  out.push(line(`${'code'.padEnd(12)}${int(a.codeTokens).padStart(6)}  no newlines`, 'dim'))

  const code = a.tokens.filter((t) => t.kind !== 'newline')
  const shown = code.slice(0, 10)
  if (shown.length > 0) {
    out.push(blank())
    out.push(line(`${'line:col'.padEnd(10)}${'kind'.padEnd(9)}text`, 'key'))
    for (const t of shown) {
      out.push(line(
        `${`${t.line}:${t.column}`.padEnd(10)}${t.kind.padEnd(9)}${clip(JSON.stringify(t.text), 24)}`
      ))
    }
    if (code.length > shown.length) {
      out.push(line(`+${int(code.length - shown.length)} more`, 'dim'))
    }
  }
  return out
}

function parseOutput(a: Analysis, label: string): Out[] {
  const p = a.parsed
  const out = header(label, 'client declaration parser')

  out.push(line(
    `functions ${p.functions.length}   shapes ${p.shapes.length}   enums ${p.enums.length}`
  ))
  out.push(line(
    `choices ${p.choices.length}   consts ${p.consts.length}   imports ${p.imports.length}`
  ))

  if (p.functions.length > 0) {
    out.push(blank())
    out.push(line(`${'line'.padStart(4)}  ${'name/arity'.padEnd(18)}${'ret'.padEnd(10)}body`, 'key'))
    for (const f of p.functions) {
      out.push(line(
        `${String(f.line).padStart(4)}  ${clip(`${f.name}/${f.paramCount}`, 16).padEnd(18)}` +
        `${clip(f.returnType, 8).padEnd(10)}${clip(f.bodyKinds.join(' ') || '—', 14)}`
      ))
    }
  }

  for (const s of p.shapes) {
    out.push(...flow(`type ${s.name} { ${s.fields.map((f) => `${f.name}: ${f.type}`).join(', ')} }`, '  '))
  }
  for (const e of p.enums) out.push(...flow(`enum ${e.name} { ${e.cases.join(', ')} }`, '  '))
  for (const ch of p.choices) {
    out.push(...flow(`choice ${ch.name} { ${ch.cases.map((c) => c.name).join(', ')} }`, '  '))
  }
  for (const c of p.consts) out.push(line(`const ${c.name}${c.type ? `: ${c.type}` : ''}`))
  for (const im of p.imports) out.push(line(`use ${im.module}`))

  if (p.functions.some((f) => f.isTest)) {
    out.push(blank())
    out.push(...note(
      'a test block is reported as a function named __zero_test_<n> ' +
      'returning Void, which is what zero parse --json calls it.'
    ))
  }
  return out
}

function checkOutput(a: Analysis, program: CorpusEntry | null, pristine: boolean): Out[] {
  const d = a.parsed.diagnostics
  const out: Out[] = []

  if (d.length === 0) {
    for (const t of wrapText('ok: nothing this parser can decide is wrong here.', COLS, '    ')) {
      out.push(line(t, 'ok'))
    }
  } else {
    for (const x of d) {
      out.push(line(`error: ${x.code} ${x.message}`, 'bad'))
      out.push(line(`       ${x.line}:${x.column}`, 'dim'))
      if (x.help) out.push(line(`       help: ${x.help}`, 'dim'))
    }
    out.push(line(`${d.length} diagnostic${d.length === 1 ? '' : 's'}.`, 'bad'))
  }

  out.push(blank())
  out.push(...note(
    'this is the client parser. It decides two codes: PAR100 for an ' +
    'unclassifiable byte, an unterminated string or an unclosed block, and ' +
    'NAM003 for a call to a name declared nowhere in the buffer. Types, ' +
    'effects, ownership and capability contracts are not checked here. That ' +
    'needs the native compiler, and Zero 0.3.4 has no WebAssembly target.'
  ))

  if (pristine && program?.semantic.checking) {
    const c = program.semantic.checking
    out.push(blank())
    out.push(line(`recorded zero check --json, ${program.id}`, 'key'))
    out.push(line(`  ok         ${c.ok ? 'true' : 'false'}`))
    out.push(line(`  state      ${clip(c.state, 34)}`))
    out.push(line(`  authority  ${clip(c.authority, 34)}`))
    out.push(line(`  sourceText ${c.sourceTextAuthority ? 'true' : 'false'}`))
    out.push(blank())
    out.push(...note(
      'the real check reads stored graph facts, not the text — which is why ' +
      'its verdict belongs to the recorded program, not to this buffer.'
    ))
  }
  return out
}

/* ------------------------------------------------------- replayed commands */

function graphOutput(p: CorpusEntry): Out[] {
  const t = p.semantic.tables
  const out = header(p.id, 'replayed from zero query --json --full')
  if (!t) {
    out.push(line('error: the capture holds no graph tables here.', 'bad'))
    return out
  }
  out.push(line(`${'table'.padEnd(14)}${'rows'.padStart(6)}`, 'key'))
  for (const [k, v] of Object.entries(t)) {
    out.push(line(`${k.padEnd(14)}${int(v).padStart(6)}`))
  }
  out.push(blank())
  const c = p.graph.counts
  if (c) out.push(line(`nodes ${int(c.nodes)}, edges ${int(c.edges)}`, 'dim'))
  if (p.metrics.graphHash) out.push(line(p.metrics.graphHash, 'dim'))
  return out
}

function timeOutput(p: CorpusEntry): Out[] {
  const phases = p.phases.coldTimed.length > 0 ? p.phases.coldTimed : p.phases.cold
  const total = phases.reduce((n, x) => n + x.elapsedMs, 0)
  const out = header(p.id, 'replayed from zero time --json, cold run')
  out.push(line(`${'phase'.padEnd(11)}${'ms'.padStart(5)}   cacheable`, 'key'))
  for (const ph of phases) {
    out.push(line(
      `${ph.name.padEnd(11)}${String(ph.elapsedMs).padStart(5)}   ${ph.cacheable ? 'yes' : 'no'}`
    ))
  }
  out.push(line(`${'total'.padEnd(11)}${String(total).padStart(5)}`, 'key'))

  const wc = p.wallClock.cold
  const cache = p.phases.coldCacheSummary
  out.push(blank())
  out.push(line(
    `wall clock  ${ms1(wc.medianMs)} ms median, ${wc.runs} run${wc.runs === 1 ? '' : 's'}`,
    'dim'
  ))
  if (cache) {
    out.push(line(`cache       ${cache.hits} hit, ${cache.misses} miss`, 'dim'))
  }
  out.push(blank())
  out.push(...note(
    'the compiler reports whole milliseconds, so on a program this size ' +
    'every phase but lower rounds to zero.'
  ))
  return out
}

function buildOutput(p: CorpusEntry): Out[] {
  const rows = Object.entries(p.buildMatrix)
  const okCount = rows.filter(([, m]) => m.ok).length
  const out = header(p.id, 'replayed: one zero build per advertised target')
  out.push(line(`${'target'.padEnd(18)}${'ok'.padEnd(5)}${'bytes'.padStart(9)}${'ms'.padStart(8)}`, 'key'))
  for (const [target, m] of rows) {
    out.push(line(
      `${target.padEnd(18)}${(m.ok ? 'yes' : 'no').padEnd(5)}` +
      `${(m.bytes === null ? '—' : int(m.bytes)).padStart(9)}${ms1(m.ms).padStart(8)}`,
      m.ok ? 'out' : 'bad'
    ))
    if (!m.ok) {
      out.push(line(`  ${m.code ?? 'unknown'}  ${clip(m.actual ?? 'unspecified', 32)}`, 'bad'))
    }
  }
  out.push(blank())
  out.push(line(
    `${okCount} of ${rows.length} targets produced an artifact.`,
    okCount === rows.length ? 'ok' : 'bad'
  ))
  if (okCount < rows.length) {
    out.push(...note(
      'BLD004 is the backend refusing to lower a program the front end ' +
      'already accepted: a target gap, not a source error.'
    ))
  }
  return out
}

function runOutput(p: CorpusEntry): Out[] {
  const out = header(p.id, 'replayed stdout of zero run')
  if (!p.execution.ranOk) {
    out.push(line('error: the recorded run did not exit cleanly.', 'bad'))
    if (p.execution.stdout.length === 0) out.push(line('it produced no stdout.', 'dim'))
  }
  for (const l of p.execution.stdout.split('\n')) {
    if (l.trimEnd().length > 0) out.push(...flow(l.trimEnd(), '  '))
  }
  out.push(blank())
  out.push(line('zero test', 'key'))
  for (const l of p.execution.testStdout.split(/\r?\n/)) {
    if (l.trimEnd().length === 0) continue
    for (const w of wrapText(l.trimEnd(), COLS, '  ')) {
      out.push(line(w, p.execution.testsOk ? 'out' : 'bad'))
    }
  }
  return out
}

/* Why a replayed command is being refused. This is the point of the whole
   component, so it says exactly which line diverged and what still works. */
function refusal(
  command: string,
  program: CorpusEntry | null,
  fileName: string,
  source: string,
  baseline: string,
): Out[] {
  const out: Out[] = []
  if (!program) {
    out.push(...fail(`${command} has no recording to replay.`))
    out.push(...note(
      'the scratch buffer was never compiled by Zero 0.3.4, so there is no ' +
      'graph, no timing and no artifact to show. `zero tokens`, `zero parse` ' +
      'and `zero check` do run on it.'
    ))
    return out
  }
  const at = firstDiffLine(source, baseline)
  out.push(...fail(`buffer no longer matches ${program.id} ${fileName}`))
  out.push(line(`       first difference at line ${at}`, 'dim'))
  out.push(...note(
    `${command} replays a recording made by the native compiler from the ` +
    'unedited source. Printing it beside edited text would report a result ' +
    'that was never produced. `zero tokens`, `zero parse` and `zero check` run ' +
    `on what you typed; \`load ${program.id}\` restores the recorded source.`
  ))
  return out
}

/* ------------------------------------------------------------------ shared */

/* The pickers wear .btn so they inherit its press feedback and, more to the
   point, its 40px/44px touch floor — which is why min-height is deliberately
   absent here: an inline value would beat the class's mobile media query. */
const selectStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8125rem',
  paddingInline: '0.5rem',
}

/* A definite height, not a minimum. The line-number gutter is a normal flow
   child that clips its own overflow, so if the pane were allowed to size to its
   content a 300-line program would make the pane 300 lines tall. Both panes take
   the same value, which is also what keeps them level side by side. */
const paneStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 'clamp(380px, 58vh, 560px)',
  minWidth: 0,
}

const headStyle: CSSProperties = {
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.5rem',
  rowGap: '0.375rem',
}

const monoBase: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: MONO_SIZE,
  lineHeight: MONO_LEADING,
  fontVariantLigatures: 'none',
  fontFeatureSettings: 'normal',
  letterSpacing: 'normal',
  tabSize: 4,
}

/* ================================================================ component */

export function Playground({ capture }: { capture: Capture }) {
  const corpus = capture.corpus
  const ids = useMemo(() => corpus.map((c) => c.id), [corpus])

  const start = useMemo(() => {
    const p = corpus.find((c) => c.id === START_PROGRAM) ?? corpus[0] ?? null
    const f = p ? (p.sources.find((s) => s.file === MAIN_FILE) ?? p.sources[p.sources.length - 1]) : null
    return { programId: p?.id ?? '', file: f?.file ?? '', text: f?.text ?? '' }
  }, [corpus])

  const [programId, setProgramId] = useState(start.programId)
  const [fileName, setFileName] = useState(start.file)
  const [baseline, setBaseline] = useState(start.text)
  const [source, setSource] = useState(start.text)

  const program = useMemo(
    () => corpus.find((c) => c.id === programId) ?? null,
    [corpus, programId]
  )
  const pristine = program !== null && source === baseline

  /* Highlighting has to keep up with the caret, so it is not debounced. The
     status strip is, at 200 ms after the last keystroke, because nobody needs a
     token count recomputed mid-word. */
  const pieces = useMemo(() => highlight(source), [source])
  /* The snapshot carries the text it was taken from, so "is this figure current"
     is derived by comparison rather than tracked as a second piece of state
     that the effect would have to reset on every keystroke. */
  const [snapshot, setSnapshot] = useState<{ src: string; a: Analysis }>(
    () => ({ src: start.text, a: analyse(start.text) })
  )
  const settled = snapshot.src === source

  useEffect(() => {
    const t = window.setTimeout(() => setSnapshot({ src: source, a: analyse(source) }), 200)
    return () => window.clearTimeout(t)
  }, [source])

  const lineCount = useMemo(() => (source.length === 0 ? 1 : source.split('\n').length), [source])

  /* ------------------------------------------------------- editor plumbing */

  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)

  /* The highlight layer and the gutter are moved by transform rather than by
     their own scrollTop. Mirroring scrollTop looks equivalent but is not: a
     textarea with wrap="off" carries a horizontal scrollbar and a trailing line
     box the overlay does not, so its maximum scroll runs ~35px further and the
     two would part company at the bottom of a long file. A transform has no
     scroll range to clamp against, so the register is exact everywhere.

     This is a mirror, not an animation — no transition touches it. */
  const syncScroll = useCallback(() => {
    const a = areaRef.current
    if (!a) return
    const x = a.scrollLeft
    const y = a.scrollTop
    if (overlayRef.current) overlayRef.current.style.transform = `translate(${-x}px, ${-y}px)`
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-y}px)`
  }, [])

  /* Re-applied after any render that could have changed the content, because a
     shorter buffer can drop the textarea's scroll offset without firing scroll. */
  useEffect(syncScroll, [syncScroll, source])

  /* ----------------------------------------------------- terminal plumbing */

  const [lines, setLines] = useState<Line[]>(() => BANNER.map((l, i) => ({ ...l, id: i })))
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histAt, setHistAt] = useState<number | null>(null)
  const nextId = useRef(BANNER.length)

  const scrollbackRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const emit = (out: Out[]) => {
    setLines((prev) => {
      const added = out.map((l) => ({ ...l, id: nextId.current++ }))
      return [...prev, ...added]
    })
  }

  useEffect(() => {
    const el = scrollbackRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  /* ----------------------------------------------------------- loading */

  const loadProgram = (id: string, file?: string) => {
    if (id === 'scratch' || id === '') {
      setProgramId('')
      setFileName('')
      setBaseline('')
      setSource('')
      if (areaRef.current) areaRef.current.scrollTop = 0
      syncScroll()
      return { ok: true, label: 'scratch buffer' }
    }
    const p = corpus.find((c) => c.id === id)
    if (!p) return { ok: false, label: id }
    const target =
      (file ? p.sources.find((s) => s.file === file || s.file.endsWith(`/${file}`) || s.file === `src/${file}.0`) : null)
      ?? p.sources.find((s) => s.file === MAIN_FILE)
      ?? p.sources[p.sources.length - 1]
    if (!target) return { ok: false, label: id }
    setProgramId(p.id)
    setFileName(target.file)
    setBaseline(target.text)
    setSource(target.text)
    if (areaRef.current) areaRef.current.scrollTop = 0
    syncScroll()
    return { ok: true, label: `${p.id} ${target.file}` }
  }

  /* ---------------------------------------------------------- the commands */

  /* Carries the edited marker, because this string names what was read at the
     top of every report — and a report headed `p02_arith src/main.0` over a
     buffer that is no longer p02_arith would undo the point of the refusals. */
  const label = program
    ? `${program.id} ${fileName}${pristine ? '' : ' (edited)'}`
    : 'scratch buffer'

  const runCommand = (raw: string) => {
    const trimmed = raw.trim()
    const out: Out[] = [line(`$ ${trimmed}`, 'cmd')]

    if (trimmed.length === 0) {
      emit(out)
      return
    }

    const parts = trimmed.split(/\s+/)
    const head = parts[0].toLowerCase()

    if (head === 'clear') {
      setLines([])
      nextId.current = 0
      return
    }

    if (head === 'help' || head === '?') {
      emit([...out, ...helpOutput(ids)])
      return
    }

    if (head === 'load') {
      const which = parts[1]
      const known = [...ids, 'scratch']
      if (!which) {
        emit([...out, line('usage: load <program> [file]', 'bad'), ...flow(known.join(' '), '  ')])
        return
      }
      const res = loadProgram(which, parts[2])
      if (!res.ok) {
        emit([...out, ...fail(`no program named '${which}'.`), ...flow(known.join(' '), '  ')])
        return
      }
      play('select')
      emit([...out, line(`loaded ${res.label}`, 'ok')])
      return
    }

    if (head !== 'zero') {
      emit([...out, ...fail(`unknown command '${clip(parts[0], 24)}'. Type \`help\`.`)])
      return
    }

    const sub = (parts[1] ?? '').toLowerCase()
    /* Commands run against the buffer as it is right now, not against the
       debounced status figure, so a command issued mid-debounce is still
       answered about the text on screen. */
    const live = analyse(source)

    switch (sub) {
      case 'tokens':
        emit([...out, ...tokensOutput(live, label)])
        return
      case 'parse':
        emit([...out, ...parseOutput(live, label)])
        return
      case 'check':
        emit([...out, ...checkOutput(live, program, pristine)])
        return
      case 'graph':
      case 'time':
      case 'build':
      case 'run': {
        if (!pristine) {
          emit([...out, ...refusal(`zero ${sub}`, program, fileName, source, baseline)])
          return
        }
        const p = program as CorpusEntry
        const body =
          sub === 'graph' ? graphOutput(p)
            : sub === 'time' ? timeOutput(p)
              : sub === 'build' ? buildOutput(p)
                : runOutput(p)
        emit([...out, ...body])
        return
      }
      case '':
        emit([...out, line('usage: zero <subcommand>', 'bad'), line('  tokens parse check graph time build run', 'dim')])
        return
      default:
        emit([...out, ...fail(`'zero ${clip(sub, 20)}' is not available here. Type \`help\`.`)])
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = input
    play('key')
    runCommand(value)
    if (value.trim().length > 0) setHistory((h) => [...h, value.trim()])
    setInput('')
    setHistAt(null)
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    if (history.length === 0) return
    e.preventDefault()
    if (e.key === 'ArrowUp') {
      const next = histAt === null ? history.length - 1 : Math.max(0, histAt - 1)
      setHistAt(next)
      setInput(history[next])
      return
    }
    if (histAt === null) return
    const next = histAt + 1
    if (next >= history.length) {
      setHistAt(null)
      setInput('')
      return
    }
    setHistAt(next)
    setInput(history[next])
  }

  /* Clicking the scrollback puts the caret back in the prompt, the way every
     terminal emulator behaves. Suppressed while text is selected, so dragging
     across output to copy it does not snatch focus at mouse-up. */
  const focusPrompt = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (sel && !sel.isCollapsed) return
    inputRef.current?.focus()
  }

  /* --------------------------------------------------------------- render */

  const gutterDigits = Math.max(2, String(lineCount).length)
  const status = program
    ? pristine
      ? { text: 'matches capture', cls: 'pill pill-ok' }
      : { text: 'edited', cls: 'pill' }
    : { text: 'scratch', cls: 'pill' }

  return (
    <div>
      {/* The panes stack when there is no room for two. The threshold is stated
          against the container rather than the viewport, because inline styles
          cannot carry a media query and the container is what actually
          constrains the panes — this section gets a 692px column at a 768px
          viewport and 878px at 1280px, so a 700px container threshold puts the
          fold just below a tablet. `min(…, 100%)` is what stops the track from
          being wider than a phone and pushing the page sideways. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(342px, 100%), 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* ------------------------------------------------------- editor */}
        <div className="figure" style={paneStyle}>
          <div className="figure-head" style={headStyle}>
            <h3 className="heading-16" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4375rem' }}>
              <Icon name="scan" size={16} />
              Editor
            </h3>
            <div style={{ display: 'flex', gap: '0.375rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <select
                className="btn"
                style={selectStyle}
                aria-label="Program to load into the editor"
                value={programId === '' ? 'scratch' : programId}
                onChange={(e) => loadProgram(e.target.value)}
              >
                <option value="scratch">scratch</option>
                {corpus.map((c) => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </select>
              <select
                className="btn"
                style={selectStyle}
                aria-label="File within the program"
                value={fileName}
                disabled={!program}
                onChange={(e) => loadProgram(programId, e.target.value)}
              >
                {program
                  ? program.sources.map((s) => <option key={s.file} value={s.file}>{s.file}</option>)
                  : <option value="">—</option>}
              </select>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', background: 'var(--bg-raised)' }}>
            {/* Line numbers. Moved by the textarea, never scrolled themselves. */}
            <div
              aria-hidden="true"
              style={{
                flex: '0 0 auto',
                width: `calc(${gutterDigits}ch + 1.125rem)`,
                background: 'var(--bg-sunken)',
                borderRight: '1px solid var(--border-faint)',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              <div
                ref={gutterRef}
                style={{
                  ...monoBase,
                  padding: `${PAD_Y} 0.5rem`,
                  textAlign: 'right',
                  color: 'var(--text-faint)',
                }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              {/* The highlight layer. Identical metrics to the textarea in front
                  of it — same family, size, leading, padding, tab size, feature
                  settings and no wrapping — so the two cannot fall out of
                  register no matter what is typed. */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                <div
                  ref={overlayRef}
                  style={{
                    ...monoBase,
                    padding: `${PAD_Y} ${PAD_X}`,
                    whiteSpace: 'pre',
                    width: 'max-content',
                    minWidth: '100%',
                    color: 'var(--text)',
                  }}
                >
                  {source.length === 0 ? (
                    <span style={{ color: 'var(--text-faint)' }}>
                      {'// empty buffer. Try:\n//   pub fn main(world: World) -> Void raises {\n//       check world.out.write("hi\\n")\n//   }'}
                    </span>
                  ) : (
                    pieces.map((p, i) =>
                      p.cls
                        ? <span key={i} className={p.cls}>{p.text}</span>
                        : <span key={i}>{p.text}</span>
                    )
                  )}
                </div>
              </div>

              <textarea
                ref={areaRef}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onScroll={syncScroll}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                wrap="off"
                aria-label="Zero source buffer"
                aria-describedby="pg-editor-status"
                style={{
                  ...monoBase,
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  padding: `${PAD_Y} ${PAD_X}`,
                  border: 0,
                  outlineOffset: '-2px',
                  resize: 'none',
                  background: 'transparent',
                  color: 'transparent',
                  caretColor: 'var(--text)',
                  overflow: 'auto',
                }}
              />
            </div>
          </div>

          <div
            id="pg-editor-status"
            className="meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              flexWrap: 'wrap',
              minHeight: 38,
              padding: '0.375rem 0.75rem',
              borderTop: 'var(--rule)',
              background: 'var(--bg-sunken)',
            }}
          >
            <span className="num">
              {int(lineCount)} line{lineCount === 1 ? '' : 's'}
            </span>
            <span className="num" style={{ opacity: settled ? 1 : 0.55 }}>
              {int(snapshot.a.codeTokens)} code token{snapshot.a.codeTokens === 1 ? '' : 's'}
            </span>
            <span className="num" style={{ opacity: settled ? 1 : 0.55 }}>
              {int(snapshot.a.parsed.functions.length)} fn
            </span>
            <span className={status.cls} style={{ marginLeft: 'auto' }}>{status.text}</span>
          </div>
        </div>

        {/* ----------------------------------------------------- terminal */}
        <div className="figure" style={paneStyle}>
          <div className="figure-head" style={headStyle}>
            <h3 className="heading-16" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4375rem' }}>
              <Icon name="terminal" size={16} />
              Terminal
            </h3>
            <span className="meta" style={{ marginLeft: 'auto' }}>{label}</span>
          </div>

          <div
            ref={scrollbackRef}
            role="log"
            aria-live="polite"
            aria-label="Terminal output"
            tabIndex={0}
            onClick={focusPrompt}
            style={{
              ...monoBase,
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              overscrollBehavior: 'contain',
              padding: `${PAD_Y} ${PAD_X}`,
              background: 'var(--bg-inset)',
              cursor: 'text',
            }}
          >
            {lines.map((l) => (
              <div
                key={l.id}
                style={{
                  whiteSpace: 'pre',
                  color: LINE_COLOR[l.kind],
                  fontWeight: l.kind === 'key' || l.kind === 'cmd' ? 560 : 400,
                }}
              >
                {l.text === '' ? ' ' : l.text}
              </div>
            ))}
          </div>

          <form
            onSubmit={submit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.5rem 0.375rem 0.75rem',
              borderTop: 'var(--rule)',
              background: 'var(--bg-sunken)',
            }}
          >
            <span aria-hidden="true" style={{ ...monoBase, color: 'var(--accent-text)', fontWeight: 560 }}>$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); setHistAt(null) }}
              onKeyDown={onInputKey}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              aria-label="Terminal command. Use the up and down arrows for history."
              placeholder="help"
              style={{
                ...monoBase,
                flex: 1,
                minWidth: 0,
                /* The prompt is the one control a reader uses over and over, so
                   it takes the mobile touch floor at every width rather than
                   only below the breakpoint. */
                minHeight: 44,
                padding: '0.25rem 0',
                border: 0,
                background: 'transparent',
                color: 'var(--text)',
                caretColor: 'var(--accent)',
              }}
            />
            <button type="submit" className="btn" aria-label="Run command" style={{ paddingInline: '0.625rem' }}>
              <Icon name="play" size={15} />
            </button>
          </form>
        </div>
      </div>

      <p className="caption" style={{ maxWidth: 'var(--measure)' }}>
        Lexing and parsing run natively in your browser, from a TypeScript reimplementation
        validated token-for-token against the real compiler — so <code>zero tokens</code>,{' '}
        <code>zero parse</code> and <code>zero check</code> work on anything you type. Phases three
        to six are replayed from the recorded capture, because Zero 0.3.4 has no WebAssembly target;
        those four commands refuse to answer once the buffer differs from the program that was
        recorded.
      </p>
    </div>
  )
}
