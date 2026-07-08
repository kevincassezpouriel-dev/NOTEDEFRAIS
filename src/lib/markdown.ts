/** Mini-rendu markdown → HTML (titres, gras, italique, liens, listes).
 *  Le HTML source est échappé avant transformation : contenu sûr. */
export function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const blocks = escaped.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^###\s/.test(trimmed)) return `<h3>${inline(trimmed.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s/.test(trimmed)) return `<h2>${inline(trimmed.replace(/^##\s+/, ""))}</h2>`;
      if (/^#\s/.test(trimmed)) return `<h2>${inline(trimmed.replace(/^#\s+/, ""))}</h2>`;
      if (trimmed.split("\n").every((l) => /^[-*]\s/.test(l.trim()))) {
        const items = trimmed
          .split("\n")
          .map((l) => `<li>${inline(l.trim().replace(/^[-*]\s+/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(trimmed).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g,
      '<a href="$2" rel="noopener">$1</a>'
    );
}
