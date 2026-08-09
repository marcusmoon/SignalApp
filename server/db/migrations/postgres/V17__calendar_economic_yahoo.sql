-- Economic calendar: Finnhub Economic Data is paid on free plans; use Yahoo visualization.

UPDATE polling_jobs
SET
  provider = 'yahoo',
  handler = 'economic_calendar',
  payload = payload
    || jsonb_build_object(
      'provider', 'yahoo',
      'handler', 'economic_calendar',
      'displayName', '경제지표 수집·보정(Yahoo)',
      'description', 'Yahoo Finance 경제지표 일정을 수집·보정합니다(기본 US). Finnhub Economic Data 구독 없이 사용.',
      'params', jsonb_build_object(
        'daysBack', 1,
        'daysAhead', 14,
        'countries', jsonb_build_array('US'),
        'reconcile', jsonb_build_object(
          'daysBack', 7,
          'daysAhead', 30,
          'countries', jsonb_build_array('US')
        )
      )
    ),
  updated_at = now()
WHERE job_key = 'calendar_economic';
