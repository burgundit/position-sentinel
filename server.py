from __future__ import annotations

import json
import mimetypes
import re
import time
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app"
DATA_DIR = ROOT / "data"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"
HOST = "127.0.0.1"
PORT = 8000
MARKET_CACHE: dict[str, tuple[float, dict]] = {}
MARKET_CACHE_SECONDS = 300
MARKET_MAX_WORKERS = 6
NEWS_CACHE: dict[str, tuple[float, list[dict]]] = {}
NEWS_CACHE_SECONDS = 600
NEWS_PER_TICKER = 3
NEWS_DESCRIPTION_LIMIT = 220
SYMBOL_SEARCH_CACHE: dict[str, tuple[float, tuple[str, str]]] = {}
SYMBOL_SEARCH_CACHE_SECONDS = 86400

POSITIVE_WORDS = [
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
    "실적",
]

NEGATIVE_WORDS = [
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
    "금지",
]

SECTOR_SENSITIVITY = {
    "반도체": 1.0,
    "ai": 1.0,
    "소프트웨어": 0.8,
    "클라우드": 0.8,
    "전기차": 1.1,
    "바이오": 1.2,
    "은행": -0.2,
    "에너지": 0.3,
    "방산": 0.2,
    "소비재": 0.1,
}

PROFILE_RULES = [
    {
        "label": "고성장/고밸류",
        "keywords": [
            "ai",
            "반도체",
            "소프트웨어",
            "클라우드",
            "전기차",
            "양자",
            "growth",
            "PLTR",
            "NVDA",
            "TSLA",
            "IONQ",
            "RIVN",
            "LCID",
            "SMCI",
            "SNOW",
            "DDOG",
        ],
        "rate": -1.0,
        "cycle": 0.8,
        "market": 0.7,
        "base": -0.4,
    },
    {
        "label": "방어/배당",
        "keywords": [
            "배당",
            "방어",
            "필수소비",
            "헬스케어",
            "SCHD",
            "PG",
            "KO",
            "PEP",
            "WMT",
            "JNJ",
            "UNH",
            "LLY",
            "MRK",
        ],
        "rate": -0.3,
        "cycle": -0.2,
        "market": -0.4,
        "base": 0.7,
    },
    {
        "label": "경기민감",
        "keywords": ["자동차", "산업재", "소비재", "에너지", "은행", "CAT", "BA", "XOM", "CVX", "JPM", "BAC", "GS"],
        "rate": -0.4,
        "cycle": 0.9,
        "market": 0.4,
        "base": 0.0,
    },
    {
        "label": "장기채/금리민감",
        "keywords": ["채권", "미국채", "TLT"],
        "rate": -1.2,
        "cycle": -0.2,
        "market": -0.2,
        "base": 0.0,
    },
]

SPECULATIVE_TICKERS = {"IONQ", "RIVN", "LCID", "SMCI", "SNOW", "DDOG", "RBLX", "SNAP", "PLTR"}
QUALITY_TICKERS = {"AAPL", "MSFT", "NVDA", "AVGO", "GOOGL", "META", "COST", "LLY", "UNH", "BRK-B", "ASML", "TSM"}
DEFENSIVE_TICKERS = {"PG", "KO", "PEP", "WMT", "COST", "JNJ", "UNH", "LLY", "MRK", "SCHD"}
SEVERE_NEGATIVE_WORDS = ["lawsuit", "probe", "ban", "recall", "downgrade", "소송", "조사", "금지", "리콜", "하향"]

