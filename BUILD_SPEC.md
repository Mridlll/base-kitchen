# Base Kitchen: live multiplayer build spec

Hand this file and `base-kitchen.html` to Claude Code. The goal is to turn the single-player game into a facilitated live session. It stays a static site on GitHub Pages, and Supabase provides shared state, realtime updates and post-session data.

## 0. Ground rules

- **The game design is frozen.** Do not change questions, options, scoring weights, the hidden DGP (`trueEffect`, `runPilot`), copy, or the palette. The palette is white, `#1E4D2B`, `#3E8E41`, `#A8D5A2` and black, with no coral or warm accents anywhere. Fonts are Baloo 2 and Atkinson Hyperlegible.
- **Solo mode must keep working.** If the page is opened without a room code, or Supabase is unreachable, the game runs exactly as it does now. Live features are an additive layer.
- **Static site only.** Use no build step, no framework and no server. Vanilla JS is fine, and ES modules are fine. Load libraries from `cdn.jsdelivr.net` or `cdnjs.cloudflare.com` at pinned versions.
- **Mobile first for players, projector first for the host view.**

## 1. Repo layout

```
/index.html          game (from base-kitchen.html), plus join screen
/host.html           facilitator view
/js/game.js          game logic extracted from the inline <script>, behaviour unchanged
/js/live.js          Supabase client, join, event logging, score sync
/js/host.js          host view logic
/js/config.js        SUPABASE_URL and SUPABASE_ANON_KEY (anon key is public by design)
/css/game.css        extracted styles (host.html reuses tokens)
/supabase/schema.sql tables, RLS, realtime publication, helper RPCs
/README.md           setup: create Supabase project, run schema, set config, enable Pages
```

Extracting the inline JS and CSS into files is fine. Do it first, as its own commit, and verify the game still plays identically before adding anything else.

## 2. Supabase setup

- Enable **Anonymous sign-ins** under Auth.
- Players and the host both use `supabase.auth.signInAnonymously()`. The session persists in the browser, so a refresh resumes the game.
- Client: `@supabase/supabase-js@2` UMD from jsdelivr, pinned.

### Schema (`supabase/schema.sql`)

```sql
create table rooms (
  code         text primary key,              -- 4 chars, no ambiguous letters (no 0/O/1/I)
  host_id      uuid not null default auth.uid(),
  status       text not null default 'lobby' check (status in ('lobby','live','closed')),
  max_screen   int  not null default 9,        -- host pacing: players can't go past this screen index
  reveal       jsonb not null default '{}',    -- host-controlled reveals, e.g. {"forecast":true}
  created_at   timestamptz default now()
);

create table players (
  id           uuid primary key default auth.uid(),
  room_code    text not null references rooms(code) on delete cascade,
  display_name text not null,                  -- default generated, e.g. "Kodo 17"
  screen       int  not null default 0,
  total        numeric not null default 0,
  joined_at    timestamptz default now(),
  updated_at   timestamptz default now()
);

create table scores (
  player_id    uuid references players(id) on delete cascade,
  room_code    text not null,
  section      text not null,                  -- act1, act2, forecast, act3, pubbias, act4, darkpat, act5
  points       numeric not null,
  primary key (player_id, section)
);

create table events (
  id           bigserial primary key,
  room_code    text not null,
  player_id    uuid not null default auth.uid(),
  section      text not null,
  kind         text not null,
  payload      jsonb not null,
  created_at   timestamptz default now()
);
create index on events (room_code, section, kind);
```

### RLS

Turn RLS on for every table. The rules below are the intent; write the policies to match.

- **rooms:** anyone signed in can `select` a room by code (needed to join). Only `host_id = auth.uid()` can `insert` or `update`.
- **players:** a user can `insert` or `update` only the row where `id = auth.uid()`. `select` is allowed for users in the same room (for the leaderboard). Expose only `display_name`, `total` and `screen` to other players via a view or column grants.
- **scores:** a user can `insert` or `update` only their own rows. The host of the room can `select` all rows in it.
- **events:** a user can `insert` only rows with `player_id = auth.uid()` and a `room_code` they belong to. Players cannot `select` other players' events. The host of the room can `select` all of them.
- Add a unit-style check in the README: sign in as player B and confirm you cannot read player A's events.

### Realtime

Add `players`, `scores`, `events` and `rooms` to the `supabase_realtime` publication. Players subscribe to their own `rooms` row, for pacing and reveals. The host subscribes to everything in its room.

## 3. Player flow (`index.html`)

