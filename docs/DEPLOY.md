# Put Orbi online — step by step

This guide takes Orbi from your computer to a real website with accounts: you (and invited testers) sign in from any phone or laptop, and your workspace is saved in a database instead of one browser.

You don't need to be a developer. Set aside about an hour and follow the steps in order. Wherever a step says "copy", paste the value somewhere private (a password manager or a note only you can see) — never into a group chat.

| Service | What it does for Orbi | Account |
|---|---|---|
| **GitHub** (with GitHub Desktop) | Stores your code privately so Vercel can build it | github.com |
| **Supabase** | The database, accounts and sign-in emails | supabase.com |
| **Vercel** | Runs the website | vercel.com (sign up with GitHub) |

> **Before you start — back up your local workspace.** Your current workspace lives in your browser at `localhost:3000`. The online site has a different address, so it can't see that data. Open Orbi on your computer → **Settings → Data → Export workspace** and keep the JSON file. You import it online in step 6.

---

## 1. Put the code on GitHub (private)

1. Download and install **GitHub Desktop** from desktop.github.com, then sign in with your GitHub account (create one if you need to).
2. **File → Add Local Repository…** → choose the Orbi project folder (`Personal Branding App`) → **Add Repository**. Orbi is already a Git repository, so no setup is needed.
3. Check the **Changes** tab on the left. It must **not** list `.env.local` or any file with keys in it (the project ignores `.env*` files except `.env.example`, which has no values). If you ever see a key there, stop and don't commit it.
4. Click **Publish repository** (top bar). Keep **"Keep this code private"** ticked → **Publish Repository**.
5. Vercel builds your **production branch** (usually `main`). GitHub Desktop shows your current branch at the top. If your latest work is on another branch, either:
   - switch to `main` → **Branch → Merge into current branch…** → pick your work branch → **Push origin**, or
   - in step 4 of Vercel below, set **Settings → Git → Production Branch** to your work branch.

Every time you change code later: commit in GitHub Desktop, then **Push origin**. Vercel redeploys automatically.

## 2. Create the Supabase project (Singapore)

1. Go to supabase.com → **Start your project** → sign in (GitHub sign-in is fine).
2. **New project**:
   - **Name:** `orbi`
   - **Database password:** click **Generate a password** and copy it somewhere private. Orbi doesn't need it, but Supabase support or the CLI might.
   - **Region:** **Southeast Asia (Singapore)** — the closest region to the Philippines, so pages load faster.
   - Plan: the free plan is enough to start (see "What's free" below).
3. Wait a minute or two until the project dashboard opens.

## 3. Create the database tables (run the migrations)

The database design lives in the project folder `supabase/migrations/`. **Run every file in `supabase/migrations`, in filename order, once each.** The file names start with a date, so alphabetical order is the right order. Today that is:

| Order | File | Creates |
|---|---|---|
| 1 | `20260910000000_init.sql` | Your workspace: brand, strategy, ideas, content, analytics, money, settings — with row-level security (each account only sees its own rows) |
| 2 | `20260914000100_beta.sql` | In-app feedback and opt-in usage analytics (`feedback`, `usage_events`) |
| … | any newer file, e.g. `20260914000200_push.sql` (push reminders) | whatever that feature needs |

If new files appear in that folder later (after you pull an update), run just the new ones, in order.

### Option A — SQL Editor (no installs)

1. Supabase dashboard → **SQL Editor** (left menu) → **New query**.
2. On your computer, open the **first** file with a text editor (TextEdit: **Format → Make Plain Text** first; or VS Code). Select all, copy.
3. Paste into the SQL Editor → **Run**. You should see **"Success. No rows returned"**.
4. Repeat steps 1–3 for each next file, in order.

Don't run a file twice. If a file shows an error, read the troubleshooting table at the end before trying anything else.

### Option B — Supabase CLI (if you're comfortable with Terminal)