KOREA_SYMBOLS = {
    "apple": ("AAPL", "Apple"),
    "애플": ("AAPL", "Apple"),
    "tesla": ("TSLA", "Tesla"),
    "테슬라": ("TSLA", "Tesla"),
    "nvidia": ("NVDA", "NVIDIA"),
    "엔비디아": ("NVDA", "NVIDIA"),
    "novavax": ("NVAX", "Novavax"),
    "노바벡스": ("NVAX", "Novavax"),
    "노바백스": ("NVAX", "Novavax"),
    "microsoft": ("MSFT", "Microsoft"),
    "마이크로소프트": ("MSFT", "Microsoft"),
    "google": ("GOOGL", "Alphabet"),
    "구글": ("GOOGL", "Alphabet"),
    "alphabet": ("GOOGL", "Alphabet"),
    "알파벳": ("GOOGL", "Alphabet"),
    "amazon": ("AMZN", "Amazon"),
    "아마존": ("AMZN", "Amazon"),
    "meta": ("META", "Meta"),
    "메타": ("META", "Meta"),
    "netflix": ("NFLX", "Netflix"),
    "넷플릭스": ("NFLX", "Netflix"),
    "amd": ("AMD", "AMD"),
    "에이엠디": ("AMD", "AMD"),
    "브로드컴": ("AVGO", "Broadcom"),
    "팔란티어": ("PLTR", "Palantir"),
    "팔란티어 테크": ("PLTR", "Palantir"),
    "슈퍼마이크로": ("SMCI", "Super Micro Computer"),
    "슈마컴": ("SMCI", "Super Micro Computer"),
    "인텔": ("INTC", "Intel"),
    "퀄컴": ("QCOM", "Qualcomm"),
    "오라클": ("ORCL", "Oracle"),
    "어도비": ("ADBE", "Adobe"),
    "세일즈포스": ("CRM", "Salesforce"),
    "코스트코": ("COST", "Costco"),
    "월마트": ("WMT", "Walmart"),
    "코카콜라": ("KO", "Coca-Cola"),
    "펩시": ("PEP", "PepsiCo"),
    "맥도날드": ("MCD", "McDonald's"),
    "스타벅스": ("SBUX", "Starbucks"),
    "나이키": ("NKE", "Nike"),
    "디즈니": ("DIS", "Disney"),
    "우버": ("UBER", "Uber"),
    "에어비앤비": ("ABNB", "Airbnb"),
    "페이팔": ("PYPL", "PayPal"),
    "블록": ("SQ", "Block"),
    "스퀘어": ("SQ", "Block"),
    "비자": ("V", "Visa"),
    "마스터카드": ("MA", "Mastercard"),
    "제이피모건": ("JPM", "JPMorgan Chase"),
    "JP모건": ("JPM", "JPMorgan Chase"),
    "뱅크오브아메리카": ("BAC", "Bank of America"),
    "보아": ("BAC", "Bank of America"),
    "골드만삭스": ("GS", "Goldman Sachs"),
    "모건스탠리": ("MS", "Morgan Stanley"),
    "버크셔": ("BRK-B", "Berkshire Hathaway"),
    "버크셔해서웨이": ("BRK-B", "Berkshire Hathaway"),
    "엑슨모빌": ("XOM", "Exxon Mobil"),
    "쉐브론": ("CVX", "Chevron"),
    "일라이릴리": ("LLY", "Eli Lilly"),
    "릴리": ("LLY", "Eli Lilly"),
    "노보노디스크": ("NVO", "Novo Nordisk"),
    "존슨앤존슨": ("JNJ", "Johnson & Johnson"),
    "화이자": ("PFE", "Pfizer"),
    "모더나": ("MRNA", "Moderna"),
    "유나이티드헬스": ("UNH", "UnitedHealth"),
    "유나이티드 헬스": ("UNH", "UnitedHealth"),
    "캐터필러": ("CAT", "Caterpillar"),
    "보잉": ("BA", "Boeing"),
    "록히드마틴": ("LMT", "Lockheed Martin"),
    "록히드 마틴": ("LMT", "Lockheed Martin"),
    "tsmc": ("TSM", "Taiwan Semiconductor"),
    "티에스엠씨": ("TSM", "Taiwan Semiconductor"),
    "대만반도체": ("TSM", "Taiwan Semiconductor"),
    "타이완반도체": ("TSM", "Taiwan Semiconductor"),
    "asml": ("ASML", "ASML"),
    "에이에스엠엘": ("ASML", "ASML"),
    "마이크론": ("MU", "Micron Technology"),
    "arm": ("ARM", "Arm Holdings"),
    "암홀딩스": ("ARM", "Arm Holdings"),
    "아이온큐": ("IONQ", "IonQ"),
    "리비안": ("RIVN", "Rivian"),
    "루시드": ("LCID", "Lucid"),
    "프로터앤갬블": ("PG", "Procter & Gamble"),
    "피앤지": ("PG", "Procter & Gamble"),
    "홈디포": ("HD", "Home Depot"),
    "타겟": ("TGT", "Target"),
    "로블록스": ("RBLX", "Roblox"),
    "쇼피파이": ("SHOP", "Shopify"),
    "스포티파이": ("SPOT", "Spotify"),
    "도어대시": ("DASH", "DoorDash"),
    "핀터레스트": ("PINS", "Pinterest"),
    "스냅": ("SNAP", "Snap"),
    "크라우드스트라이크": ("CRWD", "CrowdStrike"),
    "팔로알토": ("PANW", "Palo Alto Networks"),
    "서비스나우": ("NOW", "ServiceNow"),
    "스노우플레이크": ("SNOW", "Snowflake"),
    "데이터독": ("DDOG", "Datadog"),
    "줌": ("ZM", "Zoom"),
    "애브비": ("ABBV", "AbbVie"),
    "애보트": ("ABT", "Abbott"),
    "머크": ("MRK", "Merck"),
    "암젠": ("AMGN", "Amgen"),
    "길리어드": ("GILD", "Gilead Sciences"),
    "메드트로닉": ("MDT", "Medtronic"),
    "qqq": ("QQQ", "Invesco QQQ"),
    "나스닥 etf": ("QQQ", "Invesco QQQ"),
    "슈드": ("SCHD", "Schwab US Dividend Equity ETF"),
    "schd": ("SCHD", "Schwab US Dividend Equity ETF"),
    "미국배당 etf": ("SCHD", "Schwab US Dividend Equity ETF"),
    "spy": ("SPY", "SPDR S&P 500 ETF"),
    "s&p500 etf": ("SPY", "SPDR S&P 500 ETF"),
    "미국채 etf": ("TLT", "iShares 20+ Year Treasury Bond ETF"),
    "tlt": ("TLT", "iShares 20+ Year Treasury Bond ETF"),
    "현대차": ("005380.KS", "현대차"),
    "현대자동차": ("005380.KS", "현대차"),
    "sk하이닉스": ("000660.KS", "SK하이닉스"),
    "하이닉스": ("000660.KS", "SK하이닉스"),
    "미래에셋증권": ("006800.KS", "미래에셋증권"),
    "미래에셋 증권": ("006800.KS", "미래에셋증권"),
    "삼성전자": ("005930.KS", "삼성전자"),
    "삼전": ("005930.KS", "삼성전자"),
    "kodex 고배당주": ("279530.KS", "KODEX 고배당주"),
    "kodex고배당주": ("279530.KS", "KODEX 고배당주"),
    "고배당주 etf": ("279530.KS", "KODEX 고배당주"),
    "고배당 etf": ("279530.KS", "KODEX 고배당주"),
    "tiger 코스피고배당": ("210780.KS", "TIGER 코스피고배당"),
    "arirang 고배당주": ("161510.KS", "ARIRANG 고배당주"),
    "셀트리온": ("068270.KS", "셀트리온"),
    "lg에너지솔루션": ("373220.KS", "LG에너지솔루션"),
    "lg 엔솔": ("373220.KS", "LG에너지솔루션"),
    "엘지에너지솔루션": ("373220.KS", "LG에너지솔루션"),
    "naver": ("035420.KS", "NAVER"),
    "네이버": ("035420.KS", "NAVER"),
    "카카오": ("035720.KS", "카카오"),
    "기아": ("000270.KS", "기아"),
    "기아차": ("000270.KS", "기아"),
    "posco홀딩스": ("005490.KS", "POSCO홀딩스"),
    "포스코홀딩스": ("005490.KS", "POSCO홀딩스"),
    "kb금융": ("105560.KS", "KB금융"),
    "신한지주": ("055550.KS", "신한지주"),
    "삼성바이오로직스": ("207940.KS", "삼성바이오로직스"),
    "삼바": ("207940.KS", "삼성바이오로직스"),
    "lg화학": ("051910.KS", "LG화학"),
    "엘지화학": ("051910.KS", "LG화학"),
    "삼성sdi": ("006400.KS", "삼성SDI"),
    "현대모비스": ("012330.KS", "현대모비스"),
}

