# Slash or Smash — Build Plan (Ready State + Unified Overlay)

**Event date**: Oct 29, 2025  
**Judging**: Judges only, 1 to 5 scale (0.25 increments), 120 second timer  
**Content**: Producer uploads images, queues and reorders them  
**Winner**: Highest average across standalone images  
**Extras**: Manual override, one-time judge codes, per-judge results stage

---

## 1) Roles and Surfaces

**Roles**
- **Producer** controls the show and uploads images
- **Judges** vote 1 to 5 with one-time codes
- **Viewers** see overlay scenes in OBS

**Web surfaces**
- **/control** Producer dashboard  
- **/judge** Judge console  
- **/overlay** **Unified** overlay that renders Ready, Voting, Locked, Results  
- **/overlay/leaderboard** Top images list

---

## 2) Core User Stories

**Producer**
- Upload images, set display name, reorder queue
- **Arm next image (Ready)** to display it without accepting votes
- Start Voting, pause or extend timer, lock votes
- **Cut to Results** within the same overlay source
- Manually adjust a judge’s vote or the final average
- Jump to leaderboard

**Judge**
- Enter one-time code, see current image
- During **Ready**, see "Get ready" status, voting disabled
- During **Voting**, submit 1 to 5, update until lock, clear confirmation

**Viewer**
- See a single overlay that adapts to state: Ready, Voting, Locked, Results
- Leaderboard available as a separate scene when needed

### Experience Map (Broadcast-First)

| Stage | Viewer overlay (OBS) | Producer touchpoints (`/control`) | Judge touchpoints (`/judge`) | Broadcast notes |
| --- | --- | --- | --- | --- |
| **Pre-show / Standby** | Holding card or offline scene; overlay hidden. | Upload images, verify queue, arm first image to stage Ready state. | Codes distributed out-of-band; judges test login but see standby message. | Dry-run checklist: audio bed rolling, confirm browser source cache off, verify timer sync. |
| **Ready (On-air tease)** | Unified overlay shows image + "Get Ready" banner, subtle motion only. | Arms next image, can adjust title/ordering, confirms timer default, cues host via talkback. | Console shows current image preview with disabled rating buttons, status chip "Waiting for host". | Host banter over music, use Ready color palette for vibe without overwhelming viewers. |
| **Voting (Interactive beat)** | Countdown animates, live vote bars climb, average ticker animates for hype. | One-click Start triggers timer; watches live telemetry (votes received, missing judges), taps Extend if chat wants more time. | Buttons 1–5 enabled, tap-able multiple times until satisfied; confirmation toast stays lightweight. | Twitch prediction auto-starts with same clock; host cues chat to lock in Hot vs Not Hot bets; ensure overlay doesn’t obscure Twitch prediction card if using embedded alerts. |
| **Grace / Lock transition** | Timer hits 0 then switches to short "Locking votes…" stinger, bars freeze. | Auto-lock or manual Lock; can trigger manual override before revealing results. | Console displays locked notice, scores disabled, judges can still review last choice. | Twitch prediction resolves automatically off judge average; use sfx (camera shutter) synced with lock to signal urgency; lower-third can tease upcoming reveal. |
| **Results Reveal** | Overlay slides to results rail with per-judge table, big average callout, optional emoji flashes. | Click "Show Results" to cut within same scene; can tweak score or reopen if correction needed. | Immediate feedback: table shows each judge's rating, reopen button appears if producer reopens. | Consider replay cam/dolly shot; emphasize host commentary; make sure results graphics respect safe area and readability on stream. |
| **Intermission / Leaderboard** | Switch OBS to `/overlay/leaderboard` scene; animated list of top images with starfield motion. | Uses scene bar to cut to Leaderboard; may upload additional assets or reorder queue. | Judges remain idle; console shows message "Hang tight" with countdown to next round if known. | Great slot for sponsor bumper or chat engagement; ensure transition stingers align with audio bed. |
| **Wrap / Reset** | Overlay fades to credits or standby graphic. | Resets state to Idle, downloads audit logs if needed, triggers "Show wrap" macro. | Judges console thanks participants, offers optional feedback form link. | Capture clips for social recap; ensure assets archived for VOD editors. |

**Experience priorities**
- Keep viewer hype high with tight transitions and clear state-specific motion.
- Minimize producer clicks during live beats; surface critical status (missing judge, timer) above the fold.
- Ensure judges can recover quickly from device sleeps or reconnects without disrupting the show.
- Provide host cues (visual + audible) that are stream-safe: short, punchy, non-jarring audio cues calibrated for OBS levels.
- Sync Twitch chat engagement via auto Predictions while keeping contingency plan if the API call fails mid-show.

