/* Base Kitchen: facilitator view.
   Creates and runs a room: pacing, live panels per act, CSV export, closing. */
(() => {
"use strict";

const CFG = window.BK_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} }
};
const pct = x => `${Math.round(x * 100)}%`;
const fmt = (x, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; };

/* ---------- game content the charts need (mirrors js/game.js; the game design is frozen) ---------- */
const STEPS = [["intro","Intro"],["act1","Act 1"],["act2","Act 2"],["forecast","Forecast"],["act3","Act 3"],["pubbias","Publication"],["act4","Act 4"],["darkpat","Nudge/sludge"],["act5","Act 5"],["debrief","Debrief"]];
const PANELS = [["lobby","Lobby"],["board","Leaderboard"],["act1","Act 1"],["act2","Act 2"],["forecast","Forecast"],["act3","Act 3"],["pubbias","Publication machine"],["act4","Act 4"],["darkpat","Nudge / sludge"],["act5","Act 5"]];
const PANEL_OF_STEP = {intro:"lobby", debrief:"board"};

const A1 = [
  {k:"who", q:"Who needs to act?", right:"planner", opts:[["everyone","everyone in the zone"],["diners","the diners at lunch"],["planner","the menu planner at each base kitchen"],["board","the Railway Board"]]},
  {k:"what", q:"Does what?", right:"serve", opts:[["aware","becomes aware of millet benefits"],["promote","promotes millets"],["serve","serves a millet main as the default lunch"],["love","learns to love millets"]]},
  {k:"when", q:"Where and when?", right:"cycle", opts:[["asap","across India, as soon as possible"],["cycle","at weekday lunch, from the next four-week menu cycle"],["poshan","during Poshan Maah only"]]},
  {k:"often", q:"How often?", right:"three", opts:[["whenever","whenever possible"],["three","on three weekdays a week"],["once","once, as a special millet day"]]},
  {k:"obs", q:"How will we observe it?", right:"register", opts:[["survey","a survey of diner awareness"],["reach","reach of the campaign on Instagram"],["register","kitchen issue registers and servings counted at the counter"]]}
];
const BOXES = [["capP","Physical capability"],["capS","Psychological capability"],["oppP","Physical opportunity"],["oppS","Social opportunity"],["motR","Reflective motivation"],["motA","Automatic motivation"],["bin","Not usable evidence"]];
const CARDS = [
  {id:"c1",src:"Stores ledger",t:"Ragi flour orders left unfilled",a:"oppP"},
  {id:"c2",src:"Head cook interview",t:"Dough sets before 800 plates are done",a:"capP"},
  {id:"c3",src:"Menu planner interview",t:"Not sure I'm allowed to drop rice",a:"motR"},
  {id:"c4",src:"Menu files",t:"Menu copied forward since 2019",a:"motA"},
  {id:"c5",src:"Complaint register",t:"Supervisor: \"go back to normal\"",a:"oppS"},
  {id:"c6",src:"Planner quiz",t:"9 of 12 can't name a volume millet main",a:"capS"},
  {id:"c7",src:"Cost sheet",t:"₹8/kg gap, budget frozen since 2022",a:"oppP"},
  {id:"c8",src:"No source",t:"Millets seen as poor people's food",a:"bin"},
  {id:"c9",src:"Diner survey",t:"78% of diners say millets are healthy",a:"bin"},
  {id:"c10",src:"No source",t:"An op-ed would change their minds",a:"bin"}
];
const FC = [
  {id:"f1",title:"Defaults at Danish conferences",min:0,max:100,unit:"%",truth:87,d:0},
  {id:"f2",title:"Influencers and children's snacks",min:-100,max:500,unit:" kcal",truth:0,d:0},
  {id:"f3",title:"Journals versus nudge units",min:0,max:10,unit:" pp",truth:1.4,d:1},
  {id:"f4",title:"Chile's 2016 food law",min:-50,max:0,unit:"%",truth:-23.7,d:1}
];
const LEVERS = [
  ["default","Millet main as the default, three days a week","core"],["circular","Zonal circular: millet days are allowed","core"],
  ["contract","FPO rate contract, plus top-up","core"],["training","Volume-cooking sessions","core"],
  ["names","Taste-first dish names","tweak"],["position","Millet dish first in the line","tweak"],["scoop","Smaller rice scoop, bigger dal bowl","tweak"],
  ["posters","'Millets are healthy' posters","off"],["influencer","Influencer campaign on WhatsApp","off"],["ban","No rice at all on millet days","off"]
];
const BEST_SCALE = 17.8 * .8;
const DESIGNS = [["prepost","Before and after, keenest kitchen","var(--ink)","var(--ink)"],["rct","Cluster RCT, 20 + 20 kitchens","var(--leaf)","var(--ink)"],["stepped","Stepped-wedge, 40 kitchens","var(--sprout)","var(--ink)"]];
const OUTCOMES = [["servings","Servings counted"],["intent","Stated intentions"],["reach","Campaign reach"]];
const DP = [
  ["d1","Pre-ticked Zappit Gold add-on","dark"],["d2","\"Only 2 left!\" countdown","dark"],["d3","Swap chips for roasted makhana","nudge"],
  ["d4","Cancel Gold by phone, 10 to 11 am","sludge"],["d5","Learn the 5-second label check","boost"],["d6","Most orders near you had a vegetable","nudge"]
];
const DCAT = {nudge:"Nudge", boost:"Boost", sludge:"Sludge", dark:"Dark pattern"};
const AUD = [
  {k:"sec", who:"The state secretary", right:"a", opts:{a:"One budget decision, farmer income, tonnes for FPOs", b:"Transform diets, fight climate change", c:"Significant at 5%, clustered standard errors"}},
  {k:"sci", who:"A peer scientist", right:"b", opts:{a:"A huge jump in millet love", b:"Design, estimate, expected shrinkage, limits", c:"Defaults raise uptake by around 80%"}},
  {k:"firm", who:"A company sourcing head", right:"c", opts:{a:"Get on board or get left behind", b:"Help us save the planet", c:"Tonnes of demand, first supplier locks it in"}},
  {k:"tt", who:"The transparency test", right:"b", opts:{a:"Nothing: telling diners weakens it", b:"Honest board: rice on request", c:"A fake 'rice out of stock' sign"}}
];
// Fills for up to four options in a stacked bar, darkest first.
const SEG = [["var(--forest)","var(--on-ink)"],["var(--leaf)","var(--on-ink)"],["var(--sprout)","var(--ink)"],["var(--mist)","var(--ink)"]];

