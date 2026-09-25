/* Base Kitchen: live session layer.
   Adds joining, pacing, score sync and event logging on top of js/game.js.
   Without a room, or when Supabase can't be reached, the game runs solo as before. */
(() => {
"use strict";

const CFG = window.BK_CONFIG || {};
const THROTTLE = 500;           // ms between writes to any one table
const RETRY = 3000;             // ms before retrying after a failed write
const GRAINS = ["Bajra","Jowar","Kodo","Kutki","Ragi","Sanwa","Korra","Cheena"];
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const TITLES = {
  intro:"the introduction", act1:"Act 1: Say who does what", act2:"Act 2: Diagnose the planner",
  forecast:"Interlude: Forecast the evidence", act3:"Act 3: Spend the budget",
  pubbias:"Interlude: The publication machine", act4:"Act 4: Test it, then scale it",
  darkpat:"Interlude: Nudge, boost, sludge, or dark pattern?", act5:"Act 5: Make the case three ways",
  debrief:"the debrief"
};

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} }
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const grainName = () => `${GRAINS[Math.floor(Math.random()*GRAINS.length)]} ${10 + Math.floor(Math.random()*90)}`;

let G, sb, uid, room = null, code = null, channel = null;
let connected = false, closed = false, pendingScreen = null;
let queue = [], dirtyScores = {}, dirtyPlayer = false;
let timer = null, lastWrite = 0;

const L = window.BKLive = { active:false, boot, log, score, allow, entered };

const snapKey = () => `bk-live-${code}-${uid}`;
const queueKey = () => `bk-queue-${uid}`;
const stage = () => $("#stage");

function paint(html){
  const st = stage();
  st.innerHTML = html; st.className = ""; void st.offsetWidth; st.className = "fade-in";
  window.scrollTo({top:0, behavior: G.reduced ? "auto" : "smooth"});
  st.focus({preventScroll:true});
}

/* ---------- boot ---------- */
function boot(api){
  G = api;
  const want = (new URLSearchParams(location.search).get("room") || "").toUpperCase().trim();
  if (!window.supabase || !CFG.SUPABASE_URL){ G.render(); return; }   // library didn't load: solo
  try {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true}});
  } catch (e) { console.error(e); G.render(); return; }
  if (want) resume(want); else choose();
}

async function session(){
  const { data:{ session: s } } = await sb.auth.getSession();
  if (s){ uid = s.user.id; return; }
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  uid = data.user.id;
}

/* ---------- entry screens ---------- */
function choose(){
  paint(`
    <p class="act-tag">SFS learning deep dive, capstone</p>
    <h1>Base Kitchen</h1>
    <p class="lede">Playing along with a facilitator, or on your own?</p>
    <div class="row"><button class="btn" id="lvJoin" type="button">Join a session</button><button class="btn ghost" id="lvSolo" type="button">Play solo</button></div>`);
  G.say("Hello! I'm Ragi. If your facilitator gave you a room code, join the session. Otherwise, play solo.", "idle");
  $("#lvJoin").onclick = () => join("");
  $("#lvSolo").onclick = solo;
}

function solo(){
  history.replaceState(null, "", location.pathname);
  G.render();
}

