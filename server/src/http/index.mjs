import crypto from 'node:crypto';

import { applyCorsHeadersIfNeeded, tryHandleCorsPreflight } from './cors.mjs';
import { handleAdminAppUsersRoutes } from './admin/api/appUsers.mjs';
import { handleAdminCalendarRoutes } from './admin/api/calendar.mjs';
import { handleAdminDataResetRoutes } from './admin/api/dataReset.mjs';
import { handleAdminJobsRoutes } from './admin/api/jobs.mjs';
import { handleAdminLegalTermsRoutes } from './admin/api/legalTerms.mjs';
import { handleAdminNewsRoutes } from './admin/api/news.mjs';
import { handleAdminNotificationsRoutes } from './admin/api/notifications.mjs';
import { handleAdminSettingsRoutes } from './admin/api/settings.mjs';
import { handleAdminYoutubeRoutes } from './admin/api/youtube.mjs';
import { handleAdminSessionRoutes, requireAdmin } from './admin/auth.mjs';
import { handleAdminStaticRoutes } from './admin/static.mjs';
import { handleWebStaticRoutes } from './webStatic.mjs';
import { handlePublicAuthRoutes } from './public/v1/auth.mjs';
import { handlePublicCalendarRoutes } from './public/v1/calendar.mjs';
import { handlePublicDisclosureRoutes } from './public/v1/disclosures.mjs';
import { handlePublicInsightRoutes } from './public/v1/insights.mjs';
import { handlePublicLegalRoutes } from './public/v1/legal.mjs';
import { handlePublicMarketBriefingRoutes } from './public/v1/marketBriefings.mjs';
import { handleMarketDataProxyRoutes } from './public/v1/marketDataProxy.mjs';
import { handlePublicMarketRoutes } from './public/v1/market.mjs';
import { handlePublicNewsRoutes } from './public/v1/news.mjs';
import { handlePublicNotificationRoutes } from './public/v1/notifications.mjs';
import { handlePublicTodayBriefingRoutes } from './public/v1/todayBriefings.mjs';
import { handlePublicYoutubeRoutes } from './public/v1/youtube.mjs';
import { handlePublicMiscRoutes } from './public/routes.mjs';
import { json } from './shared.mjs';

const PUBLIC_ROUTE_HANDLERS = [
  handlePublicMiscRoutes,
  handlePublicAuthRoutes,
  handlePublicLegalRoutes,
  handlePublicMarketBriefingRoutes,
  handlePublicTodayBriefingRoutes,
  handleMarketDataProxyRoutes,
  handlePublicNotificationRoutes,
  handlePublicNewsRoutes,
  handlePublicDisclosureRoutes,
  handlePublicCalendarRoutes,
  handlePublicInsightRoutes,
  handlePublicYoutubeRoutes,
  handlePublicMarketRoutes,
];

const ADMIN_API_HANDLERS = [
  handleAdminAppUsersRoutes,
  handleAdminLegalTermsRoutes,
  handleAdminJobsRoutes,
  handleAdminNotificationsRoutes,
  handleAdminNewsRoutes,
  handleAdminCalendarRoutes,
  handleAdminYoutubeRoutes,
  handleAdminSettingsRoutes,
  handleAdminDataResetRoutes,
];

export async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (tryHandleCorsPreflight(req, res, pathname)) return;
  applyCorsHeadersIfNeeded(req, res, pathname);

  try {
    // 1) Public routes (health, openapi, docs, /v1/*)
    for (const handler of PUBLIC_ROUTE_HANDLERS) {
      if (await handler({ req, res, url, pathname })) return;
    }

    // 2) Static clients: Admin and Expo web export.
    if (await handleAdminStaticRoutes({ req, res, pathname })) return;
    if (await handleWebStaticRoutes({ req, res, url, pathname })) return;

    // 3) Admin session/auth (no admin guard required for these)
    if (await handleAdminSessionRoutes({ req, res, pathname })) return;

    // 4) Admin API (requires admin)
    if (pathname.startsWith('/admin/api/')) {
      const adminId = requireAdmin(req, res);
      if (!adminId) return;
      for (const handler of ADMIN_API_HANDLERS) {
        if (await handler({ req, res, url, pathname, adminId })) return;
      }
    }

    json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[request:${requestId}]`, error);
    json(res, 500, { error: 'INTERNAL_SERVER_ERROR', requestId });
  }
}
