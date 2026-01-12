applySavedTheme();
$("themeBtn").addEventListener("click", toggleTheme);
Loader.show();

const subtitle = $("subtitle");
const countPill = $("countPill");
const listEl = $("list");
const statusEl = $("status");
const searchInput = $("searchInput");
const clearBtn = $("clearBtn");
const loadFileBtn = $("loadFileBtn");
const fileInput = $("fileInput");

let all = [];
let filtered = [];

function setSubtitle(msg){ subtitle.textContent = msg; }
function setStatus(msg=""){ statusEl.textContent = msg; }

function render(){
  listEl.innerHTML = "";
  countPill.textContent = `${filtered.length}`;

  const frag = document.createDocumentFragment();

  filtered.forEach((q)=>{
    const qNum = extractQuestionNumber(q.question);
    const title = normalizeQuestionText(q.question);
    const opts = normalizeOptions(q.options);

    const card = document.createElement("div");
    card.className = "card q-card";
    card.innerHTML = `
      <div class="q-title">${qNum ? `Q${qNum}. ` : ""}${title}</div>
      <div class="q-sub">Options</div>
      <div style="margin-top:10px; display:grid; gap:10px;">
        ${opts.map(o => `
          <div class="option ${o.text === q.correct_answer ? "correct" : ""}">
            <div class="k">${o.key}</div>
            <div>${o.text}</div>
          </div>
        `).join("")}
      </div>
      <div class="ans">
        <div class="lbl">Correct answer</div>
        <div class="val">${q.correct_answer}</div>
      </div>
    `;
    frag.appendChild(card);
  });

  listEl.appendChild(frag);
  setSubtitle(`${all.length} loaded • Showing ${filtered.length}`);
}

function applySearch(){
  const q = searchInput.value.trim().toLowerCase();
  if(!q){
    filtered = all;
  }else{
    filtered = all.filter(item=>{
      const hay = [
        item.question,
        ...Object.values(item.options || {}),
        item.correct_answer
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  render();
}

async function boot(){
  setSubtitle("Loading questions…");
  try{
    all = await loadQuestionsViaFetch();
    filtered = all;
    render();
    setStatus("");
  
    Loader.hide();
}catch(e){
    setSubtitle("Auto-load failed");
    setStatus(`Could not fetch ${DEFAULT_JSON_PATH}. Click “Load JSON” and pick your file. (${e.message || e})`);
    Loader.hide();
  }
}

clearBtn.addEventListener("click", ()=>{
  searchInput.value = "";
  applySearch();
  searchInput.focus();
});

searchInput.addEventListener("input", applySearch);

document.addEventListener("keydown",(e)=>{
  if(e.key === "/" && document.activeElement !== searchInput){
    e.preventDefault();
    searchInput.focus();
  }
});

loadFileBtn.addEventListener("click", ()=> fileInput.click());
fileInput.addEventListener("change", async ()=>{
  Loader.show();
  const f = fileInput.files?.[0];
  if(!f){ Loader.hide(); return; }
  try{
    setSubtitle("Loading from file…");
    all = await loadQuestionsFromFile(f);
    filtered = all;
    render();
    setStatus(`Loaded ${all.length} questions from file.`);
  }catch(e){
    setStatus(`Load failed: ${e.message || e}`);
  }finally{
    Loader.hide();
    fileInput.value = "";
  }
});

boot();