KOREA_TICKER_NAMES = {
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
    "012330.KS": "현대모비스",
}


def looks_like_symbol(value: str) -> bool:
    return bool(re.fullmatch(r"[\^A-Za-z0-9][A-Za-z0-9.\-^=]{0,14}", value.strip()))


def search_yahoo_symbol(query: str) -> tuple[str, str] | None:
    key = query.strip().lower()
    now = time.time()
    cached = SYMBOL_SEARCH_CACHE.get(key)
    if cached and now - cached[0] < SYMBOL_SEARCH_CACHE_SECONDS:
        return cached[1]

    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={quote(query)}&quotesCount=8&newsCount=0"
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    quotes = [
        quote_item
        for quote_item in payload.get("quotes", [])
        if quote_item.get("symbol") and quote_item.get("quoteType") in {"EQUITY", "ETF", "INDEX"}
    ]
    if not quotes:
        return None

    preferred_exchanges = {"NMS": 0, "NGM": 0, "NYQ": 0, "PCX": 1, "KSC": 1, "KOE": 1}
    quotes.sort(key=lambda item: preferred_exchanges.get(item.get("exchange"), 5))
    best = quotes[0]
    symbol = best["symbol"].upper()
    name = best.get("shortname") or best.get("longname") or query
    result = (symbol, name)
    SYMBOL_SEARCH_CACHE[key] = (now, result)
    return result


