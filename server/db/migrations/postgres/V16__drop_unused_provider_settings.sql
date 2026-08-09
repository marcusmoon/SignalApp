-- Remove unused external provider settings (CoinGecko superseded by Yahoo crypto;
-- API Ninjas had no runtime client).

DELETE FROM provider_settings
WHERE provider IN ('coingecko', 'ninjas');
