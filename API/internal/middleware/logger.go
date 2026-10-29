package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		fields := []zap.Field{
			zap.String("request_id", getRequestID(c)),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", status),
			zap.Duration("duration", duration),
			zap.String("client_ip", c.ClientIP()),
		}

		if tenantID := getContextTenantID(c); tenantID != "" {
			fields = append(fields, zap.String("tenant_id", tenantID))
		}

		switch {
		case status >= 500:
			fields = append(fields, zap.String("error_category", "SERVER_ERROR"))
			logger.Error("http request error", fields...)
		case status >= 400:
			fields = append(fields, zap.String("error_category", "CLIENT_ERROR"))
			logger.Warn("http request warning", fields...)
		default:
			logger.Info("http request", fields...)
		}
	}
}

func getContextTenantID(c *gin.Context) string {
	if val, exists := c.Get(TenantIDContextKey); exists && val != nil {
		if id, ok := val.(string); ok {
			return id
		}
		return fmt.Sprintf("%v", val)
	}
	return ""
}

func getRequestID(c *gin.Context) string {
	requestID, exists := c.Get("request_id")
	if !exists {
		return ""
	}

	value, ok := requestID.(string)
	if !ok {
		return ""
	}

	return value
}
