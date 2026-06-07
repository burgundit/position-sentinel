import {
  analyzeButton,
  autoEnvironment,
  autoNews,
  checklist,
  concentrationScoreEl,
  decisionBand,
  decisionReason,
  environmentStatus,
  growthSignal,
  holdingsEditor,
  holdingsInput,
  inflationSignal,
  loadPortfolio,
  loadSample,
  macroScoreEl,
  mainDecision,
  marketDataToggle,
  marketTrend,
  newsInput,
  newsScoreEl,
  newsStatus,
  portfolioBias,
  portfolioScore,
  positionsTable,
  rateSignal,
  rebalanceEqual,
  riskSlider,
  riskValue,
  savePortfolio,
  storageStatus,
  symbolSearchButton,
  symbolSearchInput,
  symbolSearchResults,
  symbolSearchStatus
} from "./modules/dom.js";
import {
  analyzePortfolio,
  canUseServerStorage,
  getEnvironmentSuggestion,
  getNewsMemo,
  loadPortfolioData as loadPortfolioFromApi,
  savePortfolioData as savePortfolioToApi,
  searchSymbolCandidates
} from "./modules/api.js";
import { parseHoldings, holdingsToText } from "./modules/holdings.js";
import { normalizeSymbol } from "./modules/symbols.js";
import { clamp, countMatches, formatSigned, sanitize } from "./modules/utils.js";

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

const profileRules = [
  {
    label: "고성장/고밸류",
    keywords: ["ai", "반도체", "소프트웨어", "클라우드", "전기차", "양자", "growth", "PLTR", "NVDA", "TSLA", "IONQ", "RIVN", "LCID", "SMCI", "SNOW", "DDOG"],
    rate: -1,
    cycle: 0.8,
    market: 0.7,
    base: -0.4
  },
  {
    label: "방어/배당",
    keywords: ["배당", "방어", "필수소비", "헬스케어", "SCHD", "PG", "KO", "PEP", "WMT", "JNJ", "UNH", "LLY", "MRK"],
    rate: -0.3,
    cycle: -0.2,
    market: -0.4,
    base: 0.7
  },
  {
    label: "경기민감",
    keywords: ["자동차", "산업재", "소비재", "에너지", "은행", "CAT", "BA", "XOM", "CVX", "JPM", "BAC", "GS"],
    rate: -0.4,
    cycle: 0.9,
    market: 0.4,
    base: 0
  },
  {
    label: "장기채/금리민감",
    keywords: ["채권", "미국채", "TLT"],
    rate: -1.2,
    cycle: -0.2,
    market: -0.2,
    base: 0
  }
];

const speculativeTickers = new Set(["IONQ", "RIVN", "LCID", "SMCI", "SNOW", "DDOG", "RBLX", "SNAP", "PLTR"]);
const qualityTickers = new Set(["AAPL", "MSFT", "NVDA", "AVGO", "GOOGL", "META", "COST", "LLY", "UNH", "BRK-B", "ASML", "TSM"]);
const defensiveTickers = new Set(["PG", "KO", "PEP", "WMT", "COST", "JNJ", "UNH", "LLY", "MRK", "SCHD"]);
const severeNegativeWords = ["lawsuit", "probe", "ban", "recall", "downgrade", "소송", "조사", "금지", "리콜", "하향"];

let editorHoldings = [];
let isSyncingEditor = false;

function syncEditorFromText() {
  if (isSyncingEditor) return;
  editorHoldings = parseHoldings(holdingsInput.value).map((holding) => ({ ...holding }));
  renderHoldingsEditor();
}

function syncTextFromEditor({ shouldAnalyze = true, shouldRender = true } = {}) {
  isSyncingEditor = true;
  holdingsInput.value = holdingsToText(editorHoldings);
  isSyncingEditor = false;
  if (shouldRender) {
    renderHoldingsEditor();
  }
  saveState();
  if (shouldAnalyze) {
    analyze();
  }
}

