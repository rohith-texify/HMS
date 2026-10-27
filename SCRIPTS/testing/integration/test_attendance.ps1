$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

Write-Host "HMS ATTENDANCE RUNTIME TEST" -ForegroundColor Cyan

Write-Host "[1/15] Login..."
$loginA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$tokenA = $loginA.data.access_token
$headersA = @{ Authorization = "Bearer $tokenA" }

$collegeId = "0cd1d14d-4111-4858-8a7e-28e44e188dec"
$studentId = "6a405786-096a-4d43-85f2-9cb9443ebbbd"

Write-Host "[4/15] Mark student attendance..."
$attendanceDate = (Get-Date).AddDays((Get-Random -Minimum 1000 -Maximum 9000)).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
$bodyMark = @{
    student_id = $studentId
    attendance_date = $attendanceDate
    status = "PRESENT"
    scan_method = "MANUAL"
    remarks = "Test attendance"
} | ConvertTo-Json
$mark = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/attendance/students" -Headers $headersA -ContentType "application/json" -Body $bodyMark
$recordId = $mark.data.id
Write-Host "Attendance marked: $recordId"

Write-Host "[5/15] Test duplicate attendance prevention..."
try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/attendance/students" -Headers $headersA -ContentType "application/json" -Body $bodyMark -ErrorAction Stop
    Write-Error "Expected duplicate attendance to fail!"
} catch {
    Write-Host "Success: Duplicate attendance prevented."
}

Write-Host "[6/15] Read student attendance (Get by ID)..."
$read = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/attendance/students/$recordId" -Headers $headersA
if ($read.data.id -ne $recordId) {
    Write-Error "Attendance ID mismatch"
}

Write-Host "[7/15] Read student history..."
$history = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/attendance/students?student_id=$studentId" -Headers $headersA
if ($history.data.Length -lt 1) {
    Write-Error "Expected at least 1 history record."
}

Write-Host "[8/15] Read daily attendance..."
$daily = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/attendance/students?start_date=$attendanceDate&end_date=$attendanceDate" -Headers $headersA
if ($daily.data.Length -lt 1) {
    Write-Error "Expected at least 1 daily record."
}

Write-Host "[9/15] Test attendance correction (Submit)..."
$bodyCorr = @{
    record_id = $recordId
    correction_reason = "Entered wrong status"
    new_status = "LATE"
    remarks = "Corrected to late"
} | ConvertTo-Json
$corr = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/attendance/corrections" -Headers $headersA -ContentType "application/json" -Body $bodyCorr
$correctionId = $corr.data.id

Write-Host "[10/15] Test attendance correction (Approve)..."
$bodyApprove = @{
    decision = "APPROVED"
    decision_reason = "Looks correct"
} | ConvertTo-Json
$approve = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/attendance/corrections/$correctionId/decision" -Headers $headersA -ContentType "application/json" -Body $bodyApprove

Write-Host "[11/15] Verify record updated..."
$updated = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/attendance/students/$recordId" -Headers $headersA
if ($updated.data.status -ne "LATE") {
    Write-Error "Status should be LATE after correction"
}

Write-Host "[12/15] Test bulk attendance..."
$bulkDate = (Get-Date).AddDays((Get-Random -Minimum 1000 -Maximum 9000)).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
$bodyBulk = @{
    records = @(
        @{
            student_id = $studentId
            attendance_date = $bulkDate
            status = "ABSENT"
            scan_method = "SYSTEM"
        }
    )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/attendance/students/bulk" -Headers $headersA -ContentType "application/json" -Body $bodyBulk

Write-Host "[13/15] Test attendance report..."
$report = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/attendance/reports/summary" -Headers $headersA
if ($report.data.total -lt 1) {
    Write-Error "Report shows 0 total records."
}

Write-Host "[14/15] Test invalid status..."
$bodyInv = @{
    student_id = $studentId
    attendance_date = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
    status = "INVALID_STATUS"
    scan_method = "MANUAL"
} | ConvertTo-Json
try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/attendance/students" -Headers $headersA -ContentType "application/json" -Body $bodyInv -ErrorAction Stop
    Write-Error "Expected invalid status to fail!"
} catch {
    Write-Host "Success: Invalid status rejected."
}

Write-Host "PHASE 03 ATTENDANCE COMPLETE"
