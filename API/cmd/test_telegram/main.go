package main

import (
	"log"

	"go.uber.org/zap"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/notifications/telegram"
)

func main() {
	// Initialize a simple logger
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	// Load configuration from .env
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if !cfg.Telegram.Enabled {
		log.Fatal("TELEGRAM_ALERTS_ENABLED is not set to true in .env")
	}

	// Initialize the Telegram client
	client := telegram.NewClient(cfg.Telegram, logger)

	logger.Info("Sending test alert to Telegram...")

	// Dispatch a safe test event
	client.Notify(telegram.Event{
		Type:        "Manual Test Alert",
		Severity:    "INFO",
		Service:     "HMS API Test Script",
		Endpoint:    "N/A",
		LimitInfo:   "N/A",
		ClientIP:    "127.0.0.1",
		Description: "This is a safe verification test to confirm Telegram connectivity.",
	})

	// client.Stop() will wait for the bounded queue to drain the message to Telegram
	client.Stop()
	logger.Info("Test script finished successfully.")
}
