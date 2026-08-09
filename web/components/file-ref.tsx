'use client'

/* Inline references to files in the corpus.

   Naming a file in prose is only useful if the reader can see it. Hovering a
   reference opens a preview of the real file — syntax-highlighted source read
   from the same capture the rest of the paper reads, not a screenshot. A
   rendered preview beats an image here on every axis that matters: it is sharp
   at any zoom, it follows the theme, its text is selectable and searchable, and
   it costs a few kilobytes of markup instead of a PNG per file.

   Clicking scrolls to that file in the corpus gallery and opens it there, and
   every file carries a link to the same lines on GitHub. */

import { useCallback, useRef, useState } from 'react'
import type { Capture } from '@/lib/types'
import { Icon } from '@/components/icons'
import { play } from '@/lib/sound'

export const REPO = 'https://github.com/HKTITAN/phases-of-zero'

/** Where a corpus file lives in the repository. */
export function githubUrl(programId: string, file: string) {
  return `${REPO}/blob/main/corpus/${programId}/${file}`
}

/** Where an error case lives. */
export function githubErrorUrl(caseId: string, file = 'src/main.0') {
  return `${REPO}/blob/main/errors/${caseId}/${file}`
}

/* Broadcast rather than routed: the gallery owns its own selection state, and a
   custom event lets a reference anywhere in the paper ask it to open a file
   without either component knowing about the other's internals. */
export const OPEN_FILE_EVENT = 'zero:open-file'

export type OpenFileDetail = { program: string; file: string }

export function openFile(detail: OpenFileDetail) {
  window.dispatchEvent(new CustomEvent<OpenFileDetail>(OPEN_FILE_EVENT, { detail }))
  document.getElementById('programs')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

/* --------------------------------------------------------------- the ref */

export function FileRef({
  capture, program, file = 'src/main.0', children, lines = 14,
}: {
  capture: Capture
  program: string
  file?: string
  children?: React.ReactNode
  /** How many lines of the file the preview shows. */
  lines?: number
}) {
  /* Opening is CSS, not state: `:hover` and `:focus-within` on the wrapper drive
     the card, with the open delay expressed as a transition-delay. That removes
     a timer, a re-render and two listeners per reference, and it cannot get
     stuck open if a pointer leaves during a React update.

     The only thing JS decides is direction — whether there is room below — and
     it decides it on pointer entry, before the card has any size of its own. */
  const [flip, setFlip] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)

  const entry = capture.corpus.find((c) => c.id === program)
  const source = entry?.sources.find((s) => s.file === file)

  const decideDirection = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (r) setFlip(r.bottom + 300 > window.innerHeight)
  }, [])

  if (!entry || !source) {
    // Never invent a link to a file the capture does not contain.
    return <code>{program}/{file}</code>
  }

  const excerpt = source.text.split('\n').slice(0, lines).join('\n')
  const more = source.text.split('\n').length - lines
  const label = children ?? `${program}/${file}`

  return (
    <span
      ref={anchor}
      className="file-ref-wrap"
      data-flip={flip ? 'true' : 'false'}
      onPointerEnter={decideDirection}
      onFocusCapture={decideDirection}
    >
      <button
        type="button"
        className="file-ref"
        onClick={() => { play('select'); openFile({ program, file }) }}
        aria-describedby={`fileref-${program}-${file.replace(/\W/g, '')}`}
      >
        <Icon name="book" size={12} />
        <span className="mono">{label}</span>
      </button>

      <span
        role="tooltip"
        id={`fileref-${program}-${file.replace(/\W/g, '')}`}
        className="file-ref-card"
      >
        <span className="file-ref-head">
          <span className="mono">{program}/{file}</span>
          <span className="meta">{source.nonEmptyLines} lines</span>
        </span>
        <span className="file-ref-body">
          <pre><code>{excerpt}</code></pre>
        </span>
        <span className="file-ref-foot">
          <span className="meta">
            {more > 0 ? `+${more} more lines` : 'complete file'}
          </span>
          <span className="meta">Click to open in §7</span>
        </span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------- github footer */

/** The link that sits under a file in the gallery. */
export function ViewOnGithub({ href, what }: { href: string; what: string }) {
  return (
    <a
      className="btn"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ minHeight: 32, fontSize: '0.75rem', boxShadow: 'none' }}
    >
      <Icon name="link" size={13} />
      View {what} on GitHub
    </a>
  )
}
