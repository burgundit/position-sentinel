export function canUseServerStorage() {
  return window.location.protocol !== "file:";
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    throw new Error(`${path} request failed`);
  }

  return response.json();
}

export function analyzePortfolio(payload) {
  return requestJson("/api/analyze", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function savePortfolioData(payload) {
  return requestJson("/api/portfolio", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loadPortfolioData() {
  return requestJson("/api/portfolio");
}

export function getEnvironmentSuggestion() {
  return requestJson("/api/environment");
}

export function getNewsMemo(holdings) {
  return requestJson("/api/news", {
    method: "POST",
    body: JSON.stringify({ holdings })
  });
}

export function searchSymbolCandidates(query) {
  return requestJson(`/api/symbol-search?q=${encodeURIComponent(query)}`);
}
