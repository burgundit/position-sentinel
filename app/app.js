const holdingsInput = document.querySelector("#holdingsInput");
const newsInput = document.querySelector("#newsInput");
const riskSlider = document.querySelector("#riskSlider");
const riskValue = document.querySelector("#riskValue");
const analyzeButton = document.querySelector("#analyzeButton");
const loadSample = document.querySelector("#loadSample");
const savePortfolio = document.querySelector("#savePortfolio");
const loadPortfolio = document.querySelector("#loadPortfolio");
const marketDataToggle = document.querySelector("#marketDataToggle");
const rateSignal = document.querySelector("#rateSignal");
const inflationSignal = document.querySelector("#inflationSignal");
const growthSignal = document.querySelector("#growthSignal");
const marketTrend = document.querySelector("#marketTrend");

const portfolioBias = document.querySelector("#portfolioBias");
const portfolioScore = document.querySelector("#portfolioScore");
const macroScoreEl = document.querySelector("#macroScore");
const newsScoreEl = document.querySelector("#newsScore");
const concentrationScoreEl = document.querySelector("#concentrationScore");
const decisionBand = document.querySelector("#decisionBand");
const mainDecision = document.querySelector("#mainDecision");
const decisionReason = document.querySelector("#decisionReason");
const positionsTable = document.querySelector("#positionsTable");
const checklist = document.querySelector("#checklist");
const storageStatus = document.querySelector("#storageStatus");

const positiveWords = [
  "beat",
  "upgrade",
  "strong",
  "growth",
  "margin",
  "guidance",
  "contract",
  "buyback",
  "approval",
  "surge",
  "호조",
  "상향",
  "성장",
  "개선",
  "강세",
  "수주",
  "승인",
  "흑자",
  "증가",
  "실적"
];

const negativeWords = [
  "miss",
  "downgrade",
  "weak",
  "lawsuit",
  "recall",
  "probe",
  "cut",
  "slowdown",
  "ban",
  "drop",
  "부진",
  "하향",
  "소송",
  "규제",
  "리콜",
  "둔화",
  "감소",
  "적자",
  "하락",
  "금지"
];

const sectorSensitivity = {
  "반도체": 1,
  "ai": 1,
  "소프트웨어": 0.8,
  "클라우드": 0.8,
  "전기차": 1.1,
  "바이오": 1.2,
  "은행": -0.2,
  "에너지": 0.3,
  "방산": 0.2,
  "소비재": 0.1
};

function parseHoldings(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      const ticker = (parts[0] || "UNKNOWN").toUpperCase();
      const weight = Number((parts[1] || "0").replace(/[^0-9.]/g, "")) || 0;
      const theme = (parts[2] || "").toLowerCase();
      return { ticker, weight, theme };
    });
}

