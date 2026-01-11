const DEFAULT_JSON_PATH = "./questions_unique.json";
const EXAM_STATE_KEY = "rt_exam_state_v1";
const EXAM_RESULT_KEY = "rt_exam_result_v1";

const USED_QIDS_KEY = "rt_used_question_ids_v1";
const WRONG_QIDS_KEY = "rt_wrong_question_ids_v1";
// When we pull items from the wrong pool to build an exam, we remove them immediately
// (per requirement). To avoid losing those questions if the user abandons the exam
// (tab close / hard refresh / navigating away), we also store pulled-wrong IDs here
// until the exam is finished.
const PENDING_WRONG_PULLED_KEY = "rt_pending_wrong_pulled_ids_v1";

function $(id){ return document.getElementById(id); }

function applySavedTheme(){
  const saved = localStorage.getItem("rt_theme");
  const theme = (saved === "light" || saved === "dark") ? saved : "dark";
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme(){
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("rt_theme", next);
}

function shuffleInPlace(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sampleWithoutReplacement(arr, n){
  const copy = [...arr];
  shuffleInPlace(copy);
  return copy.slice(0, Math.min(n, copy.length));
}

function extractQuestionNumber(questionField){
  const m = String(questionField).match(/Question\s+(\d+)\s*:/i);
  return m ? Number(m[1]) : null;
}

function normalizeQuestionText(questionField){
  return String(questionField).replace(/^Question\s+\d+\s*:\s*/i, "").trim();
}

function normalizeOptions(optionsObj){
  const keys = Object.keys(optionsObj || {}).sort((a,b)=>Number(a)-Number(b));
  return keys.map((k,i)=>({ key:String.fromCharCode(65+i), text: optionsObj[k] }));
}

function validateQuestions(data){
  if(!Array.isArray(data)) throw new Error("JSON root must be an array.");
  for(let i=0;i<data.length;i++){
    const q = data[i];
    if(!q || typeof q !== "object") throw new Error(`Item ${i} is not an object.`);
    if(typeof q.question !== "string") throw new Error(`Item ${i} missing 'question' string.`);
    if(!q.options || typeof q.options !== "object") throw new Error(`Item ${i} missing 'options' object.`);
    if(typeof q.correct_answer !== "string") throw new Error(`Item ${i} missing 'correct_answer' string.`);
    const optionKeys = Object.keys(q.options);
    if(optionKeys.length !== 4){
      throw new Error(`Item ${i} must have exactly 4 options (found ${optionKeys.length}).`);
    }
    const optionValues = Object.values(q.options);
    if(optionValues.some(v => typeof v !== "string")){
      throw new Error(`Item ${i} options must all be strings.`);
    }
    // Duplicate option text makes correct mapping ambiguous after shuffling.
    const uniq = new Set(optionValues);
    if(uniq.size !== optionValues.length){
      throw new Error(`Item ${i} has duplicate option text. Please ensure all 4 options are unique.`);
    }
    if(!optionValues.includes(q.correct_answer)){
      throw new Error(`Item ${i} correct_answer does not match any option value.`);
    }
  }
  return data;
}

async function loadQuestionsViaFetch(){
  const res = await fetch(DEFAULT_JSON_PATH, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} — could not load ${DEFAULT_JSON_PATH}`);
  const data = await res.json();
  return validateQuestions(data);
}

function loadQuestionsFromFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Failed to read file."));
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(String(reader.result));
        resolve(validateQuestions(parsed));
      }catch(e){ reject(e); }
    };
    reader.readAsText(file);
  });
}

function saveJSON(key, obj){
  sessionStorage.setItem(key, JSON.stringify(obj));
}
function loadJSON(key){
  const raw = sessionStorage.getItem(key);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}
function clearExamStorage(){
  sessionStorage.removeItem(EXAM_STATE_KEY);
  sessionStorage.removeItem(EXAM_RESULT_KEY);
}

function clampInt(v, min, max){
  const n = Number(v);
  if(!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function fmtMMSS(totalSeconds){
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s/60);
  const r = s%60;
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

/* ===========================
   Unique IDs + Tracking
=========================== */

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function makeQuestionId(q){
  const base = `${q.question}||${q.correct_answer}||${Object.values(q.options).join("||")}`;
  return `q_${fnv1a32(base).toString(16).padStart(8,"0")}`;
}

function attachIds(questions){
  return questions.map(q => ({ ...q, id: q.id || makeQuestionId(q) }));
}

function getIdSet(key){
  const raw = localStorage.getItem(key);
  if(!raw) return new Set();
  try{
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  }catch{
    return new Set();
  }
}
function saveIdSet(key, set){
  localStorage.setItem(key, JSON.stringify([...set]));
}

function getUsedIdSet(){ return getIdSet(USED_QIDS_KEY); }
function saveUsedIdSet(set){ saveIdSet(USED_QIDS_KEY, set); }
function resetUsedIdSet(){ localStorage.removeItem(USED_QIDS_KEY); }

function getWrongIdSet(){ return getIdSet(WRONG_QIDS_KEY); }
function saveWrongIdSet(set){ saveIdSet(WRONG_QIDS_KEY, set); }
function resetWrongIdSet(){ localStorage.removeItem(WRONG_QIDS_KEY); }

function getPendingWrongIdSet(){ return getIdSet(PENDING_WRONG_PULLED_KEY); }
function savePendingWrongIdSet(set){ saveIdSet(PENDING_WRONG_PULLED_KEY, set); }
function resetPendingWrongIdSet(){ localStorage.removeItem(PENDING_WRONG_PULLED_KEY); }

// Called when starting an exam: move pulled-wrong IDs into a persistent "pending" bucket.
// This prevents wrong questions from being "lost" if the user abandons the exam.
function markPendingWrongPulled(ids){
  const pending = getPendingWrongIdSet();
  for(const id of ids) pending.add(id);
  if(pending.size) savePendingWrongIdSet(pending);
}

// Called when finishing an exam: those pending items have been resolved (either corrected
// or re-added to WRONG by updateWrongTrackingFromResult()).
function clearPendingWrongForIds(ids){
  const pending = getPendingWrongIdSet();
  if(!pending.size) return;
  let changed = false;
  for(const id of ids){
    if(pending.delete(id)) changed = true;
  }
  if(!changed) return;
  if(pending.size) savePendingWrongIdSet(pending);
  else resetPendingWrongIdSet();
}

// Called on exam-setup / menu load to avoid losing pulled-wrong questions when an exam
// is abandoned. Moves any pending IDs back into the wrong pool.
function restorePendingWrongToWrongPool(){
  const pending = getPendingWrongIdSet();
  if(!pending.size) return 0;

  const wrong = getWrongIdSet();
  for(const id of pending) wrong.add(id);
  saveWrongIdSet(wrong);
  resetPendingWrongIdSet();
  return pending.size;
}

/* ===========================
   Quiz question builder
=========================== */

function buildQuizQuestion(q){
  const originalOptions = Object.values(q.options);
  const shuffledTexts = [...originalOptions];
  shuffleInPlace(shuffledTexts);

  const optionsShuffled = shuffledTexts.map((text, i) => ({
    key: String.fromCharCode(65 + i),
    text
  }));

  const correctIndex = optionsShuffled.findIndex(o => o.text === q.correct_answer);
  const correctKey = correctIndex >= 0 ? optionsShuffled[correctIndex].key : null;

  if(!correctKey){
    throw new Error(`Could not map correct answer after shuffle for question id=${q.id}`);
  }

  return {
    id: q.id,
    question: q.question,
    optionsShuffled,
    correct_answer: q.correct_answer,
    correct_key: correctKey
  };
}

/* ===========================
   Wrong-answer tracking update
=========================== */

function updateWrongTrackingFromResult(result){
  const wrong = getWrongIdSet();

  for(let i=0;i<result.questions.length;i++){
    const q = result.questions[i];
    const chosenKey = result.answers[i];
    const isCorrect = chosenKey && chosenKey === q.correct_key;

    if(isCorrect){
      wrong.delete(q.id);
    }else{
      // wrong OR unanswered => reappear until correct
      wrong.add(q.id);
    }
  }

  saveWrongIdSet(wrong);
}