/* ---------- state ---------- */
let sb, uid, room = null, chan = null;
const players = new Map(), scores = new Map(), events = new Map();
const seenNames = new Set();
let panel = "lobby", follow = true, showA1 = false, drawTimer = null, lastDraw = 0, closeArmed = null;

/* ---------- boot ---------- */
const main = $("#main"), headRoom = $("#headRoom");
setupTheme();
if (!window.supabase || !CFG.SUPABASE_URL){
  main.innerHTML = `<div class="gate"><h1>Base Kitchen</h1><p class="lede">Couldn't load the live session library. Check the internet connection and reload.</p></div>`;
} else {
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true}});
  boot().catch(e => { console.error(e); gate(`Couldn't connect: ${e.message || e}`); });
}

async function boot(){
  const { data:{ session } } = await sb.auth.getSession();
  if (session) uid = session.user.id;
  else { const { data, error } = await sb.auth.signInAnonymously(); if (error) throw error; uid = data.user.id; }
  const want = (new URLSearchParams(location.search).get("room") || store.get("bk-host-room") || "").toUpperCase();
  if (want){
    const { data } = await sb.from("rooms").select("*").eq("code", want).maybeSingle();
    if (data && data.host_id === uid) return openRoom(data);
  }
  gate();
}

function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- theme ---------- */
function setupTheme(){
  const btn = $("#themeBtn");
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const label = () => { btn.textContent = isDark() ? "Light mode" : "Dark mode"; };
  btn.onclick = () => {
    const t = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = t; store.set("bk-host-theme", t); label();
  };
  label();
}

/* ---------- gate: passcode, new room, reopen ---------- */
async function gate(err){
  document.body.classList.remove("in-room");
  headRoom.innerHTML = "";
  const { data: mine } = await sb.from("rooms").select("code,status,created_at").eq("host_id", uid).order("created_at", {ascending:false}).limit(8);
  main.innerHTML = `
    <div class="gate fade-in">
      <p class="act-tag">Facilitators</p>
      <h1>Start a session</h1>
      <p class="lede">Enter the passcode to open a room.</p>
      <form id="gForm" class="panel" novalidate>
        <label class="lv-label" for="gPass">Passcode</label>
        <input id="gPass" class="lv-input" type="password" autocomplete="current-password" required>
        <p class="lv-err" id="gErr" role="alert">${esc(err || "")}</p>
        <div class="row"><button class="btn" id="gGo" type="submit">Start a room</button></div>
      </form>
      ${mine && mine.length ? `<h3>Earlier rooms</h3>
      <ul class="rooms">${mine.map(r => `<li><b>${esc(r.code)}</b><span class="h-status ${r.status}">${esc(r.status)}</span><span class="meta">${new Date(r.created_at).toLocaleString()}</span><button class="btn ghost h-small" data-code="${esc(r.code)}" type="button">Open</button></li>`).join("")}</ul>` : ""}
    </div>`;
  $("#gForm").onsubmit = async e => {
    e.preventDefault();
    const b = $("#gGo"), errEl = $("#gErr");
    b.disabled = true; b.textContent = "Opening…"; errEl.textContent = "";
    const { data, error } = await sb.rpc("create_room", {p_passcode: $("#gPass").value});
    if (error){
      errEl.textContent = /passcode/i.test(error.message) ? error.message + "." : `Couldn't open a room: ${error.message}`;
      b.disabled = false; b.textContent = "Start a room"; return;
    }
    const { data: r } = await sb.from("rooms").select("*").eq("code", data).single();
    openRoom(r);
  };
  $$(".rooms [data-code]").forEach(b => b.onclick = async () => {
    const { data: r } = await sb.from("rooms").select("*").eq("code", b.dataset.code).single();
    if (r) openRoom(r);
  });
}

/* ---------- room ---------- */
async function openRoom(r){
  room = r; store.set("bk-host-room", r.code);
  history.replaceState(null, "", `${location.pathname}?room=${r.code}`);
  players.clear(); scores.clear(); events.clear(); seenNames.clear();
  document.body.classList.add("in-room");
  drawHead();
  main.innerHTML = `
    <div class="pace" id="pace" role="group" aria-label="Pacing: players can go up to the highlighted step"></div>
    <p class="pace-note">Click a step to set how far players can go. Numbers = players on each screen.</p>
    <div class="tabs" role="tablist" id="tabs"></div>
    <section class="pane" id="pane" role="tabpanel"></section>`;
  subscribe();
  await loadAll();
  // Players already spread out: follow the furthest open step.
  if (follow) panel = panelFor(room.max_screen);
  draw(true);
}

