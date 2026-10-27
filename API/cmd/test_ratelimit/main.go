package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/notifications/telegram"
)

func main() {
	gin.SetMode(gin.TestMode)
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	// 1. Load config from .env
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load config", zap.Error(err))
	}

	if !cfg.Telegram.Enabled {
		logger.Fatal("TELEGRAM_ALERTS_ENABLED must be true in .env")
	}

	// 2. Configure a low threshold for the test (2 requests per minute on /auth/)
	rateLimitCfg := config.RateLimitConfig{
		GeneralRequestsPerMinute: 10,
		AuthRequestsPerMinute:    2,
	}

	// Set cooldown to 1 second so deduplication doesn't suppress test runs
	cfg.Telegram.CooldownSeconds = 1

	// 3. Initialize live Telegram client
	telegramClient := telegram.NewClient(cfg.Telegram, logger)

	// 4. Set up router with RateLimit middleware
	router := gin.New()
	router.Use(middleware.RateLimit(rateLimitCfg, telegramClient, logger))

	router.POST("/auth/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Login attempt accepted"})
	})

	fmt.Println("\n==================================================")
	fmt.Println("HMS RATE LIMIT + TELEGRAM SECURITY ALERT TEST")
	fmt.Println("==================================================")
	fmt.Printf("Configured threshold for /auth/login: %d requests/minute\n", rateLimitCfg.AuthRequestsPerMinute)

	clientIP := "192.168.1.100"

	// Request 1: Should pass (1/2)
	fmt.Println("\n--> Sending Request 1 (under limit)...")
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/auth/login", nil)
	req1.RemoteAddr = "192.168.1.100:54321"
	req1.Header.Set("X-Forwarded-For", clientIP)
	router.ServeHTTP(w1, req1)
	fmt.Printf("    Status Code: %d (Expected: 200 OK)\n", w1.Code)

	// Request 2: Should pass (2/2)
	fmt.Println("\n--> Sending Request 2 (at limit threshold)...")
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/auth/login", nil)
	req2.RemoteAddr = "192.168.1.100:54321"
	req2.Header.Set("X-Forwarded-For", clientIP)
	router.ServeHTTP(w2, req2)
	fmt.Printf("    Status Code: %d (Expected: 200 OK)\n", w2.Code)

	// Request 3: Should HIT RATE LIMIT -> 429 Too Many Requests -> Trigger Telegram Alert!
	fmt.Println("\n--> Sending Request 3 (EXCEEDING LIMIT -> TRIGGERING RATE LIMIT + TELEGRAM)...")
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("POST", "/auth/login", nil)
	req3.RemoteAddr = "192.168.1.100:54321"
	req3.Header.Set("X-Forwarded-For", clientIP)
	router.ServeHTTP(w3, req3)
	fmt.Printf("    Status Code: %d (Expected: 429 Too Many Requests)\n", w3.Code)
	fmt.Printf("    Retry-After Header: %s\n", w3.Header().Get("Retry-After"))
	fmt.Printf("    Response Body: %s\n", w3.Body.String())

	if w3.Code != http.StatusTooManyRequests {
		logger.Fatal("Rate limit was NOT triggered as expected!")
	}

	fmt.Println("\n--> Flushing Telegram client queue to ensure delivery...")
	telegramClient.Stop()

	fmt.Println("\n==================================================")
	fmt.Println("TEST RESULT: PASS! 429 TRIGGERED & TELEGRAM ALERT DISPATCHED!")
	fmt.Println("Check your Telegram chat/channel for the security alert.")
	fmt.Println("==================================================")
}
