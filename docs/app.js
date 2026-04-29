(function () {
  "use strict";

  const THEME_KEY = "toolbox-theme";

  /** @type {{ repoBaseUrl: string, tools: any[], home?: { readmeHtml: string, toc: any[] } } | null} */
  let data = null;
  let filterText = "";

  function $(sel) {
    return document.querySelector(sel);
  }

  function updateClearVisibility() {
    const input = $("#tool-search");
    const clearBtn = $("#search-clear");
    if (!input || !clearBtn) return;
    clearBtn.hidden = input.value.trim().length === 0;
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
      return;
    }
    if (h === "#/home/tags") {
      history.replaceState(null, "", "#/tags");
    }
  }

  function parseRoute() {
    const h = (window.location.hash || "#/home/tools").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "tool" && parts[1]) {
      return { view: "tool", slug: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === "tags") {
      return { view: "tags" };
    }
    if (parts[0] === "home") {
      if (parts[1] === "readme") {
        return { view: "home", tab: "readme" };
      }
      if (parts[1] === "tags") {
        return { view: "tags" };
      }
      return { view: "home", tab: "tools" };
    }
    return { view: "home", tab: "tools" };
  }

  function setRouteHomeTools() {
    window.location.hash = "#/home/tools";
  }

  function setRouteHomeReadme() {
    window.location.hash = "#/home/readme";
  }

  function setRouteTags() {
    window.location.hash = "#/tags";
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

  /**
   * @param {any[]} tools
   * @returns {{ tag: string, count: number, anchorId: string }[]}
   */
  function buildHomeTagIndex(tools) {
    const m = new Map();
    for (let ti = 0; ti < tools.length; ti++) {
      const tags = tools[ti].tags || [];
      for (let j = 0; j < tags.length; j++) {
        const tag = tags[j];
        m.set(tag, (m.get(tag) || 0) + 1);
      }
    }
    const entries = Array.from(m.entries());
    entries.sort(function (a, b) {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    });
    return entries.map(function (e, i) {
      return { tag: e[0], count: e[1], anchorId: "home-tag-" + i };
    });
  }

  function scrollHeadingIntoView(el) {
    if (!el) return;
    const mainEl = $("#main");
    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight + 1) {
      const delta =
        el.getBoundingClientRect().top - mainEl.getBoundingClientRect().top - 12;
      mainEl.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Apply tag as sidebar search filter.
   * By default, navigate to Tools home; can keep current route.
   * On mobile: open nav drawer after navigation without focusing search (no keyboard).
   */
  function applyTagFilter(tag, opts) {
    const keepRoute = opts && opts.keepRoute;
    filterText = tag;
    const search = $("#tool-search");
    if (search) {
      search.value = tag;
    }
    updateClearVisibility();
    if (keepRoute || window.location.hash === "#/home/tools") {
      render();
    } else {
      window.location.hash = "#/home/tools";
    }
    if (window.matchMedia("(max-width: 960px)").matches) {
      setTimeout(function () {
        openDrawer();
      }, 0);
    }
  }

  /**
   * @param {HTMLElement} rail
   * @param {Array<{ id: string, text: string, level: number }>} toc
   * @param {string} heading
   * @param {string} [emptyMsg]
   */
  function renderTocSection(rail, toc, heading, emptyMsg) {
    const h2 = document.createElement("h2");
    h2.textContent = heading;
    rail.appendChild(h2);

    const items = toc || [];
    if (items.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = emptyMsg || "No headings.";
      rail.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + encodeURIComponent(item.id);
      a.textContent = item.text;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        scrollHeadingIntoView(document.getElementById(item.id));
      });
      li.style.paddingLeft = (item.level - 1) * 0.5 + "rem";
      li.appendChild(a);
      ul.appendChild(li);
    }
    rail.appendChild(ul);
  }

  /**
   * @param {HTMLElement} container
   * @param {string[]} tags
   * @param {{ interactive?: boolean }} opts
   */
  function renderTagPills(container, tags, opts) {
    const interactive = opts && opts.interactive !== false;
    const wrap = document.createElement("div");
    wrap.className = "tag-list";

    if (!tags || tags.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.style.fontSize = "0.88rem";
      p.textContent = "No tags.";
      container.appendChild(p);
      return;
    }

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      if (interactive) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tag";
        b.textContent = tag;
        b.addEventListener("click", function () {
          applyTagFilter(tag);
        });
        wrap.appendChild(b);
      } else {
        const s = document.createElement("span");
        s.className = "tag";
        s.textContent = tag;
        wrap.appendChild(s);
      }
    }
    container.appendChild(wrap);
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

    const tagsLink = $(".nav-tags-link");
    if (tagsLink) {
      tagsLink.classList.toggle("active", route.view === "tags");
      tagsLink.href = "#/tags";
      tagsLink.onclick = function (e) {
        e.preventDefault();
        setRouteTags();
        closeDrawer();
      };
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

  /** Tool detail: right rail = TOC only */
  function renderRightRailToolToc(tool) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";
    renderTocSection(rail, tool.toc || [], "On this page", "No headings in README.");
  }

  function renderRightRailHomeReadme(homeToc) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";
    renderTocSection(rail, homeToc || [], "On this page", "No headings.");
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
        scrollHeadingIntoView(document.getElementById("intent-" + intent));
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

  /**
   * @param {{ tag: string, count: number, anchorId: string }[]} tagIndex
   */
  function renderRightRailHomeTags(tagIndex) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = "";

    const h = document.createElement("h2");
    h.textContent = "On this page";
    rail.appendChild(h);

    if (!tagIndex || tagIndex.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.style.margin = "0";
      p.textContent = "No tags in the current tool list.";
      rail.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    for (let i = 0; i < tagIndex.length; i++) {
      const row = tagIndex[i];
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + row.anchorId;
      a.textContent = row.tag + " (" + row.count + ")";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        const el = document.getElementById(row.anchorId);
        scrollHeadingIntoView(el);
      });
      li.appendChild(a);
      ul.appendChild(li);
    }
    rail.appendChild(ul);
  }

  function renderRightRailPlaceholder(msg) {
    const rail = $("#right-rail-scroll");
    if (!rail) return;
    rail.innerHTML = '<p class="muted" style="margin:0">' + escapeHtml(msg) + "</p>";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {any} tool
   * @param {{ compact?: boolean }} [opts]
   * @returns {HTMLDivElement}
   */
  function createToolMetaRowElement(tool, opts) {
    const compact = opts && opts.compact;
    const metaRow = document.createElement("div");
    metaRow.className = "meta-row" + (compact ? " meta-row--card" : "");
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
    return metaRow;
  }

  /**
   * @param {any} t tool record from tools.json
   * @returns {HTMLAnchorElement}
   */
  function createHomeToolCard(t) {
    const a = document.createElement("a");
    a.className = "tool-card";
    a.href = "#/tool/" + encodeURIComponent(t.slug);
    a.addEventListener("click", function (e) {
      e.preventDefault();
      setRouteTool(t.slug);
    });

    const mainEl = document.createElement("div");
    mainEl.className = "tool-card-main";
    const h = document.createElement("h2");
    h.textContent = t.name || t.slug;
    mainEl.appendChild(h);
    mainEl.appendChild(createToolMetaRowElement(t, { compact: true }));

    const desc = document.createElement("p");
    desc.className = "tool-card-desc";
    desc.textContent = t.description || "";
    mainEl.appendChild(desc);

    a.appendChild(mainEl);

    const tagList = t.tags || [];
    if (tagList.length > 0) {
      const foot = document.createElement("div");
      foot.className = "tool-card-footer";
      const tagsEl = document.createElement("div");
      tagsEl.className = "tool-card-tags";
      for (let k = 0; k < tagList.length; k++) {
        const chip = document.createElement("span");
        chip.className = "tool-chip";
        chip.textContent = tagList[k];
        tagsEl.appendChild(chip);
      }
      foot.appendChild(tagsEl);
      a.appendChild(foot);
    }
    return a;
  }

  function appendToolsSections(container, tools) {
    const lead = document.createElement("p");
    lead.className = "home-lead";
    lead.textContent =
      "Personal toolbox — browse by intent or search. Data is generated from manifests and READMEs in the repo.";
    container.appendChild(lead);

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
        grid.appendChild(createHomeToolCard(sorted[i]));
      }
      sec.appendChild(grid);
      container.appendChild(sec);
    }

    if (tools.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No tools match your search.";
      container.appendChild(empty);
    }
  }

  /**
   * @param {{ tag: string, count: number, anchorId: string }[]} tagIndex
   */
  function appendHomeTagsView(container, tagIndex) {
    const lead = document.createElement("p");
    lead.className = "home-lead";
    lead.textContent =
      "All tags in the current tool list. The number is how many tools use each tag.";
    container.appendChild(lead);
    if (!tagIndex || tagIndex.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No tags in the current tool list.";
      container.appendChild(empty);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "home-tag-list";
    for (let i = 0; i < tagIndex.length; i++) {
      const row = tagIndex[i];
      const li = document.createElement("li");
      li.className = "home-tag-row";
      li.id = row.anchorId;

      const nameEl = document.createElement("span");
      nameEl.className = "home-tag-name";
      nameEl.textContent = row.tag;

      const right = document.createElement("div");
      right.className = "home-tag-row-right";
      const countEl = document.createElement("span");
      countEl.className = "home-tag-count";
      countEl.setAttribute("aria-label", "Tools: " + row.count);
      countEl.textContent = String(row.count);

      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "home-tag-filter-btn";
      filterBtn.textContent = "Filter";
      filterBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        applyTagFilter(row.tag);
      });
      right.appendChild(countEl);
      right.appendChild(filterBtn);
      li.appendChild(nameEl);
      li.appendChild(right);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }

  /**
   * @param {{ tag: string, count: number, anchorId: string }[]} tagIndex
   */
  function renderTagsMain(tagIndex) {
    const article = $("#main-article");
    if (!article || !data) {
      return;
    }
    article.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "main-inner";
    const h = document.createElement("h1");
    h.className = "tags-page-title";
    h.textContent = "Tags";
    inner.appendChild(h);
    appendHomeTagsView(inner, tagIndex);
    article.appendChild(inner);
    document.title = "Tags · toolbox";
  }

  /**
   * @param {{ view: 'home' }} route
   * @param {{ filtered: any[] }} homeContext
   */
  function renderHomeMain(route, homeContext) {
    const article = $("#main-article");
    if (!article || !data) {
      return;
    }

    article.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "main-inner";

    const home = data.home || { readmeHtml: "", toc: [] };
    const tab = route.tab;
    const filtered = homeContext.filtered;

    const tabs = document.createElement("div");
    tabs.className = "home-tabs";
    tabs.setAttribute("role", "tablist");

    const btnTools = document.createElement("button");
    btnTools.type = "button";
    btnTools.className = "home-tab";
    btnTools.setAttribute("role", "tab");
    btnTools.setAttribute("aria-selected", tab === "tools" ? "true" : "false");
    btnTools.textContent = "Tools";
    btnTools.addEventListener("click", setRouteHomeTools);

    const btnReadme = document.createElement("button");
    btnReadme.type = "button";
    btnReadme.className = "home-tab";
    btnReadme.setAttribute("role", "tab");
    btnReadme.setAttribute("aria-selected", tab === "readme" ? "true" : "false");
    btnReadme.textContent = "Readme";
    btnReadme.addEventListener("click", setRouteHomeReadme);

    tabs.appendChild(btnTools);
    tabs.appendChild(btnReadme);
    inner.appendChild(tabs);

    if (tab === "tools") {
      appendToolsSections(inner, filtered);
    } else if (tab === "readme") {
      const prose = document.createElement("article");
      prose.className = "prose";
      prose.innerHTML = home.readmeHtml || '<p class="muted">No repo readme in build.</p>';
      inner.appendChild(prose);
    }

    article.appendChild(inner);
    document.title = "toolbox";
  }

  /**
   * @param {HTMLElement} inner
   * @param {any} tool
   */
  function renderToolArticle(inner, tool) {
    const header = document.createElement("header");
    header.className = "article-header";
    const h1 = document.createElement("h1");
    h1.textContent = tool.name || tool.slug;
    header.appendChild(h1);

    header.appendChild(createToolMetaRowElement(tool, {}));

    const tagHost = document.createElement("div");
    tagHost.className = "article-tags";
    renderTagPills(tagHost, tool.tags || [], { interactive: true });
    header.appendChild(tagHost);

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
  }

  function renderMain() {
    const article = $("#main-article");
    if (!article || !data) return;
    normalizeHash();
    const route = parseRoute();

    if (route.view === "tags") {
      const filtered = data.tools.filter(matchesFilter);
      const tagIndex = buildHomeTagIndex(filtered);
      renderRightRailHomeTags(tagIndex);
      renderTagsMain(tagIndex);
      article.scrollTop = 0;
      return;
    }

    if (route.view === "home") {
      const filtered = data.tools.filter(matchesFilter);
      const groups = groupByIntent(filtered);

      if (route.tab === "readme") {
        renderRightRailHomeReadme((data.home && data.home.toc) || []);
      } else {
        renderRightRailHomeTools(groups);
      }
      renderHomeMain(route, { filtered: filtered });
      article.scrollTop = 0;
      return;
    }

    const tool = data.tools.find(function (t) {
      return t.slug === route.slug;
    });
    if (!tool) {
      renderRightRailPlaceholder("Select a tool or search.");
      article.innerHTML = "";
      const inner = document.createElement("div");
      inner.className = "main-inner";
      inner.innerHTML =
        "<p>Tool not found.</p><p><a href=\"#/home/tools\">← Home</a></p>";
      inner.querySelector("a").addEventListener("click", function (e) {
        e.preventDefault();
        setRouteHomeTools();
      });
      article.appendChild(inner);
      document.title = "Not found · toolbox";
      return;
    }

    renderRightRailToolToc(tool);
    article.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "main-inner";
    renderToolArticle(inner, tool);

    article.appendChild(inner);
    document.title = (tool.name || tool.slug) + " · toolbox";
    article.scrollTop = 0;
  }

  function render() {
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
    document.body.style.overflow = "";
  }

  function openDrawer() {
    drawerOpen = true;
    document.body.classList.add("drawer-open");
    const btn = $("#menu-toggle");
    const bd = $("#nav-backdrop");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (bd) bd.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }

  async function load() {
    normalizeHash();
    const res = await fetch("./tools.json", { cache: "no-store" });
    if (!res.ok) {
      const art = $("#main-article");
      if (art) {
        art.innerHTML =
          '<div class="main-inner"><p class="muted">Could not load tools.json. Run <code>node scripts/build-site.mjs</code> then refresh.</p></div>';
      }
      $("#nav-tree").innerHTML = "";
      const rr = $("#right-rail-scroll");
      if (rr) rr.innerHTML = "";
      return;
    }
    data = await res.json();
    render();
    updateClearVisibility();
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

  initTheme();
  load();
})();