1. **URL handling.** `?room=ABCD` opens the join screen with the code pre-filled. With no param, show a small choice between "Join a session" and "Play solo". Solo is the current game, untouched.
2. **Join screen.** It matches the existing design, with Ragi greeting. There's a room code input and a name field, pre-filled with a generated grain name (Bajra, Jowar, Kodo, Kutki, Ragi, Sanwa, Korra, Cheena plus a number), which the player can edit or keep. Validate that the room exists and isn't `closed`.
3. **Pacing.** If the player reaches a screen index above `rooms.max_screen`, show a friendly holding card on that transition, with Ragi saying something like "Waiting for your facilitator to open the next act." Unlock automatically when the host raises `max_screen`.
4. **Sync.** A small, unobtrusive live dot sits in the top bar: green when connected, outlined when offline. Queue writes offline and flush them on reconnect. Never block gameplay on the network.

## 4. What to log

Hook into the existing code at these points and don't restructure the game to do it. `setScore(k, v)` is the central choke point for scores. Upsert `scores`, then recompute and update `players.total` and `players.screen`. Throttle updates so there's at most one write per 500 ms per table.

| Section | When | `kind` | `payload` |
|---|---|---|---|
| act1 | Check pressed | `spec` | `{who, what, when, often, obs, right: n}` |
| act2 | Check pressed | `placements` | `{c1:"oppP", ..., right: n}` |
| forecast | Each reveal | `forecast` | `{item:"f1", guess, truth}` |
| act3 | Commit | `levers` | `{levers:[...], spent, effect_scale}` |
| pubbias | Each run | `pb_run` | `{n, estimates:[...20], published:[bool...]}` |
| pubbias | Answer | `pb_answer` | `{answer}` |
| act4 | Run pilot | `pilot` | `{outcome, design, prereg, follow, measured, se, scale, comps}` |
| darkpat | Check | `labels` | `{d1:"dark", ..., right: n}` |
| act5 | Check | `pitch` | `{sec, sci, firm, tt, points}` |
| debrief | Enter | `final` | `{total, by_section:{...}}` |

## 5. Host view (`host.html`)

Designed for a projector: large type, high contrast, and no scrolling on the main panels at 1920×1080. Include a dark mode, since this is likely to be projected.

- **Create room.** Generate a code, insert it into `rooms`, and show the code large alongside a join URL and a QR code (use `qrcode` from cdnjs, pinned). Show a live player count, and names popping in with the existing `pop` animation.
- **Pacing bar.** A row of the ten screens. Clicking one sets `max_screen`. Show how many players are on each screen, as small counts above each step.
- **Panels.** These are tabs or a stepper that follows the current act.
  - **Leaderboard:** top 10 by `total`, animated reordering, with names only.
  - **Act 1:** share of the room choosing each option per slot, as stacked bars. The correct option is revealed on click.
  - **Act 2:** a card-by-box heatmap of placements, marking which cards the room misplaced most.
  - **Forecast:** a histogram of guesses per study. Truth lines are hidden until the host clicks Reveal, which also writes `rooms.reveal.forecast = true`. That's the headline moment of the session.
  - **Act 3:** lever popularity bars, and the distribution of `effect_scale` across the room.
  - **Publication machine:** every player's runs pooled into one strip plot using the same journal and file-drawer layout as the game, with the pooled published mean against the true 0.
  - **Act 4:** a design-choice mix, plus a scatter of `measured` against `scale` per player with a 45° line. Colour points by design; the pre-post cluster floating above the line is the point.
  - **Nudge / sludge:** accuracy per element.
  - **Act 5:** the pick distribution per audience.
- **Export.** One button downloads `events` and `scores` for the room as CSV, for later analysis.
- **Close room.** Sets `status = 'closed'`.

Charts can be hand-rolled SVG, which matches the game, or Chart.js from cdnjs. Keep the palette.

## 6. Deploy

- GitHub Pages from `main`, root. Put the anon key in `js/config.js` and document in the README that this is expected, since security comes from RLS.
- Add a `404.html` that redirects to `index.html` while preserving the query string.

## 7. Acceptance checklist

- [ ] Solo mode is identical to the original file, checked by playing it through once.
- [ ] Three browsers (one incognito, one phone) join the same room and all appear on the host within 2 s.
- [ ] Scores and the leaderboard update live. A refresh mid-game resumes on the same screen with the same score.
- [ ] Killing the network mid-act doesn't break play, and the queued writes arrive after reconnecting.
- [ ] Pacing holds players at `max_screen` and releases them live.
- [ ] Forecast truth lines are hidden on the host until Reveal.
- [ ] RLS: a player can't read another player's events or scores, and can't write a row for someone else.
- [ ] The CSV export opens cleanly in pandas: `pd.read_csv` with the `payload` column parseable as JSON.
- [ ] Lighthouse accessibility score of 90 or more on both pages, and reduced motion is respected.
- [ ] The only greens, whites and blacks in either page are the palette's.

## 8. Nice to have, after the checklist passes

- A Supabase SQL view that flattens `forecast` and `pilot` events into tidy tables.
- A "replay the room" mode on `host.html` that reloads a closed room's data for the debrief slide.
