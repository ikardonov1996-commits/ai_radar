# AI Radar — MVP

Mobile-first web app: a swipe feed of AI apps and web services. Swipe right to save to your «Набор», answer short
surveys, earn tokens (internal points, no withdrawal yet). UI is in Russian; the visual system is
**AI Radar Bold Design System v1.0** (black, lime `#DFFF00`, Space Grotesk + Inter).

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · PostgreSQL + Prisma · Resend · JWT cookie (`jose`).

## Run locally

```bash
cp .env.example .env          # fill in DATABASE_URL at least
npm install
npx prisma migrate deploy
npm run seed:demo             # 36 placeholder cards, published — to try the feed right away
npm run dev                   # http://localhost:3000
```

Without `RESEND_API_KEY` the login code is printed to the server log instead of being emailed.

Remove the demo cards before launch: `npm run seed:demo -- --clear`.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs session cookies; also salts code and IP hashes. Long random string |
| `RESEND_API_KEY`, `EMAIL_FROM` | Login code emails. `EMAIL_FROM` must be on a domain verified in Resend |
| `ADMIN_TOKEN` | Password for `/admin` |
| `CRON_SECRET` | Bearer token for `POST /api/cron/verify` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional. Seed parser writes Russian one-liners and topics with Claude (default model `claude-opus-5-5`) |
| `WELCOME_BONUS_TOKENS` | Sign-up bonus (default 100) |
| `SURVEY_REWARD_TOKENS` | Reward per accepted survey (default 10) |
| `DAILY_TOKEN_CAP` | Daily cap on survey rewards per account (default 100) |
| `WITHDRAW_MIN_TOKENS` | «Вывод доступен от X» on the rewards screen (button stays disabled) |
| `REG_PROMPT_AFTER_SWIPES` | Sign-up sheet after the N-th swipe (default 5) |
| `SURVEY_EVERY_N_LIKES` | Survey after every N-th right swipe (default 5) |
| `NEUTRAL_SLOT_SHARE` | Share of feed cards outside the user's interests (default 0.2) |

## Catalog

```bash
npm run seed:parse                    # App Store + Google Play + seed/web-sources.json
npm run seed:parse -- --per-topic=4   # more store apps per topic (default 3)
npm run seed:parse -- --only=web      # ios | android | web
npm run seed:parse -- --dry           # print only
npm run seed:parse -- --regen         # regenerate oneLiner/topics with Claude
```

- App Store via the official iTunes Search API, Google Play via `google-play-scraper`, web services via `og:` tags.
  `robots.txt` is checked, 1–2 s pause between requests, own User-Agent.
- One app on iOS and Android becomes one card with two links (matched by name + developer).
- Idempotent: key is `source + sourceId`. A re-run updates scraped fields; cards edited in the admin keep their
  edited name, one-liner, topics, images and links.
- New cards are **unpublished**. Review and publish them at `/admin`. The script prints cards per topic and platform
  and flags topics with fewer than 5.

## Tokens and anti-fraud

Every accrual (sign-up bonus, survey) is created as `pending` («В холде»). The daily job judges all pending accruals
created before the current UTC day:

- survey filled in under 4 s → rejected;
- 5 surveys in a row with identical answers → all of them rejected;
- the same comment (normalized, 12+ chars) from different accounts → rejected;
- survey rewards above `DAILY_TOKEN_CAP` per day → rejected (the sign-up bonus is not counted against the cap);
- 4th and later account within 24 h on one anonymous id or IP hash → sign-up bonus rejected.

Run it with `npm run cron:verify` (add `-- --include-today` to also judge today's accruals when testing), or
`POST /api/cron/verify` with `Authorization: Bearer $CRON_SECRET` (`?includeToday=1` likewise).

Rate limits: 60 swipes/min per user (in memory — fine for one instance), 5 code requests/hour per email, 5 attempts per code.

## Deploy on Railway

1. New project → **Deploy from GitHub repo** → this repository.
2. Add the **PostgreSQL** plugin and reference its `DATABASE_URL` in the service variables; add the other variables above.
3. Build `npm run build`, start `npm run start` (runs `prisma migrate deploy`, then `next start` on `$PORT`) —
   both are in `railway.json`.
4. Daily check: a second service from the same repo (same variables), **Cron Schedule** `0 0 * * *`,
   start command `npm run cron:verify`.
5. Catalog: once, from the Railway shell of the web service — `npm run seed:parse` — then publish in `/admin`.

## Map

- `src/app` — pages (`/`, `/set`, `/rewards`, `/signup`, `/admin`) and API routes under `src/app/api`
- `src/components` — feed, swipe card, survey card, details sheet, screens
- `src/lib` — config, session, feed algorithm (`feed.ts`), token check (`tokens.ts`), events
- `scripts` — catalog parser, demo seed, daily token check
- `prisma` — schema and migrations