def normalize_symbol(raw_symbol: str) -> tuple[str, str]:
    symbol = raw_symbol.strip()
    key = re.sub(r"\s+", " ", symbol.lower())
    if key in KOREA_SYMBOLS:
        return KOREA_SYMBOLS[key]

    upper_symbol = symbol.upper()
    if re.fullmatch(r"\d{6}", upper_symbol):
        upper_symbol = f"{upper_symbol}.KS"

    if upper_symbol in KOREA_TICKER_NAMES or (symbol == upper_symbol and looks_like_symbol(symbol)):
        return upper_symbol, KOREA_TICKER_NAMES.get(upper_symbol, symbol)

    try:
        found = search_yahoo_symbol(symbol)
        if found:
            return found
    except Exception:
        pass

    return upper_symbol, KOREA_TICKER_NAMES.get(upper_symbol, symbol)


def parse_holdings(text: str) -> list[dict]:
    holdings = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        parts = [part.strip() for part in line.split(",")]
        ticker, name = normalize_symbol(parts[0] if parts else "UNKNOWN")
        weight_text = parts[1] if len(parts) > 1 else "0"
        weight_match = re.sub(r"[^0-9.]", "", weight_text)
        weight = float(weight_match) if weight_match else 0
        theme = parts[2].lower() if len(parts) > 2 else ""
        holdings.append({"ticker": ticker, "name": name, "weight": weight, "theme": theme})
    nonzero_weight_sum = sum(holding["weight"] for holding in holdings)
    if holdings and nonzero_weight_sum == 0:
        equal_weight = round(100 / len(holdings), 2)
        for holding in holdings:
            holding["weight"] = equal_weight
    return holdings


def count_matches(text: str, words: list[str]) -> int:
    lower = text.lower()
    return sum(len(re.findall(re.escape(word.lower()), lower)) for word in words)


def get_decision(score: int) -> dict:
    if score >= 5:
        return {"label": "롱 유지", "className": "good"}
    if score >= 1:
        return {"label": "조건부 유지", "className": "warn"}
    return {"label": "축소 검토", "className": "bad"}


def get_sector_adjustment(theme: str, macro_score: int) -> int:
    sensitivity = sum(value for key, value in SECTOR_SENSITIVITY.items() if key in theme)
    return round((macro_score * sensitivity) / 3)


def get_position_profile(holding: dict) -> dict:
    text = f"{holding.get('ticker', '')} {holding.get('name', '')} {holding.get('theme', '')}".lower()
    matched = []
    rate = 0.0
    cycle = 0.0
    market = 0.0
    base = 0.0

    for rule in PROFILE_RULES:
        if any(keyword.lower() in text for keyword in rule["keywords"]):
            matched.append(rule["label"])
            rate += float(rule["rate"])
            cycle += float(rule["cycle"])
            market += float(rule["market"])
            base += float(rule["base"])

    ticker = holding.get("ticker", "")
    if ticker in SPECULATIVE_TICKERS:
        matched.append("변동성 큼")
        base -= 0.8
        market += 0.4
    if ticker in QUALITY_TICKERS:
        matched.append("우량 대형")
        base += 0.7
    if ticker in DEFENSIVE_TICKERS:
        matched.append("방어성")
        base += 0.4

    return {
        "labels": list(dict.fromkeys(matched)) or ["일반"],
        "rate": max(-2.0, min(1.0, rate)),
        "cycle": max(-1.0, min(1.5, cycle)),
        "market": max(-1.0, min(1.5, market)),
        "base": max(-2.0, min(2.0, base)),
    }


