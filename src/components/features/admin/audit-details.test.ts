import { describe, expect, it } from "vitest"
import { translator } from "@/lib/i18n/core"
import { describeAuditDetails } from "./audit-details"
import { auditMessages, usersMessages } from "./messages"

const en = [translator(auditMessages, "en"), translator(usersMessages, "en")] as const
const tl = [translator(auditMessages, "tl"), translator(usersMessages, "tl")] as const

describe("describeAuditDetails", () => {
  it("reads status changes, the requests switch and anything else", () => {
    expect(describeAuditDetails({ from: "active", to: "disabled" }, ...en)).toBe("Active → Disabled")
    expect(describeAuditDetails({ access_open: false }, ...en)).toBe("Requests: closed")
    expect(describeAuditDetails({ access_open: true }, ...tl)).toBe("Requests: bukas")
    expect(describeAuditDetails({ reason: "spam", count: 2 }, ...en)).toBe("reason: spam · count: 2")
    expect(describeAuditDetails({}, ...en)).toBe("")
  })
})