function renderHoldingsEditor() {
  if (!editorHoldings.length) {
    holdingsEditor.innerHTML = `<div class="editor-empty">종목 API 검색에서 후보를 선택하면 여기에 추가됩니다.</div>`;
    return;
  }

  holdingsEditor.innerHTML = `
    <div class="holding-editor-head">
      <span>종목</span>
      <span>비중</span>
      <span>테마</span>
      <span></span>
    </div>
    ${editorHoldings.map((holding, index) => `
      <div class="holding-editor-row" data-index="${index}">
        <div>
          <strong>${sanitize(holding.name || holding.ticker)}</strong>
          <span>${sanitize(holding.ticker)}</span>
        </div>
        <input class="holding-weight" type="number" min="0" max="100" step="0.1" value="${sanitize(holding.weight || 0)}" aria-label="비중" />
        <input class="holding-theme" type="text" value="${sanitize(holding.theme || "")}" placeholder="예: 반도체, 배당" aria-label="테마" />
        <button class="icon-button remove-holding" type="button" title="삭제" aria-label="삭제">×</button>
      </div>
    `).join("")}
  `;
}

function addOrUpdateEditorHolding(result) {
  const existing = editorHoldings.find((holding) => holding.ticker === result.ticker);
  if (existing) {
    existing.name = result.name || existing.name;
  } else {
    editorHoldings.push({
      ticker: result.ticker,
      name: result.name || result.ticker,
      weight: 0,
      theme: ""
    });
  }
  syncTextFromEditor();
}

function rebalanceEditorHoldings() {
  if (!editorHoldings.length) return;
  const equalWeight = Number((100 / editorHoldings.length).toFixed(2));
  editorHoldings = editorHoldings.map((holding) => ({ ...holding, weight: equalWeight }));
  syncTextFromEditor();
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

function getPositionProfile(holding) {
  const text = `${holding.ticker || ""} ${holding.name || ""} ${holding.theme || ""}`.toLowerCase();
  const labels = [];
  let rate = 0;
  let cycle = 0;
  let market = 0;
  let base = 0;

  profileRules.forEach((rule) => {
    if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      labels.push(rule.label);
      rate += rule.rate;
      cycle += rule.cycle;
      market += rule.market;
      base += rule.base;
    }
  });

  if (speculativeTickers.has(holding.ticker)) {
    labels.push("변동성 큼");
    base -= 0.8;
    market += 0.4;
  }
  if (qualityTickers.has(holding.ticker)) {
    labels.push("우량 대형");
    base += 0.7;
  }
  if (defensiveTickers.has(holding.ticker)) {
    labels.push("방어성");
    base += 0.4;
  }

  return {
    labels: [...new Set(labels.length ? labels : ["일반"])],
    rate: clamp(rate, -2, 1),
    cycle: clamp(cycle, -1, 1.5),
    market: clamp(market, -1, 1.5),
    base: clamp(base, -2, 2)
  };
}

function getStyleAdjustment(holding, risk, news) {
  const profile = getPositionProfile(holding);
  const riskMultiplier = 0.8 + risk * 0.12;
  let rawScore = profile.base +
    profile.rate * -Number(rateSignal.value) +
    profile.cycle * Number(growthSignal.value) +
    profile.market * Number(marketTrend.value);

  const severeNegative = countMatches(news, severeNegativeWords);
  if (severeNegative && speculativeTickers.has(holding.ticker)) {
    rawScore -= Math.min(2, severeNegative);
  }

  return {
    score: Math.round(rawScore * riskMultiplier),
    profile: { labels: profile.labels, rawScore: Number(rawScore.toFixed(2)) }
  };
}

