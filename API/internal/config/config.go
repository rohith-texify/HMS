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

	rawDBURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if rawDBURL == "" {
		rawDBURL = strings.TrimSpace(os.Getenv("INTERNAL_DATABASE_URL"))
	}
	if rawDBURL == "" {
		rawDBURL = strings.TrimSpace(os.Getenv("RENDER_POSTGRES_URL"))
	}
	if rawDBURL == "" {
		rawDBURL = strings.TrimSpace(os.Getenv("POSTGRESQL_URL"))
	}
	if rawDBURL == "" && os.Getenv("RENDER") != "" {
		rawDBURL = "postgresql://hms_db_3way_user:D06mA7yWsJJvb1uKWroeHOHrYDOgcpAg@dpg-dbgb12qvcj2c73bmcm0g-a.oregon-postgres.render.com/hms_db_3way?sslmode=require"
	}

	dbHost := getTrimmedEnv("DB_HOST", getTrimmedEnv("PGHOST", getTrimmedEnv("POSTGRES_HOST", "localhost")))
	dbPort := getTrimmedEnv("DB_PORT", getTrimmedEnv("PGPORT", getTrimmedEnv("POSTGRES_PORT", "5432")))
	dbName := getTrimmedEnv("DB_NAME", getTrimmedEnv("PGDATABASE", getTrimmedEnv("POSTGRES_DB", "")))
	dbUser := getTrimmedEnv("DB_USER", getTrimmedEnv("PGUSER", getTrimmedEnv("POSTGRES_USER", "")))
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = os.Getenv("PGPASSWORD")
	}
	if dbPassword == "" {
		dbPassword = os.Getenv("POSTGRES_PASSWORD")
	}
	dbSSLMode := getTrimmedEnv("DB_SSLMODE", "disable")

	if rawDBURL != "" {
		if parsedURL, err := url.Parse(rawDBURL); err == nil {
			if parsedURL.Hostname() != "" {
				dbHost = strings.TrimSpace(parsedURL.Hostname())
			}
			if parsedURL.Port() != "" {
				dbPort = strings.TrimSpace(parsedURL.Port())
			}
			if path := strings.TrimPrefix(parsedURL.Path, "/"); path != "" {
				dbName = strings.TrimSpace(strings.Split(path, "?")[0])
			}
			if parsedURL.User != nil {
				if u := parsedURL.User.Username(); u != "" {
					dbUser = strings.TrimSpace(u)
				}
				if p, ok := parsedURL.User.Password(); ok {
					dbPassword = p
				}
			}
			if mode := strings.TrimSpace(parsedURL.Query().Get("sslmode")); mode != "" {
				dbSSLMode = mode
			} else if parsedURL.Hostname() != "localhost" && parsedURL.Hostname() != "127.0.0.1" && parsedURL.Hostname() != "postgres" {
				dbSSLMode = "require"
			}
		}
	}

	if dbName == "" {
		dbName = "hms_db"
	}
	if dbUser == "" {
		dbUser = "postgres"
	}
	if (os.Getenv("RENDER") != "" || dbHost != "localhost") && dbSSLMode == "disable" && dbHost != "127.0.0.1" {
		dbSSLMode = "require"
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = getTrimmedEnv("SERVER_PORT", "8080")
	}

	collegeUser := getTrimmedEnv("DB_COLLEGE_USER", dbUser)
	collegePassword := os.Getenv("DB_COLLEGE_PASSWORD")
	if collegePassword == "" {
		collegePassword = dbPassword
	}

	platformUser := getTrimmedEnv("DB_PLATFORM_USER", dbUser)
	platformPassword := os.Getenv("DB_PLATFORM_PASSWORD")
	if platformPassword == "" {
		platformPassword = dbPassword
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" && os.Getenv("RENDER") != "" {
		jwtSecret = "hms-platform-super-secure-production-jwt-token-key-2026"
	}

	config := &Config{
		Server: ServerConfig{
			Port:        port,
			Environment: getTrimmedEnv("APP_ENV", "development"),
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

			CollegeUser:     collegeUser,
			CollegePassword: collegePassword,
			CollegeMaxConns: collegeMaxConns,
			CollegeMinConns: collegeMinConns,

			PlatformUser:     platformUser,
			PlatformPassword: platformPassword,
			PlatformMaxConns: platformMaxConns,
			PlatformMinConns: platformMinConns,
		},

		JWT: JWTConfig{
			Secret:             jwtSecret,
			Issuer:             getTrimmedEnv("JWT_ISSUER", "hms-api"),
			Audience:           getTrimmedEnv("JWT_AUDIENCE", "hms-client"),
			AccessTokenMinutes: accessTokenMinutes,
		},

		CORS: CORSConfig{
			AllowedOrigins: getSliceEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:5173"}),
		},

		Telegram: TelegramConfig{
			Enabled:         getTrimmedEnv("TELEGRAM_ALERTS_ENABLED", "false") == "true",
			BotToken:        os.Getenv("TELEGRAM_BOT_TOKEN"),
			ChatID:          strings.TrimSpace(os.Getenv("TELEGRAM_CHAT_ID")),
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

	if err := validateDBUsername("DB_USER", config.Database.User); err != nil {
		return nil, err
	}
	if err := validateDBUsername("DB_COLLEGE_USER", config.Database.CollegeUser); err != nil {
		return nil, err
	}
	if err := validateDBUsername("DB_PLATFORM_USER", config.Database.PlatformUser); err != nil {
		return nil, err
	}

	if config.Server.Environment == "production" && config.Database.SSLMode == "disable" {
		if config.Database.Host != "localhost" && config.Database.Host != "127.0.0.1" {
			config.Database.SSLMode = "require"
		}
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

func getTrimmedEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func validateDBUsername(field, username string) error {
	if username == "" {
		return fmt.Errorf("%s is required", field)
	}
	if strings.ContainsAny(username, "\r\n\t") {
		return fmt.Errorf("%s contains invalid control characters or newlines", field)
	}
	return nil
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
