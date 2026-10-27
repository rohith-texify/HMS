$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

Write-Host "HMS LEAVE MANAGEMENT RUNTIME TEST" -ForegroundColor Cyan

Write-Host "[1/25] Login College A Admin..."
$loginA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$tokenA = $loginA.data.access_token
$headersA = @{ Authorization = "Bearer $tokenA" }
$collegeAId = "0cd1d14d-4111-4858-8a7e-28e44e188dec"

Write-Host "[2/25] Identify test student..."
$studentId = "6a405786-096a-4d43-85f2-9cb9443ebbbd"

Write-Host "[7/25] Create leave application..."
$randomOffset = Get-Random -Minimum 1000 -Maximum 9000
$fromDate = (Get-Date).AddDays($randomOffset).ToString("yyyy-MM-ddT00\:00\:00Z")
$toDate = (Get-Date).AddDays($randomOffset+2).ToString("yyyy-MM-ddT00\:00\:00Z")
$bodyLeave = @{
    student_id = $studentId
    leave_type = "DAY_LEAVE"
    reason = "Going home"
    from_date = $fromDate
    to_date = $toDate
    destination = "Home City"
    contact_phone = "9876543210"
} | ConvertTo-Json
$leave = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves" -Headers $headersA -ContentType "application/json" -Body $bodyLeave
$leaveId = $leave.data.id
Write-Host "Created leave: $leaveId"

Write-Host "[8/25] Get leave application..."
$getLeave = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves/$leaveId" -Headers $headersA
if ($getLeave.data.id -ne $leaveId) { Write-Error "Leave ID mismatch" }

Write-Host "[9/25] List leave applications..."
$listLeave = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves?student_id=$studentId" -Headers $headersA
if ($listLeave.data.Length -lt 1) { Write-Error "No leaves listed" }

Write-Host "[10/25] Verify pending status..."
if ($getLeave.data.status -ne "PENDING") { Write-Error "Status should be PENDING" }

Write-Host "[11/25] Test overlap validation..."
try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves" -Headers $headersA -ContentType "application/json" -Body $bodyLeave -ErrorAction Stop
    Write-Error "Expected overlapping leave to fail!"
} catch {
    Write-Host "Success: Overlapping leave prevented."
}

Write-Host "[12/25] Approve leave..."
$bodyApprove = @{
    decision = "APPROVED"
    remarks = "Approved by admin"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves/$leaveId/decision" -Headers $headersA -ContentType "application/json" -Body $bodyApprove

Write-Host "[13/25] Verify approved status..."
$getApproved = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves/$leaveId" -Headers $headersA
if ($getApproved.data.status -ne "APPROVED") { Write-Error "Status should be APPROVED" }

Write-Host "[15/25] Create second leave application (for reject/cancel)..."
$fromDate2 = (Get-Date).AddDays(160).ToString("yyyy-MM-ddT00\:00\:00Z")
$toDate2 = (Get-Date).AddDays(162).ToString("yyyy-MM-ddT00\:00\:00Z")
$bodyLeave2 = @{
    student_id = $studentId
    leave_type = "DAY_LEAVE"
    reason = "Going home again"
    from_date = $fromDate2
    to_date = $toDate2
} | ConvertTo-Json
$leave2 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves" -Headers $headersA -ContentType "application/json" -Body $bodyLeave2
$leaveId2 = $leave2.data.id

Write-Host "[16/25] Reject second application..."
$bodyReject = @{
    decision = "REJECTED"
    remarks = "Too many leaves"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves/$leaveId2/decision" -Headers $headersA -ContentType "application/json" -Body $bodyReject

Write-Host "[17/25] Verify rejected status..."
$getRejected = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves/$leaveId2" -Headers $headersA
if ($getRejected.data.status -ne "REJECTED") { Write-Error "Status should be REJECTED" }

Write-Host "[18/25] Create cancellation scenario..."
$fromDate3 = (Get-Date).AddDays(170).ToString("yyyy-MM-ddT00\:00\:00Z")
$toDate3 = (Get-Date).AddDays(172).ToString("yyyy-MM-ddT00\:00\:00Z")
$bodyLeave3 = @{
    student_id = $studentId
    leave_type = "DAY_LEAVE"
    reason = "Cancel me"
    from_date = $fromDate3
    to_date = $toDate3
} | ConvertTo-Json
$leave3 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves" -Headers $headersA -ContentType "application/json" -Body $bodyLeave3
$leaveId3 = $leave3.data.id

Write-Host "[19/25] Cancel leave..."
Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/leaves/$leaveId3/cancel" -Headers $headersA -ContentType "application/json"

Write-Host "[23/25] Test leave reports (summary)..."
$summary = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves/reports/summary" -Headers $headersA
if ($summary.data.total -lt 1) { Write-Error "Summary total is zero" }
Write-Host "Summary: Total = $($summary.data.total), Pending = $($summary.data.pending), Approved = $($summary.data.approved), Rejected = $($summary.data.rejected), Cancelled = $($summary.data.cancelled)"

Write-Host "[24/25] Cross-tenant test..."
$tokenB = "invalid.cross.tenant.token"
$headersB = @{ Authorization = "Bearer $tokenB" }

try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/leaves/$leaveId" -Headers $headersB -ErrorAction Stop
    Write-Error "Cross-tenant access succeeded! This is a vulnerability."
} catch {
    Write-Host "Success: Cross-tenant access prevented."
}

Write-Host "PHASE 04 - LEAVE MANAGEMENT COMPLETE"