function joinUrl(){ return new URL(`./?room=${room.code}`, location.href).href; }

function drawHead(){
  const url = new URL("./", location.href);
  const shown = (url.host + url.pathname).replace(/\/$/, "");
  headRoom.innerHTML = `
    <div class="h-join"><p class="meta">Join at</p><div class="h-url">${esc(shown)}</div><p class="meta">with the code</p></div>
    <div class="h-code" aria-label="Room code ${room.code.split("").join(" ")}">${esc(room.code)}</div>
    <div class="h-qr" id="qr" title="Scan to join"></div>
    <div class="h-count"><b id="pCount">0</b><span>players</span></div>
    <span class="h-status ${room.status}" id="status">${esc(room.status)}</span>`;
  const tools = $(".h-tools");
  $$(".h-tools .room-tool").forEach(x => x.remove());
  tools.insertAdjacentHTML("afterbegin", `
    <button class="btn ghost h-small room-tool" id="exportBtn" type="button">Export CSV</button>
    <button class="btn ghost h-small room-tool" id="closeBtn" type="button" ${room.status === "closed" ? "disabled" : ""}>Close room</button>
    <button class="btn ghost h-small room-tool" id="leaveBtn" type="button">Rooms</button>`);
  if (window.QRCode){
    new QRCode($("#qr"), {text: joinUrl(), width: 256, height: 256, colorDark: "#000000", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M});
    const img = $("#qr img"); if (img) img.alt = `QR code for ${joinUrl()}`;
  }
  $("#exportBtn").onclick = exportCsv;
  $("#closeBtn").onclick = closeRoom;
  $("#leaveBtn").onclick = () => { if (chan) sb.removeChannel(chan); chan = null; store.set("bk-host-room", ""); history.replaceState(null, "", location.pathname); gate(); };
}

function subscribe(){
  if (chan) sb.removeChannel(chan);
  const f = `room_code=eq.${room.code}`;
  chan = sb.channel(`bk-host-${room.code}`)
    .on("postgres_changes", {event:"*", schema:"public", table:"rooms", filter:`code=eq.${room.code}`}, p => { if (p.new && p.new.code){ room = {...room, ...p.new}; draw(); } })
    .on("postgres_changes", {event:"*", schema:"public", table:"players", filter:f}, p => {
      if (p.eventType === "DELETE") players.delete(p.old.id); else players.set(p.new.id, p.new);
      draw();
    })
    .on("postgres_changes", {event:"*", schema:"public", table:"scores", filter:f}, p => {
      if (p.new && p.new.player_id) scores.set(`${p.new.player_id}|${p.new.section}`, p.new); draw();
    })
    .on("postgres_changes", {event:"INSERT", schema:"public", table:"events", filter:f}, p => { events.set(p.new.id, p.new); draw(); })
    .subscribe(status => { if (status === "SUBSCRIBED" && room) loadAll().then(() => draw()); });
}