function join(prefill, err){
  paint(`
    <p class="act-tag">Live session</p>
    <h2>Join the kitchen</h2>
    <p>Your facilitator will put a four-letter room code on the screen.</p>
    <form id="lvForm" class="panel lv-form" novalidate>
      <label class="lv-label" for="lvCode">Room code</label>
      <input id="lvCode" class="lv-input lv-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" required value="${esc(prefill || "")}" aria-describedby="lvErr">
      <label class="lv-label" for="lvName">Your name <span>shown on the leaderboard</span></label>
      <div class="lv-namerow">
        <input id="lvName" class="lv-input" maxlength="24" autocomplete="nickname" required value="${esc(grainName())}">
        <button type="button" class="btn ghost" id="lvShuffle">Another name</button>
      </div>
      <p class="lv-err" id="lvErr" role="alert">${esc(err || "")}</p>
      <div class="row"><button class="btn" id="lvGo" type="submit">Join</button><button class="btn ghost" type="button" id="lvSolo">Play solo instead</button></div>
    </form>`);
  G.say(prefill ? "Namaste! Your room code is filled in. Keep the grain name or type your own." : "Namaste! Type the room code from the big screen. Keep the grain name or type your own.", "idle");
  const codeIn = $("#lvCode"), nameIn = $("#lvName"), errEl = $("#lvErr"), goBtn = $("#lvGo");
  codeIn.oninput = () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  $("#lvShuffle").onclick = () => { nameIn.value = grainName(); };
  $("#lvSolo").onclick = solo;
  if (!prefill) codeIn.focus({preventScroll:true});
  $("#lvForm").onsubmit = async e => {
    e.preventDefault();
    const c = codeIn.value.trim().toUpperCase(), name = nameIn.value.trim().replace(/\s+/g, " ");
    if (!CODE_RE.test(c)){ errEl.textContent = "Room codes are four letters or numbers, like KX7P."; codeIn.focus(); return; }
    if (!name){ errEl.textContent = "Pick a name, or tap Another name."; nameIn.focus(); return; }
    errEl.textContent = ""; goBtn.disabled = true; goBtn.textContent = "Joining…";
    try {
      await session();
      const r = await fetchRoom(c);
      if (!r) throw new Error("There's no session with that code. Check the screen and try again.");
      if (r.status === "closed") throw new Error("That session has already ended.");
      const { error } = await sb.from("players").upsert(
        {id:uid, room_code:c, display_name:name, screen:0, waiting:false, total:0, updated_at:new Date().toISOString()},
        {onConflict:"id"});
      if (error) throw error;
      code = c; store.del(snapKey());
      start(r, null);
    } catch (ex) {
      console.error(ex);
      errEl.textContent = ex && ex.message && !/fetch|network/i.test(ex.message) ? ex.message : "Couldn't reach the session. Check your connection, or play solo.";
      goBtn.disabled = false; goBtn.textContent = "Join";
    }
  };
}

async function fetchRoom(c){
  const { data, error } = await sb.from("rooms").select("code,status,max_screen,reveal").eq("code", c).maybeSingle();
  if (error) throw error;
  return data;
}

// Opened with ?room=CODE: pick up where this browser left off, or ask to join.
async function resume(c){
  if (!CODE_RE.test(c)) return join("", "That link's room code doesn't look right. Type the code from the screen.");
  let s = null;
  try {
    await session();
    code = c; s = store.get(snapKey());
    const r = await fetchRoom(c);
    if (!r) return join("", "There's no session with that code.");
    if (r.status === "closed") return join("", "That session has already ended.");
    const { data: me } = await sb.from("players").select("room_code").eq("id", uid).maybeSingle();
    if (me && me.room_code === c) return start(r, s && s.S);
    return join(c);
  } catch (e) {
    console.error(e);
    if (uid && s && s.room) return start(s.room, s.S);   // offline refresh: carry on from this browser's copy
    return join(c, "Couldn't reach the session right now. Try again, or play solo.");
  }
}

/* ---------- running a live game ---------- */
function start(r, snap){
  room = r; code = r.code; closed = false; L.active = true;
  history.replaceState(null, "", `${location.pathname}?room=${code}`);
  addDot();
  queue = store.get(queueKey()) || [];
  subscribe();
  window.addEventListener("online", () => { refreshRoom(); schedule(); });
  window.addEventListener("offline", setDot);
  if (snap){
    G.load(snap);
    dirtyScores = {...G.state().score}; dirtyPlayer = true;   // resync everything this browser knows
    G.go(snap.screen);
  } else {
    G.load({});
    G.go(0);
  }
  schedule();
}

function subscribe(){
  channel = sb.channel(`bk-room-${code}-${uid.slice(0,8)}`)
    .on("postgres_changes", {event:"UPDATE", schema:"public", table:"rooms", filter:`code=eq.${code}`}, p => onRoom(p.new))
    .subscribe(status => {
      connected = status === "SUBSCRIBED";
      setDot();
      if (connected){ refreshRoom(); schedule(); }
    });
}

async function refreshRoom(){
  try { const r = await fetchRoom(code); if (r) onRoom(r); } catch {}
}

function onRoom(r){
  if (!r || r.code !== code) return;
  room = {...room, ...r};
  const s = store.get(snapKey()); if (s){ s.room = room; store.set(snapKey(), s); }
  if (room.status === "closed" && !closed){
    closed = true; setDot();
    G.say("Your facilitator has closed this session. Carry on if you like; nothing more is being recorded.", "think");
  }
  if (pendingScreen !== null && (closed || pendingScreen <= room.max_screen)){
    const i = pendingScreen; pendingScreen = null; G.go(i);
  }
}

