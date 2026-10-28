package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHasInternalTransaction(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "Direct BEGIN",
			sql:      "BEGIN;\nCREATE TABLE test();\nCOMMIT;",
			expected: true,
		},
		{
			name: "Leading single-line comments before BEGIN",
			sql: `-- ============================================================
-- HMS - 000 EXTENSIONS
-- ============================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
COMMIT;`,
			expected: true,
		},
		{
			name: "Leading multi-line comments before BEGIN",
			sql: `/* Multi-line comment
   explaining the migration
*/
BEGIN;
SELECT 1;
COMMIT;`,
			expected: true,
		},
		{
			name: "No transaction statement (e.g. 012_college_location.sql)",
			sql: `-- ============================================================
-- 012_college_location.sql
-- ============================================================
ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
CREATE INDEX IF NOT EXISTS idx_colleges ON platform.colleges(state_code);`,
			expected: false,
		},
		{
			name: "No transaction statement with update (e.g. 013_default_ist_timezone.sql)",
			sql: `-- 013_default_ist_timezone.sql
ALTER TABLE platform.colleges ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';
UPDATE platform.colleges SET timezone = 'Asia/Kolkata';`,
			expected: false,
		},
		{
			name:     "Empty SQL",
			sql:      "",
			expected: false,
		},
		{
			name:     "Only comments",
			sql:      "-- Only a comment\n-- second comment",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := hasInternalTransaction(tt.sql)
			if actual != tt.expected {
				t.Errorf("hasInternalTransaction() for '%s' = %v, expected %v", tt.name, actual, tt.expected)
			}
		})
	}
}

func TestMigrationFileClassification(t *testing.T) {
	// Path relative to repository root
	migDir := filepath.Join("..", "..", "DATABASE", "migrations")
	if _, err := os.Stat(migDir); err != nil {
		t.Skipf("DATABASE/migrations directory not accessible from test path: %v", err)
	}

	migrations, err := loadMigrations(migDir)
	if err != nil {
		t.Fatalf("Failed to load actual migrations: %v", err)
	}

	if len(migrations) != 18 {
		t.Fatalf("Expected 18 migrations, found %d", len(migrations))
	}

	// 012 and 013 should be detected as false (Go-managed transaction)
	// All other 16 files should be detected as true (Self-contained transaction)
	for _, m := range migrations {
		hasTx := hasInternalTransaction(m.SQL)
		if m.Filename == "012_college_location.sql" || m.Filename == "013_default_ist_timezone.sql" {
			if hasTx {
				t.Errorf("Expected %s to have hasInternalTransaction=false, got true", m.Filename)
			}
		} else {
			if !hasTx {
				t.Errorf("Expected %s to have hasInternalTransaction=true, got false", m.Filename)
			}
		}
	}
}