async function pageAll(table, order){
  const out = [];
  for (let from = 0; ; from += 1000){
    const { data, error } = await sb.from(table).select("*").eq("room_code", room.code).order(order, {ascending:true}).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function loadAll(){
  try {
    const [ps, ss, es] = await Promise.all([pageAll("players", "joined_at"), pageAll("scores", "section"), pageAll("events", "id")]);
    ps.forEach(p => players.set(p.id, p));
    ss.forEach(s => scores.set(`${s.player_id}|${s.section}`, s));
    es.forEach(e => events.set(e.id, e));
    // Names already in the room don't pop on first load.
    if (!seenNames.size) ps.forEach(p => seenNames.add(p.id));
    const { data: r } = await sb.from("rooms").select("*").eq("code", room.code).single();
    if (r) room = r;
  } catch (e) { console.error(e); toast("Couldn't load the room data. Retrying when the connection is back."); }
}

async function setRoom(patch){
  const prev = {...room};
  room = {...room, ...patch}; draw(true);
  const { error } = await sb.from("rooms").update(patch).eq("code", room.code);
  if (error){ room = prev; draw(true); toast(`Couldn't update the room: ${error.message}`); }
}

function closeRoom(){
  const b = $("#closeBtn");
  if (!closeArmed){
    b.textContent = "Click again to confirm"; b.classList.remove("ghost");
    closeArmed = setTimeout(() => { closeArmed = null; b.textContent = "Close room"; b.classList.add("ghost"); }, 4000);
    return;
  }
  clearTimeout(closeArmed); closeArmed = null;
  setRoom({status:"closed"}).then(() => { b.textContent = "Close room"; b.classList.add("ghost"); b.disabled = true; toast("Room closed. Nothing more is saved."); });
}

/* ---------- derived data ---------- */
const sortedEvents = () => [...events.values()].sort((a, b) => a.id - b.id);
function latest(kind){
  const m = new Map();
  for (const e of sortedEvents()) if (e.kind === kind) m.set(e.player_id, e.payload);
  return m;
}
function forecasts(){
  const m = {}; FC.forEach(f => m[f.id] = new Map());
  for (const e of sortedEvents()) if (e.kind === "forecast" && m[e.payload.item]) m[e.payload.item].set(e.player_id, +e.payload.guess);
  return m;
}
const nameOf = id => (players.get(id) || {}).display_name || "Unknown";
function panelFor(i){ const k = STEPS[clamp(i, 0, 9)][0]; return PANEL_OF_STEP[k] || k; }

/* ---------- drawing ---------- */
function draw(now){
  if (now === true){ clearTimeout(drawTimer); drawTimer = null; return paint(); }
  if (drawTimer) return;
  drawTimer = setTimeout(() => { drawTimer = null; paint(); }, Math.max(0, 250 - (Date.now() - lastDraw)));
}

function paint(){
  lastDraw = Date.now();
  if (!room || !$("#pace")) return;
  $("#pCount").textContent = players.size;
  const st = $("#status"); st.className = `h-status ${room.status}`; st.textContent = room.status;
  const cb = $("#closeBtn"); if (cb && room.status === "closed") cb.disabled = true;
  drawPace(); drawTabs(); drawPane();
}

function drawPace(){
  const on = new Array(10).fill(0), waiting = new Array(10).fill(0);
  players.forEach(p => { const s = clamp(p.screen | 0, 0, 9); on[s]++; if (p.waiting && s < 9) waiting[s + 1]++; });
  $("#pace").innerHTML = STEPS.map(([k, lab], i) => {
    const cls = i < room.max_screen ? "open" : i === room.max_screen ? "limit" : "locked";
    return `<button type="button" class="step ${cls}" data-i="${i}" aria-pressed="${i === room.max_screen}" aria-label="${lab}: ${on[i]} players here${waiting[i] ? `, ${waiting[i]} waiting` : ""}. ${i <= room.max_screen ? "Open" : "Locked"}.">
      <span class="n">${on[i]}</span><span class="lab">${lab}</span><span class="wait">${waiting[i] ? `${waiting[i]} waiting` : i === room.max_screen && i < 9 ? "limit" : ""}</span></button>`;
  }).join("");
  $$("#pace .step").forEach(b => b.onclick = () => {
    if (room.status === "closed") return toast("This room is closed.");
    const i = +b.dataset.i, patch = {max_screen:i};
    if (room.status === "lobby" && i > 0) patch.status = "live";
    if (follow) panel = panelFor(i);
    setRoom(patch);
  });
}

function drawTabs(){
  $("#tabs").innerHTML = PANELS.map(([k, lab]) => `<button type="button" role="tab" class="tab" data-k="${k}" aria-selected="${panel === k}" aria-controls="pane">${lab}</button>`).join("")
    + `<button type="button" class="tab follow" id="followBtn" aria-pressed="${follow}">${follow ? "Auto-switch: on" : "Auto-switch: off"}</button>`;
  $$("#tabs .tab[data-k]").forEach(b => b.onclick = () => { panel = b.dataset.k; follow = false; draw(true); });
  $("#followBtn").onclick = () => { follow = !follow; if (follow) panel = panelFor(room.max_screen); draw(true); };
}

function drawPane(){
  const pane = $("#pane");
  const old = panel === "board" ? rects($$(".brow", pane)) : null;
  pane.innerHTML = (VIEWS[panel] || VIEWS.lobby)();
  pane.querySelectorAll("[data-action]").forEach(b => b.onclick = ACTIONS[b.dataset.action]);
  if (old) flip(old, $$(".brow", pane));
}

function head(title, sub, btn){
  return `<div class="pane-h"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}${btn || ""}</div>`;
}
const answered = m => `${m.size} of ${players.size} answered`;
const empty = msg => `<div class="empty">${msg}</div>`;

const ACTIONS = {
  a1reveal(){ showA1 = !showA1; draw(true); },
  fcreveal(){ setRoom({reveal:{...(room.reveal || {}), forecast: !(room.reveal && room.reveal.forecast)}}); }
};

const VIEWS = {
  lobby(){
    const list = [...players.values()].sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)));
    const html = list.map(p => { const isNew = !seenNames.has(p.id) && !reduced; seenNames.add(p.id); return `<span class="name ${isNew ? "new" : ""}">${esc(p.display_name)}</span>`; }).join("");
    return head("Who's here", `${players.size} joined`)
      + `<div class="pane-b">${list.length ? `<div class="names">${html}</div>` : empty("Waiting for the first player…")}</div>`;
  },

  board(){
    const top = [...players.values()].sort((a, b) => (+b.total) - (+a.total) || String(a.joined_at).localeCompare(String(b.joined_at))).slice(0, 10);
    return head("Leaderboard", "Top 10, out of 100")
      + `<div class="pane-b">${top.length ? `<ol class="board">${top.map((p, i) => `<li class="brow" data-id="${p.id}"><span class="rk">${i + 1}</span><span class="nm">${esc(p.display_name)}</span><span class="tt">${Math.round(+p.total)}</span></li>`).join("")}</ol>` : empty("No scores yet.")}</div>`;
  },

  act1(){
    const m = latest("spec");
    const btn = `<button class="btn ${showA1 ? "ghost" : ""}" type="button" data-action="a1reveal">${showA1 ? "Hide answers" : "Reveal answers"}</button>`;
    if (!m.size) return head("Act 1: say who does what", answered(m), btn) + `<div class="pane-b">${empty("No specs checked yet.")}</div>`;
    const rows = A1.map(g => {
      const counts = g.opts.map(([v]) => [...m.values()].filter(p => p[g.k] === v).length), n = counts.reduce((a, b) => a + b, 0) || 1;
      let x = 0;
      const segs = g.opts.map(([v, t], j) => {
        const w = counts[j] / n * 100, dim = showA1 && v !== g.right ? .28 : 1, s = `<rect x="${x}%" y="0" width="${w}%" height="100%" fill="${SEG[j][0]}" opacity="${dim}" stroke="var(--paper)" stroke-width="2"/>${w > 7 ? `<text x="${x + w / 2}%" y="58%" text-anchor="middle" dominant-baseline="middle" font-family="var(--display)" font-weight="700" font-size="22" fill="${SEG[j][1]}" opacity="${dim}">${Math.round(w)}%</text>` : ""}`;
        x += w; return s;
      }).join("");
      const lg = g.opts.map(([v, t], j) => `<span style="${showA1 && v === g.right ? "color:var(--ink);font-weight:700" : ""}"><i style="background:${SEG[j][0]}"></i>${showA1 && v === g.right ? "✓ " : ""}${esc(t)}</span>`).join("");
      return `<div class="cell" style="flex:1"><h3>${g.q}</h3><svg class="fill-svg" style="height:40px;flex:none" role="img" aria-label="${esc(g.q)} choices">${segs}</svg><div class="lgd">${lg}</div></div>`;
    }).join("");
    return head("Act 1: say who does what", answered(m), btn) + `<div class="pane-b" style="display:flex;flex-direction:column;gap:4px">${rows}</div>`;
  },

  act2(){
    const m = latest("placements");
    if (!m.size) return head("Act 2: diagnose the planner", answered(m)) + `<div class="pane-b">${empty("No diagnoses checked yet.")}</div>`;
    const n = m.size, all = [...m.values()];
    const acc = CARDS.map(c => all.filter(p => p[c.id] === c.a).length / n);
    const worst = new Set(CARDS.map((c, i) => [c.id, acc[i]]).sort((a, b) => a[1] - b[1]).slice(0, 3).filter(x => x[1] < .8).map(x => x[0]));
    const cols = `minmax(260px,1.6fr) repeat(${BOXES.length},minmax(0,1fr)) 90px`;
    let h = `<div class="heat" style="grid-template-columns:${cols};grid-template-rows:auto repeat(${CARDS.length},minmax(0,1fr))"><div></div>`
      + BOXES.map(([, t]) => `<div class="hd">${t}</div>`).join("") + `<div class="hd">Right</div>`;
    CARDS.forEach((c, i) => {
      h += `<div class="rl ${worst.has(c.id) ? "miss" : ""}" style="padding-left:8px"><b>${esc(c.src)}${worst.has(c.id) ? ` <span class="tagp hot">most missed</span>` : ""}</b><span>${esc(c.t)}</span></div>`;
      BOXES.forEach(([k]) => {
        const s = all.filter(p => p[c.id] === k).length / n;
        const [bg, fg] = heatStep(s);
        h += `<div class="c ${k === c.a ? "right" : ""}" style="background:${bg};color:${fg}" title="${esc(c.src)} in ${k}: ${pct(s)}">${s ? pct(s) : ""}</div>`;
      });
      h += `<div class="acc">${pct(acc[i])}</div>`;
    });
    return head("Act 2: diagnose the planner", `${answered(m)}. Darker = more people. Outlined = correct box.`) + `<div class="pane-b">${h}</div></div>`;
  },

  forecast(){
    const fc = forecasts(), shown = !!(room.reveal && room.reveal.forecast);
    const btn = `<button class="btn ${shown ? "ghost" : ""}" type="button" data-action="fcreveal">${shown ? "Hide answers" : "Show answers"}</button>`;
    const n = Math.max(...FC.map(f => fc[f.id].size));
    return head("Forecast the evidence", `${n} of ${players.size} answered. Bars = guesses. Dashed line = room median.`, btn)
      + `<div class="pane-b"><div class="cols grid4">${FC.map(f => {
        const vals = [...fc[f.id].values()];
        return `<div class="cell"><h3>${f.title}</h3><div class="grow">${hist(vals, f, shown)}</div></div>`;
      }).join("")}</div></div>`;
  },

  act3(){
    const m = latest("levers");
    if (!m.size) return head("Act 3: spend the budget", answered(m)) + `<div class="pane-b">${empty("No plans committed yet.")}</div>`;
    const all = [...m.values()], n = all.length;
    const bars = LEVERS.map(([id, t, kind]) => [t, all.filter(p => (p.levers || []).includes(id)).length / n, kind]);
    const fillOf = k => k === "core" ? "var(--forest)" : k === "tweak" ? "var(--sprout)" : "var(--paper)";
    const W = 900, rowH = 44, H = bars.length * rowH;
    const svg = `<svg class="fill-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Share of players choosing each lever">${bars.map(([t, s, k], i) => `
      <text x="0" y="${i * rowH + 28}" font-size="19" fill="var(--ink)">${esc(t)}</text>
      <rect x="440" y="${i * rowH + 8}" width="380" height="28" rx="7" fill="var(--mist)"/>
      <rect x="440" y="${i * rowH + 8}" width="${Math.max(0, s * 380)}" height="28" rx="7" fill="${fillOf(k)}" stroke="var(--ink)" stroke-width="${k === "off" ? 2 : 0}"/>
      <text x="${W}" y="${i * rowH + 29}" text-anchor="end" font-family="var(--display)" font-weight="700" font-size="21" fill="var(--ink)">${pct(s)}</text>`).join("")}</svg>`;
    const eff = all.map(p => +p.effect_scale).filter(Number.isFinite);
    return head("Act 3: spend the budget", answered(m))
      + `<div class="pane-b"><div class="cols two">
        <div class="cell"><h3>Levers picked</h3><div class="lgd"><span><i style="background:var(--forest)"></i>fixes a real bottleneck</span><span><i style="background:var(--sprout)"></i>counter tweak</span><span><i style="background:var(--paper)"></i>information or restriction</span></div><div class="grow">${svg}</div></div>
        <div class="cell"><h3>Effect at scale</h3><p class="meta">Millet servings, pp. One dot per player. Line = best possible plan.</p><div class="grow">${dotplot(eff, 0, 16, BEST_SCALE, "best plan")}</div></div>
      </div></div>`;
  },

  pubbias(){
    const runs = sortedEvents().filter(e => e.kind === "pb_run");
    const ans = latest("pb_answer");
    const dots = [];
    runs.forEach(e => (e.payload.estimates || []).forEach((est, j) => dots.push({est:+est, pub:!!(e.payload.published || [])[j], n:e.payload.n})));
    const pub = dots.filter(d => d.pub), mean = pub.length ? pub.reduce((a, d) => a + d.est, 0) / pub.length : null;
    const right = [...ans.values()].filter(a => a.answer === "b").length;
    const W = 1200, H = 330, X = v => 600 + clamp(v, -14, 14) * 40;
    let h = `<svg class="fill-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Every trial the room ran, published above the line and file drawer below">
      <text x="0" y="36" font-size="22" font-weight="700" fill="var(--ink)">Journal</text>
      <text x="0" y="190" font-size="22" font-weight="700" fill="var(--ink)">File drawer</text>
      <line x1="20" y1="120" x2="${W - 20}" y2="120" stroke="var(--line)" stroke-width="3"/>
      <line x1="${X(0)}" y1="6" x2="${X(0)}" y2="${H - 30}" stroke="var(--leaf)" stroke-width="3" stroke-dasharray="6 6"/>
      <text x="${X(0)}" y="${H - 6}" font-size="18" text-anchor="middle" fill="var(--muted)">true effect 0</text>
      ${[-10, -5, 5, 10].map(v => `<text x="${X(v)}" y="${H - 6}" font-size="18" text-anchor="middle" fill="var(--muted)">${v > 0 ? "+" : ""}${v}</text>`).join("")}`;
    const r = dots.length > 1500 ? 3 : dots.length > 600 ? 4 : 5.5;
    dots.forEach((d, i) => {
      const y = d.pub ? 20 + (i * 37 % 90) : 136 + (i * 53 % 150);
      h += `<circle cx="${X(d.est)}" cy="${y}" r="${d.pub ? r + 1.5 : r}" fill="${d.pub ? "var(--leaf)" : "var(--paper)"}" stroke="var(--ink)" stroke-width="1.2"/>`;
    });
    if (mean !== null) h += `<line x1="${X(mean)}" y1="6" x2="${X(mean)}" y2="114" stroke="var(--ink)" stroke-width="4"/><text x="${X(mean) + 8}" y="112" font-size="18" font-weight="700" fill="var(--ink)">published mean ${fmt(mean)}</text>`;
    h += `</svg>`;
    return head("The publication machine", `All trials from the room. The true effect is zero.`)
      + `<div class="pane-b" style="display:flex;flex-direction:column">
        <div class="pb-stats" style="margin:0 0 8px"><div><b>${dots.length}</b>trials run</div><div><b>${pub.length}</b>published</div><div><b>${mean === null ? "–" : fmt(mean)}</b>published average, pp</div><div><b>0.0</b>true effect, pp</div><div><b>${ans.size ? pct(right / ans.size) : "–"}</b>got the question (${ans.size} answered)</div></div>
        <div style="flex:1;min-height:0">${dots.length ? h : empty("No trials run yet.")}</div></div>`;
  },

  act4(){
    const m = latest("pilot");
    if (!m.size) return head("Act 4: test it, then scale it", answered(m)) + `<div class="pane-b">${empty("No pilots run yet.")}</div>`;
    const all = [...m.values()], n = all.length;
    const mix = (key, opts) => opts.map(([v, t], j) => [t, all.filter(p => p[key] === v).length / n, j]);
    const bars = (title, rows, fills) => `<h3>${title}</h3>${rows.map(([t, s, j]) => `<div class="hbar" style="grid-template-columns:minmax(0,1.3fr) 1fr 64px"><span class="lab" style="font-size:16px">${fills ? `<i style="display:inline-block;width:14px;height:14px;border-radius:50%;border:1.5px solid var(--ink);background:${fills[j]};vertical-align:-2px;margin-right:6px"></i>` : ""}${esc(t)}</span><div class="track"><div class="fill leaf" style="width:${s * 100}%;${fills ? `background:${fills[j]}` : ""}"></div></div><span class="val">${pct(s)}</span></div>`).join("")}`;
    const pts = all.filter(p => p.measured !== null && Number.isFinite(+p.measured));
    const reach = n - pts.length;
    return head("Act 4: test it, then scale it", answered(m))
      + `<div class="pane-b"><div class="cols two" style="grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)">
        <div class="cell" style="overflow:hidden">
          ${bars("Design", mix("design", DESIGNS.map(d => [d[0], d[1]])), DESIGNS.map(d => d[2]))}
          ${bars("Outcome measured", mix("outcome", OUTCOMES))}
          ${bars("Pre-registered", [["Yes", all.filter(p => p.prereg === "yes").length / n, 0]])}
          ${bars("Twelve-week follow-up", [["Yes", all.filter(p => p.follow === "12w").length / n, 0]])}
        </div>
        <div class="cell"><h3>Pilot vs. at scale</h3>
          <p class="meta">One dot per player. On the line = the pilot got it right. ${reach ? `${reach} measured reach only (no dot).` : ""}</p>
          <div class="lgd">${DESIGNS.map(d => `<span><i style="background:${d[2]};border-radius:50%"></i>${d[1]}</span>`).join("")}</div>
          <div class="grow">${scatter(pts)}</div></div>
      </div></div>`;
  },

  darkpat(){
    const m = latest("labels");
    if (!m.size) return head("Nudge, boost, sludge, or dark pattern?", answered(m)) + `<div class="pane-b">${empty("No labels checked yet.")}</div>`;
    const all = [...m.values()], n = all.length;
    const rows = DP.map(([id, t, a]) => {
      const right = all.filter(p => p[id] === a).length / n;
      const wrong = {}; all.forEach(p => { if (p[id] && p[id] !== a) wrong[p[id]] = (wrong[p[id]] || 0) + 1; });
      const top = Object.entries(wrong).sort((x, y) => y[1] - x[1])[0];
      return `<div class="hbar" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 80px;margin:12px 0"><span class="lab" style="font-size:19px"><b>${esc(t)}</b><br><span class="meta">Answer: ${DCAT[a].toLowerCase()}.${top ? ` Common mistake: ${DCAT[top[0]].toLowerCase()} (${pct(top[1] / n)}).` : ""}</span></span><div class="track" style="height:34px"><div class="fill leaf" style="width:${right * 100}%"></div></div><span class="val" style="font-size:26px">${pct(right)}</span></div>`;
    }).join("");
    return head("Nudge, boost, sludge, or dark pattern?", `${answered(m)}. % who got each one right.`) + `<div class="pane-b">${rows}</div>`;
  },

  act5(){
    const m = latest("pitch");
    if (!m.size) return head("Act 5: make the case three ways", answered(m)) + `<div class="pane-b">${empty("No pitches checked yet.")}</div>`;
    const all = [...m.values()], n = all.length;
    return head("Act 5: make the case three ways", `${answered(m)}. ✓ = best line.`)
      + `<div class="pane-b"><div class="cols grid4">${AUD.map(a => `<div class="cell"><h3>${a.who}</h3>${Object.entries(a.opts).map(([v, t]) => {
        const s = all.filter(p => p[a.k] === v).length / n, ok = v === a.right;
        return `<div class="hbar" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) 64px;margin:10px 0"><span class="lab" style="font-size:17px;${ok ? "font-weight:700" : ""}">${ok ? "✓ " : ""}${esc(t)}</span><div class="track"><div class="fill leaf" style="width:${s * 100}%;${ok ? "" : "background:var(--sprout)"}"></div></div><span class="val">${pct(s)}</span></div>`;
      }).join("")}</div>`).join("")}</div></div>`;
  }
};

