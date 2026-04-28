(function () {
  "use strict";

  const THEME_KEY = "toolbox-theme";

  /** @type {{ repoBaseUrl: string, tools: any[] } | null} */
  let data = null;
  let filterText = "";

  function $(sel) {
    return document.querySelector(sel);
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || "auto";
  }

  function applyTheme(value) {
    const root = document.documentElement;
    if (value === "light" || value === "dark") {
      root.setAttribute("data-theme", value);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function parseRoute() {
    const h = (window.location.hash || "#/").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "tool" && parts[1]) {
      return { view: "tool", slug: decodeURIComponent(parts[1]) };
    }
    return { view: "home" };
  }

  function setRouteHome() {
    window.location.hash = "#/";
  }

  function setRouteTool(slug) {
    window.location.hash = "#/tool/" + encodeURIComponent(slug);
  }

  function normalize(s) {
    return (s || "").toLowerCase();
  }

  function matchesFilter(tool) {
    if (!filterText.trim()) return true;
    const q = normalize(filterText);
    const hay = [
      tool.name,
      tool.slug,
      tool.description,
      tool.intent,
      (tool.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function groupByIntent(tools) {
    const map = new Map();
    for (const t of tools) {
      const k = t.intent || "other";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function renderNav() {
    const nav = $("#nav-tree");
    if (!nav || !data) return;
    nav.innerHTML = "";
    const tools = data.tools.filter(matchesFilter);
    const groups = groupByIntent(tools);
    const route = parseRoute();

    for (const [intent, list] of groups) {
      const det = document.createElement("details");
      det.open = true;
      const sum = document.createElement("summary");
      sum.textContent = intent;
      det.appendChild(sum);
      const ul = document.createElement("ul");
      for (const t of list.sort((a, b) => a.slug.localeCompare(b.slug))) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#/tool/" + encodeURIComponent(t.slug);
        a.textContent = t.name || t.slug;
        if (route.view === "tool" && route.slug === t.slug) {
          a.classList.add("active");
        }
        a.addEventListener("click", function (e) {
          e.preventDefault();
          setRouteTool(t.slug);
        });
        li.appendChild(a);
        ul.appendChild(li);
      }
      det.appendChild(ul);
      nav.appendChild(det);
    }

    if (groups.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No tools match your search.";
      nav.appendChild(p);
    }
  }

  function renderRightRail(tool) {
    const rail = $("#right-rail");
    if (!rail) return;
    rail.innerHTML = "";

    if (!tool) {
      rail.innerHTML =
        '<p class="muted" style="margin:0">Select a tool or search in the sidebar.</p>';
      return;
    }

    const hToc = document.createElement("h2");
    hToc.textContent = "On this page";
    rail.appendChild(hToc);

    const toc = tool.toc || [];
    if (toc.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No headings in README.";
      rail.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      for (const item of toc) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + encodeURIComponent(item.id);
        a.textContent = item.text;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          const el = document.getElementById(item.id);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.style.paddingLeft = (item.level - 1) * 0.5 + "rem";
        li.appendChild(a);
        ul.appendChild(li);
      }
      rail.appendChild(ul);
    }

    const hTags = document.createElement("h2");
    hTags.textContent = "Tags";
    rail.appendChild(hTags);

    const wrap = document.createElement("div");
    wrap.className = "tag-list";
    const tags = tool.tags || [];
    if (tags.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No tags.";
      rail.appendChild(p);
    } else {
      for (const tag of tags) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tag";
        b.textContent = tag;
        b.addEventListener("click", function () {
          filterText = tag;
          const search = $("#tool-search");
          if (search) search.value = tag;
          render();
        });
        wrap.appendChild(b);
      }
      rail.appendChild(wrap);
    }
  }

  function renderMain() {
    const main = $("#main");
    if (!main || !data) return;
    const route = parseRoute();

    if (route.view === "home") {
      renderRightRail(null);
      const tools = data.tools.filter(matchesFilter);
      main.innerHTML = "";
      const lead = document.createElement("p");
      lead.className = "home-lead";
      lead.textContent =
        "Personal toolbox — browse by intent or search. Data is generated from manifests and READMEs in the repo.";
      main.appendChild(lead);

      const grid = document.createElement("div");
      grid.className = "tool-grid";
      for (const t of tools) {
        const a = document.createElement("a");
        a.className = "tool-card";
        a.href = "#/tool/" + encodeURIComponent(t.slug);
        a.addEventListener("click", function (e) {
          e.preventDefault();
          setRouteTool(t.slug);
        });
        const h = document.createElement("h2");
        h.textContent = t.name || t.slug;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = [t.intent, t.runtime, t.status].filter(Boolean).join(" · ");
        const p = document.createElement("p");
        p.textContent = t.description || "";
        a.appendChild(h);
        a.appendChild(meta);
        a.appendChild(p);
        grid.appendChild(a);
      }
      main.appendChild(grid);
      if (tools.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No tools match your search.";
        main.appendChild(empty);
      }
      document.title = "toolbox";
      return;
    }

    const tool = data.tools.find(function (t) {
      return t.slug === route.slug;
    });
    if (!tool) {
      renderRightRail(null);
      main.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Tool not found.";
      const back = document.createElement("p");
      const a = document.createElement("a");
      a.href = "#/";
      a.textContent = "← Home";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        setRouteHome();
      });
      back.appendChild(a);
      main.appendChild(p);
      main.appendChild(back);
      document.title = "Not found · toolbox";
      return;
    }

    renderRightRail(tool);
    main.innerHTML = "";

    const header = document.createElement("header");
    header.className = "article-header";
    const h1 = document.createElement("h1");
    h1.textContent = tool.name || tool.slug;
    header.appendChild(h1);

    const metaRow = document.createElement("div");
    metaRow.className = "meta-row";
    metaRow.innerHTML =
      "<span><strong>Intent</strong> " +
      escapeHtml(tool.intent) +
      "</span>" +
      "<span><strong>Runtime</strong> " +
      escapeHtml(tool.runtime) +
      "</span>" +
      "<span><strong>Status</strong> " +
      escapeHtml(tool.status) +
      "</span>";
    header.appendChild(metaRow);
    main.appendChild(header);

    const prose = document.createElement("article");
    prose.className = "prose";
    prose.innerHTML = tool.readmeHtml || "";
    main.appendChild(prose);

    const src = document.createElement("div");
    src.className = "source-links";
    const h2 = document.createElement("h2");
    h2.textContent = "Source";
    src.appendChild(h2);
    const p = document.createElement("p");
    const repo = document.createElement("a");
    repo.href = tool.sourceDirUrl;
    repo.rel = "noopener";
    repo.textContent = "View folder on GitHub";
    p.appendChild(repo);
    src.appendChild(p);
    const ul = document.createElement("ul");
    for (const f of tool.sourceFiles || []) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = f.url;
      a.rel = "noopener";
      a.textContent = f.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
    src.appendChild(ul);
    main.appendChild(src);

    document.title = (tool.name || tool.slug) + " · toolbox";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    renderNav();
    renderMain();
  }

  async function load() {
    const res = await fetch("./tools.json", { cache: "no-store" });
    if (!res.ok) {
      $("#main").innerHTML =
        '<p class="muted">Could not load tools.json. Run <code>node scripts/build-site.mjs</code> then refresh.</p>';
      $("#nav-tree").innerHTML = "";
      $("#right-rail").innerHTML = "";
      return;
    }
    data = await res.json();
    render();
  }

  function initTheme() {
    const sel = $("#theme-select");
    if (!sel) return;
    sel.value = getTheme();
    applyTheme(sel.value);
    sel.addEventListener("change", function () {
      localStorage.setItem(THEME_KEY, sel.value);
      applyTheme(sel.value);
    });
  }

  const search = $("#tool-search");
  if (search) {
    search.addEventListener("input", function () {
      filterText = search.value;
      render();
    });
  }

  window.addEventListener("hashchange", render);

  initTheme();
  load();
})();
