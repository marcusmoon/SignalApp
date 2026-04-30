export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Signal Server API',
      version: '0.1.0',
      description: 'Local MVP server for Signal (public v1 APIs + admin APIs).',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'health', description: 'Service health and config' },
      { name: 'public', description: 'Public read APIs for the app' },
      { name: 'admin', description: 'Admin console APIs (cookie session)' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['health'],
          summary: 'Health check',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      service: { type: 'string' },
                      now: { type: 'string' },
                    },
                    required: ['ok', 'service', 'now'],
                  },
                },
              },
            },
          },
        },
      },
      '/v1/config': {
        get: {
          tags: ['health'],
          summary: 'Service config',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { service: { type: 'string' }, version: { type: 'string' } },
                    required: ['service', 'version'],
                  },
                },
              },
            },
          },
        },
      },
      '/v1/news': {
        get: {
          tags: ['public'],
          summary: 'List news items',
          parameters: [
            { name: 'locale', in: 'query', schema: { type: 'string', example: 'ko' } },
            { name: 'category', in: 'query', schema: { type: 'string', example: 'global' } },
            { name: 'symbol', in: 'query', schema: { type: 'string', example: 'AAPL' } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'from', in: 'query', schema: { type: 'string', example: '2026-04-01' } },
            { name: 'to', in: 'query', schema: { type: 'string', example: '2026-04-26' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } } } },
                },
              },
            },
          },
        },
      },
      '/v1/calendar': {
        get: {
          tags: ['public'],
          summary: 'List calendar events',
          parameters: [
            { name: 'from', in: 'query', schema: { type: 'string', example: '2026-04-01' } },
            { name: 'to', in: 'query', schema: { type: 'string', example: '2026-05-01' } },
            { name: 'type', in: 'query', schema: { type: 'string', example: 'earnings' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } } } },
                },
              },
            },
          },
        },
      },
      '/v1/youtube': {
        get: {
          tags: ['public'],
          summary: 'List youtube items',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'channel', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/concalls': {
        get: {
          tags: ['public'],
          summary: 'List earnings call transcripts/summaries',
          parameters: [
            { name: 'symbol', in: 'query', schema: { type: 'string', example: 'AAPL' } },
            { name: 'fiscalYear', in: 'query', schema: { type: 'integer', example: 2026 } },
            { name: 'fiscalQuarter', in: 'query', schema: { type: 'integer', example: 1 } },
            { name: 'from', in: 'query', schema: { type: 'string', example: '2026-04-01' } },
            { name: 'to', in: 'query', schema: { type: 'string', example: '2026-05-01' } },
            { name: 'includeTranscript', in: 'query', schema: { type: 'string', enum: ['0', '1'], default: '0' } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/market-quotes': {
        get: {
          tags: ['public'],
          summary: 'List market quotes',
          parameters: [
            { name: 'segment', in: 'query', schema: { type: 'string', example: 'popular' } },
            { name: 'symbols', in: 'query', schema: { type: 'string', example: 'AAPL,MSFT' } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/stock-profile': {
        get: {
          tags: ['public'],
          summary: 'Stock profile proxy (Finnhub /stock/profile2)',
          parameters: [{ name: 'symbol', in: 'query', required: true, schema: { type: 'string', example: 'AAPL' } }],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'object' } } },
                },
              },
            },
            404: { description: 'Not found' },
          },
        },
      },
      '/v1/stock-candles': {
        get: {
          tags: ['public'],
          summary: 'Stock OHLC candles proxy (Finnhub /stock/candle)',
          parameters: [
            { name: 'symbol', in: 'query', required: true, schema: { type: 'string', example: 'AAPL' } },
            { name: 'resolution', in: 'query', schema: { type: 'string', default: 'D' } },
            { name: 'from', in: 'query', required: true, schema: { type: 'integer' } },
            { name: 'to', in: 'query', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'object' } } },
                },
              },
            },
            400: { description: 'Bad query' },
          },
        },
      },
      '/v1/coins': {
        get: {
          tags: ['public'],
          summary: 'List coin markets',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/market-lists': {
        get: {
          tags: ['public'],
          summary: 'List market lists',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } } } },
                },
              },
            },
          },
        },
      },
      '/v1/market-lists/{key}': {
        get: {
          tags: ['public'],
          summary: 'Get a market list by key',
          parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { data: { type: 'object' } } },
                },
              },
            },
            404: { description: 'Not found' },
          },
        },
      },
      '/admin/api/login': {
        post: {
          tags: ['admin'],
          summary: 'Admin login (sets cookie)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { loginId: { type: 'string' }, password: { type: 'string' } },
                  required: ['loginId', 'password'],
                },
              },
            },
          },
          responses: { 200: { description: 'OK' }, 401: { description: 'Invalid login' } },
        },
      },
      '/admin/api/session': {
        get: { tags: ['admin'], summary: 'Session status', responses: { 200: { description: 'OK' } } },
      },
    },
  };
}
