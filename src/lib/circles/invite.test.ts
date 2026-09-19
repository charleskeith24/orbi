import { describe, expect, it } from "vitest"
import { inviteLink, isInviteCode, parseInvite } from "./invite"
import { CircleApiError, toCircleError } from "./types"

const CODE = "Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3"

describe("invite links", () => {
  it("recognises 43-character base64url codes", () => {
    expect(CODE).toHaveLength(43)
    expect(isInviteCode(CODE)).toBe(true)
    expect(isInviteCode(CODE.slice(1))).toBe(false)
    expect(isInviteCode(`${CODE.slice(1)}+`)).toBe(false)
  })

  it("builds the join link", () => {
    expect(inviteLink("https://orbi.example/", CODE)).toBe(`https://orbi.example/circles/join/${CODE}`)
  })

  it("reads the code from a pasted link, path or bare code", () => {
    expect(parseInvite(`https://orbi.example/circles/join/${CODE}`)).toBe(CODE)
    expect(parseInvite(`  http://localhost:3000/circles/join/${CODE}/?utm=x#top `)).toBe(CODE)
    expect(parseInvite(`/circles/join/${CODE}`)).toBe(CODE)
    expect(parseInvite(` ${CODE} `)).toBe(CODE)
  })

  it("rejects anything else", () => {
    expect(parseInvite("")).toBeNull()
    expect(parseInvite("https://orbi.example/circles/abc")).toBeNull()
    expect(parseInvite(`https://orbi.example/circles/join/${CODE}x`)).toBeNull()
    expect(parseInvite("hello there")).toBeNull()
  })
})

describe("toCircleError", () => {
  it("maps the circle functions' codes, constraint and RLS errors, and network failures", () => {
    expect(toCircleError({ message: "circle_full", code: "P0001" }).code).toBe("circle_full")
    expect(toCircleError({ message: 'new row violates row-level security policy for table "circle_asks"', code: "42501" }).code).toBe("invalid")
    expect(toCircleError({ message: "value too long", code: "23514" }).code).toBe("invalid")
    expect(toCircleError(new TypeError("Failed to fetch")).code).toBe("network")
    expect(toCircleError(new Error("boom")).code).toBe("unknown")
    const original = new CircleApiError("not_owner")
    expect(toCircleError(original)).toBe(original)
  })
})
