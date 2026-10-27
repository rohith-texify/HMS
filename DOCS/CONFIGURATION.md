# Configuration Reference

The HMS API is configured entirely via environment variables.

### Server Configuration
- `SERVER_PORT`: (Optional, default `8080`) The HTTP port the API binds to.
- `APP_ENV`: (Optional, default `development`) Set to `production` to enable strict mode (forces gin Release mode, enforces DB SSL requirements, disables blind proxy trusts).

### Database Configuration
- `DB_HOST`: PostgreSQL host (e.g. `localhost`).
- `DB_PORT`: PostgreSQL port (e.g. `5432`).
- `DB_NAME`: (Required) Database name.
- `DB_USER`: (Required) Database username.
- `DB_PASSWORD`: Database password.
- `DB_SSLMODE`: SSL mode. Set to `require` in production. (Cannot be `disable` when `APP_ENV=production`).
- `DB_MAX_CONNS`: (Optional, default `20`) Maximum DB pool connections.
- `DB_MIN_CONNS`: (Optional, default `2`) Minimum DB pool connections.
- `DB_MAX_CONN_LIFETIME_MINUTES`: (Optional, default `30`) Max connection lifetime.
- `DB_MAX_CONN_IDLE_TIME_MINUTES`: (Optional, default `5`) Max connection idle time.

### Security Configuration
- `JWT_SECRET`: (Required) Base64 encoded secret for JWT HS256 verification.
- `JWT_ISSUER`: (Optional, default `hms-api`) JWT token issuer.
- `JWT_AUDIENCE`: (Optional, default `hms-client`) JWT token audience.
- `JWT_ACCESS_TOKEN_MINUTES`: (Optional, default `30`) Token expiry.
- `CORS_ALLOWED_ORIGINS`: (Optional) Comma-separated list of allowed origins.

### .env.example
The repository contains an `.env.example` file that defines safe placeholders for all required environment values.
