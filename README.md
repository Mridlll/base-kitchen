# Base Kitchen

A behavioural science capstone game for the SFS learning deep dive. Players take a vague brief ("get people eating more millets") through specification, COM-B diagnosis, intervention design, evaluation and pitching, in about 25 minutes.

It runs two ways:

- **Solo.** Open the page and choose *Play solo*. Nothing leaves the browser.
- **Live session.** A facilitator opens a room on `host.html` and puts it on the projector. Players join on their phones with a four-letter code. The facilitator paces the acts, and the room's answers appear live as charts.

It's a static site on GitHub Pages. Supabase provides sign-in, the shared data and the live updates.

| Page | Who | What |
|---|---|---|
| `index.html` | Players | The game, plus the join screen |
| `host.html` | Facilitators | Room code and QR, pacing, live panels, CSV export |

## Setup

These steps only need doing once per Supabase project.

1. **Create a Supabase project.** Copy its Project URL and publishable key into `js/config.js`.
   The key is meant to be public. Security comes from the row level security policies in the migration, not from hiding the key.
2. **Switch on anonymous sign-ins.** Go to Authentication → Sign In / Providers → *Allow anonymous sign-ins*, then Save.
3. **Raise the anonymous sign-in rate limit.** Go to Authentication → Rate Limits. By default, Supabase allows about 30 anonymous sign-ins per hour from one IP address. A room full of people on the same Wi-Fi shares one IP, so raise it above the number of players you expect.
4. **Create the tables.** Use one of these:
   - Connect the GitHub repo under Project Settings → Integrations → GitHub, with the Supabase directory set to `.` and *Deploy to production* on. Every file in `supabase/migrations/` is then applied when it's merged to `main`.
   - Or paste `supabase/migrations/20260925120000_live_session.sql` into the SQL Editor and run it.
5. **Set the facilitator passcode.** In the SQL Editor, run:
   ```sql
   select set_host_passcode('a long passphrase you share with co-facilitators');
   ```
   Only a bcrypt hash is stored, and it can't be read or reset from the browser. Run it again any time to change the passcode.
6. **Turn on GitHub Pages.** Go to Settings → Pages → Deploy from a branch → `main`, `/ (root)`.

## Running a session

1. Open `host.html`, enter the passcode and click **Open a new room**.
2. Put it on the projector. Players scan the QR code, or go to the site and type the code.
3. **Pacing bar:** click a step to let players go that far. Anyone who gets ahead sees a "hold on" card and moves on automatically when you open the next step. The big numbers show how many players are on each screen. "Waiting" counts players held at the gate.
4. **Panels:** these follow the pacing unless you pick a tab yourself. Click *Follow pacing* to go back to following.
   - **Act 1:** click *Reveal answers*.
   - **Forecast:** the true values stay hidden until you click *Reveal the truth*. That's the headline moment.
   - **Act 4:** the scatter shows each pilot against its effect at scale. Before-and-after pilots float above the diagonal.
5. **Export CSV** downloads two files: `…-events.csv` and `…-scores.csv`.
6. **Close room** stops recording. Players can finish playing. Closed rooms stay in the *Rooms* list, where you can replay them for a debrief.

Players can look back at any page they've finished with the *Look back* link at the top of each screen, including while they're held at the pacing gate. Earlier pages are shown read-only, exactly as they left them, and the host opening the next act moves them on with everyone else.

Players who refresh mid-game carry on from the same screen with the same score. The exception is a screen they hadn't finished: that one starts again. If the connection drops, play continues. Writes are queued in the browser and sent on reconnect, and the dot in the top bar shows whether it's live.

## Data

| Table | One row per | Notes |
|---|---|---|
| `rooms` | session | `max_screen` is the pacing gate; `reveal` holds host reveals |
| `players` | player | name, current screen, total |
| `scores` | player × section | section points, same as the in-game breakdown |
| `events` | action | `section`, `kind` and a JSON `payload` (see `BUILD_SPEC.md` §4) |

The views `forecast_tidy` and `pilot_tidy` flatten the forecast and pilot events for analysis.

Reading the export in pandas:

```python
import json, pandas as pd
ev = pd.read_csv("base-kitchen-ABCD-2026-10-01-events.csv")
ev["payload"] = ev["payload"].map(json.loads)
```

### Who can see what

Row level security is on for every table.

- A player can write only their own rows, and only into a room they joined.
- A player can't read anyone else's events or scores.
- The room's host can read everything in that room.
- Rooms can only be created through `create_room()`, which checks the passcode.

To check it yourself, sign in anonymously as two players in the same room. Player B selecting from `events` gets no rows, and inserting a `scores` row with player A's `player_id` is rejected.

## Files

```
index.html           the game, plus the join screen
host.html            facilitator view
404.html             redirects unknown paths to the game, keeping ?room=
css/game.css         game styles and palette tokens
css/live.css         join screen and live dot
css/host.css         facilitator view
js/game.js           game logic, with small hooks for the live layer
js/live.js           Supabase sign-in, joining, pacing, sync, offline queue
js/host.js           facilitator view logic and charts
js/config.js         Supabase URL and publishable key
supabase/migrations/ tables, policies, realtime, RPCs
```

The game design is frozen: questions, scoring, the hidden world model and the palette (white, `#1E4D2B`, `#3E8E41`, `#A8D5A2`, black) don't change.
