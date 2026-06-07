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

const koreaSymbols = {
  "apple": ["AAPL", "Apple"],
  "애플": ["AAPL", "Apple"],
  "tesla": ["TSLA", "Tesla"],
  "테슬라": ["TSLA", "Tesla"],
  "nvidia": ["NVDA", "NVIDIA"],
  "엔비디아": ["NVDA", "NVIDIA"],
  "novavax": ["NVAX", "Novavax"],
  "노바벡스": ["NVAX", "Novavax"],
  "노바백스": ["NVAX", "Novavax"],
  "microsoft": ["MSFT", "Microsoft"],
  "마이크로소프트": ["MSFT", "Microsoft"],
  "google": ["GOOGL", "Alphabet"],
  "구글": ["GOOGL", "Alphabet"],
  "alphabet": ["GOOGL", "Alphabet"],
  "알파벳": ["GOOGL", "Alphabet"],
  "amazon": ["AMZN", "Amazon"],
  "아마존": ["AMZN", "Amazon"],
  "meta": ["META", "Meta"],
  "메타": ["META", "Meta"],
  "netflix": ["NFLX", "Netflix"],
  "넷플릭스": ["NFLX", "Netflix"],
  "amd": ["AMD", "AMD"],
  "에이엠디": ["AMD", "AMD"],
  "브로드컴": ["AVGO", "Broadcom"],
  "팔란티어": ["PLTR", "Palantir"],
  "팔란티어 테크": ["PLTR", "Palantir"],
  "슈퍼마이크로": ["SMCI", "Super Micro Computer"],
  "슈마컴": ["SMCI", "Super Micro Computer"],
  "인텔": ["INTC", "Intel"],
  "퀄컴": ["QCOM", "Qualcomm"],
  "오라클": ["ORCL", "Oracle"],
  "어도비": ["ADBE", "Adobe"],
  "세일즈포스": ["CRM", "Salesforce"],
  "코스트코": ["COST", "Costco"],
  "월마트": ["WMT", "Walmart"],
  "코카콜라": ["KO", "Coca-Cola"],
  "펩시": ["PEP", "PepsiCo"],
  "맥도날드": ["MCD", "McDonald's"],
  "스타벅스": ["SBUX", "Starbucks"],
  "나이키": ["NKE", "Nike"],
  "디즈니": ["DIS", "Disney"],
  "우버": ["UBER", "Uber"],
  "에어비앤비": ["ABNB", "Airbnb"],
  "페이팔": ["PYPL", "PayPal"],
  "블록": ["SQ", "Block"],
  "스퀘어": ["SQ", "Block"],
  "비자": ["V", "Visa"],
  "마스터카드": ["MA", "Mastercard"],
  "제이피모건": ["JPM", "JPMorgan Chase"],
  "JP모건": ["JPM", "JPMorgan Chase"],
  "뱅크오브아메리카": ["BAC", "Bank of America"],
  "보아": ["BAC", "Bank of America"],
  "골드만삭스": ["GS", "Goldman Sachs"],
  "모건스탠리": ["MS", "Morgan Stanley"],
  "버크셔": ["BRK-B", "Berkshire Hathaway"],
  "버크셔해서웨이": ["BRK-B", "Berkshire Hathaway"],
  "엑슨모빌": ["XOM", "Exxon Mobil"],
  "쉐브론": ["CVX", "Chevron"],
  "일라이릴리": ["LLY", "Eli Lilly"],
  "릴리": ["LLY", "Eli Lilly"],
  "노보노디스크": ["NVO", "Novo Nordisk"],
  "존슨앤존슨": ["JNJ", "Johnson & Johnson"],
  "화이자": ["PFE", "Pfizer"],
  "모더나": ["MRNA", "Moderna"],
  "유나이티드헬스": ["UNH", "UnitedHealth"],
  "유나이티드 헬스": ["UNH", "UnitedHealth"],
  "캐터필러": ["CAT", "Caterpillar"],
  "보잉": ["BA", "Boeing"],
  "록히드마틴": ["LMT", "Lockheed Martin"],
  "록히드 마틴": ["LMT", "Lockheed Martin"],
  "tsmc": ["TSM", "Taiwan Semiconductor"],
  "티에스엠씨": ["TSM", "Taiwan Semiconductor"],
  "대만반도체": ["TSM", "Taiwan Semiconductor"],
  "타이완반도체": ["TSM", "Taiwan Semiconductor"],
  "asml": ["ASML", "ASML"],
  "에이에스엠엘": ["ASML", "ASML"],
  "마이크론": ["MU", "Micron Technology"],
  "arm": ["ARM", "Arm Holdings"],
  "암홀딩스": ["ARM", "Arm Holdings"],
  "아이온큐": ["IONQ", "IonQ"],
  "리비안": ["RIVN", "Rivian"],
  "루시드": ["LCID", "Lucid"],
  "프로터앤갬블": ["PG", "Procter & Gamble"],
  "피앤지": ["PG", "Procter & Gamble"],
  "홈디포": ["HD", "Home Depot"],
  "타겟": ["TGT", "Target"],
  "로블록스": ["RBLX", "Roblox"],
  "쇼피파이": ["SHOP", "Shopify"],
  "스포티파이": ["SPOT", "Spotify"],
  "도어대시": ["DASH", "DoorDash"],
  "핀터레스트": ["PINS", "Pinterest"],
  "스냅": ["SNAP", "Snap"],
  "크라우드스트라이크": ["CRWD", "CrowdStrike"],
  "팔로알토": ["PANW", "Palo Alto Networks"],
  "서비스나우": ["NOW", "ServiceNow"],
  "스노우플레이크": ["SNOW", "Snowflake"],
  "데이터독": ["DDOG", "Datadog"],
  "줌": ["ZM", "Zoom"],
  "애브비": ["ABBV", "AbbVie"],
  "애보트": ["ABT", "Abbott"],
  "머크": ["MRK", "Merck"],
  "암젠": ["AMGN", "Amgen"],
  "길리어드": ["GILD", "Gilead Sciences"],
  "메드트로닉": ["MDT", "Medtronic"],
  "qqq": ["QQQ", "Invesco QQQ"],
  "나스닥 etf": ["QQQ", "Invesco QQQ"],
  "슈드": ["SCHD", "Schwab US Dividend Equity ETF"],
  "schd": ["SCHD", "Schwab US Dividend Equity ETF"],
  "미국배당 etf": ["SCHD", "Schwab US Dividend Equity ETF"],
  "spy": ["SPY", "SPDR S&P 500 ETF"],
  "s&p500 etf": ["SPY", "SPDR S&P 500 ETF"],
  "미국채 etf": ["TLT", "iShares 20+ Year Treasury Bond ETF"],
  "tlt": ["TLT", "iShares 20+ Year Treasury Bond ETF"],
  "현대차": ["005380.KS", "현대차"],
  "현대자동차": ["005380.KS", "현대차"],
  "sk하이닉스": ["000660.KS", "SK하이닉스"],
  "하이닉스": ["000660.KS", "SK하이닉스"],
  "미래에셋증권": ["006800.KS", "미래에셋증권"],
  "미래에셋 증권": ["006800.KS", "미래에셋증권"],
  "삼성전자": ["005930.KS", "삼성전자"],
  "삼전": ["005930.KS", "삼성전자"],
  "kodex 고배당주": ["279530.KS", "KODEX 고배당주"],
  "kodex고배당주": ["279530.KS", "KODEX 고배당주"],
  "고배당주 etf": ["279530.KS", "KODEX 고배당주"],
  "고배당 etf": ["279530.KS", "KODEX 고배당주"],
  "tiger 코스피고배당": ["210780.KS", "TIGER 코스피고배당"],
  "plus 고배당주": ["161510.KS", "PLUS 고배당주"],
  "plus고배당주": ["161510.KS", "PLUS 고배당주"],
  "플러스 고배당주": ["161510.KS", "PLUS 고배당주"],
  "플러스고배당주": ["161510.KS", "PLUS 고배당주"],
  "한화 고배당주": ["161510.KS", "PLUS 고배당주"],
  "한화 plus 고배당주": ["161510.KS", "PLUS 고배당주"],
  "arirang 고배당주": ["161510.KS", "PLUS 고배당주"],
  "arirang고배당주": ["161510.KS", "PLUS 고배당주"],
  "셀트리온": ["068270.KS", "셀트리온"],
  "lg에너지솔루션": ["373220.KS", "LG에너지솔루션"],
  "lg 엔솔": ["373220.KS", "LG에너지솔루션"],
  "엘지에너지솔루션": ["373220.KS", "LG에너지솔루션"],
  "naver": ["035420.KS", "NAVER"],
  "네이버": ["035420.KS", "NAVER"],
  "카카오": ["035720.KS", "카카오"],
  "기아": ["000270.KS", "기아"],
  "기아차": ["000270.KS", "기아"],
  "posco홀딩스": ["005490.KS", "POSCO홀딩스"],
  "포스코홀딩스": ["005490.KS", "POSCO홀딩스"],
  "kb금융": ["105560.KS", "KB금융"],
  "신한지주": ["055550.KS", "신한지주"],
  "삼성바이오로직스": ["207940.KS", "삼성바이오로직스"],
  "삼바": ["207940.KS", "삼성바이오로직스"],
  "lg화학": ["051910.KS", "LG화학"],
  "엘지화학": ["051910.KS", "LG화학"],
  "삼성sdi": ["006400.KS", "삼성SDI"],
  "현대모비스": ["012330.KS", "현대모비스"]
};

