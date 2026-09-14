import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { InsertRow } from "@/lib/types"
import {
  askedAgainPatch,
  duplicatePersonaValues,
  findDuplicateQuestion,
  firstClause,
  generatorHref,
  isUntapped,
  linksByProblem,
  NONE,
  nextPersonaColor,
  personaCompleteness,
  problemIdeaTitle,
  problemIdeaValues,
  questionIdeaValues,
  questionPriority,
  rankAnswerCandidates,
  recentContentByPersona,
} from "./audience-model"

const NOW = new Date(2026, 8, 13, 10)
const item = (id: string, values: InsertRow<"content_items">) => buildRow("content_items", { id, ...values }, "u", NOW)
const idea = (id: string, values: InsertRow<"content_ideas">) => buildRow("content_ideas", { id, ...values }, "u", NOW)
const problem = (id: string, values: InsertRow<"audience_problems">) => buildRow("audience_problems", { id, ...values }, "u", NOW)
const question = (id: string, values: InsertRow<"audience_questions">) => buildRow("audience_questions", { id, ...values }, "u", NOW)
const persona = (id: string, values: InsertRow<"audience_personas">) => buildRow("audience_personas", { id, ...values }, "u", NOW)

describe("questionPriority", () => {
  it("rises with repeats: 5+ High, 3+ Medium", () => {
    expect([1, 2, 3, 4, 5, 9].map(questionPriority)).toEqual(["low", "low", "medium", "medium", "high", "high"])
  })
})

describe("askedAgainPatch", () => {
  it("saves an integer count and today's date, and reopens a dismissed question", () => {
    expect(askedAgainPatch({ frequency: 2.6, status: "dismissed" }, "2026-09-13")).toEqual({
      frequency: 4,
      last_asked_at: "2026-09-13",
      status: "new",
    })
    expect(askedAgainPatch({ frequency: 1, status: "answered" }, "2026-09-13")).toEqual({ frequency: 2, last_asked_at: "2026-09-13" })
  })
})

describe("findDuplicateQuestion", () => {
  it("matches case and punctuation insensitively", () => {
    const rows = [question("q1", { question: "Is boosting posts a waste of money?" })]
    expect(findDuplicateQuestion(rows, "is boosting posts a waste of money")?.id).toBe("q1")
    expect(findDuplicateQuestion(rows, "Is boosting posts a waste of money?", "q1")).toBeUndefined()
    expect(findDuplicateQuestion(rows, "   ")).toBeUndefined()
  })
})

describe("problem ideas", () => {
  it("builds a working title from the first clause", () => {
    expect(
      problemIdeaTitle({ problem: 'Boosts posts instead of running proper campaigns, then concludes "hindi gumagana ang ads"', category: "beginner" })
    ).toBe("Boosts posts instead of running proper campaigns — how to fix it")
    expect(problemIdeaTitle({ problem: "No SOPs — every launch depends on whoever is online", category: "operational" })).toBe(
      "No SOPs — how to fix it"
    )
    expect(problemIdeaTitle({ problem: "worried AI will make their role obsolete.", category: "career" })).toBe(
      "Worried AI will make their role obsolete — what to do about it"
    )
    expect(firstClause("x".repeat(120), 20)).toMatch(/…$/)
  })

  it("prefills the idea with the problem, persona and pillar", () => {
    const row = problem("pr1", { problem: "ROAS collapses when budget rises", category: "advanced", severity: 5, persona_id: "pe1", pillar_id: "pi1" })
    const values = problemIdeaValues(row, { name: "Founder" })
    expect(values).toMatchObject({
      source: "problem_bank",
      source_ref_id: "pr1",
      problem_id: "pr1",
      persona_id: "pe1",
      pillar_id: "pi1",
      status: "inbox",
      priority: "high",
    })
    expect(values.why_it_matters).toContain("for Founder")
  })

  it("links the Idea Generator with only the context that exists", () => {
    expect(generatorHref({ id: "pr1", persona_id: "pe1", pillar_id: null })).toBe("/ideas/generator?problem=pr1&persona=pe1&run=1")
  })

  it("counts a problem as untapped until an idea or a content item addresses it", () => {
    const links = linksByProblem([idea("i1", { problem_id: "a" })], [item("c1", { problem_id: "b" })])
    expect(isUntapped(links.get("a"))).toBe(false)
    expect(isUntapped(links.get("b"))).toBe(false)
    expect(isUntapped(links.get("c"))).toBe(true)
  })
})

describe("questionIdeaValues", () => {
  it("uses the question as the working title and keeps its context", () => {
    const row = question("q1", { question: "When should I scale?", topic: "Scaling", frequency: 6, platform: "tiktok", persona_id: "pe1" })
    expect(questionIdeaValues(row)).toMatchObject({
      title: "When should I scale?",
      core_topic: "Scaling",
      source: "question_bank",
      source_ref_id: "q1",
      platforms: ["tiktok"],
      persona_id: "pe1",
      priority: "high",
    })
  })
})

describe("personas", () => {
  it("picks the next unused colour in fixed order", () => {
    expect(nextPersonaColor([{ color: "blue" }, { color: "orange" }])).toBe("aqua")
  })

  it("duplicates every field except identity and primary flag", () => {
    const source = persona("p1", { name: "Founder", goals: ["Scale"], is_primary: true, color: "blue" })
    const copy = duplicatePersonaValues(source, [source])
    expect(copy).toMatchObject({ name: "Founder (copy)", is_primary: false, color: "orange", goals: ["Scale"] })
    expect(copy.goals).not.toBe(source.goals)
    expect("id" in copy).toBe(false)
  })

  it("measures profile completeness", () => {
    expect(personaCompleteness(persona("p1", {}))).toBe(0)
    expect(personaCompleteness(persona("p2", { profession: "Founder", goals: ["Scale"] }))).toBe(12)
  })
})

describe("recentContentByPersona", () => {
  it("counts dated content in the window by target persona", () => {
    const share = recentContentByPersona(
      [
        item("a", { persona_id: "p1", stage: "published", published_at: "2026-09-10T09:00:00" }),
        item("b", { persona_id: null, stage: "scheduled", scheduled_at: "2026-09-13T18:00:00" }),
        item("c", { persona_id: "p1", stage: "published", published_at: "2026-05-01T09:00:00" }),
        item("d", { persona_id: "p1", stage: "brief" }),
      ],
      NOW
    )
    expect(share.total).toBe(2)
    expect(share.counts.get("p1")).toBe(1)
    expect(share.counts.get(NONE)).toBe(1)
  })
})

describe("rankAnswerCandidates", () => {
  it("suggests content from the question's idea and content sharing its keywords", () => {
    const ranked = rankAnswerCandidates(
      { question: "When should I increase my ad budget?", topic: "Scaling budget", idea_id: "i1", content_item_id: null },
      [
        item("x", { title: "Behind the scenes of our office move", stage: "published" }),
        item("y", { title: "How I decide when to increase ad budget", stage: "published" }),
        item("z", { title: "Unrelated", idea_id: "i1", stage: "brief" }),
      ]
    )
    expect(ranked.suggested.map((i) => i.id)).toEqual(["z", "y"])
    expect(ranked.others.map((i) => i.id)).toEqual(["x"])
  })
})
