package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/hostel-management-system/API/internal/config"
)

type Event struct {
	Type        string
	Severity    string
	Service     string
	Endpoint    string
	LimitInfo   string
	ClientIP    string
	Description string
}

type Client struct {
	cfg        config.TelegramConfig
	logger     *zap.Logger
	httpClient *http.Client
	eventChan  chan Event
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc

	// Cooldown tracking
	mu         sync.Mutex
	lastAlerts map[string]time.Time
}

func NewClient(cfg config.TelegramConfig, logger *zap.Logger) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		cfg:    cfg,
		logger: logger,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second,
		},
		eventChan:  make(chan Event, 100), // Bounded queue
		ctx:        ctx,
		cancel:     cancel,
		lastAlerts: make(map[string]time.Time),
	}

	if cfg.Enabled {
		c.wg.Add(1)
		go c.worker()
	}

	return c
}

func (c *Client) Notify(event Event) {
	if !c.cfg.Enabled {
		return
	}

	select {
	case c.eventChan <- event:
		// Successfully queued
	default:
		// Queue is full, drop the alert to prevent memory exhaustion
		c.logger.Warn("Telegram alert queue is full, dropping alert", zap.String("type", event.Type))
	}
}

func (c *Client) Stop() {
	c.cancel()
	c.wg.Wait()
}

func (c *Client) worker() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			// Attempt to drain remaining events in a bounded manner
			c.drain()
			return
		case event := <-c.eventChan:
			c.processEvent(event)
		}
	}
}

func (c *Client) drain() {
	// Try to process up to 10 remaining events before shutting down completely
	count := 0
	for {
		select {
		case event := <-c.eventChan:
			c.processEvent(event)
			count++
			if count >= 10 {
				return
			}
		default:
			return
		}
	}
}

func (c *Client) processEvent(event Event) {
	// Cooldown check (Deduplication)
	key := fmt.Sprintf("%s:%s", event.Type, event.ClientIP)

	c.mu.Lock()
	lastTime, exists := c.lastAlerts[key]
	if exists && time.Since(lastTime) < time.Duration(c.cfg.CooldownSeconds)*time.Second {
		c.mu.Unlock()
		// Suppressed due to cooldown
		c.logger.Debug("Telegram alert suppressed due to cooldown", zap.String("key", key))
		return
	}
	c.lastAlerts[key] = time.Now()

	// Cleanup old entries (simple approach: clear map if it gets too large)
	if len(c.lastAlerts) > 1000 {
		c.lastAlerts = make(map[string]time.Time)
		c.lastAlerts[key] = time.Now()
	}
	c.mu.Unlock()

	message := fmt.Sprintf(
		"🚨 *HMS API SECURITY ALERT*\n\n*Event:* %s\n*Severity:* %s\n*Service:* %s\n*Endpoint:* %s\n*Time:* %s\n*Requests:* %s\n*Client Reference:* %s\n*Action:* %s",
		event.Type,
		event.Severity,
		event.Service,
		event.Endpoint,
		time.Now().UTC().Format(time.RFC3339),
		event.LimitInfo,
		event.ClientIP,
		event.Description,
	)

	payload := map[string]interface{}{
		"chat_id":    c.cfg.ChatID,
		"text":       message,
		"parse_mode": "Markdown",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		c.logger.Error("Failed to marshal telegram payload", zap.Error(err))
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", c.cfg.BotToken)

	// Use a fresh context for the HTTP request so it doesn't get aborted if the worker is shutting down (draining)
	reqCtx, reqCancel := context.WithTimeout(context.Background(), time.Duration(c.cfg.TimeoutSeconds)*time.Second)
	defer reqCancel()

	// Bounded retries (3 attempts max)
	for i := 0; i < 3; i++ {
		req, err := http.NewRequestWithContext(reqCtx, "POST", url, bytes.NewBuffer(body))
		if err != nil {
			c.logger.Error("Failed to create telegram request", zap.Error(err))
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			c.logger.Warn("Failed to send telegram alert (retrying)", zap.Error(err), zap.Int("attempt", i+1))
			time.Sleep(1 * time.Second)
			continue
		}

		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			c.logger.Info("Telegram alert sent successfully", zap.String("event", event.Type))
			return
		} else {
			c.logger.Warn("Telegram API returned non-success status (retrying)", zap.Int("status", resp.StatusCode), zap.Int("attempt", i+1))
			time.Sleep(1 * time.Second)
		}
	}

	c.logger.Error("Failed to send telegram alert after retries", zap.String("event", event.Type))
}
