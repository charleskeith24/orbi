/**
 * The Help guides (/help): one topic per part of Orbi, grouped like the sidebar, in English and Taglish.
 *
 * Keep them true to the screens: button and menu names are written exactly as the UI shows them in that
 * language (**bold** marks them), module and page names stay English (ARCHITECTURE §9, §11). When a feature
 * changes how something is done, update its topic here (ARCHITECTURE §10). `help-topics.test.ts` checks both
 * languages have the same steps and tips, every link is a real page and every **bold** closes.
 */
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  Columns3,
  Compass,
  FileText,
  Flag,
  FlaskConical,
  Keyboard,
  Library,
  Lightbulb,
  Megaphone,
  Orbit,
  PenLine,
  Repeat,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquareKanban,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  Blend,
  type LucideIcon,
} from "lucide-react"
import type { UiLang } from "@/lib/i18n/core"

/** The Help page's sections, in order. Names are in `messages.ts` (`group_<key>`). */
export const HELP_GROUPS = ["start", "plan", "create", "grow", "measure", "money", "account", "faq"] as const
export type HelpGroup = (typeof HELP_GROUPS)[number]

export interface HelpText {
  title: string
  /** One line: what it's for — or, for a question, the answer. */
  summary: string
  /** Numbered steps, one short sentence each. Questions have none. */
  steps?: string[]
  tips?: string[]
}

export interface HelpTopic {
  /** kebab-case; `/help?open=<id>` opens it. */
  id: string
  group: HelpGroup
  icon: LucideIcon
  /** The page its "Open" link goes to. */
  href?: string
  /** Needs accounts (the online version): labelled in local mode. */
  online?: true
  /** Extra words people might search for, in either language. */
  keywords?: string[]
  en: HelpText
  tl: HelpText
}