def get_style_adjustment(holding: dict, payload: dict, risk: int, news: str) -> tuple[int, dict]:
    profile = get_position_profile(holding)
    rate_signal = int(payload.get("rateSignal", 0))
    growth_signal = int(payload.get("growthSignal", 0))
    market_signal = int(payload.get("marketTrend", 0))
    risk_multiplier = 0.8 + (risk * 0.12)

    raw_score = (
        profile["base"]
        + profile["rate"] * (-rate_signal)
        + profile["cycle"] * growth_signal
        + profile["market"] * market_signal
    )
    severe_negative = count_matches(news, SEVERE_NEGATIVE_WORDS)
    if severe_negative and holding.get("ticker") in SPECULATIVE_TICKERS:
        raw_score -= min(2, severe_negative)

    score = round(raw_score * risk_multiplier)
    return score, {"labels": profile["labels"], "rawScore": round(raw_score, 2)}


def get_concentration_penalty(holdings: list[dict], risk: int) -> float:
    largest = max([holding["weight"] for holding in holdings], default=0)
    overweight_penalty = -3 if largest > 45 else -2 if largest > 35 else -1 if largest > 25 else 0

    sector_weights: dict[str, float] = {}
    for holding in holdings:
        key = (holding["theme"].split("/")[0] or "unknown").strip()
        sector_weights[key] = sector_weights.get(key, 0) + holding["weight"]

    max_sector = max(sector_weights.values(), default=0)
    sector_penalty = -2 if max_sector > 60 else -1 if max_sector > 45 else 0
    return (overweight_penalty + sector_penalty) * (risk / 3)


def format_signed(value: float) -> str:
    rounded = round(value)
    return f"+{rounded}" if rounded > 0 else str(rounded)


def build_checklist(total_score: int, news_score: int, concentration_penalty: float, risk: int) -> list[str]:
    items = []
    if total_score < 1:
        items.append("롱 유지 근거가 약합니다. 신규 매수보다 손절선, 헤지, 비중 축소 기준을 먼저 확인하세요.")
    else:
        items.append("롱 유지가 가능하더라도 다음 실적 발표와 주요 지표 발표 전후 변동성 계획을 세우세요.")

    if news_score < 0:
        items.append("부정 뉴스가 우세합니다. 일회성 이슈인지, 이익 전망 훼손인지 분리해서 보세요.")

    if concentration_penalty < -1:
        items.append("집중 리스크가 큽니다. 같은 테마가 동시에 흔들릴 때의 최대 손실을 계산하세요.")

    if risk >= 4:
        items.append("리스크 민감도가 높게 설정되어 있습니다. 보수적 기준에서는 부분 익절/축소 신호가 더 빨리 나옵니다.")

    if total_score >= 1 and news_score <= 0:
        items.append("점수는 유지권이지만 뉴스 모멘텀이 강하지 않습니다. 추세가 꺾이면 유지 기준을 다시 낮추세요.")

    return items


def fetch_yahoo_market_data(ticker: str) -> dict:
    now = time.time()
    cached = MARKET_CACHE.get(ticker)
    if cached and now - cached[0] < MARKET_CACHE_SECONDS:
        return cached[1]

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(ticker)}?range=3mo&interval=1d"
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    result = payload["chart"]["result"][0]
    meta = result["meta"]
    quote_data = result["indicators"]["quote"][0]
    closes = [price for price in quote_data.get("close", []) if price is not None]
    previous_close = meta.get("chartPreviousClose")
    current_price = meta.get("regularMarketPrice") or (closes[-1] if closes else None)

    change = None
    change_percent = None
    if current_price is not None and previous_close:
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100

    ma20 = sum(closes[-20:]) / min(len(closes), 20) if closes else None
    trend = "데이터 부족"
    trend_score = 0
    if current_price is not None and ma20:
        if current_price >= ma20 * 1.03:
            trend = "상승 추세"
            trend_score = 2
        elif current_price <= ma20 * 0.97:
            trend = "하락 추세"
            trend_score = -2
        else:
            trend = "중립 추세"

    market_data = {
        "price": round(current_price, 2) if current_price is not None else None,
        "change": round(change, 2) if change is not None else None,
        "changePercent": round(change_percent, 2) if change_percent is not None else None,
        "ma20": round(ma20, 2) if ma20 is not None else None,
        "trend": trend,
        "trendScore": trend_score,
        "currency": meta.get("currency", ""),
        "source": "Yahoo Finance",
    }
    MARKET_CACHE[ticker] = (now, market_data)
    return market_data


