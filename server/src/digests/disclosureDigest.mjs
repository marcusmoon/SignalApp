import crypto from 'node:crypto';

// 중요도 높은 공시 유형 (8-K: 중요 이벤트, 6-K: 외국 기업 중요 이벤트)
const HIGH_IMPORTANCE_FORMS = new Set(['8-K', '6-K', '주요사항보고서', '공정공시', '조회공시']);
const MID_IMPORTANCE_FORMS = new Set(['10-K', '10-Q', '20-F', '사업보고서', '반기보고서', '분기보고서']);

function clean(value) {
  return String(value || '').trim();
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function itemMs(item) {
  const ms = new Date(item?.filedAt || item?.publishedAt || item?.fetchedAt || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function itemDate(item) {
  const ms = itemMs(item);
  return ms > 0 ? new Date(ms).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function isRecent(item, minMs) {
  const ms = itemMs(item);
  return ms > 0 && ms >= minMs;
}

function marketOf(item) {
  const market = clean(item?.market).toLowerCase();
  if (market === 'kr') return 'kr';
  return 'us';
}

function formType(item) {
  return clean(item?.formType || item?.payload?.formType);
}

function companyName(item) {
  return clean(item?.companyName || item?.payload?.companyName || item?.symbol || '');
}

function symbol(item) {
  return clean(item?.symbol || item?.payload?.symbol || '').toUpperCase();
}

function provider(item) {
  return clean(item?.provider || 'sec').toLowerCase();
}

function itemTitle(item) {
  return clean(item?.title || item?.payload?.title || '');
}

function itemSummary(item) {
  return clean(item?.summary || item?.payload?.summary || '');
}

function sourceUrl(item) {
  return clean(item?.url || item?.payload?.url || item?.payload?.sourceUrl || '');
}

// 그룹 키: 같은 회사/심볼의 공시를 묶음
function groupKey(item) {
  const sym = symbol(item);
  if (sym) return `sym:${sym}`;
  const co = companyName(item).toLowerCase().replace(/[^a-z0-9가-힣]/g, ' ').replace(/\s+/g, ' ').trim();
  if (co) return `co:${co.slice(0, 40)}`;
  return `form:${formType(item)}`;
}

function formImportance(item) {
  const form = formType(item).toUpperCase();
  if (HIGH_IMPORTANCE_FORMS.has(form)) return 2;
  if (MID_IMPORTANCE_FORMS.has(form)) return 1;
  // 한국 공시 중요 키워드
  if (/주요|중요|공정|조회|긴급|속보/.test(form)) return 2;
  return 0;
}

function sourceRef(item) {
  return {
    type: 'disclosure',
    id: item.id,
    title: itemTitle(item),
    url: sourceUrl(item) || null,
    companyName: companyName(item),
    symbol: symbol(item) || null,
    formType: formType(item) || null,
    filedAt: item.filedAt || item.publishedAt || null,
  };
}

function uniqueDisclosures(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${groupKey(item)}:${itemMs(item)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateDisclosureDigestItems(db = {}, params = {}) {
  const hoursBack = Math.max(1, Math.min(168, Number(params.hoursBack) || 24));
  const sourceLimit = Math.max(20, Math.min(1000, Number(params.sourceLimit) || 300));
  const maxItemsPerMarket = Math.max(1, Math.min(20, Number(params.maxItemsPerMarket) || 8));
  const markets = new Set(
    (Array.isArray(params.markets) && params.markets.length > 0 ? params.markets : ['us', 'kr'])
      .map((m) => clean(m).toLowerCase())
      .filter(Boolean),
  );

  const generatedAt = new Date().toISOString();
  const generatedDate = generatedAt.slice(0, 10);
  const minMs = Date.now() - hoursBack * 60 * 60 * 1000;

  const rows = Array.isArray(db.disclosureItems) ? db.disclosureItems : [];

  // 최신순 정렬 후 sourceLimit개만 사용
  const recent = rows
    .filter((row) => row?.id && isRecent(row, minMs))
    .sort((a, b) => itemMs(b) - itemMs(a))
    .slice(0, sourceLimit);

  // market + groupKey 로 그룹화
  const groups = new Map();
  for (const item of recent) {
    const market = marketOf(item);
    if (!markets.has(market)) continue;
    const key = `${market}:${groupKey(item)}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const byMarket = new Map();
  for (const [key, group] of groups.entries()) {
    const sorted = uniqueDisclosures([...group].sort((a, b) => itemMs(b) - itemMs(a)));
    if (sorted.length === 0) continue;
    const primary = sorted[0];
    const market = marketOf(primary);

    const symbols = [...new Set(sorted.map(symbol).filter(Boolean))].slice(0, 6);
    const forms = [...new Set(sorted.map(formType).filter(Boolean))].slice(0, 4);
    const companies = [...new Set(sorted.map(companyName).filter(Boolean))].slice(0, 4);
    const providers = [...new Set(sorted.map(provider).filter(Boolean))].slice(0, 3);

    const maxImportance = Math.max(...sorted.map(formImportance));
    const importanceBonus = maxImportance === 2 ? 30 : maxImportance === 1 ? 12 : 0;
    const volumeBonus = Math.min(30, sorted.length * 10);
    const ageHours = Math.max(0, (Date.now() - itemMs(primary)) / 3_600_000);
    const recencyBonus = Math.max(0, 50 - Math.floor(ageHours * 3));
    const score = importanceBonus + volumeBonus + recencyBonus;

    // 제목: 가장 중요한 공시 회사명 + 유형
    const primaryForm = formType(primary);
    const primaryCompany = companyName(primary) || symbols[0] || '—';
    const title = primaryForm
      ? `${primaryCompany} · ${primaryForm}`
      : primaryCompany;

    const summary = [
      sorted.length > 1 ? `${sorted.length}건` : null,
      providers.map((p) => p.toUpperCase()).join('/'),
      forms.filter((f) => f !== primaryForm).slice(0, 2).join(', ') || null,
    ]
      .filter(Boolean)
      .join(' · ');

    const digestId = `disclosure-digest:${generatedDate}:${hash(key)}`;
    const digestItem = {
      id: digestId,
      market,
      title,
      summary,
      symbols,
      companies,
      forms,
      count: sorted.length,
      score,
      generatedDate,
      generatedAt,
      primaryDisclosureId: primary.id,
      primaryFiledAt: primary.filedAt || primary.publishedAt || null,
      groupKey: key,
      sourceRefs: sorted.slice(0, 8).map(sourceRef),
      updatedAt: generatedAt,
    };

    const bucket = byMarket.get(market) || [];
    bucket.push(digestItem);
    byMarket.set(market, bucket);
  }

  return [...byMarket.values()]
    .flatMap((items) =>
      items
        .sort((a, b) => b.score - a.score || String(b.primaryFiledAt || '').localeCompare(String(a.primaryFiledAt || '')))
        .slice(0, maxItemsPerMarket),
    )
    .sort((a, b) => String(a.market).localeCompare(String(b.market)) || b.score - a.score);
}
