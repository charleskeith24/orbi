import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Markdown } from "./markdown"

const html = (content: string) => renderToStaticMarkup(Markdown({ content }))

describe("Markdown inline emphasis", () => {
  it("renders _underscore_ italics", () => {
    expect(html("This is _really_ important.")).toContain("<em>really</em>")
  })
  it("keeps snake_case identifiers literal", () => {
    const out = html("Use content_ideas and ai_generations tables.")
    expect(out).not.toContain("<em>")
    expect(out).toContain("content_ideas")
  })
  it("does not italicise inside URLs or code", () => {
    const out = html("See https://example.com/a_b_c and `x_y_z`.")
    expect(out).not.toContain("<em>")
  })
  it("still renders *asterisk* italics and **bold**", () => {
    const out = html("*one* and **two**")
    expect(out).toContain("<em>one</em>")
    expect(out).toContain("<strong")
  })
})
