/* A Zero 0.3.4 lexer and declaration parser, reimplemented in TypeScript so
   phases 1 and 2 can run on arbitrary input in the browser.

   Why reimplement rather than ship the compiler: Zero 0.3.4 has no WebAssembly
   target, and its own `selfHostRouting` report marks `browserCompiler` as
   removed. The real binary cannot run client-side. Lexing and parsing are the
   two phases whose observable output the dataset captures in full — every
   corpus program carries the real `zero tokens --json` stream and the real
   `zero parse --json` declaration list — so they are the two phases that can be
   reimplemented against evidence rather than against a guess.

   Everything below was derived from that evidence:
     - the token kinds are the ones the dataset actually contains
       (word, symbol, number, string, newline, comment, eof), not an assumed set;
     - `offset` and `column` are UTF-8 byte positions, because the compiler's
       PAR100 on a `§` reports `actual: "Â"` — the first byte of the two-byte
       encoding — at the byte column, which is only possible for a byte lexer;
     - `test "..."` blocks become functions named `__zero_test_<n>` with return
       type Void and no parameters, because that is what `zero parse --json`
       reports for them;
     - `var` bindings are reported with the statement kind `let`.

   `validateAgainst` re-runs this lexer over every corpus program and diffs it
   against the compiler's own token stream, so the fidelity claim is measured
   rather than asserted. */

export type ZeroToken = {
  kind: string
  text: string
  line: number
  column: number
  offset: number
  length: number
}

/* Words the compiler treats as syntax rather than identifiers. Drawn from
   docs/zero-language.md and cross-checked against the corpus; a word not in
   here is an identifier, and both lex as kind 'word'. */
export const ZERO_KEYWORDS: Set<string> = new Set([
  'pub', 'fn', 'use', 'const', 'type', 'enum', 'choice', 'test', 'static',
  'let', 'var', 'return', 'if', 'else', 'while', 'break', 'continue', 'match',
  'check', 'rescue', 'err', 'raise', 'raises', 'expect', 'as', 'mut',
  'true', 'false', 'null',
])

/* Types the compiler recognises without a declaration: primitives, capability
   and resource handles, and the borrow/view constructors. From the type
   catalogue in docs/zero-language.md. */
export const ZERO_TYPES: Set<string> = new Set([
  'Bool', 'Void', 'String', 'char', 'Type',
  'i8', 'i16', 'i32', 'i64', 'isize',
  'u8', 'u16', 'u32', 'u64', 'usize',
  'f32', 'f64',
  'World', 'WorldStream',
  'Fs', 'File', 'ByteBuf',
  'NullAlloc', 'FixedBufAlloc', 'PageAlloc', 'GeneralAlloc',
  'Vec', 'Duration', 'RandSource', 'ProcStatus',
  'Address', 'Net', 'Conn', 'Listener',
  'HttpMethod', 'HttpClient', 'HttpServer', 'HttpResult', 'HttpError',
  'HttpHeaderValue',
  'JsonDoc', 'BufferedReader', 'BufferedWriter',
  'Env', 'Args', 'Clock', 'Rand', 'Proc', 'Alloc',
  'Maybe', 'Span', 'MutSpan',
  'ref', 'mutref', 'owned',
])

/* Longest-match first. Every operator here appears in docs/zero-language.md or
   in the captured token streams; nothing is speculative. */
const MULTI_SYMBOLS = ['->', '==', '!=', '<=', '>=', '&&', '||']

/* Single bytes the lexer accepts as punctuation. A byte outside this set, the
   word set, and the literal syntaxes is an unexpected character — which is how
   `§` in the e01_lexical case reaches PAR100. */
const SINGLE_SYMBOLS = new Set([
  '(', ')', '[', ']', '{', '}', ',', ':', ';', '.',
  '+', '-', '*', '/', '%', '=', '!', '<', '>', '&', '|',
])

const DIGIT = /[0-9]/
const IDENT_START = /[A-Za-z_]/
const IDENT_PART = /[A-Za-z0-9_]/

/* UTF-8 width of one UTF-16 code unit. A surrogate pair is charged 4 bytes on
   its lead unit and 0 on its trail unit, so summing over units gives the byte
   length of the string. */
