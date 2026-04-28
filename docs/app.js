(function () {
  "use strict";

  /**
   * UX testing: disable features via
   * - localStorage key toolbox-ux-flags (JSON): {"layout-scroll": false}
   * - URL ?uxoff=layout-scroll,mobile-drawer
   * Tokens use hyphens: layout-scroll, home-tabs, categorized-home, topbar-search,
   * search-clear, nav-home, nav-indent, right-rail-blend, toc-offset,
   * mobile-drawer, body-scroll-lock
   */

  const THEME_KEY = "toolbox-theme";
  const UX_STORAGE_KEY = "toolbox-ux-flags";

  /** @type {{ repoBaseUrl: string, tools: any[], home?: { readmeHtml: string, toc: any[] } } | null} */
  let data = null;
  let filterText = "";

  function $(sel) {
    return document.querySelector(sel);
  }

  function ux(flag) {
    const off = (document.documentElement.getAttribute("data-ux-off") || "").split(/\s+/).filter(Boolean);
    return off.indexOf(flag) === -1;
  }

  function applyUxFlags() {
    const off = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(UX_STORAGE_KEY) || "{}");
      Object.keys(stored).forEach(function (k) {
        if (stored[k] === false) {
          const norm = k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
          off.add(norm);
        }
      });
    } catch (_) {}
    const params = new URLSearchParams(window.location.search);
    if (params.has("uxoff")) {
      params.get("uxoff").split(",").forEach(function (s) {
        const t = s.trim();
        if (t) off.add(t);
      });
    }
    document.documentElement.setAttribute("data-ux-off", Array.from(off).join(" "));
    syncSearchPlacement();
  }

  function syncSearchPlacement() {
    const wrap = $(".topbar-search-wrap");
    const slot = $("#sidebar-search-slot");
    const input = $("#tool-search");
    const clearBtn = $("#search-clear");
    if (!wrap || !slot || !input) return;

    if (ux("topbar-search")) {
      slot.hidden = true;
      slot.innerHTML = "";
      if (input.parentElement !== wrap) {
        wrap.insertBefore(input, wrap.firstChild);
      }
      if (clearBtn && ux("search-clear") && clearBtn.parentElement !== wrap) {
        wrap.appendChild(clearBtn);
      }
    } else {
      slot.hidden = false;
      slot.innerHTML = "";
      slot.appendChild(input);
      if (clearBtn && ux("search-clear")) {
        slot.appendChild(clearBtn);
      }
    }
    updateClearVisibility();
  }

  function updateClearVisibility() {
    const input = $("#tool-search");
    const clearBtn = $("#search-clear");
    if (!input || !clearBtn) return;
    const show = ux("search-clear") && input.value.trim().length > 0;
    clearBtn.hidden = !show;
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

  function normalizeHash() {
    const h = window.location.hash;
    if (!h || h === "#" || h === "#/") {
      history.replaceState(null, "", "#/home/tools");
    }
  }

  function parseRoute() {
    const h = (window.location.hash || "#/home/tools").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "tool" && parts[1]) {
      return { view: "tool", slug: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === "home") {
      const tab = parts[1] === "readme" ? "readme" : "tools";
      return { view: "home", tab: tab };
    }
    return { view: "home", tab: "tools" };
  }

  function setRouteHomeTools() {
    window.location.hash = "#/home/tools";
  }

  function setRouteHomeReadme() {
    window.location.hash = "#/home/readme";
  }

  function setRouteTool(slug) {
    window.location.hash = "#/tool/" + encodeURIComponent(slug);
    closeDrawer();
  }

  function intentLabel(intent) {
    if (!intent) return "Other";
    return intent.charAt(0).toUpperCase() + intent.slice(1);
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
    return Array.from(map.entries()).sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });
  }

  function scrollHeadingIntoView(el) {
    if (!el) return;
    const mainEl = $("#main");
    if (ux("layout-scroll") && mainEl && mainEl.scrollHeight > mainEl.clientHeight + 1) {
      const delta =
        el.getBoundingClientRect().top - mainEl.getBoundingClientRect().top - (ux("toc-offset") ? 12 : 0);
      mainEl.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderNav() {
    const nav = $("#nav-tree");
    if (!nav || !data) return;
    nav.innerHTML = "";
    const tools = data.tools.filter(matchesFilter);
    const groups = groupByIntent(tools);
    const route = parseRoute();

    const homeLink = $(".nav-home-link");
    if (homeLink) {
      homeLink.classList.toggle("active", route.view === "home");
      homeLink.href = "#/home/tools";
      homeLink.onclick = function (e) {
        e.preventDefault();
        setRouteHomeTools();
        closeDrawer();
      };
    }

    if (!ux("nav-home")) {
      const nh = $("#nav-home");
      if (nh) nh.hidden = true;
    } else {
      const nh = $("#nav-home");
      if (nh) nh.hidden = false;
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const intent = groups[gi][0];
      const list = groups[gi][1];
      const det = document.createElement("details");
      det.open = true;
      const sum = document.createElement("summary");
      sum.textContent = intent;
      det.appendChild(sum);
      const ul = document.createElement("ul");
      const sorted = list.slice().sort(function (a, b) {
        return a.slug.localeCompare(b.slug);
      });
      for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
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

  function renderRightRailTool(tool) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";

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
      for (let i = 0; i < toc.length; i++) {
        const item = toc[i];
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + encodeURIComponent(item.id);
        a.textContent = item.text;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          const el = document.getElementById(item.id);
          scrollHeadingIntoView(el);
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
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tag";
        b.textContent = tag;
        b.addEventListener("click", function () {
          filterText = tag;
          const search = $("#tool-search");
          if (search) search.value = tag;
          updateClearVisibility();
          render();
        });
        wrap.appendChild(b);
      }
      rail.appendChild(wrap);
    }
  }

  function renderRightRailHomeReadme(homeToc) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";

    const hToc = document.createElement("h2");
    hToc.textContent = "On this page";
    rail.appendChild(hToc);

    const toc = homeToc || [];
    if (toc.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No headings.";
      rail.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      for (let i = 0; i < toc.length; i++) {
        const item = toc[i];
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + encodeURIComponent(item.id);
        a.textContent = item.text;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          const el = document.getElementById(item.id);
          scrollHeadingIntoView(el);
        });
        li.style.paddingLeft = (item.level - 1) * 0.5 + "rem";
        li.appendChild(a);
        ul.appendChild(li);
      }
      rail.appendChild(ul);
    }
  }

  function renderRightRailHomeTools(groups) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";

    const h = document.createElement("h2");
    h.textContent = "Categories";
    rail.appendChild(h);

    if (!groups || groups.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No tools match.";
      rail.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    for (let i = 0; i < groups.length; i++) {
      const intent = groups[i][0];
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#intent-" + encodeURIComponent(intent);
      a.textContent = intentLabel(intent);
      a.addEventListener("click", function (e) {
        e.preventDefault();
        const el = document.getElementById("intent-" + intent);
        scrollHeadingIntoView(el);
      });
      li.appendChild(a);
      ul.appendChild(li);
    }
    rail.appendChild(ul);

    const hint = document.createElement("p");
    hint.className = "muted";
    hint.style.marginTop = "1rem";
    hint.style.fontSize = "0.82rem";
    hint.textContent = "Browse tools by category in the main column.";
    rail.appendChild(hint);
  }

  function renderRightRailPlaceholder(msg) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = '<p class="muted" style="margin:0">' + escapeHtml(msg) + "</p>";
  }

  function appendToolsSections(container, tools) {
    const lead = document.createElement("p");
    lead.className = "home-lead";
    lead.textContent =
      "Personal toolbox — browse by intent or search. Data is generated from manifests and READMEs in the repo.";
    container.appendChild(lead);

    if (ux("categorized-home")) {
      const grouped = groupByIntent(tools);
      for (let gi = 0; gi < grouped.length; gi++) {
        const intent = grouped[gi][0];
        const list = grouped[gi][1];
        const sec = document.createElement("section");
        sec.className = "tool-category-section";
        sec.id = "intent-" + intent;

        const h2 = document.createElement("h2");
        h2.className = "tool-category-title";
        h2.textContent = intentLabel(intent);
        sec.appendChild(h2);

        const grid = document.createElement("div");
        grid.className = "tool-grid";
        const sorted = list.slice().sort(function (a, b) {
          return a.slug.localeCompare(b.slug);
        });
        for (let i = 0; i < sorted.length; i++) {
          const t = sorted[i];
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
        sec.appendChild(grid);
        container.appendChild(sec);
      }
    } else {
      const grid = document.createElement("div");
      grid.className = "tool-grid";
      for (let i = 0; i < tools.length; i++) {
        const t = tools[i];
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
      container.appendChild(grid);
    }

    if (tools.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No tools match your search.";
      container.appendChild(empty);
    }
  }

  function renderHomeMain(route) {
    const main = $("#main");
    if (!main || !data) return;

    main.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "main-inner";

    const home = data.home || { readmeHtml: "", toc: [] };
    const tabsOn = ux("home-tabs");
    const tabReadme = tabsOn && route.tab === "readme";
    const tabTools = !tabsOn || route.tab !== "readme";

    if (tabsOn) {
      const tabs = document.createElement("div");
      tabs.className = "home-tabs";
      tabs.setAttribute("role", "tablist");
      const btnTools = document.createElement("button");
      btnTools.type = "button";
      btnTools.className = "home-tab";
      btnTools.setAttribute("role", "tab");
      btnTools.setAttribute("aria-selected", !tabReadme ? "true" : "false");
      btnTools.textContent = "Tools";
      btnTools.addEventListener("click", function () {
        setRouteHomeTools();
      });
      const btnReadme = document.createElement("button");
      btnReadme.type = "button";
      btnReadme.className = "home-tab";
      btnReadme.setAttribute("role", "tab");
      btnReadme.setAttribute("aria-selected", tabReadme ? "true" : "false");
      btnReadme.textContent = "Readme";
      btnReadme.addEventListener("click", function () {
        setRouteHomeReadme();
      });
      tabs.appendChild(btnTools);
      tabs.appendChild(btnReadme);
      inner.appendChild(tabs);
    }

    const tools = data.tools.filter(matchesFilter);

    if (tabTools) {
      appendToolsSections(inner, tools);
    }

    if (!tabsOn || tabReadme) {
      if (!tabsOn && tabTools) {
        inner.appendChild(document.createElement("hr"));
      }
      const prose = document.createElement("article");
      prose.className = "prose";
      prose.innerHTML = home.readmeHtml || '<p class="muted">No repo readme in build.</p>';
      inner.appendChild(prose);
    }

    main.appendChild(inner);
    document.title = "toolbox";
  }

  function renderMain() {
    const main = $("#main");
    if (!main || !data) return;
    normalizeHash();
    const route = parseRoute();

    if (route.view === "home") {
      const filtered = data.tools.filter(matchesFilter);
      const groups = groupByIntent(filtered);

      if (!ux("home-tabs")) {
        renderRightRailHomeTools(groups);
        renderHomeMain({ view: "home", tab: "tools" });
        main.scrollTop = 0;
        return;
      }

      if (route.tab === "readme") {
        renderRightRailHomeReadme((data.home && data.home.toc) || []);
      } else {
        renderRightRailHomeTools(groups);
      }
      renderHomeMain(route);
      main.scrollTop = 0;
      return;
    }

    const tool = data.tools.find(function (t) {
      return t.slug === route.slug;
    });
    if (!tool) {
      renderRightRailPlaceholder("Select a tool or search.");
      main.innerHTML = "";
      const inner = document.createElement("div");
      inner.className = "main-inner";
      inner.innerHTML =
        "<p>Tool not found.</p><p><a href=\"#/home/tools\">← Home</a></p>";
      inner.querySelector("a").addEventListener("click", function (e) {
        e.preventDefault();
        setRouteHomeTools();
      });
      main.appendChild(inner);
      document.title = "Not found · toolbox";
      return;
    }

    renderRightRailTool(tool);
    main.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "main-inner";

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
    inner.appendChild(header);

    const prose = document.createElement("article");
    prose.className = "prose";
    prose.innerHTML = tool.readmeHtml || "";
    inner.appendChild(prose);

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
    for (let i = 0; i < (tool.sourceFiles || []).length; i++) {
      const f = tool.sourceFiles[i];
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = f.url;
      a.rel = "noopener";
      a.textContent = f.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
    src.appendChild(ul);
    inner.appendChild(src);

    main.appendChild(inner);
    document.title = (tool.name || tool.slug) + " · toolbox";
    main.scrollTop = 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    applyUxFlags();
    renderNav();
    renderMain();
  }

  let drawerOpen = false;

  function closeDrawer() {
    drawerOpen = false;
    document.body.classList.remove("drawer-open");
    const btn = $("#menu-toggle");
    const bd = $("#nav-backdrop");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (bd) bd.hidden = true;
    if (ux("mobile-drawer") && ux("body-scroll-lock")) {
      document.body.style.overflow = "";
    }
  }

  function openDrawer() {
    drawerOpen = true;
    document.body.classList.add("drawer-open");
    const btn = $("#menu-toggle");
    const bd = $("#nav-backdrop");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (bd) bd.hidden = false;
    if (ux("mobile-drawer") && ux("body-scroll-lock")) {
      document.body.style.overflow = "hidden";
    }
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }

  async function load() {
    normalizeHash();
    applyUxFlags();
    const res = await fetch("./tools.json", { cache: "no-store" });
    if (!res.ok) {
      $("#main").innerHTML =
        '<div class="main-inner"><p class="muted">Could not load tools.json. Run <code>node scripts/build-site.mjs</code> then refresh.</p></div>';
      $("#nav-tree").innerHTML = "";
      const rr = $("#right-rail-scroll");
      if (rr) {
        rr.innerHTML = "";
      }
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
      updateClearVisibility();
      render();
    });
  }

  const clearBtn = $("#search-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      filterText = "";
      if (search) search.value = "";
      updateClearVisibility();
      render();
    });
  }

  const menuToggle = $("#menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", toggleDrawer);
  }

  const backdrop = $("#nav-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeDrawer);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  window.addEventListener("hashchange", function () {
    normalizeHash();
    render();
    closeDrawer();
  });

  applyUxFlags();
  initTheme();
  load();
})();