/* ---------- chart helpers (hand-rolled SVG, palette tokens only) ---------- */
// Share of the room -> fill, in fixed palette steps rather than blended greens.
function heatStep(s){
  if (!s) return ["transparent", "var(--ink)"];
  if (s < .25) return ["var(--mist)", "var(--ink)"];
  if (s < .5) return ["var(--sprout)", "var(--ink)"];
  if (s < .75) return ["var(--leaf)", "var(--on-ink)"];
  return ["var(--forest)", "var(--on-ink)"];
}
function hist(vals, f, shown){
  const W = 700, H = 250, L = 16, R = 16, T = 22, B = 34, bins = 20;
  const X = v => L + (v - f.min) / (f.max - f.min) * (W - L - R);
  const counts = new Array(bins).fill(0);
  vals.forEach(v => counts[clamp(Math.floor((v - f.min) / (f.max - f.min) * bins), 0, bins - 1)]++);
  const mx = Math.max(1, ...counts), bw = (W - L - R) / bins;
  let s = `<svg class="fill-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(f.title)}: ${vals.length} guesses${shown ? `, truth ${f.truth}${f.unit}` : ""}">
    <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="var(--ink)" stroke-width="2"/>`;
  counts.forEach((c, i) => { if (c) s += `<rect x="${L + i * bw + 2}" y="${H - B - c / mx * (H - B - T)}" width="${bw - 4}" height="${c / mx * (H - B - T)}" rx="4" fill="var(--sprout)" stroke="var(--ink)" stroke-width="1.5"/>`; });
  [f.min, (f.min + f.max) / 2, f.max].forEach(v => s += `<text x="${X(v)}" y="${H - 10}" font-size="17" text-anchor="middle" fill="var(--muted)">${+v.toFixed(f.d)}${f.unit.trim() === "%" ? "%" : ""}</text>`);
  const md = median(vals);
  if (md !== null) s += `<line x1="${X(md)}" y1="${T - 12}" x2="${X(md)}" y2="${H - B}" stroke="var(--ink)" stroke-width="3" stroke-dasharray="6 5"/><text x="${X(md)}" y="${T - 14 < 12 ? 14 : T - 14}" font-size="16" font-weight="700" text-anchor="${X(md) > W - 140 ? "end" : X(md) < 140 ? "start" : "middle"}" fill="var(--ink)">room ${+md.toFixed(f.d)}${f.unit}</text>`;
  if (shown){
    const x = X(f.truth);
    s += `<g class="truth-line"><rect x="${x - 5}" y="${T - 4}" width="10" height="${H - B - T + 4}" rx="3" fill="var(--leaf)">${reduced ? "" : `<animate attributeName="height" from="0" to="${H - B - T + 4}" dur=".7s" fill="freeze"/>`}</rect>
      <text x="${x + (x > W - 160 ? -10 : 10)}" y="${T + 18}" font-family="var(--display)" font-weight="800" font-size="26" text-anchor="${x > W - 160 ? "end" : "start"}" fill="var(--forest)">study ${f.truth}${f.unit}</text></g>`;
  }
  return s + `</svg>`;
}