function getDecision(score) {
  if (score >= 5) return { label: "1년 롱 유지", className: "good" };
  if (score >= 1) return { label: "1년 조건부 유지", className: "warn" };
  return { label: "1년 기준 축소 검토", className: "bad" };
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

function setStorageStatus(message, state = "") {
  storageStatus.textContent = message;
  storageStatus.className = state ? `storage-status ${state}` : "storage-status";
}

function setEnvironmentStatus(message, state = "") {
  environmentStatus.textContent = message;
  environmentStatus.className = state ? `storage-status ${state}` : "storage-status";
}

function setNewsStatus(message, state = "") {
  newsStatus.textContent = message;
  newsStatus.className = state ? `storage-status ${state}` : "storage-status";
}

function setSymbolSearchStatus(message, state = "") {
  symbolSearchStatus.textContent = message;
  symbolSearchStatus.className = state ? `storage-status ${state}` : "storage-status";
}

function addHoldingFromSymbol(result) {
  addOrUpdateEditorHolding(result);
  setSymbolSearchStatus(`${result.name} / ${result.ticker}를 보유 종목에 추가했습니다.`, "good");
  symbolSearchInput.value = "";
  symbolSearchResults.innerHTML = "";
}

function renderSymbolResults(results) {
  if (!results.length) {
    symbolSearchResults.innerHTML = "";
    return;
  }

  symbolSearchResults.innerHTML = results.map((result) => {
    const exchange = result.exchange ? ` · ${sanitize(result.exchange)}` : "";
    const source = result.source ? ` · ${sanitize(result.source)}` : "";
    return `
      <button class="symbol-result" type="button" data-ticker="${sanitize(result.ticker)}" data-name="${sanitize(result.name)}">
        <strong>${sanitize(result.ticker)}</strong>
        <span>${sanitize(result.name)}${exchange}${source}</span>
      </button>
    `;
  }).join("");
}

async function searchSymbols() {
  const query = symbolSearchInput.value.trim();
  if (query.length < 2) {
    setSymbolSearchStatus("두 글자 이상 입력하세요.", "bad");
    symbolSearchResults.innerHTML = "";
    return;
  }

  if (!canUseServerStorage()) {
    const normalized = normalizeSymbol(query);
    renderSymbolResults([{ ...normalized, source: "브라우저 별칭" }]);
    setSymbolSearchStatus("서버 없이 열려 있어 내장 별칭만 사용합니다.", "bad");
    return;
  }

  symbolSearchButton.disabled = true;
  symbolSearchButton.textContent = "조회 중";
  setSymbolSearchStatus("종목 후보를 조회하고 있습니다.");

  try {
    const payload = await searchSymbolCandidates(query);
    renderSymbolResults(payload.results || []);
    setSymbolSearchStatus(payload.message || "조회가 완료되었습니다.", payload.results?.length ? "good" : "bad");
  } catch (error) {
    setSymbolSearchStatus("종목 검색 API 조회에 실패했습니다.", "bad");
    symbolSearchResults.innerHTML = "";
  } finally {
    symbolSearchButton.disabled = false;
    symbolSearchButton.textContent = "검색";
  }
}

function applyPortfolio(portfolio) {
  holdingsInput.value = portfolio.holdings || "";
  syncEditorFromText();
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
    await savePortfolioToApi(payload);
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
    const portfolio = await loadPortfolioFromApi();
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

async function applyAutoEnvironment() {
  if (!canUseServerStorage()) {
    setEnvironmentStatus("서버 실행 화면에서만 자동 입력을 사용할 수 있습니다.", "bad");
    return;
  }

  autoEnvironment.disabled = true;
  autoEnvironment.textContent = "조회 중";
  setEnvironmentStatus("시장 프록시를 조회하고 있습니다.");

  try {
    const result = await getEnvironmentSuggestion();
    rateSignal.value = String(result.signals.rateSignal ?? 0);
    inflationSignal.value = String(result.signals.inflationSignal ?? 0);
    growthSignal.value = String(result.signals.growthSignal ?? 0);
    marketTrend.value = String(result.signals.marketTrend ?? 0);
    setEnvironmentStatus(
      `자동 입력: 금리 ${result.labels.rateSignal}, 인플레이션 ${result.labels.inflationSignal}, 경기 ${result.labels.growthSignal}, 시장 ${result.labels.marketTrend}`,
      "good"
    );
    saveState();
  } catch (error) {
    setEnvironmentStatus("환경 자동 입력에 실패했습니다. 수동 선택값을 유지합니다.", "bad");
  } finally {
    autoEnvironment.disabled = false;
    autoEnvironment.textContent = "자동 입력";
  }
}

async function applyAutoNews() {
  if (!holdingsInput.value.trim()) {
    setNewsStatus("보유 종목을 먼저 입력하세요.", "bad");
    return;
  }

  if (!canUseServerStorage()) {
    setNewsStatus("서버 실행 화면에서만 뉴스 자동 입력을 사용할 수 있습니다.", "bad");
    return;
  }

  autoNews.disabled = true;
  autoNews.textContent = "조회 중";
  setNewsStatus("보유 종목 기준 뉴스를 가져오고 있습니다.");

  try {
    const result = await getNewsMemo(holdingsInput.value);
    if (!result.memo) {
      setNewsStatus(result.message || "가져온 뉴스가 없습니다.", "bad");
      return;
    }

    newsInput.value = result.memo;
    setNewsStatus(result.message || "뉴스 메모를 자동 입력했습니다.", "good");
    saveState();
  } catch (error) {
    setNewsStatus("뉴스 자동 입력에 실패했습니다. 수동 메모를 유지합니다.", "bad");
  } finally {
    autoNews.disabled = false;
    autoNews.textContent = "뉴스 자동";
  }
}

async function analyze() {
  if (window.location.protocol !== "file:") {
    try {
      const result = await analyzePortfolio(buildPayload());
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
    const styleAdjustment = getStyleAdjustment(holding, risk, news);
    const weightPenalty = holding.weight > 40 ? -2 : holding.weight > 30 ? -1 : 0;
    const score = Math.round(
      macroScore + rawNewsScore + sectorAdjustment + styleAdjustment.score + tickerBoost + weightPenalty
    );
    const decision = getDecision(score);
    const reasons = [
      `거시 ${formatSigned(macroScore)}`,
      `뉴스 ${formatSigned(rawNewsScore)}`,
      sectorAdjustment ? `섹터 민감도 ${formatSigned(sectorAdjustment)}` : "섹터 중립",
      `스타일 ${formatSigned(styleAdjustment.score)} (${styleAdjustment.profile.labels.join(", ")})`,
      weightPenalty ? `비중 부담 ${formatSigned(weightPenalty)}` : "비중 안정"
    ];

    return { ...holding, score, decision, reasons, profile: styleAdjustment.profile, styleScore: styleAdjustment.score };
  });

  const averagePositionScore = rows.reduce((sum, row) => sum + row.score * (row.weight || 1), 0) /
    rows.reduce((sum, row) => sum + (row.weight || 1), 0);
  const weightSum = rows.reduce((sum, row) => sum + (row.weight || 1), 0);
  const styleScore = rows.reduce((sum, row) => sum + row.styleScore * (row.weight || 1), 0) / weightSum;
  const totalScore = Math.round(averagePositionScore + concentrationPenalty);
  const portfolioDecision = getDecision(totalScore);

  updateSummary({
    totalScore,
    macroScore,
    newsScore: rawNewsScore,
    styleScore: Math.round(styleScore),
    concentrationPenalty,
    portfolioDecision,
    holdings
  });
  renderRows(rows);
  renderChecklist({ totalScore, rawNewsScore, concentrationPenalty, risk });
  saveState();
}

function updateSummary({ totalScore, macroScore, newsScore, styleScore = 0, concentrationPenalty, portfolioDecision, holdings, holdingsCount }) {
  const count = holdings ? holdings.length : holdingsCount;
  portfolioBias.textContent = portfolioDecision.label;
  portfolioScore.textContent = totalScore;
  macroScoreEl.textContent = formatSigned(macroScore);
  newsScoreEl.textContent = formatSigned(newsScore);
  concentrationScoreEl.textContent = formatSigned(Math.round(concentrationPenalty));

  decisionBand.className = `decision-band ${portfolioDecision.className}`;
  mainDecision.textContent = portfolioDecision.label;
  decisionReason.textContent =
    `최소 1년 보유를 전제로 총 ${count}개 종목을 점검했습니다. 포트폴리오 점수는 ${totalScore}점이며, ` +
    `거시 환경 ${formatSigned(macroScore)}, 뉴스 심리 ${formatSigned(newsScore)}, ` +
    `스타일 적합도 ${formatSigned(styleScore)}, 집중 리스크 ${formatSigned(Math.round(concentrationPenalty))}가 반영되었습니다.`;
}

function renderRows(rows) {
  positionsTable.innerHTML = rows
    .map((row) => {
      return `
        <tr>
          <td><strong>${sanitize(row.name || row.ticker)}</strong><br><span class="muted">${sanitize(row.ticker)} · ${sanitize(row.theme || "테마 미입력")}</span></td>
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
    items.push("1년 보유 근거가 약합니다. 단기 가격보다 매출/마진/현금흐름 전망이 훼손됐는지 먼저 확인하세요.");
  } else {
    items.push("1년 롱 유지가 가능하더라도 다음 2~4개 분기 실적에서 확인할 핵심 지표를 미리 정하세요.");
  }

  if (rawNewsScore < 0) {
    items.push("부정 뉴스가 우세합니다. 일회성 가격 이슈인지, 1년 이익 전망을 낮추는 이슈인지 분리해서 보세요.");
  }

  if (concentrationPenalty < -1) {
    items.push("집중 리스크가 큽니다. 같은 테마가 1년 동안 부진할 때도 버틸 수 있는 비중인지 점검하세요.");
  }

  if (risk >= 4) {
    items.push("리스크 민감도가 높게 설정되어 있습니다. 1년 기준에서도 변동성보다 원금 훼손 가능성을 더 보수적으로 봅니다.");
  }

  if (totalScore >= 1 && rawNewsScore <= 0) {
    items.push("점수는 유지권이지만 뉴스 모멘텀이 강하지 않습니다. 보유 thesis를 지지하는 장기 촉매가 남아 있는지 확인하세요.");
  }

  checklist.innerHTML = items.map((item) => `<li>${sanitize(item)}</li>`).join("");
}

function renderChecklistItems(items) {
  checklist.innerHTML = items.map((item) => `<li>${sanitize(item)}</li>`).join("");
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
  syncEditorFromText();
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
    "현대차, 20%, 자동차/배당",
    "SK하이닉스, 20%, 반도체/AI",
    "미래에셋증권, 20%, 증권/금융",
    "삼성전자, 20%, 반도체/전자",
    "KODEX 고배당주, 20%, 고배당주 ETF"
  ].join("\n");
  syncEditorFromText();
  newsInput.value = [
    "현대차 배당 정책과 전기차 수요를 점검합니다.",
    "SK하이닉스와 삼성전자는 메모리 업황 및 AI 수요를 확인합니다.",
    "미래에셋증권과 고배당 ETF는 금리와 배당 매력을 함께 점검합니다."
  ].join("\n");
  rateSignal.value = "2";
  inflationSignal.value = "0";
  growthSignal.value = "2";
  marketTrend.value = "1";
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
autoEnvironment.addEventListener("click", applyAutoEnvironment);
autoNews.addEventListener("click", applyAutoNews);
rebalanceEqual.addEventListener("click", rebalanceEditorHoldings);
holdingsInput.addEventListener("input", () => {
  syncEditorFromText();
  saveState();
});
holdingsEditor.addEventListener("input", (event) => {
  const row = event.target.closest(".holding-editor-row");
  if (!row) return;
  const index = Number(row.dataset.index);
  if (!editorHoldings[index]) return;
  if (event.target.classList.contains("holding-weight")) {
    editorHoldings[index].weight = Number(event.target.value) || 0;
  }
  if (event.target.classList.contains("holding-theme")) {
    editorHoldings[index].theme = event.target.value;
  }
  syncTextFromEditor({ shouldAnalyze: false, shouldRender: false });
});
holdingsEditor.addEventListener("change", () => {
  analyze();
});
holdingsEditor.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-holding");
  if (!button) return;
  const row = button.closest(".holding-editor-row");
  const index = Number(row.dataset.index);
  editorHoldings.splice(index, 1);
  syncTextFromEditor();
});
symbolSearchButton.addEventListener("click", searchSymbols);
symbolSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchSymbols();
  }
});
symbolSearchResults.addEventListener("click", (event) => {
  const button = event.target.closest(".symbol-result");
  if (!button) return;
  addHoldingFromSymbol({
    ticker: button.dataset.ticker,
    name: button.dataset.name
  });
});

loadState();
if (holdingsInput.value.trim()) {
  analyze();
}
