/** Texto legible (oscuro o blanco) sobre un color de marca hex, por luminancia relativa (WCAG). */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#1a1a1c";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste contra blanco vs. contra #1a1a1c: el que sea mayor.
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.0603 ? "#ffffff" : "#1a1a1c";
}
