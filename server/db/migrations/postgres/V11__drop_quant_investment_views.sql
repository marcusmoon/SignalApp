-- Remove investment-view (quant) jobs and storage after app feature removal.

DELETE FROM polling_job_runs
WHERE job_key IN ('quant_signals_kr', 'quant_price_series_kr');

DELETE FROM polling_jobs
WHERE job_key IN ('quant_signals_kr', 'quant_price_series_kr');

DROP TABLE IF EXISTS quant_signal_items;
