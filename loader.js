(function(){
  const LOADER_ID = "pageLoader";
  const BODY_ATTR = "data-loader";
  const MANUAL = "manual";

  function getEl(){ return document.getElementById(LOADER_ID); }

  function show(){
    const el = getEl();
    if(!el) return;
    el.classList.add("is-visible");
    el.setAttribute("aria-hidden","false");
  }

  function hide(){
    const el = getEl();
    if(!el) return;
    el.classList.remove("is-visible");
    el.setAttribute("aria-hidden","true");
  }

  // Expose globally
  window.Loader = { show, hide };

  // Start visible by default; hide once content is ready (unless manual mode).
  document.addEventListener("DOMContentLoaded", ()=>{
    const mode = document.body?.getAttribute(BODY_ATTR) || "";
    if(mode === MANUAL){
      // Safety fallback: don't block forever if a script errors
      setTimeout(()=>hide(), 8000);
      return;
    }
    // Allow one frame for the loader to paint
    requestAnimationFrame(()=> setTimeout(()=>hide(), 150));
  });

  // Best-effort show on navigation away (may not always paint, but helps).
  window.addEventListener("beforeunload", ()=>{
    try{ show(); }catch(_){}
  });

  // Intercept same-tab in-site navigation links to ensure loader paints before transition.
  document.addEventListener("click", (e)=>{
    const a = e.target.closest("a[href]");
    if(!a) return;

    const href = a.getAttribute("href");
    const target = (a.getAttribute("target") || "").toLowerCase();
    if(!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if(target && target !== "_self") return;

    // Only handle local html navigation to avoid interfering with external links
    const isLocal = href.startsWith("./") || href.startsWith("../") || (!href.includes("://") && !href.startsWith("/"));
    if(!isLocal) return;

    e.preventDefault();
    show();
    setTimeout(()=>{ window.location.href = href; }, 60);
  });

  // Expose helper for JS-driven navigations (so we can paint loader first)
  window.navigateWithLoader = function(url){
    show();
    setTimeout(()=>{ window.location.href = url; }, 60);
  };
})();