function countMatches(text, words) {
  const lower = text.toLowerCase();
  return words.reduce((total, word) => {
    const pattern = new RegExp(escapeRegExp(word.toLowerCase()), "g");
    return total + (lower.match(pattern) || []).length;
  }, 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMacroScore() {
  return [rateSignal, inflationSignal, growthSignal, marketTrend].reduce(
    (sum, input) => sum + Number(input.value),
    0
  );
}

function getNewsScore(news) {
  return countMatches(news, positiveWords) - countMatches(news, negativeWords);
}

function getConcentrationPenalty(holdings, risk) {
  const largest = Math.max(0, ...holdings.map((holding) => holding.weight));
  const overWeightPenalty = largest > 45 ? -3 : largest > 35 ? -2 : largest > 25 ? -1 : 0;
  const sectorMap = new Map();

  holdings.forEach((holding) => {
    const key = holding.theme.split("/")[0] || "unknown";
    sectorMap.set(key, (sectorMap.get(key) || 0) + holding.weight);
  });

  const maxSector = Math.max(0, ...sectorMap.values());
  const sectorPenalty = maxSector > 60 ? -2 : maxSector > 45 ? -1 : 0;
  return (overWeightPenalty + sectorPenalty) * (risk / 3);
}

function getSectorAdjustment(theme, macroScore) {
  const lowerTheme = theme.toLowerCase();
  const sensitivity = Object.entries(sectorSensitivity).reduce((score, [key, value]) => {
    return lowerTheme.includes(key) ? score + value : score;
  }, 0);

  return Math.round((macroScore * sensitivity) / 3);
}

function getDecision(score) {
  if (score >= 5) return { label: "롱 유지", className: "good" };
  if (score >= 1) return { label: "조건부 유지", className: "warn" };
  return { label: "축소 검토", className: "bad" };
}

function buildPayload() {
  return {
    holdings: holdingsInput.value,
    news: newsInput.value,
    risk: Number(riskSlider.value),
    rateSignal: Number(rateSignal.value),
    inflationSignal: Number(inflationSignal.value),
    growthSignal: Number(growthSignal.value),
    marketTrend: Number(marketTrend.value),
    includeMarketData: marketDataToggle.checked
  };
}

function canUseServerStorage() {
  return window.location.protocol !== "file:";
}

function setStorageStatus(message, state = "") {
  storageStatus.textContent = message;
  storageStatus.className = state ? `storage-status ${state}` : "storage-status";
}

function applyPortfolio(portfolio) {
  holdingsInput.value = portfolio.holdings || "";
  riskSlider.value = String(portfolio.risk ?? "3");
  rateSignal.value = String(portfolio.rateSignal ?? "0");
  inflationSignal.value = String(portfolio.inflationSignal ?? "0");
  growthSignal.value = String(portfolio.growthSignal ?? "0");
  marketTrend.value = String(portfolio.marketTrend ?? "0");
  marketDataToggle.checked = portfolio.includeMarketData ?? true;
  riskValue.value = riskSlider.value;
}

async function savePortfolioData() {
  const payload = buildPayload();

  if (!canUseServerStorage()) {
    localStorage.setItem("positionSentinelPortfolio", JSON.stringify(payload));
    setStorageStatus("브라우저에 보유 종목을 저장했습니다.", "good");
    return;
  }

  try {
    const response = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("save request failed");
    }

    setStorageStatus("보유 종목을 서버 파일에 저장했습니다.", "good");
  } catch (error) {
    localStorage.setItem("positionSentinelPortfolio", JSON.stringify(payload));
    setStorageStatus("서버 저장이 안 되어 브라우저에 임시 저장했습니다.", "bad");
  }
}

async function loadPortfolioData() {
  if (!canUseServerStorage()) {
    const portfolio = JSON.parse(localStorage.getItem("positionSentinelPortfolio") || "null");
    if (!portfolio) {
      setStorageStatus("저장된 보유 종목이 없습니다.", "bad");
      return;
    }
    applyPortfolio(portfolio);
    setStorageStatus("브라우저 저장값을 불러왔습니다.", "good");
    analyze();
    return;
  }

  try {
    const response = await fetch("/api/portfolio");
    if (!response.ok) {
      throw new Error("load request failed");
    }

    const portfolio = await response.json();
    if (!portfolio.holdings) {
      setStorageStatus("저장된 보유 종목이 없습니다.", "bad");
      return;
    }

    applyPortfolio(portfolio);
    setStorageStatus("서버 저장값을 불러왔습니다.", "good");
    analyze();
  } catch (error) {
    setStorageStatus("보유 종목을 불러오지 못했습니다.", "bad");
  }
}

async function analyze() {
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload())
      });

      if (!response.ok) {
        throw new Error("analysis request failed");
      }

      const result = await response.json();
      updateSummary(result.summary);
      renderRows(result.rows);
      renderChecklistItems(result.checklist);
      saveState();
      return;
    } catch (error) {
      console.warn("Python API unavailable. Falling back to browser analysis.", error);
    }
  }

  const holdings = parseHoldings(holdingsInput.value);
  const news = newsInput.value;
  const risk = Number(riskSlider.value);
  const macroScore = getMacroScore();
  const rawNewsScore = getNewsScore(news);
  const concentrationPenalty = getConcentrationPenalty(holdings, risk);

  if (!holdings.length) {
    positionsTable.innerHTML = `<tr><td colspan="6" class="empty">보유 종목을 먼저 입력하세요.</td></tr>`;
    return;
  }

  const rows = holdings.map((holding) => {
    const tickerMentions = countMatches(news, [holding.ticker]);
    const tickerBoost = tickerMentions ? Math.min(3, tickerMentions) : 0;
    const sectorAdjustment = getSectorAdjustment(holding.theme, macroScore);
    const weightPenalty = holding.weight > 40 ? -2 : holding.weight > 30 ? -1 : 0;
    const score = Math.round(macroScore + rawNewsScore + sectorAdjustment + tickerBoost + weightPenalty);
    const decision = getDecision(score);
    const reasons = [
      `거시 ${formatSigned(macroScore)}`,
      `뉴스 ${formatSigned(rawNewsScore)}`,
      sectorAdjustment ? `섹터 민감도 ${formatSigned(sectorAdjustment)}` : "섹터 중립",
      weightPenalty ? `비중 부담 ${formatSigned(weightPenalty)}` : "비중 안정"
    ];

    return { ...holding, score, decision, reasons };
  });

  const averagePositionScore = rows.reduce((sum, row) => sum + row.score * (row.weight || 1), 0) /
    rows.reduce((sum, row) => sum + (row.weight || 1), 0);
  const totalScore = Math.round(averagePositionScore + concentrationPenalty);
  const portfolioDecision = getDecision(totalScore);

  updateSummary({
    totalScore,
    macroScore,
    newsScore: rawNewsScore,
    concentrationPenalty,
    portfolioDecision,
    holdings
  });
  renderRows(rows);
  renderChecklist({ totalScore, rawNewsScore, concentrationPenalty, risk });
  saveState();
}