function utf8Width(code: number): number {
  if (code < 0x80) return 1
  if (code < 0x800) return 2
  if (code >= 0xd800 && code <= 0xdbff) return 4
  if (code >= 0xdc00 && code <= 0xdfff) return 0
  return 3
}

function utf8Bytes(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) n += utf8Width(s.charCodeAt(i))
  return n
}

/* The UTF-8 bytes of one code point, so a non-ASCII character can be reported
   the way a byte lexer reports it: one unexpected byte at a time. */
function encodeUtf8(cp: number): number[] {
  if (cp < 0x80) return [cp]
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)]
  if (cp < 0x10000) {
    return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)]
  }
  return [
    0xf0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3f),
    0x80 | ((cp >> 6) & 0x3f),
    0x80 | (cp & 0x3f),
  ]
}

/**
 * Phase 1. Produce the token stream for one Zero source file.
 *
 * Positions match `zero tokens --json`: `line` and `column` are 1-based,
 * `offset` is 0-based, and both `column` and `offset` count UTF-8 bytes.
 * `length` is the byte length of `text`. The stream always ends with a
 * zero-length `eof` token.
 *
 * Bytes the lexer cannot classify are emitted as kind `error`, one token per
 * byte, carrying that byte as a Latin-1 character. That is not a kind the real
 * compiler emits in its JSON — it is how this implementation carries a lexical
 * failure forward to `parse`, which turns it into PAR100.
 */
