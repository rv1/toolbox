const state = {
  tools: [],
  query: "",
};

const nav = document.querySelector("#nav");
const toc = document.querySelector("#toc");
const content = document.querySelector("#content");
const search = document.querySelector("#search");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tagsHtml(tags) {
  return (tags || [])
    .map((tag) => `<button class="pill tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
    .join("");
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  let code = [];

  function closeList() {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  }

  function flushCode() {
    html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
    code = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      html += `<h${level} id="${slugify(text)}">${escapeHtml(text)}</h${level}>`;
      continue;
    }

    const bullet = /^-\s+(.+)$/.exec(line);
    if (bullet) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMarkdown(bullet[1])}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inlineMarkdown(line)}</p>`;
  }

  closeList();
  if (inCode) flushCode();
  return html;
}

function inlineMarkdown(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function filteredTools() {
  const query = state.query.trim().toLowerCase();

  if (!query) return state.tools;

  return state.tools.filter((tool) => {
    const haystack = [
      tool.name,
      tool.slug,
      tool.intent,
      tool.description,
      tool.runtime,
      tool.status,
      ...(tool.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderNav(activeSlug = "") {
  const groups = new Map();

  filteredTools().forEach((tool) => {
    if (!groups.has(tool.intent)) groups.set(tool.intent, []);
    groups.get(tool.intent).push(tool);
  });

  nav.innerHTML = [...groups.entries()]
    .map(([intent, tools]) => {
      const links = tools
        .map((tool) => {
          const active = tool.slug === activeSlug ? " active" : "";
          return `<a class="tool-link${active}" href="#/tool/${tool.slug}">${escapeHtml(tool.name)}</a>`;
        })
        .join("");
      return `<details class="intent" open><summary>${escapeHtml(intent)}</summary>${links}</details>`;
    })
    .join("");
}

function renderToc(tool) {
  toc.innerHTML = (tool.headings || [])
    .map((heading) => {
      return `<a class="level-${heading.level}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`;
    })
    .join("");
}

function renderHome() {
  renderNav();
  toc.innerHTML = "";

  const tools = filteredTools();
  content.innerHTML = `
    <section class="hero">
      <h1>toolbox</h1>
      <p>Small personal scripts, utilities, and documented workflows.</p>
    </section>
    <div class="meta">
      <span class="pill">${tools.length} tools</span>
      ${[...new Set(state.tools.map((tool) => tool.intent))].map((intent) => `<span class="pill">${escapeHtml(intent)}</span>`).join("")}
    </div>
    <section class="tool-grid">
      ${
        tools.length
          ? tools
              .map(
                (tool) => `
                  <a class="tool-card" href="#/tool/${tool.slug}">
                    <h2>${escapeHtml(tool.name)}</h2>
                    <p>${escapeHtml(tool.description)}</p>
                    <div class="meta">
                      <span class="pill">${escapeHtml(tool.intent)}</span>
                      <span class="pill">${escapeHtml(tool.runtime)}</span>
                    </div>
                  </a>
                `,
              )
              .join("")
          : '<p class="empty">No tools match the current filter.</p>'
      }
    </section>
  `;
}

function renderTool(slug) {
  const tool = state.tools.find((item) => item.slug === slug);

  if (!tool) {
    renderHome();
    return;
  }

  renderNav(tool.slug);
  renderToc(tool);

  const sourceLinks = (tool.sourceFiles || [])
    .map((file) => {
      const href = file.url || file.path;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(file.name)}</a></li>`;
    })
    .join("");

  content.innerHTML = `
    <section class="hero">
      <h1>${escapeHtml(tool.name)}</h1>
      <p>${escapeHtml(tool.description)}</p>
    </section>
    <div class="meta">
      <span class="pill">${escapeHtml(tool.intent)}</span>
      <span class="pill">${escapeHtml(tool.runtime)}</span>
      <span class="pill">${escapeHtml(tool.status)}</span>
      ${tagsHtml(tool.tags)}
    </div>
    <article class="markdown">${markdownToHtml(tool.readme)}</article>
    <section class="source-list">
      <h2>Source</h2>
      <p><a href="${escapeHtml(tool.sourceUrl || tool.path)}">${escapeHtml(tool.path)}</a></p>
      <ul>${sourceLinks}</ul>
    </section>
  `;
}

function render() {
  const match = /^#\/tool\/([^/]+)$/.exec(window.location.hash);

  if (match) {
    renderTool(decodeURIComponent(match[1]));
  } else {
    renderHome();
  }
}

search.addEventListener("input", () => {
  state.query = search.value;
  render();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;

  state.query = button.dataset.tag;
  search.value = state.query;
  window.location.hash = "#/";
  render();
});

window.addEventListener("hashchange", render);

fetch("tools.json")
  .then((response) => response.json())
  .then((data) => {
    state.tools = data.tools || [];
    render();
  })
  .catch(() => {
    content.innerHTML = '<p class="empty">Run <code>node scripts/build-site.mjs</code> to generate site data.</p>';
  });
