.PHONY: help dev build test clean install migrate-up migrate-down migrate-create docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  make install         - Install all dependencies (Go + Node)"
	@echo "  make dev            - Run backend server in development mode"
	@echo "  make build          - Build backend binary"
	@echo "  make test           - Run all tests"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make migrate-up     - Run database migrations"
	@echo "  make migrate-down   - Rollback database migrations"
	@echo "  make migrate-create - Create new migration (name=migration_name)"
	@echo "  make docker-up      - Start Docker services"
	@echo "  make docker-down    - Stop Docker services"
	@echo "  make lint           - Run linters"

install:
	@echo "Installing Go dependencies..."
	go mod download
	go mod tidy
	@echo "Installing Node dependencies..."
	npm install
	npm run install:modules
	@echo "Dependencies installed successfully!"

dev:
	@echo "Starting backend server in development mode..."
	go run API/cmd/server/main.go

build:
	@echo "Building backend binary..."
	go build -o bin/server API/cmd/server/main.go
	@echo "Build complete! Binary: bin/server"

test:
	@echo "Running backend tests..."
	go test -v ./...
	@echo "Running frontend tests..."
	npm test

clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -rf dist/
	rm -rf node_modules/
	rm -rf MODULES/*/FRONTEND/WEB/node_modules/
	rm -rf MODULES/*/FRONTEND/WEB/dist/
	@echo "Clean complete!"

migrate-up:
	@echo "Running database migrations..."
	go run SCRIPTS/database/migrate.go up

migrate-down:
	@echo "Rolling back database migrations..."
	go run SCRIPTS/database/migrate.go down

migrate-create:
	@echo "Creating new migration: $(name)"
	@timestamp=$$(date +%s); \
	touch DATABASE/migrations/$${timestamp}_$(name).up.sql; \
	touch DATABASE/migrations/$${timestamp}_$(name).down.sql; \
	echo "Created migration files with timestamp: $${timestamp}"

docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "Docker services started!"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down
	@echo "Docker services stopped!"

lint:
	@echo "Running Go linter..."
	golangci-lint run ./...
	@echo "Running ESLint..."
	npm run lint

fmt:
	@echo "Formatting Go code..."
	go fmt ./...
	@echo "Formatting complete!"

.DEFAULT_GOAL := help
