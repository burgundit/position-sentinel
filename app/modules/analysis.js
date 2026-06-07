import { clamp, countMatches } from "./utils.js";

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

export function getNewsScore(news) {
  return countMatches(news, positiveWords) - countMatches(news, negativeWords);
}

export function getConcentrationPenalty(holdings, risk) {
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

export function getSectorAdjustment(theme, macroScore) {
  const lowerTheme = theme.toLowerCase();
  const sensitivity = Object.entries(sectorSensitivity).reduce((score, [key, value]) => {
    return lowerTheme.includes(key) ? score + value : score;
  }, 0);

  return Math.round((macroScore * sensitivity) / 3);
}

export function getPositionProfile(holding) {
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

export function getStyleAdjustment(holding, risk, news, signals) {
  const profile = getPositionProfile(holding);
  const riskMultiplier = 0.8 + risk * 0.12;
  let rawScore = profile.base +
    profile.rate * -signals.rate +
    profile.cycle * signals.growth +
    profile.market * signals.market;

  const severeNegative = countMatches(news, severeNegativeWords);
  if (severeNegative && speculativeTickers.has(holding.ticker)) {
    rawScore -= Math.min(2, severeNegative);
  }

  return {
    score: Math.round(rawScore * riskMultiplier),
    profile: { labels: profile.labels, rawScore: Number(rawScore.toFixed(2)) }
  };
}

export function getDecision(score) {
  if (score >= 5) return { label: "1년 롱 유지", className: "good" };
  if (score >= 1) return { label: "1년 조건부 유지", className: "warn" };
  return { label: "1년 기준 축소 검토", className: "bad" };
}