function updateSummary({ totalScore, macroScore, newsScore, concentrationPenalty, portfolioDecision, holdings, holdingsCount }) {
  const count = holdings ? holdings.length : holdingsCount;
  portfolioBias.textContent = portfolioDecision.label;
  portfolioScore.textContent = totalScore;
  macroScoreEl.textContent = formatSigned(macroScore);
  newsScoreEl.textContent = formatSigned(newsScore);
  concentrationScoreEl.textContent = formatSigned(Math.round(concentrationPenalty));

  decisionBand.className = `decision-band ${portfolioDecision.className}`;
  mainDecision.textContent = portfolioDecision.label;
  decisionReason.textContent =
    `총 ${count}개 종목 기준입니다. 포트폴리오 점수는 ${totalScore}점이며, ` +
    `거시 환경 ${formatSigned(macroScore)}, 뉴스 심리 ${formatSigned(newsScore)}, ` +
    `집중 리스크 ${formatSigned(Math.round(concentrationPenalty))}가 반영되었습니다.`;
}

function renderRows(rows) {
  positionsTable.innerHTML = rows
    .map((row) => {
      return `
        <tr>
          <td><strong>${sanitize(row.ticker)}</strong><br><span class="muted">${sanitize(row.theme || "테마 미입력")}</span></td>
          <td>${row.weight || 0}%</td>
          <td class="market-cell">${renderMarketData(row.market)}</td>
          <td><span class="badge ${row.decision.className}">${row.decision.label}</span></td>
          <td><strong>${row.score}</strong></td>
          <td>${row.reasons.map(sanitize).join(" · ")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMarketData(market) {
  if (!market || market.status === "disabled") {
    return `<span class="market-trend">미반영</span>`;
  }

  if (market.status !== "ok") {
    return `<span class="market-trend">조회 실패</span>`;
  }

  const changeClass = market.changePercent > 0 ? "up" : market.changePercent < 0 ? "down" : "";
  const changeText = market.changePercent === null || market.changePercent === undefined
    ? "-"
    : `${formatSigned(market.changePercent)}%`;
  const currency = market.currency ? ` ${sanitize(market.currency)}` : "";

  return `
    <span class="market-price">${sanitize(market.price ?? "-")}${currency}</span>
    <span class="market-change ${changeClass}">${sanitize(changeText)}</span>
    <span class="market-trend">${sanitize(market.trend || "데이터 부족")}</span>
  `;
}

function renderChecklist({ totalScore, rawNewsScore, concentrationPenalty, risk }) {
  const items = [];

  if (totalScore < 1) {
    items.push("롱 유지 근거가 약합니다. 신규 매수보다 손절선, 헤지, 비중 축소 기준을 먼저 확인하세요.");
  } else {
    items.push("롱 유지가 가능하더라도 다음 실적 발표와 주요 지표 발표 전후 변동성 계획을 세우세요.");
  }

  if (rawNewsScore < 0) {
    items.push("부정 뉴스가 우세합니다. 일회성 이슈인지, 이익 전망 훼손인지 분리해서 보세요.");
  }

  if (concentrationPenalty < -1) {
    items.push("집중 리스크가 큽니다. 같은 테마가 동시에 흔들릴 때의 최대 손실을 계산하세요.");
  }

  if (risk >= 4) {
    items.push("리스크 민감도가 높게 설정되어 있습니다. 보수적 기준에서는 부분 익절/축소 신호가 더 빨리 나옵니다.");
  }

  checklist.innerHTML = items.map((item) => `<li>${sanitize(item)}</li>`).join("");
}

function renderChecklistItems(items) {
  checklist.innerHTML = items.map((item) => `<li>${sanitize(item)}</li>`).join("");
}

function formatSigned(value) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function sanitize(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function saveState() {
  const state = {
    holdings: holdingsInput.value,
    news: newsInput.value,
    risk: riskSlider.value,
    rate: rateSignal.value,
    inflation: inflationSignal.value,
    growth: growthSignal.value,
    trend: marketTrend.value,
    marketData: marketDataToggle.checked
  };
  localStorage.setItem("positionSentinelState", JSON.stringify(state));
}

function loadState() {
  const state = JSON.parse(localStorage.getItem("positionSentinelState") || "null");
  if (!state) return;

  holdingsInput.value = state.holdings || "";
  newsInput.value = state.news || "";
  riskSlider.value = state.risk || "3";
  rateSignal.value = state.rate || "0";
  inflationSignal.value = state.inflation || "0";
  growthSignal.value = state.growth || "0";
  marketTrend.value = state.trend || "0";
  marketDataToggle.checked = state.marketData ?? true;
  riskValue.value = riskSlider.value;
}

function loadSampleData() {
  holdingsInput.value = [
    "NVDA, 40%, 반도체/AI",
    "MSFT, 35%, 소프트웨어/클라우드",
    "TSLA, 25%, 전기차"
  ].join("\n");
  newsInput.value = [
    "NVDA AI 수요 strong, 데이터센터 매출 성장 기대.",
    "MSFT 클라우드 margin 개선 및 guidance 상향.",
    "TSLA 전기차 수요 둔화 우려와 가격 인하 압박."
  ].join("\n");
  rateSignal.value = "2";
  inflationSignal.value = "0";
  growthSignal.value = "2";
  marketTrend.value = "2";
  riskSlider.value = "3";
  riskValue.value = "3";
  analyze();
}

riskSlider.addEventListener("input", () => {
  riskValue.value = riskSlider.value;
});

analyzeButton.addEventListener("click", analyze);
loadSample.addEventListener("click", loadSampleData);
savePortfolio.addEventListener("click", savePortfolioData);
loadPortfolio.addEventListener("click", loadPortfolioData);

loadState();
if (holdingsInput.value.trim()) {
  analyze();
}