---

## 3) Non-Functional

- **Latency** under 200 ms on local network  
- **No CSV import or export**  
- **Persistence** survives app restarts  
- **Mobile-friendly** judge console  
- **Dark theme** for all UIs

---

## 4) Architecture

### Baseline stack
- Node 20 + Express/Socket.IO backend authored in TypeScript for type safety across server and clients.
- React + Vite frontends for `/control`, `/judge`, `/overlay`, with Tailwind CSS + design tokens to stay on-brand quickly.
- SQLite (better-sqlite3, WAL mode) as the primary store, migrations generated via `drizzle-kit` (TBD) and checked into repo.
- File uploads handled with Multer streaming to hashed filenames in `/uploads`; Sharp used for optional resize/thumbnailing.
- Shared component library and state helpers (likely Zustand or Context) reused across surfaces to keep behaviours consistent.

### Integrations
- OBS browser source (1920x1080, cache disabled) pointing at `/overlay`; optional second source for `/overlay/leaderboard`.
- Socket.IO maintains live sync (timer ticks, vote distributions) between producer, judges, and overlay; REST handles authenticated mutations.
- Twitch Helix API (Predictions) triggered from server when Voting starts/locks; secured with `channel:manage:predictions` OAuth tokens stored server-side.
- Optional future integrations: Twitch EventSub or chat bot for additional overlays, Discord notifications, or analytics export pipeline.

### Twitch predictions automation
- On `round:start` the server creates a Twitch prediction with options `Hot` / `Not Hot` (phrasing configurable); prediction window equals round timer.
- On `round:lock` or results reveal, the server resolves the prediction automatically using the quarter-rounded judge average (>= 3.0 => Hot by current threshold).
- Requires broadcaster + moderator tokens (Producer signs in once to authorize); refresh tokens persisted via Railway secrets (encrypted at rest) and refreshed silently pre-show.
- If a round is reopened, the server cancels the active prediction to refund channel points, then launches a fresh window when voting restarts.
- Failure fallback: log error, notify producer in control UI, allow manual retry or manual resolution directly on Twitch.

### Deployment targets
- Local dev: `pnpm dev` with hot reload, SQLite + uploads stored in repo-local `/data-dev`.
- Staging/previews: Railway Node 20 service using `pnpm install --frozen-lockfile`, persistent volume for `/data`.
- Production: Railway (preferred) or Fly.io fallback using same container image; overlay served via HTTPS with custom domain.
- CDN/asset strategy: static build artefacts served by Express; uploads and audio served from persistent volume, S3 migration considered if asset footprint grows.

### Assumptions
- Single producer runs the dashboard; no concurrent producer sessions or conflict resolution for MVP.
- Judges join on modern mobile browsers (Safari iOS 16+, Chrome Android 12+); reconnect flow rehydrates session via signed cookie.
- Image library stays <2 GB, allowing filesystem + SQLite storage without external CDN.
- Producer station and OBS overlay share LAN for low latency; judges may be remote but expected round-trip <300 ms.
- Twitch channel has Predictions entitlement (Affiliate/Partner) and broadcaster is comfortable granting app OAuth access pre-show.
- Audience is comfortable with a 2-minute voting window; host uses that time for commentary while chat engages with prediction.
- Railway secrets store handles encrypted Twitch tokens and app secrets; rotation handled through Railway dashboard between shows.

### Open technical decisions
- Finalize migration tooling choice (`drizzle-kit`, `kysely`, or hand-rolled SQL) and CI guardrails.
- Decide whether to ship one multi-surface SPA or discrete bundles per route to optimize load-time and caching for judges.
- Confirm monitoring/logging (Sentry, Railway logs, or custom dashboard) requirements for live debugging during show.
- Lock in timer authority approach: server-driven ticks with drift correction vs overlay-local animation eased by occasional sync packets.
- Determine audio cue delivery: baked into overlay with user-controlled volume vs triggered inside OBS as separate audio source.
- Determine retention policy for Twitch prediction IDs and resolution payloads stored per round (auto purge vs archived).

---

## 5) Data Model

- **images**  
  `id TEXT PK, name TEXT, file_path TEXT, uploaded_at INT, status TEXT`  
- **queue**  
  `image_id TEXT PK, ord INT`  
- **judges**  
  `id TEXT PK, name TEXT, code TEXT UNIQUE, redeemed INT, active INT`  
- **votes**  
  `image_id TEXT, judge_id TEXT, score INT, ts INT, PRIMARY KEY(image_id, judge_id)`  
- **run_state**  
  `key TEXT PK, val TEXT`  
