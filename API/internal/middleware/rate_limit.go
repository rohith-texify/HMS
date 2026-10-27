package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/time/rate"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/notifications/telegram"
)

// IP-based Rate Limiter (In-Memory fallback since Redis is not mandated)
type IPRateLimiter struct {
	ips map[string]*rate.Limiter
	mu  sync.RWMutex
	r   rate.Limit
	b   int
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	limiter := &IPRateLimiter{
		ips: make(map[string]*rate.Limiter),
		r:   r,
		b:   b,
	}

	// Start cleanup routine to prevent unbounded memory growth
	go limiter.cleanup()

	return limiter
}

func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.RLock()
	limiter, exists := i.ips[ip]
	i.mu.RUnlock()

	if !exists {
		i.mu.Lock()
		limiter, exists = i.ips[ip]
		if !exists {
			limiter = rate.NewLimiter(i.r, i.b)
			i.ips[ip] = limiter
		}
		i.mu.Unlock()
	}
	return limiter
}

func (i *IPRateLimiter) cleanup() {
	for {
		time.Sleep(10 * time.Minute)
		i.mu.Lock()
		// Simple approach: reset the map periodically if it grows too large.
		// A more advanced approach would track last-seen times.
		if len(i.ips) > 10000 {
			i.ips = make(map[string]*rate.Limiter)
		}
		i.mu.Unlock()
	}
}

func RateLimit(cfg config.RateLimitConfig, telegramClient *telegram.Client, logger *zap.Logger) gin.HandlerFunc {
	// auth/otp -> strict limit
	authLimiter := NewIPRateLimiter(rate.Every(time.Minute/time.Duration(cfg.AuthRequestsPerMinute)), cfg.AuthRequestsPerMinute)
	// general -> standard limit
	generalLimiter := NewIPRateLimiter(rate.Every(time.Minute/time.Duration(cfg.GeneralRequestsPerMinute)), cfg.GeneralRequestsPerMinute)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if clientIP == "" {
			clientIP = "unknown"
		}

		path := c.Request.URL.Path
		var limiter *rate.Limiter
		var limitType string
		var threshold int

		// Differentiate auth vs general endpoints
		if strings.HasPrefix(path, "/auth/") {
			limiter = authLimiter.GetLimiter(clientIP)
			limitType = "Auth/OTP"
			threshold = cfg.AuthRequestsPerMinute
		} else {
			limiter = generalLimiter.GetLimiter(clientIP)
			limitType = "General API"
			threshold = cfg.GeneralRequestsPerMinute
		}

		if !limiter.Allow() {
			logger.Warn("Rate limit exceeded",
				zap.String("ip", clientIP),
				zap.String("path", path),
				zap.String("type", limitType),
			)

			// Dispatch alert to Telegram async
			if telegramClient != nil {
				telegramClient.Notify(telegram.Event{
					Type:        "RATE_LIMIT_EXCEEDED",
					Severity:    "WARNING",
					Service:     "HMS API",
					Endpoint:    fmt.Sprintf("%s %s", c.Request.Method, path),
					LimitInfo:   fmt.Sprintf("> %d / minute", threshold),
					ClientIP:    clientIP, // Safe identifier
					Description: "Excess requests blocked",
				})
			}

			// HTTP 429 Too Many Requests
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RATE_LIMIT_EXCEEDED",
					"message": "Too many requests. Please try again later.",
				},
			})
			return
		}

		c.Next()
	}
}