// Pacing gate, called by go() before a screen changes.
function allow(i){
  if (closed || !room || i <= room.max_screen){ pendingScreen = null; return true; }
  pendingScreen = i;
  dirtyPlayer = true; schedule();
  const name = TITLES[G.SCREENS[i]] || "the next part";
  paint(`
    <p class="act-tag">Live session</p>
    <h2>Hold on a moment</h2>
    <div class="brief"><p>Next up is <b>${esc(name)}</b>. Your facilitator will open it for everyone together. This page moves on by itself, so there's no need to refresh.</p></div>
    <p class="meta">Your score so far: <b>${Math.round(G.total())}</b></p>`);
  G.say("Waiting for your facilitator to open the next act. Good moment for a sip of chai.", "think");
  return false;
}

// Called by go() after a screen renders.
function entered(i){
  pendingScreen = null;
  saveSnap(i);
  dirtyPlayer = true; schedule();
}

function score(k, v){
  dirtyScores[k] = v; dirtyPlayer = true; schedule();
  const S = G.state();
  const finished = k !== "forecast" || Object.keys(S.fcRevealed).length === 4;
  // A finished section resumes on the next screen, so a refresh never replays it.
  saveSnap(finished ? G.SCREENS.indexOf(k) + 1 : S.screen);
}

function log(section, kind, payload){
  queue.push({client_id:uuid(), room_code:code, player_id:uid, section, kind, payload});
  store.set(queueKey(), queue);
  schedule();
}

function saveSnap(screen){
  const S = G.state();
  const o = {...S, done:[...S.done], levers:[...S.levers], screen, act2Sel:null, darkSel:null};
  store.set(snapKey(), {S:o, room});
}

/* ---------- writes: throttled, queued offline, idempotent ---------- */
function schedule(delay){
  if (timer) return;
  const wait = delay ?? Math.max(0, lastWrite + THROTTLE - Date.now());
  timer = setTimeout(flush, wait);
}

async function flush(){
  timer = null;
  if (!L.active || closed) return;
  if (!navigator.onLine){ setDot(); return; }
  lastWrite = Date.now();
  let failed = false;

  if (queue.length){
    const batch = queue.slice(0, 50);
    const { error } = await sb.from("events").upsert(batch, {onConflict:"client_id", ignoreDuplicates:true});
    if (error){ failed = true; console.warn("events", error.message); }
    else { queue.splice(0, batch.length); store.set(queueKey(), queue); }
  }

  const secs = Object.entries(dirtyScores);
  if (secs.length){
    const rows = secs.map(([section, points]) => ({player_id:uid, room_code:code, section, points}));
    const { error } = await sb.from("scores").upsert(rows, {onConflict:"player_id,section"});
    if (error){ failed = true; console.warn("scores", error.message); }
    else secs.forEach(([s, v]) => { if (dirtyScores[s] === v) delete dirtyScores[s]; });
  }

  if (dirtyPlayer){
    dirtyPlayer = false;
    const S = G.state();
    const { error } = await sb.from("players").update({
      total: Math.round(G.total()*10)/10, screen: S.screen, waiting: pendingScreen !== null,
      updated_at: new Date().toISOString()
    }).eq("id", uid);
    if (error){ failed = true; dirtyPlayer = true; console.warn("players", error.message); }
  }

  setDot(!failed);
  if (failed) schedule(RETRY);
  else if (queue.length || Object.keys(dirtyScores).length || dirtyPlayer) schedule();
}

/* ---------- live dot ---------- */
let lastOk = true;
function addDot(){
  if ($("#liveDot")) return;
  const d = document.createElement("span");
  d.id = "liveDot"; d.className = "live-dot"; d.setAttribute("role", "status");
  const chip = $(".score-chip");
  chip.parentElement.insertBefore(d, chip);
  setDot();
}
function setDot(ok){
  if (typeof ok === "boolean") lastOk = ok;
  const d = $("#liveDot"); if (!d) return;
  const on = connected && navigator.onLine && lastOk && !closed;
  d.classList.toggle("on", on);
  const label = closed ? `Session ${code} closed` : on ? `Live in room ${code}` : `Offline. Your progress is saved and will sync.`;
  d.title = label; d.setAttribute("aria-label", label);
  d.innerHTML = `<span class="lv-sr">${esc(label)}</span>`;
}
})();
