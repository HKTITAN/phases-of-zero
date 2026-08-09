/* Zero syntax highlighting.

   Two renderers. `ZeroCode` is a lightweight lexer for arbitrary .0 text.
   `TokenStream` renders the compiler's OWN token output from `zero tokens --json`,
   which is the honest thing to show in a section about lexical analysis: it is
   phase-1 output, not our approximation of it. */

import type { Token } from '@/lib/types'

const KEYWORDS = new Set([
  'pub', 'fn', 'use', 'const', 'type', 'enum', 'choice', 'test', 'let', 'var',
  'if', 'else', 'while', 'match', 'return', 'break', 'continue', 'check',
  'rescue', 'raise', 'raises', 'expect', 'as', 'err', 'static', 'extern',
])

const LITERALS = new Set(['true', 'false', 'null'])

const TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'isize', 'u8', 'u16', 'u32', 'u64', 'usize',
  'f32', 'f64', 'Bool', 'Void', 'String', 'char', 'Type',
  'World', 'WorldStream', 'Span', 'MutSpan', 'Maybe', 'ref', 'mutref', 'owned',
  'Fs', 'File', 'ByteBuf', 'Vec', 'Duration', 'RandSource', 'Env', 'Args',
  'Clock', 'Rand', 'Proc', 'Alloc', 'Net', 'Conn', 'Listener', 'JsonDoc',
])

type Piece = { cls: string; text: string }

function lex(src: string): Piece[] {
  const out: Piece[] = []
  let i = 0

  const push = (cls: string, text: string) => {
    const last = out[out.length - 1]
    if (last && last.cls === cls) last.text += text
    else out.push({ cls, text })
  }

  while (i < src.length) {
    const c = src[i]

    // Comment to end of line.
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      push('tok-com', src.slice(i, stop))
      i = stop
      continue
    }

    // String literal, with escapes.
    if (c === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1
      push('tok-str', src.slice(i, Math.min(j + 1, src.length)))
      i = j + 1
      continue
    }

    // Number, including typed suffixes like 3000_u16.
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9_a-zA-Z.]/.test(src[j])) j++
      push('tok-num', src.slice(i, j))
      i = j
      continue
    }

    // Identifier or keyword.
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      const word = src.slice(i, j)
      // A name directly followed by '(' reads as a call or declaration.
      const isCall = src[j] === '('
      const cls =
        KEYWORDS.has(word) ? 'tok-kw'
          : LITERALS.has(word) ? 'tok-num'
            : TYPES.has(word) ? 'tok-type'
              : isCall ? 'tok-fn'
                : ''
      push(cls, word)
      i = j
      continue
    }

    if (/[(){}[\],;:.<>=+\-*/%&|!]/.test(c)) {
      push('tok-punc', c)
      i++
      continue
    }

    push('', c)
    i++
  }

  return out
}

export function ZeroCode({
  src, file, meta, maxHeight,
}: {
  src: string; file?: string; meta?: string; maxHeight?: number
}) {
  const pieces = lex(src)
  return (
    <div className="code-block">
      {file || meta ? (
        <div className="code-head">
          <span>{file}</span>
          {meta ? <span>{meta}</span> : null}
        </div>
      ) : null}
      <pre style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <code>
          {pieces.map((p, k) =>
            p.cls ? <span key={k} className={p.cls}>{p.text}</span> : <span key={k}>{p.text}</span>
          )}
        </code>
      </pre>
    </div>
  )
}

/* --------------------------------------------------------- token stream */

const KIND_STYLE: Record<string, { bg: string; fg: string; short: string }> = {
  word: { bg: 'var(--bg-raised)', fg: 'var(--text)', short: 'w' },
  symbol: { bg: 'transparent', fg: 'var(--text-tertiary)', short: 's' },
  number: { bg: 'var(--accent-quiet)', fg: 'var(--accent-text)', short: 'n' },
  string: { bg: 'var(--bg-raised)', fg: 'var(--text-secondary)', short: 'q' },
}

export function TokenStream({ tokens, limit = 140 }: { tokens: Token[]; limit?: number }) {
  const shown = tokens.slice(0, limit)
  const hidden = tokens.length - shown.length

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', lineHeight: 1.9 }}>
        {shown.map((t, i) => {
          if (t.kind === 'newline') {
            return <span key={i} style={{ flexBasis: '100%', height: 0 }} aria-hidden="true" />
          }
          const st = KIND_STYLE[t.kind] ?? KIND_STYLE.symbol
          return (
            <span
              key={i}
              title={`${t.kind} · line ${t.line}, col ${t.column} · offset ${t.offset}, length ${t.length}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                padding: '0.0625rem 0.3125rem',
                borderRadius: 3,
                border: '1px solid var(--border-faint)',
                background: st.bg,
                color: st.fg,
                whiteSpace: 'pre',
              }}
            >
              {t.text}
            </span>
          )
        })}
      </div>
      {hidden > 0 ? (
        <p className="meta" style={{ marginTop: '0.75rem' }}>
          {shown.filter((t) => t.kind !== 'newline').length} of{' '}
          {tokens.filter((t) => t.kind !== 'newline').length} tokens shown · {hidden} elided
        </p>
      ) : null}
    </div>
  )
}
