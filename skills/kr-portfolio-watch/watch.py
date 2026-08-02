#!/usr/bin/env python3
"""kr-portfolio-watch 1단계 스캐너.

Signal 서버의 국내(KR/DART) 공시 피드를 **읽기 전용으로** 조회해 보유종목에 걸린
공시를 매도 트리거 심각도로 분류한다. 서버에 아무것도 쓰지 않는다.

출력은 stdout JSON 하나. 판정(2단계)과 브리핑(3단계)은 SKILL.md가 맡는다.
이 스크립트는 사실만 넘긴다 — 결론을 내지 않는다.

    python3 watch.py --hours 24
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

DEFAULT_BASE_URL = "https://signalapp.up.railway.app"
PAGE_SIZE = 100          # 서버 public API 상한
MAX_ROWS = 300           # 롤링 윈도우가 그 이상 쌓이지 않는다
REQUEST_TIMEOUT = 15
RETRIES = 3
KST = timezone(timedelta(hours=9))

SEVERITY_ORDER = {"SELL": 0, "NEEDS_CHECK": 1, "REVIEW": 2, "POSITIVE": 3, "INFO": 4}
ACTION_SEVERITIES = ("SELL", "NEEDS_CHECK")

# NEEDS_CHECK 판정 기준 — SKILL.md 2단계 표와 1:1로 대응한다.
# 여기 없는 트리거를 NEEDS_CHECK로 올리면 브리핑에 판정 기준을 못 붙인다.
NEEDS_CHECK_CRITERIA = {
    "유상증자결정": {
        "sell_when": "자금용도가 운영자금·채무상환",
        "hold_when": "시설투자·M&A 목적이고 희석률 10% 미만",
    },
    "최대주주 지분변동": {
        "sell_when": "장내매도로 5%p 이상 감소",
        "hold_when": "상속·증여·담보설정, 또는 지분 증가",
    },
    "대량보유상황보고": {
        "sell_when": "최대주주측 보유비율 감소",
        "hold_when": "기관·외국인의 단순 변동 (보고자 확인)",
    },
}

# 먼저 걸리는 규칙이 이긴다. 순서가 곧 우선순위다.
# (severity, trigger, pattern) — pattern은 공백 제거한 보고서명에 대해 검사한다.
RULES: list[tuple[str, str, str]] = [
    # --- 오탐 차단: 아래 SELL 패턴의 부분문자열을 갖는 무해한 보고서명 ---
    ("INFO", "정보성", r"(매매거래정지해제|영업정지해제|관리종목지정해제|거래정지사유해소)"),

    # --- SELL: 하드필터 재해당 / 지배구조 사고. 재량 없음 ---
    ("SELL", "감사의견 비적정", r"(의견거절|부적정의견|한정의견|감사의견.{0,6}(거절|부적정|한정))"),
    ("SELL", "자본잠식", r"자본잠식"),
    ("SELL", "횡령·배임", r"(횡령|배임)"),
    ("SELL", "회생·파산·부도", r"(회생절차|파산신청|파산선고|부도발생|당좌거래정지|채권은행.{0,6}관리절차|워크아웃)"),
    ("SELL", "상장폐지", r"상장폐지"),
    ("SELL", "관리종목 지정", r"관리종목"),
    ("SELL", "매매거래정지", r"(매매거래정지|거래정지)"),
    ("SELL", "주된 영업정지", r"(주된영업정지|영업정지)"),
    ("SELL", "불성실공시법인 지정", r"불성실공시법인지정(?!예고)"),

    # --- NEEDS_CHECK: 조건부. 반드시 NEEDS_CHECK_CRITERIA에 키가 있어야 한다 ---
    ("NEEDS_CHECK", "유상증자결정", r"유상증자"),
    ("NEEDS_CHECK", "최대주주 지분변동",
     r"(최대주주변경|최대주주등.{0,10}(소유주식|주식보유)|임원.{0,3}주요주주특정증권등소유상황보고서)"),
    ("NEEDS_CHECK", "대량보유상황보고", r"주식등의대량보유상황보고서"),

    # --- POSITIVE: 주주환원. 기록만 ---
    ("POSITIVE", "자기주식 취득", r"자기주식취득"),
    ("POSITIVE", "자기주식 소각", r"(자기주식소각|주식소각결정)"),
    ("POSITIVE", "배당 결정", r"(현금.{0,3}현물배당결정|배당결정)"),
    ("POSITIVE", "무상증자 결정", r"무상증자"),

    # --- REVIEW: 분기 리밸런싱까지 관찰. 추가매수만 금지 ---
    ("REVIEW", "불성실공시법인 지정예고", r"불성실공시법인지정예고"),
    ("REVIEW", "메자닌 발행", r"(전환사채권발행결정|신주인수권부사채권발행결정|교환사채권발행결정)"),
    ("REVIEW", "감자 결정", r"(감자결정|자본감소)"),
    ("REVIEW", "자기주식 처분", r"자기주식처분"),
    ("REVIEW", "손익구조 변동", r"(매출액또는손익구조|손익구조.{0,6}변동)"),
    ("REVIEW", "합병·분할·주식교환", r"(합병결정|분할결정|분할합병|주식교환.{0,4}이전)"),
    ("REVIEW", "영업 양수도", r"영업.{0,2}(양수|양도)"),
    ("REVIEW", "타법인 주식 취득·처분", r"타법인주식.{0,12}(취득|처분)"),
    ("REVIEW", "유형자산 취득·처분", r"유형자산.{0,6}(취득|처분)"),
    ("REVIEW", "채무보증·자금대여", r"(채무보증|금전대여|담보제공)"),
    ("REVIEW", "특수관계인 거래", r"특수관계인"),
    ("REVIEW", "소송", r"소송"),
    ("REVIEW", "공급계약 해지·변경", r"단일판매.{0,12}(해지|변경|중도)"),
    ("REVIEW", "조회공시 요구", r"(조회공시|풍문.{0,4}보도)"),
    ("REVIEW", "주식매수선택권 부여", r"주식매수선택권"),
]

# 보고서명 앞에 붙는 DART 접두 태그. 판정에서만 떼어내고 원문 제목은 그대로 보고한다.
PREFIX_TAG = re.compile(r"^(\[[^\]]{1,20}\]\s*)+")


def clean(value) -> str:
    return str(value or "").strip()


def normalize_symbol(value) -> str:
    """국내 종목코드는 6자리 숫자. 005930.KS / A005930 같은 표기도 받아준다."""
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) >= 6:
        return digits[:6]
    return ""


def match_text(row: dict) -> str:
    """규칙 매칭용 정규화 문자열: 접두 태그 제거 + 공백/구분자 제거."""
    raw = f"{clean(row.get('formType'))} {clean(row.get('title'))}"
    raw = PREFIX_TAG.sub("", raw)
    return re.sub(r"[\s·ㆍ・,()\[\]]", "", raw)


def classify(row: dict) -> tuple[str, str]:
    text = match_text(row)
    for severity, trigger, pattern in RULES:
        if re.search(pattern, text):
            return severity, trigger
    return "INFO", "정보성"


def parse_iso(value: str):
    raw = clean(value)
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def recency_ts(filed_at: str):
    """DART 접수일은 날짜 단위(KST 자정)로 들어온다.

    자정 그대로 비교하면 '오늘 접수'가 하루 지난 것처럼 밀려나므로,
    시각이 KST 자정인 행은 그날 마감(23:59:59 KST)으로 보정해 비교한다.
    """
    parsed = parse_iso(filed_at)
    if parsed is None:
        return None
    kst = parsed.astimezone(KST)
    if (kst.hour, kst.minute, kst.second) == (0, 0, 0):
        return kst.replace(hour=23, minute=59, second=59)
    return kst


def fetch_page(base_url: str, limit: int, offset: int) -> dict:
    query = urllib.parse.urlencode({"market": "kr", "limit": limit, "offset": offset})
    url = f"{base_url.rstrip('/')}/v1/disclosures?{query}"
    last_error = None
    for attempt in range(RETRIES):
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8", errors="replace"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
            last_error = error
            if attempt < RETRIES - 1:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"{url} 조회 실패: {last_error}")


def fetch_disclosures(base_url: str, max_rows: int) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while len(rows) < max_rows:
        page = fetch_page(base_url, min(PAGE_SIZE, max_rows - len(rows)), offset)
        batch = page.get("data") or []
        rows.extend(batch)
        meta = page.get("meta") or {}
        if not batch or not meta.get("hasMore"):
            break
        offset = meta.get("nextOffset") or (offset + len(batch))
    return rows


def load_holdings(path: str) -> tuple[dict, list[str], str]:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    raw = payload.get("holdings") if isinstance(payload, dict) else payload
    if not isinstance(raw, list):
        raise ValueError("holdings.json: 최상위에 holdings 배열이 필요합니다")

    holdings: dict[str, dict] = {}
    for entry in raw:
        symbol = normalize_symbol(entry.get("symbol") or entry.get("code"))
        if not symbol:
            continue
        breakers = entry.get("thesis_breakers") or []
        holdings[symbol] = {
            "symbol": symbol,
            "name": clean(entry.get("name")) or symbol,
            "weight": entry.get("weight"),
            "thesis_breakers": [clean(b) for b in breakers if clean(b)],
        }

    watchlist = [s for s in (normalize_symbol(v) for v in (payload.get("watchlist") or [])) if s]
    updated = clean(payload.get("updated")) if isinstance(payload, dict) else ""
    return holdings, watchlist, updated


def build_hit(row: dict, severity: str, trigger: str, holding: dict | None) -> dict:
    hit = {
        "severity": severity,
        "trigger": trigger,
        "symbol": normalize_symbol(row.get("symbol")),
        "name": clean(row.get("companyName")) or (holding or {}).get("name") or "",
        "form_type": clean(row.get("formType")),
        "title": clean(row.get("title")),
        "filed_at": clean(row.get("filedAt")),
        "url": clean(row.get("url")),
        "disclosure_id": clean(row.get("id")),
    }
    if holding:
        hit["name"] = holding["name"] or hit["name"]
        hit["weight"] = holding.get("weight")
        hit["thesis_breakers"] = holding["thesis_breakers"]
    if severity == "NEEDS_CHECK":
        hit.update(NEEDS_CHECK_CRITERIA.get(trigger, {}))
    return hit


def sort_key(hit: dict):
    return (SEVERITY_ORDER.get(hit["severity"], 9), hit.get("filed_at") or "")


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description="보유 국내종목 공시 트리거 스캔 (읽기 전용)")
    parser.add_argument("--hours", type=float, default=24, help="조회 윈도우 (기본 24시간)")
    parser.add_argument("--holdings", default=os.path.join(here, "holdings.json"))
    parser.add_argument("--base-url", default=os.environ.get("SIGNAL_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--max-rows", type=int, default=MAX_ROWS)
    args = parser.parse_args()

    try:
        holdings, watchlist, holdings_updated = load_holdings(args.holdings)
    except FileNotFoundError:
        json.dump({
            "ok": False,
            "error": "HOLDINGS_NOT_FOUND",
            "detail": f"{args.holdings} 없음. holdings.example.json을 복사해 채우십시오.",
        }, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return 2
    except (ValueError, json.JSONDecodeError) as error:
        json.dump({
            "ok": False,
            "error": "HOLDINGS_INVALID",
            "detail": str(error),
        }, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return 2

    try:
        rows = fetch_disclosures(args.base_url, args.max_rows)
    except RuntimeError as error:
        json.dump({
            "ok": False,
            "error": "FEED_UNAVAILABLE",
            "detail": str(error),
        }, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return 3

    cutoff = datetime.now(KST) - timedelta(hours=args.hours)
    watchlist_set = set(watchlist)

    holdings_hits: list[dict] = []
    universe_alerts: list[dict] = []
    in_window = 0

    for row in rows:
        stamp = recency_ts(row.get("filedAt"))
        if stamp is not None and stamp < cutoff:
            continue
        in_window += 1

        symbol = normalize_symbol(row.get("symbol"))
        severity, trigger = classify(row)
        holding = holdings.get(symbol)

        if holding:
            holdings_hits.append(build_hit(row, severity, trigger, holding))
        elif severity in ACTION_SEVERITIES:
            if watchlist_set and symbol not in watchlist_set:
                continue
            universe_alerts.append(build_hit(row, severity, trigger, None))

    holdings_hits.sort(key=sort_key)
    universe_alerts.sort(key=sort_key)

    result = {
        "ok": True,
        "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "window_hours": args.hours,
        "source": args.base_url.rstrip("/") + "/v1/disclosures?market=kr",
        "scanned": len(rows),
        "in_window": in_window,
        "holdings_count": len(holdings),
        "holdings_updated": holdings_updated,
        "holdings_without_thesis_breakers": sorted(
            h["symbol"] for h in holdings.values() if not h["thesis_breakers"]
        ),
        "holdings_hits": holdings_hits,
        "action_required": [h for h in holdings_hits if h["severity"] in ACTION_SEVERITIES],
        "universe_alerts": universe_alerts[:20],
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
