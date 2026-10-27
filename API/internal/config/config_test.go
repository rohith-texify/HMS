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
