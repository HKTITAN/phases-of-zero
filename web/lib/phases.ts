/* The analytical core of the review.

   Column 1 is the canonical phase decomposition taught from Aho, Lam, Sethi and
   Ullman. Column 2 is what Zero 0.3.4 actually reports in `zero check --json`
   under `compilerPhases`. Column 3 names the command that makes the phase
   observable, which is what lets every claim in the paper be re-derived.

   The mapping is deliberately not one-to-one. Where it diverges, `divergence`
   says how — that divergence is the finding, not an inconvenience. */

export type ClassicalPhase = {
  n: number
  id: string
  name: string
  /* What the phase consumes and produces in the canonical model. */
  input: string
  output: string
  /* Zero's own phase names that carry this work, as reported by the compiler. */
  zeroPhases: string[]
  /* The command that exposes it. */
  probe: string
  /* Where Zero's realisation departs from the textbook, or '' if it does not. */
  divergence: string
  /* Which side of the admission gate the work happens on. */
  locus: 'ingestion' | 'compile-path' | 'both'
}

export const CLASSICAL_PHASES: ClassicalPhase[] = [
  {
    n: 1,
    id: 'lexical',
    name: 'Lexical analysis',
    input: 'Character stream',
    output: 'Token stream',
    zeroPhases: ['parse'],
    probe: 'zero tokens --json',
    divergence:
      'Runs only when text enters the system. Package compilation reads a binary graph ' +
      'store and never re-scans characters, so the scanner is absent from the steady-state path.',
    locus: 'ingestion',
  },
  {
    n: 2,
    id: 'syntax',
    name: 'Syntax analysis',
    input: 'Token stream',
    output: 'Parse tree / AST',
    zeroPhases: ['parse'],
    probe: 'zero parse --json',
    divergence:
      'The tree is not the compiler’s working representation. Parsing exists to admit text ' +
      'into the graph; once admitted, structure is stored, not re-derived.',
    locus: 'ingestion',
  },
  {
    n: 3,
    id: 'semantic',
    name: 'Semantic analysis',
    input: 'AST + symbol table',
    output: 'Annotated AST, type facts',
    zeroPhases: ['resolve', 'interface', 'check'],
    probe: 'zero check --json',
    divergence:
      'Split across three reported phases and persisted as typed graph facts. The symbol table ' +
      'is not rebuilt per compile — it is the stored `symbol`, `type` and `scope` tables.',
    locus: 'both',
  },
  {
    n: 4,
    id: 'ir',
    name: 'Intermediate code generation',
    input: 'Annotated AST',
    output: 'Intermediate representation',
    zeroPhases: ['lower'],
    probe: 'zero size --json (loweredIrBytes)',
    divergence:
      'Lowering runs graph HIR to MIR directly, and MIR contracts are verified before emission. ' +
      'The IR is never printed: --emit llvm-ir fails with BLD004 on every target, because the ' +
      'direct backend has no LLVM path. The only observable is its size in bytes.',
    locus: 'compile-path',
  },
  {
    n: 5,
    id: 'optimize',
    name: 'Code optimization',
    input: 'Intermediate representation',
    output: 'Improved IR',
    zeroPhases: ['lower', 'codegen'],
    probe: 'zero build --profile release-small | tiny',
    divergence:
      'Not a separately reported phase. Optimization is selected by build profile rather than ' +
      'exposed as a pass pipeline, so its cost is folded into lower and codegen.',
    locus: 'compile-path',
  },
  {
    n: 6,
    id: 'codegen',
    name: 'Target code generation',
    input: 'Optimized IR',
    output: 'Machine code / object',
    zeroPhases: ['codegen', 'object', 'link'],
    probe: 'zero build --emit exe && zero size --json',
    divergence:
      'Three reported phases, not one. Direct per-format emitters replace a C bridge, and only ' +
      '`link` is marked non-cacheable.',
    locus: 'compile-path',
  },
]

/* The two cross-cutting activities the textbook draws as vertical bars beside
   the phase stack. Zero makes both of them first-class and inspectable, which
   is the most concrete way it differs from a conventional toolchain. */
export const CROSS_CUTTING = [
  {
    id: 'symbol-table',
    name: 'Symbol table management',
    classical: 'A data structure rebuilt by the front end on every compilation.',
    zero:
      'A persisted set of graph tables (schema, package, module, declaration, scope, import, ' +
      'symbol, type, effect, capability, ownership, resource, node, edge, projection, sourceMap) ' +
      'carried between runs in zero.graph and addressable by stable node handles.',
    probe: 'zero query --json --full',
  },
  {
    id: 'error-handling',
    name: 'Error detection and reporting',
    classical: 'Diagnostics rendered as prose for a human reader.',
    zero:
      'Structured records with a stable code, a span, expected/actual facts, a fixSafety rating ' +
      'and an optional typed repair id — designed to be consumed by a program, not parsed from English.',
    probe: 'zero check --json | zero explain --json | zero fix --plan --json',
  },
] as const

/* Zero's own eight reported phases, in the order the compiler lists them.
   Note that `resolve` precedes `parse`, which is not a typo on our part: it is
   what the compiler reports, and it is a direct consequence of compiling from a
   graph whose names are already bound. */
export const ZERO_PHASES = [
  { name: 'resolve', maps: 'semantic', note: 'Binds names against stored symbol facts.' },
  { name: 'parse', maps: 'lexical/syntax', note: 'Graph-native; no character scan on the package path.' },
  { name: 'interface', maps: 'semantic', note: 'Public symbol surface and import graph fingerprinting.' },
  { name: 'check', maps: 'semantic', note: 'Types, effects, ownership, capability requirements.' },
  { name: 'lower', maps: 'ir', note: 'Graph HIR to MIR, with contract verification before emission.' },
  { name: 'codegen', maps: 'codegen', note: 'MIR to target machine code via direct emitters.' },
  { name: 'object', maps: 'codegen', note: 'Object-file construction in the target format.' },
  { name: 'link', maps: 'codegen', note: 'The only phase the compiler marks non-cacheable.' },
] as const

export const PHASE_ORDER = ZERO_PHASES.map((p) => p.name)

/* Diagnostic code prefixes, and the phase each one belongs to. Derived from the
   error corpus rather than from documentation. */
export const CODE_TO_PHASE: Record<string, { phase: string; label: string }> = {
  PAR: { phase: 'lexical/syntax', label: 'Parsing' },
  NAM: { phase: 'semantic', label: 'Name resolution' },
  TYP: { phase: 'semantic', label: 'Type checking' },
  ERR: { phase: 'semantic', label: 'Effect checking' },
  MEM: { phase: 'semantic', label: 'Memory / frame budget' },
  IMP: { phase: 'semantic', label: 'Imports' },
  PKG: { phase: 'semantic', label: 'Package resolution' },
  TAR: { phase: 'codegen', label: 'Target and capability' },
  BLD: { phase: 'codegen', label: 'Build configuration' },
  STD: { phase: 'semantic', label: 'Standard library contract' },
  RGP: { phase: 'ingestion', label: 'Graph ingestion' },
  MET: { phase: 'semantic', label: 'Compile-time evaluation' },
  STC: { phase: 'semantic', label: 'Static values' },
}

export function phaseForCode(code: string) {
  return CODE_TO_PHASE[code.slice(0, 3)] ?? { phase: 'unknown', label: 'Unclassified' }
}