- **settings**  
  `key TEXT PK, val TEXT`  (timer default, grace seconds, theme, encrypted Twitch tokens)
- **rounds** *(optional for analytics & tie-breaks)*  
  `image_id TEXT PK, armed_ts INT, started_ts INT, locked_ts INT, reopened_count INT DEFAULT 0, twitch_prediction_id TEXT`

Note: No contestants table. Each image stands alone.

---

## 6) State Machine

States:
- **Idle** waiting for next image  
- **Ready** image visible to judges and overlay, voting disabled  
- **Voting** image visible, timer ticking, votes accepted  
- **Locked** votes closed, compute results  
- **Results** show per-judge table and averages  
- **Leaderboard** optional intermission scene

Transitions:  
- Idle → **Ready** (arm next image)  
- **Ready** → **Voting** (start, timer begins)  
- **Voting** → **Locked** (lock or timer + grace)  
- **Locked** → **Results** (producer cuts to results)  
- **Results** → Idle or Leaderboard  
- From Results → **Ready** (arm next image)  
- **Voting** → **Ready** (preview without timer, optional)  
- **Locked** → **Voting** (reopen voting, if allowed)

---

## 7) Auth and Judge Codes

**One-time codes**
- Producer creates codes in Control
- Judge visits **/judge**, enters code
- Server marks code redeemed, binds to `judge_id` in session cookie
- Codes expire on use or after show ends

**Producer**
- Password set on first run and stored hashed

---

## 8) Timers and Voting Rules

- Default 120 seconds per image (aligned with Twitch prediction window)  
- **Ready has no countdown** (optional pre-roll seconds can be a setting)  
- Producer can Start, Pause, Resume, Extend (+30s increments)  
- **Grace** 3 to 5 seconds after 0 to accept late packets, then hard lock  
- One vote per judge per image, last write wins until lock  
- Twitch prediction auto-closes when timer hits zero; reopening cancels/refunds the prior prediction and spawns a fresh window on the next `round:start`

---

## 9) Manual Override

Producer can:
- Edit a specific judge’s score for current or past image  
- Set final average directly for an image  
- Reopen a round, clear or keep existing votes  

All overrides are logged to an internal audit table for safety.

---

## 10) Unified Overlay and UI

**/overlay** (single route, state-aware)
- Always shows the current image
- **State banner**: Ready, Voting, Locked, Results
- **Ready**: “Get ready” banner, no timer, voting disabled
- **Voting**: 120s countdown, live 1..5 distribution bars, rolling average
- **Locked**: subtle “Votes locked” banner, freeze vote bars
- **Results**: per-judge table, big average and total votes rounded to nearest quarter point

**/overlay/leaderboard**
- Grid or list of top N images with image name and average
- Tie break by average, then earlier **started_ts** wins (fallback to locked_ts)
- Averages displayed at quarter-point resolution for consistency with judging

---

## 11) Deployment & Hosting (Railway)

- **Railway service** running Node 20, build with `pnpm install --frozen-lockfile` then `pnpm run build`, start via `pnpm run start`.
- **SQLite + uploads** stored on a Railway persistent volume mounted at `/data`; app writes DB to `/data/db.sqlite` and images to `/data/uploads`.
- **Environment variables** injected through Railway dashboard (`PORT`, `SESSION_SECRET`, `PRODUCER_SETUP_TOKEN`, optional `OVERLAY_CACHE_BUST` flag).
- **Static assets** (starfield, fog, sounds) bundled with frontend build; express serves `/assets` and `/uploads` from volume.
- **Deployment flow**: push to `main` triggers Railway rebuild; staging branch optional for preview; use health check endpoint `/health` for readiness.
- **OBS config**: point browser source to Railway public URL with cache disabled; provide fallback instructions if using `railway run` for local rehearsal.

**/judge**
- During **Ready**: show image, disabled 1..5 buttons, status strip “Get ready”
- During **Voting**: big buttons 1..5, selection highlighted, status “Voting”
- During **Locked**: inputs disabled, status “Locked”
- If reopened, prior vote is preselected

**/control**
- Upload images, drag to reorder queue
- **Arm (Ready)**, **Start (Voting)**, Pause, Extend, Lock, **Cut to Results**, Reopen
- Override panel per judge
- Buttons: Overlay, Leaderboard
- Settings: default timer, grace, theme, judge codes management, optional pre-roll seconds, Twitch integration status (connect, retry, disable)

---

## 12) Sockets and REST

