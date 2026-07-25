ALTER TABLE disclosures
  ADD COLUMN IF NOT EXISTS type_category text;

CREATE INDEX IF NOT EXISTS idx_disclosures_type_category_filed
  ON disclosures (type_category, filed_at DESC);

UPDATE disclosures
SET type_category = 'dart:' || upper(payload->'rawPayload'->>'pblntf_ty')
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND upper(COALESCE(payload->'rawPayload'->>'pblntf_ty', '')) IN ('A', 'B', 'C', 'D', 'E', 'I');

UPDATE disclosures
SET type_category = 'sec:' || upper(split_part(COALESCE(form_type, ''), '/', 1))
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'sec'
  AND upper(split_part(COALESCE(form_type, ''), '/', 1)) IN ('8-K', '10-Q', '10-K', '6-K', '20-F', 'S-1');

UPDATE disclosures
SET type_category = 'dart:B'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') LIKE '%주요사항%';

UPDATE disclosures
SET type_category = 'dart:C'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') ~ '발행|증권신고|공모|채권';

UPDATE disclosures
SET type_category = 'dart:D'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') ~ '지분|주식|대량보유|공개매수|소유상황|임원|주요주주';

UPDATE disclosures
SET type_category = 'dart:I'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') ~ '거래소|코스피|코스닥';

UPDATE disclosures
SET type_category = 'dart:A'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') ~ '사업보고|반기보고|분기보고|감사보고|연결감사';

UPDATE disclosures
SET type_category = 'dart:E'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart'
  AND COALESCE(form_type, '') ~ '기타|자율공시|경영사항';

UPDATE disclosures
SET type_category = 'dart:other'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'dart';

UPDATE disclosures
SET type_category = 'sec:other'
WHERE type_category IS NULL
  AND lower(COALESCE(provider, '')) = 'sec';

UPDATE disclosures
SET type_category = COALESCE(payload->>'typeCategory', type_category)
WHERE type_category IS NULL
  AND COALESCE(payload->>'typeCategory', '') <> '';
