package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/notifications/telegram"
	"github.com/yourusername/hostel-management-system/API/internal/server"
)

func main() {
	processStartTime := time.Now()
	
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	loggerInitTime := time.Since(processStartTime)

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal(
			"failed to load configuration",
			zap.Error(err),
		)
	}

	configLoadTime := time.Since(processStartTime)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	dbConnectStart := time.Now()
	db, err := database.New(ctx, cfg.Database)
	if err != nil {
		logger.Fatal(
			"failed to connect to PostgreSQL",
			zap.Error(err),
		)
	}
	dbConnectTime := time.Since(dbConnectStart)
	defer db.Close()

	totalStartupTime := time.Since(processStartTime)

	logger.Info("PostgreSQL connection established")
	database.AutoMigrateAndSeed(context.Background(), db.PlatformPool, logger)
	logger.Info(
		"startup_timing",
		zap.Duration("logger_init_ms", loggerInitTime),
		zap.Duration("config_load_ms", configLoadTime),
		zap.Duration("db_connect_ms", dbConnectTime),
		zap.Duration("total_startup_ms", totalStartupTime),
	)

	jwtService := auth.NewJWTService(
		cfg.JWT.Secret,
		cfg.JWT.Issuer,
		cfg.JWT.Audience,
		time.Duration(cfg.JWT.AccessTokenMinutes)*time.Minute,
	)

	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	telegramClient := telegram.NewClient(cfg.Telegram, logger)

	router := server.NewRouter(
		logger,
		db,
		jwtService,
		cfg,
		telegramClient,
	)

	srv := &http.Server{
		Addr:    "0.0.0.0:" + cfg.Server.Port,
		Handler: router,

		ReadHeaderTimeout: 15 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       300 * time.Second,

		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	logger.Info(
		"starting HMS API server",
		zap.String("address", ":"+cfg.Server.Port),
	)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("failed to start HMS API server", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down server...")

	ctxShutDown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShutDown); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	// Wait for Telegram client to drain any pending operational alerts
	telegramClient.Stop()

	logger.Info("server exited safely")
}
