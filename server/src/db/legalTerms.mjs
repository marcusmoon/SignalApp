import crypto from 'node:crypto';
import { nowIso } from './time.mjs';

export const LEGAL_TERM_TYPES = ['service', 'privacy'];
export const LEGAL_TERM_LOCALES = ['ko', 'en', 'ja'];

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeLocale(value) {
  const locale = cleanText(value).toLowerCase();
  return LEGAL_TERM_LOCALES.includes(locale) ? locale : 'ko';
}

function normalizeType(value) {
  const type = cleanText(value).toLowerCase();
  return LEGAL_TERM_TYPES.includes(type) ? type : 'service';
}

function cleanVersion(value) {
  return cleanText(value) || nowIso().slice(0, 10).replaceAll('-', '.');
}

function termId(type, locale, version) {
  return `${normalizeType(type)}:${normalizeLocale(locale)}:${cleanVersion(version)}`;
}

export function defaultLegalTerms() {
  const updatedAt = nowIso();
  return [
    {
      type: 'service',
      locale: 'ko',
      version: '2026.05.07',
      title: '서비스 이용약관',
      body:
        'SIGNAL은 뉴스, 시세, 캘린더, 유튜브, 오늘의 시그널 등 투자 판단에 참고할 수 있는 정보를 제공하는 서비스입니다. 제공되는 정보는 투자 권유나 매매 지시가 아니며, 최종 투자 판단과 그 결과에 대한 책임은 사용자 본인에게 있습니다.\n\n사용자는 서비스 이용 시 관계 법령과 본 약관을 준수해야 하며, 다른 사용자의 이용을 방해하거나 서비스의 정상 운영을 저해하는 행위를 해서는 안 됩니다. 회사는 서비스 안정성, 보안, 품질 개선을 위해 일부 기능을 변경하거나 제한할 수 있습니다.\n\nSIGNAL의 콘텐츠와 화면 구성, 데이터 가공 결과는 서비스 제공 목적 범위에서 이용할 수 있습니다. 무단 복제, 재배포, 상업적 재사용은 제한될 수 있습니다. 외부 뉴스, 시세, 영상 등 원 제공자의 권리는 각 제공자에게 있습니다.\n\n서비스는 네트워크, 외부 provider, 거래소/시장 일정, 데이터 지연 등의 영향으로 일부 정보가 지연되거나 누락될 수 있습니다. 중요한 투자 결정 전에는 반드시 원문과 공식 공시, 거래 플랫폼의 최신 정보를 함께 확인해야 합니다.',
      required: true,
      active: true,
      updatedAt,
    },
    {
      type: 'privacy',
      locale: 'ko',
      version: '2026.05.07',
      title: '개인정보처리방침',
      body:
        'SIGNAL은 계정 생성과 서비스 제공을 위해 이메일, 비밀번호 해시, 닉네임, 프로필 이미지 URL, 로그인 세션, 기기/푸시 토큰, 관심종목, 알림 설정, 알림 수신 이력 등 필요한 정보를 처리할 수 있습니다.\n\n수집한 정보는 계정 식별, 로그인 유지, 관심종목 기반 브리핑 제공, 알림 및 푸시 발송, 서비스 품질 개선, 장애 대응과 보안 관리를 위해 사용됩니다. 비밀번호는 원문으로 저장하지 않고 해시 형태로 저장합니다.\n\n사용자는 언제든지 내정보 화면에서 로그아웃하거나 계정 탈퇴를 요청할 수 있습니다. 탈퇴 시 계정은 비활성화되고 세션과 기기 푸시 대상은 해제됩니다. 법령 준수, 분쟁 대응, 서비스 보안을 위해 필요한 최소 기록은 일정 기간 보관될 수 있습니다.\n\nSIGNAL은 서비스 운영에 필요한 범위에서 외부 인프라와 provider를 사용할 수 있으며, 관련 처리는 보안과 접근 권한 통제 기준에 따라 관리합니다. 본 방침은 서비스 구조와 법령 변경에 따라 업데이트될 수 있습니다.',
      required: true,
      active: true,
      updatedAt,
    },
    {
      type: 'service',
      locale: 'en',
      version: '2026.05.07',
      title: 'Terms of Service',
      body:
        'SIGNAL provides news, quotes, calendars, YouTube items, Today’s Signal, and other market information for reference. The information is not investment advice, solicitation, or trading instruction. Final investment decisions and outcomes remain the user’s responsibility.\n\nUsers must comply with applicable laws and these terms, and must not interfere with other users or normal service operation. SIGNAL may change or limit parts of the service to improve stability, security, and quality.\n\nSIGNAL content, screen structures, and processed data may be used only within the intended service experience. Unauthorized copying, redistribution, or commercial reuse may be restricted. Rights to third-party news, quotes, videos, and source materials remain with their respective providers.\n\nInformation may be delayed or incomplete because of networks, external providers, market schedules, or data latency. Before making important investment decisions, users should verify original sources, official filings, and their trading platform’s latest information.',
      required: true,
      active: true,
      updatedAt,
    },
    {
      type: 'privacy',
      locale: 'en',
      version: '2026.05.07',
      title: 'Privacy Policy',
      body:
        'SIGNAL may process information needed to create accounts and provide the service, including email, password hashes, nickname, profile image URL, login sessions, device and push tokens, watchlists, notification settings, and notification history.\n\nThis information is used for account identification, session maintenance, watchlist-based briefings, notifications and push delivery, service quality improvement, troubleshooting, and security. Passwords are not stored in plain text and are kept as hashes.\n\nUsers may log out or request account deletion from My info at any time. When an account is deleted, it is deactivated and its sessions and device push targets are disabled. Minimal records may be retained when required for legal compliance, dispute handling, or service security.\n\nSIGNAL may use external infrastructure and providers as needed to operate the service, and manages related processing with security and access-control practices. This policy may be updated as the service structure or applicable laws change.',
      required: true,
      active: true,
      updatedAt,
    },
    {
      type: 'service',
      locale: 'ja',
      version: '2026.05.07',
      title: 'サービス利用規約',
      body:
        'SIGNAL はニュース、相場、カレンダー、YouTube、今日のシグナルなど、投資判断の参考となる情報を提供するサービスです。提供情報は投資助言、勧誘、売買指示ではなく、最終的な投資判断とその結果はユーザー本人の責任です。\n\nユーザーは法令と本規約を遵守し、他のユーザーの利用やサービスの正常運営を妨げてはなりません。SIGNAL は安定性、セキュリティ、品質向上のため、一部機能を変更または制限する場合があります。\n\nSIGNAL のコンテンツ、画面構成、加工データはサービス利用目的の範囲で利用できます。無断複製、再配布、商用再利用は制限される場合があります。外部ニュース、相場、動画などの権利は各提供元に帰属します。\n\nネットワーク、外部 provider、市場日程、データ遅延などにより、情報が遅延または欠落することがあります。重要な投資判断の前には、必ず原文、公式開示、取引プラットフォームの最新情報を確認してください。',
      required: true,
      active: true,
      updatedAt,
    },
    {
      type: 'privacy',
      locale: 'ja',
      version: '2026.05.07',
      title: 'プライバシーポリシー',
      body:
        'SIGNAL はアカウント作成とサービス提供のため、メールアドレス、パスワードハッシュ、ニックネーム、プロフィール画像 URL、ログインセッション、端末・プッシュトークン、ウォッチリスト、通知設定、通知履歴など必要な情報を処理する場合があります。\n\nこれらの情報はアカウント識別、ログイン維持、ウォッチリスト基準のブリーフィング、通知・プッシュ配信、サービス品質改善、障害対応、セキュリティ管理のために使用されます。パスワードは平文で保存せず、ハッシュ形式で保存します。\n\nユーザーはいつでもマイ情報画面からログアウトまたは退会をリクエストできます。退会時、アカウントは無効化され、セッションと端末プッシュ対象は解除されます。法令遵守、紛争対応、サービスセキュリティのため、必要最小限の記録を一定期間保管する場合があります。\n\nSIGNAL はサービス運営に必要な範囲で外部インフラや provider を利用することがあり、関連処理はセキュリティとアクセス制御基準に従って管理します。本ポリシーはサービス構造や法令変更に応じて更新される場合があります。',
      required: true,
      active: true,
      updatedAt,
    },
  ];
}

