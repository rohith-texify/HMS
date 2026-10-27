 BEGIN;

-- ============================================================
-- 011_geo_location.sql
-- Tamil Nadu Local Government Directory & Administrative Geo Data
-- ============================================================
-- Purpose:
--   Establish canonical schema and tables for Tamil Nadu administrative
--   geographical hierarchy, supporting both Urban and Rural selectors.
--
-- Rules:
--   1. All codes (official and census) stored as VARCHAR/TEXT to preserve
--      leading zeroes.
--   2. Urban and rural administrative paths kept distinct.
--   3. Mappings (village-to-GP, block-to-village) kept as relation tables.
--   4. Read access granted to hms_app, hms_college_app, hms_platform_app.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS geo;

-- 1. Districts (Tamil Nadu State Code 33)
CREATE TABLE IF NOT EXISTS geo.districts (
    district_code           VARCHAR(20) PRIMARY KEY,
    district_version        VARCHAR(20),
    district_name           VARCHAR(200) NOT NULL,
    district_name_local     VARCHAR(200),
    census_2001_code        VARCHAR(50),
    census_2011_code        VARCHAR(50),
    state_code              VARCHAR(10) NOT NULL DEFAULT '33',
    state_name              VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Subdistricts (Taluks)
CREATE TABLE IF NOT EXISTS geo.subdistricts (
    subdistrict_code        VARCHAR(20) PRIMARY KEY,
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    subdistrict_version     VARCHAR(20),
    subdistrict_name        VARCHAR(200) NOT NULL,
    census_2001_code        VARCHAR(50),
    census_2011_code        VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Blocks (Community Development Blocks)
CREATE TABLE IF NOT EXISTS geo.blocks (
    block_code              VARCHAR(20) PRIMARY KEY,
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    block_version           VARCHAR(20),
    block_name              VARCHAR(200) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Villages (Census Villages / Revenue Villages)
CREATE TABLE IF NOT EXISTS geo.villages (
    village_code            VARCHAR(20) PRIMARY KEY,
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    subdistrict_code        VARCHAR(20) REFERENCES geo.subdistricts(subdistrict_code) ON DELETE SET NULL,
    subdistrict_name        VARCHAR(200),
    village_version         VARCHAR(20),
    village_name            VARCHAR(255) NOT NULL,
    village_name_local      VARCHAR(255),
    village_status          VARCHAR(50),
    census_2001_code        VARCHAR(50),
    census_2011_code        VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Urban Local Bodies (Municipal Corporations, Municipalities, Town Panchayats)
CREATE TABLE IF NOT EXISTS geo.urban_local_bodies (
    local_body_code         VARCHAR(20) PRIMARY KEY,
    local_body_type_code    VARCHAR(20),
    local_body_type_name    VARCHAR(100),
    local_body_version      VARCHAR(20),
    local_body_name         VARCHAR(200) NOT NULL,
    local_body_name_local   VARCHAR(200),
    census_2001_code        VARCHAR(50),
    census_2011_code        VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Urban Wards
CREATE TABLE IF NOT EXISTS geo.urban_wards (
    ward_code               VARCHAR(20) PRIMARY KEY,
    local_body_code         VARCHAR(20) NOT NULL REFERENCES geo.urban_local_bodies(local_body_code) ON DELETE RESTRICT,
    local_body_name         VARCHAR(200),
    ward_number             VARCHAR(50),
    ward_name               VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Urban City Areas (Quick Selector: state -> district -> city -> ward)
CREATE TABLE IF NOT EXISTS geo.urban_city_areas (
    ward_code               VARCHAR(20) PRIMARY KEY REFERENCES geo.urban_wards(ward_code) ON DELETE CASCADE,
    state_code              VARCHAR(10) NOT NULL DEFAULT '33',
    state_name              VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    city_code               VARCHAR(20) NOT NULL REFERENCES geo.urban_local_bodies(local_body_code) ON DELETE RESTRICT,
    city_name               VARCHAR(200),
    ward_number             VARCHAR(50),
    area_name               VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Urban Ward Coverage (Multi-coverage relation)
CREATE TABLE IF NOT EXISTS geo.urban_ward_coverage (
    id                      BIGSERIAL PRIMARY KEY,
    local_body_code         VARCHAR(20) NOT NULL REFERENCES geo.urban_local_bodies(local_body_code) ON DELETE RESTRICT,
    local_body_name         VARCHAR(200),
    ward_code               VARCHAR(20) NOT NULL REFERENCES geo.urban_wards(ward_code) ON DELETE CASCADE,
    ward_number             VARCHAR(50),
    ward_name               VARCHAR(255),
    district_code           VARCHAR(20) REFERENCES geo.districts(district_code) ON DELETE SET NULL,
    district_name           VARCHAR(200),
    subdistrict_code        VARCHAR(20) REFERENCES geo.subdistricts(subdistrict_code) ON DELETE SET NULL,
    subdistrict_name        VARCHAR(200),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_urban_ward_cov UNIQUE NULLS NOT DISTINCT (local_body_code, ward_code, district_code, subdistrict_code)
);

-- 9. Rural Local Bodies (Panchayat Raj Institutions: Zila Panchayat, Panchayat Union, Gram Panchayat)
CREATE TABLE IF NOT EXISTS geo.rural_local_bodies (
    local_body_code         VARCHAR(20) PRIMARY KEY,
    local_body_type_code    VARCHAR(20),
    local_body_type_name    VARCHAR(100),
    local_body_version      VARCHAR(20),
    local_body_name         VARCHAR(200) NOT NULL,
    local_body_name_local   VARCHAR(200),
    parent_local_body_code  VARCHAR(20),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Rural Wards (Panchayat Wards)
CREATE TABLE IF NOT EXISTS geo.rural_wards (
    id                      BIGSERIAL PRIMARY KEY,
    local_body_code         VARCHAR(20) NOT NULL REFERENCES geo.rural_local_bodies(local_body_code) ON DELETE RESTRICT,
    local_body_name         VARCHAR(200),
    local_body_type_name    VARCHAR(100),
    district_parent_name    VARCHAR(200),
    intermediate_parent_name VARCHAR(200),
    ward_code               VARCHAR(20),
    ward_number             VARCHAR(50),
    ward_name               VARCHAR(255),
    ward_name_local         VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rural_ward_ident UNIQUE (local_body_code, ward_code, ward_number)
);

-- 11. Village Gram Panchayat Mapping (Many-to-Many Relation)
CREATE TABLE IF NOT EXISTS geo.village_gram_panchayat_mapping (
    id                          BIGSERIAL PRIMARY KEY,
    district_code               VARCHAR(20),
    district_name               VARCHAR(200),
    district_census_2011_code   VARCHAR(50),
    district_census_2001_code   VARCHAR(50),
    subdistrict_code            VARCHAR(20),
    subdistrict_name            VARCHAR(200),
    subdistrict_census_2011_code VARCHAR(50),
    subdistrict_census_2001_code VARCHAR(50),
    village_code                VARCHAR(20) NOT NULL,
    village_name                VARCHAR(255),
    village_census_2011_code    VARCHAR(50),
    village_census_2001_code    VARCHAR(50),
    local_body_code             VARCHAR(20),
    local_body_name             VARCHAR(200),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_village_gp_mapping UNIQUE NULLS NOT DISTINCT (village_code, local_body_code)
);

-- 12. Block Village Mapping (Relation)
CREATE TABLE IF NOT EXISTS geo.block_village_mapping (
    village_code            VARCHAR(20) PRIMARY KEY,
    state_code              VARCHAR(10) NOT NULL DEFAULT '33',
    state_name              VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    block_code              VARCHAR(20) NOT NULL REFERENCES geo.blocks(block_code) ON DELETE RESTRICT,
    block_name              VARCHAR(200),
    village_name            VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Rural Place Hierarchy (Selector: state -> district -> block -> subdistrict -> village)
CREATE TABLE IF NOT EXISTS geo.rural_place_hierarchy (
    village_code            VARCHAR(20) PRIMARY KEY,
    state_code              VARCHAR(10) NOT NULL DEFAULT '33',
    state_name              VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    district_code           VARCHAR(20) NOT NULL REFERENCES geo.districts(district_code) ON DELETE RESTRICT,
    district_name           VARCHAR(200),
    block_code              VARCHAR(20) NOT NULL REFERENCES geo.blocks(block_code) ON DELETE RESTRICT,
    block_name              VARCHAR(200),
    subdistrict_code        VARCHAR(20),
    subdistrict_name        VARCHAR(200),
    village_name            VARCHAR(255),
    village_status          VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR FAST QUERYING
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_geo_subdistricts_district ON geo.subdistricts (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_blocks_district ON geo.blocks (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_villages_district ON geo.villages (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_villages_subdistrict ON geo.villages (subdistrict_code);
CREATE INDEX IF NOT EXISTS idx_geo_urban_wards_lb ON geo.urban_wards (local_body_code);
CREATE INDEX IF NOT EXISTS idx_geo_urban_city_areas_district ON geo.urban_city_areas (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_urban_city_areas_city ON geo.urban_city_areas (city_code);
CREATE INDEX IF NOT EXISTS idx_geo_urban_ward_cov_district ON geo.urban_ward_coverage (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_urban_ward_cov_lb ON geo.urban_ward_coverage (local_body_code);
CREATE INDEX IF NOT EXISTS idx_geo_rural_wards_lb ON geo.rural_wards (local_body_code);
CREATE INDEX IF NOT EXISTS idx_geo_bvm_district ON geo.block_village_mapping (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_bvm_block ON geo.block_village_mapping (block_code);
CREATE INDEX IF NOT EXISTS idx_geo_rph_district ON geo.rural_place_hierarchy (district_code);
CREATE INDEX IF NOT EXISTS idx_geo_rph_block ON geo.rural_place_hierarchy (block_code);
CREATE INDEX IF NOT EXISTS idx_geo_vgp_village ON geo.village_gram_panchayat_mapping (village_code);
CREATE INDEX IF NOT EXISTS idx_geo_vgp_lb ON geo.village_gram_panchayat_mapping (local_body_code);

-- ============================================================
-- PERMISSIONS & ROLES GRANT
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
        GRANT USAGE ON SCHEMA geo TO hms_app;
        GRANT SELECT ON ALL TABLES IN SCHEMA geo TO hms_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA geo TO hms_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_college_app') THEN
        GRANT USAGE ON SCHEMA geo TO hms_college_app;
        GRANT SELECT ON ALL TABLES IN SCHEMA geo TO hms_college_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA geo TO hms_college_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_platform_app') THEN
        GRANT USAGE ON SCHEMA geo TO hms_platform_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA geo TO hms_platform_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA geo TO hms_platform_app;
    END IF;
END
$$;

COMMIT;
