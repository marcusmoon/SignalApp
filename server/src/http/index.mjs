import { handleAdminCalendarRoutes } from './admin/api/calendar.mjs';
import { handleAdminConcallsRoutes } from './admin/api/concalls.mjs';
import { handleAdminDataResetRoutes } from './admin/api/dataReset.mjs';
import { handleAdminJobsRoutes } from './admin/api/jobs.mjs';
import { handleAdminNewsRoutes } from './admin/api/news.mjs';
import { handleAdminSettingsRoutes } from './admin/api/settings.mjs';
import { handleAdminYoutubeRoutes } from './admin/api/youtube.mjs';
import { handleAdminSessionRoutes, requireAdmin } from './admin/auth.mjs';
import { handleAdminStaticRoutes } from './admin/static.mjs';
import { handlePublicCalendarRoutes } from './public/v1/calendar.mjs';
import { handlePublicConcallsRoutes } from './public/v1/concalls.mjs';
import { handlePublicInsightRoutes } from './public/v1/insights.mjs';
import { handlePublicMarketRoutes } from './public/v1/market.mjs';
import { handlePublicNewsRoutes } from './public/v1/news.mjs';
import { handlePublicYoutubeRoutes } from './public/v1/youtube.mjs';
import { handlePublicMiscRoutes } from './public/routes.mjs';
import { json } from './shared.mjs';

const PUBLIC_ROUTE_HANDLERS = [
  handlePublicMiscRoutes,
  handlePublicNewsRoutes,
  handlePublicCalendarRoutes,
  handlePublicInsightRoutes,
  handlePublicYoutubeRoutes,
  handlePublicConcallsRoutes,
  handlePublicMarketRoutes,
];

const ADMIN_API_HANDLERS = [
  handleAdminJobsRoutes,
  handleAdminNewsRoutes,
  handleAdminCalendarRoutes,
  handleAdminConcallsRoutes,
  handleAdminYoutubeRoutes,
  handleAdminSettingsRoutes,
  handleAdminDataResetRoutes,
];

export async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // 1) Public routes (health, openapi, docs, /v1/*)
    for (const handler of PUBLIC_ROUTE_HANDLERS) {
      if (await handler({ req, res, url, pathname })) return;
    }

    // 2) Admin static (admin.html, admin/*.js|css, public assets)
    if (await handleAdminStaticRoutes({ req, res, pathname })) return;

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
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
