import { describe, expect, it } from "vitest"
import { buildShareText, resolveShareIntent, SHARE_TEXT_MAX } from "./share-intent"

const params = (query: string) => new URLSearchParams(query)

describe("buildShareText", () => {
  it("puts the title first, then the text, then the link", () => {
    expect(buildShareText({ title: "Budget tips", text: "Save 20% first", url: "https://example.com/a" })).toBe(
      "Budget tips\nSave 20% first\nhttps://example.com/a"
    )
  })

  it("drops the url when the text already carries it (Android puts links in text)", () => {
    expect(
      buildShareText({ title: "", text: "Watch this https://youtu.be/abc", url: "https://youtu.be/abc" })
    ).toBe("Watch this https://youtu.be/abc")
  })

  it("drops a title that the text repeats, and text that the title already contains", () => {
    expect(buildShareText({ title: "Hello", text: "Hello world" })).toBe("Hello world")
    expect(buildShareText({ title: "Hello world https://x.io", text: "https://x.io" })).toBe("Hello world https://x.io")
    expect(buildShareText({ title: "Same", text: "Same" })).toBe("Same")
  })

  it("keeps a title that is not the url", () => {
    expect(buildShareText({ title: "https://x.io", url: "https://x.io" })).toBe("https://x.io")
  })

  it("trims whitespace, normalises line endings and collapses long blank runs", () => {
    expect(buildShareText({ text: "  line one\r\n\r\n\r\n\r\nline two  " })).toBe("line one\n\nline two")
  })

  it("returns an empty string when nothing was shared", () => {
    expect(buildShareText({})).toBe("")
    expect(buildShareText({ title: "  ", text: null, url: undefined })).toBe("")
  })

  it("caps the note at the Quick Capture limit", () => {
    const long = "a".repeat(SHARE_TEXT_MAX + 50)
    expect(buildShareText({ text: long })).toHaveLength(SHARE_TEXT_MAX)
  })
})

describe("resolveShareIntent", () => {
  it("turns shared fields into a prefilled capture", () => {
    expect(resolveShareIntent(params("title=Idea&text=Try%20a%20carousel"))).toEqual({
      kind: "capture",
      text: "Idea\nTry a carousel",
      shared: true,
    })
  })

  it("opens an empty capture from the Quick Capture shortcut", () => {
    expect(resolveShareIntent(params("action=capture"))).toEqual({ kind: "capture", text: "", shared: false })
  })

  it("shared text wins over the capture shortcut action", () => {
    expect(resolveShareIntent(params("action=capture&text=hi"))).toEqual({ kind: "capture", text: "hi", shared: true })
  })

  it("opens New content from its shortcut", () => {
    expect(resolveShareIntent(params("action=new-content"))).toEqual({ kind: "new-content" })
  })

  it("does nothing without params or with an unknown action", () => {
    expect(resolveShareIntent(params(""))).toEqual({ kind: "none" })
    expect(resolveShareIntent(params("action=launch-rockets"))).toEqual({ kind: "none" })
  })
})
