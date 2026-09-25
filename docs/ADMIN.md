# Admin: running the Orbi beta

The admin area (`/admin`) is where you run the online version of Orbi. From there you can:

- approve or reject people who ask for access;
- invite, disable and delete accounts;
- read feedback;
- see how far people get in setup;
- check a log of every admin action.

It only exists in the online version (Supabase). On your own computer in local mode there are no accounts, so `/admin` just explains that.

**What admins can see.** Account details and counts. Never a creator's ideas, scripts, brand or money. Section 6 explains why.

> Set this up once, right after accounts work ([DEPLOY.md](DEPLOY.md) step 7 points here). It takes about 15 minutes.

---

## Before you start

- **Orbi is online with accounts.** You followed [DEPLOY.md](DEPLOY.md) steps 1–6 and can sign in to your site.
- **Every migration has run**, including `20260918000000_admin.sql`. It creates the admin tables. See DEPLOY.md step 3.
- **The server has the secret key.** In Vercel → Project → Settings → Environment Variables, `SUPABASE_SECRET_KEY` is set. Copy it from Supabase → Project Settings → API Keys → **Secret key**, then **redeploy**. Without it, the admin area and the "Request access" form answer "not configured".
- **You have an authenticator app on your phone.** For example Google Authenticator, Microsoft Authenticator, 1Password or Authy.

## 1. Make yourself admin

For safety, nobody can make themselves admin from inside the app. The very first admin is added once, in Supabase.

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste this line. Put the email you sign in to Orbi with between the quotes:

   ```sql
   insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';
   ```

3. Click **Run**. You should see "Success. 1 rows affected".
   - If it says **0 rows**, that email has no account yet (DEPLOY.md step 6 creates yours), or it's spelled differently.

From now on, you can make other people admin from **Admin → Users**, and remove them there too.

## 2. Turn off sign-ups in Supabase

Orbi's `/signup` page is now a **"Request access"** form. Nobody gets an account without your approval. But Supabase has its own sign-up switch. If it stays on, someone could create an account by talking to Supabase directly, around the waitlist.

1. Supabase → **Authentication → Sign In / Providers**.
2. Turn **Allow new users to sign up** off → **Save**.

People you invite, and everyone who already has an account, can still sign in. The app can't change this switch for you.

**Check your email templates too.** They decide where the emails the admin area sends will land. Set them as in DEPLOY.md step 5:

- **Invite user.** The invite link opens **Set a password**. Without this template, invited people land on the sign-in page with "link invalid". Supabase only lets you edit it after custom SMTP is set up (DEPLOY.md step 5), and the built-in sender can't reach people outside your Supabase team anyway — so set up SMTP before you approve anyone.
- **Reset Password.** Needed for **Send password reset**. The link format is in [SUPABASE.md](SUPABASE.md), under "Email links that work across devices".

## 3. Set up 2-step verification

The admin area only opens after a second check: a 6-digit code from your phone. Then a stolen password alone isn't enough to reach everyone's accounts.

1. Open your site's `/admin`. You land on **Security**.
2. Scan the QR code with your authenticator app. If you can't scan it, type in the secret shown under it.
3. Type the 6-digit code the app shows → **Verify**.

From then on, Orbi asks for a fresh code each time you sign in and open Admin. Other admins set up their own the same way the first time they open `/admin`.

