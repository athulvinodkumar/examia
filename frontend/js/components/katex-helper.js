// =====================================================================
// EXAMIA KATEX MATHEMATICAL EXPRESSION RENDERER
// Supports inline $formula$ and display $$formula$$
// =====================================================================

export function renderMathInElement(element) {
  if (!element) return;
  if (typeof window.renderMathInElement === "function") {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX rendering warning:", e);
    }
  }
}

export function formatMathString(text) {
  if (!text) return "";
  // Escape potential raw HTML
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
