applySavedTheme();
$("themeBtn").addEventListener("click", toggleTheme);

const timerEl = $("timer");
const posBadge = $("posBadge");
const qBadge = $("qBadge");
const progressFill = $("progressFill");
const progressText = $("progressText");
const questionText = $("questionText");
const optionsWrap = $("optionsWrap");
const statusEl = $("status");
const nextBtn = $("nextBtn");

let state = loadJSON(EXAM_STATE_KEY);
let tickHandle = null;

function setStatus(msg=""){ statusEl.textContent = msg; }

function saveState(){
  saveJSON(EXAM_STATE_KEY, state);
}

function remainingSeconds(){
  return Math.ceil((state.endsAt - Date.now()) / 1000);
}

function renderTimer(){
  const rem = remainingSeconds();
  timerEl.textContent = fmtMMSS(rem);

  timerEl.classList.remove("warn","danger");
  if(rem <= 60 && rem > 20) timerEl.classList.add("warn");
  if(rem <= 20) timerEl.classList.add("danger");

  if(rem <= 0){
    finishExam(true);
  }
}

function render(){
  const total = state.questions.length;
  const i = state.currentIndex;
  const q = state.questions[i];

  posBadge.textContent = `${i+1} / ${total}`;

  const qNum = extractQuestionNumber(q.question);
  qBadge.textContent = qNum ? `Q${qNum}` : `Q${i+1}`;

  const pct = Math.round(((i + 1) / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressText.textContent = `Question ${i+1} of ${total}`;

  questionText.textContent = normalizeQuestionText(q.question);

  nextBtn.innerHTML = (i === total - 1)
    ? `<span class="ico">✓</span> Finish`
    : `<span class="ico">→</span> Next`;

  const currentKey = state.answers[i];

  optionsWrap.innerHTML = "";
  for(const opt of q.optionsShuffled){
    const id = `opt_${i}_${opt.key}`;
    const row = document.createElement("label");
    row.className = "option radio";
    row.innerHTML = `
      <input type="radio" name="opt" id="${id}" value="${opt.key}" ${currentKey === opt.key ? "checked" : ""} />
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div class="k">${opt.key}</div>
        <div>${opt.text}</div>
      </div>
    `;

    row.addEventListener("change", (e)=>{
      state.answers[i] = e.target.value;
      saveState();
      setStatus("Answer saved.");
      setTimeout(()=> setStatus(""), 650);
    });

    optionsWrap.appendChild(row);
  }

  setStatus("");
}

function computeScore(result){
  let correct = 0;
  for(let i=0;i<result.questions.length;i++){
    const chosenKey = result.answers[i];
    if(chosenKey && chosenKey === result.questions[i].correct_key) correct++;
  }
  return correct;
}

function finishExam(fromTimer=false){
  if(!state) return;
  if(tickHandle) clearInterval(tickHandle);

  const endedAt = Date.now();

  const result = {
    v: 3,
    startedAt: state.startedAt,
    endedAt,
    durationSec: state.durationSec,
    fromTimer,
    questions: state.questions,
    answers: state.answers
  };

  result.score = computeScore(result);
  result.total = result.questions.length;

  // Update wrong-question tracking (repeat until correct)
  updateWrongTrackingFromResult(result);

  // Resolve any "pulled-from-wrong" pending entries for this completed exam.
  // If the user got something wrong/unanswered, updateWrongTrackingFromResult() already
  // re-added it to the wrong pool.
  clearPendingWrongForIds(result.questions.map(q => q.id));

  saveJSON(EXAM_RESULT_KEY, result);
  sessionStorage.removeItem(EXAM_STATE_KEY);

  window.location.href = "./results.html";
}

nextBtn.addEventListener("click", ()=>{
  const selected = optionsWrap.querySelector('input[name="opt"]:checked');
  if(selected){
    state.answers[state.currentIndex] = selected.value;
    saveState();
  }

  const total = state.questions.length;
  if(state.currentIndex >= total - 1){
    finishExam(false);
    return;
  }

  state.currentIndex++;
  saveState();
  render();
});

function boot(){
  if(!state || !state.questions || !Array.isArray(state.questions) || state.v !== 3){
    window.location.href = "./exam.html";
    return;
  }

  if(remainingSeconds() <= 0){
    finishExam(true);
    return;
  }

  render();
  renderTimer();
  tickHandle = setInterval(renderTimer, 250);
}

boot();
