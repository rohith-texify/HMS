package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type CORSConfig struct {
	AllowedOrigins []string
}

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	JWT       JWTConfig
	CORS      CORSConfig
	Telegram  TelegramConfig
	RateLimit RateLimitConfig
}

type ServerConfig struct {
	Port        string
	Environment string
}

type DatabaseConfig struct {
	Host            string
	Port            string
	Name            string
	User            string
	Password        string
	SSLMode         string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime int
	MaxConnIdleTime int

	// College Application Pool (Restricted role: hms_college_app)
	CollegeUser     string
	CollegePassword string
	CollegeMaxConns int32
	CollegeMinConns int32

	// Platform Application Pool (Restricted role: hms_platform_app)
	PlatformUser     string
	PlatformPassword string
	PlatformMaxConns int32
	PlatformMinConns int32
}


type JWTConfig struct {
	Secret             string
	Issuer             string
	Audience           string
	AccessTokenMinutes int
}

type TelegramConfig struct {
	Enabled         bool
	BotToken        string
	ChatID          string
	CooldownSeconds int
	TimeoutSeconds  int
}

type RateLimitConfig struct {
	GeneralRequestsPerMinute int
	AuthRequestsPerMinute    int
}

func Load() (*Config, error) {
	// Load .env from the current project root if it exists.
	// Existing environment variables are preserved by godotenv.
	_ = godotenv.Load(".env") // Ignore error, as production might not have a .env file

	// Database connection pool configuration.
	maxConns, err := getInt32Env("DB_MAX_CONNS", 20)
	if err != nil {
		return nil, err
	}

	minConns, err := getInt32Env("DB_MIN_CONNS", 2)
	if err != nil {
		return nil, err
	}

	maxConnLifetime, err := getIntEnv(
		"DB_MAX_CONN_LIFETIME_MINUTES",
		30,
	)
	if err != nil {
		return nil, err
	}

	maxConnIdleTime, err := getIntEnv(
		"DB_MAX_CONN_IDLE_TIME_MINUTES",
		5,
	)
	if err != nil {
		return nil, err
	}

	// College and Platform Pool settings (with safe fallback to base DB settings)
	collegeMaxConns, err := getInt32Env("DB_COLLEGE_MAX_CONNS", maxConns)
	if err != nil {
		return nil, err
	}

	collegeMinConns, err := getInt32Env("DB_COLLEGE_MIN_CONNS", minConns)
	if err != nil {
		return nil, err
	}

	platformMaxConns, err := getInt32Env("DB_PLATFORM_MAX_CONNS", 5)
	if err != nil {
		return nil, err
	}

	platformMinConns, err := getInt32Env("DB_PLATFORM_MIN_CONNS", 1)
	if err != nil {
		return nil, err
	}

	// JWT access-token lifetime.
	accessTokenMinutes, err := getIntEnv(
		"JWT_ACCESS_TOKEN_MINUTES",
		30,
	)
	if err != nil {
		return nil, err
	}

	telegramCooldown, err := getIntEnv("TELEGRAM_ALERT_COOLDOWN_SECONDS", 300)
	if err != nil {
		return nil, err
	}

	telegramTimeout, err := getIntEnv("TELEGRAM_ALERT_TIMEOUT_SECONDS", 5)
	if err != nil {
		return nil, err
	}

	generalRateLimit, err := getIntEnv("RATE_LIMIT_GENERAL_PER_MINUTE", 100)
	if err != nil {
		return nil, err
	}

	authRateLimit, err := getIntEnv("RATE_LIMIT_AUTH_PER_MINUTE", 5)
	if err != nil {
		return nil, err
	}

	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbName := getEnv("DB_NAME", "")
	dbUser := getEnv("DB_USER", "")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	if rawDBURL := os.Getenv("DATABASE_URL"); rawDBURL != "" {
		if parsedURL, err := url.Parse(rawDBURL); err == nil {
			if parsedURL.Hostname() != "" {
				dbHost = parsedURL.Hostname()
			}
			if parsedURL.Port() != "" {
				dbPort = parsedURL.Port()
			}
			if db := strings.TrimPrefix(parsedURL.Path, "/"); db != "" {
				dbName = db
			}
			if parsedURL.User != nil {
				if u := parsedURL.User.Username(); u != "" {
					dbUser = u
				}
				if p, ok := parsedURL.User.Password(); ok {
					dbPassword = p
				}
			}
			if mode := parsedURL.Query().Get("sslmode"); mode != "" {
				dbSSLMode = mode
			}
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = getEnv("SERVER_PORT", "8080")
	}

	config := &Config{
		Server: ServerConfig{
			Port:        port,
			Environment: getEnv("APP_ENV", "development"),
		},

		Database: DatabaseConfig{
			Host:     dbHost,
			Port:     dbPort,
			Name:     dbName,
			User:     dbUser,
			Password: dbPassword,
			SSLMode:  dbSSLMode,

			MaxConns:        maxConns,
			MinConns:        minConns,
			MaxConnLifetime: maxConnLifetime,
			MaxConnIdleTime: maxConnIdleTime,

			CollegeUser:     getEnv("DB_COLLEGE_USER", getEnv("DB_USER", "hms_college_app")),
			CollegePassword: getEnv("DB_COLLEGE_PASSWORD", dbPassword),
			CollegeMaxConns: collegeMaxConns,
			CollegeMinConns: collegeMinConns,

			PlatformUser:     getEnv("DB_PLATFORM_USER", getEnv("DB_USER", "hms_platform_app")),
			PlatformPassword: getEnv("DB_PLATFORM_PASSWORD", dbPassword),
			PlatformMaxConns: platformMaxConns,
			PlatformMinConns: platformMinConns,
		},

		JWT: JWTConfig{
			Secret:             os.Getenv("JWT_SECRET"),
			Issuer:             getEnv("JWT_ISSUER", "hms-api"),
			Audience:           getEnv("JWT_AUDIENCE", "hms-client"),
			AccessTokenMinutes: accessTokenMinutes,
		},

		CORS: CORSConfig{
			AllowedOrigins: getSliceEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:5173"}),
		},

		Telegram: TelegramConfig{
			Enabled:         getEnv("TELEGRAM_ALERTS_ENABLED", "false") == "true",
			BotToken:        os.Getenv("TELEGRAM_BOT_TOKEN"),
			ChatID:          os.Getenv("TELEGRAM_CHAT_ID"),
			CooldownSeconds: telegramCooldown,
			TimeoutSeconds:  telegramTimeout,
		},

		RateLimit: RateLimitConfig{
			GeneralRequestsPerMinute: generalRateLimit,
			AuthRequestsPerMinute:    authRateLimit,
		},
	}

	// Required database configuration validation.
	if config.Database.Name == "" {
		return nil, fmt.Errorf("DB_NAME is required")
	}

	if config.Database.User == "" {
		return nil, fmt.Errorf("DB_USER is required")
	}

	if config.Server.Environment == "production" && config.Database.SSLMode == "disable" {
		return nil, fmt.Errorf("DB_SSLMODE=disable is not allowed in production")
	}

	// Required JWT configuration validation.
	if config.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	if config.Server.Environment == "production" {
		if len(config.JWT.Secret) < 32 {
			return nil, fmt.Errorf("JWT_SECRET must be at least 32 bytes in production environments for sufficient cryptographic strength")
		}
	}

	if config.JWT.AccessTokenMinutes <= 0 {
		return nil, fmt.Errorf(
			"JWT_ACCESS_TOKEN_MINUTES must be greater than zero",
		)
	}

	return config, nil
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)

	if value == "" {
		return fallback
	}

	return value
}

func getInt32Env(key string, fallback int32) (int32, error) {
	value := os.Getenv(key)

	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", key, err)
	}

	return int32(parsed), nil
}

func getIntEnv(key string, fallback int) (int, error) {
	value := os.Getenv(key)

	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", key, err)
	}

	return parsed, nil
}

func getSliceEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return strings.Split(value, ",")
}
