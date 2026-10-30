package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

func CORS(config CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin != "" && isAllowedOrigin(origin, config.AllowedOrigins) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}

		c.Header(
			"Access-Control-Allow-Methods",
			joinValues(config.AllowedMethods),
		)

		c.Header(
			"Access-Control-Allow-Headers",
			joinValues(config.AllowedHeaders),
		)

		c.Header(
			"Access-Control-Allow-Credentials",
			"true",
		)

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	for _, allowedOrigin := range allowedOrigins {
		if allowedOrigin == "*" {
			return true
		}
		if origin == allowedOrigin {
			return true
		}
		// Support Vercel deployment preview subdomains (e.g. https://*.vercel.app)
		if allowedOrigin == "https://*.vercel.app" || allowedOrigin == "*.vercel.app" {
			if strings.HasPrefix(origin, "https://") && strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
		}
		// Support Render deployment subdomains (e.g. https://*.onrender.com)
		if allowedOrigin == "https://*.onrender.com" || allowedOrigin == "*.onrender.com" {
			if strings.HasPrefix(origin, "https://") && strings.HasSuffix(origin, ".onrender.com") {
				return true
			}
		}
	}

	// Always permit any Vercel or Render domain preview for this platform
	if strings.HasPrefix(origin, "https://") && (strings.HasSuffix(origin, ".vercel.app") || strings.HasSuffix(origin, ".onrender.com")) {
		return true
	}

	return false
}

func joinValues(values []string) string {
	result := ""

	for i, value := range values {
		if i > 0 {
			result += ", "
		}

		result += value
	}

	return result
}
