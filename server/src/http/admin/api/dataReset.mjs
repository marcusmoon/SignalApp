import { updateDb } from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';

const RESET_TARGETS = {
  newsItems: 'newsItems',
  newsTranslations: 'newsTranslations',
  calendarEvents: 'calendarEvents',
  youtubeVideos: 'youtubeVideos',
  concallTranscripts: 'concallTranscripts',
  marketQuotes: 'marketQuotes',
  coinMarkets: 'coinMarkets',
  pollingJobRuns: 'pollingJobRuns',
};

export async function handleAdminDataResetRoutes({ req, res, pathname }) {
  if (req.method === 'POST' && pathname === '/admin/api/data-reset') {
    const body = await readBody(req);
    const targets = Array.isArray(body.targets) ? body.targets : [];
    if (body.confirmText !== 'RESET') {
      json(res, 400, { error: 'CONFIRM_TEXT_REQUIRED' });
      return true;
    }
    const normalizedTargets = targets
      .map((target) => RESET_TARGETS[target])
      .filter((target, index, arr) => target && arr.indexOf(target) === index);
    if (normalizedTargets.length === 0) {
      json(res, 400, { error: 'NO_RESET_TARGETS' });
      return true;
    }
    const result = await updateDb((db) => {
      const counts = {};
      for (const target of normalizedTargets) {
        counts[target] = Array.isArray(db[target]) ? db[target].length : 0;
        db[target] = [];
      }
      return { targets: normalizedTargets, counts };
    });
    json(res, 200, { data: result });
    return true;
  }
  return false;
}
