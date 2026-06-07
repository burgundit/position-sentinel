export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countMatches(text, words) {
  const lower = text.toLowerCase();
  return words.reduce((total, word) => {
    const pattern = new RegExp(escapeRegExp(word.toLowerCase()), "g");
    return total + (lower.match(pattern) || []).length;
  }, 0);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatSigned(value) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function sanitize(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