export function tokenize(src: string): ZeroToken[] {
  const out: ZeroToken[] = []
  let i = 0
  let offset = 0
  let line = 1
  let column = 1

  const push = (kind: string, text: string, l: number, c: number, o: number) => {
    out.push({ kind, text, line: l, column: c, offset: o, length: utf8Bytes(text) })
  }

  while (i < src.length) {
    const startLine = line
    const startCol = column
    const startOff = offset
    const ch = src[i]

    if (ch === '\n') {
      push('newline', '\n', startLine, startCol, startOff)
      i += 1
      offset += 1
      line += 1
      column = 1
      continue
    }

    /* Zero source is LF. A stray CR is carried as whitespace so a file pasted
       from a Windows editor still lexes at the right byte positions. */
    if (ch === '\r' || ch === ' ' || ch === '\t') {
      i += 1
      offset += 1
      column += 1
      continue
    }

    if (ch === '/' && src[i + 1] === '/') {
      let j = i
      while (j < src.length && src[j] !== '\n') j += 1
      const text = src.slice(i, j)
      push('comment', text, startLine, startCol, startOff)
      const bytes = utf8Bytes(text)
      i = j
      offset += bytes
      column += bytes
      continue
    }

    if (ch === '"') {
      let j = i + 1
      let closed = false
      while (j < src.length) {
        const c = src[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (c === '"') {
          j += 1
          closed = true
          break
        }
        /* A newline inside a literal ends the run: Zero has no multi-line
           string, so the quote is unterminated rather than the line escaped. */
        if (c === '\n') break
        j += 1
      }
      const text = src.slice(i, j)
      push(closed ? 'string' : 'error', text, startLine, startCol, startOff)
      const bytes = utf8Bytes(text)
      i = j
      offset += bytes
      column += bytes
      continue
    }

    if (DIGIT.test(ch)) {
      let j = i + 1
      while (j < src.length && /[0-9_]/.test(src[j])) j += 1
      /* A fractional part only counts when a digit follows the dot, so field
         access on a numeric result never swallows the `.`. */
      if (src[j] === '.' && j + 1 < src.length && DIGIT.test(src[j + 1])) {
        j += 1
        while (j < src.length && /[0-9_]/.test(src[j])) j += 1
      }
      /* Suffixes: `3000_u16`, `7_usize`, and the bare `110_u32` form the
         corpus uses. The underscore was already consumed above. */
      while (j < src.length && IDENT_PART.test(src[j])) j += 1
      const text = src.slice(i, j)
      push('number', text, startLine, startCol, startOff)
      i = j
      offset += text.length
      column += text.length
      continue
    }

    if (IDENT_START.test(ch)) {
      let j = i + 1
      while (j < src.length && IDENT_PART.test(src[j])) j += 1
      const text = src.slice(i, j)
      push('word', text, startLine, startCol, startOff)
      i = j
      offset += text.length
      column += text.length
      continue
    }

    const two = src.slice(i, i + 2)
    if (MULTI_SYMBOLS.includes(two)) {
      push('symbol', two, startLine, startCol, startOff)
      i += 2
      offset += 2
      column += 2
      continue
    }

    if (SINGLE_SYMBOLS.has(ch)) {
      push('symbol', ch, startLine, startCol, startOff)
      i += 1
      offset += 1
      column += 1
      continue
    }

    /* Unclassifiable. Report it byte by byte, the way the compiler does: the
       PAR100 for `4 § 2` names `Â`, the lead byte of U+00A7. */
    const cp = src.codePointAt(i) ?? ch.charCodeAt(0)
    const units = cp > 0xffff ? 2 : 1
    for (const byte of encodeUtf8(cp)) {
      out.push({
        kind: 'error',
        text: String.fromCharCode(byte),
        line,
        column,
        offset,
        length: 1,
      })
      offset += 1
      column += 1
    }
    i += units
  }

  out.push({ kind: 'eof', text: '', line, column, offset, length: 0 })
  return out
}

export type ZeroParam = { name: string; type: string }

export type ZeroFunction = {
  name: string
  returnType: string
  paramCount: number
  params: ZeroParam[]
  bodyKinds: string[]
  line: number
  isPub: boolean
  isFallible: boolean
  isTest: boolean
}

export type ZeroDiagnostic = {
  code: string
  message: string
  line: number
  column: number
  help?: string
}

export type ZeroParse = {
  ok: boolean
  functions: ZeroFunction[]
  shapes: { name: string; fields: ZeroParam[]; line: number }[]
  enums: { name: string; cases: string[]; line: number }[]
  choices: { name: string; cases: ZeroParam[]; line: number }[]
  consts: { name: string; type: string; line: number }[]
  imports: { module: string; line: number }[]
  diagnostics: ZeroDiagnostic[]
}

/* The compiler's own wording, taken from the captured diagnostics rather than
   paraphrased: e01_lexical, e02_syntax and e03_name in data/capture.json. */
const PAR_HELP = 'use canonical .0 text source'
const NAM_HELP = 'declare the name before using it'
const MAX_DIAGNOSTICS = 20

/**
 * Phase 2. Recursive descent over declarations.
 *
 * This records the shape of each declaration and each function's top-level
 * statement kinds — the same `bodyKinds` list `zero parse --json` reports — and
 * deliberately stops short of expression trees, which the report never shows.
 *
 * Only two real diagnostic codes are emitted, and only for conditions this
 * parser can actually decide: PAR100 for an unexpected token, an unterminated
 * string, or a block left open at end of file; NAM003 for a call to a name
 * declared nowhere in the file, suppressed entirely when the file imports a
 * non-`std` module, because those names arrive from another file.
 */
export function parse(tokens: ZeroToken[]): ZeroParse {
  /* Comments carry no structure. Newlines do — they terminate statements — so
     they stay in the stream the parser walks. */
  const SYNTHETIC_EOF: ZeroToken = {
    kind: 'eof', text: '', line: 1, column: 1, offset: 0, length: 0,
  }
  const t = tokens.filter((x) => x.kind !== 'comment')
  const eof = t[t.length - 1] ?? SYNTHETIC_EOF

  const functions: ZeroFunction[] = []
  const shapes: ZeroParse['shapes'] = []
  const enums: ZeroParse['enums'] = []
  const choices: ZeroParse['choices'] = []
  const consts: ZeroParse['consts'] = []
  const imports: ZeroParse['imports'] = []
  const diagnostics: ZeroDiagnostic[] = []

  let p = 0
  let testIndex = 0
  let unclosedBlock = false

  const at = (k = 0): ZeroToken =>
    t.length === 0 ? SYNTHETIC_EOF : t[Math.max(0, Math.min(p + k, t.length - 1))]
  const done = () => at().kind === 'eof'
  const isText = (s: string, k = 0) => at(k).text === s && at(k).kind !== 'string'
  const skipNewlines = () => {
    while (at().kind === 'newline') p += 1
  }

  const report = (d: ZeroDiagnostic) => {
    if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(d)
  }

  /* Lexical failures surface first, and adjacent error bytes collapse into one
     diagnostic so a single multi-byte character reports once. */
  for (let i = 0; i < t.length; i++) {
    const tok = t[i]
    if (tok.kind !== 'error') continue
    const prev = t[i - 1]
    if (prev && prev.kind === 'error' && prev.offset + prev.length === tok.offset) continue
    report({
      code: 'PAR100',
      message: tok.text.startsWith('"')
        ? 'unterminated string literal'
        : 'unexpected token in expression',
      line: tok.line,
      column: tok.column,
      help: PAR_HELP,
    })
  }

  /* --- token-level helpers -------------------------------------------- */

  const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const CLOSERS = new Set([')', ']', '}'])

  /* Advance to the newline that ends the current statement, or to a `}` that
     closes the enclosing block on the same line. Returns the tokens crossed. */
  const consumeSimple = (): ZeroToken[] => {
    const span: ZeroToken[] = []
    let depth = 0
    while (!done()) {
      const tok = at()
      if (depth === 0 && tok.kind === 'newline') break
      if (depth === 0 && tok.text === '}' && tok.kind === 'symbol') break
      if (tok.kind === 'symbol' && OPENERS[tok.text]) depth += 1
      else if (tok.kind === 'symbol' && CLOSERS.has(tok.text)) depth -= 1
      span.push(tok)
      p += 1
    }
    return span
  }

  /* Advance to the `{` that opens a block header's body (an `if` condition, a
     `while` guard, a `match` scrutinee). */
  const consumeToBrace = () => {
    let depth = 0
    while (!done()) {
      const tok = at()
      if (tok.kind === 'symbol') {
        if (depth === 0 && tok.text === '{') return
        if (tok.text === '(' || tok.text === '[') depth += 1
        else if (tok.text === ')' || tok.text === ']') depth -= 1
      }
      p += 1
    }
  }

  const skipBalancedBlock = () => {
    if (!(at().kind === 'symbol' && at().text === '{')) return
    let depth = 0
    while (!done()) {
      const tok = at()
      if (tok.kind === 'symbol' && tok.text === '{') depth += 1
      else if (tok.kind === 'symbol' && tok.text === '}') {
        depth -= 1
        if (depth === 0) {
          p += 1
          return
        }
      }
      p += 1
    }
    unclosedBlock = true
  }

  /* Angle brackets are not a balanced token class in general, so generic
     parameter lists are skipped by depth over `<` and `>` only. */
  const skipGenerics = () => {
    if (!(at().kind === 'symbol' && at().text === '<')) return
    let depth = 0
    while (!done()) {
      const tok = at()
      if (tok.kind === 'symbol' && tok.text === '<') depth += 1
      else if (tok.kind === 'symbol' && tok.text === '>') {
        depth -= 1
        if (depth === 0) {
          p += 1
          return
        }
      }
      p += 1
    }
  }

  /* Types are rendered the way the compiler prints them: token texts joined
     with no separator, so `Span < u8 >` reads back as `Span<u8>`. */
  const readTypeUntil = (stop: (tok: ZeroToken) => boolean): string => {
    const parts: string[] = []
    let depth = 0
    while (!done()) {
      const tok = at()
      if (tok.kind === 'newline') break
      if (depth === 0 && stop(tok)) break
      if (tok.kind === 'symbol') {
        if (tok.text === '<' || tok.text === '(' || tok.text === '[') depth += 1
        else if (tok.text === '>' || tok.text === ')' || tok.text === ']') depth -= 1
      }
      parts.push(tok.text)
      p += 1
    }
    return parts.join('')
  }

  /* --- statements ------------------------------------------------------ */

  const statementKind = (): string => {
    const head = at()
    const word = head.kind === 'word' ? head.text : ''

    if (word === 'let' || word === 'var') {
      consumeSimple()
      return 'let'
    }
    if (word === 'return' || word === 'raise' || word === 'check') {
      consumeSimple()
      return word
    }
    if (word === 'break' || word === 'continue') {
      consumeSimple()
      return word
    }
    if (word === 'if') {
      p += 1
      consumeToBrace()
      skipBalancedBlock()
      while (isText('else')) {
        p += 1
        if (isText('if')) {
          p += 1
          consumeToBrace()
          skipBalancedBlock()
          continue
        }
        skipBalancedBlock()
        break
      }
      return 'if'
    }
    if (word === 'while' || word === 'for' || word === 'match') {
      p += 1
      consumeToBrace()
      skipBalancedBlock()
      return word
    }

    const span = consumeSimple()
    if (span.length === 0) {
      /* Nothing consumable here — step over the token so the loop terminates. */
      p += 1
      return 'expr'
    }
    /* `=` at bracket depth zero is an assignment; `==` is one token, so a bare
       `=` cannot be a comparison. */
    let depth = 0
    for (const tok of span) {
      if (tok.kind !== 'symbol') continue
      if (OPENERS[tok.text]) depth += 1
      else if (CLOSERS.has(tok.text)) depth -= 1
      else if (tok.text === '=' && depth === 0) return 'assign'
    }
    return 'expr'
  }

  /* Top-level statement kinds of one `{ ... }` body. Nested statements belong
     to their own block and are not reported, matching `zero parse --json`. */
  const parseBody = (): string[] => {
    const kinds: string[] = []
    if (!(at().kind === 'symbol' && at().text === '{')) return kinds
    p += 1
    for (;;) {
      skipNewlines()
      if (done()) {
        unclosedBlock = true
        return kinds
      }
      if (at().kind === 'symbol' && at().text === '}') {
        p += 1
        return kinds
      }
      const before = p
      kinds.push(statementKind())
      if (p === before) p += 1
    }
  }

  /* --- declarations ---------------------------------------------------- */

  const parseParams = (): ZeroParam[] => {
    const params: ZeroParam[] = []
    if (!(at().kind === 'symbol' && at().text === '(')) return params
    p += 1
    for (;;) {
      skipNewlines()
      if (done()) return params
      if (at().kind === 'symbol' && at().text === ')') {
        p += 1
        return params
      }
      if (at().kind === 'symbol' && at().text === ',') {
        p += 1
        continue
      }
      /* `static N: usize` in a generic parameter list carries a leading
         keyword; the binding name is the last word before the colon. */
      if (at().kind === 'word' && at().text === 'static') p += 1
      const name = at().kind === 'word' ? at().text : ''
      p += 1
      if (at().kind === 'symbol' && at().text === ':') {
        p += 1
        const type = readTypeUntil((tok) => tok.text === ',' || tok.text === ')')
        if (name) params.push({ name, type })
      } else if (name) {
        params.push({ name, type: '' })
      }
    }
  }

  const parseFields = (): ZeroParam[] => {
    const fields: ZeroParam[] = []
    if (!(at().kind === 'symbol' && at().text === '{')) return fields
    p += 1
    for (;;) {
      skipNewlines()
      if (done()) {
        unclosedBlock = true
        return fields
      }
      if (at().kind === 'symbol' && at().text === '}') {
        p += 1
        return fields
      }
      if (at().kind === 'symbol' && at().text === ',') {
        p += 1
        continue
      }
      if (at().kind !== 'word') {
        p += 1
        continue
      }
      const name = at().text
      p += 1
      let type = ''
      if (at().kind === 'symbol' && at().text === ':') {
        p += 1
        type = readTypeUntil((tok) => tok.text === ',' || tok.text === '}')
      }
      fields.push({ name, type })
    }
  }

  while (!done()) {
    skipNewlines()
    if (done()) break

    const line = at().line
    let isPub = false
    if (at().kind === 'word' && at().text === 'pub') {
      isPub = true
      p += 1
    }

    const head = at()
    const word = head.kind === 'word' ? head.text : ''

    if (word === 'use') {
      p += 1
      const parts: string[] = []
      while (!done() && at().kind !== 'newline') {
        parts.push(at().text)
        p += 1
      }
      if (parts.length) imports.push({ module: parts.join(''), line })
      continue
    }

    if (word === 'const') {
      p += 1
      const name = at().kind === 'word' ? at().text : ''
      p += 1
      let type = ''
      if (at().kind === 'symbol' && at().text === ':') {
        p += 1
        type = readTypeUntil((tok) => tok.text === '=')
      }
      consumeSimple()
      if (name) consts.push({ name, type, line })
      continue
    }

    if (word === 'type' || word === 'enum' || word === 'choice') {
      p += 1
      const name = at().kind === 'word' ? at().text : ''
      p += 1
      skipGenerics()
      const members = parseFields()
      if (word === 'type') shapes.push({ name, fields: members, line })
      else if (word === 'enum') {
        enums.push({ name, cases: members.map((m) => m.name), line })
      } else choices.push({ name, cases: members, line })
      continue
    }

    if (word === 'fn') {
      p += 1
      const name = at().kind === 'word' ? at().text : ''
      p += 1
      skipGenerics()
      const params = parseParams()
      let returnType = 'Void'
      if (at().kind === 'symbol' && at().text === '->') {
        p += 1
        returnType = readTypeUntil((tok) => tok.text === 'raises' || tok.text === '{')
      }
      let isFallible = false
      if (isText('raises')) {
        isFallible = true
        p += 1
        if (at().kind === 'symbol' && at().text === '[') {
          let depth = 0
          while (!done()) {
            const tok = at()
            if (tok.kind === 'symbol' && tok.text === '[') depth += 1
            else if (tok.kind === 'symbol' && tok.text === ']') {
              depth -= 1
              p += 1
              if (depth === 0) break
              continue
            }
            p += 1
          }
        }
      }
      const bodyKinds = parseBody()
      functions.push({
        name,
        returnType: returnType || 'Void',
        paramCount: params.length,
        params,
        bodyKinds,
        line,
        isPub,
        isFallible,
        isTest: false,
      })
      continue
    }

    if (word === 'test') {
      p += 1
      if (at().kind === 'string' || at().kind === 'error') p += 1
      const bodyKinds = parseBody()
      functions.push({
        name: `__zero_test_${testIndex}`,
        returnType: 'Void',
        paramCount: 0,
        params: [],
        bodyKinds,
        line,
        isPub: false,
        isFallible: false,
        isTest: true,
      })
      testIndex += 1
      continue
    }

    /* Anything else at top level is not a declaration this parser models. It is
       stepped over rather than reported, so an unmodelled but valid construct
       never produces a diagnostic the real compiler would not produce. */
    p += 1
  }

  if (unclosedBlock) {
    report({
      code: 'PAR100',
      message: 'expected closing block',
      line: eof.line,
      column: eof.column,
      help: PAR_HELP,
    })
  }

  /* --- NAM003 ---------------------------------------------------------- */

  /* A name can arrive from a sibling module in the same package — `use lib`
     puts `scale()` in scope with no qualifier — so the check runs only when
     every import is from `std`, where calls are always qualified. */
  const importsLocalModule = imports.some(
    (im) => im.module !== 'std' && !im.module.startsWith('std.')
  )

  if (!importsLocalModule) {
    const declared = new Set<string>(ZERO_TYPES)
    declared.add('std')
    for (const f of functions) {
      declared.add(f.name)
      for (const param of f.params) declared.add(param.name)
    }
    for (const s of shapes) declared.add(s.name)
    for (const e of enums) declared.add(e.name)
    for (const c of choices) declared.add(c.name)
    for (const c of consts) declared.add(c.name)
    /* Bindings are collected across the whole file, ignoring scope. An
       over-broad declared set can only suppress a diagnostic, never invent
       one, which is the direction of error this check should have. */
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i].kind === 'word' && (t[i].text === 'let' || t[i].text === 'var')) {
        if (t[i + 1].kind === 'word') declared.add(t[i + 1].text)
      }
    }

    const seen = new Set<string>()
    for (let i = 0; i < t.length - 1; i++) {
      const tok = t[i]
      if (tok.kind !== 'word') continue
      const next = t[i + 1]
      if (!(next.kind === 'symbol' && next.text === '(')) continue
      const prev = t[i - 1]
      if (prev && prev.kind === 'symbol' && prev.text === '.') continue
      if (prev && prev.kind === 'word' && prev.text === 'fn') continue
      if (ZERO_KEYWORDS.has(tok.text)) continue
      if (declared.has(tok.text)) continue
      const key = `${tok.line}:${tok.column}`
      if (seen.has(key)) continue
      seen.add(key)
      report({
        code: 'NAM003',
        message: `unknown identifier '${tok.text}'`,
        line: tok.line,
        column: tok.column,
        help: NAM_HELP,
      })
    }
  }

  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column)

  return {
    ok: diagnostics.length === 0,
    functions,
    shapes,
    enums,
    choices,
    consts,
    imports,
    diagnostics,
  }
}

