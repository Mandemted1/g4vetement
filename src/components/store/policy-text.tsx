import { Fragment } from "react"

/**
 * Renders the plain text the admin writes in Settings:
 *   "## Heading" lines become headings, runs of "- item" lines become bullet lists,
 *   runs of "| a | b |" lines become a table (the first row is the header),
 *   everything else is a paragraph (single line breaks are kept). No HTML is ever interpreted.
 */
export function PolicyText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n")
        const nodes: React.ReactNode[] = []
        let buffer: string[] = []
        let table: string[] = []

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

        const flushTable = (key: string) => {
          if (!table.length) return
          // cells split on "|"; a divider row like |---|---| is allowed and ignored
          const rows = table
            .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
            .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)))
          table = []
          if (!rows.length) return
          const [head, ...body] = rows
          nodes.push(
            <div key={key} className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-y">
                    {head.map((c, j) => <th key={j} scope="col" className="label whitespace-nowrap py-3 pr-4 font-normal text-[var(--mute)]">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, j) => (
                    <tr key={j} className="border-b">
                      {r.map((c, k) => (k === 0 ? <th key={k} scope="row" className="whitespace-nowrap py-3 pr-4 font-medium">{c}</th> : <td key={k} className="whitespace-nowrap py-3 pr-4 tabular-nums">{c}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>,
          )
        }

        lines.forEach((l, j) => {
          if (/^\s*\|/.test(l)) {
            flush(`${i}-${j}-p`)
            table.push(l)
            return
          }
          flushTable(`${i}-${j}-t`)
          // a heading may sit directly above its paragraph with no blank line between
          if (/^#{1,3} /.test(l)) {
            flush(`${i}-${j}-p`)
            nodes.push(<h2 key={`${i}-${j}`} className="mt-10 text-[1.35rem] font-medium leading-tight tracking-[-0.03em] first:mt-0">{l.replace(/^#{1,3} /, "")}</h2>)
          } else buffer.push(l)
        })
        flushTable(`${i}-end-t`)
        flush(`${i}-end`)
        return <Fragment key={i}>{nodes}</Fragment>
      })}
    </div>
  )
}