function dotplot(vals, lo, hi, mark, markLabel){
  const W = 700, H = 300, L = 20, R = 20, B = 40;
  const X = v => L + (clamp(v, lo, hi) - lo) / (hi - lo) * (W - L - R);
  const stack = {};
  let s = `<svg class="fill-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Distribution of ${vals.length} values">
    <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="var(--ink)" stroke-width="2"/>`;
  vals.forEach(v => { const b = Math.round(X(v) / 16); stack[b] = (stack[b] || 0) + 1; s += `<circle cx="${b * 16}" cy="${H - B - 9 - (stack[b] - 1) * 16}" r="7" fill="var(--leaf)" stroke="var(--ink)" stroke-width="1.3"/>`; });
  for (let v = lo; v <= hi; v += 4) s += `<text x="${X(v)}" y="${H - 12}" font-size="17" text-anchor="middle" fill="var(--muted)">${v}</text>`;
  if (mark != null) s += `<line x1="${X(mark)}" y1="10" x2="${X(mark)}" y2="${H - B}" stroke="var(--forest)" stroke-width="3" stroke-dasharray="6 5"/><text x="${X(mark) - 8}" y="24" font-size="17" font-weight="700" text-anchor="end" fill="var(--forest)">${markLabel} ${fmt(mark)}</text>`;
  const md = median(vals);
  if (md !== null) s += `<text x="${L}" y="24" font-size="17" font-weight="700" fill="var(--ink)">room median ${fmt(md)}</text>`;
  return s + `</svg>`;
}

