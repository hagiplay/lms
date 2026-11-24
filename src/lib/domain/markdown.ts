/**
 * Minimal, safe Markdown → HTML. All input is HTML-escaped first; only
 * http(s)/mailto links survive. Supports: #-###### headings, paragraphs,
 * -/* and 1. lists, **bold**, *italic*, `code`, ``` fences, > quotes, ---.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function inline(s: string): string {
  const codes: string[] = [];
  let out = esc(s).replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`);
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, url: string) => {
      const raw = url.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(raw)) return text;
      const ext = /^https?:/i.test(raw);
      return `<a href="${url}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      flushPara();
      flushList();
      const buf: string[] = [];
      while (++i < lines.length && !/^```/.test(lines[i]!)) buf.push(lines[i]!);
      html.push(`<pre dir="ltr"><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const lvl = Math.min(6, h[1]!.length + 1);
      html.push(`<h${lvl}>${inline(h[2]!)}</h${lvl}>`);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushPara();
      flushList();
      html.push("<hr>");
    } else if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ul ?? ol)![1]!);
    } else if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return html.join("\n");
}
