package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TimingMiddleware logs request duration and database query time
// Helps identify bottlenecks in production (Render cold start vs DB latency)
func TimingMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		requestID := c.GetString("request_id")

		// Before request
		c.Set("request_start_time", start)
		c.Set("db_query_times", []map[string]interface{}{})

		// Process request
		c.Next()

		// Calculate total duration
		duration := time.Since(start)
		statusCode := c.Writer.Status()

		// Get database query times from context
		dbTimes, _ := c.Get("db_query_times")
		dbTimesSlice, ok := dbTimes.([]map[string]interface{})
		if !ok {
			dbTimesSlice = []map[string]interface{}{}
		}

		// Calculate total database time
		var totalDBTime time.Duration
		for _, queryTime := range dbTimesSlice {
			if t, ok := queryTime["duration"].(time.Duration); ok {
				totalDBTime += t
			}
		}

		// Calculate backend processing time (excluding DB)
		backendTime := duration - totalDBTime

		// Log with detailed timing breakdown
		logLevel := zap.InfoLevel
		if statusCode >= 400 {
			logLevel = zap.WarnLevel
		}

		logger.Log(
			logLevel,
			"request_timing",
			zap.String("request_id", requestID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", statusCode),
			zap.Duration("total_time", duration),
			zap.Duration("backend_time", backendTime),
			zap.Duration("total_db_time", totalDBTime),
			zap.Int("db_queries", len(dbTimesSlice)),
			zap.Any("db_query_details", dbTimesSlice),
		)
	}
}

// LogQueryTiming records a database query's execution time
// Call this after every database query to track timing
func LogQueryTiming(c *gin.Context, queryName string, duration time.Duration, rowsAffected int64) {
	dbTimes, _ := c.Get("db_query_times")
	dbTimesSlice, ok := dbTimes.([]map[string]interface{})
	if !ok {
		dbTimesSlice = []map[string]interface{}{}
	}

	dbTimesSlice = append(dbTimesSlice, map[string]interface{}{
		"query":       queryName,
		"duration":    duration,
		"duration_ms": duration.Milliseconds(),
		"rows":        rowsAffected,
	})

	c.Set("db_query_times", dbTimesSlice)
}
