from __future__ import annotations

import json
import os
import re
import time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

SYMBOL_SEARCH_CACHE: dict[str, tuple[float, tuple[str, str]]] = {}
SYMBOL_SEARCH_CACHE_SECONDS = 86400
KRX_API_KEY = os.environ.get("DATA_GO_KR_API_KEY") or os.environ.get("KRX_API_KEY")
KRX_LISTED_INFO_URL = "https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo"

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
    "plus 고배당주": ("161510.KS", "PLUS 고배당주"),
    "plus고배당주": ("161510.KS", "PLUS 고배당주"),
    "플러스 고배당주": ("161510.KS", "PLUS 고배당주"),
    "플러스고배당주": ("161510.KS", "PLUS 고배당주"),
    "한화 고배당주": ("161510.KS", "PLUS 고배당주"),
    "한화 plus 고배당주": ("161510.KS", "PLUS 고배당주"),
    "arirang 고배당주": ("161510.KS", "PLUS 고배당주"),
    "arirang고배당주": ("161510.KS", "PLUS 고배당주"),
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


def korean_market_suffix(market_category: str) -> str:
    market = (market_category or "").lower()
    if "kosdaq" in market or "코스닥" in market:
        return ".KQ"
    return ".KS"


def add_symbol_result(results: list[dict], seen: set[str], result: dict) -> None:
    ticker = str(result.get("ticker", "")).upper()
    if not ticker or ticker in seen:
        return
    result["ticker"] = ticker
    results.append(result)
    seen.add(ticker)


def krx_query_variants(query: str) -> list[str]:
    variants = [query]
    compact = re.sub(r"\s+", "", query)
    if compact != query:
        variants.append(compact)
    if "plus" in query.lower() or "플러스" in query:
        variants.extend(
            [
                re.sub("plus", "ARIRANG", query, flags=re.IGNORECASE),
                query.replace("플러스", "ARIRANG"),
                compact.replace("plus", "ARIRANG").replace("PLUS", "ARIRANG").replace("플러스", "ARIRANG"),
                query.replace("PLUS", "ARIRANG"),
            ]
        )
    return list(dict.fromkeys(variant for variant in variants if variant.strip()))


def search_krx_symbols(query: str) -> tuple[list[dict], str | None]:
    if not re.search(r"[가-힣]|\d{2,}", query):
        return [], None

    if not KRX_API_KEY:
        return [], "KRX API 키 미설정"

    service_key = KRX_API_KEY if "%" in KRX_API_KEY else quote(KRX_API_KEY, safe="")
    results = []
    seen = set()
    for variant in krx_query_variants(query):
        params = {
            "numOfRows": 10,
            "pageNo": 1,
            "resultType": "json",
        }
        if re.fullmatch(r"\d{2,6}", variant):
            params["likeSrtnCd"] = variant
        else:
            params["likeItmsNm"] = variant

        url = f"{KRX_LISTED_INFO_URL}?serviceKey={service_key}&{urlencode(params)}"
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
        )

        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))

        body = payload.get("response", {}).get("body", {})
        raw_items = body.get("items", {}).get("item", [])
        if isinstance(raw_items, dict):
            raw_items = [raw_items]

        for item in raw_items:
            short_code = str(item.get("srtnCd", "")).strip()
            short_code = re.sub(r"^[A-Za-z]", "", short_code)
            name = str(item.get("itmsNm", "")).strip()
            market = str(item.get("mrktCtg", "")).strip()
            if not short_code or not name or short_code in seen:
                continue
            seen.add(short_code)
            ticker = f"{short_code}{korean_market_suffix(market)}"
            results.append(
                {
                    "ticker": ticker,
                    "name": name,
                    "exchange": market,
                    "source": "KRX 공공데이터",
                }
            )
            if len(results) >= 8:
                return results, None
    return results, None


def search_symbols(query: str) -> dict:
    normalized_query = re.sub(r"\s+", " ", query.strip())
    if len(normalized_query) < 2:
        return {"query": query, "results": [], "message": "두 글자 이상 입력하세요."}

    results: list[dict] = []
    seen: set[str] = set()
    key = normalized_query.lower()
    source_notes = []

    krx_results, krx_note = search_krx_symbols(normalized_query)
    if krx_note:
        source_notes.append(krx_note)
    for result in krx_results:
        add_symbol_result(results, seen, result)

    for alias, (ticker, name) in KOREA_SYMBOLS.items():
        if key in alias.lower() or key in name.lower() or key in ticker.lower():
            add_symbol_result(results, seen, {"ticker": ticker, "name": name, "source": "내장 별칭"})

    try:
        url = f"https://query1.finance.yahoo.com/v1/finance/search?q={quote(normalized_query)}&quotesCount=10&newsCount=0"
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
        )
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))

        preferred_exchanges = {"NMS": 0, "NGM": 0, "NYQ": 0, "PCX": 1, "KSC": 1, "KOE": 1}
        quotes = [
            item
            for item in payload.get("quotes", [])
            if item.get("symbol") and item.get("quoteType") in {"EQUITY", "ETF", "INDEX"}
        ]
        quotes.sort(key=lambda item: preferred_exchanges.get(item.get("exchange"), 5))

        for item in quotes:
            ticker = str(item["symbol"]).upper()
            name = item.get("shortname") or item.get("longname") or ticker
            exchange = item.get("exchDisp") or item.get("exchange") or ""
            add_symbol_result(
                results,
                seen,
                {"ticker": ticker, "name": name, "exchange": exchange, "source": "Yahoo Finance"},
            )
            if len(results) >= 8:
                break
    except Exception:
        pass

    if not results:
        try:
            ticker, name = normalize_symbol(normalized_query)
            add_symbol_result(results, seen, {"ticker": ticker, "name": name, "source": "입력값 변환"})
        except Exception:
            pass

    message = f"{len(results[:8])}개 후보를 찾았습니다."
    if source_notes:
        message += f" ({', '.join(source_notes)})"
    return {"query": query, "results": results[:8], "message": message, "krxEnabled": bool(KRX_API_KEY)}


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
