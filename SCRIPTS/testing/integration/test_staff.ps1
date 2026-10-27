# ============================================================
# HMS - STAFF RUNTIME TEST
# ============================================================

$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

$CollegeID = "0cd1d14d-4111-4858-8a7e-28e44e188dec"

# Existing ACTIVE college user with no staff profile
$UserID = "28c1a090-ac64-413f-ade2-bddbee1cca2f"

$Email = "college.admin@hms.local"
$Password = "HMS@Dev123"

Write-Host ""
Write-Host "============================================================"
Write-Host " HMS STAFF RUNTIME TEST"
Write-Host "============================================================"
Write-Host ""

function Test-Result {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail = ""
    )

    if ($Passed) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }

    if ($Detail -ne "") {
        Write-Host "       $Detail"
    }
}

function Get-JsonValue {
    param(
        $Object,
        [string[]]$Paths
    )

    foreach ($Path in $Paths) {
        $Current = $Object

        foreach ($Part in $Path.Split(".")) {
            if ($null -eq $Current) {
                break
            }

            $Property = $Current.PSObject.Properties[$Part]

            if ($null -eq $Property) {
                $Current = $null
                break
            }

            $Current = $Property.Value
        }

        if ($null -ne $Current -and "$Current" -ne "") {
            return $Current
        }
    }

    return $null
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token = "",
        $Body = $null
    )

    $Headers = @{
        "Content-Type" = "application/json"
    }

    if ($Token -ne "") {
        $Headers["Authorization"] = "Bearer $Token"
    }

    try {
        if ($null -eq $Body) {
            $Response = Invoke-WebRequest `
                -Uri $Url `
                -Method $Method `
                -Headers $Headers `
                -UseBasicParsing `
                -ErrorAction Stop
        }
        else {
            $JsonBody = $Body | ConvertTo-Json -Depth 10

            $Response = Invoke-WebRequest `
                -Uri $Url `
                -Method $Method `
                -Headers $Headers `
                -Body $JsonBody `
                -UseBasicParsing `
                -ErrorAction Stop
        }

        $Parsed = $null

        if ($Response.Content) {
            try {
                $Parsed = $Response.Content | ConvertFrom-Json
            }
            catch {
                $Parsed = $Response.Content
            }
        }

        return @{
            StatusCode = [int]$Response.StatusCode
            Body       = $Parsed
            Raw        = $Response.Content
        }
    }
    catch {
        $StatusCode = 0
        $Raw = ""

        if ($_.Exception.Response) {
            try {
                $StatusCode = [int]$_.Exception.Response.StatusCode
            }
            catch {}

            try {
                $Reader = New-Object System.IO.StreamReader(
                    $_.Exception.Response.GetResponseStream()
                )

                $Raw = $Reader.ReadToEnd()
                $Reader.Close()
            }
            catch {}
        }

        $Parsed = $null

        if ($Raw -ne "") {
            try {
                $Parsed = $Raw | ConvertFrom-Json
            }
            catch {
                $Parsed = $Raw
            }
        }

        return @{
            StatusCode = $StatusCode
            Body       = $Parsed
            Raw        = $Raw
        }
    }
}

# ============================================================
# 1. LOGIN
# ============================================================

Write-Host "1. LOGIN"

$LoginBody = @{
    email    = $Email
    password = $Password
}

$Login = Invoke-Api `
    -Method "POST" `
    -Url "$BaseUrl/auth/login" `
    -Body $LoginBody

$Token = Get-JsonValue $Login.Body @(
    "data.access_token",
    "data.token",
    "access_token",
    "token"
)

if ($Login.StatusCode -eq 200 -and $Token) {
    Test-Result "LOGIN" $true
}
else {
    Test-Result "LOGIN" $false "HTTP $($Login.StatusCode)"
    Write-Host $Login.Raw
    exit 1
}

# ============================================================
# 2. LIST BEFORE CREATE
# ============================================================

Write-Host ""
Write-Host "2. LIST STAFF BEFORE CREATE"

$ListBefore = Invoke-Api `
    -Method "GET" `
    -Url "$BaseUrl/college/staff" `
    -Token $Token

if ($ListBefore.StatusCode -eq 200) {
    Test-Result "LIST STAFF" $true
}
else {
    Test-Result "LIST STAFF" $false "HTTP $($ListBefore.StatusCode)"
    Write-Host $ListBefore.Raw
    exit 1
}

# ============================================================
# 3. CREATE STAFF
# ============================================================

Write-Host ""
Write-Host "3. CREATE STAFF"

$CreateBody = @{
    user_id           = $UserID
    employee_number   = "EMP-TEST-001"
    first_name        = "Test"
    middle_name       = "Runtime"
    last_name         = "Staff"
    designation       = "Test Staff"
    department_id     = ""
    phone             = "9876543210"
    alternate_phone   = "9876543211"
    email             = "test.staff@hms.local"
    joining_date      = "2026-10-07"
    employment_status = "ACTIVE"
}

$Create = Invoke-Api `
    -Method "POST" `
    -Url "$BaseUrl/college/staff" `
    -Token $Token `
    -Body $CreateBody

if ($Create.StatusCode -eq 201) {
    Test-Result "CREATE STAFF" $true
}
else {
    Test-Result "CREATE STAFF" $false "HTTP $($Create.StatusCode)"
    Write-Host $Create.Raw
    exit 1
}

$StaffID = Get-JsonValue $Create.Body @(
    "data.id",
    "data.staff_id",
    "id",
    "staff_id"
)

if (-not $StaffID) {
    Write-Host ""
    Write-Host "Could not extract staff ID from response." -ForegroundColor Red
    Write-Host $Create.Raw
    exit 1
}

Write-Host "       Staff ID: $StaffID"

# ============================================================
# 4. GET STAFF
# ============================================================

Write-Host ""
Write-Host "4. GET STAFF"

$Get = Invoke-Api `
    -Method "GET" `
    -Url "$BaseUrl/college/staff/$StaffID" `
    -Token $Token

if ($Get.StatusCode -eq 200) {
    Test-Result "GET STAFF" $true
}
else {
    Test-Result "GET STAFF" $false "HTTP $($Get.StatusCode)"
    Write-Host $Get.Raw
}

# ============================================================
# 5. UPDATE STAFF
# ============================================================

Write-Host ""
Write-Host "5. UPDATE STAFF"

$UpdateBody = @{
    employee_number = "EMP-TEST-001"
    first_name      = "Updated"
    middle_name     = "Runtime"
    last_name       = "Staff"
    designation     = "Senior Test Staff"
    department_id   = ""
    phone           = "9999999999"
    alternate_phone = "9999999998"
    email           = "updated.staff@hms.local"
    joining_date    = "2026-10-07"
}

$Update = Invoke-Api `
    -Method "PUT" `
    -Url "$BaseUrl/college/staff/$StaffID" `
    -Token $Token `
    -Body $UpdateBody

if ($Update.StatusCode -eq 200) {
    Test-Result "UPDATE STAFF" $true
}
else {
    Test-Result "UPDATE STAFF" $false "HTTP $($Update.StatusCode)"
    Write-Host $Update.Raw
}

# ============================================================
# 6. STATUS -> SUSPENDED
# ============================================================

Write-Host ""
Write-Host "6. STATUS -> SUSPENDED"

$StatusBody = @{
    status = "SUSPENDED"
}

$Suspended = Invoke-Api `
    -Method "PATCH" `
    -Url "$BaseUrl/college/staff/$StaffID/status" `
    -Token $Token `
    -Body $StatusBody

if ($Suspended.StatusCode -eq 200) {
    Test-Result "STATUS SUSPENDED" $true
}
else {
    Test-Result "STATUS SUSPENDED" $false "HTTP $($Suspended.StatusCode)"
    Write-Host $Suspended.Raw
}

# ============================================================
# 7. STATUS -> ACTIVE
# ============================================================

Write-Host ""
Write-Host "7. STATUS -> ACTIVE"

$StatusBody = @{
    status = "ACTIVE"
}

$Active = Invoke-Api `
    -Method "PATCH" `
    -Url "$BaseUrl/college/staff/$StaffID/status" `
    -Token $Token `
    -Body $StatusBody

if ($Active.StatusCode -eq 200) {
    Test-Result "STATUS ACTIVE" $true
}
else {
    Test-Result "STATUS ACTIVE" $false "HTTP $($Active.StatusCode)"
    Write-Host $Active.Raw
}

# ============================================================
# 8. STATUS -> RESIGNED
# ============================================================

Write-Host ""
Write-Host "8. STATUS -> RESIGNED"

$StatusBody = @{
    status = "RESIGNED"
}

$Resigned = Invoke-Api `
    -Method "PATCH" `
    -Url "$BaseUrl/college/staff/$StaffID/status" `
    -Token $Token `
    -Body $StatusBody

if ($Resigned.StatusCode -eq 200) {
    Test-Result "STATUS RESIGNED" $true
}
else {
    Test-Result "STATUS RESIGNED" $false "HTTP $($Resigned.StatusCode)"
    Write-Host $Resigned.Raw
}

# ============================================================
# 9. INVALID STATUS
# ============================================================

Write-Host ""
Write-Host "9. INVALID STATUS"

$InvalidStatusBody = @{
    status = "INVALID_STATUS"
}

$InvalidStatus = Invoke-Api `
    -Method "PATCH" `
    -Url "$BaseUrl/college/staff/$StaffID/status" `
    -Token $Token `
    -Body $InvalidStatusBody

if ($InvalidStatus.StatusCode -eq 400) {
    Test-Result "INVALID STATUS -> 400" $true
}
else {
    Test-Result "INVALID STATUS -> 400" $false "HTTP $($InvalidStatus.StatusCode)"
    Write-Host $InvalidStatus.Raw
}

# ============================================================
# 10. INVALID STAFF UUID
# ============================================================

Write-Host ""
Write-Host "10. INVALID STAFF UUID"

$InvalidUUID = Invoke-Api `
    -Method "GET" `
    -Url "$BaseUrl/college/staff/not-a-uuid" `
    -Token $Token

if ($InvalidUUID.StatusCode -eq 400) {
    Test-Result "INVALID STAFF UUID -> 400" $true
}
else {
    Test-Result "INVALID STAFF UUID -> 400" $false "HTTP $($InvalidUUID.StatusCode)"
    Write-Host $InvalidUUID.Raw
}

# ============================================================
# 11. MISSING STAFF
# ============================================================

Write-Host ""
Write-Host "11. MISSING STAFF"

$MissingStaffID = "11111111-1111-1111-1111-111111111111"

$Missing = Invoke-Api `
    -Method "GET" `
    -Url "$BaseUrl/college/staff/$MissingStaffID" `
    -Token $Token

if ($Missing.StatusCode -eq 404) {
    Test-Result "MISSING STAFF -> 404" $true
}
else {
    Test-Result "MISSING STAFF -> 404" $false "HTTP $($Missing.StatusCode)"
    Write-Host $Missing.Raw
}

# ============================================================
# 12. DUPLICATE USER
# ============================================================

Write-Host ""
Write-Host "12. DUPLICATE USER"

$DuplicateBody = @{
    user_id           = $UserID
    employee_number   = "EMP-TEST-DUP"
    first_name        = "Duplicate"
    last_name         = "Staff"
    designation       = "Duplicate Test"
    phone             = "9000000000"
    email             = "duplicate.staff@hms.local"
    employment_status = "ACTIVE"
}

$Duplicate = Invoke-Api `
    -Method "POST" `
    -Url "$BaseUrl/college/staff" `
    -Token $Token `
    -Body $DuplicateBody

if ($Duplicate.StatusCode -eq 400 -or $Duplicate.StatusCode -eq 409) {
    Test-Result "DUPLICATE USER REJECTED" $true "HTTP $($Duplicate.StatusCode)"
}
else {
    Test-Result "DUPLICATE USER REJECTED" $false "HTTP $($Duplicate.StatusCode)"
    Write-Host $Duplicate.Raw
}

# ============================================================
# 13. FINAL GET
# ============================================================

Write-Host ""
Write-Host "13. FINAL GET"

$FinalGet = Invoke-Api `
    -Method "GET" `
    -Url "$BaseUrl/college/staff/$StaffID" `
    -Token $Token

if ($FinalGet.StatusCode -eq 200) {
    Test-Result "FINAL GET" $true
}
else {
    Test-Result "FINAL GET" $false "HTTP $($FinalGet.StatusCode)"
    Write-Host $FinalGet.Raw
}

# ============================================================
# FINAL
# ============================================================

Write-Host ""
Write-Host "============================================================"
Write-Host " STAFF RUNTIME TEST FINISHED"
Write-Host "============================================================"
Write-Host ""
Write-Host "Staff ID: $StaffID"
Write-Host ""