In Terminal, inside the project folder:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # the ref is in Project Settings → General
npx supabase db push
```

`db push` runs every migration file in order and remembers which ones already ran, so you can run it again after an update.

### Check it worked

**Table Editor** should list tables such as `brand_profiles`, `content_ideas`, `content_items`, `brand_deals`, `feedback`. Each shows a green **RLS enabled** badge (or no "RLS disabled" warning).

## 4. Put the site on Vercel

1. Go to vercel.com → **Sign Up** → **Continue with GitHub**. When GitHub asks which repositories Vercel may access, allow the Orbi repository.
2. **Add New… → Project** → find your Orbi repository → **Import**.
3. Vercel detects **Next.js**. Leave the build settings as they are.
4. Open **Environment Variables** and add the values below **before** you click Deploy. The full list, with comments, is in `.env.example` in the project.

   **Required for accounts** — Supabase dashboard → **Project Settings → API Keys** (and **Data API** for the URL):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the **Publishable key** (`sb_publishable_…`). Older projects show an `anon` key instead — that works too. |

   **Optional:**

   | Name | When you need it |
   |---|---|
   | `ANTHROPIC_API_KEY` (+ `AI_MODEL`, `AI_EFFORT`) | Claude-powered AI. Without it, AI features use the offline templates (clearly labelled). |
   | `SUPABASE_SECRET_KEY` | Server jobs such as push reminders. Supabase → API Keys → **Secret key**. |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | Push reminders on phones (optional). Key generation, the free 15-minute scheduler (Supabase Cron) and testing are in [REMINDERS.md](REMINDERS.md). Without them, **Add to my calendar** reminders still work. |

   > Only variables that start with `NEXT_PUBLIC_` are visible in the browser, and only the publishable key belongs there — row-level security protects the data. The **secret key**, `VAPID_PRIVATE_KEY`, `CRON_SECRET` and `ANTHROPIC_API_KEY` must never get a `NEXT_PUBLIC_` name and must never be committed to GitHub.

5. **Deploy.** After a few minutes you get an address like `https://orbi-yourname.vercel.app`. Copy it.
6. Optional but recommended: **Project → Settings → Functions → Function Region** → pick **Singapore**, so the server sits next to your database. Redeploy afterwards (**Deployments → ⋯ → Redeploy**).

`NEXT_PUBLIC_…` values are built into the site. **Whenever you add or change an environment variable, redeploy** — otherwise the site keeps the old values.

## 5. Tell Supabase your website address (auth URLs)

Sign-in emails contain links back to your site. Supabase only allows addresses you list.

Supabase → **Authentication → URL Configuration**:

1. **Site URL:** your site, e.g. `https://orbi-yourname.vercel.app` (switch it to your custom domain in step 7).
2. **Redirect URLs → Add URL**, one per line:
   - `https://orbi-yourname.vercel.app/**`
   - `http://localhost:3000/**` (so sign-in also works when you run Orbi on your computer with the same project)
   - later: `https://<your-domain>/**`
3. **Save.**

Then **Authentication → Sign In / Providers → Email**: keep Email enabled. **Confirm email** on means new accounts click a link before their first sign-in (recommended).

**Emails.** Supabase's built-in email sender is for testing: it's rate-limited and may only deliver to your own team's addresses. Before inviting other people, set up custom SMTP under **Authentication → Emails → SMTP Settings** with an email provider (for example Resend or Brevo — check their free tiers).

**Invites that land on "Set a password"** (for beta testers): **Authentication → Emails → Invite user** → replace the link in the template with

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/set-password
```

The invited person clicks the link, is signed in, and chooses a password on Orbi's **Set a password** page. Links in this format work in any browser on any device. The same page works for anyone later: sign in with an email link, then open `/set-password`. (Optional, same idea for **Magic Link** and **Confirm signup** — see "Email links that work across devices" in [SUPABASE.md](SUPABASE.md).)

## 6. First sign-in and moving your workspace

1. Open your site → you land on **Sign in** → **Create an account** (or use an invite).
2. Confirm your email if asked.
3. A new account is empty, so onboarding opens. To bring your existing workspace instead, type your site address followed by `/settings?tab=data` (for example `https://orbi-yourname.vercel.app/settings?tab=data`) — Settings → Data opens even before onboarding. Then **Import workspace…** → choose the JSON file you exported before you started → **Replace workspace…**. A progress bar shows the rows being saved; if anything fails midway, your account is put back as it was and nothing is lost. The same file can be imported into more than one account (each gets its own copy).

