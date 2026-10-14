(() => {
  const STATUS_LABEL = {
    daily: "✅ Daily driver",
    tested: "🟢 Tested",
    partial: "🟡 Partial",
    untested: "⚪ Untested",
  };

  const state = { q: "", cat: "All", status: "all", files: [] };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

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

  function renderSetup(setup) {
    const box = $("setup");
    box.replaceChildren();
    (setup || []).forEach(({ label, value }) => {
      const cell = el("div", "cell");
      cell.append(el("div", "k", label), el("div", "v", value));
      box.append(cell);
    });
  }

  function renderChips() {
    const cats = ["All", ...new Set(state.files.map((f) => f.category))];
    const box = $("chips");
    box.replaceChildren();
    cats.forEach((c) => {
      const n = c === "All" ? state.files.length : state.files.filter((f) => f.category === c).length;
      const b = el("button", "chip" + (state.cat === c ? " active" : ""));
      b.type = "button";
      b.append(document.createTextNode(c));
      const s = el("small", "", String(n));
      b.append(s);
      b.addEventListener("click", () => {
        state.cat = c;
        renderChips();
        renderList();
      });
      box.append(b);
    });
  }

  function matches(f) {
    if (state.cat !== "All" && f.category !== state.cat) return false;
    if (state.status !== "all" && f.status !== state.status) return false;
    if (!state.q) return true;
    const hay = [f.name, f.version, f.category, f.notes, f.author, f.status].join(" ").toLowerCase();
    return state.q.split(/\s+/).every((w) => hay.includes(w));
  }

  function card(f) {
    const c = el("article", "card");

    const left = el("div");
    const h = el("h3", "", f.name);
    h.append(el("span", "tag cat", f.category));
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

  function renderList() {
    const list = $("list");
    const shown = state.files.filter(matches);
    $("count").textContent = shown.length + " of " + state.files.length + " files";
    list.replaceChildren();
    if (!shown.length) {
      list.append(el("p", "empty", "Nothing matches. Try a different search or category."));
      return;
    }
    shown.forEach((f, i) => {
      const c = card(f);
      c.style.setProperty("--i", Math.min(i, 12));
      list.append(c);
    });
  }

  // Cursor-following glass highlight + scroll reveal
  function initFx() {
    document.addEventListener(
      "pointermove",
      (e) => {
        const t = e.target.closest && e.target.closest(".card, .about, .setup .cell");
        if (!t) return;
        const r = t.getBoundingClientRect();
        t.style.setProperty("--mx", e.clientX - r.left + "px");
        t.style.setProperty("--my", e.clientY - r.top + "px");
      },
      { passive: true }
    );

    const targets = document.querySelectorAll(
      ".section-head, .toolbar, .chips, details, .log li, .about"
    );
    if (!("IntersectionObserver" in window)) return;
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

  function bind() {
    $("search").addEventListener("input", (e) => {
      state.q = e.target.value.trim().toLowerCase();
      renderList();
    });
    $("status").addEventListener("change", (e) => {
      state.status = e.target.value;
      renderList();
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
      renderSetup(data.setup);
      renderChips();
      renderList();
      renderGuides(data.guides);
      renderLog(data.changelog);
    } catch (err) {
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
