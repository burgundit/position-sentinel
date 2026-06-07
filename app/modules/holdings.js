import { normalizeSymbol } from "./symbols.js";

export function parseHoldings(text) {
  const holdings = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      const { ticker, name } = normalizeSymbol(parts[0] || "UNKNOWN");
      const weight = Number((parts[1] || "0").replace(/[^0-9.]/g, "")) || 0;
      const theme = (parts[2] || "").toLowerCase();
      return { ticker, name, weight, theme };
    });

  const nonzeroWeightSum = holdings.reduce((sum, holding) => sum + holding.weight, 0);
  if (holdings.length && nonzeroWeightSum === 0) {
    const equalWeight = Number((100 / holdings.length).toFixed(2));
    holdings.forEach((holding) => {
      holding.weight = equalWeight;
    });
  }

  return holdings;
}

export function holdingsToText(holdings) {
  return holdings
    .filter((holding) => holding.ticker || holding.name)
    .map((holding) => {
      const symbol = holding.ticker || holding.name;
      const weight = Number(holding.weight) || 0;
      return `${symbol}, ${weight}%, ${holding.theme || ""}`.trimEnd();
    })
    .join("\n");
}
