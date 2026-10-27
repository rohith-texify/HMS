# Testing Guide

The HMS API contains both unit tests and a comprehensive integration testing suite.

## Running Unit and Build Tests

From the repository root (`D:\HMS`), execute standard Go tooling:

```powershell
# Format code
go fmt ./...

# Static analysis
go vet ./...

# Run unit tests
go test ./...

# Build binary
go build ./...

# Verify modules
go mod verify
```

*(Note: `go test -race` requires CGO to be enabled, which is not available by default on Windows without GCC).*

## Running Integration Tests

The integration tests are written in PowerShell (`*.ps1`) and execute full E2E flows against a live, local API instance.

### Prerequisites
1. Ensure the PostgreSQL database is running, migrated, and seeded.
2. Start the API locally in another terminal (`go run API/cmd/server/main.go`).

### Execution
Run the master test runner from the repository root:

```powershell
.\integration_test_runner.ps1
```

This script executes all modules in sequence:
1. `test_hostel_ops.ps1`
2. `test_hostel_allocation.ps1`
3. `test_attendance.ps1`
4. `test_leave.ps1`
5. `test_mess.ps1`
6. `test_complaints_maintenance.ps1`
7. `test_notifications.ps1`
8. `test_reports.ps1`
9. `test_cross_tenant.ps1`

### Cross-Tenant Tests
The `test_cross_tenant.ps1` script (and the end of each module script) explicitly tests that College B cannot access College A's data. 
Because `Invoke-RestMethod` throws a PowerShell exception on HTTP 403 Forbidden (which is the desired result), these scripts use `try/catch` logic. A successful denial confirms tenant isolation is working perfectly.
