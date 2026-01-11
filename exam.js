applySavedTheme();
$("themeBtn").addEventListener("click", toggleTheme);

const subtitle = $("subtitle");
const countInput = $("countInput");
const timeInfo = $("timeInfo");
const startBtn = $("startBtn");
const statusEl = $("status");
const dataPill = $("dataPill");

const loadFileBtn = $("loadFileBtn");
const fileInput = $("fileInput");

let all = [];

function setStatus(msg=""){ statusEl.textContent = msg; }
function setSubtitle(msg){ subtitle.textContent = msg; }

function updateTimeInfo(){
  const n = clampInt(countInput.value, 5, 40);
  const totalSec = n * 60;
  timeInfo.textContent = `Total time: ${fmtMMSS(totalSec)} (mm:ss)`;
  startBtn.disabled = !(all.length > 0);
}

function setDataPill(){
  const wrongCount = getWrongIdSet().size;
  dataPill.textContent = all.length
    ? `${all.length} ready • Retry pool: ${wrongCount}`
    : `No data`;
}

async function boot(){
  // If a previous attempt was abandoned, restore any "pulled-from-wrong" questions
  // back into the wrong pool so they are not lost.
  restorePendingWrongToWrongPool();
  clearExamStorage();
  countInput.value = "10";
  updateTimeInfo();

  try{
    setSubtitle("Loading questions…");
    const loaded = await loadQuestionsViaFetch();
    all = attachIds(loaded);
    setDataPill();
    setSubtitle("Ready");
    setStatus("");
    startBtn.disabled = false;
  }catch(e){
    setSubtitle("Auto-load failed");
    setStatus(`Could not fetch ${DEFAULT_JSON_PATH}. Click “Load JSON” and pick your file. (${e.message || e})`);
    all = [];
    setDataPill();
    startBtn.disabled = true;
  }
}

countInput.addEventListener("input", ()=>{
  const n = clampInt(countInput.value, 5, 40);
  if(String(n) !== String(countInput.value)) countInput.value = String(n);
  updateTimeInfo();
});

loadFileBtn.addEventListener("click", ()=> fileInput.click());
fileInput.addEventListener("change", async ()=>{
  const f = fileInput.files?.[0];
  if(!f) return;
  try{
    setSubtitle("Loading from file…");
    const loaded = await loadQuestionsFromFile(f);
    all = attachIds(loaded);
    setDataPill();
    setSubtitle("Ready");
    setStatus(`Loaded ${all.length} questions from file.`);
    startBtn.disabled = false;
  }catch(e){
    setStatus(`Load failed: ${e.message || e}`);
    all = [];
    setDataPill();
    startBtn.disabled = true;
  }finally{
    fileInput.value = "";
  }
});

startBtn.addEventListener("click", ()=>{
  if(!all.length){
    setStatus("No questions loaded yet.");
    return;
  }

  let n = clampInt(countInput.value, 5, 40);
  n = Math.min(n, all.length);

  let used = getUsedIdSet();
  let wrong = getWrongIdSet();

  // Step 1: pick from wrong list first
  const wrongCandidates = all.filter(q => wrong.has(q.id));
  const wrongCountToPick = Math.min(n, wrongCandidates.length);
  const wrongPicked = sampleWithoutReplacement(wrongCandidates, wrongCountToPick);

  // Remove pulled ones from wrong list immediately
  // (Requirement) but also stash them in a persistent "pending" bucket so they can be
  // restored if the user abandons the exam.
  markPendingWrongPulled(wrongPicked.map(q => q.id));
  for(const q of wrongPicked) wrong.delete(q.id);
  saveWrongIdSet(wrong);

  const chosenIds = new Set(wrongPicked.map(q => q.id));
  const remainingNeeded = n - wrongPicked.length;

  // Step 2: fill remaining with unseen questions (unique tracking)
  let unseen = all.filter(q => !used.has(q.id) && !chosenIds.has(q.id));

  if(unseen.length < remainingNeeded){
    // Not enough unseen left => reset used tracking and pick from full pool (excluding already-chosen)
    resetUsedIdSet();
    used = new Set();
    unseen = all.filter(q => !chosenIds.has(q.id));
  }

  const restPicked = sampleWithoutReplacement(unseen, remainingNeeded);
  const pickedRaw = [...wrongPicked, ...restPicked];

  // Mark as used immediately (same behavior as before)
  for(const q of pickedRaw) used.add(q.id);
  saveUsedIdSet(used);

  const quizQuestions = pickedRaw.map(buildQuizQuestion);

  const startedAt = Date.now();
  const durationSec = n * 60;
  const endsAt = startedAt + durationSec * 1000;

  const state = {
    v: 3,
    startedAt,
    endsAt,
    durationSec,
    questions: quizQuestions,
    answers: Array(n).fill(null), // selected KEY ("A"/"B"/"C"/"D") or null
    currentIndex: 0
  };

  saveJSON(EXAM_STATE_KEY, state);
  window.location.href = "./quiz.html";
});

boot();
