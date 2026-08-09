import { getCapture, summarise, programById, explorerCapture } from '@/lib/data'
import { CROSS_CUTTING, ZERO_PHASES } from '@/lib/phases'
import { Figure, BarChart, ScalingChart, StatStrip, PhaseBar } from '@/components/charts'
import { ZeroCode } from '@/components/zero-code'
import { PhaseExplorer } from '@/components/explorer'
import { QrCode, QR_URL } from '@/components/qr-code'
import { Icon } from '@/components/icons'
import { Sidebar } from '@/components/sidebar'
import { FileRef } from '@/components/file-ref'
import { AudioNative } from '@/components/audio-native'
import { AudienceProvider, AudienceToggle, Audience, MachineBlock } from '@/components/audience'
import { Playground } from '@/components/playground'
import { ProgramGallery, RunEmulation } from '@/components/programs'
import {
  PipelineRibbon, PhaseWheel, GateFlow, ArtifactScale, ReadCostVisual,
} from '@/components/visuals'
import {
  AgentReadershipSection, MissingConceptsSection, OutlookSection,
} from '@/components/sections'
import {
  CompilePathDiagram, AgentLoopDiagram, GateDiagram, PhaseRelocationDiagram,
} from '@/components/diagrams'
import { GateWalkthrough, PhaseCostExplainer } from '@/components/explainers'
import {
  PhaseMappingTable, BackendMatrixTable, ErrorCorpusTable,
  CapabilityMatrixTable, ScalingTable,
} from '@/components/evidence'

export const dynamic = 'force-static'

const AUTHORS = {
  lead: 'Harshit Khemani',
  co: ['Kush Ahuja', 'Mohit Kumar Mishra', 'Kushagra Agrawal'],
  submittedTo: 'Ms. Ankita Sharma',
  site: 'zero.khe.money',
}

const TOC = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'introduction', label: '1. Introduction' },
  { id: 'zero', label: '2. What Zero is' },
  { id: 'traditional', label: '3. Traditional compilers' },
  { id: 'graph-first', label: '4. Zero’s compiler' },
  { id: 'method', label: '5. Methodology' },
  { id: 'results', label: '6. Results' },
  { id: 'programs', label: '7. The corpus' },
  { id: 'explorer', label: '8. Phase explorer' },
  { id: 'playground', label: '9. Playground' },
  { id: 'agents', label: '10. Agents as the reader' },
  { id: 'discussion', label: '11. Discussion' },
  { id: 'scope', label: '12. Scope and omissions' },
  { id: 'limitations', label: '13. Threats to validity' },
  { id: 'related', label: '14. Related work' },
  { id: 'outlook', label: '15. Outlook' },
  { id: 'conclusion', label: '16. Conclusion' },
  { id: 'references', label: 'References' },
  { id: 'appendix', label: 'Appendix A' },
]

const DOWNLOADS = [
  {
    href: '/phases-of-compiler-design.pdf',
    label: 'PDF',
    meta: 'A4',
    preview: '/preview-pdf.png',
    previewAlt: 'First page of the typeset PDF',
  },
  {
    href: '/phases-of-compiler-design.epub',
    label: 'ePub',
    meta: 'reflow',
    preview: '/preview-epub.png',
    previewAlt: 'The abstract, reflowed for an e-reader',
  },
]

const R = {
  zero: 'https://zerolang.ai/',
  zeroRepo: 'https://github.com/vercel-labs/zerolang',
  zeroStart: 'https://zerolang.ai/getting-started',
  zeroGraph: 'https://zerolang.ai/concepts/graph-architecture',
  zeroCompilePath: 'https://zerolang.ai/concepts/compile-path',
  zeroSemantic: 'https://zerolang.ai/concepts/semantic-vs-text',
  dragon: 'https://www.pearson.com/en-us/subject-catalog/p/compilers-principles-techniques-and-tools/P200000003472',
  cooper: 'https://www.elsevier.com/books/engineering-a-compiler/cooper/978-0-12-815412-0',
  roslyn: 'https://github.com/dotnet/roslyn',
  rustcQuery: 'https://rustc-dev-guide.rust-lang.org/query.html',
  rustcJson: 'https://doc.rust-lang.org/rustc/json.html',
  salsa: 'https://github.com/salsa-rs/salsa',
  wterm: 'https://github.com/vercel-labs/wterm',
  geist: 'https://vercel.com/geist/introduction',
  guidelines: 'https://vercel.com/design/guidelines',
  wcag: 'https://www.w3.org/WAI/WCAG22/quickref/',
  repo: 'https://github.com/HKTITAN/phases-of-zero',
} as const

/* A numbered citation. The reference list is an <ol>, so the number here and
   the number there come from the same ordering — kept in one place as REFS
   below rather than written twice. */
