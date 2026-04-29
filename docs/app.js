(function () {
  "use strict";

  const THEME_KEY = "toolbox-theme";
  const MOBILE_QUERY = "(max-width: 960px)";

  const state = {
    data: null,
    filter: "",
    drawerOpen: false,
  };

  const els = {
    article: document.querySelector("#main-article"),
    main: document.querySelector("#main"),
    navTree: document.querySelector("#nav-tree"),
    search: document.querySelector("#tool-search"),
    clearSearch: document.querySelector("#search-clear"),
    menuToggle: document.querySelector("#menu-toggle"),
    backdrop: document.querySelector("#nav-backdrop"),
    themeSelect: document.querySelector("#theme-select"),
    rightRail: document.querySelector("#right-rail-scroll"),
    homeLink: document.querySelector(".nav-home-link"),
    tagsLink: document.querySelector(".nav-tags-link"),
  };

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  const normalizeText = (value) => String(value || "").toLowerCase();
  const bySlug = (a, b) => String(a.slug || "").localeCompare(String(b.slug || ""));
  const intentLabel = (intent) => {
    const value = intent || "other";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    const props = attrs || {};

    Object.keys(props).forEach((key) => {
      const value = props[key];
      if (value === false || value === null || value === undefined) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, value);
      }
    });

    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => {
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });

    return node;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeHash() {
    const hash = window.location.hash;
    if (!hash || hash === "#" || hash === "#/") {
      history.replaceState(null, "", "#/home/tools");
      return;
    }
    if (hash === "#/home/tags") {
      history.replaceState(null, "", "#/tags");
    }
  }

  function route() {
    const parts = (window.location.hash || "#/home/tools").replace(/^#/, "").split("/").filter(Boolean);
    if (parts[0] === "tool" && parts[1]) return { view: "tool", slug: decodeURIComponent(parts[1]) };
    if (parts[0] === "tags") return { view: "tags" };
    if (parts[0] === "home" && parts[1] === "readme") return { view: "home", tab: "readme" };
    return { view: "home", tab: "tools" };
  }

  function go(hash) {
    if (window.location.hash === hash) {
      render();
    } else {
      window.location.hash = hash;
    }
  }

  function openDrawer() {
    state.drawerOpen = true;
    document.body.classList.add("drawer-open");
    if (els.menuToggle) els.menuToggle.setAttribute("aria-expanded", "true");
    if (els.backdrop) els.backdrop.hidden = false;
  }

  function closeDrawer() {
    state.drawerOpen = false;
    document.body.classList.remove("drawer-open");
    if (els.menuToggle) els.menuToggle.setAttribute("aria-expanded", "false");
    if (els.backdrop) els.backdrop.hidden = true;
  }

  function setTheme(value) {
    if (value === "light" || value === "dark") {
      document.documentElement.dataset.theme = value;
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function initTheme() {
    const selected = localStorage.getItem(THEME_KEY) || "auto";
    setTheme(selected);
    if (!els.themeSelect) return;
    els.themeSelect.value = selected;
    els.themeSelect.addEventListener("change", () => {
      localStorage.setItem(THEME_KEY, els.themeSelect.value);
      setTheme(els.themeSelect.value);
    });
  }

  function matchesTool(tool) {
    const q = normalizeText(state.filter.trim());
    if (!q) return true;
    return normalizeText([
      tool.name,
      tool.slug,
      tool.description,
      tool.intent,
      (tool.tags || []).join(" "),
    ].join(" ")).includes(q);
  }

  function filteredTools() {
    return (state.data ? state.data.tools : []).filter(matchesTool);
  }

  function groupByIntent(tools) {
    const groups = new Map();
    tools.forEach((tool) => {
      const key = tool.intent || "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tool);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([intent, list]) => [intent, list.slice().sort(bySlug)]);
  }

  function tagIndex(tools) {
    const counts = new Map();
    tools.forEach((tool) => {
      (tool.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count], index) => ({ tag, count, id: "tag-" + index }));
  }

  function scrollMainToTop() {
    if (els.main) els.main.scrollTo({ top: 0 });
  }

  function scrollToId(id) {
    const target = document.getElementById(id);
    if (!target) return;
    if (!els.main) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const top = target.getBoundingClientRect().top - els.main.getBoundingClientRect().top + els.main.scrollTop - 16;
    els.main.scrollTo({ top, behavior: "smooth" });
  }

  function setFilter(value, options) {
    const opts = options || {};
    state.filter = value || "";
    if (els.search) els.search.value = state.filter;
    updateSearchClear();
    if (!opts.keepRoute) go("#/home/tools");
    else render();
    if (opts.openDrawer && isMobile()) setTimeout(openDrawer, 0);
  }

  function updateSearchClear() {
    if (els.clearSearch) els.clearSearch.hidden = !state.filter.trim();
  }

  function renderSidebar(currentRoute) {
    if (!els.navTree || !state.data) return;
    const groups = groupByIntent(filteredTools());

    if (els.homeLink) {
      els.homeLink.classList.toggle("active", currentRoute.view === "home");
      els.homeLink.onclick = (event) => {
        event.preventDefault();
        go("#/home/tools");
        closeDrawer();
      };
    }
    if (els.tagsLink) {
      els.tagsLink.classList.toggle("active", currentRoute.view === "tags");
      els.tagsLink.onclick = (event) => {
        event.preventDefault();
        go("#/tags");
        closeDrawer();
      };
    }

    els.navTree.replaceChildren();
    groups.forEach(([intent, tools]) => {
      const list = el("ul");
      tools.forEach((tool) => {
        const link = el("a", {
          href: "#/tool/" + encodeURIComponent(tool.slug),
          className: currentRoute.view === "tool" && currentRoute.slug === tool.slug ? "active" : "",
          text: tool.name || tool.slug,
          onclick: (event) => {
            event.preventDefault();
            go("#/tool/" + encodeURIComponent(tool.slug));
            closeDrawer();
          },
        });
        list.appendChild(el("li", null, link));
      });
      els.navTree.appendChild(el("details", { open: true }, [
        el("summary", { text: intentLabel(intent) }),
        list,
      ]));
    });

    if (groups.length === 0) {
      els.navTree.appendChild(el("p", { className: "muted sidebar-empty", text: "No tools match your search." }));
    }
  }

  function renderRail(title, items, emptyText) {
    if (!els.rightRail) return;
    els.rightRail.replaceChildren(el("h2", { text: title }));
    if (!items.length) {
      els.rightRail.appendChild(el("p", { className: "muted rail-empty", text: emptyText || "Nothing to show." }));
      return;
    }

    const list = el("ul");
    items.forEach((item) => {
      const link = el("a", {
        href: "#" + encodeURIComponent(item.id),
        text: item.text,
        onclick: (event) => {
          event.preventDefault();
          scrollToId(item.id);
        },
      });
      list.appendChild(el("li", { style: "padding-left:" + ((item.level || 1) - 1) * 0.55 + "rem" }, link));
    });
    els.rightRail.appendChild(list);
  }

  function renderCategoriesRail(groups) {
    renderRail("Categories", groups.map(([intent]) => ({
      id: "intent-" + intent,
      text: intentLabel(intent),
      level: 1,
    })), "No matching categories.");
  }

  function renderTagRail(index) {
    renderRail("Tags", index.map((tag) => ({
      id: tag.id,
      text: tag.tag + " (" + tag.count + ")",
      level: 1,
    })), "No tags in the current tool list.");
  }

  function metaRow(tool, compact) {
    return el("div", { className: "meta-row" + (compact ? " meta-row--card" : "") }, [
      el("span", { html: "<strong>Intent</strong> " + escapeHtml(tool.intent || "other") }),
      el("span", { html: "<strong>Runtime</strong> " + escapeHtml(tool.runtime || "unknown") }),
      el("span", { html: "<strong>Status</strong> " + escapeHtml(tool.status || "unknown") }),
    ]);
  }

  function tagPills(tags) {
    const wrap = el("div", { className: "tag-list" });
    if (!tags || !tags.length) {
      wrap.appendChild(el("span", { className: "muted", text: "No tags." }));
      return wrap;
    }
    tags.forEach((tag) => {
      wrap.appendChild(el("button", {
        type: "button",
        className: "tag",
        text: tag,
        onclick: () => setFilter(tag, { openDrawer: true }),
      }));
    });
    return wrap;
  }

  function toolCard(tool) {
    const tags = el("div", { className: "tool-card-tags" });
    (tool.tags || []).forEach((tag) => tags.appendChild(el("span", { className: "tool-chip", text: tag })));

    return el("a", {
      className: "tool-card",
      href: "#/tool/" + encodeURIComponent(tool.slug),
      onclick: (event) => {
        event.preventDefault();
        go("#/tool/" + encodeURIComponent(tool.slug));
      },
    }, [
      el("div", { className: "tool-card-main" }, [
        el("h2", { text: tool.name || tool.slug }),
        metaRow(tool, true),
        el("p", { className: "tool-card-desc", text: tool.description || "" }),
      ]),
      tags.childNodes.length ? el("div", { className: "tool-card-footer" }, tags) : null,
    ]);
  }

  function homeTabs(activeTab) {
    return el("div", { className: "home-tabs", role: "tablist", "aria-label": "Home sections" }, [
      el("button", {
        type: "button",
        className: "home-tab",
        role: "tab",
        "aria-selected": activeTab === "tools" ? "true" : "false",
        text: "Tools",
        onclick: () => go("#/home/tools"),
      }),
      el("button", {
        type: "button",
        className: "home-tab",
        role: "tab",
        "aria-selected": activeTab === "readme" ? "true" : "false",
        text: "Readme",
        onclick: () => go("#/home/readme"),
      }),
    ]);
  }

  function renderToolsHome(inner, tools) {
    inner.appendChild(el("p", {
      className: "home-lead",
      text: "Browse the toolbox by intent, search by name or tag, and open each tool for usage notes and source links.",
    }));

    const groups = groupByIntent(tools);
    groups.forEach(([intent, list]) => {
      inner.appendChild(el("section", { className: "tool-category-section", id: "intent-" + intent }, [
        el("h2", { className: "tool-category-title", text: intentLabel(intent) }),
        el("div", { className: "tool-grid" }, list.map(toolCard)),
      ]));
    });

    if (!groups.length) {
      inner.appendChild(el("p", { className: "muted", text: "No tools match your search." }));
    }
    renderCategoriesRail(groups);
  }

  function renderReadmeHome(inner) {
    const home = state.data.home || {};
    inner.appendChild(el("article", {
      className: "prose",
      html: home.readmeHtml || '<p class="muted">No repo README was included in the build.</p>',
    }));
    renderRail("On This Page", home.toc || [], "No headings.");
  }

  function renderHome(currentRoute) {
    const inner = pageShell();
    inner.appendChild(homeTabs(currentRoute.tab));
    if (currentRoute.tab === "readme") renderReadmeHome(inner);
    else renderToolsHome(inner, filteredTools());
    document.title = "toolbox";
  }

  function renderTags() {
    const index = tagIndex(filteredTools());
    const inner = pageShell();
    inner.appendChild(el("h1", { className: "page-title", text: "Tags" }));
    inner.appendChild(el("p", {
      className: "home-lead",
      text: "Filter the sidebar and tool list by tag. Counts reflect the current search.",
    }));

    if (!index.length) {
      inner.appendChild(el("p", { className: "muted", text: "No tags in the current tool list." }));
    } else {
      inner.appendChild(el("ul", { className: "tag-index" }, index.map((row) => (
        el("li", { className: "tag-index-row", id: row.id }, [
          el("span", { className: "tag-index-name", text: row.tag }),
          el("span", { className: "tag-index-count", text: String(row.count), "aria-label": row.count + " tools" }),
          el("button", {
            type: "button",
            className: "secondary-button",
            text: "Filter",
            onclick: () => setFilter(row.tag, { openDrawer: true }),
          }),
        ])
      ))));
    }

    renderTagRail(index);
    document.title = "Tags · toolbox";
  }

  function sourceLinks(tool) {
    const links = (tool.sourceFiles || []).map((file) => (
      el("li", null, el("a", { href: file.url, rel: "noopener", text: file.name }))
    ));
    return el("section", { className: "source-links" }, [
      el("h2", { text: "Source" }),
      el("p", null, el("a", { href: tool.sourceDirUrl, rel: "noopener", text: "View folder on GitHub" })),
      links.length ? el("ul", null, links) : null,
    ]);
  }

  function renderTool(currentRoute) {
    const tool = state.data.tools.find((candidate) => candidate.slug === currentRoute.slug);
    if (!tool) {
      const inner = pageShell();
      inner.appendChild(el("p", { text: "Tool not found." }));
      inner.appendChild(el("p", null, el("a", { href: "#/home/tools", text: "Back to Home" })));
      renderRail("On This Page", [], "Select a tool from the sidebar.");
      document.title = "Not found · toolbox";
      return;
    }

    const inner = pageShell();
    inner.appendChild(el("header", { className: "article-header" }, [
      el("h1", { text: tool.name || tool.slug }),
      metaRow(tool),
      el("div", { className: "article-tags" }, tagPills(tool.tags || [])),
    ]));
    inner.appendChild(el("article", { className: "prose", html: tool.readmeHtml || "" }));
    inner.appendChild(sourceLinks(tool));
    renderRail("On This Page", tool.toc || [], "No headings in README.");
    document.title = (tool.name || tool.slug) + " · toolbox";
  }

  function pageShell() {
    if (!els.article) return el("div");
    const inner = el("div", { className: "main-inner" });
    els.article.replaceChildren(inner);
    scrollMainToTop();
    return inner;
  }

  function render() {
    if (!state.data) return;
    normalizeHash();
    const currentRoute = route();
    renderSidebar(currentRoute);

    if (currentRoute.view === "tags") renderTags();
    else if (currentRoute.view === "tool") renderTool(currentRoute);
    else renderHome(currentRoute);
  }

  function initSearch() {
    if (!els.search) return;
    els.search.addEventListener("input", () => {
      state.filter = els.search.value;
      updateSearchClear();
      render();
    });
    if (els.clearSearch) {
      els.clearSearch.addEventListener("click", () => {
        setFilter("", { keepRoute: true });
        els.search.focus();
      });
    }
    updateSearchClear();
  }

  function initDrawer() {
    if (els.menuToggle) {
      els.menuToggle.addEventListener("click", () => {
        state.drawerOpen ? closeDrawer() : openDrawer();
      });
    }
    if (els.backdrop) els.backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });
  }

  async function loadData() {
    normalizeHash();
    try {
      const response = await fetch("./tools.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      state.data = await response.json();
      render();
    } catch (error) {
      if (els.article) {
        els.article.innerHTML = '<div class="main-inner"><p class="muted">Could not load tools.json. Run <code>node scripts/build-site.mjs</code>, then refresh.</p></div>';
      }
      if (els.rightRail) els.rightRail.replaceChildren();
      if (els.navTree) els.navTree.replaceChildren();
    }
  }

  window.addEventListener("hashchange", () => {
    render();
    closeDrawer();
  });

  initTheme();
  initSearch();
  initDrawer();
  loadData();
})();