**Socket events**
- `round:arm {imageId, name}` → overlay/judges display image, votes disabled  
- `round:start {imageId, duration}` → Voting begins, timer starts  
- `timer:tick {remaining}`  
- `vote:cast {judgeId, imageId, score}` from judge  
- `vote:update {imageId, avg, dist, judgeCount}` to overlay  
- `round:lock {imageId}`  
- `round:reopen {imageId}`  
- `round:state {state}` optional explicit push for Ready/Voting/Locked/Results  
- `scene:change {scene}` reserved for switching to leaderboard

**REST endpoints**
- `POST /api/login` producer password  
- `POST /api/judges/codes` create or revoke codes  
- `POST /api/judge/redeem` judge code to session  
- `POST /api/images` multipart upload  
- `GET /api/queue` list, `PUT /api/queue` reorder  
- `POST /api/control/arm` set next image to Ready  
- `POST /api/control/start` start Voting for armed image with duration  
- `POST /api/control/pause`, `POST /api/control/resume`, `POST /api/control/extend`  
- `POST /api/control/lock`, `POST /api/control/cutResults`, `POST /api/control/reopen`  
- `POST /api/control/override` set judge score or final average  
- `GET /api/leaderboard` computed top list
- `GET /api/integrations/twitch/status`, `POST /api/integrations/twitch/connect` (OAuth), `POST /api/integrations/twitch/prediction/retry` for manual recoveries

---

## 13) Minimal Algorithm Notes

**Average and distribution**
- On each vote, recompute `avg = Math.round((sum(scores) / judge_count) * 4) / 4` to snap to nearest 0.25.
- Distribution as counts for 1..5 for overlay bars

**Leaderboard**
- Precompute after each lock or on demand
- Sort by average desc, then by `started_ts` asc, then `locked_ts` asc

**Uploads**
- Accept PNG, JPG, WEBP
- Store as `/uploads/<hash>.<ext>`
- Keep original filename as `name` default

---

## 14) Asset Checklist & Repo Skeleton

**Visual overlays**
- [x] Starfield SVG tile (1024px) with alpha 0.08, seamless repeat
- [x] Mist/fog PNG layer (alpha ~0.12) for intermission wipes
- [x] Sticker-style frames/decals for Ready/Voting/Locked/Results badges
- [ ] Leaderboard card background + trophy/medal icons (Specter/Bone palette)

**Fonts & typography**
- [ ] Chakra Petch (Semibold, Medium, Regular) webfont kit
- [ ] Space Grotesk (backup UI font) webfont kit
- [ ] Creepster (display headlines) WOFF2 + usage licensing check
- [ ] Optional Rubik Glitch/Rubik Mono One (stream-safe fallback) WOFF2
- [ ] Font licensing docs saved to `/docs/licenses/`

**Audio cues**
- [ ] Ready ambient loop (≤ 20s, seamless, -18 LUFS target)
- [ ] Voting tick (1 Hz, accelerates in final 10s variant)
- [ ] Lock stinger (camera-shutter style thump)
- [ ] Results swell + chime (2–3s, duck-friendly)
- [ ] Fail-safe silent tracks for OBS routing tests

**UI & control assets**
- [ ] Judge console emoji set or vote confirmation stickers
- [ ] Button hover/active shadows exported as SVG or CSS-ready values
- [ ] Producer dashboard icon set (Phosphor/Lucide selection with license confirmation)
- [ ] Twitch prediction status badges (success, retry, disconnected)

**Docs & comms**
- [ ] Brand palette reference sheet (hex + usage)
- [ ] OBS browser source setup instructions (with screenshots)
- [ ] Twitch OAuth integration guide (steps for broadcaster authorization)
- [ ] Show rundown template (CSV/Notion) aligning with asset triggers

**Repository skeleton**
```text
/assets/
  /audio/            # Raw + mastered cue files (WAV + MP3 render)
  /fonts/            # Webfont kits (.woff2, license txt)
  /visual/
    /overlays/       # Overlay backgrounds, badges, glow elements
    /textures/       # Starfield, fog, noise layers
    /stickers/       # Sticker-style decals, mascots
/docs/
  /licenses/         # Font/audio licensing receipts
  /runbooks/         # OBS + Twitch setup guides
/public/
  /sounds/           # Minified audio for production (ogg/mp3)
  /images/           # Optimized overlay assets for serving
/src/
  /assets/           # Imported SVG/JSON tokens for frontends
  /styles/           # Design tokens, Tailwind config fragments
/scripts/
  prepare-assets.ts  # Future pipeline to optimize/convert assets
```

Use `/assets/` for raw source files (keep version-controlled). `/public/` hosts processed, production-ready assets that Vite can serve. Document integration steps in `/docs/runbooks/` so the producer can rehearse without engineering support.