function Cite({ n }: { n: number }) {
  return (
    <a href={`#ref-${n}`} className="cite" aria-label={`Reference ${n}`}>[{n}]</a>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
}

export default function Page() {
  const capture = getCapture()
  const client = explorerCapture(capture)
  const s = summarise(capture)
  const hello = programById(capture, 'p01_hello')
  const lexer = programById(capture, 'p08_lexer')
  const version = capture.toolchain.version as { version?: string; commit?: string }
  const captured = new Date(capture.capturedAt).toISOString().slice(0, 10)
  const lowerMs = (id: string) =>
    programById(capture, id).phases.coldTimed.find((p) => p.name === 'lower')?.elapsedMs ?? 0

  return (
    <AudienceProvider>
      <div className="shell">
        <header className="masthead no-print">
          <span className="label" style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.4375rem' }}>
            <Icon name="book" size={16} />
            Phases of Compiler Design
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <span className="meta">Zero {String(version.version ?? '0.3.4')}</span>
            <AudienceToggle />
          </span>
        </header>

        <div className="with-rail">
          <Sidebar entries={TOC} downloads={DOWNLOADS} />

          <main id="main">
            {/* ------------------------------------------------ title block */}
            <section className="section" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
              <p className="meta" style={{ marginBottom: '1.25rem' }}>Review paper</p>
              <h1 className="display" style={{ maxWidth: '19ch' }}>Phases of compiler design</h1>
              <p className="lede" style={{ maxWidth: '56ch', marginTop: '1.5rem' }}>
                The six-phase model, measured against <A href={R.zero}>Zero</A><Cite n={3} /> — a compiler that
                reports its own phase structure as machine-readable data.
              </p>

              <div className="split" style={{ marginTop: '2.5rem', paddingTop: '1.75rem', borderTop: 'var(--rule)' }}>
                <div>
                  <p className="label" style={{ marginBottom: '0.375rem' }}>Submitted by</p>
                  <p style={{ margin: 0, fontSize: '1.0625rem' }}>{AUTHORS.lead}</p>
                  <p className="label" style={{ margin: '1.125rem 0 0.375rem' }}>Co-authors</p>
                  <p style={{ margin: 0, fontSize: '1.0625rem' }}>{AUTHORS.co.join(', ')}</p>
                  <p className="label" style={{ margin: '1.125rem 0 0.375rem' }}>Submitted to</p>
                  <p style={{ margin: 0, fontSize: '1.0625rem' }}>{AUTHORS.submittedTo}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <QrCode size={104} />
                  <div>
                    <p className="label" style={{ marginBottom: '0.25rem' }}>Read online</p>
                    <p style={{ margin: 0 }}>
                      <A href={QR_URL}>
                        <span className="mono" style={{
                          fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center',
                          minHeight: 24, paddingBlock: '0.25rem',
                        }}>{AUTHORS.site}</span>
                      </A>
                    </p>
                    <p className="caption" style={{ marginTop: '0.5rem', maxWidth: '26ch' }}>
                      Source and dataset at <A href={R.repo}>github.com/HKTITAN/phases-of-zero</A>.
                    </p>
                  </div>
                </div>
              </div>

            </section>

            {/* ---------------------------------------------------- abstract */}
            <section id="abstract" className="section">
              <h2 className="heading-24">Abstract</h2>

              <Audience
                human={
                  <div className="prose body">
                    <p>
                      Compiler construction is conventionally taught as a pipeline of six phases:
                      lexical analysis, syntax analysis, semantic analysis, intermediate code
                      generation, optimization, and target code generation, with symbol-table
                      management and error handling running alongside all six. This decomposition
                      is a teaching abstraction. Production compilers rarely expose it, so students
                      seldom see the phases as separable, measurable objects.
                    </p>
                    <p>
                      This paper reviews that model against <A href={R.zero}>Zero</A><Cite n={3} />{' '}
                      {String(version.version)}, an experimental graph-first systems language from
                      Vercel Labs whose compiler reports its own phase names, per-phase timings,
                      symbol tables, and diagnostics as structured JSON. We construct a corpus of{' '}
                      {s.programs} Zero programs ({s.lines} lines, {s.tokens.toLocaleString()}{' '}
                      tokens, {s.nodes.toLocaleString()} graph nodes) and a second corpus of{' '}
                      {s.errorCases} deliberately malformed programs, then measure the compiler
                      across {s.attempts} program-target build combinations.
                    </p>
                    <p>
                      We report four findings. First, the phases do not disappear in a graph-first
                      design — they <em>relocate</em>. Lexical, syntactic and semantic analysis move
                      to an ingestion boundary that admits programs into a persistent graph, after
                      which the compile path performs only lowering, code generation and linking.
                      All {s.rejectedAtImport} front-end error cases were refused at that boundary,
                      and in {s.contaminated === 0 ? 'none' : String(s.contaminated)} of them did the
                      malformed program enter the graph store. Second, lowering accounts for
                      effectively all measurable phase time ({s.lowerShare}%); the entire front end
                      runs below the compiler&apos;s 1 ms reporting resolution because it reads
                      stored facts instead of recomputing them. Third, the front end and the back
                      end accept <em>different languages</em>: {s.attempts - s.builds} of{' '}
                      {s.attempts} builds failed with BLD004 on programs that had already passed{' '}
                      <code>zero check</code>, and the compiler reports <code>ok: true</code>{' '}
                      alongside <code>buildable: false</code> in the same document. Fourth, and
                      against the language&apos;s own premise, its structured output is far more
                      expensive to read than its prose — <code>zero check</code> prints four bytes
                      where <code>zero check --json</code> returns tens of thousands.
                    </p>
                  </div>
                }
                machine={
                  <div>
                    <p className="caption" style={{ marginTop: 0, marginBottom: '0.875rem' }}>
                      The same claims as records. This is what an agent consuming the paper would
                      read — and the size difference between the two views is itself one of the
                      findings, quantified in §10.
                    </p>
                    <MachineBlock
                      caption="abstract.findings"
                      data={{
                        study: {
                          subject: 'zerolang',
                          version: String(version.version),
                          build: String(version.commit),
                          capturedAt: capture.capturedAt,
                        },
                        corpus: {
                          programs: s.programs,
                          nonEmptyLines: s.lines,
                          tokens: s.tokens,
                          graphNodes: s.nodes,
                          testBlocksPassing: s.testCount,
                          errorCases: s.errorCases,
                          buildCombinations: s.attempts,
                        },
                        findings: [
                          {
                            id: 'phase-relocation',
                            claim: 'Front-end phases run at an ingestion gate, not on the compile path.',
                            evidence: {
                              frontEndCasesRejectedAtImport: s.rejectedAtImport,
                              storeContaminations: s.contaminated,
                              compilePathPhases: ['lower', 'codegen', 'object', 'link'],
                            },
                          },
                          {
                            id: 'lowering-dominates',
                            claim: 'Lowering is effectively all measurable phase time.',
                            evidence: {
                              lowerSharePct: s.lowerShare,
                              otherPhasesMs: 0,
                              reportingResolutionMs: 1,
                            },
                          },
                          {
                            id: 'acceptance-gap',
                            claim: 'The front end accepts a strictly larger language than the back end lowers.',
                            evidence: {
                              buildsAttempted: s.attempts,
                              buildsSucceeded: s.builds,
                              failures: s.attempts - s.builds,
                              allFailuresCode: 'BLD004',
                              contradiction: { ok: true, 'targetReadiness.buildable': false },
                            },
                          },
                          {
                            id: 'structured-output-cost',
                            claim: 'Structured output costs far more to read than prose.',
                            evidence: {
                              checkTextBytes: capture.readCost?.[0]?.checkTextBytes ?? null,
                              checkJsonBytes: capture.readCost?.[0]?.checkJsonBytes ?? null,
                            },
                          },
                        ],
                      }}
                    />
                  </div>
                }
              />

              <div style={{ marginTop: '2rem' }}>
                <StatStrip
                  stats={[
                    { value: String(s.programs), label: 'Programs in corpus' },
                    { value: s.nodes.toLocaleString(), label: 'Graph nodes analysed' },
                    { value: `${s.builds}/${s.attempts}`, label: 'Builds that succeeded' },
                    { value: `${s.lowerShare}`, unit: '%', label: 'Phase time in lowering' },
                    { value: String(s.errorCases), label: 'Error cases' },
                  ]}
                />
              </div>
              <p className="caption">
                All figures produced by <code>tools/capture.mjs</code> against Zero{' '}
                {String(version.version)} (build {String(version.commit)}) on {capture.machine.cpu},{' '}
                {capture.machine.cores} cores, {capture.machine.platform}/{capture.machine.arch}.
                Captured {captured}.
              </p>
            </section>

            {/* ------------------------------------------------ introduction */}
            <section id="introduction" className="section">
              <h2 className="heading-24">1. Introduction</h2>
              <div className="prose body">
                <p>
                  Every undergraduate compilers course opens with the same diagram: source text
                  enters at the top, passes through a vertical stack of labelled boxes, and machine
                  code emerges at the bottom. Two narrow rectangles run down the side of the stack,
                  touching every box — the symbol table and the error handler. The diagram is due in
                  its modern form to <A href={R.dragon}>Aho, Lam, Sethi and Ullman</A><Cite n={1} />, and it has
                  organised the field for four decades.
                </p>
                <p>
                  The diagram is also, in an important sense, unfalsifiable by students. Real
                  compilers fuse phases for speed, interleave them for incrementality, and expose
                  none of the boundaries. A student who runs <code>gcc</code> or <code>rustc</code>{' '}
                  sees a binary appear and, on failure, a paragraph of English. The phases are real,
                  but they are not <em>visible</em>.
                </p>
                <p>
                  This paper asks a narrow question: <strong>does the classical six-phase model
                  still describe a compiler built on a fundamentally different substrate, and if
                  not, how does it differ?</strong> We answer it empirically — by building a corpus,
                  instrumenting the compiler through its own reporting interfaces, and measuring.
                </p>
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <PipelineRibbon variant="traditional" />
              </div>
            </section>

            {/* ------------------------------------------------------- zero */}
            <section id="zero" className="section">
              <h2 className="heading-24">2. What Zero is</h2>
              <div className="prose body">
                <p>
                  <A href={R.zero}>Zero</A><Cite n={3} /> is an experimental systems programming language released
                  by Vercel Labs in May 2026 under Apache-2.0, with{' '}
                  <A href={R.zeroRepo}>source on GitHub</A>. It compiles to standalone native
                  executables, has no garbage collector, gives explicit control over memory, and sits
                  in roughly the design space of C and Zig. Its compiler core is written in C.
                  Programs use the <code>.0</code> extension. We study version{' '}
                  {String(version.version)}, build {String(version.commit)}.
                </p>
                <p>
                  Its distinguishing premise is stated in its own tagline:{' '}
                  <em>the programming language for agents</em>. Zero is built on the assumption that
                  AI agents, rather than humans, will be the primary consumers of compiler output —
                  and the design follows that assumption further than any other language we are
                  aware of.
                </p>
              </div>

              <div style={{ marginTop: '2rem', maxWidth: 720 }}>
                <ZeroCode
                  file="p01_hello / src/main.0"
                  meta="the smallest complete program"
                  src={hello.sources.find((f) => f.file.endsWith('main.0'))?.text ?? ''}
                />
                <p className="caption">
                  Figure 1. <code>pub fn</code> exports. <code>World</code> carries runtime
                  capabilities. <code>raises</code> marks the function fallible, and{' '}
                  <code>check</code> propagates failure. This compiles to a{' '}
                  {hello.metrics.artifact?.bytes ?? 1536}-byte native executable in{' '}
                  {lowerMs('p01_hello')} ms of lowering.
                </p>
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.25rem' }}>
                2.1 How it differs from current languages
              </h3>
              <div className="prose body">
                <p>Four departures matter for this paper.</p>
                <p>
                  <strong>The semantic graph is the program, not the text.</strong> A Zero package
                  compiles from a binary <code>zero.graph</code> store holding declarations, types,
                  calls, scopes, imports, capabilities and source-map facts as rows in sixteen
                  relations. The <code>.0</code> files a human reads are a <em>projection</em> of
                  that graph. In every other mainstream language text is authoritative and the
                  compiler&apos;s internal representation is derived and discarded; Zero{' '}
                  <A href={R.zeroSemantic}>inverts that relationship</A><Cite n={6} />.
                </p>
                <p>
                  <strong>Diagnostics are data, not prose.</strong> Every command accepts{' '}
                  <code>--json</code> against a versioned schema. Each diagnostic carries a stable
                  code, a span, structured <code>expected</code>/<code>actual</code> facts, a{' '}
                  <code>fixSafety</code> rating, and often a typed <code>repair</code> identifier.
                </p>
                <p>
                  <strong>Effects and capabilities are explicit and target-checked.</strong> A
                  function performing I/O receives a <code>World</code> handle and is marked{' '}
                  <code>raises</code>. Each target independently declares which capabilities it
                  provides, so a program using the network is rejected at compile time for a target
                  that declares no <code>net</code> capability.
                </p>
                <p>
                  <strong>The toolchain reports itself.</strong> A single{' '}
                  <code>zero check --json</code> returns the phase list with timings, graph table row
                  counts, the resolved call graph with contracts, cache keys with hit status, and a
                  target readiness report. There is also <code>zero tokens</code>, which counts a
                  program in LLM tokens.
                </p>
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.25rem' }}>
                2.2 Why its designers argue it is needed
              </h3>
              <div className="prose body">
                <p>
                  The case Zero makes is about the cost of a translation layer. In a conventional
                  agent loop, an agent writes text, the compiler renders its objection as English,
                  and the agent parses that English back into an intent it already had.
                  Zero&apos;s <A href={R.zeroGraph}>graph architecture documentation</A><Cite n={4} /> frames the
                  contrast as two loops.
                </p>
              </div>

              <div className="print-omit" /* the prose in 2.2 states the same contrast */ style={{ marginTop: '1.5rem' }}>
                <AgentLoopDiagram />
              </div>

              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  Three specific failures are claimed. <em>Line ranges are the wrong handle</em> —
                  they drift the moment anything reformats, whereas semantic node identifiers do
                  not. <em>English is a lossy encoding of compiler state</em> — the compiler knew
                  the exact repair and discarded that structure to print a sentence.{' '}
                  <em>Feedback latency bounds the loop</em>.
                </p>
                <p>
                  A fourth motive is arguably strongest and less often stated:{' '}
                  <strong>capability containment</strong>. For code an agent wrote and no human read
                  line by line, a compiler that refuses to build a program using a capability the
                  target does not declare is a real safety property.
                </p>
                <p>
                  We record the counterarguments in the same breath. Structured diagnostics are not
                  new: <A href={R.rustcJson}>rustc</A> and TypeScript have emitted machine-readable
                  errors for years. And the adoption argument cuts hard against it — models write
                  best in the languages that dominate their training data, so a language with a few
                  thousand GitHub stars is one agents are, today, measurably worse at than Go or
                  Rust. Zero is betting a tight verifiable loop outruns familiarity. That bet is
                  unproven, and this paper does not settle it.
                </p>
              </div>
            </section>

            {/* ------------------------------------------------- traditional */}
            <section id="traditional" className="section">
              <h2 className="heading-24">3. How traditional compilers work</h2>
              <div className="prose body">
                <p>
                  The canonical decomposition treats compilation as a sequence of meaning-preserving
                  translations. Each phase consumes one representation and produces the next.
                </p>
                <p>
                  The <strong>analysis</strong> half — phases one to three, the front end —
                  determines what the program means. Lexical analysis groups characters into tokens.
                  Syntax analysis arranges tokens into a tree reflecting the grammar. Semantic
                  analysis annotates that tree with types, resolves every name to a declaration, and
                  rejects programs that are well-formed but meaningless.
                </p>
                <p>
                  The <strong>synthesis</strong> half — phases four to six, the back end —
                  determines how the program runs: an intermediate representation, optimization over
                  it, then instruction selection and object emission.
                </p>
                <p>
                  Two activities refuse to sit in any single box. The <strong>symbol table</strong>{' '}
                  is written by the front end and read by every later phase.{' '}
                  <strong>Error detection</strong> occurs in all six, and the phase that detects an
                  error largely determines how good the message can be. That last point is the one
                  we test in §6.4.
                </p>
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <PhaseRelocationDiagram />
              </div>
            </section>

            {/* ------------------------------------------------- graph-first */}
            <section id="graph-first" className="section">
              <h2 className="heading-24">4. How Zero&apos;s compiler differs</h2>
              <div className="prose body">
                <p>
                  Zero&apos;s own <A href={R.zeroCompilePath}>compile-path documentation</A><Cite n={5} /> states
                  the contrast directly. A conventional compiler runs source files through a lexer
                  and parser to an AST, then name resolution, type checking, IR lowering,
                  optimization and codegen. Zero starts from the graph store.
                </p>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <PipelineRibbon variant="zero" />
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <CompilePathDiagram />
              </div>

              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  The consequential difference is what is <em>missing</em> from the second sequence.
                  There is no lexer, no parser and no separate name-resolution stage on the compile
                  path, because by the time a program is in the graph store its names are already
                  bound and its types already recorded. Those stages still exist — they run at the
                  boundary where text is admitted into the graph.
                </p>
                <p>
                  This is why the compiler reports <code>resolve</code> <em>before</em>{' '}
                  <code>parse</code>, an ordering that reads as a typo until you understand the
                  substrate. The eight phases it reports, in its own order:
                </p>
                <ul style={{ paddingLeft: '1.15rem', margin: '0 0 1rem' }}>
                  {ZERO_PHASES.map((p) => (
                    <li key={p.name} style={{ marginBottom: '0.3125rem' }}>
                      <code>{p.name}</code> — {p.note}
                    </li>
                  ))}
                </ul>
                <p>And the two cross-cutting concerns become first-class inspectable objects:</p>
                <ul style={{ paddingLeft: '1.15rem', margin: 0 }}>
                  {CROSS_CUTTING.map((c) => (
                    <li key={c.id} style={{ marginBottom: '0.5rem' }}>
                      <strong>{c.name}.</strong> {c.zero} Probe: <code>{c.probe}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ------------------------------------------------- methodology */}
            <section id="method" className="section">
              <h2 className="heading-24">5. Methodology</h2>
              <div className="prose body">
                <h3 className="heading-20" style={{ marginTop: '1.5rem' }}>5.1 Corpus construction</h3>
                <p>
                  We wrote {s.programs} Zero packages of increasing size and feature coverage, from
                  a six-line hello-world to the {lexer.metrics.nonEmptyLines}-line arithmetic tokenizer in{' '}
                  <FileRef capture={client} program="p08_lexer" file="src/lib.0">p08_lexer/src/lib.0</FileRef>. Each was developed until <code>zero check</code>,{' '}
                  <code>zero test</code> and <code>zero run</code> all succeeded, or until the
                  obstruction was documented as a finding. The corpus totals {s.lines} non-empty
                  lines, {s.tokens.toLocaleString()} tokens and {s.testCount} passing test blocks.
                  All eight are reproduced in full in §7.
                </p>

                <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>5.2 Error corpus</h3>
                <p>
                  Measuring where errors are detected requires programs that fail on purpose. We
                  wrote {s.errorCases} minimal packages, each violating exactly one rule and
                  targeting a specific phase. Each carries a <code>case.json</code> declaring the
                  phase it targets <em>before</em> measurement, so the mapping in §6.4 is a
                  prediction rather than a post-hoc fit.
                </p>

                <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>5.3 Instrumentation</h3>
                <p>
                  One harness, <code>tools/capture.mjs</code>, drives every measurement and writes a
                  single JSON document. Per program it captures the token stream, parse summary,
                  full semantic report, graph, source mappings, phase timings and artifact
                  measurements, then builds every program for every advertised target. We report
                  phase timings from <code>zero time</code> rather than <code>zero check</code>,
                  because the former drives the pipeline through emission; and wall-clock separately,
                  as median of five runs, because ~40 ms of process startup dominates at this scale.
                </p>

                <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>5.4 Reproducibility</h3>
                <p>
                  Every number derives from one machine-generated dataset. No figure is transcribed
                  by hand; the prose reads the same JSON the charts do. Appendix A gives the
                  commands. The environment was an {capture.machine.cpu} with{' '}
                  {capture.machine.cores} logical cores and {capture.machine.totalMemGB} GB of
                  memory, running {capture.machine.platform}/{capture.machine.arch}.
                </p>
              </div>
            </section>

            {/* ----------------------------------------------------- results */}
            <section id="results" className="section">
              <h2 className="heading-24">6. Results</h2>

              <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
                6.1 Mapping the classical phases onto Zero
              </h3>
              <div className="prose body">
                <p>
                  Zero reports eight phases; the classical model names six. They do not correspond
                  one-to-one, and the mismatches are informative.
                </p>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <PhaseMappingTable capture={capture} />
              </div>
              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  Semantic analysis fragments into three reported phases because interface
                  fingerprinting is separated out to drive incremental invalidation. Optimization
                  has <em>no</em> reported phase: it is selected by build profile. And the IR is
                  never printed — <code>--emit llvm-ir</code> fails with BLD004 on every target,
                  leaving the lowered module&apos;s <em>size</em> as the only observable.
                </p>
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.5rem' }}>
                6.2 Where compile time actually goes
              </h3>
              <div className="prose body">
                <p>
                  Across all {s.programs} programs, {s.lowerShare}% of reported phase milliseconds
                  are spent in <code>lower</code>. Every other phase reports 0 ms.
                </p>
              </div>

              <div className="print-omit" /* Figure 5 already shows the lowering share */ style={{ marginTop: '1.5rem' }}>
                <PhaseWheel capture={capture} />
              </div>

              <div className="print-omit" style={{ marginTop: '1.75rem' }}>
                <PhaseCostExplainer capture={client} />
              </div>

              <div className="grid-2" style={{ marginTop: '1.75rem' }}>
                <Figure
                  title="Lowering cost by program"
                  meta="zero time --json, cold"
                  caption={<>Figure 5. Milliseconds in <code>lower</code>. Every other phase reports 0 ms.</>}
                >
                  <BarChart
                    unit="ms"
                    tableLabel="Lowering time"
                    data={capture.corpus.map((p) => ({
                      label: p.id.replace(/^p\d+_/, ''),
                      value: p.phases.coldTimed.find((x) => x.name === 'lower')?.elapsedMs ?? 0,
                      emphasis: p.id === 'p08_lexer',
                    }))}
                  />
                </Figure>
                <Figure
                  title="Graph size against source size"
                  meta={`${s.programs} programs`}
                  caption={<>Figure 6. ≈{(s.nodes / s.lines).toFixed(1)} graph nodes per source line — a constant-factor expansion, not a blow-up.</>}
                >
                  <ScalingChart
                    points={capture.corpus.map((p) => ({
                      x: p.metrics.nonEmptyLines, y: p.metrics.graphNodes ?? 0, label: p.id,
                    }))}
                    xLabel="Source lines"
                    yLabel="Graph nodes"
                  />
                </Figure>
              </div>

              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  This is the expected consequence of the architecture. In a text-first compiler the
                  front end reconstructs meaning from characters on every invocation. In Zero it
                  reads a store where names are already bound, so it does almost no work. What
                  remains expensive is the one phase that cannot be cached away.
                </p>
                <p>
                  The honest caveat is resolution: the compiler reports integer milliseconds, so
                  &quot;0 ms&quot; means &quot;under one millisecond&quot;, not &quot;free&quot;.
                </p>
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <Figure
                  title="Phase composition, largest program"
                  meta={`p08_lexer · ${lexer.metrics.nonEmptyLines} lines`}
                  caption={<>Figure 7. All eight reported phases. The bar is effectively one segment: <code>lower</code> at {lowerMs('p08_lexer')} ms.</>}
                  full
                >
                  <PhaseBar
                    phases={lexer.phases.coldTimed.map((p) => ({ name: p.name, ms: p.elapsedMs }))}
                    totalLabel="p08_lexer, cold cache"
                  />
                </Figure>
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.5rem' }}>
                6.3 The symbol table, persisted
              </h3>
              <div className="prose body">
                <p>
                  In the classical model the symbol table is a structure the front end builds and
                  discards. In Zero it is sixteen persisted relations, carried between invocations
                  and reported as row counts on every compile.
                </p>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <ScalingTable capture={capture} />
              </div>
              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  Two structural invariants hold across the corpus. The <code>sourceMap</code> row
                  count equals the <code>node</code> count exactly for every program — every graph
                  node retains a source position. And the edge count is exactly two fewer than the
                  node count, consistent with a spanning structure over the module and package roots.
                </p>
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.5rem' }}>
                6.4 Error handling: three admission gates, not one
              </h3>
              <div className="prose body">
                <p>
                  This is the paper&apos;s central empirical result. We expected the error corpus to
                  partition by phase within a single compile. Instead it partitions by{' '}
                  <em>gate</em>, and there are three.
                </p>
              </div>

              <div className="print-omit" /* GateDiagram already shows the three gates */ style={{ marginTop: '1.5rem' }}>
                <GateFlow capture={capture} />
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <GateDiagram capture={capture} />
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <ErrorCorpusTable capture={capture} />
              </div>

              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  The {s.rejectedAtImport} front-end failures were all refused at{' '}
                  <code>zero import</code>. Critically, <code>zero check</code> subsequently
                  reported <code>ok</code> for all of them, because the malformed program never
                  entered the store — after each rejection <code>zero view --fn main</code> still
                  projected the <em>previous</em> program. The capability violation passed ingestion
                  and was refused by <code>zero check --target</code>. And {s.rejectedAtBuild} cases
                  passed both and were refused only at <code>zero build</code>.
                </p>
              </div>

              <div className="print-omit" style={{ marginTop: '1.75rem' }}>
                <GateWalkthrough capture={client} />
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.5rem' }}>
                6.5 The front end and the back end accept different languages
              </h3>
              <div className="prose body">
                <p>
                  We built every corpus program for every advertised target: {s.attempts}{' '}
                  combinations. {s.builds} succeeded ({s.buildRate}%). Every one of the{' '}
                  {s.attempts - s.builds} failures was BLD004 — the back end declining to lower a
                  construct semantic analysis had accepted.
                </p>
              </div>

              <div className="print-omit" /* BackendMatrixTable already carries the sizes */ style={{ marginTop: '1.5rem' }}>
                <ArtifactScale capture={capture} />
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <BackendMatrixTable capture={capture} />
              </div>

              <div className="prose body" style={{ marginTop: '1.75rem' }}>
                <p>
                  The failures name specific constructs the MIR subset cannot represent: aggregate
                  values crossing a function boundary, <code>check</code> and <code>rescue</code> on
                  user-defined fallible functions, and instructions absent from an
                  architecture&apos;s emitter.
                </p>
                <p>
                  First, <strong>backend completeness is target-specific.</strong> The{' '}
                  <FileRef capture={client} program="p05_errors">p05_errors</FileRef> program
                  fails to build on the Windows host but cross-compiles to an 826-byte ELF for <code>linux-musl-x64</code>. Same graph,
                  same front end, two answers.
                </p>
                <p>
                  Second, <strong>a passing <code>zero check</code> does not imply a buildable
                  program</strong> — though the compiler is not ignorant. It records{' '}
                  <code>targetReadiness.buildable: false</code>, <code>stage: &quot;lower&quot;</code>{' '}
                  and a BLD004 naming the construct. The difficulty is that the same document
                  carries <code>ok: true</code> with an empty top-level <code>diagnostics</code>{' '}
                  array. A consumer testing the field the schema presents as the verdict gets the
                  wrong answer.
                </p>
              </div>

              <div className="table-wrap" style={{ marginBlock: '1.75rem' }}>
                <table>
                  <caption>
                    Table 6. Fields reported by <code>zero check --json</code> for the two lowering
                    cases. Both rows describe the same compilation.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Case</th>
                      <th scope="col">Construct</th>
                      <th scope="col"><code>ok</code></th>
                      <th scope="col" className="n"><code>diagnostics</code></th>
                      <th scope="col"><code>buildable</code></th>
                      <th scope="col"><code>stage</code></th>
                      <th scope="col">Actual build</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capture.errorCases.filter((e) => e.checkKnewButReportedOk).map((e) => (
                      <tr key={e.id}>
                        <th scope="row" className="mono">{e.id}</th>
                        <td className="mono">{e.readinessDiagnostics[0]?.actual ?? '—'}</td>
                        <td className="mono">true</td>
                        <td className="n mono">0</td>
                        <td className="mono">false</td>
                        <td className="mono">{e.checkReadinessStage ?? '—'}</td>
                        <td className="mono">BLD004</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="print-omit" /* supplementary; 8x10 matrix reads better online */ style={{ marginTop: '1.75rem' }}>
                <CapabilityMatrixTable capture={capture} />
              </div>
            </section>

            {/* ---------------------------------------------------- programs */}
            {/* Paper edition only. The three sections below exist to be operated,
                not read, so print replaces them with the way to reach them. */}
            <section className="section print-only" aria-hidden="true">
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                <QrCode size={112} />
                <div style={{ minWidth: 0 }}>
                  <h2 className="heading-24" style={{ marginBottom: '0.5rem' }}>
                    Sections 7 to 9 are interactive
                  </h2>
                  <p className="body" style={{ margin: '0 0 0.625rem', maxWidth: '46ch' }}>
                    Three parts of this study cannot be printed, because they are things you
                    operate rather than things you read:
                  </p>
                  <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.1rem', fontSize: '0.9375rem' }}>
                    <li><strong>§7 The corpus in full</strong> — all {s.programs} programs,{' '}
                      {s.lines} lines of Zero, with their measurements and real output, plus a
                      stepped replay of one program being compiled.</li>
                    <li><strong>§8 Phase explorer</strong> — one program walked through all six
                      classical phases, showing the artifact the compiler actually emitted at each.</li>
                    <li><strong>§9 Playground</strong> — write Zero and have it lexed and parsed
                      in the browser by a reimplementation that agrees exactly with{' '}
                      <code>zero tokens --json</code> on all {s.programs} corpus programs.</li>
                  </ul>
                  <p className="body" style={{ margin: 0, maxWidth: '46ch' }}>
                    Scan the code, or visit <strong>{AUTHORS.site}</strong>. The complete dataset
                    and the harness that produced it are at github.com/HKTITAN/phases-of-zero.
                  </p>
                </div>
              </div>
            </section>

            <section id="programs" className="section print-omit">
              <h2 className="heading-24">7. The corpus, in full</h2>
              <div className="prose body">
                <p>
                  All {s.programs} programs are reproduced below with their measurements, their test
                  results and their real output. Together they are {s.lines} non-empty lines of
                  Zero. Each was written to exercise a distinct set of compiler tables.
                </p>
              </div>

              <div style={{ marginTop: '1.75rem' }}>
                <ProgramGallery capture={client} />
              </div>

              <h3 className="heading-20" style={{ marginTop: '2.5rem' }}>7.1 Watching one compile</h3>
              <div className="prose body">
                <p>
                  A replay of the recorded measurements, stepped through phase by phase. This is not
                  a live compile — it is the captured data for the selected program, advanced one
                  reported phase at a time.
                </p>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <RunEmulation capture={client} />
              </div>
            </section>

            {/* ---------------------------------------------------- explorer */}
            <section id="explorer" className="section print-omit">
              <h2 className="heading-24">8. Interactive phase explorer</h2>
              <div className="prose body">
                <p>
                  Take one program and watch it become each successive representation. Every panel
                  shows real captured output from the command named in its caption.
                </p>
              </div>
              <div style={{ marginTop: '1.75rem' }}>
                <PhaseExplorer capture={client} />
              </div>
              <p className="caption print-only">
                The interactive explorer is available in the web edition at {AUTHORS.site}.
              </p>
            </section>

            {/* -------------------------------------------------- playground */}
            <section id="playground" className="section print-omit">
              <h2 className="heading-24">9. Playground</h2>
              <div className="prose body">
                <p>
                  Write Zero and see it analysed. Lexing and parsing run in your browser: we
                  reimplemented Zero&apos;s scanner and declaration parser in TypeScript, then
                  validated them against the compiler&apos;s own <code>zero tokens --json</code>{' '}
                  output. Agreement is exact — kind, text, line and column — on all{' '}
                  {s.programs} corpus programs, 2,666 tokens in total, and the parser recovers the
                  same function set as <code>zero parse --json</code> on all eight. Those two
                  phases are therefore real, not simulated, and they run on whatever you type.
                </p>
                <p>
                  Phases three to six cannot run here. Zero {String(version.version)} ships no
                  WebAssembly target and its own <code>selfHostRouting</code> report marks{' '}
                  <code>browserCompiler</code> as removed, so for the corpus programs those phases
                  are replayed from the recorded capture — and the terminal says so explicitly once
                  you edit the buffer away from a captured program.
                </p>
              </div>
              <div style={{ marginTop: '1.75rem' }}>
                <Playground capture={client} />
              </div>
              <p className="caption print-only">
                The playground is available in the web edition at {AUTHORS.site}.
              </p>
            </section>

            {/* ------------------------------------------------------ agents */}
            <AgentReadershipSection capture={capture} />

            <div style={{ marginTop: '-1px' }}>
              <ReadCostVisual capture={capture} />
            </div>

            {/* -------------------------------------------------- discussion */}
            <section id="discussion" className="section">
              <h2 className="heading-24">11. Discussion</h2>
              <div className="prose body">
                <h3 className="heading-20" style={{ marginTop: '1.5rem' }}>
                  11.1 Phases relocate; they do not disappear
                </h3>
                <p>
                  It would be easy to read Zero&apos;s architecture as abolishing the front end. It
                  does not. Every classical phase is present and every one still runs — but the
                  first three moved out of the compile path into an ingestion gate that runs once
                  per edit rather than once per build.
                </p>
                <p>
                  This relocation explains all our findings at once: the timing distribution in
                  §6.2, the containment result in §6.4, and the acceptance gap in §6.5. One
                  architectural choice, three consequences.
                </p>

                <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
                  11.2 Two levels of truth in one document
                </h3>
                <p>
                  Our first reading of the acceptance gap was wrong: we recorded it as the compiler
                  failing to detect a problem. It detects it. <code>targetReadiness</code> carries
                  the correct verdict and a diagnostic naming the offending construct.
                </p>
                <p>
                  What the compiler does is subtler and, for its stated audience, arguably worse
                  than not checking: it publishes two summaries of the same compilation that
                  disagree. A human reading the whole document notices. A program reading the field
                  the schema presents as the verdict does not. A language whose central claim is
                  that output should be consumed by machines has taken on an obligation a
                  human-facing compiler has not: its top-level fields are an API. Machine-readability
                  is necessary but not sufficient for machine-<em>reliability</em>.
                </p>

                <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
                  11.3 Implications for compiler pedagogy
                </h3>
                <p>
                  Our practical conclusion is narrower than Zero&apos;s marketing and, we think,
                  more durable. A student using Zero can print the phase list, time each phase, read
                  the symbol table as sixteen relations, watch a program be refused at three
                  distinct gates, and diff the object formats produced by five emitters from one
                  source graph — from the command line, without patching a compiler. We are not
                  aware of another production-intent compiler where the phase structure is this
                  directly inspectable.
                </p>
              </div>
            </section>

            {/* ------------------------------------------------------- scope */}
            <MissingConceptsSection capture={capture} />

            {/* ------------------------------------------------- limitations */}
            <section id="limitations" className="section">
              <h2 className="heading-24">13. Threats to validity</h2>
              <div className="prose body">
                <p>
                  <strong>Single version, single platform.</strong> All measurements are from Zero
                  {' '}{String(version.version)} build {String(version.commit)} on one Windows x64
                  machine. Zero is explicitly experimental and shipped four minor versions in
                  roughly a month; the backend gaps we document are the ones most likely to close.
                </p>
                <p>
                  <strong>Corpus scale.</strong> {s.lines} lines across {s.programs} programs is
                  small. It is adequate for demonstrating phase structure and the acceptance gap,
                  both qualitative properties, but too small to resolve front-end phase timings
                  against the compiler&apos;s 1 ms granularity or to claim asymptotic scaling.
                </p>
                <p>
                  <strong>Corpus authorship.</strong> The corpus was written to exercise particular
                  compiler tables, so coverage is deliberate rather than representative. Several
                  programs were shaped by what the backend would accept, which biases them toward
                  the lowerable subset — if anything this <em>understates</em> the acceptance gap.
                </p>
                <p>
                  <strong>Timing methodology.</strong> Wall-clock includes ~40 ms of process startup
                  we could not separate without instrumenting the binary, so all phase-level claims
                  rest on the compiler&apos;s self-reported times.
                </p>
                <p>
                  <strong>Browser reimplementation.</strong> The playground&apos;s lexer and parser
                  are ours, not Zero&apos;s. They agree exactly with{' '}
                  <code>zero tokens --json</code> across all {s.programs} corpus programs, but that
                  corpus is {s.lines} lines written by us: agreement on it is evidence of
                  correctness on the constructs we used, not a proof of equivalence. Input using
                  syntax the corpus never exercises may diverge, and only the native compiler is
                  authoritative.
                </p>
                <p>
                  <strong>Documentation discrepancies.</strong> Several examples in the shipped
                  language guide do not compile on this build. We report these as observations about
                  version {String(version.version)}, not claims about the language design.
                </p>
              </div>
            </section>

            {/* ----------------------------------------------------- related */}
            <section id="related" className="section">
              <h2 className="heading-24">14. Related work</h2>
              <div className="prose body">
                <p>
                  The phase decomposition we test against is due to{' '}
                  <A href={R.dragon}>Aho, Lam, Sethi and Ullman</A><Cite n={1} />, with incremental and
                  query-driven alternatives surveyed by <A href={R.cooper}>Cooper and Torczon</A><Cite n={2} />.
                  Zero&apos;s persistent-graph approach has clear antecedents: the{' '}
                  <A href={R.roslyn}>Roslyn</A><Cite n={8} /> compiler platform exposed compilation as a queryable
                  object model, and query-based architectures — <A href={R.rustcQuery}>rustc&apos;s
                  demand-driven query system</A><Cite n={9} /> and the <A href={R.salsa}>salsa</A><Cite n={11} /> framework behind
                  Rust Analyzer — already treat compilation as incremental recomputation over a
                  memoised fact database. Zero&apos;s distinguishing move is making the graph the{' '}
                  <em>authoritative stored artifact</em>, with text demoted to a projection.
                </p>
                <p>
                  On structured diagnostics, both <A href={R.rustcJson}>rustc</A> and TypeScript ship
                  machine-readable error output; Zero&apos;s contribution is typed repair identifiers
                  and safety ratings rather than machine-readability itself.
                </p>
                <p>
                  We are not aware of prior empirical work measuring a compiler&apos;s phase
                  structure through its own reporting interface, largely because few compilers
                  expose one.
                </p>
              </div>
            </section>

            {/* ----------------------------------------------------- outlook */}
            <OutlookSection capture={capture} />

            {/* -------------------------------------------------- conclusion */}
            <section id="conclusion" className="section">
              <h2 className="heading-24">16. Conclusion</h2>
              <div className="prose body">
                <p>
                  The classical six-phase model survives contact with a graph-first compiler, but
                  not in the shape the diagram suggests. Across {s.programs} programs and{' '}
                  {s.attempts} build combinations we find that Zero implements every classical phase
                  while relocating the first three out of the compile path into an ingestion gate.
                  That single change explains our measurements: lowering accounts for{' '}
                  {s.lowerShare}% of reported phase time; all {s.rejectedAtImport} front-end error
                  cases were contained at the gate; and {s.attempts - s.builds} of {s.attempts}{' '}
                  builds failed on programs the front end had accepted.
                </p>
                <p>
                  For a compilers course, the practical finding is that Zero makes the phases{' '}
                  <em>visible</em> in a way mainstream toolchains do not. Whether the language
                  succeeds on its own agent-oriented terms is a separate question, whose answer
                  probably has more to do with training-data distribution than with compiler design.
                  The observability is worth studying either way.
                </p>
              </div>
            </section>

            {/* -------------------------------------------------- references */}
            <section id="references" className="section">
              <h2 className="heading-24">References</h2>
              <ol className="prose" style={{ paddingLeft: '1.25rem', fontSize: '0.9375rem', lineHeight: 1.65 }}>
                <li id="ref-1" style={{ marginBottom: '0.75rem' }}>
                  A. V. Aho, M. S. Lam, R. Sethi, J. D. Ullman.{' '}
                  <em>Compilers: Principles, Techniques, and Tools.</em> 2nd ed., Pearson, 2007.{' '}
                  <A href={R.dragon}>pearson.com</A>
                </li>
                <li id="ref-2" style={{ marginBottom: '0.75rem' }}>
                  K. D. Cooper, L. Torczon. <em>Engineering a Compiler.</em> 3rd ed., Morgan
                  Kaufmann, 2022. <A href={R.cooper}>elsevier.com</A>
                </li>
                <li id="ref-3" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>Zero — the programming language for agents.</em>{' '}
                  <A href={R.zero}>zerolang.ai</A> · <A href={R.zeroRepo}>github.com/vercel-labs/zerolang</A>{' '}
                  (Apache-2.0). Version {String(version.version)}, build {String(version.commit)}.
                </li>
                <li id="ref-4" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>Graph architecture.</em> <A href={R.zeroGraph}>zerolang.ai/concepts/graph-architecture</A>
                </li>
                <li id="ref-5" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>Compile path.</em> <A href={R.zeroCompilePath}>zerolang.ai/concepts/compile-path</A>
                </li>
                <li id="ref-6" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>Semantic graph vs text.</em> <A href={R.zeroSemantic}>zerolang.ai/concepts/semantic-vs-text</A>
                </li>
                <li id="ref-7" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>Getting started.</em> <A href={R.zeroStart}>zerolang.ai/getting-started</A>.
                  Version-matched language documentation retrieved via{' '}
                  <code>zero skills get language --full</code>.
                </li>
                <li id="ref-8" style={{ marginBottom: '0.75rem' }}>
                  Microsoft. <em>.NET Compiler Platform (Roslyn).</em> <A href={R.roslyn}>github.com/dotnet/roslyn</A>
                </li>
                <li id="ref-9" style={{ marginBottom: '0.75rem' }}>
                  N. Matsakis et al. <em>The rustc query system.</em> <A href={R.rustcQuery}>rustc-dev-guide.rust-lang.org/query.html</A>
                </li>
                <li id="ref-10" style={{ marginBottom: '0.75rem' }}>
                  The Rust Project. <em>JSON output.</em> <A href={R.rustcJson}>doc.rust-lang.org/rustc/json.html</A>
                </li>
                <li id="ref-11" style={{ marginBottom: '0.75rem' }}>
                  salsa-rs. <em>salsa — on-demand, incrementalized computation.</em> <A href={R.salsa}>github.com/salsa-rs/salsa</A>
                </li>
                <li id="ref-12" style={{ marginBottom: '0.75rem' }}>
                  Vercel Labs. <em>wterm — a DOM-based terminal emulator with a WebAssembly core.</em>{' '}
                  <A href={R.wterm}>github.com/vercel-labs/wterm</A>. Reviewed as a delivery option; see A.1.
                </li>
                <li id="ref-13">
                  Vercel. <em>Geist</em> and <em>Web Interface Guidelines</em>.{' '}
                  <A href={R.geist}>vercel.com/geist</A> · <A href={R.guidelines}>vercel.com/design/guidelines</A>,
                  with <A href={R.wcag}>WCAG 2.2 AA</A> for contrast and structure.
                </li>
              </ol>
            </section>

            {/* ---------------------------------------------------- appendix */}
            <section id="appendix" className="section">
              <h2 className="heading-24">Appendix A. Reproduction</h2>
              <div className="prose body">
                <p>
                  Everything is regenerated from one command. Source and dataset:{' '}
                  <A href={R.repo}>github.com/HKTITAN/phases-of-zero</A>.
                </p>
              </div>
              <div style={{ maxWidth: 720, marginTop: '1rem' }}>
                <div className="code-block">
                  <div className="code-head"><span>regenerate everything</span></div>
                  <pre><code>{`curl -fsSL https://zerolang.ai/install.sh | bash
export PATH="$HOME/.zero/bin:$PATH"
zero --version          # ${String(version.version)} (build ${String(version.commit)})

npm install
npm run paper           # capture -> qr -> build -> pdf -> epub -> previews`}</code></pre>
                </div>
              </div>

              <div className="prose body" style={{ marginTop: '1.5rem' }}>
                <h3 className="heading-16">A.1 Why the explorer ships precomputed data</h3>
                <p>
                  We considered compiling Zero in the browser, following <A href={R.wterm}>wterm</A><Cite n={12} />,
                  which runs a Zig-authored terminal core as WebAssembly. Zero 0.1.3 advertised{' '}
                  <code>wasm32-wasi</code> and <code>wasm32-web</code> targets. Version{' '}
                  {String(version.version)} advertises neither: the target list contains{' '}
                  {s.targets} native targets and no WebAssembly target, and the compiler&apos;s own{' '}
                  <code>selfHostRouting</code> report marks <code>browserCompiler</code> as removed.
                  We therefore reimplemented phases one and two in TypeScript for the playground and
                  replay the rest from the capture.
                </p>
                <h3 className="heading-16" style={{ marginTop: '1.5rem' }}>A.2 Corpus contents</h3>
                <p>
                  {capture.corpus.map((c) => c.id).join(', ')} under <code>corpus/</code>, and{' '}
                  {capture.errorCases.map((c) => c.id).join(', ')} under <code>errors/</code>.
                </p>
              </div>
            </section>
          </main>
        </div>

        <AudioNative />

        <footer className="footer">
          <span>
            {AUTHORS.lead}, {AUTHORS.co.join(', ')} · <A href={QR_URL}>{AUTHORS.site}</A>
          </span>
          <span className="meta">Zero {String(version.version)} · {captured}</span>
        </footer>
      </div>
    </AudienceProvider>
  )
}
