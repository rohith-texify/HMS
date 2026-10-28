package config

import (
	"os"
	"testing"
)

func TestLoad_JWTSecretValidation(t *testing.T) {
	// Backup original environment variables
	origEnv := os.Getenv("APP_ENV")
	origJWT := os.Getenv("JWT_SECRET")
	origDBName := os.Getenv("DB_NAME")
	origDBUser := os.Getenv("DB_USER")
	defer func() {
		os.Setenv("APP_ENV", origEnv)
		os.Setenv("JWT_SECRET", origJWT)
		os.Setenv("DB_NAME", origDBName)
		os.Setenv("DB_USER", origDBUser)
	}()

	// Set minimum required valid envs for DB to pass its own checks
	os.Setenv("DB_NAME", "test_db")
	os.Setenv("DB_USER", "test_user")

	tests := []struct {
		name          string
		appEnv        string
		jwtSecret     string
		expectedError string
	}{
		{
			name:          "Missing JWT secret in development",
			appEnv:        "development",
			jwtSecret:     "",
			expectedError: "JWT_SECRET is required",
		},
		{
			name:          "Missing JWT secret in production",
			appEnv:        "production",
			jwtSecret:     "",
			expectedError: "JWT_SECRET is required",
		},
		{
			name:          "Weak JWT secret in development (Allowed)",
			appEnv:        "development",
			jwtSecret:     "short-secret",
			expectedError: "", // Should not fail on secret length
		},
		{
			name:          "Weak JWT secret in production (Rejected)",
			appEnv:        "production",
			jwtSecret:     "short-secret",
			expectedError: "JWT_SECRET must be at least 32 bytes in production environments for sufficient cryptographic strength",
		},
		{
			name:          "Strong JWT secret in production (Allowed)",
			appEnv:        "production",
			jwtSecret:     "this-is-a-sufficiently-long-secret-key-that-is-over-32-bytes",
			expectedError: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			os.Setenv("APP_ENV", tc.appEnv)
			os.Setenv("JWT_SECRET", tc.jwtSecret)

			// We need to bypass the DB SSLMode check for production if we don't set DB_SSLMODE.
			// The config loader checks if env == "production" && DB_SSLMODE == "disable".
			// By default it is "disable". So let's just set it to "require" for production tests.
			if tc.appEnv == "production" {
				os.Setenv("DB_SSLMODE", "require")
			} else {
				os.Setenv("DB_SSLMODE", "disable")
			}

			_, err := Load()

			if tc.expectedError != "" {
				if err == nil {
					t.Fatalf("expected error containing '%s', got nil", tc.expectedError)
				}
				if err.Error() != tc.expectedError {
					t.Fatalf("expected error '%s', got '%v'", tc.expectedError, err)
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got '%v'", err)
				}
			}
		})
	}
}

func TestLoad_PortResolution(t *testing.T) {
	origPort := os.Getenv("PORT")
	origServerPort := os.Getenv("SERVER_PORT")
	origDBName := os.Getenv("DB_NAME")
	origDBUser := os.Getenv("DB_USER")
	origJWT := os.Getenv("JWT_SECRET")

	defer func() {
		os.Setenv("PORT", origPort)
		os.Setenv("SERVER_PORT", origServerPort)
		os.Setenv("DB_NAME", origDBName)
		os.Setenv("DB_USER", origDBUser)
		os.Setenv("JWT_SECRET", origJWT)
	}()

	os.Setenv("DB_NAME", "test_db")
	os.Setenv("DB_USER", "test_user")
	os.Setenv("JWT_SECRET", "test_jwt_secret_dev")

	// Case 1: PORT is set by Render (e.g. 10000)
	os.Setenv("PORT", "10000")
	os.Setenv("SERVER_PORT", "9090")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Server.Port != "10000" {
		t.Errorf("expected port '10000' from PORT, got '%s'", cfg.Server.Port)
	}

	// Case 2: PORT is empty, SERVER_PORT is set
	os.Unsetenv("PORT")
	os.Setenv("SERVER_PORT", "9090")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Server.Port != "9090" {
		t.Errorf("expected port '9090' from SERVER_PORT, got '%s'", cfg.Server.Port)
	}

	// Case 3: Both are empty, default to 8080
	os.Unsetenv("PORT")
	os.Unsetenv("SERVER_PORT")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Server.Port != "8080" {
		t.Errorf("expected default port '8080', got '%s'", cfg.Server.Port)
	}
}

