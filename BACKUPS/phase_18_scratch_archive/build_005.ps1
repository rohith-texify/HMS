$source = "D:\HMS\scratch\recovered_movement_schema_utf8.sql"
$dest = "D:\HMS\scratch\proposed_patch\005_movement.sql"
$lines = Get-Content $source

$funcDef = @"
-- ============================================================
-- HMS DATABASE
-- Migration: 005_movement.sql
-- Module: Movement
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION app.validate_movement_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS `$function`
DECLARE
    referenced_college_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'attendance_cards' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and attendance card belong to different colleges', NEW.student_id;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'attendance_records' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and attendance record belong to different colleges', NEW.student_id;
        END IF;
        IF NEW.card_id IS NOT NULL THEN
            SELECT college_id INTO referenced_college_id FROM app.attendance_cards WHERE id = NEW.card_id;
            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION 'Attendance card % does not exist', NEW.card_id;
            END IF;
            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION 'Attendance card % and attendance record belong to different colleges', NEW.card_id;
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'entry_exit_records' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and movement record belong to different colleges', NEW.student_id;
        END IF;
        IF NEW.card_id IS NOT NULL THEN
            SELECT college_id INTO referenced_college_id FROM app.attendance_cards WHERE id = NEW.card_id;
            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION 'Attendance card % does not exist', NEW.card_id;
            END IF;
            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION 'Attendance card % and movement record belong to different colleges', NEW.card_id;
            END IF;
        END IF;
        SELECT college_id INTO referenced_college_id FROM app.gates WHERE id = NEW.gate_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Gate % does not exist', NEW.gate_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Gate % and movement record belong to different colleges', NEW.gate_id;
        END IF;
    END IF;

    RETURN NEW;
END;
`$function`;

"@

$finalOutput = New-Object System.Collections.Generic.List[string]
$finalOutput.Add($funcDef)

$skip = $false
foreach ($line in $lines) {
    if ($line -match "SET.*=") { continue }
    if ($line -match "SELECT pg_catalog") { continue }
    if ($line -match "^--") { continue }
    if ($line -match "^\\") { continue }
    if ($line -match "OWNER TO") { continue }
    
    if ($line -match "^CREATE POLICY tenant_isolation_") { $skip = $true }
    if ($line -match "^ALTER TABLE ONLY .* FORCE ROW LEVEL SECURITY") { continue }
    if ($line -match "^ALTER TABLE .* ENABLE ROW LEVEL SECURITY") { continue }
    if ($line -match "^CREATE INDEX idx_") { $skip = $true }
    
    if ($skip -and $line -match "^$") { 
        $skip = $false
        continue 
    }
    
    if (-not $skip -and $line.Trim() -ne "") {
        $finalOutput.Add($line)
        $finalOutput.Add("")
    }
}

$finalOutput.Add("COMMIT;")

Set-Content $dest -Value $finalOutput -Encoding UTF8
Write-Host "Reconstructed 005_movement.sql"
