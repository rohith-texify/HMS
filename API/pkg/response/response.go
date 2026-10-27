package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

type ErrorResponse struct {
	Success   bool        `json:"success"`
	Error     interface{} `json:"error"`
	RequestID string      `json:"request_id,omitempty"`
}

func JSON(c *gin.Context, status int, data interface{}, meta interface{}) {
	c.JSON(status, Response{
		Success: true,
		Data:    data,
		Meta:    meta,
	})
}

func OK(c *gin.Context, data interface{}) {
	JSON(c, http.StatusOK, data, nil)
}

func Created(c *gin.Context, data interface{}) {
	JSON(c, http.StatusCreated, data, nil)
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func WithMeta(c *gin.Context, status int, data interface{}, meta interface{}) {
	JSON(c, status, data, meta)
}
