(() => {
  const STATUS_LABEL = {
    daily: "✅ Daily driver",
    tested: "🟢 Tested",
    partial: "🟡 Partial",
    untested: "⚪ Untested",
  };

  const state = { q: "", status: "all", folder: null, sub: "All", files: [], folders: [] };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const folderById = (id) => state.folders.find((f) => f.id === id);
  const filesIn = (id) => state.files.filter((f) => f.folder === id);

  // Only allow http(s) links so a bad entry in files.json can't inject javascript: URLs.
  const safeUrl = (u) => {
    if (!u) return null;
    try {
      const url = new URL(u, location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  /* ───────── Setup panel ───────── */
  function renderSetup(setup) {
    const box = $("setup");
    box.replaceChildren();
    (setup || []).forEach(({ label, value }) => {
      const cell = el("div", "cell");
      cell.append(el("div", "k", label), el("div", "v", value));
      box.append(cell);
    });
  }

  /* ───────── Routing (#f/<folder-id>) so the browser back button works ───────── */
  function readHash() {
    const m = /^#f\/([\w-]+)/.exec(location.hash);
    state.folder = m && folderById(m[1]) ? m[1] : null;
    state.sub = "All";
  }

  function openFolder(id) {
    location.hash = "f/" + id;
  }

  function goRoot() {
    location.hash = "files";
  }

  function scrollToFiles() {
    const s = $("files");
    if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ───────── Filtering ───────── */
  function matches(f) {
    if (state.folder && f.folder !== state.folder) return false;
    if (state.folder && state.sub !== "All" && f.sub !== state.sub) return false;
    if (state.status !== "all" && f.status !== state.status) return false;
    if (!state.q) return true;
    const fo = folderById(f.folder);
    const hay = [f.name, f.version, f.sub, f.notes, f.author, f.status, fo && fo.name].join(" ").toLowerCase();
    return state.q.split(/\s+/).every((w) => hay.includes(w));
  }

  /* ───────── Folder grid ───────── */
  function renderFolders() {
    const box = $("folders");
    box.replaceChildren();
    state.folders.forEach((fo, i) => {
      const n = filesIn(fo.id).length;
      const b = el("button", "folder");
      b.type = "button";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", "Open folder " + fo.name);

      const icon = el("span", "folder-icon", fo.icon || "📁");
      const name = el("span", "folder-name", fo.name);
      const desc = el("span", "folder-desc", fo.desc || "");
      const count = el("span", "folder-count" + (n ? "" : " empty-folder"), n ? n + (n === 1 ? " file" : " files") : "Empty");

      b.append(icon, name, desc, count);
      b.addEventListener("click", () => openFolder(fo.id));
      box.append(b);
    });
  }

  /* ───────── Breadcrumb + sub-chips (inside a folder) ───────── */
  function renderCrumbs() {
    const box = $("crumbs");
    box.replaceChildren();
    const fo = folderById(state.folder);
    if (!fo) return;

    const back = el("button", "crumb-back", "← All folders");
    back.type = "button";
    back.addEventListener("click", goRoot);

    const trail = el("div", "crumb-trail");
    trail.append(el("span", "crumb-root", "Files"), el("span", "crumb-sep", "/"), el("span", "crumb-now", (fo.icon || "") + " " + fo.name));

    box.append(back, trail);
    if (fo.desc) box.append(el("p", "crumb-desc", fo.desc));
  }

  function renderSubChips() {
    const box = $("chips");
    box.replaceChildren();
    if (!state.folder) {
      box.hidden = true;
      return;
    }
    const inFolder = filesIn(state.folder);
    const subs = [...new Set(inFolder.map((f) => f.sub).filter(Boolean))];
    if (subs.length < 2) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    ["All", ...subs].forEach((s) => {
      const n = s === "All" ? inFolder.length : inFolder.filter((f) => f.sub === s).length;
      const b = el("button", "chip" + (state.sub === s ? " active" : ""));
      b.type = "button";
      b.append(document.createTextNode(s), el("small", "", String(n)));
      b.addEventListener("click", () => {
        state.sub = s;
        renderSubChips();
        renderList();
      });
      box.append(b);
    });
  }

  /* ───────── File card ───────── */
  function card(f, showFolder) {
    const c = el("article", "card");

    const left = el("div");
    const h = el("h3", "", f.name);
    if (showFolder) {
      const fo = folderById(f.folder);
      if (fo) h.append(el("span", "tag cat", (fo.icon || "") + " " + fo.name));
    } else if (f.sub) {
      h.append(el("span", "tag cat", f.sub));
    }
    if (STATUS_LABEL[f.status]) h.append(el("span", "tag " + f.status, STATUS_LABEL[f.status]));
    left.append(h);

    const meta = el("div", "meta");
    if (f.version) meta.append(el("span", "", "v " + f.version));
    if (f.size) meta.append(el("span", "", f.size));
    if (f.date) meta.append(el("span", "", f.date));
    if (f.author) meta.append(el("span", "", "by " + f.author));
    left.append(meta);

    const actions = el("div", "actions");
    if (f.sha256) {
      const copy = el("button", "btn ghost small", "SHA-256");
      copy.type = "button";
      copy.title = "Copy checksum";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(f.sha256);
          copy.textContent = "Copied";
        } catch {
          copy.textContent = f.sha256.slice(0, 12) + "…";
        }
        setTimeout(() => (copy.textContent = "SHA-256"), 1600);
      });
      actions.append(copy);
    }
    const href = safeUrl(f.url);
    if (href) {
      const a = el("a", "btn", "Download");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      actions.append(a);
    } else {
      actions.append(el("span", "btn disabled", "Link soon"));
    }
    const src = safeUrl(f.source);
    if (src) {
      const s = el("a", "btn ghost", "Source");
      s.href = src;
      s.target = "_blank";
      s.rel = "noopener noreferrer";
      actions.append(s);
    }

    c.append(left, actions);
    if (f.notes) c.append(el("p", "notes", f.notes));
    return c;
  }

  /* ───────── Main render ───────── */
  function renderList() {
    const list = $("list");
    const inFolder = !!state.folder;
    const searching = !inFolder && (state.q || state.status !== "all");
    const shown = state.files.filter(matches);

    list.replaceChildren();

    if (!inFolder && !searching) return;

    if (!shown.length) {
      const total = inFolder ? filesIn(state.folder).length : 0;
      const msg =
        inFolder && total === 0
          ? "Nothing in this folder yet. Coming soon."
          : "Nothing matches. Try a different search or filter.";
      list.append(el("p", "empty", msg));
    } else {
      shown.forEach((f, i) => {
        const c = card(f, !inFolder);
        c.style.setProperty("--i", Math.min(i, 12));
        list.append(c);
      });
    }

    $("count").textContent = inFolder
      ? shown.length + " of " + filesIn(state.folder).length + " files"
      : shown.length + " of " + state.files.length + " files";
  }

  function render() {
    const inFolder = !!state.folder;
    const searching = !inFolder && (state.q || state.status !== "all");

    $("crumbs").hidden = !inFolder;
    $("folders").hidden = inFolder || searching;
    $("list").hidden = !(inFolder || searching);

    if (inFolder) renderCrumbs();
    renderSubChips();
    renderList();

    if (!inFolder && !searching) {
      $("count").textContent = state.folders.length + " folders · " + state.files.length + " files";
    }
  }

  /* ───────── Guides + changelog ───────── */
  function renderGuides(guides) {
    const box = $("guideList");
    box.replaceChildren();
    (guides || []).forEach((g) => {
      const d = el("details");
      d.append(el("summary", "", g.title));
      const ol = el("ol");
      (g.steps || []).forEach((s) => ol.append(el("li", "", s)));
      d.append(ol);
      box.append(d);
    });
  }

  function renderLog(log) {
    const ol = $("logList");
    ol.replaceChildren();
    (log || []).forEach((e) => {
      const li = el("li");
      li.append(el("div", "date", e.date), el("div", "title", e.title));
      if (e.desc) li.append(el("p", "desc", e.desc));
      ol.append(li);
    });
  }

  /* ───────── Effects: cursor glass highlight + scroll reveal ───────── */
  function initFx() {
    document.addEventListener(
      "pointermove",
      (e) => {
        const t = e.target.closest && e.target.closest(".card, .folder, .about, .setup .cell");
        if (!t) return;
        const r = t.getBoundingClientRect();
        t.style.setProperty("--mx", e.clientX - r.left + "px");
        t.style.setProperty("--my", e.clientY - r.top + "px");
      },
      { passive: true }
    );

    if (!("IntersectionObserver" in window)) return;
    // Only elements that are always visible (never display:none) can be revealed safely.
    const targets = document.querySelectorAll(".section-head, .toolbar, details, .log li, .about");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((t, i) => {
      t.classList.add("reveal");
      t.style.transitionDelay = (i % 4) * 60 + "ms";
      io.observe(t);
    });
  }

  function bind() {
    $("search").addEventListener("input", (e) => {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    $("status").addEventListener("change", (e) => {
      state.status = e.target.value;
      render();
    });
    window.addEventListener("hashchange", () => {
      const wasFolder = state.folder;
      readHash();
      render();
      if (state.folder || wasFolder) scrollToFiles();
    });
  }

  async function init() {
    $("year").textContent = new Date().getFullYear();
    bind();
    try {
      const res = await fetch("data/files.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.files = data.files || [];
      state.folders = data.folders || [];
      renderSetup(data.setup);
      renderFolders();
      readHash();
      render();
      renderGuides(data.guides);
      renderLog(data.changelog);
      if (state.folder) setTimeout(scrollToFiles, 150);
    } catch (err) {
      $("folders").hidden = true;
      $("list").hidden = false;
      $("list").replaceChildren(
        el(
          "p",
          "empty",
          "Couldn't load data/files.json. If you opened index.html directly from your computer, run it through a local server or deploy it to GitHub Pages."
        )
      );
      console.error(err);
    }
    initFx();
  }

  init();
})();