func TestLoad_DatabaseURLResolution(t *testing.T) {
	origDBURL := os.Getenv("DATABASE_URL")
	origDBName := os.Getenv("DB_NAME")
	origDBUser := os.Getenv("DB_USER")
	origJWT := os.Getenv("JWT_SECRET")

	defer func() {
		os.Setenv("DATABASE_URL", origDBURL)
		os.Setenv("DB_NAME", origDBName)
		os.Setenv("DB_USER", origDBUser)
		os.Setenv("JWT_SECRET", origJWT)
	}()

	os.Unsetenv("DB_NAME")
	os.Unsetenv("DB_USER")
	os.Setenv("JWT_SECRET", "test_jwt_secret_dev")
	os.Setenv("DATABASE_URL", "postgres://cloud_user:secret_pass@db.neon.tech:5432/hms_prod?sslmode=require")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error parsing DATABASE_URL: %v", err)
	}

	if cfg.Database.Host != "db.neon.tech" {
		t.Errorf("expected Host 'db.neon.tech', got '%s'", cfg.Database.Host)
	}
	if cfg.Database.Port != "5432" {
		t.Errorf("expected Port '5432', got '%s'", cfg.Database.Port)
	}
	if cfg.Database.Name != "hms_prod" {
		t.Errorf("expected Name 'hms_prod', got '%s'", cfg.Database.Name)
	}
	if cfg.Database.User != "cloud_user" {
		t.Errorf("expected User 'cloud_user', got '%s'", cfg.Database.User)
	}
	if cfg.Database.Password != "secret_pass" {
		t.Errorf("expected Password 'secret_pass', got '%s'", cfg.Database.Password)
	}
	if cfg.Database.SSLMode != "require" {
		t.Errorf("expected SSLMode 'require', got '%s'", cfg.Database.SSLMode)
	}

	// Test Render format (no port, no sslmode in query, postgresql:// scheme)
	os.Setenv("DATABASE_URL", "postgresql://hms_db_3way_user:D06mA7yWsJJvb1uKWroeHOHrYDOgcpAg@dpg-dbgb12qvcj2c73bmcm0g-a.oregon-postgres.render.com/hms_db_3way")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("unexpected error parsing Render DATABASE_URL: %v", err)
	}
	if cfg.Database.Host != "dpg-dbgb12qvcj2c73bmcm0g-a.oregon-postgres.render.com" {
		t.Errorf("expected Host 'dpg-dbgb12qvcj2c73bmcm0g-a.oregon-postgres.render.com', got '%s'", cfg.Database.Host)
	}
	if cfg.Database.Port != "5432" {
		t.Errorf("expected default Port '5432', got '%s'", cfg.Database.Port)
	}
	if cfg.Database.Name != "hms_db_3way" {
		t.Errorf("expected Name 'hms_db_3way', got '%s'", cfg.Database.Name)
	}
	if cfg.Database.User != "hms_db_3way_user" {
		t.Errorf("expected User 'hms_db_3way_user', got '%s'", cfg.Database.User)
	}
	if cfg.Database.Password != "D06mA7yWsJJvb1uKWroeHOHrYDOgcpAg" {
		t.Errorf("expected Password, got '%s'", cfg.Database.Password)
	}
	if cfg.Database.SSLMode != "require" {
		t.Errorf("expected SSLMode 'require' for cloud host, got '%s'", cfg.Database.SSLMode)
	}
	if cfg.Database.CollegeUser != "hms_db_3way_user" {
		t.Errorf("expected CollegeUser to fall back to 'hms_db_3way_user', got '%s'", cfg.Database.CollegeUser)
	}
	if cfg.Database.PlatformUser != "hms_db_3way_user" {
		t.Errorf("expected PlatformUser to fall back to 'hms_db_3way_user', got '%s'", cfg.Database.PlatformUser)
	}
}

func TestLoad_DatabaseUserTrimmingAndValidation(t *testing.T) {
	origDBName := os.Getenv("DB_NAME")
	origDBUser := os.Getenv("DB_USER")
	origCollegeUser := os.Getenv("DB_COLLEGE_USER")
	origPlatformUser := os.Getenv("DB_PLATFORM_USER")
	origJWT := os.Getenv("JWT_SECRET")

	defer func() {
		os.Setenv("DB_NAME", origDBName)
		os.Setenv("DB_USER", origDBUser)
		os.Setenv("DB_COLLEGE_USER", origCollegeUser)
		os.Setenv("DB_PLATFORM_USER", origPlatformUser)
		os.Setenv("JWT_SECRET", origJWT)
	}()

	os.Setenv("DB_NAME", "test_db")
	os.Setenv("JWT_SECRET", "test_jwt_secret_dev")

	// 1. Whitespace around user names should be safely trimmed
	os.Setenv("DB_USER", "  postgres_admin  \n")
	os.Setenv("DB_COLLEGE_USER", " \t hms_college_app \n ")
	os.Setenv("DB_PLATFORM_USER", "  hms_platform_app  ")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error loading config with trimmed whitespace: %v", err)
	}
	if cfg.Database.User != "postgres_admin" {
		t.Errorf("expected DB_USER 'postgres_admin', got '%s'", cfg.Database.User)
	}
	if cfg.Database.CollegeUser != "hms_college_app" {
		t.Errorf("expected DB_COLLEGE_USER 'hms_college_app', got '%s'", cfg.Database.CollegeUser)
	}
	if cfg.Database.PlatformUser != "hms_platform_app" {
		t.Errorf("expected DB_PLATFORM_USER 'hms_platform_app', got '%s'", cfg.Database.PlatformUser)
	}

	// 2. Control characters / newlines inside the username must be rejected
	os.Setenv("DB_COLLEGE_USER", "hms_college\n_app")
	_, err = Load()
	if err == nil {
		t.Fatal("expected error for username containing newline, got nil")
	}
}

