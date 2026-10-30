-- ============================================================================
-- HMS - 000 EXTENSIONS
-- ============================================================================
-- Purpose:
--   PostgreSQL extensions and base schemas required by the HMS database.
--
-- Run order:
--   FIRST
--
-- Design:
--   - PostgreSQL
--   - UUID identifiers
--   - UTC timestamptz
--   - Platform schema for Super Admin/platform-owned data
--   - App schema for college/tenant operational data
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Required PostgreSQL extensions
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS citext;

-- --------------------------------------------------------------------------
-- Database schemas
-- --------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS platform;

CREATE SCHEMA IF NOT EXISTS app;

-- --------------------------------------------------------------------------
-- Shared helper function
-- Generates UUID values when a UUID is not explicitly supplied.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform.generate_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
    SELECT gen_random_uuid();
$$;
COMMIT;