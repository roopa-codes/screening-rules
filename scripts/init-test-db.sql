-- Runs once when the Postgres volume is first created.
-- A separate database for the migration tests, which wipe it.
CREATE DATABASE screening_test OWNER screening;