export const HELP_TOPICS: HelpTopic[] = [
  // ------------------------------------------------------------------ Start here
  {
    id: "how-orbi-works",
    group: "start",
    icon: Orbit,
    href: "/",
    keywords: ["start", "begin", "loop", "simula", "paano"],
    en: {
      title: "How Orbi works",
      summary: "One loop: plan, capture ideas, create, publish, measure — then do more of what works.",
      steps: [
        "**Plan** — set who you are, who you help and your Content Pillars in Brand HQ, Audience and Pillars. Quick setup already filled in a first version.",
        "**Capture** — save every idea the moment you have it: **＋ New → Quick Capture**.",
        "**Create** — open an idea and choose **Convert to content**, then write the brief and script in Content Studio.",
        "**Publish** — move each post through the Pipeline and give it a date on the Calendar.",
        "**Measure** — after posting, log the numbers with **＋ New → Add analytics**. Orbi spots your Winners.",
        "**Learn** — read your Weekly Report, keep what worked and plan the next round.",
      ],
      tips: ["Home and Today always show the next thing to do."],
    },
    tl: {
      title: "Paano gumagana ang Orbi",
      summary: "Isang ikot lang: mag-plan, mag-ipon ng ideas, gumawa, mag-post, sukatin — tapos ulitin ang gumagana.",
      steps: [
        "**Plan** — ilagay kung sino ka, sino ang tinutulungan mo at ang Content Pillars mo sa Brand HQ, Audience at Pillars. May unang version na mula sa Quick setup.",
        "**Capture** — i-save agad ang bawat idea: **＋ Bago → Quick Capture**.",
        "**Create** — buksan ang idea at piliin ang **I-convert sa content**, tapos isulat ang brief at script sa Content Studio.",
        "**Publish** — ilipat ang bawat post sa Pipeline at bigyan ng petsa sa Calendar.",
        "**Measure** — pagka-post, i-log ang numbers gamit ang **＋ Bago → Magdagdag ng analytics**. Hahanapin ng Orbi ang Winners mo.",
        "**Learn** — basahin ang Weekly Report, ituloy ang gumana at i-plan ang susunod.",
      ],
      tips: ["Laging makikita sa Home at Today ang susunod na gagawin."],
    },
  },
  {
    id: "first-week",
    group: "start",
    icon: Flag,
    href: "/",
    keywords: ["missions", "onboarding", "new", "unang linggo", "7 araw"],
    en: {
      title: "Your first week",
      summary: "Seven small missions that take you around the whole loop once.",
      steps: [
        "Find the **Your first week** card on Home. Today shows the mission for the day.",
        "Do one mission a day: capture three ideas, make a piece of content, write its script, set your voice, publish, log the numbers, then review and plan.",
        "Missions tick themselves when you do the work — there's nothing to mark.",
        "Hide the card anytime. It retires on its own after two weeks.",
      ],
      tips: ["The ideas from Quick setup don't count — capture three of your own."],
    },
    tl: {
      title: "Unang 7 araw",
      summary: "Pitong maliit na mission na magdadala sa'yo sa buong ikot ng Orbi.",
      steps: [
        "Hanapin ang **Unang 7 araw** card sa Home. Nasa Today ang mission para sa araw na 'yon.",
        "Isang mission kada araw: mag-capture ng tatlong ideas, gumawa ng content, isulat ang script, i-set ang voice mo, mag-post, i-log ang numbers, tapos mag-review at mag-plan.",
        "Kusang natsi-check ang mission kapag nagawa mo na — wala kang kailangang pindutin.",
        "Pwede mong itago ang card anytime. Kusa rin itong mawawala pagkalipas ng dalawang linggo.",
      ],
      tips: ["Hindi kasama ang ideas galing sa Quick setup — mag-capture ng tatlong sarili mong idea."],
    },
  },
  {
    id: "daily-routine",
    group: "start",
    icon: CalendarCheck,
    href: "/today",
    keywords: ["today", "daily", "habit", "araw-araw", "routine"],
    en: {
      title: "A 10-minute daily routine",
      summary: "What to do each day so your content keeps moving.",
      steps: [
        "Open **Today** — it shows what's due, what's scheduled and your posting slot.",
        "Capture ideas as they come: **⌥N** (Alt+N) on a computer, or share to Orbi from an Android phone.",
        "Move one piece of content one stage forward in the Pipeline.",
        "Log the numbers for posts from the last two days: **＋ New → Add analytics**.",
        "Check tomorrow's slot, so you never start from zero.",
      ],
    },
    tl: {
      title: "10-minutong routine araw-araw",
      summary: "Ang gagawin kada araw para tuloy-tuloy ang content mo.",
      steps: [
        "Buksan ang **Today** — nandoon ang due, ang naka-schedule at ang posting slot mo.",
        "I-capture agad ang ideas: **⌥N** (Alt+N) sa computer, o i-share sa Orbi mula sa Android phone.",
        "Ilipat ang isang content nang isang stage pasulong sa Pipeline.",
        "I-log ang numbers ng mga post nitong huling dalawang araw: **＋ Bago → Magdagdag ng analytics**.",
        "Silipin ang slot bukas, para hindi ka nagsisimula sa wala.",
      ],
    },
  },

  // ------------------------------------------------------------------ Plan
  {
    id: "brand-hq",
    group: "plan",
    icon: Compass,
    href: "/strategy",
    keywords: ["strategy", "niche", "positioning", "voice", "goals", "platforms"],
    en: {
      title: "Brand HQ",
      summary: "Who you are, who you help and how you sound — the base for everything, AI included.",
      steps: [
        "Open **Brand HQ** and check what Quick setup filled in: your niche, positioning and voice.",
        "Describe your voice in your own words — AI drafts follow it.",
        "On **Goals**, set one to three goals with a number and a date.",
        "On **Platforms**, choose where you post and how often.",
        "**System** shows how all the parts connect.",
      ],
      tips: ["Changed direction? Run niche discovery again from Brand HQ."],
    },
    tl: {
      title: "Brand HQ",
      summary: "Kung sino ka, sino ang tinutulungan mo at paano ka magsalita — pundasyon ng lahat, pati ng AI.",
      steps: [
        "Buksan ang **Brand HQ** at tingnan ang nilagay ng Quick setup: niche, positioning at voice mo.",
        "Ilarawan ang voice mo sa sarili mong salita — iyon ang susundan ng AI drafts.",
        "Sa **Goals**, maglagay ng isa hanggang tatlong goal na may numero at petsa.",
        "Sa **Platforms**, piliin kung saan ka nagpo-post at gaano kadalas.",
        "Makikita sa **System** kung paano magkakakonekta ang lahat.",
      ],
      tips: ["Nag-iba ang direksyon mo? Patakbuhin ulit ang niche discovery mula sa Brand HQ."],
    },
  },
  {
    id: "audience",
    group: "plan",
    icon: Users,
    href: "/audience",
    keywords: ["persona", "problems", "questions", "problem bank", "question bank", "followers"],
    en: {
      title: "Audience",
      summary: "The people you make content for, their problems and their questions.",
      steps: [
        "Add a **Persona** for each kind of person you help: who they are and what they want.",
        "Fill the **Problem Bank** with what they struggle with — each problem is a content idea.",
        "Save the questions they ask in comments and DMs to the **Question Bank**.",
      ],
      tips: ["One clear persona beats five vague ones."],
    },
    tl: {
      title: "Audience",
      summary: "Ang mga taong ginagawan mo ng content, ang problema nila at ang mga tanong nila.",
      steps: [
        "Magdagdag ng **Persona** para sa bawat klase ng taong tinutulungan mo: sino sila at ano ang gusto nila.",
        "Punuin ang **Problem Bank** ng mga pinoproblema nila — bawat problema ay isang content idea.",
        "I-save sa **Question Bank** ang mga tanong nila sa comments at DMs.",
      ],
      tips: ["Mas mabuti ang isang malinaw na persona kaysa lima na malabo."],
    },
  },
  {
    id: "pillars",
    group: "plan",
    icon: Columns3,
    href: "/pillars",
    keywords: ["topics", "matrix", "funnel", "tofu", "mofu", "bofu"],
    en: {
      title: "Content Pillars",
      summary: "The three to five topics you want to be known for.",
      steps: [
        "Keep three to five **Content Pillars** — every idea and post belongs to one.",
        "The **Content Matrix** crosses pillars with formats, so gaps show at a glance.",
        "The **Content Funnel** checks your mix: TOFU reaches new people, MOFU builds trust, BOFU converts.",
      ],
      tips: ["Set your target mix in **Settings → Funnel**."],
    },
    tl: {
      title: "Content Pillars",
      summary: "Ang tatlo hanggang limang topic na gusto mong pagkakilanlan.",
      steps: [
        "Panatilihin ang tatlo hanggang limang **Content Pillars** — bawat idea at post ay may isang pillar.",
        "Pinagtatagpo ng **Content Matrix** ang pillars at formats, kaya kita agad ang kulang.",
        "Tinitingnan ng **Content Funnel** ang mix mo: TOFU para sa bagong audience, MOFU para sa tiwala, BOFU para mag-convert.",
      ],
      tips: ["I-set ang target mix sa **Settings → Funnel**."],
    },
  },

  // ------------------------------------------------------------------ Create
  {
    id: "ideas",
    group: "create",
    icon: Lightbulb,
    href: "/ideas",
    keywords: ["idea bank", "quick capture", "generator", "hooks", "angles", "capture"],
    en: {
      title: "Ideas",
      summary: "Catch every idea, then pick the best ones to make.",
      steps: [
        "Capture with **＋ New → Quick Capture** (**⌥N**). A few words are enough.",
        "Need more? The **Idea Generator** suggests ideas from your pillars and audience.",
        "Look through the **Hook Library** and **Angle Library** for openings and takes that fit.",
        "When an idea is ready, open it and choose **Convert to content** — one post per platform.",
      ],
      tips: ["Install Orbi on an Android phone and share any link or text to it: it lands in Quick Capture."],
    },
    tl: {
      title: "Ideas",
      summary: "Saluhin ang bawat idea, tapos piliin ang pinakamaganda para gawin.",
      steps: [
        "Mag-capture gamit ang **＋ Bago → Quick Capture** (**⌥N**). Sapat na ang ilang salita.",
        "Kulang pa? Magmumungkahi ng ideas ang **Idea Generator** mula sa pillars at audience mo.",
        "Silipin ang **Hook Library** at **Angle Library** para sa panimula at anggulong bagay.",
        "Kapag handa na ang idea, buksan ito at piliin ang **I-convert sa content** — isang post kada platform.",
      ],
      tips: ["I-install ang Orbi sa Android phone at i-share dito ang kahit anong link o text: papasok ito sa Quick Capture."],
    },
  },
  {
    id: "studio",
    group: "create",
    icon: PenLine,
    href: "/studio",
    keywords: ["brief", "script", "content score", "repurpose", "write", "caption"],
    en: {
      title: "Content Studio",
      summary: "Where one post gets planned, written and checked before it goes out.",
      steps: [
        "Open a piece of content from Content Studio, the Pipeline or the Calendar.",
        "Fill the **Content Brief**: the goal, who it's for, the angle and the call to action.",
        "Write the **Script** — or let AI draft it from your brief and voice, then make it yours.",
        "Check the **Content Score** for what to improve.",
        "Did it work? Repurpose it for other platforms from the same page.",
      ],
      tips: ["The Content Score rates quality, not future views.", "Press **⌘S** (Ctrl+S) to save while you write."],
    },
    tl: {
      title: "Content Studio",
      summary: "Dito pinaplano, sinusulat at chine-check ang isang post bago ilabas.",
      steps: [
        "Magbukas ng content mula sa Content Studio, Pipeline o Calendar.",
        "Punuin ang **Content Brief**: ang goal, para kanino, ang anggulo at ang call to action.",
        "Isulat ang **Script** — o hayaang i-draft ito ng AI mula sa brief at voice mo, tapos gawin mong sa'yo.",
        "Tingnan ang **Content Score** para malaman ang pwedeng ayusin.",
        "Gumana ba? I-repurpose ito para sa ibang platform mula sa parehong page.",
      ],
      tips: ["Kalidad ang sinusukat ng Content Score, hindi ang magiging views.", "Pindutin ang **⌘S** (Ctrl+S) para mag-save habang nagsusulat."],
    },
  },
  {
    id: "pipeline",
    group: "create",
    icon: SquareKanban,
    href: "/pipeline",
    keywords: ["board", "kanban", "stages", "production", "workflow"],
    en: {
      title: "Pipeline",
      summary: "A board of every post, from idea to published.",
      steps: [
        "Each card is one post on one platform.",
        "Drag a card to the next stage as you work — Brief, Scripting, Recording, Editing, Review and on. On a phone, use the card's menu.",
        "Give it a date and move it to **Scheduled** — it appears on the Calendar.",
        "Move it to **Published** when it's live, then log its numbers.",
      ],
      tips: ["Cards that sit in one stage for days are your bottleneck — clear those first."],
    },
    tl: {
      title: "Pipeline",
      summary: "Board ng bawat post, mula idea hanggang published.",
      steps: [
        "Bawat card ay isang post sa isang platform.",
        "I-drag ang card sa susunod na stage habang gumagawa ka — Brief, Scripting, Recording, Editing, Review at iba pa. Sa phone, gamitin ang menu ng card.",
        "Bigyan ito ng petsa at ilipat sa **Scheduled** — lalabas ito sa Calendar.",
        "Ilipat sa **Published** kapag live na, tapos i-log ang numbers nito.",
      ],
      tips: ["Ang card na ilang araw nang nakatengga sa isang stage ang bottleneck mo — unahin ang mga 'yon."],
    },
  },
  {
    id: "calendar",
    group: "create",
    icon: CalendarDays,
    href: "/calendar",
    keywords: ["schedule", "posting schedule", "weekly planner", "slots", "buffer", "plan"],
    en: {
      title: "Calendar",
      summary: "What goes out when — plus your weekly posting rhythm.",
      steps: [
        "Set your weekly slots in **Posting Schedule** — for example, Tuesday and Friday on TikTok.",
        "Each week, fill the slots in the **Weekly Planner**.",
        "The **Calendar** shows every post by date: published, scheduled and due.",
      ],
      tips: ["The **Content Buffer** counts the ready posts you have ahead. Set what counts as healthy in **Settings → Performance**."],
    },
    tl: {
      title: "Calendar",
      summary: "Kung ano ang lalabas at kailan — pati ang lingguhang ritmo ng pagpo-post mo.",
      steps: [
        "I-set ang lingguhang slots mo sa **Posting Schedule** — halimbawa, Martes at Biyernes sa TikTok.",
        "Kada linggo, punuin ang slots sa **Weekly Planner**.",
        "Ipinapakita ng **Calendar** ang bawat post ayon sa petsa: published, scheduled at due.",
      ],
      tips: ["Binibilang ng **Content Buffer** ang mga handang post mo sa unahan. I-set kung ilan ang healthy sa **Settings → Performance**."],
    },
  },

  // ------------------------------------------------------------------ Grow
  {
    id: "collabs",
    group: "grow",
    icon: Blend,
    href: "/collabs",
    keywords: ["collab tracker", "collab lift", "partner", "creator", "duet", "guest"],
    en: {
      title: "Collab tracker",
      summary: "Track collaborations with other creators and see whether they paid off.",
      steps: [
        "Add one with **＋ New → New collab**.",
        "Move it along as it happens: idea, reached out, agreed, scheduled, published, reviewed.",
        "Link the posts you made for it — its results come from their numbers.",
        "**Collab lift** compares your collab posts with your solo posts on the same platform.",
      ],
      tips: ["Collab lift needs at least 3 collab posts and 5 solo posts with numbers."],
    },
    tl: {
      title: "Collab tracker",
      summary: "I-track ang collabs mo sa ibang creators at alamin kung sulit.",
      steps: [
        "Magdagdag gamit ang **＋ Bago → Bagong collab**.",
        "I-update habang umuusad: idea, na-message na, pumayag, naka-schedule, published, na-review.",
        "I-link ang mga post na ginawa mo para dito — galing sa numbers nila ang resulta.",
        "Kinukumpara ng **Collab lift** ang collab posts mo sa solo posts mo sa parehong platform.",
      ],
      tips: ["Kailangan ng Collab lift ng kahit 3 collab posts at 5 solo posts na may numbers."],
    },
  },
  {
    id: "circles",
    group: "grow",
    icon: UsersRound,
    href: "/circles",
    online: true,
    keywords: ["collab circles", "group", "check-in", "streak", "accountability"],
    en: {
      title: "Collab Circles",
      summary: "A small group of 3–8 creators who keep each other posting.",
      steps: [
        "**Create a circle** and send its invite link to creators you trust.",
        "Check in once a week — your post count is filled in from your workspace, and you can change it.",
        "Keep your streak: every week with at least one post counts.",
        "Need a partner? Post a collab ask. Accept someone's interest to swap contacts.",
      ],
      tips: ["Nothing leaves your workspace unless you submit it."],
    },
    tl: {
      title: "Collab Circles",
      summary: "Maliit na grupo ng 3–8 creators na nagtutulungang tuloy-tuloy mag-post.",
      steps: [
        "Pindutin ang **Gumawa ng circle** at ipadala ang invite link sa mga creator na pinagkakatiwalaan mo.",
        "Mag-check-in isang beses kada linggo — naka-fill na ang bilang ng posts mula sa workspace mo, at pwede mo itong baguhin.",
        "Panatilihin ang streak mo: bawat linggong may kahit isang post ay bilang.",
        "Kailangan ng ka-collab? Mag-post ng collab ask. I-accept ang interest ng iba para magpalitan ng contact.",
      ],
      tips: ["Walang lalabas sa workspace mo maliban sa isa-submit mo."],
    },
  },
  {
    id: "campaigns",
    group: "grow",
    icon: Megaphone,
    href: "/campaigns",
    keywords: ["launch", "promo", "challenge", "push"],
    en: {
      title: "Campaigns",
      summary: "Group posts around one push — a launch, a promo, a challenge.",
      steps: [
        "Create a **Campaign** with a goal and dates.",
        "Link the posts that belong to it.",
        "Open the campaign to see how the whole push did, not just one post.",
      ],
    },
    tl: {
      title: "Campaigns",
      summary: "Pagsamahin ang mga post para sa isang push — launch, promo o challenge.",
      steps: [
        "Gumawa ng **Campaign** na may goal at mga petsa.",
        "I-link ang mga post na kasama dito.",
        "Buksan ang campaign para makita kung kumusta ang buong push, hindi lang ang isang post.",
      ],
    },
  },
  {
    id: "series",
    group: "grow",
    icon: Repeat,
    href: "/series",
    keywords: ["recurring", "weekly", "format", "segment"],
    en: {
      title: "Series",
      summary: "A format you repeat, like a weekly tip or a monthly Q&A.",
      steps: [
        "Create a **Series** with its format and how often it runs.",
        "Add each episode as a post, so the series keeps count.",
        "Compare episodes to learn what makes the series work.",
      ],
    },
    tl: {
      title: "Series",
      summary: "Format na inuulit, gaya ng weekly tip o monthly Q&A.",
      steps: [
        "Gumawa ng **Series** kasama ang format at kung gaano kadalas ito.",
        "Idagdag ang bawat episode bilang post, para bilang ng series.",
        "Ikumpara ang mga episode para malaman kung ano ang nagpapagana sa series.",
      ],
    },
  },
  {
    id: "stories",
    group: "grow",
    icon: BookOpen,
    href: "/stories",
    keywords: ["story vault", "experience", "lessons", "personal", "kwento"],
    en: {
      title: "Story Vault",
      summary: "Your experiences and lessons — the content only you can make.",
      steps: [
        "Save stories as they happen: a win, a mistake, a client moment.",
        "Use **Experience → Content** to turn one into post ideas.",
        "Your saved stories make AI drafts more personal.",
      ],
    },
    tl: {
      title: "Story Vault",
      summary: "Ang mga karanasan at aral mo — content na ikaw lang ang makakagawa.",
      steps: [
        "I-save ang mga kwento habang nangyayari: panalo, pagkakamali, sandali kasama ang client.",
        "Gamitin ang **Experience → Content** para gawing post ideas ang isang kwento.",
        "Mas nagiging personal ang AI drafts dahil sa mga kwentong naka-save.",
      ],
    },
  },
  {
    id: "research",
    group: "grow",
    icon: Library,
    href: "/research",
    keywords: ["research library", "inspiration", "reference", "swipe file"],
    en: {
      title: "Research",
      summary: "Save references and learn from them — without copying.",
      steps: [
        "Save posts, videos and articles you want to learn from in the **Research Library**.",
        "**Inspiration → Original** breaks one down — structure, angle, hook — and helps you make your own version.",
      ],
      tips: ["It never copies the original; it shows why it worked."],
    },
    tl: {
      title: "Research",
      summary: "Mag-save ng references at matuto mula sa kanila — nang hindi nangongopya.",
      steps: [
        "I-save sa **Research Library** ang posts, videos at articles na gusto mong pag-aralan.",
        "Hinihimay ng **Inspiration → Original** ang isang reference — structure, anggulo, hook — at tinutulungan kang gumawa ng sarili mong version.",
      ],
      tips: ["Hindi nito kinokopya ang original; ipinapakita lang nito kung bakit gumana."],
    },
  },

  // ------------------------------------------------------------------ Measure
  {
    id: "analytics",
    group: "measure",
    icon: ChartColumn,
    href: "/analytics",
    keywords: ["numbers", "metrics", "views", "log", "csv", "import", "insights"],
    en: {
      title: "Analytics",
      summary: "Log your numbers so Orbi can tell what's working.",
      steps: [
        "When a post has been live a day or two, choose **＋ New → Add analytics** and enter its numbers.",
        "Posted something without Orbi? Add it first with **＋ New → Log a post**.",
        "Have an export from the platform? **Settings → Integrations → Import a CSV**.",
        "**Analytics** shows your trends; **Post Performance** compares posts.",
      ],
      tips: ["Log again later — Orbi keeps every snapshot and uses the latest."],
    },
    tl: {
      title: "Analytics",
      summary: "I-log ang numbers mo para malaman ng Orbi kung ano ang gumagana.",
      steps: [
        "Kapag isa o dalawang araw nang live ang post, piliin ang **＋ Bago → Magdagdag ng analytics** at ilagay ang numbers nito.",
        "Nag-post nang hindi dumaan sa Orbi? Idagdag muna gamit ang **＋ Bago → I-log ang post**.",
        "May export ka mula sa platform? **Settings → Integrations → Mag-import ng CSV**.",
        "Nasa **Analytics** ang trends mo; kinukumpara ng **Post Performance** ang mga post.",
      ],
      tips: ["Pwedeng mag-log ulit mamaya — itinatabi ng Orbi ang bawat snapshot at ang pinakabago ang ginagamit."],
    },
  },
  {
    id: "winners",
    group: "measure",
    icon: Trophy,
    href: "/winners",
    keywords: ["winner detection", "breakout", "best posts", "winning content library", "viral"],
    en: {
      title: "Winners",
      summary: "Your best posts, spotted for you — and why they worked.",
      steps: [
        "Every post with numbers gets a tier: Normal, Good, Winner or Breakout.",
        "A Winner does about double your platform average; a Breakout, three times or more.",
        "Open a Winner, note why it worked, and turn it into new content.",
      ],
      tips: ["Change how posts are compared in **Settings → Performance**."],
    },
    tl: {
      title: "Winners",
      summary: "Ang pinakamagagaling mong post, hinanap para sa'yo — at kung bakit sila gumana.",
      steps: [
        "Bawat post na may numbers ay may tier: Normal, Good, Winner o Breakout.",
        "Ang Winner ay mga doble ng average mo sa platform; ang Breakout, tatlong beses o higit pa.",
        "Buksan ang isang Winner, isulat kung bakit ito gumana, at gawing bagong content.",
      ],
      tips: ["Baguhin kung paano kinukumpara ang mga post sa **Settings → Performance**."],
    },
  },
  {
    id: "reports",
    group: "measure",
    icon: FileText,
    href: "/reports",
    keywords: ["weekly report", "monthly review", "review", "summary"],
    en: {
      title: "Reports",
      summary: "A weekly and a monthly look back, with what to do next.",
      steps: [
        "The **Weekly Report** sums up your week: what you posted, what worked and what to try.",
        "The **Monthly Review** zooms out to trends, pillars and goals.",
        "Read it, then plan next week in the **Weekly Planner**.",
      ],
    },
    tl: {
      title: "Reports",
      summary: "Lingguhan at buwanang pagbabalik-tanaw, kasama ang susunod na gagawin.",
      steps: [
        "Binubuod ng **Weekly Report** ang linggo mo: ano ang na-post, ano ang gumana at ano ang susubukan.",
        "Mas malawak ang tingin ng **Monthly Review**: trends, pillars at goals.",
        "Basahin, tapos i-plan ang susunod na linggo sa **Weekly Planner**.",
      ],
    },
  },
  {
    id: "experiments",
    group: "measure",
    icon: FlaskConical,
    href: "/experiments",
    keywords: ["test", "a/b", "hypothesis", "try"],
    en: {
      title: "Experiments",
      summary: "Test one change at a time and let the numbers decide.",
      steps: [
        "Write what you'll change and what you expect — for example, shorter hooks get more views.",
        "Link the posts that are part of the test.",
        "Log their numbers, then record what you learned.",
      ],
    },
    tl: {
      title: "Experiments",
      summary: "Sumubok ng isang pagbabago kada beses at hayaang numbers ang magdesisyon.",
      steps: [
        "Isulat kung ano ang babaguhin mo at ano ang inaasahan mo — halimbawa, mas maraming views sa mas maikling hook.",
        "I-link ang mga post na kasama sa test.",
        "I-log ang numbers nila, tapos isulat ang natutunan mo.",
      ],
    },
  },

  // ------------------------------------------------------------------ Money
  {
    id: "money",
    group: "money",
    icon: Wallet,
    href: "/money",
    keywords: ["brand deals", "income", "media kit", "rate card", "sponsor", "kita"],
    en: {
      title: "Money",
      summary: "Brand deals, income and a media kit to send to brands.",
      steps: [
        "Track each **Brand Deal** from lead to paid.",
        "Record **Income** — received or expected — from deals, affiliates and more.",
        "Build your **Media Kit** with your numbers and rate cards, then **Print / Save as PDF** to send it.",
      ],
      tips: ["Totals stay per currency — ₱ and $ are never added together."],
    },
    tl: {
      title: "Money",
      summary: "Brand deals, kita at media kit na ipapadala sa brands.",
      steps: [
        "I-track ang bawat **Brand Deal** mula lead hanggang bayad.",
        "I-record ang **Income** — natanggap na o inaasahan pa — mula sa deals, affiliates at iba pa.",
        "Buuin ang **Media Kit** mo kasama ang numbers at rate cards, tapos **I-print / I-save as PDF** para ipadala.",
      ],
      tips: ["Hiwalay ang totals kada currency — hindi kailanman pinagsasama ang ₱ at $."],
    },
  },

  // ------------------------------------------------------------------ Settings & account
  {
    id: "settings",
    group: "account",
    icon: Settings,
    href: "/settings",
    keywords: ["language", "taglish", "english", "simple mode", "reminders", "backup", "export"],
    en: {
      title: "Settings",
      summary: "Language, the sidebar, your targets, reminders and backups.",
      steps: [
        "**General**: switch the **App language** between English and Taglish, and turn Simple mode on or off.",
        "**Performance** and **Funnel**: how Winners are judged and your target content mix.",
        "**Reminders**: nudges to post, to show up for your slots and to review your week.",
        "**Data**: **Export workspace** saves a backup file.",
      ],
    },
    tl: {
      title: "Settings",
      summary: "Language, sidebar, targets, reminders at backups.",
      steps: [
        "**General**: palitan ang **App language** — English o Taglish — at i-on o i-off ang Simple mode.",
        "**Performance** at **Funnel**: kung paano hinuhusgahan ang Winners at ang target content mix mo.",
        "**Reminders**: paalala na mag-post, na huwag lagpasan ang slots mo at na mag-review ng linggo.",
        "**Data**: ang **I-export ang workspace** ay nagse-save ng backup file.",
      ],
    },
  },
  {
    id: "team",
    group: "account",
    icon: UserPlus,
    href: "/settings?tab=team",
    online: true,
    keywords: ["team workspace", "va", "editor", "viewer", "manager", "invite", "money access"],
    en: {
      title: "Team workspace",
      summary: "Invite a VA, editor, manager or client into your workspace.",
      steps: [
        "Open **Settings → Team** and invite them by email as an Editor or a Viewer.",
        "Editors work on content; Viewers can only look. Only you change Brand HQ, audience and pillars.",
        "Money stays hidden until you turn on **Money access** for that person.",
        "They need an Orbi account first — send them the Request access page.",
      ],
      tips: ["Up to 5 members during the beta."],
    },
    tl: {
      title: "Team workspace",
      summary: "I-invite ang VA, editor, manager o client sa workspace mo.",
      steps: [
        "Buksan ang **Settings → Team** at i-invite sila gamit ang email bilang Editor o Viewer.",
        "Gumagawa ng content ang Editors; tumitingin lang ang Viewers. Ikaw lang ang nagbabago ng Brand HQ, audience at pillars.",
        "Nakatago ang Money hangga't hindi mo ino-on ang **Money access** para sa taong 'yon.",
        "Kailangan muna nila ng Orbi account — ipadala sa kanila ang Request access page.",
      ],
      tips: ["Hanggang 5 members habang beta."],
    },
  },
  {
    id: "ai",
    group: "account",
    icon: Sparkles,
    href: "/strategist",
    keywords: ["content strategist", "claude", "openai", "chatgpt", "gemini", "api key", "own key", "generate", "offline templates", "chat"],
    en: {
      title: "AI in Orbi",
      summary: "Idea Generator, script drafts and the Content Strategist — written from your brand, with your own AI key.",
      steps: [
        "Connect your own AI in **Settings → AI**: choose Claude, OpenAI or Gemini, paste your API key and choose **Save and test**. Gemini has a free tier.",
        "AI reads your Brand HQ, audience, pillars, stories and past winners — the more you fill in, the more it sounds like you.",
        "Ask the **Content Strategist** anything about your content: **⌘J** (Ctrl+J).",
        "Each result names the engine that wrote it — your Claude, OpenAI or Gemini, or Offline templates (built in, no AI service).",
        "Edit every draft into your own words before you post.",
      ],
      tips: ["The provider bills your own account for what you use. Orbi never charges for AI, and your key is never shown again."],
    },
    tl: {
      title: "AI sa Orbi",
      summary: "Idea Generator, script drafts at Content Strategist — isinulat mula sa brand mo, gamit ang sarili mong AI key.",
      steps: [
        "Ikonekta ang sarili mong AI sa **Settings → AI**: piliin ang Claude, OpenAI o Gemini, i-paste ang API key mo at piliin ang **I-save at i-test**. May libreng tier ang Gemini.",
        "Binabasa ng AI ang Brand HQ, audience, pillars, stories at dating winners mo — habang mas kumpleto, mas tunog-ikaw.",
        "Itanong sa **Content Strategist** ang kahit ano tungkol sa content mo: **⌘J** (Ctrl+J).",
        "Nakasulat sa bawat resulta kung aling engine ang gumawa — ang Claude, OpenAI o Gemini mo, o Offline templates (built-in, walang AI service).",
        "I-edit ang bawat draft sa sarili mong salita bago i-post.",
      ],
      tips: ["Sa sarili mong account naniningil ang provider para sa gagamitin mo. Hindi naniningil ang Orbi para sa AI, at hindi na ipapakita ulit ang key mo."],
    },
  },
  {
    id: "phone",
    group: "account",
    icon: Smartphone,
    keywords: ["install", "app", "mobile", "iphone", "android", "home screen", "share"],
    en: {
      title: "Orbi on your phone",
      summary: "Install Orbi like an app and capture ideas on the go.",
      steps: [
        "Open the account menu (your photo, top right) and choose **Install Orbi**. On an iPhone it shows the Safari steps.",
        "On Android, share a link or text from any app to Orbi — it lands in Quick Capture.",
        "The bottom bar has Home, Today, ＋, Calendar and More.",
      ],
    },
    tl: {
      title: "Orbi sa phone mo",
      summary: "I-install ang Orbi na parang app at mag-capture ng ideas kahit saan.",
      steps: [
        "Buksan ang account menu (ang photo mo sa kanang itaas) at piliin ang **I-install ang Orbi**. Sa iPhone, ipapakita nito ang steps sa Safari.",
        "Sa Android, i-share ang link o text mula sa kahit anong app papunta sa Orbi — papasok ito sa Quick Capture.",
        "Nasa bottom bar ang Home, Today, ＋, Calendar at More.",
      ],
    },
  },
  {
    id: "privacy",
    group: "account",
    icon: ShieldCheck,
    href: "/privacy",
    keywords: ["private", "data", "who can see", "admin", "security", "delete"],
    en: {
      title: "Privacy & your data",
      summary: "Your content is yours. Here's who can see what.",
      steps: [
        "Only you — and the people you invite into your workspace — see your content.",
        "Admins see account details and counts, never your ideas, scripts or money.",
        "Keep a copy anytime: **Settings → Data → Export workspace**.",
      ],
    },
    tl: {
      title: "Privacy at ang data mo",
      summary: "Sa'yo ang content mo. Ito kung sino ang nakakakita ng ano.",
      steps: [
        "Ikaw lang — at ang mga ini-invite mo sa workspace mo — ang nakakakita ng content mo.",
        "Account details at bilang lang ang nakikita ng admins, hindi kailanman ang ideas, scripts o pera mo.",
        "Mag-save ng kopya anytime: **Settings → Data → I-export ang workspace**.",
      ],
    },
  },
  {
    id: "shortcuts",
    group: "account",
    icon: Keyboard,
    keywords: ["keyboard", "hotkeys", "cmd", "ctrl", "faster"],
    en: {
      title: "Keyboard shortcuts",
      summary: "Move faster on a computer.",
      steps: [
        "**⌘K** (Ctrl+K) — search and jump anywhere.",
        "**/** — open search when you're not typing.",
        "**⌥N** (Alt+N) — Quick Capture.",
        "**⌘J** (Ctrl+J) — Content Strategist.",
        "**⌘S** (Ctrl+S) — save in Content Studio.",
        "**⌘↵** (Ctrl+Enter) — save or send in many forms.",
      ],
    },
    tl: {
      title: "Keyboard shortcuts",
      summary: "Mas mabilis na paggamit sa computer.",
      steps: [
        "**⌘K** (Ctrl+K) — mag-search at tumalon kahit saan.",
        "**/** — buksan ang search kapag hindi ka nagta-type.",
        "**⌥N** (Alt+N) — Quick Capture.",
        "**⌘J** (Ctrl+J) — Content Strategist.",
        "**⌘S** (Ctrl+S) — mag-save sa Content Studio.",
        "**⌘↵** (Ctrl+Enter) — mag-save o mag-send sa maraming form.",
      ],
    },
  },

  // ------------------------------------------------------------------ Common questions
  {
    id: "faq-sidebar",
    group: "faq",
    icon: CircleHelp,
    keywords: ["simple mode", "missing", "hidden", "modules", "nawawala"],
    en: {
      title: "Why don't I see every module in the sidebar?",
      summary: "Simple mode shows only the everyday modules. Choose **Show all modules** at the bottom of the sidebar, or turn it off in **Settings → General**. ⌘K reaches every page either way.",
    },
    tl: {
      title: "Bakit hindi ko makita lahat ng modules sa sidebar?",
      summary: "Ang pang-araw-araw na modules lang ang ipinapakita ng Simple mode. Piliin ang **Ipakita lahat ng modules** sa ibaba ng sidebar, o i-off ito sa **Settings → General**. Naaabot pa rin ng ⌘K ang lahat ng page.",
    },
  },
  {
    id: "faq-score",
    group: "faq",
    icon: CircleHelp,
    keywords: ["content score", "viral", "prediction", "views"],
    en: {
      title: "Does the Content Score predict views?",
      summary: "No. It rates how well the post is built for its goal — not how many people will see it.",
    },
    tl: {
      title: "Hinuhulaan ba ng Content Score ang views?",
      summary: "Hindi. Sinusukat nito kung gaano kaayos ang pagkakagawa ng post para sa goal nito — hindi kung ilan ang makakakita.",
    },
  },
  {
    id: "faq-offline",
    group: "faq",
    icon: CircleHelp,
    keywords: ["offline templates", "ai", "claude", "engine"],
    en: {
      title: "What does “Offline templates” mean?",
      summary: "That result came from Orbi's built-in templates, because no AI key is connected yet. It still uses your brand, but it's simpler. Add your own Claude, OpenAI or Gemini key in **Settings → AI** for AI-written drafts.",
    },
    tl: {
      title: "Ano ang ibig sabihin ng “Offline templates”?",
      summary: "Galing ang resultang 'yon sa built-in templates ng Orbi, dahil wala pang nakakonektang AI key. Ginagamit pa rin nito ang brand mo, pero mas simple. Ilagay ang sarili mong Claude, OpenAI o Gemini key sa **Settings → AI** para AI ang magsulat ng drafts.",
    },
  },
  {
    id: "faq-language",
    group: "faq",
    icon: CircleHelp,
    keywords: ["language", "taglish", "english", "tagalog", "wika"],
    en: {
      title: "How do I switch to Taglish or English?",
      summary: "**Settings → General → App language**. It changes the screens. AI drafts follow the language set in Brand HQ.",
    },
    tl: {
      title: "Paano lumipat sa Taglish o English?",
      summary: "**Settings → General → App language**. Binabago nito ang mga screen. Ang AI drafts ay sumusunod sa language na naka-set sa Brand HQ.",
    },
  },
  {
    id: "faq-backup",
    group: "faq",
    icon: CircleHelp,
    keywords: ["backup", "export", "save", "lose", "file"],
    en: {
      title: "How do I back up my work?",
      summary: "**Settings → Data → Export workspace** saves everything to a file. When you're signed in, your workspace is also saved to your account; the file is an extra copy.",
    },
    tl: {
      title: "Paano mag-backup ng gawa ko?",
      summary: "**Settings → Data → I-export ang workspace** — naise-save lahat sa isang file. Kapag naka-sign in ka, naka-save din ang workspace sa account mo; dagdag na kopya ang file.",
    },
  },
  {
    id: "faq-delete",
    group: "faq",
    icon: CircleHelp,
    online: true,
    keywords: ["delete account", "remove", "close account", "burahin"],
    en: {
      title: "How do I delete my account?",
      summary: "Ask with **Send feedback** in the account menu, or write to the contact on the Privacy page. Your workspace and profile are deleted for good.",
    },
    tl: {
      title: "Paano i-delete ang account ko?",
      summary: "Humiling gamit ang **Magpadala ng feedback** sa account menu, o sumulat sa contact sa Privacy page. Permanenteng mabubura ang workspace at profile mo.",
    },
  },
  {
    id: "faq-join",
    group: "faq",
    icon: CircleHelp,
    online: true,
    keywords: ["friend", "join", "sign up", "invite", "request access", "waitlist"],
    en: {
      title: "How can a friend join Orbi?",
      summary: "They request access on the sign-in page. Once an admin approves it, they get an email to set a password.",
    },
    tl: {
      title: "Paano makakasali ang kaibigan ko sa Orbi?",
      summary: "Magre-request sila ng access sa sign-in page. Kapag na-approve ng admin, makakatanggap sila ng email para mag-set ng password.",
    },
  },
]