function publicTerm(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    locale: row.locale,
    version: row.version,
    title: row.title,
    body: row.body,
    required: Number(row.required) === 1,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function seedLegalTermsInDb(db) {
  const count = Number(db.prepare('SELECT COUNT(*) AS count FROM legal_terms').get()?.count) || 0;
  if (count > 0) return;
  const insert = db.prepare(`
    INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(type, locale, version) DO NOTHING
  `);
  for (const term of defaultLegalTerms()) {
    insert.run(
      termId(term.type, term.locale, term.version),
      term.type,
      term.locale,
      term.version,
      term.title,
      term.body,
      term.required ? 1 : 0,
      term.active ? 1 : 0,
      term.updatedAt,
      term.updatedAt,
    );
  }
}

export function listLegalTermsInDb(db, { locale = '', activeOnly = false, latestOnly = false, type = '' } = {}) {
  seedLegalTermsInDb(db);
  const params = {};
  const where = [];
  const loc = cleanText(locale).toLowerCase();
  if (loc) {
    params.locale = normalizeLocale(loc);
    where.push('locale = @locale');
  }
  const normalizedType = cleanText(type).toLowerCase();
  if (normalizedType) {
    params.type = normalizeType(normalizedType);
    where.push('type = @type');
  }
  if (activeOnly) where.push('active = 1');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const baseSql = `
    SELECT *
    FROM legal_terms
    ${whereSql}
  `;
  const rows = latestOnly
    ? db
        .prepare(
          `
            SELECT *
            FROM (
              SELECT
                t.*,
                ROW_NUMBER() OVER (
                  PARTITION BY t.type, t.locale
                  ORDER BY t.updated_at DESC, t.created_at DESC, t.version DESC
                ) AS rn
              FROM (${baseSql}) t
            )
            WHERE rn = 1
            ORDER BY locale ASC, CASE type WHEN 'service' THEN 1 WHEN 'privacy' THEN 2 ELSE 9 END ASC
          `,
        )
        .all(params)
    : db
        .prepare(
          `
            ${baseSql}
            ORDER BY
              locale ASC,
              CASE type WHEN 'service' THEN 1 WHEN 'privacy' THEN 2 ELSE 9 END ASC,
              updated_at DESC,
              created_at DESC
          `,
        )
        .all(params);
  return rows.map(publicTerm);
}

export function updateLegalTermInDb(db, type, locale, patch = {}) {
  seedLegalTermsInDb(db);
  const nextType = normalizeType(type);
  const nextLocale = normalizeLocale(locale);
  const now = nowIso();
  const nextVersion = cleanVersion(patch.version);
  const existing = db
    .prepare('SELECT * FROM legal_terms WHERE type = ? AND locale = ? AND version = ?')
    .get(nextType, nextLocale, nextVersion);
  const current = listLegalTermsInDb(db, {
    type: nextType,
    locale: nextLocale,
    activeOnly: true,
    latestOnly: true,
  })[0];
  const prev = publicTerm(existing) || current || {};
  const next = {
    type: nextType,
    locale: nextLocale,
    version: nextVersion,
    title: cleanText(patch.title) || prev.title || nextType,
    body: cleanText(patch.body) || prev.body || '',
    required: typeof patch.required === 'boolean' ? patch.required : prev.required !== false,
    active: typeof patch.active === 'boolean' ? patch.active : prev.active !== false,
  };
  if (!next.body) throw new Error('LEGAL_TERM_BODY_REQUIRED');
  if (next.active) {
    db.prepare('UPDATE legal_terms SET active = 0, updated_at = ? WHERE type = ? AND locale = ? AND version <> ?').run(
      now,
      nextType,
      nextLocale,
      next.version,
    );
  }
  db.prepare(
    `
      INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(type, locale, version) DO UPDATE SET
        version = excluded.version,
        title = excluded.title,
        body = excluded.body,
        required = excluded.required,
        active = excluded.active,
        updated_at = excluded.updated_at
    `,
  ).run(
    termId(nextType, nextLocale, next.version),
    nextType,
    nextLocale,
    next.version,
    next.title,
    next.body,
    next.required ? 1 : 0,
    next.active ? 1 : 0,
    existing ? prev.createdAt || now : now,
    now,
  );
  return publicTerm(
    db.prepare('SELECT * FROM legal_terms WHERE type = ? AND locale = ? AND version = ?').get(nextType, nextLocale, next.version),
  );
}

export function validateRequiredTermsAcceptedInDb(db, acceptedTerms = [], locale = 'ko') {
  seedLegalTermsInDb(db);
  const loc = normalizeLocale(locale);
  const required = listLegalTermsInDb(db, { locale: loc, activeOnly: true, latestOnly: true }).filter((term) => term.required);
  const accepted = Array.isArray(acceptedTerms) ? acceptedTerms : [];
  for (const term of required) {
    const hit = accepted.find(
      (item) =>
        normalizeType(item?.type) === term.type &&
        normalizeLocale(item?.locale || loc) === term.locale &&
        cleanText(item?.version) === term.version,
    );
    if (!hit) throw new Error('APP_USER_TERMS_REQUIRED');
  }
  return required;
}

export function insertAppUserTermAcceptancesInDb(db, userId, terms = []) {
  const now = nowIso();
  const insert = db.prepare(`
    INSERT INTO app_user_terms_acceptances (id, user_id, term_type, locale, version, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, term_type, locale, version) DO UPDATE SET
      accepted_at = excluded.accepted_at
  `);
  for (const term of terms || []) {
    insert.run(
      crypto.randomUUID(),
      userId,
      normalizeType(term.type),
      normalizeLocale(term.locale),
      cleanText(term.version),
      now,
    );
  }
}

export function listAppUserTermAcceptancesInDb(db, userId) {
  seedLegalTermsInDb(db);
  const rows = db
    .prepare(
      `
        SELECT
          a.id,
          a.user_id,
          a.term_type,
          a.locale,
          a.version,
          a.accepted_at,
          t.title,
          t.required,
          t.active,
          t.updated_at
        FROM app_user_terms_acceptances a
        LEFT JOIN legal_terms t
          ON t.type = a.term_type
          AND t.locale = a.locale
          AND t.version = a.version
        WHERE a.user_id = ?
        ORDER BY a.accepted_at DESC
      `,
    )
    .all(cleanText(userId));
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.term_type,
    locale: row.locale,
    version: row.version,
    title: row.title || row.term_type,
    required: Number(row.required) === 1,
    active: Number(row.active) === 1,
    acceptedAt: row.accepted_at,
    termUpdatedAt: row.updated_at || null,
  }));
}
