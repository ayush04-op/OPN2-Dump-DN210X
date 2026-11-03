(() => {
  const TABS = ["files", "guides", "changelog", "about"];

  const STATUS_LABEL = {
    daily: "✅ Daily driver",
    tested: "🟢 Tested",
    partial: "🟡 Partial",
    untested: "⚪ Untested",
  };

  const state = { tab: "files", q: "", status: "all", folder: null, sub: "All", files: [], folders: [], guides: [] };

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

  const extLink = (cls, label, url) => {
    const href = safeUrl(url);
    if (!href) return null;
    const a = el("a", cls, label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
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

  /* ───────── Routing: #files, #guides, #changelog, #about, #f/<folder-id> ───────── */
  function readHash() {
    const h = location.hash;
    const m = /^#f\/([\w-]+)/.exec(h);
    if (m && folderById(m[1])) {
      state.tab = "files";
      state.folder = m[1];
      state.sub = "All";
      return;
    }
    const t = h.replace("#", "");
    if (TABS.includes(t)) {
      state.tab = t;
      state.folder = null;
      state.sub = "All";
    } else if (!h || h === "#") {
      state.tab = "files";
      state.folder = null;
      state.sub = "All";
    }
    // Any other hash is ignored, so the current tab stays put.
  }

  const goRoot = () => {
    location.hash = "files";
  };
  const openFolder = (id) => {
    location.hash = "f/" + id;
  };
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  /* ───────── Tabs ───────── */
  function showTab() {
    document.querySelectorAll("[data-panel]").forEach((p) => {
      p.hidden = p.dataset.panel !== state.tab;
    });
    document.querySelectorAll("#nav a").forEach((a) => {
      const on = a.dataset.tab === state.tab;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    // The intro banner only belongs on the Files home view
    $("hero").hidden = !(state.tab === "files" && !state.folder);
  }

  /* ───────── Filtering ───────── */
  function matches(f) {
    if (state.folder && f.folder !== state.folder) return false;
    if (state.folder && state.sub !== "All" && f.sub !== state.sub) return false;
    if (state.status !== "all" && f.status !== state.status) return false;
    if (!state.q) return true;
    const fo = folderById(f.folder);
    const linkText = (f.links || []).map((l) => l.label).join(" ");
    const hay = [f.name, f.version, f.android, f.kind, f.sub, f.notes, f.author, f.status, linkText, fo && fo.name]
      .join(" ")
      .toLowerCase();
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

      b.append(
        el("span", "folder-icon", fo.icon || "📁"),
        el("span", "folder-name", fo.name),
        el("span", "folder-desc", fo.desc || ""),
        el("span", "folder-count" + (n ? "" : " empty-folder"), n ? n + (n === 1 ? " file" : " files") : "Empty")
      );
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
    trail.append(
      el("span", "crumb-root", "Files"),
      el("span", "crumb-sep", "/"),
      el("span", "crumb-now", (fo.icon || "") + " " + fo.name)
    );

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
    if (f.kind) h.append(el("span", "tag kind", f.kind));
    if (STATUS_LABEL[f.status]) h.append(el("span", "tag " + f.status, STATUS_LABEL[f.status]));
    left.append(h);

    const meta = el("div", "meta");
    if (f.android) meta.append(el("span", "", "Android " + f.android));
    if (f.version && f.version !== "—") meta.append(el("span", "", /^\d/.test(f.version) ? "v " + f.version : f.version));
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
    const dl = extLink("btn", "Download", f.url);
    actions.append(dl || el("span", "btn disabled", "Link soon"));
    const src = extLink("btn ghost", "Source", f.source);
    if (src) actions.append(src);
    (f.links || []).forEach((l) => {
      const a = extLink("btn ghost small", l.label, l.url);
      if (a) actions.append(a);
    });

    c.append(left, actions);
    if (f.notes) c.append(el("p", "notes", f.notes));
    return c;
  }

  /* ───────── Files tab render ───────── */
  function renderList() {
    const list = $("list");
    const inFolder = !!state.folder;
    const searching = !inFolder && (state.q || state.status !== "all");
    const shown = state.files.filter(matches);

    list.replaceChildren();
    if (!inFolder && !searching) return;

    if (!shown.length) {
      const total = inFolder ? filesIn(state.folder).length : 0;
      list.append(
        el(
          "p",
          "empty",
          inFolder && total === 0 ? "Nothing in this folder yet. Coming soon." : "Nothing matches. Try a different search or filter."
        )
      );
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

  function renderFiles() {
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

  function render() {
    showTab();
    renderFiles();
  }

  /* ───────── Guides ───────── */
  function block(title, node) {
    const wrap = el("div", "g-block");
    wrap.append(el("h4", "", title), node);
    return wrap;
  }

  function renderGuides(guides) {
    const box = $("guideList");
    box.replaceChildren();
    $("guideCount").textContent = (guides || []).length + " guides";

    (guides || []).forEach((g) => {
      const d = el("details", "guide");

      const sum = el("summary");
      const title = el("span", "g-title");
      title.append(el("span", "g-name", g.title));
      if (g.summary) title.append(el("span", "g-sum", g.summary));
      sum.append(title);
      d.append(sum);

      const body = el("div", "g-body");

      if (g.prereqs && g.prereqs.length) {
        const ul = el("ul", "g-list");
        g.prereqs.forEach((p) => ul.append(el("li", "", p)));
        body.append(block("You will need", ul));
      }
      if (g.steps && g.steps.length) {
        const ol = el("ol", "g-steps");
        g.steps.forEach((s) => ol.append(el("li", "", s)));
        body.append(block("Steps", ol));
      }
      (g.warnings || []).forEach((w) => {
        const warn = el("div", "g-warn");
        warn.append(el("strong", "", "⚠ Watch out. "), document.createTextNode(w));
        body.append(warn);
      });
      if (g.credit) body.append(el("p", "g-credit", g.credit));

      const actions = el("div", "g-actions");
      (g.links || []).forEach((l) => {
        const a = extLink("btn ghost small", l.label + " ↗", l.url);
        if (a) actions.append(a);
      });
      (g.related || []).forEach((r) => {
        const a = el("a", "btn ghost small", r.label);
        a.href = r.folder ? "#f/" + r.folder : "#" + (r.tab || "files");
        actions.append(a);
      });
      if (actions.childNodes.length) body.append(actions);

      d.append(body);
      box.append(d);
    });
  }

  /* ───────── Changelog ───────── */
  function renderLog(log) {
    const ol = $("logList");
    ol.replaceChildren();
    (log || []).forEach((e) => {
      const li = el("li");
      li.append(el("div", "date", e.date), el("div", "title", e.title));
      if (e.desc) li.append(el("p", "desc", e.desc));
      if (e.items && e.items.length) {
        const ul = el("ul", "log-items");
        e.items.forEach((t) => ul.append(el("li", "", t)));
        li.append(ul);
      }
      ol.append(li);
    });
  }

  /* ───────── About: live folder counts ───────── */
  function renderAboutCounts() {
    document.querySelectorAll("[data-folder-count]").forEach((s) => {
      const n = filesIn(s.dataset.folderCount).length;
      s.textContent = n ? "(" + n + (n === 1 ? " file)" : " files)") : "(empty)";
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
    const targets = document.querySelectorAll(
      ".section-head, .toolbar, .panel-intro, .guide, .log li, .about, .about-links"
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1 }
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
      renderFiles();
    });
    $("status").addEventListener("change", (e) => {
      state.status = e.target.value;
      renderFiles();
    });
    window.addEventListener("hashchange", () => {
      readHash();
      render();
      toTop();
    });
    // "Back to top" shouldn't change the tab
    document.querySelectorAll('a[href="#top"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        toTop();
      })
    );
  }

  async function init() {
    $("year").textContent = new Date().getFullYear();
    bind();
    readHash();
    showTab();
    $("folders").replaceChildren(el("p", "empty", "Loading files…"));

    try {
      const res = await fetch("data/files.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.files = data.files || [];
      state.folders = data.folders || [];
      state.guides = data.guides || [];
      renderSetup(data.setup);
      renderFolders();
      readHash(); // folders are known now, so #f/<id> links resolve
      render();
      renderGuides(data.guides);
      renderLog(data.changelog);
      renderAboutCounts();
    } catch (err) {
      $("folders").replaceChildren(
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