/** Pages a guide may link to that aren't in the navigation. */
const OTHER_PAGES: Record<string, string> = { "/privacy": "Privacy notice", "/terms": "Terms of Use" }

/** The name of the page a guide links to ("Brand HQ", "Settings"), for its "Open …" button; null if unknown. */
export function helpPageTitle(href: string, pages: readonly { title: string; href: string }[]): string | null {
  const path = href.split(/[?#]/)[0]
  return pages.find((page) => page.href === path)?.title ?? OTHER_PAGES[path] ?? null
}

/** How many guides ⌘K lists for a search, under its "Help" group. */
export const HELP_TOPICS_PER_SEARCH = 3

/** The topic's text in a language. */
export function helpText(topic: HelpTopic, lang: UiLang): HelpText {
  return topic[lang]
}

/** Lower-cased, accents dropped, so "Pag-post" finds "pag-post" and "é" finds "e". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\*\*/g, "").toLowerCase()
}

function haystack(topic: HelpTopic): string {
  const parts = [topic.en, topic.tl].flatMap((t) => [t.title, t.summary, ...(t.steps ?? []), ...(t.tips ?? [])])
  return fold([...parts, ...(topic.keywords ?? [])].join(" \n "))
}

const HAYSTACKS = new Map(HELP_TOPICS.map((topic) => [topic.id, haystack(topic)]))

/**
 * Topics matching every word of the query, in either language (a Taglish reader may type an English word, and
 * the other way round). Titles that match rank first; an empty query returns every topic in order.
 */
export function searchHelp(query: string, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return topics
  const matches = topics.filter((topic) => {
    const text = HAYSTACKS.get(topic.id) ?? haystack(topic)
    return words.every((word) => text.includes(word))
  })
  const inTitle = (topic: HelpTopic) => words.every((word) => fold(`${topic.en.title} ${topic.tl.title}`).includes(word))
  return [...matches.filter(inTitle), ...matches.filter((topic) => !inTitle(topic))]
}