**Lost your phone?** Another admin can't remove your 2-step verification from the app. In Supabase → **SQL Editor**, run this with your email:

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'you@example.com');
```

Then sign in and set it up again (step 3).

## 4. Approve a request

People who want to join fill in **Request access** on your site. They give their name, their email, what they create and a link to their page (the last two are optional), and agree to the **Terms of Use** at `/terms` and the **Privacy notice** at `/privacy`.

1. **Admin → Requests** lists the pending requests first.
2. **Approve.** Orbi emails them an invite. They click it, choose a password on **Set a password**, and start with their own empty workspace (onboarding opens).
3. **Reject.** The request is marked rejected. **No email is sent**, so they simply never get an invite. That's fine for the beta.

**More ways to add or pause people:**

- **Invite someone directly.** **Admin → Users → Invite someone** sends an invite without a request. If that person had a pending request, it's marked approved.
- **Pause the waitlist.** The **Accepting requests** switch on the Requests tab closes the form. While it's off, `/signup` says requests are closed for now.

**Built-in protections:**

- **One request per email.** A second request from the same email isn't stored, but the visitor sees the same "Thanks" message. So the form never reveals who has asked or who already has an account.
- **About 30 new requests per hour**, for everyone together. After that, visitors see "try again later" until the hour passes.
- **Bots are dropped.** A hidden field catches them; people never see it. Bot requests look accepted but aren't stored.
- **No IP addresses are stored.**

## 5. Manage accounts

**Admin → Users** lists every account: profile photo, email, name, status (**invited**, **active** or **disabled**), 2-step verification on or off, dates, whether setup is finished, and **counts** of ideas, content and published posts. Search by email or name, and filter by status.

The menu on each row:

| Action | What happens |
|---|---|
| **Resend invite** | The invite email again. Only while they haven't accepted it yet. |
| **Disable account** | They can't sign in or refresh their session. A session already open ends within the hour at most. Their workspace stays as it is. |
| **Enable account** | Lifts the block. |
| **Send password reset** | Supabase emails them a link to choose a new password. Not for disabled accounts, and not for invites that haven't been accepted (resend the invite instead). |
| **Make admin / Remove admin** | Gives or takes away access to `/admin`. New admins set up 2-step verification when they first open it. |
| **Remove profile photo** | Deletes their profile photo (moderation): use it for a photo that isn't theirs or isn't appropriate (Terms of Use). Their initials show instead; they can upload another. Written to the audit log. |
| **Delete** | Deletes the account **and its whole workspace**, permanently. You type their email to confirm. Their profile photo, feedback and usage events go too. |

**Guard rails:**

- You can't disable, delete or remove admin from **your own** account. Ask another admin.
- The **last admin** can't be removed, so the admin area never ends up with nobody in charge.

**The audit log.** Every change made from the admin area is written to **Admin → Audit log**: approving, rejecting, inviting, disabling, deleting, admin changes, removed profile photos and the Accepting requests switch. Each entry shows who did what to which email, and when. Nobody can edit or delete entries from the app, not even an admin. Entries hold small facts only, like `from: active → to: disabled`, never content.

## 6. What admins can't see, and why

Creators put unpublished ideas, scripts, income and brand deals into Orbi. They need to trust that the person running Orbi isn't reading over their shoulder. So the admin area is built to show **account facts and counts only**.

| Admins can see | Admins can't see |
|---|---|
| Email, name, profile photo, account status, sign-up and last sign-in dates | Ideas, scripts, captions, hooks, stories, research |
| | The rest of a profile: headline, location, links, niche |
| Whether setup is finished | Brand HQ, audience, pillars, strategy |
| How many ideas, content items and published posts | Titles or text of any of them |
| Feedback people sent with the Feedback button (it was written *to* you) | Brand deals, income, rate cards |
| Access requests and the audit log | Analytics numbers of a creator's posts |
| The setup funnel: how many people viewed and finished each step (only people who turned on usage sharing, so it undercounts) | Anything typed into the workspace |

**How this is enforced:**

- The admin pages never ask the database for workspace content.
- The database functions they use return numbers only.
- Row-level security still keeps every workspace private to its owner.

**Be honest with your testers about one thing.** Anyone who can open your **Supabase dashboard** can read the database directly. That's the project owner, so keep dashboard access to yourself, and use a strong password with 2-step verification on your Supabase account too.

## 7. The contact email and deletion requests

`/privacy` and `/terms` tell people how to reach you. Set **`NEXT_PUBLIC_CONTACT_EMAIL`** in Vercel → Project → Settings → Environment Variables (for example a support inbox — it's shown publicly), then **redeploy**. Until it's set, both pages say that no contact email is set up yet and point signed-in people to Send feedback in the account menu. People without an account then have no way to reach you, so set it before you open the waitlist.

Both pages are drafts. Review them with a lawyer, especially the governing law (the Philippines) in the Terms. The open questions are listed at the top of `src/app/terms/terms-messages.ts`.

When someone writes in:

| They ask to… | What to do |
|---|---|
| **Delete their account** | Only act on a message from the account's own email address. **Admin → Users** → the row menu → **Delete**, and type their email to confirm. Their workspace, feedback and usage events are deleted with it. |
| **Remove their access request** (no account) | Only act on a message from the email on the request. Supabase → **SQL Editor**: `delete from access_requests where email = 'them@example.com';` There's no button for this in the admin area. |
| **Report someone breaking the Terms** | **Admin → Users** → **Disable account**. They can't sign in; their workspace stays as it is. |

The **audit log** keeps its entries, including the email an action was about, even after an account is deleted. The Privacy notice says so.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| `/admin` shows **page not found** | This account isn't an admin. Check step 1 used the exact email you're signed in with. The `select` below shows who is admin. |
| `/admin` keeps asking for 2-step verification | Finish step 3, then enter the current code. If the code is always rejected, check your phone's clock is set automatically. |
| Admin pages say **not configured** | `SUPABASE_SECRET_KEY` is missing in Vercel, or you didn't redeploy after adding it. |
| **Approve** says "This email already has an account" | That person can already sign in. Reject the request, or leave it. |
| "Supabase's email limit was reached" | The built-in email sender allows only a few emails per hour. Wait, or set up custom SMTP (DEPLOY.md step 5). |
| Invited people land on sign-in with "link invalid" | The **Invite user** email template isn't the token-hash one from DEPLOY.md step 5. |
| `/signup` says requests are closed | **Admin → Requests → Accepting requests** is off. |
| You need to remove an admin who can't be removed in the app (for example the last one) | SQL Editor: `delete from admin_users where user_id = (select id from auth.users where email = 'them@example.com');` |

**Profile photos after deleting an account in the Supabase dashboard.** Deleting from **Admin → Users** removes the photo files first. Deleting a user from the Supabase dashboard (Authentication → Users) can't: Storage files don't cascade from the database. Nobody but you can open such a leftover (it belongs to nobody's circle any more), but to remove it: Storage → `avatars` → the folder named after the deleted user's id → delete it. To find leftovers:

```sql
select name from storage.objects
 where bucket_id = 'avatars' and split_part(name, '/', 1) not in (select id::text from auth.users);
```

To see who is admin:

```sql
select u.email, a.created_at from admin_users a join auth.users u on u.id = a.user_id order by a.created_at;
```

For developers: the rules behind all of this are in [ARCHITECTURE.md](ARCHITECTURE.md) §14. The tables are in `supabase/migrations/20260918000000_admin.sql`.
