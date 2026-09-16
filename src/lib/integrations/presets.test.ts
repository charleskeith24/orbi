import { describe, expect, it } from "vitest"
import { autoMapColumns } from "./analytics-import"
import { detectPreset, getImportPreset, IMPORT_PRESETS, presetMapping, youtubeUrlFromCell } from "./presets"

const detect = (headers: string[], rows: string[][] = []) => detectPreset(headers, rows)?.preset.id ?? null

describe("detectPreset", () => {
  it("recognises TikTok Studio's content file whatever the case, spacing or punctuation", () => {
    const headers = ["TIME", " Video title ", "video_link", "Post-Time", "total likes", "Total Comments", "TOTAL SHARES", "Total views", "Something new"]
    const detection = detectPreset(headers)
    expect(detection?.preset.id).toBe("tiktok_studio")
    expect(detection?.headers).toEqual(expect.arrayContaining(["video_link", "Post-Time", "total likes"]))
    expect(autoMapColumns(headers, detection?.preset)).toMatchObject({ title: 1, url: 2, published: 3, likes: 4, comments: 5, shares: 6, views: 7 })
  })

  it("recognises YouTube Studio's Table data.csv and maps the newer metric columns", () => {
    const headers = ["Content", "Video title", "Video publish time", "Duration", "Views", "Watch time (hours)", "Subscribers", "Average view duration", "Impressions", "Impressions click-through rate (%)"]
    expect(detect(headers)).toBe("youtube_studio")
    const extended = [...headers, "Likes", "Comments added", "Shares", "Subscribers gained", "Average percentage viewed (%)", "Unique viewers"]
    const mapping = autoMapColumns(extended, getImportPreset("youtube_studio"))
    expect(mapping).toMatchObject({ url: 0, title: 1, published: 2, views: 4, watch_time_seconds: 5, followers_gained: 6, likes: 10, comments: 11, shares: 12, avg_retention: 14, reach: 15 })
    // Thumbnail impressions and per-view averages never fill views or total watch time.
    expect(Object.values(mapping)).not.toContain(7)
    expect(Object.values(mapping)).not.toContain(8)
  })

  it("tells Facebook and Instagram exports apart, old and new Meta names", () => {
    const fbOld = ["Post ID", "Page ID", "Page name", "Title", "Description", "Duration (sec)", "Publish time", "Permalink", "Post type", "Impressions", "Reach", "Reactions, comments and shares", "Reactions", "Comments", "Shares", "Link clicks", "Seconds viewed"]
    const fbNew = ["Post ID", "Page name", "Publish time", "Permalink", "Post type", "Views", "Viewers", "Interactions", "Reactions", "Comments", "Shares", "Minutes viewed"]
    const igOld = ["Post ID", "Account ID", "Account username", "Account name", "Description", "Duration (sec)", "Publish time", "Permalink", "Post type", "Impressions", "Reach", "Likes", "Shares", "Follows", "Comments", "Saves", "Plays"]
    const igNew = ["Post ID", "Account username", "Description", "Publish time", "Permalink", "Post type", "Views", "Viewers", "Likes", "Shares", "Follows", "Comments", "Saves", "Profile visits"]
    expect([fbOld, fbNew, igOld, igNew].map((h) => detect(h))).toEqual(["meta_facebook", "meta_facebook", "meta_instagram", "meta_instagram"])

    const facebook = getImportPreset("meta_facebook")
    expect(autoMapColumns(fbOld, facebook)).toMatchObject({ title: 3, caption: 4, published: 6, url: 7, views: 9, reach: 10, likes: 12, comments: 13, shares: 14, link_clicks: 15, watch_time_seconds: 16 })
    const newMapping = autoMapColumns(fbNew, facebook)
    expect(newMapping).toMatchObject({ views: 5, reach: 6, likes: 8, watch_time_seconds: 11 })
    // "Interactions" (and "Reactions, comments and shares") are totals, never read as likes.
    expect(Object.values(newMapping)).not.toContain(7)
    expect(autoMapColumns(fbOld, null).likes).toBe(12)

    expect(autoMapColumns(igOld, getImportPreset("meta_instagram"))).toMatchObject({ caption: 4, views: 9, reach: 10, likes: 11, shares: 12, followers_gained: 13, comments: 14, saves: 15 })
  })

  it("uses post links and post types when the headers alone could be either", () => {
    const shared = ["Post ID", "Permalink", "Publish time", "Post type", "Description", "Views", "Reach", "Comments", "Shares"]
    expect(detect(shared)).toBeNull()
    const instagram = detectPreset(shared, [["1", "https://www.instagram.com/p/ABC123/", "09/01/2026 12:00", "IG reel", "Hi", "10", "5", "1", "0"]])
    expect(instagram).toMatchObject({ preset: { id: "meta_instagram" }, host: "instagram.com", postType: "IG reel" })
    expect(detect(shared, [["1", "https://facebook.com/reel/123", "09/01/2026 12:00", "Reels", "Hi", "10", "5", "1", "0"]])).toBe("meta_facebook")
  })

  it("leaves other files to the generic matcher", () => {
    expect(detect(["Content ID", "Title", "URL", "Platform", "Published", "Views", "Likes"])).toBeNull()
    expect(detect(["Title", "Views"])).toBeNull()
    expect(detect([])).toBeNull()
  })
})

describe("preset helpers", () => {
  it("builds YouTube watch URLs from the Content column", () => {
    expect(youtubeUrlFromCell("Hq3vT9xLm2A")).toBe("https://www.youtube.com/watch?v=Hq3vT9xLm2A")
    expect(youtubeUrlFromCell(" Total ")).toBe("Total")
    expect(youtubeUrlFromCell("https://youtu.be/abc")).toBe("https://youtu.be/abc")
  })

  it("maps only the preset's own column names", () => {
    for (const preset of IMPORT_PRESETS) expect(presetMapping(preset, ["Nothing", "Here"])).toEqual({})
    expect(getImportPreset("nope")).toBeNull()
  })
})
