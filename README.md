# Phases of Compiler Design — a review with evidence from Zero

A review paper on the classical six-phase compiler model, measured against
**Zero 0.3.4** ([zerolang](https://zerolang.ai/), Vercel Labs) — a graph-first systems
language whose compiler reports its own phase structure as machine-readable JSON.

BTech CSE coursework, 5th semester / 3rd year.

**Submitted by** Harshit Khemani
**Co-authors** Kush Ahuja, Mohit Kumar Mishra, Kushagra Agrawal
**Submitted to** Ms. Ankita Sharma

Read online at **[zero.khe.money](https://zero.khe.money)** · download the
[PDF](paper/phases-of-compiler-design.pdf) or [ePub](paper/phases-of-compiler-design.epub).

---

## What this repository contains

| Path | What it is |
|---|---|
| `web/` | Next.js 16 app — the paper, diagrams, playground and interactive explainers |
| `paper/` | The generated PDF and ePub editions |
| `corpus/` | 8 Zero packages of increasing size — the measurement corpus |
| `errors/` | 10 deliberately malformed Zero packages, one per compiler phase |
| `tools/capture.mjs` | The measurement harness. Produces the entire dataset. |
| `tools/qr.mjs` | Generates the QR code component |
| `tools/pdf.mjs` | Renders the built page to the submission PDF |
| `tools/epub.mjs` | Renders the built page to EPUB 3 |
| `tools/previews.mjs` | Renders the download hover-preview thumbnails |
| `web/data/capture.json` | The dataset every figure and number in the paper reads from |
| `docs/` | Version-matched Zero language docs, pulled from the installed compiler |

The paper contains no hand-transcribed numbers. Prose, tables and charts all read the
same JSON, so text and evidence cannot drift apart. The PDF and ePub are rendered from
the same page as the web edition, so the three editions cannot drift either.

## Reproducing everything

```bash
curl -fsSL https://zerolang.ai/install.sh | bash
```

```bash
export PATH="$HOME/.zero/bin:$PATH" && zero --version
```

```bash
npm install && npm run paper
```

`npm run paper` runs capture → QR → build → PDF → ePub → previews → publish → rebuild.

The harness runs, per corpus package: `zero tokens`, `zero parse`, `zero check --json`,
`zero query --full`, `zero source-map`, `zero time --json`, `zero size`, `zero mem`,
`zero test`, `zero run`, plus a build for every advertised target (8 programs × 8 targets
= 64 builds). For each error case it records which of the three gates — `import`, `check`,
`build` — refused the program.

## Key findings

1. **Phases relocate rather than disappear.** Lexical, syntactic and semantic analysis run
   at an ingestion gate (`zero import`) that admits programs into a persistent graph. The
   steady-state compile path is lowering → codegen → link only.
2. **Lowering is ~100% of measurable phase time.** Every other reported phase returns 0 ms,
   because the front end reads stored facts instead of deriving them.
3. **The front end and back end accept different languages.** 17 of 64 builds failed with
   BLD004 on programs that had already passed `zero check`. `match` cannot be lowered on any
   target on this build.
4. **`zero check --json` publishes two summaries that disagree** — top-level `ok: true` with
   an empty `diagnostics` array, beside `targetReadiness.buildable: false` with a BLD004
   naming the exact construct. A consumer reading the field the schema presents as the
   verdict gets the wrong answer.
5. **Structured output costs far more to read than prose.** `zero check` prints 4 bytes;
   `zero check --json` returns 17,898 for the same 6-line program. The trade is not
   tokens-for-tokens, it is tokens-for-actionability.
6. **Backend completeness is target-specific.** `p05_errors` fails to build on the Windows
   host and cross-compiles to an 826-byte ELF for `linux-musl-x64` — same graph, same front
   end, different emitter.

## The playground

The site ships a browser playground with a working terminal. Zero 0.3.4 has **no
WebAssembly target** — its own `selfHostRouting` report marks `browserCompiler` as removed —
so the real compiler cannot run client-side. Instead, `web/lib/zero-lang.ts` reimplements
Zero's scanner and declaration parser in TypeScript. Agreement with the compiler's own
`zero tokens --json` is **exact on all 8 corpus programs (2,666 tokens: kind, text, line and
column)**, and the parser recovers the same function set as `zero parse --json` on all eight.

Phases 1–2 therefore run natively in the browser on whatever you type. Phases 3–6 are
replayed from the recorded capture for corpus programs, and the terminal says so explicitly
once the buffer is edited.

## Design

Light theme only. The presentation follows Vercel's brand and Web Interface Guidelines with
the Geist typefaces: monochrome canvas with a single warm accent, typography before surfaces,
honest chart encodings with zero baselines, tabular numerals, WCAG 2.2 AA contrast verified in
both the screen and print palettes, `transform`/`opacity`-only motion under 300 ms with a
reduced-motion path, and a bespoke hand-drawn icon set rather than an icon dependency.

Interface sound is synthesised with Web Audio and **off until you turn it on**.

The Vercel guidelines specify an authorship shell carrying the Vercel wordmark. That is
deliberately **not** used: this is a student paper *about* a Vercel Labs project, not a
Vercel-authored document.

## Deploying

```bash
cd web && npx vercel deploy --prod
```

Static output, no runtime dependencies — the dataset is a build-time JSON artifact inlined
into the render. No `vercel.json` needed.

## License

The corpus, harness and paper are coursework. Zero itself is Apache-2.0 and belongs to
Vercel Labs — see [zerolang.ai](https://zerolang.ai/) and
[vercel-labs/zerolang](https://github.com/vercel-labs/zerolang).
