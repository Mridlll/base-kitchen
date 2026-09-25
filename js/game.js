(() => {
"use strict";

/* ---------- utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let seed = Math.floor(Math.random() * 1e9);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let rand = mulberry32(seed);
const randn = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const fmt = (x, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- live session hooks (js/live.js; no-ops in solo) ---------- */
const live = () => (window.BKLive && window.BKLive.active) ? window.BKLive : null;
const logEv = (section, kind, payload) => { const L = live(); if (L) L.log(section, kind, payload); };

/* ---------- state ---------- */
const SCREENS = ["intro","act1","act2","forecast","act3","pubbias","act4","darkpat","act5","debrief"];
const KATORI_OF = {act1:0, act2:1, act3:2, act4:3, act5:4};
const MAX = {act1:15, act2:20, forecast:10, act3:15, pubbias:5, act4:15, darkpat:9, act5:11};
const LABELS = {act1:"Specify the behaviour", act2:"COM-B diagnosis", forecast:"Forecast the evidence", act3:"Design the intervention", pubbias:"Publication bias", act4:"Evaluate and scale", darkpat:"Nudge, boost, sludge", act5:"Make the case"};
let S;
function fresh(){
  S = { screen:0, score:{}, done:new Set(), act1:{}, act1Checked:false, act2:{}, act2Checked:false, act2Sel:null,
        forecast:{}, fcRevealed:{}, levers:new Set(), act3Done:false, act4:{}, act4Run:null, act4Scaled:false,
        pb:{n:10, runs:[], answered:null}, dark:{}, darkSel:null, darkChecked:false, act5:{}, act5Checked:false };
}
fresh();
const total = () => Object.values(S.score).reduce((a,b)=>a+b,0);
function setScore(k, v){
  S.score[k] = Math.round(v*10)/10;
  const el = $("#scoreNum"); el.textContent = Math.round(total());
  const chip = el.parentElement; chip.classList.remove("bump"); void chip.offsetWidth; chip.classList.add("bump");
  const L = live(); if (L) L.score(k, S.score[k]);
}

/* ---------- thali progress ---------- */
function drawThali(){
  const g = $("#katoris"); let h = `<ellipse cx="130" cy="25" rx="128" ry="23" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  for (let i=0;i<5;i++){
    const cx = 34 + i*48, cls = [];
    const cur = KATORI_OF[SCREENS[S.screen]];
    const doneIdx = ["act1","act2","act3","act4","act5"].filter(a=>S.done.has(a)).length;
    if (i < doneIdx) cls.push("done");
    if (cur === i) cls.push("now");
    h += `<g class="katori ${cls.join(" ")}" style="transform-origin:${cx}px 25px">
      <circle class="rim" cx="${cx}" cy="25" r="16" fill="var(--paper)" stroke="var(--ink)" stroke-width="2"/>
      <g class="katori-fill" style="transform-origin:${cx}px 25px">
        <circle cx="${cx}" cy="25" r="12" fill="var(--leaf)"/>
        <circle cx="${cx-4}" cy="22" r="1.6" fill="var(--sprout)"/><circle cx="${cx+3}" cy="27" r="1.6" fill="var(--sprout)"/><circle cx="${cx+5}" cy="20" r="1.3" fill="var(--sprout)"/>
      </g></g>`;
  }
  g.innerHTML = h;
}

/* ---------- Ragi ---------- */
const ragiEl = $("#ragi"), bubble = $("#bubble"), bText = $("#bubbleText");
let hintIdx = 0, typeTimer = null, moodTimer = null;
function say(text, mood){
  bubble.classList.remove("hide");
  clearInterval(typeTimer);
  if (reduced){ bText.textContent = text; }
  else { let i = 0; bText.textContent = ""; typeTimer = setInterval(()=>{ i += 2; bText.textContent = text.slice(0,i); if (i >= text.length) clearInterval(typeTimer); }, 14); }
  if (mood) setMood(mood);
}
function setMood(m){
  ragiEl.classList.remove("happy","think","oops"); void ragiEl.offsetWidth;
  if (m && m !== "idle") ragiEl.classList.add(m);
  clearTimeout(moodTimer);
  if (m === "happy" || m === "oops") moodTimer = setTimeout(()=>ragiEl.classList.remove(m), 1400);
}
function hint(){
  const list = HINTS[SCREENS[S.screen]] || [];
  if (!list.length) return;
  say(list[hintIdx % list.length], "think"); hintIdx++;
}
$("#ragiBody").addEventListener("click", hint);
$("#hintBtn").addEventListener("click", hint);
$("#hideBtn").addEventListener("click", ()=>{ bubble.classList.add("hide"); setMood("idle"); });

function confetti(n = 18){
  if (reduced) return;
  const r = $("#ragiBody").getBoundingClientRect();
  for (let i=0;i<n;i++){
    const d = document.createElement("div"); d.className = "grain";
    d.style.left = (r.left + r.width/2) + "px"; d.style.top = (r.top + 20) + "px";
    document.body.appendChild(d);
    const dx = (Math.random()-0.7)*260, dy = -80 - Math.random()*200;
    d.animate([{transform:"translate(0,0) rotate(0)", opacity:1},{transform:`translate(${dx}px,${dy}px) rotate(${Math.random()*540}deg)`, opacity:1, offset:.6},{transform:`translate(${dx*1.2}px,${dy+220}px) rotate(720deg)`, opacity:0}], {duration:1300+Math.random()*500, easing:"cubic-bezier(.2,.7,.4,1)"}).onfinish = () => d.remove();
  }
}

const HINTS = {
  intro:["I'm Ragi. I'll be hanging around with hints. Tap me any time you're stuck.","This runs about 25 minutes. Your choices in early acts change what happens later, so don't speed through them."],
  act1:["Ask first: who actually controls the options at lunch? Diners choose from what's put in front of them.","'Awareness' and 'promotion' aren't behaviours you can count at a counter.","If you can't observe it in a register, a till, or a plate count, it isn't specified yet."],
  act2:["Every box needs evidence, not a hunch. A card with no source is a guess.","Watch the actor. Our target is the menu planner, not the diners.","Reflective motivation includes believing something is allowed. Automatic motivation is habit and routine."],
  forecast:["Defaults tend to be bigger than people expect. Information effects tend to be smaller.","Remember the gap between journal effects and what nudge units see at scale."],
  act3:["Look back at your diagnosis. Which boxes were the real bottlenecks?","A default the planner doesn't feel allowed to set, with flour that doesn't arrive, won't last a week.","Posters speak to System 2. Lunch counters run on System 1."],
  pubbias:["Try the small sample first, then the big one. Compare what gets into the journal.","Only 'significant' positive results get published here. What does that do to the published average?"],
  act4:["Stated intentions overstate change. What will you actually count?","One enthusiastic kitchen, no comparison group: what else changed that month?","If you don't pre-register, you get to pick the best-looking outcome afterwards. So will a reviewer's suspicion."],
  darkpat:["A nudge keeps every option and roughly the same cost. A dark pattern works against the user's interest.","Sludge is friction on a choice that's good for the person.","A boost builds skill, so it works even after the app is gone."],
  act5:["Secretaries care about budget cycles, farmers and fiscal risk. Scientists care about design and limits. Firms care about demand and competitors.","Would you be comfortable if diners knew exactly what you did? That's the test."],
  debrief:["Play again with different choices. The world is re-drawn each time, so the numbers move."]
};
const GREET = {
  intro:"Hello! I'm Ragi, a finger millet with opinions. I'll nudge you along. Transparently, of course.",
  act1:"First job: turn a vague brief into something a person actually does. Build the sentence.",
  act2:"Now the detective work. Sort each evidence card into a COM-B box. Tap a card, then tap a box.",
  forecast:"Quick break. Before I show you what real studies found, guess. Nobody's grading your ego, only your calibration.",
  act3:"You've got a budget. Spend it on the bottlenecks you found, not on what feels busiest.",
  pubbias:"A little machine. Every trial here tests a nudge that truly does nothing. Let's see what gets published.",
  act4:"Time to test your plan. Every choice here changes what number you'll see, and whether it's true.",
  darkpat:"Same design moves, different intentions. Tap each part of this checkout and tell me what it is.",
  act5:"You've got a result. Now say it three different ways for three different people.",
  debrief:"That's the whole thali. Let's see how you did."
};

/* ---------- navigation ---------- */
const stage = $("#stage");
function go(i){
  const L = live(); if (L && !L.allow(i)) return;
  S.screen = i; hintIdx = 0; render();
  if (L) L.entered(i);
  window.scrollTo({top:0, behavior: reduced ? "auto" : "smooth"});
  stage.focus({preventScroll:true});
}
function render(){
  const name = SCREENS[S.screen];
  stage.innerHTML = ""; stage.className = "fade-in"; void stage.offsetWidth;
  R[name]();
  drawThali();
  say(GREET[name], name === "debrief" ? "happy" : "idle");
}
function next(){ go(S.screen + 1); }
function complete(key){ S.done.add(key); drawThali(); }

/* =====================================================
   SCREENS
   ===================================================== */
const R = {};

/* ---------- Intro ---------- */
R.intro = () => {
  stage.innerHTML = `
    <p class="act-tag">SFS learning deep dive, capstone</p>
    <h1>Base Kitchen</h1>
    <p class="lede">You're the CEEW researcher on a new brief. Take it from a vague goal to a tested, scaled, well-argued intervention, and find out along the way how much your own choices bend the evidence.</p>
    <div class="brief">
      <p><b>The brief.</b> A zonal railway runs 400 base kitchens feeding staff and trainees, about 800 lunches each on weekdays. The zone wants to "get people eating more millets". Almost nobody does right now: millet dishes are about 4% of lunch servings.</p>
      <p>You have one menu cycle to design something, a pilot to test it, and a meeting with three very different people at the end.</p>
    </div>
    <h3>How it runs</h3>
    <p>Five acts, each filling one katori on the thali up top, plus three short interludes. About 25 minutes. The score is out of 100, and choices in early acts change what you see later.</p>
    <p class="meta">This zone, its kitchens and its data are invented. The studies quoted in the interludes are real and come from the module deck.</p>
    <div class="row"><button class="btn" id="start">Start the brief</button></div>`;
  $("#start").onclick = next;
};

/* ---------- Act 1: Specify ---------- */
const A1 = [
  {k:"who", q:"Who needs to act?", opts:[
    ["everyone","everyone in the zone"],["diners","the diners at lunch"],["planner","the menu planner at each base kitchen"],["board","the Railway Board"]],
   right:"planner", why:"<b>Ask first who controls the options.</b> Diners pick from what's on the counter; the planner decides what's on it. The Board matters, but it doesn't set Tuesday's lunch."},
  {k:"what", q:"Does what?", opts:[
    ["aware","becomes aware of millet benefits"],["promote","promotes millets"],["serve","serves a millet main as the default lunch"],["love","learns to love millets"]],
   right:"serve", why:"<b>Awareness is not behaviour.</b> 'Serves a millet main as the default' is an action someone can see happen."},
  {k:"when", q:"Where and when?", opts:[
    ["asap","across India, as soon as possible"],["cycle","at weekday lunch, from the next four-week menu cycle"],["poshan","during Poshan Maah only"]],
   right:"cycle", why:"<b>Tie it to a change point.</b> A new menu cycle weakens the old habit, and a fixed start date lets you compare before and after."},
  {k:"often", q:"How often?", opts:[
    ["whenever","whenever possible"],["three","on three weekdays a week"],["once","once, as a special millet day"]],
   right:"three", why:"<b>'Whenever possible' is never.</b> Three named days is specific, gives rice-loyal diners an out, and can be audited."},
  {k:"obs", q:"How will we observe it?", opts:[
    ["survey","a survey of diner awareness"],["reach","reach of the campaign on Instagram"],["register","kitchen issue registers and servings counted at the counter"]],
   right:"register", why:"<b>Measure what people did.</b> Issue registers and counted servings are cheap administrative data, and less biased than self-report."}
];
R.act1 = () => {
  const groups = A1.map(g => `
    <section class="group ${S.act1[g.k]?"answered":""}" data-g="${g.k}" aria-label="${g.q}">
      <div class="group-q"><span class="gnum">${A1.indexOf(g)+1}</span><span>${g.q}</span><span class="gstat">${S.act1[g.k]?"Picked":"Pick one"}</span></div>
      <div class="chips">${g.opts.map(([v,t]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${S.act1[g.k]===v}">${t}</button>`).join("")}</div>
      <div class="why-slot"></div>
    </section>`).join("");
  stage.innerHTML = `
    <p class="act-tag">Act 1 of 5, about 3 minutes</p>
    <h2>Say who does what</h2>
    <p>The zone's brief says "get people eating more millets". That can't be designed for or measured. Build a specified target behaviour: who does what, where, when, how often, and how you'll see it.</p>
    <p class="spec-label">Your target behaviour <span>fills in as you pick below</span></p>
    <div class="spec" id="spec"></div>
    ${groups}
    <div class="row"><button class="btn" id="check" disabled>Check my spec</button><button class="btn ghost" id="cont" hidden>Continue to diagnosis</button></div>`;
  const drawSpec = () => {
    const t = k => { const g = A1.find(x=>x.k===k); const v = S.act1[k]; const o = g.opts.find(x=>x[0]===v); return `<span class="slot ${o?"filled":""}">${o?o[1]:PH[k]}</span>`; };
    $("#spec").innerHTML = `${cap(t("who"))} ${t("what")} ${t("when")}, ${t("often")}. We'll know it happened from ${t("obs")}.`;
    $("#check").disabled = A1.some(g => !S.act1[g.k]) || S.act1Checked;
  };
  const cap = s => s.replace(/>(\w)/, (m,c)=>">"+c.toUpperCase());
  const PH = {who:"who", what:"does what", when:"where and when", often:"how often", obs:"what we count"};
  $$(".group").forEach(gEl => {
    const k = gEl.dataset.g;
    $$(".chip", gEl).forEach(b => b.onclick = () => {
      if (S.act1Checked) return;
      S.act1[k] = b.dataset.v;
      $$(".chip", gEl).forEach(x => x.setAttribute("aria-pressed", x === b));
      gEl.classList.add("answered"); $(".gstat", gEl).textContent = "Picked";
      drawSpec();
    });
  });
  $("#check").onclick = () => {
    S.act1Checked = true; let right = 0;
    A1.forEach(g => {
      const gEl = $(`[data-g="${g.k}"]`), ok = S.act1[g.k] === g.right; if (ok) right++;
      $(".gstat", gEl).textContent = ok ? "Spot on" : "Not quite";
      $$(".chip", gEl).forEach(c => { if (c.dataset.v === g.right) c.classList.add("right"); else if (c.dataset.v === S.act1[g.k]) c.classList.add("wrong"); });
      $(".why-slot", gEl).innerHTML = `<p class="why">${g.why}</p>`;
    });
    setScore("act1", right * 3); complete("act1");
    logEv("act1", "spec", {...S.act1, right});
    $("#check").hidden = true; $("#cont").hidden = false;
    if (right >= 4){ say(`${right} of 5. That's a behaviour you could actually design for. The planner is our actor from here on.`, "happy"); confetti(); }
    else say(`${right} of 5. Have a look at the notes under each row. From here on, we'll use the green version: the planner serving a millet default.`, "oops");
  };
  $("#cont").onclick = next;
  drawSpec();
};

/* ---------- Act 2: COM-B diagnosis ---------- */
const BOXES = [
  ["capP","Physical capability","skills, stamina"],["capS","Psychological capability","knowledge, know-how"],
  ["oppP","Physical opportunity","supply, money, time"],["oppS","Social opportunity","what others expect"],
  ["motR","Reflective motivation","beliefs, permission, plans"],["motA","Automatic motivation","habit, routine, liking"],
  ["bin","Not usable evidence","a guess, or about the wrong actor",true]
];
const CARDS = [
  {id:"c1",src:"Stores ledger",t:"Ragi flour indented 3 times in six months. The vendor left 2 of those orders unfilled.",a:"oppP",why:"Supply that doesn't arrive is physical opportunity."},
  {id:"c2",src:"Head cook interview",t:"\"We make ragi mudde at home. For 800 plates by 12:30? The dough sets before we're halfway.\"",a:"capP",why:"Cooking at volume is a physical skill."},
  {id:"c3",src:"Menu planner interview",t:"\"The circular says millets are encouraged, not required. I don't know if I'm allowed to drop rice on a Tuesday.\"",a:"motR",why:"Believing a change is permitted is reflective motivation."},
  {id:"c4",src:"Menu files",t:"The four-week menu has been copied forward, unchanged, every month since 2019.",a:"motA",why:"Copying last month's menu is habit: automatic motivation."},
  {id:"c5",src:"Complaint register",t:"14 complaints in the one bajra roti trial week. The supervisor told the planner to \"go back to normal\".",a:"oppS",why:"The supervisor's expectation is the planner's social opportunity."},
  {id:"c6",src:"Planner quiz",t:"9 of 12 planners couldn't name a millet main that works at volume.",a:"capS",why:"Recipe knowledge is psychological capability."},
  {id:"c7",src:"Cost sheet",t:"Ragi flour costs ₹42/kg against ₹34/kg for atta. The per-plate budget hasn't moved since 2022.",a:"oppP",why:"A budget gap is physical opportunity: the means aren't there."},
  {id:"c8",src:null,t:"Staff probably see millets as poor people's food.",a:"bin",why:"No source. It might be true, but it's a hypothesis to test, not evidence."},
  {id:"c9",src:"Diner survey",t:"78% of diners agree that millets are healthy.",a:"bin",why:"This is about diners, not the planner, and it's awareness, not behaviour."},
  {id:"c10",src:null,t:"An op-ed in a national daily would change their minds.",a:"bin",why:"That's a solution idea, not a diagnosis. Also, an op-ed isn't a nudge."}
];
R.act2 = () => {
  stage.innerHTML = `
    <p class="act-tag">Act 2 of 5, about 5 minutes</p>
    <h2>Diagnose the planner</h2>
    <p><b>Target behaviour:</b> the menu planner at each base kitchen serves a millet main as the default lunch on three weekdays, from the next menu cycle.</p>
    <p>Your field team brought back ten cards. Tap a card, then tap the COM-B box it's evidence for. Anything that isn't real evidence about the planner goes in the bottom box.</p>
    <div class="col-label">Evidence cards</div>
    <div class="cards" id="cards"></div>
    <div class="col-label">COM-B boxes</div>
    <div class="bins" id="bins"></div>
    <div id="a2out"></div>
    <div class="row"><button class="btn" id="check" disabled>Check my diagnosis</button><button class="btn ghost" id="cont" hidden>Continue</button></div>`;
  const draw = () => {
    const unplaced = CARDS.filter(c => !S.act2[c.id]);
    $("#cards").innerHTML = unplaced.length ? unplaced.map(c => `<button type="button" class="ecard ${S.act2Sel===c.id?"sel":""}" data-id="${c.id}"><span class="src ${c.src?"":"none"}">${c.src?esc(c.src):"No source"}</span>${esc(c.t)}</button>`).join("") : `<p class="meta">All cards placed. Tap a placed card to take it back out.</p>`;
    $("#bins").innerHTML = BOXES.map(([k,h,s,trash]) => `
      <div class="bin ${trash?"trash":""} ${S.act2Sel?"armed":""}" data-k="${k}" role="button" tabindex="0" aria-label="Place in ${h}">
        <div class="bin-h">${h}<small>${s}</small></div>
        <div class="placed">${CARDS.filter(c=>S.act2[c.id]===k).map(c=>{
          const cls = S.act2Checked ? (c.a===k?"right":"wrong") : "";
          return `<button type="button" class="pchip ${cls}" data-id="${c.id}">${esc(c.src||"No source")}: ${esc(c.t.slice(0,46))}…</button>`;}).join("")}</div>
      </div>`).join("");
    $$(".ecard").forEach(b => b.onclick = () => { S.act2Sel = S.act2Sel === b.dataset.id ? null : b.dataset.id; draw(); });
    $$(".bin").forEach(b => {
      const place = () => { if (!S.act2Sel || S.act2Checked) return; S.act2[S.act2Sel] = b.dataset.k; S.act2Sel = null; draw(); };
      b.onclick = e => { if (e.target.closest(".pchip")) return; place(); };
      b.onkeydown = e => { if (e.key==="Enter"||e.key===" "){ e.preventDefault(); place(); } };
    });
    $$(".pchip").forEach(p => p.onclick = e => { e.stopPropagation(); if (S.act2Checked) return; delete S.act2[p.dataset.id]; draw(); });
    $("#check").disabled = CARDS.some(c => !S.act2[c.id]) || S.act2Checked;
  };
  $("#check").onclick = () => {
    S.act2Checked = true; draw();
    const right = CARDS.filter(c => S.act2[c.id] === c.a).length;
    setScore("act2", right * 2); complete("act2");
    logEv("act2", "placements", {...S.act2, right});
    const misses = CARDS.filter(c => S.act2[c.id] !== c.a);
    $("#a2out").innerHTML = `
      <div class="panel fade-in">
        <h3 style="margin-top:0">${right} of 10 placed correctly</h3>
        ${misses.length ? `<p>Where it went wrong:</p>${misses.map(c=>`<p class="why"><b>${esc(c.src||"No source")}.</b> ${c.why}</p>`).join("")}` : `<p>Clean sweep.</p>`}
        <h3>What the evidence says</h3>
        <p>The biggest bottlenecks are <b>physical opportunity</b> (flour that doesn't arrive, a budget gap) and <b>reflective motivation</b> (the planner doesn't think they're allowed). Volume-cooking capability comes next. Nothing here says diners don't know millets are healthy; they already do.</p>
        <p class="meta">Keep this in mind. It decides what actually works in Act 3.</p>
      </div>`;
    $("#check").hidden = true; $("#cont").hidden = false;
    if (right >= 8){ say("Lovely diagnosis. Notice what's missing: nothing points at a poster campaign.", "happy"); confetti(); }
    else say("A few strays. The two most common traps: evidence about the diners instead of the planner, and hunches with no source.", "oops");
  };
  $("#cont").onclick = next;
  draw();
};

/* ---------- Interlude: Forecast ---------- */
const FC = [
  {id:"f1",title:"Defaults at Danish conferences",cite:"Hansen et al. 2019",q:"Before the change, 2 to 13% of attendees chose vegetarian lunch. Then vegetarian became the default, with meat still available on request. What share chose vegetarian?",min:0,max:100,step:1,unit:"%",truth:87,start:30,tol:30,take:"Between 86 and 89%. Nobody was stopped from choosing meat. Only the form changed."},
  {id:"f2",title:"Influencers and children's snacks",cite:"Coates et al. 2019",q:"Children aged 9 to 11 who saw unhealthy snack posts from influencers ate 448 kcal more. What did healthy snack posts do to healthy snack intake, in kcal?",min:-100,max:500,step:10,unit:" kcal",truth:0,start:200,tol:180,take:"No significant effect. Commercial promotion works; healthy counter-content is much weaker."},
  {id:"f3",title:"Journals versus nudge units",cite:"DellaVigna and Linos 2022",q:"In academic journals, the average nudge raised take-up by 8.7 percentage points. Across 126 trials run by government nudge units, reaching 23 million people, what was it?",min:0,max:10,step:.1,unit:" pp",truth:1.4,start:6,tol:4,take:"1.4 pp. Most of the gap comes from selective publication and low power."},
  {id:"f4",title:"Chile's 2016 food law",cite:"Taillie et al. 2020",q:"Warning labels, limits on child-directed marketing and school sales bans, together. How much did purchases of 'high-in' beverages change?",min:-50,max:0,step:.5,unit:"%",truth:-23.7,start:-5,tol:18,take:"−23.7%. The biggest shifts come from structural policy with behavioural design in it, not from design alone."}
];
R.forecast = () => {
  stage.innerHTML = `
    <p class="act-tag">Interlude, about 3 minutes</p>
    <h2>Forecast the evidence</h2>
    <p>Four real studies from the module. Drag to your best guess, then reveal. You're scored on how close you get.</p>
    <div id="fcs"></div>
    <div class="row"><button class="btn" id="cont" disabled>Continue to Act 3</button></div>`;
  $("#fcs").innerHTML = FC.map(f => `
    <div class="fc" data-id="${f.id}">
      <h3>${f.title}</h3>
      <p class="meta">${f.cite}</p>
      <p>${f.q}</p>
      <div class="fc-read"><span>Your guess</span><span class="big" id="${f.id}-v"></span></div>
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${S.forecast[f.id] ?? f.start}" aria-label="Your guess for ${f.title}">
      <div class="res"></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost rev" type="button">Reveal</button></div>
    </div>`).join("");
  const show = (f, v) => $(`#${f.id}-v`).textContent = (+v).toFixed(f.step<1?1:0) + f.unit;
  FC.forEach(f => {
    const box = $(`[data-id="${f.id}"]`), sl = $("input", box);
    show(f, sl.value);
    sl.oninput = () => { if (!S.fcRevealed[f.id]) show(f, sl.value); };
    $(".rev", box).onclick = () => {
      if (S.fcRevealed[f.id]) return;
      const g = +sl.value; S.forecast[f.id] = g; S.fcRevealed[f.id] = true; sl.disabled = true;
      logEv("forecast", "forecast", {item:f.id, guess:g, truth:f.truth});
      const pct = x => ((x - f.min) / (f.max - f.min)) * 100;
      const pts = 2.5 * Math.max(0, 1 - Math.abs(g - f.truth) / f.tol);
      $(".res", box).innerHTML = `
        <div class="reveal-bar"><div class="tick you" style="left:calc(${pct(g)}% - 2px)"></div><div class="tick truth" style="left:calc(${pct(f.truth)}% - 4px)"></div></div>
        <div class="legend"><span><i style="background:var(--ink)"></i>You: ${g}${f.unit}</span><span><i style="background:var(--leaf)"></i>Study: ${f.truth}${f.unit}</span></div>
        <p class="why" style="margin-top:10px">${f.take}</p>`;
      $(".rev", box).hidden = true;
      const done = FC.filter(x=>S.fcRevealed[x.id]);
      const sc = done.reduce((a,x)=>a + 2.5*Math.max(0,1-Math.abs(S.forecast[x.id]-x.truth)/x.tol),0);
      setScore("forecast", sc);
      if (pts > 1.8){ say("Well calibrated. Most people miss that one.", "happy"); confetti(10); }
      else say(f.id==="f1" ? "Defaults are bigger than intuition says. That's the whole point of them." : f.id==="f3" ? "Published effects shrink a lot at scale. Keep this number handy for Act 4." : f.id==="f2" ? "Healthy content rarely beats commercial content on the same channel." : "Structure moves more than messages.", "oops");
      if (done.length === FC.length) $("#cont").disabled = false;
    };
  });
  $("#cont").onclick = next;
};

/* ---------- Act 3: Design ---------- */
const LEVERS = [
  {id:"default",name:"Millet main as the default lunch, three days a week",cost:10,tags:["Environmental restructuring","TIPPME: availability"]},
  {id:"circular",name:"Zonal circular: millet days are allowed, with a menu template",cost:15,tags:["Enablement","Reflective motivation"]},
  {id:"contract",name:"FPO rate contract, plus top-up to close the ₹8/kg gap",cost:35,tags:["Enablement","Incentivisation"]},
  {id:"training",name:"Volume-cooking sessions with a chef who's done it",cost:20,tags:["Training","Modelling"]},
  {id:"names",name:"Taste-first dish names at the counter",cost:5,tags:["Persuasion","TIPPME: information"]},
  {id:"position",name:"Millet dish placed first in the line",cost:5,tags:["Environmental restructuring","TIPPME: position"]},
  {id:"scoop",name:"Smaller rice scoop, bigger dal bowl",cost:5,tags:["Environmental restructuring","TIPPME: size"]},
  {id:"posters",name:"'Millets are healthy' posters in every mess",cost:20,tags:["Education"]},
  {id:"influencer",name:"Food influencer campaign on staff WhatsApp groups",cost:25,tags:["Persuasion"]},
  {id:"ban",name:"No rice at all on millet days",cost:5,tags:["Restriction"]}
];
const BUDGET = 100;
function trueEffect(levers, decay){
  const h = k => levers.has(k);
  const perm = h("circular"), sup = h("contract"), tr = h("training"), def = h("default"), ban = h("ban");
  let structural = 0, nudgy = 0;
  if (def) structural += 14 * (perm?1:.35) * (sup?1:.3) * (tr?1:.75);
  else structural += (perm?1.5:0) + (sup?1.5:0) + (tr?.8:0);
  if (ban) structural += 6 * (sup?1:.4);
  const avail = def || ban;
  if (h("names")) nudgy += 1.2;
  if (h("position")) nudgy += avail ? 1.8 : .8;
  if (h("scoop")) nudgy += .8;
  if (h("posters")) nudgy += .3;
  const d = decay ? .5 : 1;
  return structural * (decay ? .95 : 1) + nudgy * d;
}
const BEST = 17.8;
R.act3 = () => {
  stage.innerHTML = `
    <p class="act-tag">Act 3 of 5, about 5 minutes</p>
    <h2>Spend the budget</h2>
    <p>You have ₹${BUDGET} lakh for the pilot menu cycle. Pick any combination of levers that fits. You won't see effect sizes here. You'll find out what worked in Act 4.</p>
    <div class="budget"><div style="display:flex;justify-content:space-between;font-weight:700"><span>Budget used</span><span id="bud"></span></div><div class="budget-bar"><div class="budget-fill" id="budFill"></div></div></div>
    <div class="levers" id="levers"></div>
    <div id="a3out"></div>
    <div class="row"><button class="btn" id="commit">Commit this plan</button><button class="btn ghost" id="cont" hidden>Continue</button></div>`;
  const spent = () => [...S.levers].reduce((a,id)=>a+LEVERS.find(l=>l.id===id).cost,0);
  const draw = () => {
    $("#levers").innerHTML = LEVERS.map(l => `
      <button type="button" class="lever" data-id="${l.id}" aria-pressed="${S.levers.has(l.id)}" ${S.act3Done?"disabled":""}>
        <b>${l.name}</b><span class="tags">${l.tags.map(t=>`<span class="tagp">${t}</span>`).join("")}</span><span class="cost">₹${l.cost} lakh</span>
      </button>`).join("");
    const s = spent();
    $("#bud").textContent = `₹${s} of ₹${BUDGET} lakh`;
    const f = $("#budFill"); f.style.width = Math.min(100, s/BUDGET*100) + "%"; f.classList.toggle("over", s > BUDGET);
    $("#commit").disabled = s > BUDGET || S.levers.size === 0 || S.act3Done;
    $$(".lever").forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      S.levers.has(id) ? S.levers.delete(id) : S.levers.add(id);
      if (id === "ban" && S.levers.has("ban")) say("Hmm. Restriction is a real tool, but would diners be comfortable if they knew why the rice vanished? And what happens to plate waste?", "think");
      else if ((id === "posters" || id === "influencer") && S.levers.has(id)) say("Does your diagnosis say anyone lacks information? The diners already think millets are healthy.", "think");
      if (spent() > BUDGET) say("Over budget. Something has to go.", "oops");
      draw();
    });
  };
  $("#commit").onclick = () => {
    S.act3Done = true; draw();
    const e = trueEffect(S.levers, true);
    let sc = 15 * Math.min(1, e / BEST);
    if (S.levers.has("ban")) sc -= 5;
    setScore("act3", clamp(sc,0,15)); complete("act3");
    logEv("act3", "levers", {levers:[...S.levers], spent:spent(), effect_scale:trueEffect(S.levers, true)*.8});
    const h = k => S.levers.has(k);
    const items = [
      [h("contract"), "Supply and price gap (physical opportunity)"],
      [h("circular"), "Permission to change the menu (reflective motivation)"],
      [h("training"), "Volume-cooking skill (physical capability)"],
      [h("default"), "A changed choice setting, not only a message"],
      [!h("posters") && !h("influencer"), "No budget spent informing people who are already informed"],
      [!h("ban"), "Passes the transparency test"]
    ];
    $("#a3out").innerHTML = `<div class="panel fade-in"><h3 style="margin-top:0">Your plan against your diagnosis</h3>
      <ul class="checklist">${items.map(([ok,t])=>`<li class="${ok?"ok":""}">${t}</li>`).join("")}</ul>
      <p class="meta">In this world, the default only holds if planners feel allowed to set it, flour arrives, and cooks can make it at volume. Counter tweaks add a little on top and fade faster.</p></div>`;
    $("#commit").hidden = true; $("#cont").hidden = false;
    const ok = items.filter(x=>x[0]).length;
    if (ok >= 5){ say("That's a structure-first plan with design on top. Exactly the layering in the deck.", "happy"); confetti(); }
    else say("Some bottlenecks are left unaddressed. We'll see what that does to the numbers.", "think");
  };
  $("#cont").onclick = next;
  draw();
};

/* ---------- Interlude: Publication bias machine ---------- */
R.pubbias = () => {
  stage.innerHTML = `
    <p class="act-tag">Interlude, about 3 minutes</p>
    <h2>The publication machine</h2>
    <p>Each dot is a trial of a nudge with a <b>true effect of zero</b>. The journal only takes trials that are positive and significant at 5%. Everything else goes in the file drawer. Pick a sample size and run some trials.</p>
    <div class="row" style="margin-top:6px">
      <span style="font-weight:700">Kitchens per trial</span>
      <div class="seg" id="seg">${[10,40,160].map(n=>`<button type="button" data-n="${n}" aria-pressed="${S.pb.n===n}">${n}</button>`).join("")}</div>
      <button class="btn" id="run">Run 20 trials</button>
      <button class="btn ghost" id="clear">Clear</button>
    </div>
    <div class="panel"><div class="plot-wrap"><svg id="pbsvg" viewBox="0 0 640 230" width="100%" role="img" aria-label="Trial estimates, split into published and file drawer"></svg></div>
      <div class="pb-stats"><div><b id="pbN">0</b>trials run</div><div><b id="pbP">0</b>published</div><div><b id="pbM">–</b>published average, pp</div><div><b>0.0</b>true effect, pp</div></div>
    </div>
    <div id="pbq"></div>
    <div class="row"><button class="btn" id="cont" disabled>Continue to Act 4</button></div>`;
  const se = () => ({10:4, 40:2, 160:1})[S.pb.n];
  const X = v => 320 + clamp(v,-14,14) * 21;
  const svg = $("#pbsvg");
  const axes = () => `
    <text x="8" y="40" font-size="14" font-weight="700" fill="var(--ink)">Journal</text>
    <text x="8" y="150" font-size="14" font-weight="700" fill="var(--ink)">File drawer</text>
    <line x1="20" y1="90" x2="620" y2="90" stroke="var(--line)" stroke-width="2"/>
    <line x1="${X(0)}" y1="10" x2="${X(0)}" y2="205" stroke="var(--leaf)" stroke-width="2" stroke-dasharray="4 4"/>
    <text x="${X(0)}" y="222" font-size="12" text-anchor="middle" fill="var(--muted)">true effect 0</text>
    ${[-10,-5,5,10].map(v=>`<text x="${X(v)}" y="222" font-size="12" text-anchor="middle" fill="var(--muted)">${v>0?"+":""}${v}</text>`).join("")}`;
  const drawAll = (animFrom) => {
    let dots = "";
    S.pb.runs.forEach((r,i) => {
      const y = r.pub ? 30 + (i*7 % 44) : 118 + (i*11 % 70);
      const anim = (i >= animFrom && !reduced) ? `<animate attributeName="cy" from="-10" to="${y}" dur="${.4+(i-animFrom)*.03}s" fill="freeze" calcMode="spline" keySplines=".3 1.4 .5 1"/>` : "";
      dots += `<circle cx="${X(r.est)}" cy="${y}" r="${r.pub?6:4.5}" fill="${r.pub?"var(--leaf)":"var(--paper)"}" stroke="var(--ink)" stroke-width="1.5">${anim}</circle>`;
    });
    svg.innerHTML = axes() + dots;
    const pub = S.pb.runs.filter(r=>r.pub);
    $("#pbN").textContent = S.pb.runs.length; $("#pbP").textContent = pub.length;
    $("#pbM").textContent = pub.length ? fmt(pub.reduce((a,r)=>a+r.est,0)/pub.length) : "–";
  };
  $$("#seg button").forEach(b => b.onclick = () => { S.pb.n = +b.dataset.n; $$("#seg button").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
  $("#run").onclick = () => {
    const from = S.pb.runs.length, s = se();
    for (let i=0;i<20;i++){ const est = randn()*s; S.pb.runs.push({est, pub: est/s > 1.96}); }
    const batch = S.pb.runs.slice(from);
    logEv("pubbias", "pb_run", {n:S.pb.n, estimates:batch.map(r=>r.est), published:batch.map(r=>r.pub)});
    drawAll(from);
    if (S.pb.runs.length >= 20 && !S.pb.answered) askQ();
    const pub = S.pb.runs.slice(from).filter(r=>r.pub);
    say(pub.length ? `${pub.length} of those got published, all showing a positive effect that doesn't exist.` : "Nothing published that round. Run a few more, and try 10 kitchens.", pub.length ? "think" : "idle");
  };
  $("#clear").onclick = () => { S.pb.runs = []; drawAll(0); };
  const askQ = () => {
    $("#pbq").innerHTML = `<div class="aud fade-in"><h3>A meta-analysis averages the published trials. What does it find?</h3>
      ${[["a","Roughly the true effect, near zero"],["b","A positive effect that isn't there"],["c","Nothing, since meta-analyses correct for this automatically"]].map(([v,t])=>`<label class="opt" data-v="${v}"><input type="radio" name="pbq" value="${v}">${t}</label>`).join("")}
      <div id="pbwhy"></div></div>`;
    $$('input[name="pbq"]').forEach(inp => inp.onchange = () => {
      if (S.pb.answered) return; S.pb.answered = inp.value;
      $$("#pbq .opt").forEach(o => { if (o.dataset.v==="b") o.classList.add("right"); else if (o.dataset.v===inp.value) o.classList.add("wrong"); });
      $$('input[name="pbq"]').forEach(x=>x.disabled=true);
      logEv("pubbias", "pb_answer", {answer:inp.value});
      const ok = inp.value === "b"; setScore("pubbias", ok?5:2);
      $("#pbwhy").innerHTML = `<p class="why">Selective publication plus small samples manufactures effects. Mertens et al. (2022) found an average d of 0.45 across choice architecture studies; after Maier et al. (2022) corrected for publication bias, no evidence of an average effect remained. Notice too that bigger samples publish fewer false positives, and the ones they do publish are smaller.</p>`;
      $("#cont").disabled = false;
      if (ok){ say("Exactly. The published record is a filtered sample, and the filter points one way.", "happy"); confetti(10); } else say("Only if the correction is done, and it often isn't. The filter only lets positive results through.", "oops");
    });
  };
  drawAll(0);
  if (S.pb.runs.length >= 20) askQ();
  $("#cont").onclick = next;
};

/* ---------- Act 4: Evaluate ---------- */
const A4 = [
  {k:"outcome",q:"What will you measure?",opts:[["servings","Millet servings, from issue registers and counter counts"],["intent","Share of diners saying they'll eat more millets"],["reach","Views of the campaign across staff groups"]]},
  {k:"design",q:"Which design?",opts:[["prepost","Before and after, in the keenest kitchen"],["rct","Cluster RCT: 20 kitchens treated, 20 control"],["stepped","Stepped-wedge: 40 kitchens switch on in four waves"]]},
  {k:"prereg",q:"Pre-register the outcome and analysis?",opts:[["yes","Yes, before any data comes in"],["no","No, we'll see what the data shows"]]},
  {k:"follow",q:"How long do you follow up?",opts:[["2w","Two weeks"],["12w","Twelve weeks, with a withdrawal arm"]]}
];
function runPilot(){
  const a = S.act4;
  const eFull = trueEffect(S.levers, false), eDec = trueEffect(S.levers, true);
  const scale = eDec * .8;
  const comps = [["Voltage drop: delivery is weaker across 400 kitchens", eDec*.2]];
  let signal = eDec;
  if (a.follow === "2w"){ const nov = eFull*1.15 - eDec; comps.push(["Novelty: two weeks misses the decay", nov]); signal = eFull*1.15; }
  if (a.outcome === "reach") return {reach:true, scale, eDec, comps};
  let base = signal;
  if (a.outcome === "intent"){ const inf = 1.5*signal + 9; comps.push(["Measured intentions, not servings", inf]); base = signal + inf; }
  let noise, se, n;
  if (a.design === "prepost"){
    const sel = base * .5; comps.push(["Picked the keenest kitchen", sel]);
    comps.push(["Poshan Maah ran the same month, with no control group", 3]);
    base += sel + 3; se = 1.4; n = 1; noise = randn()*se;
  } else {
    se = a.design === "stepped" ? 1.1 : 1.6; n = 40;
    if (a.prereg === "no"){ let m = -Infinity; for (let i=0;i<5;i++) m = Math.max(m, randn()*se); noise = m; }
    else noise = randn()*se;
  }
  comps.push([a.prereg === "no" && a.design !== "prepost" ? "Chance, plus picking the best of five outcomes" : "Chance", noise]);
  const measured = base + noise;
  return {measured, se, n, scale, eDec, comps};
}
R.act4 = () => {
  stage.innerHTML = `
    <p class="act-tag">Act 4 of 5, about 7 minutes</p>
    <h2>Test it, then scale it</h2>
    <p>The zone gives you one menu cycle for a pilot. Choose how to measure it. The result you get depends on these choices as much as on your plan.</p>
    ${A4.map((g,i)=>`<section class="group ${S.act4[g.k]?"answered":""}" data-g="${g.k}" aria-label="${g.q}"><div class="group-q"><span class="gnum">${i+1}</span><span>${g.q}</span><span class="gstat">${S.act4[g.k]?"Picked":"Pick one"}</span></div><div class="chips">${g.opts.map(([v,t])=>`<button type="button" class="chip" data-v="${v}" aria-pressed="${S.act4[g.k]===v}">${t}</button>`).join("")}</div></section>`).join("")}
    <div class="row"><button class="btn" id="run" disabled>Run the pilot</button></div>
    <div id="pilot"></div>
    <div id="scale"></div>
    <div class="row"><button class="btn ghost" id="cont" hidden>Continue</button></div>`;
  const ready = () => A4.every(g => S.act4[g.k]) && !S.act4Run;
  $$(".group").forEach(gEl => $$(".chip", gEl).forEach(b => b.onclick = () => {
    if (S.act4Run) return;
    S.act4[gEl.dataset.g] = b.dataset.v;
    $$(".chip", gEl).forEach(x => x.setAttribute("aria-pressed", x === b));
    gEl.classList.add("answered"); $(".gstat", gEl).textContent = "Picked";
    $("#run").disabled = !ready();
  }));
  $("#run").disabled = !ready();
  $("#run").onclick = () => {
    S.act4Run = runPilot(); $("#run").hidden = true;
    { const r = S.act4Run; logEv("act4", "pilot", {...S.act4, measured:r.reach?null:r.measured, se:r.se ?? null, scale:r.scale, comps:r.comps}); }
    $$(".chip").forEach(c => c.disabled = true);
    showPilot();
  };
  const showPilot = () => {
    const r = S.act4Run;
    if (r.reach){
      $("#pilot").innerHTML = `<div class="panel fade-in"><p class="meta">Your pilot result</p><div class="headline-num">48,210 views</div>
        <p>Change in millet servings: <b>unknown</b>. Reach says nothing about what anyone ate.</p>
        <div class="row"><button class="btn" id="sc">Scale it to 400 kitchens</button></div></div>`;
      say("Forty-eight thousand views and no idea whether a single plate changed. That's the 'counting reach' trap.", "oops");
    } else {
      const unit = S.act4.outcome === "intent" ? "pp in stated intention" : "pp in millet servings";
      $("#pilot").innerHTML = `<div class="panel fade-in"><p class="meta">Your pilot says</p>
        <div class="headline-num">${fmt(r.measured)}</div><p>${unit}${r.n>1?`, ±${(1.96*r.se).toFixed(1)} (95% CI)`:", in one kitchen with no comparison group"}</p>
        <div class="plot-wrap">${pilotPlot(r)}</div>
        <div class="row"><button class="btn" id="sc">Scale it to 400 kitchens</button></div></div>`;
      say(r.measured > 12 ? "Big number! Before you put it in a brief, let's see what happens at scale." : "Here's your pilot number. Now the real test: 400 kitchens, twelve weeks.", "think");
    }
    $("#sc").onclick = () => { $("#sc").disabled = true; showScale(); };
  };
  const showScale = () => {
    const r = S.act4Run, mx = Math.max(r.reach?0:Math.abs(r.measured), r.scale, 1) * 1.1;
    const w = v => Math.max(0, v) / mx * 100;
    $("#scale").innerHTML = `<div class="panel fade-in"><h3 style="margin-top:0">At scale: 400 kitchens, twelve weeks, servings counted</h3>
      <div class="hbar"><span class="lab">Your pilot</span><div class="track"><div class="fill ink" data-w="${r.reach?0:w(r.measured)}"></div></div><span class="val">${r.reach?"n/a":fmt(r.measured)}</span></div>
      <div class="hbar"><span class="lab">At scale</span><div class="track"><div class="fill leaf" data-w="${w(r.scale)}"></div></div><span class="val">${fmt(r.scale)}</span></div>
      ${r.reach ? "" : `<h3>Why your pilot and the scale-up differ</h3><ul class="waterfall">${r.comps.map(([t,v])=>`<li><span>${t}</span><b>${fmt(v)}</b></li>`).join("")}</ul>`}
      <p class="meta" style="margin-top:12px">Baseline was 4% of servings. At scale, your plan moves it to about ${(4+r.scale).toFixed(1)}%.</p></div>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>$$("#scale .fill").forEach(f => f.style.width = f.dataset.w + "%")));
    const a = S.act4;
    const sc = ({servings:5,intent:1,reach:0})[a.outcome] + ({stepped:4,rct:4,prepost:0})[a.design] + (a.prereg==="yes"?3:0) + (a.follow==="12w"?3:0);
    setScore("act4", sc); complete("act4"); S.act4Scaled = true;
    const gap = r.reach ? Infinity : Math.abs(r.measured - r.scale);
    if (!r.reach && gap < 3){ say("Your pilot predicted scale well. That's what good design buys you: a number you can plan around.", "happy"); confetti(); }
    else say("That gap is the journal-to-nudge-unit gap from the forecast round, and you just produced it yourself. Look at the list of reasons.", "oops");
    $("#cont").hidden = false;
  };
  if (S.act4Run){ $("#run").hidden = true; showPilot(); if (S.act4Scaled) showScale(); }
  $("#cont").onclick = next;
};
function pilotPlot(r){
  if (r.n === 1){
    const b = 4, a = 4 + r.measured, mx = Math.max(a, 10) * 1.15, H = 150, y = v => 170 - v/mx*H;
    return `<svg viewBox="0 0 360 200" width="100%" style="max-width:420px" role="img" aria-label="Before and after bars">
      <rect x="70" y="${y(b)}" width="80" height="${170-y(b)}" rx="8" fill="var(--sprout)" stroke="var(--ink)" stroke-width="2"/>
      <rect x="210" y="${y(a)}" width="80" height="${170-y(a)}" rx="8" fill="var(--leaf)" stroke="var(--ink)" stroke-width="2"/>
      <text x="110" y="190" text-anchor="middle" font-size="13" fill="var(--ink)">Before</text><text x="250" y="190" text-anchor="middle" font-size="13" fill="var(--ink)">After</text>
      <text x="110" y="${y(b)-6}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${b.toFixed(1)}%</text><text x="250" y="${y(a)-6}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${a.toFixed(1)}%</text></svg>`;
  }
  const base = S.act4.outcome === "intent" ? 30 : 4;
  const ctl = [], trt = [];
  for (let i=0;i<20;i++){ ctl.push(randn()*2.4); trt.push(randn()*2.4); }
  const mean = x => x.reduce((a,b)=>a+b,0)/x.length;
  const c = ctl.map(v=>v-mean(ctl)+base), t = trt.map(v=>v-mean(trt)+base+r.measured);
  const all = c.concat(t), lo = Math.min(...all,0)-1, hi = Math.max(...all)+1, Y = v => 180 - (v-lo)/(hi-lo)*160;
  const dots = (arr, cx, fill) => arr.map((v,i)=>`<circle cx="${cx + ((i%5)-2)*9}" cy="${Y(v)}" r="5" fill="${fill}" stroke="var(--ink)" stroke-width="1.3"/>`).join("");
  return `<svg viewBox="0 0 360 210" width="100%" style="max-width:420px" role="img" aria-label="Kitchen-level outcomes, control versus treated">
    ${dots(c,110,"var(--paper)")}${dots(t,250,"var(--leaf)")}
    <line x1="75" x2="145" y1="${Y(base)}" y2="${Y(base)}" stroke="var(--ink)" stroke-width="3"/>
    <line x1="215" x2="285" y1="${Y(base+r.measured)}" y2="${Y(base+r.measured)}" stroke="var(--ink)" stroke-width="3"/>
    <text x="110" y="202" text-anchor="middle" font-size="13" fill="var(--ink)">Control kitchens</text><text x="250" y="202" text-anchor="middle" font-size="13" fill="var(--ink)">Treated kitchens</text></svg>`;
}

/* ---------- Interlude: Dark patterns ---------- */
const DP = [
  {id:"d1",html:`<label style="display:flex;gap:8px;align-items:flex-start"><span style="border:2px solid var(--ink);border-radius:4px;width:16px;height:16px;flex-shrink:0;margin-top:2px;background:var(--ink)"></span><span>Add Zappit Gold, ₹49 a month</span></label>`,a:"dark",why:"A pre-ticked paid add-on works against the buyer's interest. That's a dark pattern (sneaking or preselection), not a nudge."},
  {id:"d2",html:`<b>Only 2 left!</b> Offer ends in 04:59`,a:"dark",why:"A fake countdown that resets on reload manufactures urgency. Dark pattern."},
  {id:"d3",html:`Swap chips for roasted makhana? Same price, one tap.`,a:"nudge",why:"Every option stays, the cost doesn't change, and the healthier choice gets easier. A nudge."},
  {id:"d4",html:`To cancel Gold, call 10 to 11 am on weekdays.`,a:"sludge",why:"Friction on a choice that's good for the user. Sludge."},
  {id:"d5",html:`Can you recognise every ingredient? Learn the 5-second label check.`,a:"boost",why:"It builds a skill the user keeps after the app is gone. A boost."},
  {id:"d6",html:`Most orders near you this week included a fresh vegetable.`,a:"nudge",why:"A true descriptive norm shown at the point of choice. A nudge. (Jansen et al. 2021 found norm messages alone didn't move online baskets much.)"}
];
const DCAT = [["nudge","Nudge"],["boost","Boost"],["sludge","Sludge"],["dark","Dark pattern"]];
R.darkpat = () => {
  stage.innerHTML = `
    <p class="act-tag">Interlude, about 3 minutes</p>
    <h2>Nudge, boost, sludge, or dark pattern?</h2>
    <p>A quick-commerce checkout, invented for this exercise. Tap each dashed part of the screen, then label it. The design moves that raise healthy choice also raise impulse buying.</p>
    <div class="phone-wrap">
      <div class="phone" aria-label="Mock checkout screen">
        <div class="phone-notch"></div>
        <div class="app-h">Zappit <span>Checkout</span></div>
        <div class="cartline"><span>Masala chips, 90 g</span><span>₹30</span></div>
        <div class="cartline"><span>Cold drink, 750 ml</span><span>₹45</span></div>
        <div id="pels"></div>
        <div class="fake-btn">Pay ₹124</div>
      </div>
      <div class="picker" id="picker"></div>
    </div>
    <div class="row"><button class="btn" id="check" disabled>Check my labels</button><button class="btn ghost" id="cont" hidden>Continue to Act 5</button></div>`;
  const draw = () => {
    const order = ["d2","d3","d6","d1","d5","d4"];
    $("#pels").innerHTML = order.map(id => { const d = DP.find(x=>x.id===id); const lab = S.dark[id];
      const cls = [S.darkSel===id?"sel":"", S.darkChecked?(lab===d.a?"right":"wrong"):""].join(" ");
      return `<button type="button" class="pel ${cls}" data-id="${id}">${d.html}${lab?`<span class="lbl">${DCAT.find(c=>c[0]===lab)[1]}</span>`:""}</button>`; }).join("");
    if (S.darkChecked){
      $("#picker").innerHTML = `<h3 style="margin-top:0">What each one was</h3>${DP.map(d=>`<p class="why">${d.why}</p>`).join("")}`;
    } else if (S.darkSel){
      $("#picker").innerHTML = `<h3 style="margin-top:0">Label this part</h3><div class="chips">${DCAT.map(([k,t])=>`<button type="button" class="chip" data-c="${k}" aria-pressed="${S.dark[S.darkSel]===k}">${t}</button>`).join("")}</div>`;
      $$("#picker .chip").forEach(b => b.onclick = () => { S.dark[S.darkSel] = b.dataset.c;
        const nxt = DP.find(d => !S.dark[d.id]); S.darkSel = nxt ? nxt.id : null; draw(); });
    } else {
      $("#picker").innerHTML = `<p class="meta">${Object.keys(S.dark).length === DP.length ? "All six labelled. Check them, or tap a part to change it." : "Tap a dashed part of the phone screen to label it."}</p>`;
    }
    $$(".pel").forEach(b => b.onclick = () => { if (S.darkChecked) return; S.darkSel = b.dataset.id; draw(); });
    $("#check").disabled = Object.keys(S.dark).length < DP.length || S.darkChecked;
  };
  $("#check").onclick = () => {
    S.darkChecked = true; S.darkSel = null; draw();
    const right = DP.filter(d => S.dark[d.id] === d.a).length;
    setScore("darkpat", right * 1.5);
    logEv("darkpat", "labels", {...S.dark, right});
    $("#check").hidden = true; $("#cont").hidden = false;
    if (right >= 5){ say(`${right} of 6. You can spot the difference between steering and tricking.`, "happy"); confetti(); }
    else say(`${right} of 6. The test: does it keep every option at the same cost, and does it serve the user?`, "oops");
  };
  $("#cont").onclick = next;
  draw();
};

/* ---------- Act 5: Pitch ---------- */
R.act5 = () => {
  const r = S.act4Run || {scale:trueEffect(S.levers,true)*.8, measured:null, se:1.6};
  const est = r.measured != null && !r.reach ? r.measured : r.scale;
  const ci = r.se ? (1.96*r.se).toFixed(1) : "1.5";
  const tonnes = Math.round(400*800*3*48*(Math.max(r.scale,0.5)/100)*0.08/1000);
  const sc = fmt(r.scale);
  const AUD = [
    {k:"sec",who:"The state secretary",what:"Political and fiscal gain, budget and scheme cycles, farmers",opts:[
      ["a",`Scaled across the zone, this lifts millet servings by about ${sc} points for the cost of one rate contract. Put it in this budget cycle and FPOs in your districts get a buyer for about ${tonnes} tonnes a year.`,true],
      ["b",`Our pilot shows millets can transform India's diets and help fight climate change.`,false],
      ["c",`The treatment effect was significant at the 5% level with standard errors clustered by kitchen.`,false]]},
    {k:"sci",who:"A peer scientist",what:"Transparent methods, credibility, limits",opts:[
      ["a",`A huge jump in millet love. Kitchens told us it worked really well!`,false],
      ["b",`${S.act4.design==="stepped"?"Stepped-wedge":S.act4.design==="rct"?"Cluster-randomised":"Pilot"} across ${r.n>1?"40 kitchens":"one kitchen"}, measured ${fmt(est)} pp; we'd expect about ${sc} pp at scale, and servings aren't intake.`,true],
      ["c",`Consistent with the literature, defaults raise uptake by around 80%.`,false]]},
    {k:"firm",who:"A company sourcing head",what:"Demand, cost, competitors, sourcing risk",opts:[
      ["a",`Millets are the future. Get on board or get left behind.`,false],
      ["b",`Help us save the planet by changing your recipe line.`,false],
      ["c",`If this scales, the zone buys roughly ${tonnes} more tonnes of millet flour a year through one rate contract, and the first supplier on it locks that demand in.`,true]]}
  ];
  const TT = {k:"tt",who:"The transparency test",what:"The default changes what diners get unless they ask. What goes up at the counter?",opts:[
    ["a","Nothing. Telling diners would weaken the effect.",false],
    ["b","A board reading \"Today's lunch: ragi mudde and dal. Rice on request.\"",true],
    ["c","A sign saying rice is out of stock today.",false]]};
  const all = [...AUD, TT];
  stage.innerHTML = `
    <p class="act-tag">Act 5 of 5, about 5 minutes</p>
    <h2>Make the case three ways</h2>
    <div class="brief"><p>Your pilot measured <b>${r.reach?"reach, not servings":fmt(est)+" pp"}</b>. Expected at scale: <b>${sc} pp</b> in millet servings. Pick the line you'd actually say to each person.</p></div>
    ${all.map(a=>`<div class="aud" data-k="${a.k}"><h3>${a.who}</h3><p class="meta">${a.what}</p>
      ${a.opts.map(([v,t])=>`<label class="opt" data-v="${v}"><input type="radio" name="${a.k}" value="${v}" ${S.act5[a.k]===v?"checked":""}><span>${esc(t)}</span></label>`).join("")}<div class="w"></div></div>`).join("")}
    <div class="row"><button class="btn" id="check" disabled>Check my lines</button><button class="btn ghost" id="cont" hidden>See how you did</button></div>`;
  const upd = () => $("#check").disabled = all.some(a => !S.act5[a.k]) || S.act5Checked;
  $$('input[type="radio"]').forEach(i => i.onchange = () => { S.act5[i.name] = i.value; upd(); });
  const WHY = {
    sec:"The secretary line gives one decision, a budget window and a farmer-income frame. The climate frame overclaims and speaks to the wrong motive; the clustered SEs are for a different room.",
    sci:"The scientist line states the design, the effect, the expected shrinkage, and what wasn't measured. The '80%' is exactly the headline-effect-size habit the deck warns about.",
    firm:"The firm line is about demand volume and first-mover position. Moral appeals don't move a sourcing head.",
    tt:"Only the honest board passes. Hiding the change fails the test; a fake stock-out is deception."
  };
  $("#check").onclick = () => {
    S.act5Checked = true; let pts = 0;
    all.forEach(a => {
      const box = $(`[data-k="${a.k}"]`), good = a.opts.find(o=>o[2])[0], ok = S.act5[a.k] === good;
      if (ok) pts += a.k === "tt" ? 2 : 3;
      $$(".opt", box).forEach(o => { if (o.dataset.v===good) o.classList.add("right"); else if (o.dataset.v===S.act5[a.k]) o.classList.add("wrong"); });
      $$("input", box).forEach(x=>x.disabled=true);
      $(".w", box).innerHTML = `<p class="why">${WHY[a.k]}</p>`;
    });
    setScore("act5", pts); complete("act5");
    logEv("act5", "pitch", {...S.act5, points:pts});
    $("#check").hidden = true; $("#cont").hidden = false;
    if (pts >= 9){ say("Same finding, three messengers' worth of framing, and nobody got tricked. Lovely.", "happy"); confetti(); }
    else say("Remember that stakeholders are behaving people too. Diagnose what each one needs before you draft.", "oops");
  };
  $("#cont").onclick = next;
  upd();
};

/* ---------- Debrief ---------- */
R.debrief = () => {
  const t = Math.round(total());
  const tier = t >= 80 ? "Ready to run a real trial" : t >= 60 ? "Solid. Tighten your measurement." : "Back to step 3 of the wheel";
  const h = k => S.levers.has(k);
  const a = S.act4;
  const CL = [
    [S.act1.who==="planner" && S.act1.what==="serve","Named the actor and the behaviour"],
    [(S.score.act2||0) >= 16,"Diagnosed with COM-B, with evidence"],
    [h("default") && !h("posters") && !h("influencer"),"Changed the options before the information"],
    [a.design && a.design !== "prepost","Tested where it would be scaled"],
    [a.prereg === "yes","Planned for small effects and registered the design"],
    [a.outcome === "servings","Measured behaviour, not reach or intentions"],
    [a.follow === "12w","Reported over time and watched for decay"],
    [!h("ban") && S.act5.tt === "b","Ran the transparency test"]
  ];
  const r = S.act4Run;
  logEv("debrief", "final", {total:t, by_section:{...S.score}});
  stage.innerHTML = `
    <p class="act-tag">Debrief</p>
    <h2>${tier}</h2>
    <div class="score-big" id="bigScore">0</div>
    <p class="meta">out of 100</p>
    <div class="panel">
      ${Object.keys(MAX).map(k=>`<div class="brk"><span>${LABELS[k]}</span><div class="track"><div class="fill" data-w="${(S.score[k]||0)/MAX[k]*100}"></div></div><b>${Math.round(S.score[k]||0)}/${MAX[k]}</b></div>`).join("")}
    </div>
    <h3>The deck's checklist, against what you did</h3>
    <ul class="checklist">${CL.map(([ok,t])=>`<li class="${ok?"ok":""}">${t}</li>`).join("")}</ul>
    <h3>What was true in this world</h3>
    <p>The planner wasn't short of information, and neither were diners. Flour didn't arrive, a ₹8/kg gap sat in a frozen budget, planners didn't think they were allowed to change the menu, and cooks couldn't make millet mains for 800 at speed. A default only held when all three were fixed. Counter tweaks added a point or two and faded by week twelve. Posters and influencers did roughly nothing.</p>
    ${r ? `<p>Your plan moved servings by about <b>${fmt(r.scale)} pp</b> at scale, from a 4% baseline, against a best achievable of about ${fmt(BEST*.8)} pp. ${r.reach ? "Your pilot couldn't tell you that, because it counted views." : `Your pilot said ${fmt(r.measured)}.`}</p>` : ""}
    <p class="meta">Keep reading: Hallsworth 2023 for the overview, Michie, van Stralen and West 2011 for COM-B, DellaVigna and Linos 2022 for why effects shrink.</p>
    <div class="row"><button class="btn" id="again">Play again with a new world</button></div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>$$(".brk .fill").forEach(f=>f.style.width=f.dataset.w+"%")));
  const big = $("#bigScore");
  if (reduced) big.textContent = t;
  else { let n = 0; const step = () => { n = Math.min(t, n + Math.max(1, Math.ceil((t-n)/8))); big.textContent = n; if (n < t) requestAnimationFrame(step); else if (t >= 60) confetti(30); }; requestAnimationFrame(step); }
  $("#again").onclick = () => { seed = Math.floor(Math.random()*1e9); rand = mulberry32(seed); fresh(); $("#scoreNum").textContent = "0"; go(0); };
};

/* ---------- boot ---------- */
// js/live.js, when present, decides between the join screen, a resumed live game and solo.
const api = {
  SCREENS, reduced, go, render, say, total,
  state: () => S,
  load(o){
    fresh();
    Object.assign(S, o, {done:new Set(o.done || []), levers:new Set(o.levers || [])});
    $("#scoreNum").textContent = Math.round(total());
  }
};
if (window.BKLive) { try { window.BKLive.boot(api); } catch (e) { console.error(e); render(); } }
else render();
})();
