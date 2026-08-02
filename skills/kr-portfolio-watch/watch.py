#!/usr/bin/env python3
"""
보유종목 공시 트리거 분류기 — 사양서 §8.1 즉시매도 규칙

Signal 서버의 KR 공시 피드를 보유종목과 대조해 심각도를 분류한다.
판단이 갈리는 항목(유상증자 목적 등)은 NEEDS_CHECK 로 넘겨 Claude가 원문을 확인한다.

    python3 watch.py [--holdings holdings.json] [--limit 300] [--hours 24]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.request

BASE = "https://signalapp.up.railway.app"

# ── 사양서 §8.1 매핑 ────────────────────────────────────────────
# (심각도, 패턴, 사유)
RULES = [
    # SELL — 규칙상 즉시 전량매도
    ("SELL", r"관리종목|투자주의환기|상장적격성", "F01 재해당 — 관리종목/투자주의환기"),
    ("SELL", r"감사보고서.*(한정|부적정|의견거절)|의견거절|부적정의견", "F02 재해당 — 감사의견 비적정"),
    ("SELL", r"자본잠식|자본전액잠식", "F04 재해당 — 자본잠식"),
    ("SELL", r"횡령|배임", "지배구조 — 횡령·배임 발생"),

    # NEEDS_CHECK — 원문 확인 후 판정 (조건부 매도)
    ("NEEDS_CHECK", r"유상증자결정", "유상증자 — 자금용도 확인 필요(시설투자면 보유 유지)"),
    ("NEEDS_CHECK", r"최대주주.*변동|최대주주등소유주식변동", "최대주주 지분변동 — 5%p 이상 매도면 전량매도"),
    ("NEEDS_CHECK", r"주식등의대량보유상황보고서", "대량보유 변동 — 감소 방향이면 검토"),

    # REVIEW — 분기 리밸런싱까지 관찰, 추가매수 금지
    ("REVIEW", r"전환사채|신주인수권부사채|교환사채", "F06 잠재희석 증가"),
    ("REVIEW", r"불성실공시법인", "공시 신뢰성 훼손"),
    ("REVIEW", r"소송|가처분|파산|회생절차", "법적 리스크"),
    ("REVIEW", r"영업정지|생산중단|리콜", "본업 훼손 가능성"),

    # POSITIVE — 주주환원, 논리 강화
    ("POSITIVE", r"자기주식취득|주식소각", "주주환원 — 밸류 팩터 강화"),
    ("POSITIVE", r"자기주식처분", "주주환원 역행 — 다만 오버행 아님"),
]

SEVERITY_ORDER = {"SELL": 0, "NEEDS_CHECK": 1, "REVIEW": 2, "POSITIVE": 3, "INFO": 4}


def fetch_disclosures(limit: int = 300) -> list[dict]:
    out, offset = [], 0
    while len(out) < limit:
        url = f"{BASE}/v1/disclosures?market=kr&limit=100&offset={offset}"
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.load(r)
        rows = d.get("data", [])
        out.extend(rows)
        if not d.get("meta", {}).get("hasMore") or not rows:
            break
        offset += 100
    return out[:limit]


def classify(text: str) -> tuple[str, str]:
    for sev, pat, reason in RULES:
        if re.search(pat, text):
            return sev, reason
    return "INFO", "정보성 공시"


def run(holdings_path: str, limit: int, hours: int) -> dict:
    holdings = json.load(open(holdings_path, encoding="utf-8"))
    by_symbol = {h["ticker"]: h for h in holdings["positions"]}

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
    rows = fetch_disclosures(limit)

    hits, universe_alerts = [], []
    for r in rows:
        try:
            filed = dt.datetime.fromisoformat((r.get("filedAt") or "").replace("Z", "+00:00"))
        except ValueError:
            filed = None
        if filed and filed < cutoff:
            continue

        text = f"{r.get('formType') or ''} {r.get('title') or ''} {r.get('summary') or ''}"
        sev, reason = classify(text)
        sym = r.get("symbol")

        item = {
            "severity": sev, "reason": reason, "ticker": sym,
            "company": r.get("companyName"), "formType": r.get("formType"),
            "filedAt": r.get("filedAt"), "url": r.get("url"), "id": r.get("id"),
        }
        if sym in by_symbol:
            item["weight"] = by_symbol[sym].get("weight")
            item["thesis_breakers"] = by_symbol[sym].get("thesis_breakers", [])
            hits.append(item)
        elif sev in ("SELL", "NEEDS_CHECK"):
            universe_alerts.append(item)   # 미보유지만 후보군일 수 있음

    hits.sort(key=lambda x: (SEVERITY_ORDER[x["severity"]], -(x.get("weight") or 0)))
    return {
        "asof": dt.datetime.now(dt.timezone.utc).isoformat(),
        "window_hours": hours,
        "scanned": len(rows),
        "holdings_count": len(by_symbol),
        "holdings_hits": hits,
        "universe_alerts": universe_alerts[:15],
        "action_required": [h for h in hits if h["severity"] in ("SELL", "NEEDS_CHECK")],
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--holdings", default="holdings.json")
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--hours", type=int, default=24)
    a = p.parse_args()
    json.dump(run(a.holdings, a.limit, a.hours), sys.stdout, ensure_ascii=False, indent=2)
    print()
