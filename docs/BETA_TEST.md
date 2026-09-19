# Orbi beta test — 3 to 5 Filipino creators

A two-week, invite-only beta of the **online version** with 3–5 Filipino creators. The goal is to
learn whether creators can set Orbi up on their own, whether they come back, what confuses them,
and whether they would pay. Five people are enough to find most usability problems. Read the
numbers as signals, not statistics, and always pair them with what you saw and heard.

- **In-app tools:** **Send feedback** in the account menu (the avatar at the top right) and **opt-in usage analytics**. Both
  exist only in the online version; details in [How the beta tools work](#how-the-beta-tools-work).
- **Data:** `public.feedback` and `public.usage_events`, created by
  `supabase/migrations/20260914000100_beta.sql`.

---

## 1. What we want to learn

| Question | How we'll know |
|---|---|
| Can a creator finish setup (Niche Discovery → strategy) alone? | Observed session + onboarding funnel |
| Which step or screen confuses people? | Think-aloud notes, "Confusing" feedback, funnel drop-off |
| Do they build a habit (capture → create → publish → measure)? | Active days, key actions per tester |
| Does the Taglish feel natural? | Interview + language split |
| Would they pay, and how much? | Exit interview |

## 2. Who to invite

3–5 creators who post at least weekly. Mix them:

- **Platforms:** at least one each for TikTok, Facebook/Instagram and YouTube.
- **Size:** from about 1k to 100k followers. Include at least one who already does brand deals.
- **Language:** at least two who write in Taglish.
- **Devices:** mostly Android phones (that's the audience), plus one laptop user.

Offer a thank-you: early free access, or a small GCash token. Say upfront that it's a test of
the app, not of them.

---

## 3. Setup — online version, invite-only

Do this 2–3 days before the first session.

1. **Deploy the online version** by following [DEPLOY.md](DEPLOY.md): Supabase project
   (Singapore region), Vercel, environment variables.
2. **Run every migration**, including `20260914000100_beta.sql`, which creates `feedback` and
   `usage_events` with row-level security.
3. **Make it invite-only.** In Supabase → **Authentication → Sign In / Providers → Email**, turn
   off **Allow new users to sign up**. With this off, "only existing users can sign in". [1]
   Turn off sign-ups for any other provider you enabled too. [2]
4. **Add each tester** in **Authentication → Users → Add user**. Menu labels can differ slightly
   between dashboard versions. Either:
   - **Send invitation** — Supabase emails a link that signs them in and opens Orbi's
     **Set a password** page, once you've switched the invite email template as described in
     [DEPLOY.md](DEPLOY.md) step 5. They choose a password there; later they can also use
     **"Email me a sign-in link"** on the login page. Or:
   - **Create new user** — their email plus a temporary password, with **Auto Confirm User**
     ticked. Send the password privately (Messenger or Viber, never a group chat). They can
     also use the emailed sign-in link.

   Existing accounts can still get a sign-in link with sign-ups off; unknown emails can't create
   accounts.
5. **Smoke-test it yourself** with a spare account:
   - Sign in and finish setup.
   - Open **Feedback**, send "test", and check that it appears in **Table Editor → feedback**.
   - Turn on **Share anonymous usage data** in the same dialog, open two pages, wait 10 seconds,
     and check **Table Editor → usage_events**.
6. **Prepare** a consent message (below), an observation sheet (section 6), and a video-call
   link with screen sharing (Google Meet or Zoom). Testers share their **phone** screen.

### Consent script (read or send before the first session)

> Thanks for testing Orbi! A few things before we start:
> - I'll watch your screen and take notes. With your OK, I'll record the call. Recordings are only
>   for me and are deleted after the beta.
> - Anything you type in Orbi (ideas, posts, notes) is stored in your own account. Other testers
>   can't see it. As the owner of the test project I *can* see it in the database, but I will only
>   look at it with your permission.
> - The **Feedback** button sends me your message, the page you were on, your app language, your
>   screen size and your browser.
> - **Usage sharing is off unless you turn it on** (Feedback → "Share anonymous usage data"). If
>   you turn it on, Orbi sends which pages and setup steps you use and counts of key actions
>   (ideas captured, content created, posts published, analytics logged). It never sends your
>   ideas, captions or anything you type. You can turn it off anytime, per device.
> - You can stop at any time, and I'll delete your account and data when you ask.

Handle this in line with the Philippine **Data Privacy Act of 2012 (RA 10173)**: be clear about
what you collect and why, collect only what the test needs, and delete it when you're done. [3][4]

> **Known limit — usage sharing during first setup.** The opt-in switch lives in the Feedback
> dialog (account menu → Send feedback). First-time users only reach the top bar *after* setup, so the onboarding
> funnel only captures testers who opted in earlier on that device. Until the switch is also on
> the setup Welcome step (requested from the lead), watch setup live in session 1. That's the
> richer signal anyway.

---

## 4. Timeline (about 3 weeks)

| When | What | Time per tester |
|---|---|---|
| Days −3 to −1 | Deploy, create accounts, pilot the session with one friend, fix blockers | — |
| **Day 1** | **Session 1 (moderated, 60 min):** consent → tasks 1–4 → first-impression questions. Ask them to turn on usage sharing afterwards. | 60 min |
| Days 2–10 | Normal use on their own. Nudge on days 3 and 7 ("Anything confusing? Use the Feedback button 🙏"). Read feedback daily. | ~10 min/day |
| **Day 7** | Check-in call (15 min): what they used, what they skipped | 15 min |
| **Days 11–14** | **Session 2 (moderated, 45 min):** tasks 5–8 → exit interview | 45 min |
| Week 3 | Synthesis, prioritise the top fixes, share back what you changed | — |

---

## 5. Tasks to observe

Give one task at a time, in plain words, without naming the button. Ask them to think aloud:
"Say what you're looking for and what you expect." In Taglish: *"Sabihin mo lang habang ginagawa
mo kung ano ang hinahanap mo at ano ang inaasahan mo."*

| # | Task (what you say) | Success looks like | Watch for |
|---|---|---|---|
| 1 | "Sign in and set Orbi up for your content." | Finishes setup without help in ≤ 20 min | Which step stalls; English vs Taglish choice; reaction to AI suggestions; waiting on generation |
| 2 | "You just thought of a content idea. Save it." (Then twice more, once from the phone's home screen.) | Finds Quick Capture in ≤ 30 s | Top-bar Capture vs Today; Android share-to-Orbi |
| 3 | "Turn one of your ideas into a post and write it." | Opens it in Content Studio and writes a brief or script | Understands the pipeline stages? |
| 4 | "Plan when you'll post it this week." | Schedules it; sees it on the Calendar and in Today | Posting schedule confusion |
| 5 | "You posted it. Record how it did." | Logs a published post and its numbers, by hand or with a Meta Business Suite / TikTok Studio CSV | Where they get their numbers; CSV import |
| 6 | "A brand wants to pay you for a post. Track it." | Adds a brand deal; logs the income when paid; opens the Media Kit | Money terms; peso formatting |
| 7 | "Tell the Orbi team something." | Sends feedback with the Feedback button | Do they notice the button? |
| 8 | "Put Orbi on your phone's home screen." | Installs it (Android prompt or iPhone Add to Home Screen) | Install friction |

After each task, ask: **"How easy was that, from 1 (very hard) to 7 (very easy)?"** In Taglish:
*"Gaano kadali 'yon, 1 (sobrang hirap) hanggang 7 (sobrang dali)?"*

**Observation sheet columns:** tester · task · done (yes / with help / no) · time · path taken ·
errors · quotes · ease 1–7 · severity (blocker / major / minor / cosmetic).

---

## 6. Interview questions (English · Taglish)

**Before using Orbi (session 1)**

1. How do you plan your content today? Walk me through last week.
   *Paano mo pinaplano ang content mo ngayon? Ikuwento mo 'yung nakaraang linggo.*
2. What's the hardest part of posting consistently?
   *Ano ang pinakamahirap sa pag-post nang consistent?*
3. What tools do you use now (Notes, Google Sheets, Canva, Meta Business Suite…)? Do you pay for any?
   *Anong tools ang gamit mo ngayon? May binabayaran ka ba?*

**Right after setup (session 1)**

4. In your own words, what is Orbi for?
   *Sa sarili mong salita, para saan ang Orbi?*
5. Was there a moment you felt lost or unsure what to do next? Where?
   *May part ba na naligaw ka o hindi mo alam ang susunod na gagawin? Saan?*
6. Did the niche and strategy suggestions sound like *you*?
   *Ramdam mo bang ikaw talaga 'yung mga niche at strategy suggestions?*
7. English or Taglish — which did you pick, and does it sound natural?
   *English o Taglish — alin ang pinili mo, at natural ba pakinggan?*

**Exit interview (session 2)**

8. What did you use most? What did you never open?
   *Ano ang pinakaginamit mo? Ano ang hindi mo nabuksan?*
9. Did Orbi change what you posted or when? Give me an example.
   *May nabago ba ang Orbi sa pino-post mo o kung kailan ka nagpo-post? Bigyan mo ako ng halimbawa.*
10. If Orbi disappeared tomorrow, what would you miss?
    *Kung mawala bukas ang Orbi, ano ang mami-miss mo?*
11. How likely are you to recommend Orbi to a creator friend, from 0 to 10? Why?
    *Mula 0 hanggang 10, gaano mo kagustong i-recommend ang Orbi sa kaibigang creator? Bakit?*
12. Would you pay for Orbi? How much per month feels fair, in pesos?
    *Magbabayad ka ba para sa Orbi? Magkano kada buwan ang sulit para sa'yo?*
13. Is there anything about your data or privacy that worries you?
    *May nag-aalala ka ba tungkol sa data o privacy mo?*

Follow-ups that work in both languages: "Why?" / *"Bakit?"* · "Show me." / *"Pakita mo nga."* ·
"What did you expect to happen?" / *"Ano ang inaasahan mong mangyari?"*

---

## 7. What to measure

| Metric | Definition | Source | Beta target |
|---|---|---|---|
| Setup completion | Testers who finish first-run setup | Observation; `onboarding_completed` with `mode = first` | 4 of 5 |
| Time to set up | Welcome → finished | Observation (events if opted in) | ≤ 20 min |
| Step drop-off | Viewed vs completed per step | Funnel query (8.3) | No step loses 2+ testers |
| Activation | First idea captured **and** first content created within 48 h of first use | `usage_events` (8.6) | 4 of 5 |
| Habit | Days with any activity in 14 days | Active-days query (8.5) | ≥ 5 days |
| Full loop | At least one `post_published` **and** one `metrics_logged` | Key-actions query (8.6) | 3 of 5 |
| Task success | Done without help, per task | Observation sheet | ≥ 80 % |
| Ease | Median 1–7 answer per task | Observation sheet | ≥ 5 |
| Feedback | Count by kind and page; bugs by severity | Feedback queries (8.1–8.2) | All blockers fixed within the beta |
| Recommend / pay | 0–10 score and a peso amount | Exit interview | Qualitative |

Usage events only exist for testers who turned usage sharing on, and only from that moment on.
Always write down n ("3 of 4 who opted in").

---

## 8. Reading feedback and the funnel (SQL)

Run these in Supabase → **SQL Editor**. The SQL editor runs as the project owner and bypasses
row-level security. Testers can only ever see their own rows. Times are shown in Manila time.

### 8.1 Newest feedback, with the tester's email

```sql
select f.created_at at time zone 'Asia/Manila' as sent_manila,
       u.email, f.kind, f.page, f.ui_language, f.viewport, f.status, f.message
from public.feedback f
join auth.users u on u.id = f.user_id
order by f.created_at desc;
```

### 8.2 Where the problems are

```sql
-- Count by kind and page
select kind, page, count(*) as reports
from public.feedback
group by kind, page
order by reports desc;

-- Triage: new → reviewed / planned / done / wont_fix (dashboard only; the app never changes it)
update public.feedback set status = 'planned' where id = '<feedback id>';
```

### 8.3 Onboarding funnel (first-run setup)

Distinct testers who **saw** and who **completed** each step, in the order of the setup flow.

```sql
with steps(position, step) as (
  values (0, 'welcome'), (1, 'hilig'), (2, 'galing'), (3, 'kanino'), (4, 'para_saan'), (5, 'niche'),
         (6, 'identity'), (7, 'platforms'), (8, 'voice'), (9, 'pillars'), (10, 'strategy')
)
select s.position, s.step,
       count(distinct e.user_id) filter (where e.name = 'onboarding_step_viewed')    as viewed,
       count(distinct e.user_id) filter (where e.name = 'onboarding_step_completed') as completed
from steps s
left join public.usage_events e
  on e.props ->> 'step' = s.step and e.props ->> 'mode' = 'first'
group by s.position, s.step
order by s.position;

-- Finished setup, by setup language
select props ->> 'lang' as language, count(distinct user_id) as testers
from public.usage_events
where name = 'onboarding_completed' and props ->> 'mode' = 'first'
group by 1;
```

Niche Discovery re-runs from Brand HQ use `mode = 'niche'`; a full re-run uses `mode = 'rerun'`.

### 8.4 Slowest setup steps

```sql
with viewed as (
  select user_id, props ->> 'step' as step, min(occurred_at) as at
  from public.usage_events where name = 'onboarding_step_viewed' group by 1, 2
), completed as (
  select user_id, props ->> 'step' as step, min(occurred_at) as at
  from public.usage_events where name = 'onboarding_step_completed' group by 1, 2
)
select v.step,
       round(percentile_cont(0.5) within group (order by extract(epoch from c.at - v.at))::numeric) as median_seconds,
       count(*) as testers
from viewed v
join completed c using (user_id, step)
where c.at >= v.at
group by v.step
order by median_seconds desc;
```

### 8.5 Habit: active days and module use

```sql
-- Active days per tester, last 14 days (Manila calendar days)
select u.email,
       count(distinct (e.occurred_at at time zone 'Asia/Manila')::date) as active_days
from public.usage_events e
join auth.users u on u.id = e.user_id
where e.occurred_at > now() - interval '14 days'
group by u.email
order by active_days desc;

-- Which modules each tester opens
select u.email, e.props ->> 'module' as module, count(*) as views
from public.usage_events e
join auth.users u on u.id = e.user_id
where e.name = 'page_viewed'
group by u.email, module
order by u.email, views desc;
```

### 8.6 The content loop: key actions and activation

```sql
-- Key actions per tester
select u.email,
       count(*) filter (where e.name = 'idea_captured')   as ideas,
       count(*) filter (where e.name = 'content_created') as content,
       count(*) filter (where e.name = 'post_published')  as published,
       count(*) filter (where e.name = 'metrics_logged')  as analytics
from public.usage_events e
join auth.users u on u.id = e.user_id
group by u.email;

-- Activation: first idea and first content within 48 hours of the tester's first event
with first_seen as (
  select user_id, min(occurred_at) as at from public.usage_events group by user_id
)
select u.email,
       bool_or(e.name = 'idea_captured'   and e.occurred_at <= f.at + interval '48 hours') as idea_in_48h,
       bool_or(e.name = 'content_created' and e.occurred_at <= f.at + interval '48 hours') as content_in_48h
from first_seen f
join public.usage_events e using (user_id)
join auth.users u on u.id = f.user_id
group by u.email;

-- Where people publish, and where ideas come from
select props ->> 'platform' as platform, count(*) from public.usage_events where name = 'post_published' group by 1 order by 2 desc;
select props ->> 'source'   as source,   count(*) from public.usage_events where name = 'idea_captured'  group by 1 order by 2 desc;
```

---

## 9. Making sense of it

1. **Every day during the beta:** read new feedback (8.1). Reply to the tester personally within
   a day. Mark each item `reviewed`.
2. **After each session:** fill in the observation sheet the same day, while it's fresh.
3. **End of week 2:** put every observation and feedback item on a sticky note or spreadsheet row
   and group them by theme ("setup too long", "didn't find Capture", "Taglish sounds formal"…).
   Count how many testers hit each one and give it a severity.
4. **Decide:** fix every blocker, plus the top 3–5 majors that 2 or more testers hit. Park
   single-person ideas in a backlog.
5. **Close the loop:** send testers a short "here's what we changed because of you" message.

## 10. After the beta

- Export what you need (Table Editor → Export to CSV). Then delete what you no longer need:
  `delete from public.usage_events where occurred_at < now() - interval '30 days';`
- If a tester asks, delete their account in **Authentication → Users**. Their feedback and usage
  events are deleted with it (cascade).
- Before a public launch: decide whether sign-ups reopen, and make sure the privacy notice covers
  feedback and opt-in analytics.

---

## How the beta tools work

**Send feedback** (account menu — the avatar at the top right, on desktop and phones):

- Choose a kind (Bug · Idea · Confusing · Praise), write a message, and send. The page path is
  attached automatically (no query string). Language, screen-size bucket and browser are recorded
  too.
- **Online version:** `POST /api/feedback` saves a row in `public.feedback`, using the tester's
  session and row-level security (testers can insert and read their own rows, never edit or
  delete them).
- **Local mode:** Orbi says plainly that it can't send anything, and offers **Copy feedback**
  (clipboard) so the creator can paste it into a chat or email.

**Usage analytics** (online version only, **off by default**, remembered **per device**):

- Switch: Feedback dialog → **Share anonymous usage data**.
- Events are batched and sent to `POST /api/events` → `public.usage_events`. Only whitelisted
  names and properties are kept; free text is dropped in the browser *and* on the server, and
  paths lose ids and query strings (`/studio/[id]`).

| Event | When | Properties |
|---|---|---|
| `onboarding_step_viewed` | A setup step is shown | `step`, `index`, `mode`, `lang` |
| `onboarding_step_completed` | Continue on a valid step | `step`, `index`, `mode`, `lang` |
| `onboarding_completed` | Setup (or Niche Discovery) saved | `mode`, `lang`, `pillars`, `ideas` |
| `page_viewed` | A page in the app opens | `module` (+ normalised `path`) |
| `idea_captured` | A new idea is saved | `source` (quick_capture, ai_generator, …) |
| `content_created` | A content item is created | `platform`, `stage`, `from_idea` |
| `post_published` | An item reaches a published stage | `platform` |
| `metrics_logged` | An analytics snapshot is logged | `platform` |

Bulk changes (importing or resetting a workspace, moving a local workspace to the cloud) are not
counted as user actions.

---

## Sources

1. Supabase Docs — Auth general configuration ("Allow new users to sign up"). <https://supabase.com/docs/guides/auth/general-configuration>
2. Supabase discussion — Email auth: sign up disabled (invite only) & sign in allowed. <https://github.com/orgs/supabase/discussions/4296>
3. National Privacy Commission — Republic Act 10173, Data Privacy Act of 2012. <https://privacy.gov.ph/data-privacy-act/>
4. Official Gazette — Republic Act No. 10173. <https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/>
