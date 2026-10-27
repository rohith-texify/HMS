# HMS Rate Limiting & Telegram Security Alerts Report

**Phase 14: Production-Grade Rate Limiting + Operational Notifications**

## 1. Existing Functionality Discovered
- The API utilized standard `gin-gonic/gin` middleware but completely lacked request throttling or rate limiting.
- The `.env.example` contained placeholders for rate limiting but the API engine `config.go` was not wired to accept them.
- No existing third-party notification services (like Telegram or Slack) existed in the `API/internal/` directories.
- The architecture uses a centralized API structure, and `docker-compose.yml` mounts a `redis` container, however, the Go codebase does not yet implement a Redis client (`go-redis`).

## 2. Files Added and Modified
### Added
- `API/internal/notifications/telegram/telegram.go`: A bounded, asynchronous, concurrency-safe client that batches events to the official Telegram Bot HTTP API.
- `API/internal/notifications/telegram/telegram_test.go`: Unit tests ensuring cooldown and disable configurations function safely.
- `API/internal/middleware/rate_limit.go`: In-memory implementation of `golang.org/x/time/rate.Limiter` segmented by client IP and request path prefixes.
- `API/internal/middleware/rate_limit_test.go`: Tests validating 429 status codes, independent client limiters, and `Retry-After` headers.

### Modified
- `API/internal/config/config.go`: Added `TelegramConfig` and `RateLimitConfig` struct mapping.
- `.env.example`: Documented new variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALERTS_ENABLED`, etc.).
- `API/internal/server/router.go`: Injected the new rate-limiter middleware globally.
- `API/cmd/server/main.go`: Instantiated the Telegram client, injected it into the router, and wired it to the Graceful Shutdown listener to perform a bounded event drain upon API termination.
- `go.mod` / `go.sum`: Pulled the official `golang.org/x/time` module.

## 3. Rate-Limit Policies and Defaults
- **General API Traffic:** 100 requests per minute per IP.
- **Auth / Password OTP endpoints:** 5 requests per minute per IP. (Identified by `/auth/` path prefixes).
- **Event details:** Pushes an event categorized exactly as `RATE_LIMIT_EXCEEDED` with `WARNING` severity, injecting both the Request Method and Route Path directly into the alert body for accurate forensics.
- **Behavior:** Clients exceeding the limit receive HTTP 429 Too Many Requests, with a `Retry-After` header.

## 4. Telegram Configuration
Environment configuration required:
- `TELEGRAM_ALERTS_ENABLED=true`
- `TELEGRAM_BOT_TOKEN=<your-token>`
- `TELEGRAM_CHAT_ID=<private-group-id>`
- `TELEGRAM_ALERT_COOLDOWN_SECONDS=300` (Default: 5 mins deduplication)
- `TELEGRAM_ALERT_TIMEOUT_SECONDS=5` (HTTP timeout for outgoing hook)

## 5. Queue, Cooldown, Retry, and Failure Behavior
- **Queue:** Alerts are dispatched into a bounded Go channel (capacity 100). If a massive DDoS spike exceeds the queue, subsequent alerts are dropped with a simple `zap.Warn` to prevent fatal memory exhaustion (OOM).
- **Cooldown (Deduplication):** A `sync.Mutex` tracks `{EventType}:{ClientIP}` timestamps. If an identical event trips within the cooldown window (default 300s), the Telegram alert is suppressed. The map self-heals by resetting if it grows beyond 1,000 tracked entities.
- **Retry:** Bounded to 3 attempts with a 1-second pause on 5xx or network failures.
- **Failures:** A Telegram outage will NOT crash the HMS API. The worker routine safely logs failures and continues draining the channel.

## 6. Tests Executed
```powershell
go fmt ./...
go vet ./...
go test ./...
go build ./...
go mod verify
```
- **Unit Tests:** `rate_limit_test.go` confirmed that independent clients do not share quotas, and `auth` limits are strictly constrained relative to general traffic.
- **Integration Tests:** `integration_test_runner.ps1` confirmed that the API middleware chain remains functionally intact and that standard operations fall cleanly underneath the 100req/m thresholds without misfiring 429s prematurely.

## 7. Security Considerations
- Client IPs are safely resolved via `gin.Context.ClientIP()`. Gin validates `X-Forwarded-For` strictly against trusted proxies configured at initialization, mitigating IP spoofing by attackers trying to evade rate limits.
- Alert bodies intentionally exclude request headers, passwords, JWTs, and SQL parameters. 

## 8. Limitations & Production Deployment
- **Limitation - Distributed Scaling:** Because the Go application does not yet utilize the `redis` container, the `rate_limit.go` operates **in-memory**. If deploying multiple API instances behind a load balancer, limits apply *per container* (e.g. 2 instances = effectively 200 req/min for general). To fix this in the future, the `IPRateLimiter` can be swapped for a distributed `go-redis` counter.
- **Deployment:** Create your Telegram Bot via BotFather, add the bot to a private Ops/Sec group, disable group privacy if needed to read chat ID, and inject the variables securely via Render.com/Docker secrets rather than committing `.env`.
