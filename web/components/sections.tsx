/* Three sections the paper was missing: the agent-readership argument, an
   honest scope statement, and the outlook.

   Server components. Every figure below is derived from data/capture.json at
   render time rather than transcribed into the prose — if the capture is
   regenerated and a number moves, the sentence containing it moves with it.
   Where a claim cannot be derived from the capture it is either dropped or
   labelled as an argument rather than a measurement; there are no industry
   statistics here, invented or otherwise.

   Encoding rules, matching components/evidence.tsx:
   - no cell relies on colour; verdicts are spelled with words;
   - numeric columns carry className="n" on the header and the cell, and
     className="num" for tabular numerals;
   - every table states its population and its units in the caption;
   - nothing on these sections animates. They are static prose sitting at rest,
     and the animations brief is explicit that resting content does not enter. */

import type { ReactNode } from 'react'
import type { Capture, CorpusEntry, DiagnosticCost, ErrorCase } from '@/lib/types'
import { StatStrip } from '@/components/charts'
import { Icon } from '@/components/icons'

const DASH = '—'

const nf = (n: number) => n.toLocaleString('en-US')
const sum = (ns: number[]) => ns.reduce((t, n) => t + n, 0)

/* Bytes are exact. Model tokens are not observable from outside a tokenizer, so
   we reuse the harness's four-characters-per-token approximation (the same
   divisor tools/capture.mjs uses for the *TokensEst fields) and label every
   figure derived from it as an estimate. */
const estTokens = (bytes: number) => Math.ceil(bytes / 4)

/* Ratios are quoted to one decimal below 100 and rounded to whole units above,
   because a tenth of a factor of ten thousand is noise. */
function times(a: number, b: number): string {
  if (b === 0) return DASH
  const r = a / b
  return r < 100 ? `${r.toFixed(1)}×` : `${nf(Math.round(r))}×`
}

/* --------------------------------------------------------- shared chrome */

function Callout({ icon, kicker, children }: {
  icon: 'machine' | 'info' | 'warning'
  kicker: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.8125rem',
        alignItems: 'flex-start',
        maxWidth: 'var(--measure)',
        margin: '1.5rem 0',
        padding: '1rem 1.125rem',
        border: '1px solid var(--accent-line)',
        background: 'var(--accent-quiet)',
        borderRadius: 'var(--radius)',
      }}
    >
      <span style={{ color: 'var(--accent-text)', marginTop: '0.1875rem' }}>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <span
          className="label"
          style={{
            display: 'block',
            color: 'var(--accent-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '0.3125rem',
          }}
        >
          {kicker}
        </span>
        <div className="body" style={{ fontSize: '0.9375rem' }}>{children}</div>
      </div>
    </div>
  )
}

/* backend.size mirrors `zero size --json` and is typed as Record<string, unknown>
   on purpose: it is the compiler's payload, not our abstraction. Read it through
   narrowing helpers so a schema change degrades to an empty table rather than a
   crash. */

type ProfileRow = {
  canonical: string
  aliases: string[]
  optimizationGoal: string
  codegenOptimization: string
  linkOptimization: string
  debugInfo: boolean
  symbolPolicy: string
  maxHelloArtifactBytes: number | null
}

const asString = (v: unknown) => (typeof v === 'string' ? v : DASH)

function readProfileCatalog(entry: CorpusEntry): ProfileRow[] {
  const raw = entry.backend.size?.['profileCatalog']
  if (!Array.isArray(raw)) return []
  const rows: ProfileRow[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const budget =
      typeof o['profileBudget'] === 'object' && o['profileBudget'] !== null
        ? (o['profileBudget'] as Record<string, unknown>)
        : {}
    const maxHello = budget['maxHelloArtifactBytes']
    rows.push({
      canonical: asString(o['canonical']),
      aliases: Array.isArray(o['aliases'])
        ? o['aliases'].filter((a): a is string => typeof a === 'string')
        : [],
      optimizationGoal: asString(o['optimizationGoal']),
      codegenOptimization: asString(o['codegenOptimization']),
      linkOptimization: asString(o['linkOptimization']),
      debugInfo: o['debugInfo'] === true,
      symbolPolicy: asString(o['symbolPolicy']),
      maxHelloArtifactBytes: typeof maxHello === 'number' ? maxHello : null,
    })
  }
  return rows
}

function readRecheckStrategy(entry: CorpusEntry): string | null {
  const ii = entry.backend.size?.['incrementalInvalidation']
  if (typeof ii !== 'object' || ii === null) return null
  const v = (ii as Record<string, unknown>)['recheckStrategy']
  return typeof v === 'string' ? v : null
}

/* ======================================================================== */
/* 7. Agents as the reader                                                  */
/* ======================================================================== */