function scatter(pts){
  const W = 620, H = 440, L = 58, R = 16, T = 16, B = 50;
  const xs = pts.map(p => +p.scale), ys = pts.map(p => +p.measured);
  const lo = Math.floor(Math.min(0, ...xs, ...ys)), hi = Math.ceil(Math.max(5, ...xs, ...ys) * 1.08);
  const X = v => L + (v - lo) / (hi - lo) * (W - L - R), Y = v => H - B - (v - lo) / (hi - lo) * (H - B - T);
  const step = hi - lo > 40 ? 10 : hi - lo > 16 ? 5 : 2;
  let s = `<svg class="fill-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pilot estimate against effect at scale, ${pts.length} players">`;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step){
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${Y(v) + 6}" font-size="16" text-anchor="end" fill="var(--muted)">${v}</text><text x="${X(v)}" y="${H - B + 22}" font-size="16" text-anchor="middle" fill="var(--muted)">${v}</text>`;
  }
  s += `<line x1="${X(lo)}" y1="${Y(lo)}" x2="${X(hi)}" y2="${Y(hi)}" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="8 6"/>
    <text x="${X(hi) - 6}" y="${Y(hi) + 22}" font-size="16" text-anchor="end" fill="var(--ink)">pilot = scale</text>
    <text x="${(L + W - R) / 2}" y="${H - 6}" font-size="17" text-anchor="middle" fill="var(--ink)">Effect at scale, pp</text>
    <text x="16" y="${(T + H - B) / 2}" font-size="17" text-anchor="middle" fill="var(--ink)" transform="rotate(-90 16 ${(T + H - B) / 2})">Pilot said, pp</text>`;
  const fillOf = d => (DESIGNS.find(x => x[0] === d) || DESIGNS[1])[2];
  pts.forEach(p => s += `<circle cx="${X(+p.scale)}" cy="${Y(+p.measured)}" r="9" fill="${fillOf(p.design)}" stroke="var(--ink)" stroke-width="1.6" opacity=".92"/>`);
  return s + `</svg>`;
}