def get_market_data(ticker: str, enabled: bool) -> dict:
    if not enabled:
        return {"status": "disabled", "trendScore": 0}

    try:
        return {"status": "ok", **fetch_yahoo_market_data(ticker)}
    except Exception as exc:
        return {
            "status": "unavailable",
            "trendScore": 0,
            "message": str(exc),
        }


def get_market_data_map(holdings: list[dict], enabled: bool) -> dict[str, dict]:
    tickers = sorted({holding["ticker"] for holding in holdings if holding.get("ticker")})
    if not tickers:
        return {}

    if not enabled:
        return {ticker: {"status": "disabled", "trendScore": 0} for ticker in tickers}

    market_data: dict[str, dict] = {}
    worker_count = min(MARKET_MAX_WORKERS, len(tickers))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {executor.submit(get_market_data, ticker, True): ticker for ticker in tickers}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                market_data[ticker] = future.result()
            except Exception as exc:
                market_data[ticker] = {
                    "status": "unavailable",
                    "trendScore": 0,
                    "message": str(exc),
                }
    return market_data


def score_from_trend(market: dict, positive_when_up: bool = True) -> int:
    trend_score = int(market.get("trendScore", 0))
    if not positive_when_up:
        trend_score *= -1
    return 2 if trend_score > 0 else -2 if trend_score < 0 else 0


def score_from_ratio(primary: dict, defensive: dict) -> int:
    primary_change = primary.get("changePercent")
    defensive_change = defensive.get("changePercent")
    if primary_change is None or defensive_change is None:
        return 0

    spread = primary_change - defensive_change
    if spread >= 1:
        return 2
    if spread <= -1:
        return -2
    return 0


def signal_label(value: int, positive: str, neutral: str, negative: str) -> str:
    if value > 0:
        return positive
    if value < 0:
        return negative
    return neutral


def build_environment_suggestion() -> dict:
    tickers = ["^TNX", "SPY", "XLY", "XLP", "TIP", "IEF"]
    market = {}
    with ThreadPoolExecutor(max_workers=min(MARKET_MAX_WORKERS, len(tickers))) as executor:
        futures = {executor.submit(get_market_data, ticker, True): ticker for ticker in tickers}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                market[ticker] = future.result()
            except Exception as exc:
                market[ticker] = {"status": "unavailable", "trendScore": 0, "message": str(exc)}

    rate_signal = score_from_trend(market.get("^TNX", {}), positive_when_up=False)
    market_signal = score_from_trend(market.get("SPY", {}), positive_when_up=True)
    growth_signal = score_from_ratio(market.get("XLY", {}), market.get("XLP", {}))
    inflation_signal = score_from_ratio(market.get("TIP", {}), market.get("IEF", {})) * -1

    return {
        "signals": {
            "rateSignal": rate_signal,
            "inflationSignal": inflation_signal,
            "growthSignal": growth_signal,
            "marketTrend": market_signal,
        },
        "labels": {
            "rateSignal": signal_label(rate_signal, "인하 기대", "중립", "인상/고금리 압박"),
            "inflationSignal": signal_label(inflation_signal, "둔화", "중립", "재가속"),
            "growthSignal": signal_label(growth_signal, "개선", "중립", "둔화"),
            "marketTrend": signal_label(market_signal, "상승", "횡보", "하락"),
        },
        "proxies": {
            "^TNX": market.get("^TNX", {}),
            "SPY": market.get("SPY", {}),
            "XLY": market.get("XLY", {}),
            "XLP": market.get("XLP", {}),
            "TIP": market.get("TIP", {}),
            "IEF": market.get("IEF", {}),
        },
        "source": "Yahoo Finance market proxies",
    }


