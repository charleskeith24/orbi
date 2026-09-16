# Reminders

Orbi can remind you about three things (**Settings → Reminders**):

| Reminder | When | What it says |
|---|---|---|
| **Daily digest** | Every day at your digest time | Posts scheduled today, what's due or overdue, today's posting slot → opens Today |
| **Posting slot heads-up** | N minutes before each active Posting Schedule slot that has a time | The slot, its platforms and the post that's ready for it → opens that post in Content Studio |
| **Weekly review** | Your review day and time | Posts published this week vs your weekly target → opens the Weekly Report |

Times follow the workspace time zone (Settings → General). Slots without a time get no heads-up.

There are two ways to receive them. Both use the same settings.

## 1. Calendar file (works everywhere, no setup)

**Settings → Reminders → Add to my calendar** downloads `orbi-reminders-<date>.ics`: one repeating event per reminder, with an alert. Open it on a phone (tap **Add**) or import it into Google Calendar, Apple Calendar or Outlook. Your calendar app sends the alerts, so this works in local mode, offline, on iPhone and on Android.

- Changed your reminders or Posting Schedule? Download the file again. Events keep the same IDs, so calendars that support updates replace them; if you see doubles, delete the old "Orbi" events.
- The file can't count today's posts (it's static). The push digest can.

Code: `src/lib/reminders/ics.ts` (RFC 5545, with a generated `VTIMEZONE`), tests in `ics.test.ts`.

## 2. Push notifications (online version)

Push needs the online version: Supabase for accounts, a deployed site (HTTPS) and a scheduler that calls Orbi every 15 minutes.

### One-time setup

1. **Run the migration** `supabase/migrations/20260914000200_push.sql` (with the others; see `docs/SUPABASE.md`). It creates `push_subscriptions` with row-level security.
2. **Generate VAPID keys** once, on your computer:
   ```bash
   npx web-push generate-vapid-keys
   ```
3. **Add the environment variables** in Vercel → Project → Settings → Environment Variables (never commit them):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key from step 2 |
   | `VAPID_PRIVATE_KEY` | the private key from step 2 (secret) |
   | `VAPID_SUBJECT` | `mailto:you@example.com` (a contact for the push services) |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key (secret, server only) |
   | `CRON_SECRET` | any long random string, e.g. `openssl rand -hex 32` (secret) |

4. **Redeploy**, then set up a scheduler (below).
5. On each phone or computer: open Orbi → **Settings → Reminders → Push notifications → Turn on**, then **Send a test**.

### Scheduler: call `/api/cron/reminders`

The job sends every reminder that is due and still relevant, then records it per device, so it is **safe to call as often as you like** (even twice at once). It needs `Authorization: Bearer <CRON_SECRET>`; without it (or while `CRON_SECRET` is unset) it refuses.

Reminders stay sendable for a while after their time — digest 3 hours, slot heads-up until the slot starts, weekly review 6 hours — so a late run still delivers them, and a very late one skips them.

#### Option A — Supabase Cron (free, every 15 minutes) — recommended

Supabase Cron (`pg_cron`) and `pg_net` can call your site on a schedule. In the Supabase dashboard enable **Integrations → Cron** and the **pg_net** extension (Database → Extensions), then run this in the SQL editor, with your own site URL and the same `CRON_SECRET` value:

```sql
-- Store the URL and secret in Vault instead of in the job's SQL.
select vault.create_secret('https://your-orbi-site.vercel.app', 'orbi_site_url');
select vault.create_secret('paste-your-CRON_SECRET-here', 'orbi_cron_secret');

select cron.schedule(
  'orbi-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'orbi_site_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'orbi_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
```

`net.http_get` gives up after 2 seconds by default — keep `timeout_milliseconds := 30000`.

Check it:

```sql
select * from cron.job_run_details order by start_time desc limit 5;   -- did the job run?
select status_code, content from net._http_response order by created desc limit 5;  -- what did Orbi answer? (kept 6 hours)
```

A healthy answer is `200` with `{"ok":true,"sent":…}`. Stop it with `select cron.unschedule('orbi-reminders');`.

#### Option B — Vercel Cron (`vercel.json`)

`vercel.json` schedules `/api/cron/reminders` once a day at `0 0 * * *` (UTC). Vercel sends the `CRON_SECRET` header automatically once the variable is set.

Plan limits (Vercel docs, [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing), checked September 2026):

| Plan | Minimum interval | Precision |
|---|---|---|
| Hobby (free) | once per day | within the hour (±59 min) |
| Pro | once per minute | per minute |

On **Hobby**, a schedule that runs more than once a day fails the deployment, and the daily run lands somewhere between 00:00 and 00:59 UTC (8:00–8:59 AM in the Philippines). That only covers a morning digest at 8:00 in Manila time — use **Supabase Cron** for slot heads-ups and other times. Keeping both is fine: deliveries are recorded per device, so nothing is sent twice.

On **Pro**, you can change the schedule in `vercel.json` to `*/15 * * * *` and skip Supabase Cron.

#### Test by hand

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://your-orbi-site.vercel.app/api/cron/reminders
```

| Answer | Meaning |
|---|---|
| `200 {"ok":true,"subscriptions":…,"due":…,"sent":…,"skipped":…,"failed":…,"removed":…}` | Ran. `skipped` = already delivered earlier; `removed` = devices that unsubscribed or expired |
| `401 unauthorized` | Missing or wrong bearer token |
| `503 not_configured` | `CRON_SECRET`, `SUPABASE_SECRET_KEY` or the VAPID variables are missing (the message says which) |
| `500 server_error` | Database or network trouble; safe to run again. Details are in the Vercel function logs |

### iPhone and iPad

- Web push works only for sites **added to the Home Screen**, on **iOS/iPadOS 16.4 or later**. In Safari: Share → **Add to Home Screen**, open Orbi from the Home Screen, then turn on push in Settings → Reminders. Orbi shows these steps when you open it in the browser.
- iPhone doesn't let other apps share into web apps, so the Android share target doesn't exist there.

### How it works

- `public/sw.js` shows the notification (`push`) and opens the right page when you tap it (`notificationclick`).
- `POST /api/push/subscribe` saves this browser's subscription for the signed-in user (`save_push_subscription`); an endpoint belongs to one account at a time. `POST /api/push/unsubscribe` removes it; `POST /api/push/test` sends a test; `GET /api/push/status` tells the settings screen what's configured.
- `GET|POST /api/cron/reminders` (service role): loads subscriptions, settings, active slots and the relevant content; computes due reminders (`src/lib/reminders/schedule.ts`); claims each delivery with `claim_push_reminder` (once per device and reminder), sends with `web-push`, releases the claim after a temporary failure so the next run retries, and deletes subscriptions the push service reports gone (404/410).
- A device never gets reminders that were due before it subscribed.
- Notification text uses the workspace's app language (English or Taglish).

### Troubleshooting

| Symptom | Check |
|---|---|
| Settings says **Not configured** | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` set in Vercel, then redeploy |
| **Blocked in this browser** | Allow notifications for the site in the browser's site settings, reload |
| Test works, scheduled reminders don't come | Scheduler set up? `curl` the job (above) and look at `sent` / `due`. Is at least one reminder switched on and does the slot have a time? |
| Test doesn't arrive on Android | Battery saver / Do Not Disturb, and notifications allowed for the browser app itself |
| Nothing on iPhone | Opened from the Home Screen icon (not Safari)? iOS 16.4+? Focus mode off? |
| Reminders at the wrong hour | Settings → General → Time zone |