/**
 * Rough LLM token count. Four characters per token is the usual English-prose
 * approximation and is only ever an estimate — Zero source is denser in
 * punctuation than prose, so real counts tend to run higher.
 */
export function estimateLlmTokens(s: string): number {
  return Math.ceil(s.length / 4)
}

export type Fidelity = {
  program: string
  tokenMatch: boolean
  realCount: number
  ourCount: number
  firstMismatch: string | null
  fnMatch: boolean
}

type CaptureShape = {
  corpus?: {
    id?: string
    sources?: { file?: string; text?: string }[]
    lexical?: { sample?: ZeroToken[] }
    syntax?: {
      functions?: {
        name?: string
        returnType?: string
        paramCount?: number
        bodyKinds?: string[]
        line?: number
      }[]
    } | null
  }[]
}

function describe(tok: ZeroToken | undefined): string {
  if (!tok) return 'nothing'
  return `${tok.kind} ${JSON.stringify(tok.text)} @${tok.line}:${tok.column}+${tok.offset}`
}

/**
 * Diff this implementation against the compiler's own output for every corpus
 * program: `zero tokens --json` for `src/main.0` and `zero parse --json` for
 * the declarations of the same file.
 *
 * The shipped client payload truncates `lexical.sample` (see `explorerCapture`
 * in lib/data.ts), so the comparison runs over the length of whichever stream
 * is shorter, and `realCount` / `ourCount` are reported side by side so a
 * truncated sample is visible rather than scored as a match. A run against the
 * full data/capture.json compares the complete stream.
 */
