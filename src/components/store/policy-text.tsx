import { Fragment } from "react"

/**
 * Renders the plain text the admin writes in Settings:
 *   "## Heading" lines become headings, runs of "- item" lines become bullet lists,
 *   everything else is a paragraph (single line breaks are kept). No HTML is ever interpreted.
 */
export function PolicyText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n")
        // a heading may sit directly above its paragraph with no blank line between
        const nodes: React.ReactNode[] = []
        let buffer: string[] = []
        const flush = (key: string) => {
          if (!buffer.length) return
          if (buffer.every((l) => /^[-*] /.test(l))) {
            nodes.push(
              <ul key={key} className="mt-3 list-disc space-y-1.5 pl-5">
                {buffer.map((l, j) => <li key={j}>{l.replace(/^[-*] /, "")}</li>)}
              </ul>,
            )
          } else {
            nodes.push(
              <p key={key} className="mt-3">
                {buffer.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}
              </p>,
            )
          }
          buffer = []
        }
        lines.forEach((l, j) => {
          if (/^#{1,3} /.test(l)) {
            flush(`${i}-${j}-p`)
            nodes.push(<h2 key={`${i}-${j}`} className="mt-10 text-[1.35rem] font-medium leading-tight tracking-[-0.03em] first:mt-0">{l.replace(/^#{1,3} /, "")}</h2>)
          } else buffer.push(l)
        })
        flush(`${i}-end`)
        return <Fragment key={i}>{nodes}</Fragment>
      })}
    </div>
  )
}
