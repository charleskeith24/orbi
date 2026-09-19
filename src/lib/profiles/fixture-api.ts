/**
 * DEV-ONLY: the sample profiles behind the Circles fixture (`pbos:dev-circles` = `fixture`, scripts' `--circles`),
 * so circle members show photos and profile cards on the local dev server. Your own profile is the real local one
 * (`./local-api.ts`), also answered for the fixture's "you" id; everyone else is "(sample)" with illustrated
 * sample photos (`./sample-photos.ts`). Created only through `features/profile/api/dev-fixture.ts`, which never
 * loads it in production; creating it in a production build throws.
 */
import { FIXTURE_SELF_ID } from "@/lib/circles/fixture-api"
import type { ID } from "@/lib/types"
import { samplePhoto } from "./sample-photos"
import type { PhotoUrl, ProfilesApi, PublicProfile } from "./types"

const SAMPLE_PREFIX = "sample-photo:"

/** Sample people from the Circles fixture (`seedFixtureState`). Some without a photo, to show initials. */
export const SAMPLE_PROFILES: PublicProfile[] = [
  {
    id: "sample-mika",
    display_name: "Mika Dizon (sample)",
    avatar_path: `${SAMPLE_PREFIX}1`,
    headline: "Ipon challenges and budgeting for first-jobbers (sample)",
    location: "Pasig City",
    links: [
      { platform: "tiktok", value: "mika.sample" },
      { platform: "youtube", value: "mikasample" },
    ],
    niche: "Money habits for Filipino first-jobbers (sample)",
    main_platform: "tiktok",
  },
  {
    id: "sample-jun",
    display_name: "Jun Reyes (sample)",
    avatar_path: `${SAMPLE_PREFIX}2`,
    headline: "Side hustles that fit a 9–5 (sample)",
    location: "Quezon City",
    links: [{ platform: "website", value: "https://jun.example.com" }],
    niche: null,
    main_platform: null,
  },
  {
    id: "sample-ria",
    display_name: "Ria Santos (sample)",
    avatar_path: `${SAMPLE_PREFIX}4`,
    headline: "Nurse abroad sharing remittance and savings tips (sample)",
    location: "Iloilo",
    links: [
      { platform: "instagram", value: "ria.sample" },
      { platform: "facebook", value: "ria.sample" },
    ],
    niche: "Money for OFW nurses (sample)",
    main_platform: "facebook",
  },
  {
    id: "sample-bea",
    display_name: "Bea Cruz (sample)",
    avatar_path: null,
    headline: "Podcast on side hustles for nurses (sample)",
    location: "",
    links: [],
    niche: null,
    main_platform: null,
  },
  {
    id: "sample-tonio",
    display_name: "Tonio Lim (sample)",
    avatar_path: `${SAMPLE_PREFIX}6`,
    headline: "",
    location: "Davao City",
    links: [{ platform: "x", value: "tonio_sample" }],
    niche: null,
    main_platform: null,
  },
  { id: "sample-lara", display_name: "Lara (sample)", avatar_path: `${SAMPLE_PREFIX}3`, headline: "Carinderia tours (sample)", location: "Quezon City", links: [], niche: null, main_platform: null },
  { id: "sample-paolo", display_name: "Paolo (sample)", avatar_path: null, headline: "", location: "", links: [], niche: null, main_platform: null },
  { id: "sample-kim", display_name: "Kim (sample)", avatar_path: `${SAMPLE_PREFIX}5`, headline: "", location: "", links: [], niche: null, main_platform: null },
]

export interface ProfilesFixtureOptions {
  /** Your real profile (the local one). */
  base: ProfilesApi
  /** Simulated latency (ms), so pending states show in screenshots. */
  latencyMs?: number
  samples?: PublicProfile[]
}

/** The dev fixture: your local profile plus the sample people. Throws in production builds. */
export function createProfilesFixture(options: ProfilesFixtureOptions): ProfilesApi {
  if (process.env.NODE_ENV === "production") throw new Error("The profiles fixture is development-only.")
  const { base } = options
  const latency = options.latencyMs ?? 120
  const samples = new Map((options.samples ?? SAMPLE_PROFILES).map((p) => [p.id, p]))
  const selfIds = new Set<ID>([base.self, FIXTURE_SELF_ID])

  const slow = async <T>(fn: () => Promise<T>, ms = latency): Promise<T> => {
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
    return fn()
  }

  return {
    self: base.self,
    source: "fixture",
    getMyProfile: () => slow(() => base.getMyProfile()),
    updateMyProfile: (patch) => slow(() => base.updateMyProfile(patch)),
    // Uploads take a moment online; the fixture shows that state.
    setPhoto: (photo) => slow(() => base.setPhoto(photo), Math.max(latency, 900)),
    removePhoto: () => slow(() => base.removePhoto()),

    getProfiles: (ids) =>
      slow(async () => {
        const out: PublicProfile[] = []
        const wantsSelf = ids.filter((id) => selfIds.has(id))
        if (wantsSelf.length) {
          const [mine] = await base.getProfiles([base.self])
          if (mine) for (const id of wantsSelf) out.push({ ...mine, id })
        }
        for (const id of ids) {
          const sample = samples.get(id)
          if (sample) out.push(structuredClone(sample))
        }
        return out
      }),

    photoUrls: (paths) =>
      slow(async () => {
        const out: Record<string, PhotoUrl> = await base.photoUrls(paths.filter((p) => !p.startsWith(SAMPLE_PREFIX)))
        for (const path of paths) {
          if (!path.startsWith(SAMPLE_PREFIX)) continue
          const index = Number(path.slice(SAMPLE_PREFIX.length))
          if (Number.isInteger(index)) out[path] = { url: samplePhoto(index), expiresAt: Infinity }
        }
        return out
      }),
  }
}
