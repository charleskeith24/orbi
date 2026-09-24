/**
 * Test-only: reads the table groups and policy expressions back out of
 * `supabase/migrations/20260921000000_team.sql`, so the TypeScript mirror in `../permissions.ts` and the
 * schema-parity test can both be checked against the SQL that actually builds the policies.
 */
import { readFileSync } from "node:fs"

export const TEAM_MIGRATION = new URL("../../../../supabase/migrations/20260921000000_team.sql", import.meta.url)

export const TEAM_SQL = readFileSync(TEAM_MIGRATION, "utf8")

export interface TeamTableGroups {
  owner: string[]
  editor: string[]
  money: string[]
}

/** The `owner_tables`, `editor_tables` and `money_tables` arrays of the policy DO block. */
export function readTeamTableGroups(sql: string = TEAM_SQL): TeamTableGroups {
  const read = (name: string): string[] => {
    const match = new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`, "i").exec(sql)
    if (!match) throw new Error(`${name} is missing from 20260921000000_team.sql`)
    return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  }
  return { owner: read("owner_tables"), editor: read("editor_tables"), money: read("money_tables") }
}

/** The four policy expressions the DO block assigns, keyed by group. */
export interface TeamPolicyExpressions {
  ownerRead: string
  ownerWrite: string
  editorRead: string
  editorWrite: string
  moneyRead: string
  moneyWrite: string
}

export function readTeamPolicyExpressions(sql: string = TEAM_SQL): TeamPolicyExpressions {
  const block = /if t = any \(money_tables\) then([\s\S]*?)end if;/.exec(sql)
  if (!block) throw new Error("The policy DO block's if/elsif chain is missing from 20260921000000_team.sql")
  const body = block[1]
  const assignments = [...body.matchAll(/v_(read|write)\s*:=\s*'([^']*)'/g)].map((m) => [m[1], m[2]] as const)
  if (assignments.length !== 6) throw new Error(`Expected 6 policy expressions, found ${assignments.length}`)
  const [moneyRead, moneyWrite, editorRead, editorWrite, ownerRead, ownerWrite] = assignments.map((a) => a[1])
  return { moneyRead, moneyWrite, editorRead, editorWrite, ownerRead, ownerWrite }
}