Running Orbi on your own computer with the same Supabase variables in `.env.local`? Then the local workspace is at the same address, and Orbi offers **"Move my local workspace to my account"** right after you sign in (also in **Settings → Data**). The local copy stays in that browser until the move succeeds.

## 7. Your own domain (optional)

1. Buy a domain from any registrar (for example a `.com` or `.ph`).
2. Vercel → your project → **Settings → Domains** → **Add** → type the domain (e.g. `orbi.yourname.com`).
3. Vercel shows the DNS record to create (an `A` record or a `CNAME`). Add exactly that record in your registrar's DNS settings. It can take from minutes to a few hours to work; Vercel shows **Valid Configuration** when it does, and sets up HTTPS for you.
4. Back in Supabase → **Authentication → URL Configuration**: set **Site URL** to `https://<your-domain>` and add `https://<your-domain>/**` to Redirect URLs.

## What's free

Supabase and Vercel both have free plans that are enough to run Orbi for yourself and a handful of beta testers. Limits and terms change, so **check the current pages before you rely on them**:

- Supabase pricing: supabase.com/pricing — look at database size, monthly active users, emails, and whether inactive free projects are paused.
- Vercel pricing: vercel.com/pricing — look at what the Hobby plan allows (including whether commercial use is allowed) and cron job frequency.
- GitHub private repositories are free for personal accounts.
- A custom domain costs money (a yearly fee at your registrar); custom SMTP providers have their own free tiers.
- Claude (`ANTHROPIC_API_KEY`) is paid per use; Orbi works without it.

If you start charging other creators for Orbi, re-read both plans' terms.

## Troubleshooting

| What you see | What to do |
|---|---|
| The site shows **"Accounts are off in local mode"** | The Supabase variables are missing or misspelled in Vercel, or you didn't redeploy after adding them. Check the names exactly, then **Redeploy**. |
| **"Couldn't load your workspace"** with `Could not find the table … in the schema cache` or `relation … does not exist` | A migration hasn't run. Run every file in `supabase/migrations` in filename order (step 3). If you just ran them, in the SQL Editor run `notify pgrst, 'reload schema';` and reload the page. |
| SQL Editor: `relation "…" already exists` or `policy … already exists` | That file already ran. Don't run it again — move on to the next file. |
| SQL Editor: an error in the middle of a file that never ran before | Copy the error, don't re-run. Check you pasted the **whole** file and ran the files in order (the first file must run before the others). |
| Sign-in email link opens the wrong site, or says the link is invalid | Site URL and Redirect URLs in step 5 don't match your address. Add `https://<your-address>/**` and try with a new link (old links expire). |
| "Open the link in the same browser you requested it from" | Default email links only work in the browser that asked for them. Request a new link there, or switch the templates to the `token_hash` format (step 5). |
| "Too many emails were sent" / invitees never get the email | Built-in email limits. Wait, or set up custom SMTP (step 5). |
| New people can create accounts, but this is invite-only | Supabase → **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**. Invited and existing accounts can still sign in. |
| Import says **"Nothing was changed — your previous workspace is back"** | The file had a row Postgres rejected, or the connection dropped. The message names the table; your account is as it was. Fix or re-export the file and try again. |
| Saving shows **"the row no longer exists"** | It was deleted on another device. Reload the page to see the latest. |
| Changes to environment variables don't show | Redeploy (Vercel → Deployments → ⋯ → Redeploy). |
| The build fails on Vercel | Open the deployment → **Building** logs; the first red error names the file. Make sure you pushed all commits from GitHub Desktop. |

## What has been tested — and what hasn't

The database migrations are tested automatically on a real Postgres engine (PGlite, Postgres compiled to WebAssembly): every file applies cleanly in order, the whole sample workspace goes in, every delete rule matches the app, `updated_at` stamps itself, and row-level security keeps two accounts apart. Orbi's Supabase data code is also run against that database.

That proves the SQL. It does not prove the hosted parts of Supabase — the Data API (PostgREST), Auth and its emails, and your project's dashboard settings — or Vercel. Do a quick check after deploying: create an account, finish onboarding, add an idea on your phone and see it on your laptop, then delete it.