def strip_markup(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def truncate_text(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def fetch_yahoo_news(ticker: str) -> list[dict]:
    now = time.time()
    cached = NEWS_CACHE.get(ticker)
    if cached and now - cached[0] < NEWS_CACHE_SECONDS:
        return cached[1]

    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={quote(ticker)}&region=US&lang=en-US"
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/rss+xml, application/xml, text/xml",
        },
    )

    with urlopen(request, timeout=8) as response:
        xml_text = response.read().decode("utf-8", errors="replace")

    root = ElementTree.fromstring(xml_text)
    items = []
    for item in root.findall(".//item")[:NEWS_PER_TICKER]:
        title = strip_markup(item.findtext("title", ""))
        description = truncate_text(strip_markup(item.findtext("description", "")), NEWS_DESCRIPTION_LIMIT)
        link = item.findtext("link", "").strip()
        published = item.findtext("pubDate", "").strip()
        if title:
            items.append(
                {
                    "ticker": ticker,
                    "title": title,
                    "description": description,
                    "link": link,
                    "published": published,
                    "source": "Yahoo Finance",
                }
            )

    NEWS_CACHE[ticker] = (now, items)
    return items


def get_news_for_ticker(ticker: str) -> list[dict]:
    try:
        return fetch_yahoo_news(ticker)
    except Exception as exc:
        return [
            {
                "ticker": ticker,
                "title": "뉴스 조회 실패",
                "description": str(exc),
                "link": "",
                "published": "",
                "source": "Yahoo Finance",
                "error": True,
            }
        ]


def build_news_memo(payload: dict) -> dict:
    holdings = parse_holdings(payload.get("holdings", ""))
    tickers = sorted({holding["ticker"] for holding in holdings if holding.get("ticker")})
    if not tickers:
        return {"memo": "", "items": [], "message": "보유 종목을 먼저 입력하세요."}

    items: list[dict] = []
    with ThreadPoolExecutor(max_workers=min(MARKET_MAX_WORKERS, len(tickers))) as executor:
        futures = {executor.submit(get_news_for_ticker, ticker): ticker for ticker in tickers}
        for future in as_completed(futures):
            items.extend(future.result())

    items.sort(key=lambda item: (item.get("ticker", ""), item.get("published", "")))
    lines = []
    for item in items:
        title = item.get("title", "")
        description = item.get("description", "")
        name = KOREA_TICKER_NAMES.get(item["ticker"], item["ticker"])
        label = f"{name} / {item['ticker']}"
        if item.get("error"):
            lines.append(f"[{label}] 뉴스 조회 실패: {description}")
            continue

        detail = f" - {description}" if description and description != title else ""
        lines.append(f"[{label}] {title}{detail}")

    memo = "\n".join(lines)
    return {
        "memo": memo,
        "items": items,
        "message": f"{len(tickers)}개 종목에서 뉴스 {len(items)}건을 가져왔습니다.",
        "source": "Yahoo Finance RSS",
    }


def analyze_payload(payload: dict) -> dict:
    holdings = parse_holdings(payload.get("holdings", ""))
    news = payload.get("news", "")
    risk = int(payload.get("risk", 3))
    include_market_data = bool(payload.get("includeMarketData", True))
    macro_score = sum(
        int(payload.get(key, 0))
        for key in ["rateSignal", "inflationSignal", "growthSignal", "marketTrend"]
    )
    news_score = count_matches(news, POSITIVE_WORDS) - count_matches(news, NEGATIVE_WORDS)
    concentration_penalty = get_concentration_penalty(holdings, risk)
    market_data_by_ticker = get_market_data_map(holdings, include_market_data)

    rows = []
    weighted_style_score = 0.0
    for holding in holdings:
        market = market_data_by_ticker.get(holding["ticker"], {"status": "unavailable", "trendScore": 0})
        ticker_mentions = count_matches(news, [holding["ticker"]])
        ticker_boost = min(3, ticker_mentions) if ticker_mentions else 0
        sector_adjustment = get_sector_adjustment(holding["theme"], macro_score)
        style_adjustment, profile = get_style_adjustment(holding, payload, risk, news)
        weight_penalty = -2 if holding["weight"] > 40 else -1 if holding["weight"] > 30 else 0
        trend_score = int(market.get("trendScore", 0))
        score = round(
            macro_score
            + news_score
            + sector_adjustment
            + style_adjustment
            + ticker_boost
            + weight_penalty
            + trend_score
        )
        reasons = [
            f"거시 {format_signed(macro_score)}",
            f"뉴스 {format_signed(news_score)}",
            f"섹터 민감도 {format_signed(sector_adjustment)}" if sector_adjustment else "섹터 중립",
            f"스타일 {format_signed(style_adjustment)} ({', '.join(profile['labels'])})",
            f"비중 부담 {format_signed(weight_penalty)}" if weight_penalty else "비중 안정",
            f"가격 추세 {format_signed(trend_score)}" if trend_score else "가격 추세 중립",
        ]
        weighted_style_score += style_adjustment * (holding["weight"] or 1)
        rows.append(
            {
                **holding,
                "score": score,
                "decision": get_decision(score),
                "reasons": reasons,
                "market": market,
                "profile": profile,
            }
        )

    weight_sum = sum(row["weight"] or 1 for row in rows) or 1
    average_position_score = sum(row["score"] * (row["weight"] or 1) for row in rows) / weight_sum
    style_score = round(weighted_style_score / weight_sum)
    total_score = round(average_position_score + concentration_penalty)
    portfolio_decision = get_decision(total_score)

    return {
        "summary": {
            "totalScore": total_score,
            "macroScore": macro_score,
            "newsScore": news_score,
            "styleScore": style_score,
            "concentrationPenalty": concentration_penalty,
            "portfolioDecision": portfolio_decision,
            "holdingsCount": len(holdings),
            "marketDataEnabled": include_market_data,
        },
        "rows": rows,
        "checklist": build_checklist(total_score, news_score, concentration_penalty, risk),
    }