export function validateAgainst(capture: unknown): Fidelity[] {
  const data = capture as CaptureShape
  const corpus = Array.isArray(data?.corpus) ? data.corpus : []
  const results: Fidelity[] = []

  for (const entry of corpus) {
    const sources = entry.sources ?? []
    const main = sources.find((s) => s.file === 'src/main.0') ?? sources[sources.length - 1]
    const real = entry.lexical?.sample ?? []
    if (!main?.text) continue

    const ours = tokenize(main.text)
    const n = Math.min(real.length, ours.length)
    let firstMismatch: string | null = null

    for (let i = 0; i < n; i++) {
      const a = real[i]
      const b = ours[i]
      if (
        a.kind === b.kind &&
        a.text === b.text &&
        a.line === b.line &&
        a.column === b.column &&
        a.offset === b.offset &&
        a.length === b.length
      ) {
        continue
      }
      firstMismatch = `token ${i}: compiler ${describe(a)}, ours ${describe(b)}`
      break
    }

    /* A shorter stream than the compiler's is a real failure; a longer one is
       the expected shape when the sample has been truncated for the client. */
    if (!firstMismatch && ours.length < real.length) {
      firstMismatch = `token ${ours.length}: compiler ${describe(real[ours.length])}, ours nothing`
    }

    const parsed = parse(ours)
    const realFns = entry.syntax?.functions ?? []
    const fnMatch =
      realFns.length === parsed.functions.length &&
      realFns.every((rf, i) => {
        const of = parsed.functions[i]
        return (
          rf.name === of.name &&
          rf.returnType === of.returnType &&
          rf.paramCount === of.paramCount &&
          rf.line === of.line &&
          (rf.bodyKinds ?? []).join(',') === of.bodyKinds.join(',')
        )
      })

    results.push({
      program: entry.id ?? 'unknown',
      tokenMatch: firstMismatch === null,
      realCount: real.length,
      ourCount: ours.length,
      firstMismatch,
      fnMatch,
    })
  }

  return results
}
