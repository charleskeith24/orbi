import { cn } from "@/lib/utils"

/**
 * Tiny, safe Markdown renderer for AI output and notes. Produces React elements only
 * (no HTML injection). Supports: # / ## / ### headings, paragraphs (single newlines kept),
 * **bold**, *italic* / _italic_, `code`, ``` fences, - / * / 1. lists (one nesting level), > quotes,
 * --- rules, [text](https://…) and bare http(s) links.
 */

interface ListItem {
  text: string
  children: ListItem[]
  childrenOrdered: boolean
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "hr" }

const LIST_ITEM = /^(\s*)(?:([-*•+])|(\d+)[.)])\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/

function listItem(line: string) {
  const m = LIST_ITEM.exec(line)
  if (!m) return null
  return { indent: m[1].replace(/\t/g, "  ").length, ordered: m[3] !== undefined, number: Number(m[3] ?? 1), text: m[4] }
}

function startsBlock(line: string): boolean {
  const t = line.trim()
  return HEADING.test(t) || RULE.test(t) || t.startsWith(">") || t.startsWith("```") || listItem(line) !== null
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      i++
      continue
    }
    if (trimmed.startsWith("```")) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++])
      i++
      blocks.push({ type: "code", text: body.join("\n") })
      continue
    }
    const heading = HEADING.exec(trimmed)
    if (heading) {
      blocks.push({ type: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2] })
      i++
      continue
    }
    if (RULE.test(trimmed)) {
      blocks.push({ type: "hr" })
      i++
      continue
    }
    if (trimmed.startsWith(">")) {
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) quote.push(lines[i++].trim().replace(/^>\s?/, ""))
      blocks.push({ type: "quote", lines: quote })
      continue
    }
    const first = listItem(line)
    if (first) {
      const items: ListItem[] = []
      const base = first.indent
      while (i < lines.length) {
        const current = lines[i]
        if (!current.trim()) {
          const next = lines[i + 1]
          if (next !== undefined && listItem(next)) {
            i++
            continue
          }
          break
        }
        const item = listItem(current)
        if (!item) {
          if (/^\s+\S/.test(current) && items.length) {
            items[items.length - 1].text += `\n${current.trim()}`
            i++
            continue
          }
          break
        }
        const parent = items[items.length - 1]
        if (item.indent > base && parent) {
          if (!parent.children.length) parent.childrenOrdered = item.ordered
          parent.children.push({ text: item.text, children: [], childrenOrdered: false })
        } else if (item.ordered !== first.ordered) {
          break
        } else {
          items.push({ text: item.text, children: [], childrenOrdered: false })
        }
        i++
      }
      blocks.push({ type: "list", ordered: first.ordered, start: first.number, items })
      continue
    }
    const paragraph: string[] = [trimmed]
    i++
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++].trim())
    blocks.push({ type: "paragraph", lines: paragraph })
  }
  return blocks
}

const INLINE_SOURCE = [
  "(`[^`\\n]+`)",
  "(\\*\\*[^*\\n]+?\\*\\*)",
  "(\\*[^*\\s](?:[^*\\n]*?[^*\\s])?\\*)",
  "(\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^\\s)]+\\))",
  "(https?:\\/\\/[^\\s<]*[^\\s<.,;:!?)\\]'\"])",
  // _italic_ only at word boundaries, so snake_case identifiers stay literal.
  "((?<![\\w])_[^_\\s](?:[^_\\n]*?[^_\\s])?_(?![\\w]))",
].join("|")

const LINK_CLASS =
  "font-medium text-foreground underline decoration-foreground/30 underline-offset-3 hover:decoration-foreground"

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = new RegExp(INLINE_SOURCE, "g")
  const out: React.ReactNode[] = []
  let last = 0
  let n = 0
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyPrefix}.${n++}`
    if (m[1]) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {m[1].slice(1, -1)}
        </code>
      )
    } else if (m[2]) {
      out.push(
        <strong key={key} className="font-semibold">
          {renderInline(m[2].slice(2, -2), key)}
        </strong>
      )
    } else if (m[3]) {
      out.push(<em key={key}>{renderInline(m[3].slice(1, -1), key)}</em>)
    } else if (m[4]) {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(m[4])
      out.push(
        <a key={key} href={link?.[2]} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {renderInline(link?.[1] ?? "", key)}
        </a>
      )
    } else if (m[5]) {
      out.push(
        <a key={key} href={m[5]} target="_blank" rel="noopener noreferrer" className={cn(LINK_CLASS, "[overflow-wrap:anywhere]")}>
          {m[5]}
        </a>
      )
    } else if (m[6]) {
      out.push(<em key={key}>{renderInline(m[6].slice(1, -1), key)}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function renderLines(lines: string[], keyPrefix: string): React.ReactNode[] {
  return lines.flatMap((line, index) => [
    ...(index ? [<br key={`${keyPrefix}.br${index}`} />] : []),
    ...renderInline(line, `${keyPrefix}.${index}`),
  ])
}

function renderItems(items: ListItem[], ordered: boolean, keyPrefix: string, start = 1): React.ReactNode {
  const List = ordered ? "ol" : "ul"
  return (
    <List
      start={ordered && start !== 1 ? start : undefined}
      className={cn("flex flex-col gap-1 pl-5 marker:text-muted-foreground", ordered ? "list-decimal" : "list-disc")}
    >
      {items.map((item, index) => {
        const key = `${keyPrefix}.${index}`
        return (
          <li key={key} className="pl-0.5">
            {renderLines(item.text.split("\n"), key)}
            {item.children.length ? <div className="mt-1">{renderItems(item.children, item.childrenOrdered, `${key}c`)}</div> : null}
          </li>
        )
      })}
    </List>
  )
}

const HEADING_CLASS = {
  1: "mt-2 text-base font-semibold tracking-tight",
  2: "mt-2 text-sm font-semibold",
  3: "mt-1 text-sm font-medium text-muted-foreground",
} as const

export function Markdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkdown(content)
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 text-sm leading-relaxed break-words text-foreground", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case "heading": {
            const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5"
            return (
              <Tag key={key} className={cn(HEADING_CLASS[block.level], index === 0 && "mt-0")}>
                {renderInline(block.text, key)}
              </Tag>
            )
          }
          case "paragraph":
            return <p key={key}>{renderLines(block.lines, key)}</p>
          case "list":
            return <div key={key}>{renderItems(block.items, block.ordered, key, block.start)}</div>
          case "quote":
            return (
              <blockquote key={key} className="border-l-2 pl-3 text-muted-foreground">
                {renderLines(block.lines, key)}
              </blockquote>
            )
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed scrollbar-thin">
                <code>{block.text}</code>
              </pre>
            )
          case "hr":
            return <hr key={key} className="border-border" />
        }
      })}
    </div>
  )
}
