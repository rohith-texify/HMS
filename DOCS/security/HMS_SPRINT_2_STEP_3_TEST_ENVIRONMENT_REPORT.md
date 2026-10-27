# HMS Sprint 2 — Step 3: Disposable PostgreSQL 16 Test Environment Report

**Project Root:** `D:\HMS`  
**Date:** October 17, 2026  
**Status:** Complete  
**Author:** Antigravity Autonomous Security Engineer  

---

## 1. Executive Verdict

**Verdict:** `READY`

A dedicated, isolated, and disposable PostgreSQL 16 instance has been successfully provisioned, verified, and prepared for Sprint 2 Step 4 migration and security testing.

### Key Environment Parameters

| Parameter | Verified Value | Status |
| :--- | :--- | :--- |
| **Executive Verdict** | `READY` | Verified |
| **Container Name** | `hms_phase19_9_postgres16_test` | Running |
| **Container ID** | `109ca7d11b0d80255e7838edf16e0f1bafc3b509d2ff282544097efe8a704028` | Running |
| **Image Tag** | `postgres:16-alpine` | Verified |
| **Image Digest** | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` | Verified |
| **PostgreSQL Version** | `PostgreSQL 16.15 on x86_64-pc-linux-musl` | Verified (Major 16) |
| **Host Port Binding** | `127.0.0.1:5433` -> `5432/tcp` (Localhost loopback only) | Verified |
| **Test Database Name** | `hms_migration_test` | Verified |
| **Initial Test Administrator** | `hms_test_admin` | Verified |
| **Storage Mount** | Dedicated named volume `hms_phase19_9_postgres16_test_data` | Verified Isolated |
| **Development DB Separation** | Port `5432` untouched; zero mounts to dev directory | Complete Isolation |
| **Migration / Schema State** | 0 application tables in `public` schema; zero migrations run | Clean & Ready |

---

## 2. Docker Installation and Daemon Status

1. **Docker CLI:**
   - Version: `Docker version 29.7.2, build a7dcaa6`
   - Location: `C:\Users\rohit\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`
2. **Docker Desktop Backend:**
   - Daemon binary: `C:\Users\rohit\AppData\Local\Programs\DockerDesktop\resources\com.docker.backend.exe`
   - Daemon Status: Running and responsive via named pipe `\\.\pipe\docker_cli` / `dockerDesktopLinuxEngine`.
   - Runtime Environment: Linux 6.18.33.2-microsoft-standard-WSL2 (x86_64), containerd `aad11006b869517fcd3009450b6f82da282e1a9b`, runc `v1.4.3`.
   - Context: `desktop-linux`.

---

## 3. Container Provisioning & Configuration

The test container was provisioned with strict compliance to all isolation and credential protection boundaries:

- **Container Name:** `hms_phase19_9_postgres16_test`
- **Base Image:** `postgres:16-alpine` (PostgreSQL 16.15)
- **Host Binding:** `-p 127.0.0.1:5433:5432` (exclusively bound to IPv4 loopback `127.0.0.1`; not bound to `0.0.0.0` or external network adapters).
- **Database:** `hms_migration_test` (dedicated migration test catalog).
- **Initial Administrator:** `hms_test_admin` (dedicated temporary administrator for DDL/migration execution).
- **Password Generation & Secret Protection:**
  - A cryptographically strong 32-byte pseudo-random password was generated locally via `[System.Security.Cryptography.RandomNumberGenerator]`.
  - The secret was written exclusively to a session scratch file located outside the workspace:  
    `C:\Users\rohit\.gemini\antigravity-ide\brain\9549ce15-0cad-456b-8209-732c99eb4301\scratch\pg_pass.env`
  - Passed to Docker via `--env-file` to prevent exposing passwords in process command line arguments (`Get-Process`, Task Manager) or shell history.
  - No credentials were printed to stdout/stderr, written to project source code, or saved in `D:\HMS\.env`.
- **Volume Isolation:**
  - Storage is mounted to dedicated Docker named volume `hms_phase19_9_postgres16_test_data` at `/var/lib/postgresql/data`.
  - Zero host directory mounts; no connection or mount to the development database's files.

---

## 4. Verification and Readiness Evidence

### 4.1. Container State & Port Binding Inspection

```bash
docker inspect --format "Status: {{.State.Status}} | Ports: {{json .NetworkSettings.Ports}} | Mounts: {{json .Mounts}}" hms_phase19_9_postgres16_test
```
**Output:**
```json
Status: running | Ports: {"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"5433"}]} | Mounts: [{"Type":"volume","Name":"hms_phase19_9_postgres16_test_data","Source":"/var/lib/docker/volumes/hms_phase19_9_postgres16_test_data/_data","Destination":"/var/lib/postgresql/data","Driver":"local","Mode":"z","RW":true,"Propagation":""}]
```

### 4.2. In-Container Database & Server Version Query

```bash
docker exec hms_phase19_9_postgres16_test psql -U hms_test_admin -d hms_migration_test -t -A -c "SHOW server_version; SELECT current_database(), current_user; SELECT datname FROM pg_database WHERE datistemplate = false; SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```
**Output:**
```text
16.15
hms_migration_test|hms_test_admin
postgres
hms_migration_test
0
```

### 4.3. In-Container Health Check

```bash
docker exec hms_phase19_9_postgres16_test pg_isready -h localhost -p 5432 -U hms_test_admin -d hms_migration_test
```
**Output:**
```text
localhost:5432 - accepting connections
```
**Exit Code:** `0`

### 4.4. Host Loopback TCP Connectivity Check

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5433
```
**Output:**
```text
ComputerName     : 127.0.0.1
RemoteAddress    : 127.0.0.1
RemotePort       : 5433
InterfaceAlias   : Loopback Pseudo-Interface 1
SourceAddress    : 127.0.0.1
TcpTestSucceeded : True
```

### 4.5. Host Application-Level PostgreSQL Connection Check

A scratch verification client using Go `github.com/jackc/pgx/v5` connected from the host environment to `127.0.0.1:5433` using the credentials from `pg_pass.env` and verified database responses:

```text
HOST_CONNECTION_SUCCESS: true
SERVER_VERSION: PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
CURRENT_DATABASE: hms_migration_test
CURRENT_USER: hms_test_admin
CONTAINER_INTERNAL_PORT: 5432
HOST_PORT_CONNECTED: 5433
```
**Exit Code:** `0`

---

## 5. Development Database Isolation Guarantees

1. **Port Separation:**
   - Development database listens on `5432` (`PID 10476`).
   - Disposable test container listens on `5433`.
   - Port `5432` was strictly off-limits and was never contacted, queried, or modified at any point during this step.
2. **Filesystem Isolation:**
   - The test container uses an isolated Docker volume (`hms_phase19_9_postgres16_test_data`).
   - Zero bind mounts connect the test container to the host or the development database data directory.
3. **Database Catalog Isolation:**
   - Catalogs present in the test instance: `postgres` and `hms_migration_test`.
   - The development database catalogs (`hms_db` / `hms_dev`) do not exist in the test container.
4. **Clean Schema Baseline:**
   - `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';` returned `0`.
   - No application schema, migrations, tables, types, or roles have been executed yet.

---

## 6. Safe Connection Plan for Sprint 2 Step 4

Sprint 2 Step 4 will execute canonical migrations (`000_extensions.sql` through `903_seed.sql`) against this disposable instance and perform RLS security validation.

### 6.1. Secure Injection of `TEST_DATABASE_URL`

To avoid saving passwords in source code, shell history, `.env`, or commit logs:

1. **Environment Secret Location:**
   - The generated password remains stored in:  
     `C:\Users\rohit\.gemini\antigravity-ide\brain\9549ce15-0cad-456b-8209-732c99eb4301\scratch\pg_pass.env`
2. **Process-Scoped Ingestion:**
   Step 4 test runners or PowerShell processes should load the connection string dynamically for the duration of the test process only:
   ```powershell
   $testPwd = (Get-Content "C:\Users\rohit\.gemini\antigravity-ide\brain\9549ce15-0cad-456b-8209-732c99eb4301\scratch\pg_pass.env" | Select-String "POSTGRES_PASSWORD=").ToString().Split('=')[1].Trim()
   $env:TEST_DATABASE_URL = "postgres://hms_test_admin:$testPwd@127.0.0.1:5433/hms_migration_test?sslmode=disable"
   ```
3. **Permanent Config Protection:**
   - `D:\HMS\.env` will **not** be modified.
   - When the test session terminates, `$env:TEST_DATABASE_URL` is automatically purged from memory.

### 6.2. Role Identity Plan for Step 4 Execution

| Phase | Identity | Role Scope | Intended Use |
| :--- | :--- | :--- | :--- |
| **Migration Runner** | `hms_test_admin` | Temporary Superuser / Admin | Executing migrations `000` through `903`, creating extensions, schemas, tables, indexes, and initial roles. |
| **Super Admin Platform Tests** | `hms_platform_admin` (or `hms_admin`) | Non-tenant Platform Identity | Validating platform approval workflows, global audit logs, system-level transactions with `app.is_super_admin = 'true'`. |
| **College Admin RLS Tests** | `hms_college_admin` | Restricted Tenant Admin | Validating tenant isolation; verifying college-level policies with `app.current_college_id`. |
| **Student RLS Tests** | `hms_student` | Restricted Student Role | Validating row filtering on `student_id` and `college_id`; verifying student cannot read other students' room allocations or complaints. |
| **Parent RLS Tests** | `hms_parent` | Restricted Parent Role | Validating linked student data access and tenant boundary enforcement. |
| **Hostel Staff / Warden Tests** | `hms_warden` | Restricted Warden Role | Validating hostel-specific movement, attendance, and leave approval permissions. |
| **Unauthenticated / Anonymous** | `hms_anonymous` / none | No Session Context | Validating that queries without authenticated tenant context fail closed. |

> [!IMPORTANT]
> Per Critical Safety Rule #7, superuser `hms_test_admin` will **never** be used to assert that RLS policies work. Restricted application roles will be provisioned in Step 4 and evaluated under active RLS session settings (`SET LOCAL app.current_college_id = ...`).

---

## 7. Execution Log & Actual Exit Results

The following table documents all primary commands executed during environment discovery, provisioning, and readiness verification:

| Command | Purpose | Exit Code | Result Summary |
| :--- | :--- | :---: | :--- |
| `docker info` | Inspect Docker daemon status | `0` | Daemon active (v29.7.2, WSL2 backend) |
| `docker context ls` | Check active Docker contexts | `0` | Active context: `desktop-linux` |
| `Get-NetTCPConnection -LocalPort 5433` | Confirm port 5433 availability | `1` (No conn) | Port 5433 confirmed free |
| `docker ps -a --filter "name=hms_phase19_9_postgres16_test"` | Pre-creation container check | `0` | No existing container with requested name |
| `docker volume inspect hms_phase19_9_postgres16_test_data` | Pre-creation volume check | `1` | Volume did not pre-exist |
| `docker pull postgres:16-alpine` | Retrieve verified PostgreSQL 16 image | `0` | Image downloaded (`postgres:16.15-alpine`, sha256:721873c34ceb...) |
| `docker run -d --name hms_phase19_9_postgres16_test -p 127.0.0.1:5433:5432 ...` | Provision disposable test container | `0` | Container ID `109ca7d11b0d80255e7838edf16e0f1bafc3b509d2ff282544097efe8a704028` |
| `docker inspect hms_phase19_9_postgres16_test` | Verify status, ports, and mounts | `0` | State: `running`, HostPort: `5433`, Mount: dedicated volume |
| `docker exec hms_phase19_9_postgres16_test psql ... "SHOW server_version;"` | Verify server major version | `0` | Version `16.15` confirmed |
| `docker exec hms_phase19_9_postgres16_test psql ... "SELECT count(*) ..."` | Verify clean schema baseline | `0` | `0` public tables present |
| `docker exec hms_phase19_9_postgres16_test pg_isready ...` | In-container health check | `0` | Accepting connections |
| `Test-NetConnection -ComputerName 127.0.0.1 -Port 5433` | Host loopback TCP verification | `0` | `TcpTestSucceeded: True` |
| `go run scratch/check_conn.go` | Host pgx driver authenticated query | `0` | Authenticated query successful over port 5433 |

---

## 8. Confirmations & Next Steps

1. **Development Database Untouched:** The PostgreSQL development server on port `5432` was strictly isolated and was never accessed, queried, or altered.
2. **Source Code & Backups Preserved:** All existing code in `API/`, `MODULES/`, `DATABASE/`, and existing backups in `BACKUPS/` (`phase_19_9_pre_remediation_backup`, `phase_19_10_post_remediation_backup`, `sprint_1_step_2_pre_implementation_backup`) remain completely untouched.
3. **No Migration SQL Executed:** No DDL, schema files, or migration scripts were run against `hms_migration_test`.
4. **Environment Kept Alive:** The container `hms_phase19_9_postgres16_test` remains running and ready for Sprint 2 Step 4.
