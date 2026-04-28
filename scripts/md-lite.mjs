/**
 * Minimal markdown → HTML for short READMEs. No dependencies.
 * Supports: #–###, paragraphs, - lists, `inline code`, **bold**, [text](url), fenced ``` blocks.
 */

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function inlineMd(s) {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return out;
}

/**
 * @param {string} md
 * @returns {{ html: string, toc: Array<{ id: string, text: string, level: number }> }}
 */
export function mdToHtmlAndToc(md) {
  const toc = [];
  const usedIds = new Map();

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inUl = false;

  const closeUl = () => {
    if (inUl) {
      out.push("</ul>\n");
      inUl = false;
    }
  };

  const flushPara = (buf) => {
    const t = buf.join("\n").trim();
    if (!t) return;
    closeUl();
    out.push(`<p>${inlineMd(t).replace(/\n/g, "<br />")}</p>\n`);
  };

  let paraBuf = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      flushPara(paraBuf);
      paraBuf = [];
      closeUl();
      const fence = line.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const code = escapeHtml(codeLines.join("\n"));
      const lang = fence ? ` class="language-${escapeHtml(fence)}"` : "";
      out.push(`<pre><code${lang}>${code}</code></pre>\n`);
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara(paraBuf);
      paraBuf = [];
      closeUl();
      const level = h[1].length;
      const text = h[2].trim();
      let id = slugId(text);
      const n = (usedIds.get(id) || 0) + 1;
      usedIds.set(id, n);
      if (n > 1) id = `${id}-${n}`;
      toc.push({ id, text, level });
      const tag = `h${level + 1}`;
      out.push(`<${tag} id="${escapeHtml(id)}">${inlineMd(text)}</${tag}>\n`);
      i += 1;
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      flushPara(paraBuf);
      paraBuf = [];
      if (!inUl) {
        out.push("<ul>\n");
        inUl = true;
      }
      const item = line.replace(/^\s*-\s+/, "");
      out.push(`<li>${inlineMd(item)}</li>\n`);
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      flushPara(paraBuf);
      paraBuf = [];
      closeUl();
      i += 1;
      continue;
    }

    paraBuf.push(line);
    i += 1;
  }

  flushPara(paraBuf);
  closeUl();

  return { html: out.join(""), toc };
}
