-- Fix korea_screener_universe venues (kospi|kosdaq) for Yahoo .KS/.KQ resolution.
-- Wrong default (all kospi → .KS) caused kosdaq quote misses and eternal null metrics.

WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "key": "korea_screener_universe",
    "displayName": "국내 스크리너 유니버스",
    "description": "스크리너 공용 풀(코스피·코스닥 venue 명시). Yahoo .KS/.KQ 매핑용. 정식 KRX 시총 피드 전 임시.",
    "symbols": [
      "005930",
      "000660",
      "373220",
      "207940",
      "005380",
      "000270",
      "068270",
      "105560",
      "005490",
      "035420",
      "006400",
      "051910",
      "028260",
      "012330",
      "055550",
      "066570",
      "003670",
      "096770",
      "032830",
      "034730",
      "003550",
      "017670",
      "030200",
      "086790",
      "009150",
      "010130",
      "011200",
      "259960",
      "035720",
      "000810",
      "402340",
      "034020",
      "329180",
      "012450",
      "035760",
      "036570",
      "039490",
      "000100",
      "128940",
      "214320",
      "247540",
      "086520",
      "196170",
      "141080",
      "028300",
      "068760",
      "403870",
      "214150",
      "357780",
      "039030",
      "145020",
      "240810",
      "277810",
      "310210",
      "214370",
      "293490",
      "263750",
      "112040",
      "035900",
      "041510",
      "122870",
      "067160",
      "058470",
      "084370",
      "095340",
      "064760",
      "222080",
      "348370",
      "253450",
      "067310",
      "053800",
      "086900",
      "215000",
      "328130",
      "462870",
      "950130",
      "060250",
      "078340",
      "036930",
      "048410"
    ],
    "venues": {
      "105560": "kospi",
      "112040": "kosdaq",
      "122870": "kosdaq",
      "128940": "kospi",
      "141080": "kosdaq",
      "145020": "kosdaq",
      "196170": "kosdaq",
      "207940": "kospi",
      "214150": "kosdaq",
      "214320": "kospi",
      "214370": "kosdaq",
      "215000": "kosdaq",
      "222080": "kosdaq",
      "240810": "kosdaq",
      "247540": "kosdaq",
      "253450": "kosdaq",
      "259960": "kospi",
      "263750": "kosdaq",
      "277810": "kosdaq",
      "293490": "kosdaq",
      "310210": "kosdaq",
      "328130": "kosdaq",
      "329180": "kospi",
      "348370": "kosdaq",
      "357780": "kosdaq",
      "373220": "kospi",
      "402340": "kospi",
      "403870": "kosdaq",
      "462870": "kosdaq",
      "950130": "kosdaq",
      "005930": "kospi",
      "000660": "kospi",
      "005380": "kospi",
      "000270": "kospi",
      "068270": "kospi",
      "005490": "kospi",
      "035420": "kospi",
      "006400": "kospi",
      "051910": "kospi",
      "028260": "kospi",
      "012330": "kospi",
      "055550": "kospi",
      "066570": "kospi",
      "003670": "kospi",
      "096770": "kospi",
      "032830": "kospi",
      "034730": "kospi",
      "003550": "kospi",
      "017670": "kospi",
      "030200": "kospi",
      "086790": "kospi",
      "009150": "kospi",
      "010130": "kospi",
      "011200": "kospi",
      "035720": "kospi",
      "000810": "kospi",
      "034020": "kospi",
      "012450": "kospi",
      "035760": "kospi",
      "036570": "kospi",
      "039490": "kospi",
      "000100": "kospi",
      "086520": "kosdaq",
      "028300": "kosdaq",
      "068760": "kosdaq",
      "039030": "kosdaq",
      "035900": "kosdaq",
      "041510": "kosdaq",
      "067160": "kosdaq",
      "058470": "kosdaq",
      "084370": "kosdaq",
      "095340": "kosdaq",
      "064760": "kosdaq",
      "067310": "kosdaq",
      "053800": "kosdaq",
      "086900": "kosdaq",
      "060250": "kosdaq",
      "078340": "kosdaq",
      "036930": "kosdaq",
      "048410": "kosdaq"
    },
    "entries": [
      {
        "symbol": "005930",
        "venue": "kospi"
      },
      {
        "symbol": "000660",
        "venue": "kospi"
      },
      {
        "symbol": "373220",
        "venue": "kospi"
      },
      {
        "symbol": "207940",
        "venue": "kospi"
      },
      {
        "symbol": "005380",
        "venue": "kospi"
      },
      {
        "symbol": "000270",
        "venue": "kospi"
      },
      {
        "symbol": "068270",
        "venue": "kospi"
      },
      {
        "symbol": "105560",
        "venue": "kospi"
      },
      {
        "symbol": "005490",
        "venue": "kospi"
      },
      {
        "symbol": "035420",
        "venue": "kospi"
      },
      {
        "symbol": "006400",
        "venue": "kospi"
      },
      {
        "symbol": "051910",
        "venue": "kospi"
      },
      {
        "symbol": "028260",
        "venue": "kospi"
      },
      {
        "symbol": "012330",
        "venue": "kospi"
      },
      {
        "symbol": "055550",
        "venue": "kospi"
      },
      {
        "symbol": "066570",
        "venue": "kospi"
      },
      {
        "symbol": "003670",
        "venue": "kospi"
      },
      {
        "symbol": "096770",
        "venue": "kospi"
      },
      {
        "symbol": "032830",
        "venue": "kospi"
      },
      {
        "symbol": "034730",
        "venue": "kospi"
      },
      {
        "symbol": "003550",
        "venue": "kospi"
      },
      {
        "symbol": "017670",
        "venue": "kospi"
      },
      {
        "symbol": "030200",
        "venue": "kospi"
      },
      {
        "symbol": "086790",
        "venue": "kospi"
      },
      {
        "symbol": "009150",
        "venue": "kospi"
      },
      {
        "symbol": "010130",
        "venue": "kospi"
      },
      {
        "symbol": "011200",
        "venue": "kospi"
      },
      {
        "symbol": "259960",
        "venue": "kospi"
      },
      {
        "symbol": "035720",
        "venue": "kospi"
      },
      {
        "symbol": "000810",
        "venue": "kospi"
      },
      {
        "symbol": "402340",
        "venue": "kospi"
      },
      {
        "symbol": "034020",
        "venue": "kospi"
      },
      {
        "symbol": "329180",
        "venue": "kospi"
      },
      {
        "symbol": "012450",
        "venue": "kospi"
      },
      {
        "symbol": "035760",
        "venue": "kospi"
      },
      {
        "symbol": "036570",
        "venue": "kospi"
      },
      {
        "symbol": "039490",
        "venue": "kospi"
      },
      {
        "symbol": "000100",
        "venue": "kospi"
      },
      {
        "symbol": "128940",
        "venue": "kospi"
      },
      {
        "symbol": "214320",
        "venue": "kospi"
      },
      {
        "symbol": "247540",
        "venue": "kosdaq"
      },
      {
        "symbol": "086520",
        "venue": "kosdaq"
      },
      {
        "symbol": "196170",
        "venue": "kosdaq"
      },
      {
        "symbol": "141080",
        "venue": "kosdaq"
      },
      {
        "symbol": "028300",
        "venue": "kosdaq"
      },
      {
        "symbol": "068760",
        "venue": "kosdaq"
      },
      {
        "symbol": "403870",
        "venue": "kosdaq"
      },
      {
        "symbol": "214150",
        "venue": "kosdaq"
      },
      {
        "symbol": "357780",
        "venue": "kosdaq"
      },
      {
        "symbol": "039030",
        "venue": "kosdaq"
      },
      {
        "symbol": "145020",
        "venue": "kosdaq"
      },
      {
        "symbol": "240810",
        "venue": "kosdaq"
      },
      {
        "symbol": "277810",
        "venue": "kosdaq"
      },
      {
        "symbol": "310210",
        "venue": "kosdaq"
      },
      {
        "symbol": "214370",
        "venue": "kosdaq"
      },
      {
        "symbol": "293490",
        "venue": "kosdaq"
      },
      {
        "symbol": "263750",
        "venue": "kosdaq"
      },
      {
        "symbol": "112040",
        "venue": "kosdaq"
      },
      {
        "symbol": "035900",
        "venue": "kosdaq"
      },
      {
        "symbol": "041510",
        "venue": "kosdaq"
      },
      {
        "symbol": "122870",
        "venue": "kosdaq"
      },
      {
        "symbol": "067160",
        "venue": "kosdaq"
      },
      {
        "symbol": "058470",
        "venue": "kosdaq"
      },
      {
        "symbol": "084370",
        "venue": "kosdaq"
      },
      {
        "symbol": "095340",
        "venue": "kosdaq"
      },
      {
        "symbol": "064760",
        "venue": "kosdaq"
      },
      {
        "symbol": "222080",
        "venue": "kosdaq"
      },
      {
        "symbol": "348370",
        "venue": "kosdaq"
      },
      {
        "symbol": "253450",
        "venue": "kosdaq"
      },
      {
        "symbol": "067310",
        "venue": "kosdaq"
      },
      {
        "symbol": "053800",
        "venue": "kosdaq"
      },
      {
        "symbol": "086900",
        "venue": "kosdaq"
      },
      {
        "symbol": "215000",
        "venue": "kosdaq"
      },
      {
        "symbol": "328130",
        "venue": "kosdaq"
      },
      {
        "symbol": "462870",
        "venue": "kosdaq"
      },
      {
        "symbol": "950130",
        "venue": "kosdaq"
      },
      {
        "symbol": "060250",
        "venue": "kosdaq"
      },
      {
        "symbol": "078340",
        "venue": "kosdaq"
      },
      {
        "symbol": "036930",
        "venue": "kosdaq"
      },
      {
        "symbol": "048410",
        "venue": "kosdaq"
      }
    ],
    "updatedAt": "2026-07-26T03:00:00.000Z"
  }
]
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO market_lists (list_key, position, payload, updated_at)
SELECT
  payload->>'key',
  100 + position - 1,
  payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows
ON CONFLICT (list_key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;
