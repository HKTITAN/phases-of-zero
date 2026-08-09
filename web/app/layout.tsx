import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'Phases of Compiler Design: A Review with Evidence from Zero',
  description:
    'A review paper on the phases of compiler design, evaluated against Zero 0.3.4 — a graph-first ' +
    'systems language whose compiler reports its own phase structure as machine-readable data.',
  authors: [
    { name: 'Harshit Khemani' },
    { name: 'Kush Ahuja' },
    { name: 'Mohit Kumar Mishra' },
    { name: 'Kushagra Agrawal' },
  ],
  keywords: [
    'compiler design', 'compiler phases', 'lexical analysis', 'syntax analysis',
    'semantic analysis', 'intermediate representation', 'code generation',
    'zerolang', 'Zero', 'graph-first compilation', 'agent-oriented languages',
  ],
  openGraph: {
    title: 'Phases of Compiler Design: A Review with Evidence from Zero',
    description:
      'The classical six-phase compiler model, measured against a compiler that emits its own phase timings.',
    type: 'article',
  },
}

/* Light only. The document ships on one canvas; advertising a dark theme-color
   would let the browser tint its own chrome to a colour the page never paints.

   This is the one literal colour in the codebase, and it has to be: `theme-color`
   is a meta tag read by the browser before any stylesheet is applied, so it
   cannot reference a custom property. The value is `--bg` from globals.css, and
   changing one without the other is the only way they can drift. */
export const viewport = {
  themeColor: '#fcfcfb',
  colorScheme: 'light' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ colorScheme: 'light' }}
    >
      <head>
        {/* Belt and braces: some in-app browsers read the meta rather than the
            CSS property, and will otherwise auto-invert the page. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
