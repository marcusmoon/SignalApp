import { nowIso } from '../../db.mjs';
import { getOpenApiSpec } from '../../openapi.mjs';
import { json, text } from '../shared.mjs';

function serveSwaggerUi(res) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signal Server API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;
  text(res, 200, html, 'text/html; charset=utf-8');
}

/** Health, openapi, docs, /v1/config. Returns true if handled. */
export async function handlePublicMiscRoutes({ req, res, pathname }) {
  if (req.method === 'GET' && pathname === '/health') {
    json(res, 200, { ok: true, service: 'signal-server', now: nowIso() });
    return true;
  }

  if (req.method === 'GET' && pathname === '/openapi.json') {
    json(res, 200, getOpenApiSpec());
    return true;
  }

  if (req.method === 'GET' && (pathname === '/docs' || pathname === '/docs/')) {
    serveSwaggerUi(res);
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/config') {
    json(res, 200, { service: 'signal-server', version: '0.1.0' });
    return true;
  }

  return false;
}