/* ---------- leaderboard reordering ---------- */
function rects(els){ const m = new Map(); els.forEach(e => m.set(e.dataset.id, e.getBoundingClientRect().top)); return m; }
function flip(old, els){
  if (reduced) return;
  els.forEach(e => {
    const was = old.get(e.dataset.id), now = e.getBoundingClientRect().top;
    if (was === undefined) e.animate([{opacity:0, transform:"scale(.9)"}, {opacity:1, transform:"none"}], {duration:350, easing:"ease-out"});
    else if (Math.abs(was - now) > 1) e.animate([{transform:`translateY(${was - now}px)`}, {transform:"none"}], {duration:600, easing:"cubic-bezier(.3,1.2,.5,1)"});
  });
}

/* ---------- CSV export ---------- */
function csv(rows, cols){
  const cell = v => { const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return `"${s.replace(/"/g, '""')}"`; };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
function download(name, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:"text/csv;charset=utf-8"}));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function exportCsv(){
  const b = $("#exportBtn"); b.disabled = true; b.textContent = "Exporting…";
  try {
    const [ps, ss, es] = await Promise.all([pageAll("players", "joined_at"), pageAll("scores", "section"), pageAll("events", "id")]);
    const names = new Map(ps.map(p => [p.id, p.display_name]));
    const stamp = new Date().toISOString().slice(0, 10);
    download(`base-kitchen-${room.code}-${stamp}-events.csv`, csv(es.map(e => ({...e, display_name: names.get(e.player_id) || ""})), ["id","created_at","room_code","player_id","display_name","section","kind","payload"]));
    setTimeout(() => download(`base-kitchen-${room.code}-${stamp}-scores.csv`, csv(ss.map(s => ({...s, display_name: names.get(s.player_id) || ""})), ["room_code","player_id","display_name","section","points"])), 400);
    toast(`Exported ${es.length} events and ${ss.length} scores.`);
  } catch (e) { console.error(e); toast(`Export failed: ${e.message}`); }
  b.disabled = false; b.textContent = "Export CSV";
}
})();