const koreaTickerNames = {
  "AAPL": "Apple",
  "TSLA": "Tesla",
  "NVDA": "NVIDIA",
  "NVAX": "Novavax",
  "MSFT": "Microsoft",
  "GOOGL": "Alphabet",
  "AMZN": "Amazon",
  "META": "Meta",
  "NFLX": "Netflix",
  "AMD": "AMD",
  "AVGO": "Broadcom",
  "PLTR": "Palantir",
  "SMCI": "Super Micro Computer",
  "INTC": "Intel",
  "QCOM": "Qualcomm",
  "ORCL": "Oracle",
  "ADBE": "Adobe",
  "CRM": "Salesforce",
  "COST": "Costco",
  "WMT": "Walmart",
  "KO": "Coca-Cola",
  "PEP": "PepsiCo",
  "MCD": "McDonald's",
  "SBUX": "Starbucks",
  "NKE": "Nike",
  "DIS": "Disney",
  "UBER": "Uber",
  "ABNB": "Airbnb",
  "PYPL": "PayPal",
  "SQ": "Block",
  "V": "Visa",
  "MA": "Mastercard",
  "JPM": "JPMorgan Chase",
  "BAC": "Bank of America",
  "GS": "Goldman Sachs",
  "MS": "Morgan Stanley",
  "BRK-B": "Berkshire Hathaway",
  "XOM": "Exxon Mobil",
  "CVX": "Chevron",
  "LLY": "Eli Lilly",
  "NVO": "Novo Nordisk",
  "JNJ": "Johnson & Johnson",
  "PFE": "Pfizer",
  "MRNA": "Moderna",
  "UNH": "UnitedHealth",
  "CAT": "Caterpillar",
  "BA": "Boeing",
  "LMT": "Lockheed Martin",
  "TSM": "Taiwan Semiconductor",
  "ASML": "ASML",
  "MU": "Micron Technology",
  "ARM": "Arm Holdings",
  "IONQ": "IonQ",
  "RIVN": "Rivian",
  "LCID": "Lucid",
  "PG": "Procter & Gamble",
  "HD": "Home Depot",
  "TGT": "Target",
  "RBLX": "Roblox",
  "SHOP": "Shopify",
  "SPOT": "Spotify",
  "DASH": "DoorDash",
  "PINS": "Pinterest",
  "SNAP": "Snap",
  "CRWD": "CrowdStrike",
  "PANW": "Palo Alto Networks",
  "NOW": "ServiceNow",
  "SNOW": "Snowflake",
  "DDOG": "Datadog",
  "ZM": "Zoom",
  "ABBV": "AbbVie",
  "ABT": "Abbott",
  "MRK": "Merck",
  "AMGN": "Amgen",
  "GILD": "Gilead Sciences",
  "MDT": "Medtronic",
  "QQQ": "Invesco QQQ",
  "SCHD": "Schwab US Dividend Equity ETF",
  "SPY": "SPDR S&P 500 ETF",
  "TLT": "iShares 20+ Year Treasury Bond ETF",
  "005380.KS": "현대차",
  "000660.KS": "SK하이닉스",
  "006800.KS": "미래에셋증권",
  "005930.KS": "삼성전자",
  "279530.KS": "KODEX 고배당주",
  "210780.KS": "TIGER 코스피고배당",
  "161510.KS": "ARIRANG 고배당주",
  "068270.KS": "셀트리온",
  "373220.KS": "LG에너지솔루션",
  "035420.KS": "NAVER",
  "035720.KS": "카카오",
  "000270.KS": "기아",
  "005490.KS": "POSCO홀딩스",
  "105560.KS": "KB금융",
  "055550.KS": "신한지주",
  "207940.KS": "삼성바이오로직스",
  "051910.KS": "LG화학",
  "006400.KS": "삼성SDI",
  "012330.KS": "현대모비스"
};

function normalizeSymbol(rawSymbol) {
  const symbol = String(rawSymbol || "UNKNOWN").trim();
  const key = symbol.toLowerCase().replace(/\s+/g, " ");

  if (koreaSymbols[key]) {
    const [ticker, name] = koreaSymbols[key];
    return { ticker, name };
  }

  let ticker = symbol.toUpperCase();
  if (/^\d{6}$/.test(ticker)) {
    ticker = `${ticker}.KS`;
  }

  return { ticker, name: koreaTickerNames[ticker] || symbol };
}

function parseHoldings(text) {
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

function holdingsToText(holdings) {
  return holdings
    .filter((holding) => holding.ticker || holding.name)
    .map((holding) => {
      const symbol = holding.ticker || holding.name;
      const weight = Number(holding.weight) || 0;
      return `${symbol}, ${weight}%, ${holding.theme || ""}`.trimEnd();
    })
    .join("\n");
}

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