def read_json_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def load_portfolio() -> dict:
    if not PORTFOLIO_FILE.exists():
        return {
            "holdings": "",
            "risk": 3,
            "rateSignal": 0,
            "inflationSignal": 0,
            "growthSignal": 0,
            "marketTrend": 0,
            "includeMarketData": True,
        }
    return json.loads(PORTFOLIO_FILE.read_text(encoding="utf-8"))


def save_portfolio(payload: dict) -> dict:
    DATA_DIR.mkdir(exist_ok=True)
    portfolio = {
        "holdings": payload.get("holdings", ""),
        "risk": int(payload.get("risk", 3)),
        "rateSignal": int(payload.get("rateSignal", 0)),
        "inflationSignal": int(payload.get("inflationSignal", 0)),
        "growthSignal": int(payload.get("growthSignal", 0)),
        "marketTrend": int(payload.get("marketTrend", 0)),
        "includeMarketData": bool(payload.get("includeMarketData", True)),
    }
    tmp_file = PORTFOLIO_FILE.with_suffix(".json.tmp")
    tmp_file.write_text(json.dumps(portfolio, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_file.replace(PORTFOLIO_FILE)
    return portfolio


class PositionSentinelHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = unquote(self.path.split("?", 1)[0])

        if path == "/api/portfolio":
            self.write_json(200, load_portfolio())
            return

        if path == "/api/environment":
            try:
                self.write_json(200, build_environment_suggestion())
            except Exception as exc:
                self.write_json(400, {"error": str(exc)})
            return

        if path == "/":
            path = "/index.html"

        target = (APP_DIR / path.lstrip("/")).resolve()
        if not str(target).startswith(str(APP_DIR.resolve())) or not target.exists() or not target.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        if self.path == "/api/analyze":
            try:
                payload = read_json_body(self)
                result = analyze_payload(payload)
                self.write_json(200, result)
            except Exception as exc:
                self.write_json(400, {"error": str(exc)})
            return

        if self.path == "/api/portfolio":
            try:
                portfolio = save_portfolio(read_json_body(self))
                self.write_json(200, {"saved": True, "portfolio": portfolio})
            except Exception as exc:
                self.write_json(400, {"error": str(exc)})
            return

        if self.path == "/api/news":
            try:
                self.write_json(200, build_news_memo(read_json_body(self)))
            except Exception as exc:
                self.write_json(400, {"error": str(exc)})
            return

        self.send_error(404)

    def do_PUT(self) -> None:
        if self.path != "/api/portfolio":
            self.send_error(404)
            return

        try:
            portfolio = save_portfolio(read_json_body(self))
            self.write_json(200, {"saved": True, "portfolio": portfolio})
        except Exception as exc:
            self.write_json(400, {"error": str(exc)})

    def write_json(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), PositionSentinelHandler)
    print(f"Long Position Sentinel is running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
