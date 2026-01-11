applySavedTheme();
$("themeBtn").addEventListener("click", toggleTheme);

const subtitle = $("subtitle");
const headline = $("headline");
const summaryText = $("summaryText");
const scoreBadge = $("scoreBadge");
const timeBadge = $("timeBadge");
const toggleDetailsBtn = $("toggleDetailsBtn");
const detailsCard = $("detailsCard");
const detailsList = $("detailsList");
const statusEl = $("status");

const filterAll = $("filterAll");
const filterWrong = $("filterWrong");
const filterUnanswered = $("filterUnanswered");

let result = loadJSON(EXAM_RESULT_KEY);
let filterMode = "all";

function setStatus(msg=""){ statusEl.textContent = msg; }

function friendlyMessage(pct){
  if(pct >= 85) return "Strong work. You’re building reliable understanding — keep that pace.";
  if(pct >= 65) return "Good progress. Review the misses calmly — you’re close to a big jump.";
  if(pct >= 40) return "You’re in the learning zone. Look for patterns (GDPR articles, WCAG POUR, Ethical OS zones).";
  return "This is just a snapshot. Use the review to turn misses into points — improvement is totally achievable.";
}

function classify(i){
  const q = result.questions[i];
  const chosenKey = result.answers[i];
  if(!chosenKey) return "unanswered";
  if(chosenKey === q.correct_key) return "correct";
  return "wrong";
}

function keyToText(q, key){
  if(!key) return null;
  const hit = q.optionsShuffled.find(o => o.key === key);
  return hit ? hit.text : null;
}

function renderSummary(){
  const total = result.total || result.questions.length;
  const score = result.score ?? 0;
  const pct = total ? Math.round((score/total)*100) : 0;

  headline.textContent = `You scored ${score} / ${total}`;
  summaryText.textContent = friendlyMessage(pct);

  scoreBadge.textContent = `${pct}%`;

  const spentSec = Math.max(0, Math.round((result.endedAt - result.startedAt)/1000));
  timeBadge.textContent = `Time used: ${fmtMMSS(spentSec)} / ${fmtMMSS(result.durationSec || total*60)}`;

  subtitle.textContent = result.fromTimer
    ? "Time ran out — that’s okay. Review calmly and you’ll improve fast."
    : "Finished. Now turn this attempt into learning.";
}

function renderDetails(){
  detailsList.innerHTML = "";
  const frag = document.createDocumentFragment();

  for(let i=0;i<result.questions.length;i++){
    const status = classify(i);
    if(filterMode === "wrong" && status !== "wrong") continue;
    if(filterMode === "unanswered" && status !== "unanswered") continue;

    const q = result.questions[i];
    const qNum = extractQuestionNumber(q.question);
    const title = normalizeQuestionText(q.question);

    const chosenKey = result.answers[i];
    const chosenText = keyToText(q, chosenKey);
    const correctText = q.correct_answer;

    const label =
      status === "correct"
        ? `<span class="pill" style="border-color: rgba(120,255,180,.35); background: rgba(120,255,180,.10);">✅ Correct</span>`
      : status === "wrong"
        ? `<span class="pill" style="border-color: rgba(255,120,160,.35); background: rgba(255,120,160,.10);">❌ Wrong</span>`
      : `<span class="pill" style="border-color: rgba(255,210,120,.35); background: rgba(255,210,120,.10);">⏳ Unanswered</span>`;

    const card = document.createElement("div");
    card.className = "card q-card";

    card.innerHTML = `
      <div class="row" style="gap:10px;">
        <div class="q-title">${qNum ? `Q${qNum}. ` : ""}${title}</div>
        ${label}
      </div>

      <div class="q-sub">
        Your answer:
        <b>${chosenKey ? `${chosenKey}. ${chosenText}` : "—"}</b>
      </div>

      <div style="margin-top:10px; display:grid; gap:10px;">
        ${q.optionsShuffled.map(o => {
          const isCorrect = o.key === q.correct_key;
          const isChosen = chosenKey && o.key === chosenKey;
          const cls = isCorrect ? "option correct" : "option";
          const extra = isChosen ? `<span class="pill" style="margin-left:auto;">Your pick</span>` : "";
          return `
            <div class="${cls}">
              <div class="k">${o.key}</div>
              <div style="flex:1;">${o.text}</div>
              ${extra}
            </div>
          `;
        }).join("")}
      </div>

      <div class="ans">
        <div class="lbl">Correct answer</div>
        <div class="val">${q.correct_key}. ${correctText}</div>
      </div>
    `;

    frag.appendChild(card);
  }

  detailsList.appendChild(frag);
}

toggleDetailsBtn.addEventListener("click", ()=>{
  const open = !detailsCard.hidden;
  detailsCard.hidden = open;
  toggleDetailsBtn.innerHTML = open
    ? `<span class="ico">🔎</span> Show Quiz results`
    : `<span class="ico">🙈</span> Hide Quiz results`;

  if(!open){
    renderDetails();
    setStatus("Review mode: look for patterns, not perfection.");
  }else{
    setStatus("");
  }
});

function setFilter(mode){
  filterMode = mode;
  renderDetails();
}
filterAll.addEventListener("click", ()=> setFilter("all"));
filterWrong.addEventListener("click", ()=> setFilter("wrong"));
filterUnanswered.addEventListener("click", ()=> setFilter("unanswered"));

$("backBtn")?.addEventListener("click", ()=>{
  clearExamStorage(); // keep used/wrong tracking in localStorage
});

function boot(){
  if(!result || !result.questions || !Array.isArray(result.questions) || (result.v !== 3)){
    headline.textContent = "No results found";
    summaryText.textContent = "Go back to menu and start an exam first.";
    scoreBadge.textContent = "—";
    timeBadge.textContent = "—";
    toggleDetailsBtn.disabled = true;
    return;
  }
  renderSummary();
}
boot();