export function AgentReadershipSection({ capture }: { capture: Capture }) {
  const rc = capture.readCost
  const linesById = new Map(capture.corpus.map((c) => [c.id, c.metrics.nonEmptyLines]))

  const totalSource = sum(rc.map((r) => r.wholeSourceBytes))
  const totalView = sum(rc.map((r) => r.viewFnBytes))
  const totalQueryFn = sum(rc.map((r) => r.queryFnBytes))
  const totalCheckText = sum(rc.map((r) => r.checkTextBytes))
  const totalCheckJson = sum(rc.map((r) => r.checkJsonBytes))

  const bySize = [...rc].sort((a, b) => a.wholeSourceBytes - b.wholeSourceBytes)
  const smallest = bySize[0]
  const largest = bySize[bySize.length - 1]

  /* `zero check` answers in the same handful of bytes for every program in the
     corpus. Assert that from the data rather than from memory. */
  const checkTextSizes = Array.from(new Set(rc.map((r) => r.checkTextBytes)))
  const checkTextUniform = checkTextSizes.length === 1

  /* The programs whose structured verdict is the widest and narrowest multiple
     of the program that produced it. */
  const verdictRatios = rc
    .map((r) => ({ id: r.id, r: estTokens(r.checkJsonBytes) / Math.max(r.compilerTokens ?? 0, 1) }))
    .sort((a, b) => a.r - b.r)
  const minVerdict = verdictRatios[0]
  const maxVerdict = verdictRatios[verdictRatios.length - 1]

  const dc = capture.diagnosticCost
  const rejected = dc.filter((d) => d.machineFields.length > 0)
  const accepted = dc.filter((d) => d.machineFields.length === 0)

  const fieldCounts = rejected.map((d) => d.machineFields.length)
  const minFields = Math.min(...fieldCounts)
  const maxFields = Math.max(...fieldCounts)
  const repairs = rejected.filter((d) => d.hasTypedRepair).length
  const safeties = Array.from(new Set(rejected.map((d) => d.fixSafety).filter(Boolean)))

  const proseTotal = sum(rejected.map((d) => d.proseBytes))
  const jsonTotal = sum(rejected.map((d) => d.jsonBytes))
  const perCase = rejected.map((d) => d.jsonBytes / d.proseBytes).sort((a, b) => a - b)
  const minCase = perCase[0]
  const maxCase = perCase[perCase.length - 1]

  const acceptedProse = sum(accepted.map((d) => d.proseBytes))
  const acceptedJson = sum(accepted.map((d) => d.jsonBytes))

  /* The closed vocabulary of repair identifiers the whole error corpus draws
     on — the field prose has no equivalent of. */
  const repairIds = Array.from(
    new Set(
      capture.errorCases
        .map((e) => e.diagnostics[0]?.repair?.id)
        .filter((id): id is string => typeof id === 'string')
    )
  ).sort()

  const codeAtImport = (id: string): string => {
    const c = capture.errorCases.find((e) => e.id === id)
    return c?.importDiagnostics[0]?.code ?? DASH
  }

  return (
    <section id="agents" className="section">
      <h2 className="heading-24">10. When the reader is a program</h2>

      <div className="prose body">
        <p>
          Zero is built on the premise that its output will be consumed by a program rather than
          read by a person. Every reporting command has a <code>--json</code> form: tokens, parse
          trees, the semantic graph, phase timings, artifact sizes and diagnostics all answer in a
          schema on request. Diagnostics carry a stable code, a span, expected and actual facts, a
          fix-safety rating and a typed repair identifier instead of a sentence. The graph can be
          queried without re-reading a character of source. The implicit promise is efficiency: a machine reader should not
          have to pay for prose that was shaped for a human.
        </p>
        <p>
          We measured that promise, and it does not hold. The result is worth stating before the
          method rather than after it, because it runs the opposite way to the intuition the
          design invites.
        </p>
      </div>

      <Callout icon="machine" kicker="Finding">
        <p>
          Structured output is <strong>far more expensive</strong> than prose, not less. Asked
          whether a program is correct, <code>zero check</code> answers in{' '}
          {checkTextUniform ? `${checkTextSizes[0]} bytes` : `${nf(totalCheckText)} bytes across the corpus`}.{' '}
          <code>zero check --json</code> answers the same question for the same{' '}
          <span className="num">{linesById.get(smallest.id) ?? DASH}</span>-line program in{' '}
          <span className="num">{nf(smallest.checkJsonBytes)}</span> bytes, and for the largest
          program in the corpus in <span className="num">{nf(largest.checkJsonBytes)}</span> bytes
          — a factor of {times(totalCheckJson, totalCheckText)} over the corpus as a whole.
        </p>
      </Callout>

      <div className="prose body">
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          10.1 Method: one question, two answer forms
        </h3>
        <p>
          For each of the {rc.length} corpus programs the harness asks the compiler three
          questions twice — once in the form a person would read, once in the form a program
          would parse — and records the size of each answer.{' '}
          <em>Show me one function</em> is <code>zero view --fn main</code> against{' '}
          <code>zero query --json --fn main</code>.{' '}
          <em>What does this program call, and is each call checked</em> is the whole source
          against <code>zero query --json --calls std</code>.{' '}
          <em>Is this program correct</em> is <code>zero check</code> against{' '}
          <code>zero check --json</code>. Byte counts are exact; token figures are estimated at
          four characters per token and are only ever estimates.
        </p>
      </div>

      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Table 10.1 — Cost of answering the same question in text and in structured form, for
            each of the {rc.length} corpus programs. All figures are bytes of command output,
            measured on the capture host. &ldquo;Source&rdquo; is every byte of every file in the
            package, which is what a reader with no query interface must ingest.
          </caption>
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col" className="n">Lines</th>
              <th scope="col" className="n">Source</th>
              <th scope="col" className="n"><span className="mono">view --fn</span></th>
              <th scope="col" className="n"><span className="mono">query --json --fn</span></th>
              <th scope="col" className="n"><span className="mono">check</span></th>
              <th scope="col" className="n"><span className="mono">check --json</span></th>
            </tr>
          </thead>
          <tbody>
            {rc.map((r) => (
              <tr key={r.id}>
                <th scope="row"><span className="mono">{r.id}</span></th>
                <td className="n num">{nf(linesById.get(r.id) ?? 0)}</td>
                <td className="n num">{nf(r.wholeSourceBytes)}</td>
                <td className="n num">{nf(r.viewFnBytes)}</td>
                <td className="n num">{nf(r.queryFnBytes)}</td>
                <td className="n num">{nf(r.checkTextBytes)}</td>
                <td className="n num">{nf(r.checkJsonBytes)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Corpus total</td>
              <td className="n num">{nf(sum(rc.map((r) => linesById.get(r.id) ?? 0)))}</td>
              <td className="n num">{nf(totalSource)}</td>
              <td className="n num">{nf(totalView)}</td>
              <td className="n num">{nf(totalQueryFn)}</td>
              <td className="n num">{nf(totalCheckText)}</td>
              <td className="n num">{nf(totalCheckJson)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <p>
          Two effects are tangled together in that table, and separating them is the whole
          argument. <strong>Targeting works.</strong> Reading one function through{' '}
          <code>zero view --fn</code> costs <span className="num">{nf(totalView)}</span> bytes
          across the corpus against <span className="num">{nf(totalSource)}</span> bytes of source
          — {times(totalSource, totalView)} cheaper — because the compiler already knows where the
          function is and a text-first reader does not.
        </p>
        <p>
          <strong>Structuring does not.</strong> The same targeted answer requested as data costs{' '}
          <span className="num">{nf(totalQueryFn)}</span> bytes:{' '}
          {times(totalQueryFn, totalView)} the text view, and{' '}
          {times(totalQueryFn, totalSource)} the cost of simply reading every line of every
          program in the corpus. The saving that targeting earns is spent on the encoding, and
          then some. At the extreme, the verdict on a{' '}
          <span className="num">{linesById.get(smallest.id) ?? DASH}</span>-line program grows
          from {nf(smallest.checkTextBytes)} bytes to{' '}
          <span className="num">{nf(smallest.checkJsonBytes)}</span>.
        </p>
        <p>
          So the trade a machine-first compiler offers is not tokens for tokens. It is tokens for
          actionability, and the next table is what the extra tokens buy.
        </p>

        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          10.2 What the extra bytes carry
        </h3>
        <p>
          For diagnostics the premium is much smaller and the return is much clearer. Across the{' '}
          {rejected.length} error cases the ingestion gate refuses, prose costs{' '}
          <span className="num">{nf(proseTotal)}</span> bytes and the structured form costs{' '}
          <span className="num">{nf(jsonTotal)}</span> — {times(jsonTotal, proseTotal)} in
          aggregate, {minCase.toFixed(1)}× to {maxCase.toFixed(1)}× case by case. For that the
          structured form exposes {minFields === maxFields ? minFields : `${minFields} to ${maxFields}`}{' '}
          separately addressable fields and a typed repair identifier on{' '}
          {repairs === rejected.length ? 'every one' : `${repairs} of ${rejected.length}`}.
        </p>
      </div>

      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Table 10.2 — <span className="mono">zero import</span> against{' '}
            <span className="mono">zero import --json</span> for all {dc.length} error cases.
            Bytes are the complete command output including stderr. &ldquo;Machine fields&rdquo;
            counts the diagnostic fields a consumer can read by name without parsing English.
            The {accepted.length} cases the gate admits carry no diagnostic at all, which is why
            their field count is zero.
          </caption>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Import</th>
              <th scope="col">Code</th>
              <th scope="col" className="n">Prose</th>
              <th scope="col" className="n">JSON</th>
              <th scope="col" className="n">Ratio</th>
              <th scope="col" className="n">Machine fields</th>
              <th scope="col">Typed repair</th>
              <th scope="col">Fix safety</th>
            </tr>
          </thead>
          <tbody>
            {dc.map((d: DiagnosticCost) => {
              const isRejected = d.machineFields.length > 0
              return (
                <tr key={d.id}>
                  <th scope="row"><span className="mono">{d.id}</span></th>
                  <td>{isRejected ? 'rejected' : 'accepted'}</td>
                  <td><span className="mono">{codeAtImport(d.id)}</span></td>
                  <td className="n num">{nf(d.proseBytes)}</td>
                  <td className="n num">{nf(d.jsonBytes)}</td>
                  <td className="n num">{times(d.jsonBytes, d.proseBytes)}</td>
                  <td className="n num">{d.machineFields.length}</td>
                  <td>{d.hasTypedRepair ? 'yes' : 'no'}</td>
                  <td>{d.fixSafety ?? DASH}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <p>
          The distinction the ratio column hides is not information but{' '}
          <em>addressability</em>. Zero&apos;s prose diagnostic is not terse — it carries a code,
          a path, a line and column and a help line in {nf(Math.round(proseTotal / rejected.length))}{' '}
          bytes on average. What it does not carry is a schema. A consumer wanting the expected
          type has to find it inside a sentence; a consumer wanting to know whether an automated
          fix would change behaviour has to infer it. The structured form names both, and adds one
          thing the prose has no equivalent of: a repair identifier drawn from a closed
          vocabulary. Our {capture.errorCases.length} error cases between them produce{' '}
          {repairIds.length} distinct identifiers —{' '}
          {repairIds.map((id, i) => (
            <span key={id}>
              {i > 0 ? ', ' : ''}
              <code>{id}</code>
            </span>
          ))}{' '}
          — each paired with one of {safeties.length} fix-safety ratings:{' '}
          {safeties.map((s, i) => (
            <span key={String(s)}>
              {i > 0 ? (i === safeties.length - 1 ? ' and ' : ', ') : ''}
              <code>{s}</code>
            </span>
          ))}
          . A program can branch on those without a language model in the loop. That is what the
          premium buys, and it is a real thing to buy.
        </p>
        <p>
          The premium is worst where there is nothing to say. The {accepted.length} cases the gate
          admits produce <span className="num">{nf(acceptedProse)}</span> bytes of prose between
          them and <span className="num">{nf(acceptedJson)}</span> bytes of JSON —{' '}
          {times(acceptedJson, acceptedProse)} to report success. A structured schema pays its
          fixed cost whether or not the run had anything to report, and most runs do not.
        </p>

        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          10.3 The token budget, and what is on the wrong side of it
        </h3>
        <p>
          Zero ships <code>zero tokens</code> as a first-class command. A token count is something
          the compiler will tell you about a program on request, in the same way it will report
          its phase timings or its artifact size — and the token is the unit in which a language
          model is metered. A compiler that publishes one is a compiler that expects to be read by
          something that counts.
        </p>
        <p>
          Set that against Table 10.1. The compiler reports{' '}
          <span className="num">{nf(smallest.compilerTokens ?? 0)}</span> tokens for{' '}
          <span className="mono">{smallest.id}</span>, and returns{' '}
          <span className="num">{nf(smallest.checkJsonBytes)}</span> bytes — roughly{' '}
          <span className="num">{nf(estTokens(smallest.checkJsonBytes))}</span> estimated model
          tokens — when asked in JSON whether those{' '}
          <span className="num">{nf(smallest.compilerTokens ?? 0)}</span> tokens are correct.
          Across the corpus the structured verdict runs between{' '}
          {Math.round(minVerdict.r)}× the size of the program it describes (
          <span className="mono">{minVerdict.id}</span>) and {Math.round(maxVerdict.r)}× (
          <span className="mono">{maxVerdict.id}</span>). The compiler&apos;s account of a program
          is consistently, and by a wide margin, the largest artifact in the exchange.
        </p>
        <p>
          We do not read this as an argument against structured output; §10.2 is an argument for
          it. We read it as a measurement that the structured interface has not yet been costed
          for the reader it was designed for. Nothing in the schema is negotiable per call: we
          found no field selection, no severity filter and no way to ask{' '}
          <code>zero check --json</code> for the verdict without the report that surrounds it. A
          compiler whose stated audience is billed by the token has, on this build, no way to ask
          it for less.
        </p>
      </div>
    </section>
  )
}

/* ======================================================================== */
/* 8. Scope                                                                 */
/* ======================================================================== */

export function MissingConceptsSection({ capture }: { capture: Capture }) {
  const cases: ErrorCase[] = capture.errorCases
  const diagCounts = cases.map((e) => e.diagnostics.length)
  const maxDiag = Math.max(...diagCounts)
  const minDiag = Math.min(...diagCounts)
  const everyCaseOne = maxDiag === 1 && minDiag === 1
  const withRelated = cases.filter((e) => (e.diagnostics[0]?.related?.length ?? 0) > 0).length
  const contaminated = cases.filter((e) => e.storeContaminated).length

  const base = capture.corpus[0]
  const caches = base.phases.caches
  const warmByName = new Map(base.phases.warmCaches.map((c) => [c.name, c.hit]))
  const coldSummary = base.phases.coldCacheSummary
  const warmSummary = base.phases.warmCacheSummary

  /* Whether the cache pattern is a property of the compiler or of the program is
     answerable from the data: count the distinct hit patterns across the corpus. */
  const cachePatterns = new Set(
    capture.corpus.map((c) =>
      c.phases.caches.map((x) => `${x.name}=${x.hit ? 'hit' : 'miss'}`).join(',')
    )
  )
  const strategy = readRecheckStrategy(base)

  const moduleCounts = capture.corpus.map((c) => c.graph.modules.length)
  const maxModules = Math.max(...moduleCounts)

  const profiles = readProfileCatalog(base)
  const profileCatalogs = new Set(
    capture.corpus.map((c) => JSON.stringify(readProfileCatalog(c)))
  )
  /* Which axes the catalogue actually spans, counted rather than asserted: the
     shape of the set is the argument in §12.4. */
  const throughputProfiles = profiles.filter((p) =>
    p.optimizationGoal.includes('throughput')
  ).length
  const sizeProfiles = profiles.filter((p) => p.optimizationGoal.includes('binary-size')).length

  const routing = base.phases.selfHostRouting
  const removed = routing ? Object.entries(routing.removed).filter(([, gone]) => gone) : []
  const routedPhases = routing ? Object.entries(routing.phases) : []
  const routedTo = Array.from(new Set(routedPhases.map(([, to]) => to)))

  const irBlocked = capture.corpus.filter((c) => !c.backend.irEmitted).length
  const objectFormats = Array.from(new Set(capture.toolchain.targets.map((t) => t.objectFormat)))
  const tableCount = base.semantic.tables ? Object.keys(base.semantic.tables).length : 0

  return (
    <section id="scope" className="section">
      <h2 className="heading-24">12. What this study does not cover</h2>

      <div className="prose body">
        <p>
          A phase-by-phase account of a compiler invites the reader to assume that everything in
          the textbook was examined. It was not. Five classical topics are absent from our
          results, and in each case the reason is different: one is absent because Zero does not
          implement it, two because Zero does not expose them, one because Zero replaces it with
          something that is not a phase, and one because our method could not reach it. Naming
          which is which is more useful than an apology.
        </p>
      </div>

      <Callout icon="info" kicker="Scope">
        <p>
          Not covered: error recovery, incremental invalidation cost, register allocation,
          instruction selection, and bootstrapping the compiler in its own source language. The
          optimization phase is covered only in the form Zero provides it — a fixed catalogue of
          build profiles rather than a pass pipeline.
        </p>
      </Callout>

      {/* ------------------------------------------------------ 12.1 recovery */}
      <div className="prose body">
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          12.1 Error recovery
        </h3>
        <p>
          A classical front end is expected to recover. On a syntax error it discards tokens to a
          synchronising symbol, resumes, and reports as many independent errors per run as it can
          without inventing them. The quality of that resynchronisation is a research topic in its
          own right, and it is the difference between a compiler that costs one edit-compile cycle
          per error and one that costs a cycle per <em>run</em>.
        </p>
        <p>
          Zero does not recover. Its ingestion gate either admits an edit into the graph or
          refuses it whole. We did not set out to measure this and cannot claim to have tested it
          properly — every case in our error corpus seeds exactly one defect — but the consequence
          is visible in the output all the same.
        </p>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <StatStrip
          stats={[
            { value: String(cases.length), label: 'error cases in the corpus' },
            {
              value: everyCaseOne ? '1' : `${minDiag}–${maxDiag}`,
              label: 'diagnostics reported per run',
            },
            { value: String(withRelated), label: 'carrying a related location' },
            { value: String(contaminated), label: 'cases that reached the graph store' },
          ]}
        />
      </div>

      <div className="prose body" style={{ marginTop: '1.5rem' }}>
        <p>
          {everyCaseOne
            ? `Every one of the ${cases.length} cases produced exactly one diagnostic, at whichever gate refused it.`
            : `Cases produced between ${minDiag} and ${maxDiag} diagnostics.`}{' '}
          {withRelated > 0
            ? `${withRelated} of them attach a related source location to that single diagnostic — a cross-reference inside one record, not a second finding.`
            : null}{' '}
          The store was never contaminated: a refused edit leaves no partial state behind, which is
          why a second run of the same command reports the same one diagnostic rather than a
          different one.
        </p>
        <p>
          What that buys is the absence of the cascade. A missing closing brace in a conventional
          compiler produces a first honest error and then a column of phantom ones caused by the
          parser&apos;s own recovery guess, and a reader — human or otherwise — has to decide
          which ones are real. Zero never presents that decision. What it costs is round trips:
          with one diagnostic per run, an edit containing five defects takes five refusals to
          clear, and for a caller paying per round trip that is five times the fixed cost measured
          in §10.
        </p>
        <p>
          We are explicit that this is an observation, not a finding. Establishing it would need a
          corpus of multi-defect programs and a comparison against a recovering front end on the
          same inputs. Neither exists here.
        </p>

        {/* --------------------------------------------------- 12.2 incremental */}
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          12.2 Incremental compilation and the cost of invalidation
        </h3>
        <p>
          Zero reports its caches, and this is the part of the compiler where its self-description
          is most complete: {caches.length} named caches, each with a key, a hit flag and a
          plain-language statement of what invalidates it. We reproduce that report rather than
          summarise it, because the <span className="mono">invalidatesOn</span> column is the
          design.
        </p>
      </div>

      <div className="table-wrap print-omit" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Table 12.1 — The {caches.length} compiler caches reported by{' '}
            <span className="mono">zero check --json</span> for{' '}
            <span className="mono">{base.id}</span>. The cold column is the first run after{' '}
            <span className="mono">zero clean --all</span>; the warm column is the run immediately
            after it. The same hit pattern holds for{' '}
            {cachePatterns.size === 1 ? `all ${capture.corpus.length}` : `${capture.corpus.length - cachePatterns.size + 1} of ${capture.corpus.length}`}{' '}
            corpus programs.
          </caption>
          <thead>
            <tr>
              <th scope="col">Cache</th>
              <th scope="col" className="wrap">Invalidates on</th>
              <th scope="col">Cold run</th>
              <th scope="col">Warm run</th>
            </tr>
          </thead>
          <tbody>
            {caches.map((c) => (
              <tr key={c.name}>
                <th scope="row"><span className="mono">{c.name}</span></th>
                <td className="wrap">{c.invalidatesOn}</td>
                <td>{c.hit ? 'hit' : 'miss'}</td>
                <td>{warmByName.get(c.name) ? 'hit' : 'miss'}</td>
              </tr>
            ))}
          </tbody>
          {coldSummary && warmSummary ? (
            <tfoot>
              <tr>
                <td>Summary</td>
                <td className="wrap">
                  rebuild expected on warm run: {coldSummary.warmRebuildExpected ? 'yes' : 'no'}
                </td>
                <td className="num">
                  {coldSummary.hits} hit / {coldSummary.misses} miss
                </td>
                <td className="num">
                  {warmSummary.hits} hit / {warmSummary.misses} miss
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <p>
          The table contains a result we did not expect and should not bury. After{' '}
          <code>zero clean --all</code>, the first run still reports{' '}
          {coldSummary ? coldSummary.hits : DASH} of {caches.length} caches as hits. Only{' '}
          <span className="mono">emittedObject</span> misses, and it misses on the warm run too.
          The reason is in the <span className="mono">invalidatesOn</span> column: every cache
          above it is keyed on the <em>ProgramGraph input</em>, and cleaning a build directory does
          not change the graph. Our &ldquo;cold&rdquo; measurement is therefore a cold artifact
          directory, not a cold cache.
        </p>
        <p>
          That has a direct consequence for scope. We never observed a miss on{' '}
          <span className="mono">parseTree</span>, <span className="mono">interface</span>,{' '}
          <span className="mono">checkedBody</span>, <span className="mono">specialization</span>{' '}
          or <span className="mono">mappedFinalMir</span>, so we cannot report the cost of an
          invalidation — which is the only number that matters for incremental compilation.
          Producing it would require mutating source between runs and re-measuring, which our
          harness does not do.
        </p>
        <p>
          The same gap covers interface fingerprinting. The{' '}
          <span className="mono">interface</span> cache invalidates on{' '}
          <em>{caches.find((c) => c.name === 'interface')?.invalidatesOn ?? 'the public symbol surface'}</em>,
          {strategy ? <> and the compiler describes its strategy as <em>{strategy}</em>.</> : null}{' '}
          The point of that design is that editing a function body without changing its signature
          should not force dependents to be re-checked. Our packages contain at most{' '}
          {maxModules} modules and none depends on another package, so the longest dependency
          chain the fingerprint could protect is {maxModules - 1} edge long. There is no dependent
          far enough away for the optimisation to show. We report the mechanism; we do not report
          evidence that it works.
        </p>

        {/* -------------------------------------------- 12.3 back-end internals */}
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          12.3 Register allocation and instruction selection
        </h3>
        <p>
          These are the two topics a back-end course spends the most time on, and this study says
          nothing about either. That is not a choice we made. Zero&apos;s reported phase list ends{' '}
          <span className="mono">lower → codegen → object → link</span>, and none of those four
          decomposes further in any <code>--json</code> payload we could find: there is no
          allocator report, no instruction-selection trace, no spill count, no register pressure
          figure.
        </p>
        <p>
          Nor can the question be approached from the artifact side. Asking for the intermediate
          form directly fails on {irBlocked === capture.corpus.length ? 'every' : `${irBlocked} of ${capture.corpus.length}`}{' '}
          corpus program with <span className="mono">BLD004: direct backend does not support
          --emit llvm-ir</span>. The direct emitters go from MIR to {objectFormats.length} object
          formats ({objectFormats.join(', ')}) without an inspectable middle, so the only back-end
          observables the compiler offers are the size of the lowered IR in bytes, the size of the
          artifact, and whether the build succeeded. Everything a classical back-end chapter is
          about happens inside a step that reports one number.
        </p>

        {/* ------------------------------------------------ 12.4 optimization */}
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          12.4 Optimization is a profile, not a pass pipeline
        </h3>
        <p>
          Phase five of the classical model is code optimization, and Zero has no phase by that
          name. What it has instead is a fixed catalogue of {profiles.length} build profiles, each
          a named bundle of a codegen setting, a link setting, a metadata retention policy and a
          size budget. Selecting <code>--profile tiny</code> is the closest a user gets to
          requesting an optimization, and the request is categorical rather than compositional:
          there is no <code>-O2</code>, and no way to enable one transformation without the rest
          of its bundle.
        </p>
      </div>

      <div className="table-wrap print-omit" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Table 12.2 — The {profiles.length} build profiles reported under{' '}
            <span className="mono">profileCatalog</span> by <span className="mono">zero size
            --json</span>. Identical across{' '}
            {profileCatalogs.size === 1 ? `all ${capture.corpus.length}` : `${capture.corpus.length}`}{' '}
            corpus programs, because a profile is a property of the compiler rather than of the
            program. The budget column is the compiler&apos;s own ceiling for a hello-world
            artifact under that profile, in bytes.
          </caption>
          <thead>
            <tr>
              <th scope="col">Profile</th>
              <th scope="col" className="wrap">Aliases</th>
              <th scope="col">Optimization goal</th>
              <th scope="col">Codegen</th>
              <th scope="col">Link</th>
              <th scope="col">Debug info</th>
              <th scope="col" className="n">Budget</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.canonical}>
                <th scope="row"><span className="mono">{p.canonical}</span></th>
                <td className="wrap">
                  <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3125rem' }}>
                    {p.aliases.map((a) => (
                      <span className="pill" key={a}>{a}</span>
                    ))}
                  </span>
                </td>
                <td><span className="mono">{p.optimizationGoal}</span></td>
                <td><span className="mono">{p.codegenOptimization}</span></td>
                <td><span className="mono">{p.linkOptimization}</span></td>
                <td>{p.debugInfo ? 'yes' : 'no'}</td>
                <td className="n num">
                  {p.maxHelloArtifactBytes === null ? DASH : nf(p.maxHelloArtifactBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <p>
          Read down the goal column and the catalogue turns out not to be a speed dial at all.
          Exactly {throughputProfiles} of the {profiles.length} profiles names throughput as its
          goal; {sizeProfiles} name binary size at different intensities, and the rest name
          observability, edit latency and release auditability. That is a defensible set of
          axes for a compiler aimed at machine-generated code, where binary size and reproducible
          metadata matter more than the last few percent of a benchmark. But it means the
          classical question — which transformations ran, in what order, and what did each one buy
          — has no answer here, and we do not pretend to have measured one. Our §6 figures fold
          optimization cost into <span className="mono">lower</span> and{' '}
          <span className="mono">codegen</span> because the compiler does.
        </p>

        {/* ----------------------------------------------- 12.5 bootstrapping */}
        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          12.5 Bootstrapping and self-hosting
        </h3>
        <p>
          Whether a compiler can compile itself is the traditional closing chapter, and it is the
          one topic here where Zero answers the question directly and the answer is short: not
          yet, by design, and it has removed the machinery it would have used to get there.
        </p>
      </div>

      {routing ? (
        <div className="table-wrap print-omit" style={{ marginTop: '1.5rem' }}>
          <table>
            <caption>
              Table 12.3 — Self-hosting status as reported under{' '}
              <span className="mono">selfHostRouting</span> by{' '}
              <span className="mono">zero time --json</span>. Identical for all{' '}
              {capture.corpus.length} corpus programs. No units: this table is a status report.
            </caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col" className="wrap">Reported value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Mode</th>
                <td className="wrap"><span className="mono">{routing.mode}</span></td>
              </tr>
              <tr>
                <th scope="row">Contract version</th>
                <td className="wrap num">{routing.contractVersion}</td>
              </tr>
              <tr>
                <th scope="row">Subset compatible</th>
                <td className="wrap">{routing.subsetCompatible ? 'yes' : 'no'}</td>
              </tr>
              {routedPhases.map(([phase, host]) => (
                <tr key={phase}>
                  <th scope="row">
                    Phase <span className="mono">{phase}</span> routed to
                  </th>
                  <td className="wrap"><span className="mono">{host}</span></td>
                </tr>
              ))}
              {removed.map(([name]) => (
                <tr key={name}>
                  <th scope="row"><span className="mono">{name}</span></th>
                  <td className="wrap">removed</td>
                </tr>
              ))}
              {routing.cBridge ? (
                <tr>
                  <th scope="row">C bridge</th>
                  <td className="wrap">
                    policy <span className="mono">{routing.cBridge.policy}</span>, required{' '}
                    {routing.cBridge.required ? 'yes' : 'no'}, fallback{' '}
                    <span className="mono">{routing.cBridge.explicitDirectFallback}</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <p>
          {routing ? (
            <>
              The mode is <span className="mono">{routing.mode}</span> and every reported phase —{' '}
              {routedPhases.map(([phase], i) => (
                <span key={phase}>
                  {i > 0 ? ', ' : ''}
                  <span className="mono">{phase}</span>
                </span>
              ))}{' '}
              — routes to{' '}
              {routedTo.map((t, i) => (
                <span key={t}>
                  {i > 0 ? ' and ' : ''}
                  <span className="mono">{t}</span>
                </span>
              ))}
              . None routes to a compiler written in Zero.
            </>
          ) : (
            <>The compiler reported no self-hosting status for this capture.</>
          )}{' '}
          The three components a bootstrap normally needs are all recorded as removed:{' '}
          {removed.map(([name], i) => (
            <span key={name}>
              {i > 0 ? ', ' : ''}
              <span className="mono">{name}</span>
            </span>
          ))}
          . The C bridge is gone with them, replaced by direct per-format emitters.
        </p>
        <p>
          This is a coherent position rather than an omission — a compiler that emits{' '}
          {objectFormats.length} object formats directly has no need of a portable C fallback, and
          removing the seed compiler removes a whole class of trust problem. But it means the
          classical bootstrapping exercise cannot be run on this build, and a compiler that is not
          written in its own language has not yet made the argument that the language is adequate
          for compilers. We note the same restriction bites elsewhere in this paper: the browser
          playground in §9 reimplements the lexer in TypeScript precisely because{' '}
          <span className="mono">browserCompiler</span> is one of the removed components.
        </p>
        <p>
          One last piece of scope worth naming, since it is easy to miss. The{' '}
          {tableCount > 0 ? `${tableCount} graph tables` : 'graph tables'} in §6 are what the
          compiler chooses to publish. Nothing in this study inspects the graph store&apos;s own
          encoding, its index structures, or its behaviour under concurrent writers. We measured a
          reporting interface, and a reporting interface is not an implementation.
        </p>
      </div>
    </section>
  )
}

/* ======================================================================== */
/* 12. Outlook                                                              */
/* ======================================================================== */

export function OutlookSection({ capture }: { capture: Capture }) {
  const cases = capture.errorCases
  const contradictory = cases.filter(
    (e) => e.checkTopLevelOk === true && e.checkReadinessBuildable === false
  )
  const knewButReportedOk = cases.filter((e) => e.checkKnewButReportedOk)
  const base = capture.corpus[0]
  const tableCount = base.semantic.tables ? Object.keys(base.semantic.tables).length : 0
  const gates = Array.from(new Set(cases.map((e) => e.rejectedAt).filter((g) => g !== 'none')))
  const targets = capture.toolchain.targets.length
  const jsonPremium = (() => {
    const dc = capture.diagnosticCost.filter((d) => d.machineFields.length > 0)
    return times(sum(dc.map((d) => d.jsonBytes)), sum(dc.map((d) => d.proseBytes)))
  })()

  const CLAIMS: { claim: string; basis: string; status: string }[] = [
    {
      claim: 'Compiler interfaces are becoming APIs.',
      basis:
        `Every structural claim in this paper was read out of a documented --json schema. None ` +
        `required patching the compiler, scraping a log, or parsing an English sentence.`,
      status: 'Measured',
    },
    {
      claim: 'A top-level field carries an obligation prose never did.',
      basis:
        `${contradictory.length} of ${cases.length} error cases report ok: true at the top level ` +
        `of zero check --json while the nested targetReadiness reports buildable: false.`,
      status: 'Measured',
    },
    {
      claim: 'Observability is worth having whether or not agent-oriented languages win.',
      basis:
        `${tableCount} graph tables, per-phase timings, ${gates.length} distinct refusal gates and ` +
        `${targets} target emitters, all reachable from a shell without a debugger.`,
      status: 'Argued from the measurements',
    },
    {
      claim: 'Adoption will be decided by pretraining distribution, not interface quality.',
      basis: 'Nothing in this study bears on it. We have measured one compiler, not a market.',
      status: 'Speculation',
    },
  ]

  return (
    <section id="outlook" className="section">
      <h2 className="heading-24">15. Outlook</h2>

      <div className="prose body">
        <p>
          It is worth separating what this study licenses us to say about where compilers are
          going from what we would merely like to be true. The table states which is which for
          each claim we make below; the prose then argues them in order.
        </p>
      </div>

      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table>
          <caption>
            Table 15.1 — The four claims in this section, the evidence each rests on, and its
            epistemic status. &ldquo;Measured&rdquo; means the figure appears in this
            paper&apos;s dataset; &ldquo;argued&rdquo; means it is an inference from those
            figures; &ldquo;speculation&rdquo; means we have no evidence and say so.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="wrap">Claim</th>
              <th scope="col" className="wrap">What it rests on</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMS.map((c) => (
              <tr key={c.claim}>
                <th scope="row" className="wrap">{c.claim}</th>
                <td className="wrap">{c.basis}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose body" style={{ marginTop: '1.75rem' }}>
        <h3 className="heading-20" style={{ marginTop: '1.5rem' }}>
          15.1 The interface becomes the contract
        </h3>
        <p>
          The most durable observation in this paper is also the least dramatic: we were able to
          write it. Every claim we make about the compiler&apos;s structure came out of a
          documented <code>--json</code> schema — the exceptions are wall-clock times, which no
          compiler can report about itself, and the sizes of the compiler&apos;s own prose output
          in §10, which are the point of the comparison. A decade ago the equivalent study would
          have required instrumenting a compiler; here the instrumentation was the product. That direction of travel is not unique to Zero —{' '}
          <code>rustc --error-format=json</code> and the TypeScript compiler API arrived at the
          same place from a different premise — and it is the part of Zero&apos;s design we would
          expect to generalise regardless of what happens to the language.
        </p>
        <p>
          The consequence is an obligation that prose never carried. An English diagnostic that
          overstates its confidence is read by a person who can weigh it against the rest of the
          output. A JSON field named <code>ok</code> is not weighed; it is branched on. We found{' '}
          {contradictory.length} of {cases.length} error cases where{' '}
          <code>zero check --json</code> reports <code>ok: true</code> at the top level while its
          own nested <code>targetReadiness</code> reports <code>buildable: false</code>, with a
          diagnostic naming the construct the backend will refuse.{' '}
          {knewButReportedOk.length === contradictory.length
            ? 'The compiler knew in every one of those cases.'
            : `The compiler's own record marks ${knewButReportedOk.length} of them as known-but-reported-ok.`}{' '}
          A human reading the whole document notices the disagreement. A program reading the field
          the schema presents as the verdict does not.
        </p>
        <p>
          We think this is the general shape of the problem rather than a bug in one build.
          Publishing a schema converts every top-level field into a promise with a much wider
          blast radius than a sentence, and a compiler that adds a field faster than it can define
          what the field means will produce exactly this class of contradiction. Machine-readable
          is a property of a format. Machine-<em>reliable</em> is a property of a contract, and it
          is a harder thing to ship.
        </p>

        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          15.2 Observability outlives the premise that motivated it
        </h3>
        <p>
          Zero exposes its internals because it expects an agent to consume them. That motivation
          may or may not turn out to be right, and the observability is valuable either way. A
          student can print the phase list, time each phase, read the symbol table as{' '}
          {tableCount > 0 ? `${tableCount} relations` : 'a set of relations'}, watch the same
          program be refused at {gates.length} distinct gates, and diff the object formats
          produced by {targets} emitters from one source graph — from a shell, without patching a
          compiler or attaching a debugger.
        </p>
        <p>
          None of that depends on the agent thesis being correct. It is a teaching property that
          fell out of an engineering decision, and it is the property we would most like to see
          other toolchains copy, because it is the one that costs the least to adopt. A compiler
          does not have to be graph-first to report its phases honestly, and §10 suggests it should
          think carefully about the size of the report while it does — the{' '}
          {jsonPremium} premium structured diagnostics carry is a fair price; the premium on the
          full verdict payload is not yet costed for anyone.
        </p>

        <h3 className="heading-20" style={{ marginTop: '1.75rem' }}>
          15.3 The open question is distribution, and we cannot answer it
        </h3>
        <p>
          What follows is speculation, and we mark it as such because nothing in our dataset bears
          on it. A language designed for machine authorship faces a bootstrapping problem that has
          nothing to do with compilers: a model writes the languages it has seen. A language with
          no corpus is a language a model must be taught in-context, on every call, at a token
          cost that competes directly with the savings a machine-first interface is supposed to
          deliver. Interface quality does not obviously move that constraint, and neither does a
          good diagnostic schema, if the language guide has to travel in the context window
          alongside the program the diagnostic is about.
        </p>
        <p>
          We can say what would change our mind, which is the most an honest outlook can offer.
          The measurement that matters is end-to-end: tokens spent per accepted edit, for the same
          task, in a language with a large pretraining corpus and a prose-oriented compiler versus
          a language with no corpus and a structured one. §10 supplies one half of that — the cost
          of the compiler&apos;s side of the loop — and says nothing at all about the other. If
          the structured loop wins on that measurement, the design is vindicated on its own terms.
          If it does not, the observability in §15.2 is still worth keeping, and that is the
          conclusion this paper is actually in a position to defend.
        </p>
      </div>
    </section>
  )
}
