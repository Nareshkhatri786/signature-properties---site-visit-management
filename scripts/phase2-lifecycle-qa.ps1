param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Username = "admin",
  [string]$Password = "admin123",
  [string]$ProjectId = "p1",
  [int]$AssignedUserId = 1,
  [string]$AssignedUserName = "Admin User",
  [switch]$Cleanup
)

$ErrorActionPreference = "Stop"

function Assert-Check {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Details
  )
  [PSCustomObject]@{
    check = $Name
    passed = $Passed
    details = $Details
  }
}

function Save-Collection {
  param(
    [hashtable]$Headers,
    [string]$BaseUrl,
    [string]$Collection,
    [hashtable]$Data
  )
  $payload = @{ collection = $Collection; data = $Data } | ConvertTo-Json -Depth 12
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/save" -Headers $Headers -Body $payload | Out-Null
}

function Delete-Collection {
  param(
    [hashtable]$Headers,
    [string]$BaseUrl,
    [string]$Collection,
    [string]$Id
  )
  $payload = @{ collection = $Collection; id = $Id } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/delete" -Headers $Headers -Body $payload | Out-Null
}

$loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/login" -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.token)"; "Content-Type" = "application/json" }
$authHeaders = @{ Authorization = "Bearer $($login.token)" }

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$leadId = "qa_phase2_lead_$ts"
$followupId = "qa_phase2_fup_$ts"
$visitId = "qa_phase2_visit_$ts"
$pendingReminderId = "qa_phase2_reminder_pending_$ts"
$completedReminderId = "qa_phase2_reminder_completed_$ts"
$cancelledReminderId = "qa_phase2_reminder_cancelled_$ts"
$mobile = "7" + $ts.ToString().Substring($ts.ToString().Length - 9)
$now = Get-Date

$lead = @{
  id = $leadId
  name = "qa_phase2_lifecycle"
  mobile = $mobile
  source = "QA Phase 2"
  quality = "invalid_quality_should_fallback"
  status = "invalid_status_should_fallback"
  projectId = $ProjectId
  assignedTo = $AssignedUserId
  stats = @{ visits_planned = 0; visits_done = 0; calls_attempted = 0; calls_answered = 0; followups_done = 0 }
  created_at = $now.ToString("o")
  updated_at = $now.ToString("o")
}
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "leads" -Data $lead

$date1 = $now.AddDays(2).ToString("yyyy-MM-dd")
$date2 = $now.AddDays(5).ToString("yyyy-MM-dd")
$followup = @{
  id = $followupId
  leadId = $leadId
  projectId = $ProjectId
  userId = $AssignedUserId
  userName = $AssignedUserName
  date = $date1
  scheduled_at = "${date1}T10:15:00.000Z"
  purpose = "QA Phase 2 follow-up"
  method = "WhatsApp"
  status = "pending"
  created_at = $now.ToString("o")
}
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Data $followup

$followupDone = $followup.Clone()
$followupDone.status = "completed"
$followupDone.completed_at = (Get-Date).ToString("o")
$followupDone.outcome_note = "first completion"
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Data $followupDone

$followupDoneAgain = $followupDone.Clone()
$followupDoneAgain.outcome_note = "duplicate completion"
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Data $followupDoneAgain

$followupRescheduled = $followup.Clone()
$followupRescheduled.date = $date2
$followupRescheduled.scheduled_at = "${date2}T10:15:00.000Z"
$followupRescheduled.status = "pending"
$followupRescheduled.completed_at = $null
$followupRescheduled.outcome_note = "rescheduled after completion for QA"
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Data $followupRescheduled

$visit = @{
  id = $visitId
  leadId = $leadId
  client_name = "qa_phase2_lifecycle"
  mobile = $mobile
  visit_date = $now.AddDays(1).ToString("yyyy-MM-dd")
  visit_time = "12:30"
  purpose = "QA Phase 2 visit"
  status = "warm"
  visit_status = "scheduled"
  projectId = $ProjectId
  assigned_to = $AssignedUserName
  source = "QA Phase 2"
  created_at = $now.ToString("o")
}
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "visits" -Data $visit

$visitDone = $visit.Clone()
$visitDone.visit_status = "completed"
$visitDone.completed_at = (Get-Date).ToString("o")
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "visits" -Data $visitDone
Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "visits" -Data $visitDone

$reminderDate = $now.ToUniversalTime().AddMinutes(20).ToString("yyyy-MM-dd")
$reminderScheduledAt = $now.ToUniversalTime().AddMinutes(20).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
foreach ($item in @(
  @{ id = $pendingReminderId; status = "pending"; purpose = "QA pending reminder" },
  @{ id = $completedReminderId; status = "completed"; purpose = "QA completed reminder" },
  @{ id = $cancelledReminderId; status = "cancelled"; purpose = "QA cancelled reminder" }
)) {
  Save-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Data @{
    id = $item.id
    leadId = $leadId
    projectId = $ProjectId
    userId = $AssignedUserId
    userName = $AssignedUserName
    date = $reminderDate
    scheduled_at = $reminderScheduledAt
    purpose = $item.purpose
    method = "call"
    status = $item.status
    created_at = $now.ToString("o")
  }
}

$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/health"
$data = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/data" -Headers $authHeaders

$leadRow = @($data.leads | Where-Object { $_.id -eq $leadId })[0]
$followupRow = @($data.followups | Where-Object { $_.id -eq $followupId })[0]
$visitRow = @($data.visits | Where-Object { $_.id -eq $visitId })[0]
$activities = @($data.activities | Where-Object { $_.targetId -eq $leadId })
$reminders = @($data.followups | Where-Object { $_.id -in @($pendingReminderId, $completedReminderId, $cancelledReminderId) })
$eligibleReminderCount = @($reminders | Where-Object { $_.status -eq "pending" -and $_.scheduled_at }).Count

$followupDate = (Get-Date $followupRow.date).ToString("yyyy-MM-dd")
$followupScheduledDate = (Get-Date $followupRow.scheduled_at).ToString("yyyy-MM-dd")
$checks = @(
  (Assert-Check "api_health" ($health.status -eq "ok") "health=$($health.status)"),
  (Assert-Check "lead_status_guardrail" ($leadRow.status -eq "new") "saved=$($leadRow.status)"),
  (Assert-Check "lead_quality_guardrail" ($leadRow.quality -eq "pending") "saved=$($leadRow.quality)"),
  (Assert-Check "followup_method_normalized" ($followupRow.method -eq "whatsapp") "saved=$($followupRow.method)"),
  (Assert-Check "followup_status_pending_after_reschedule" ($followupRow.status -eq "pending") "saved=$($followupRow.status)"),
  (Assert-Check "followup_date_alignment" ($followupDate -eq $followupScheduledDate) "date=$followupDate scheduled=$followupScheduledDate"),
  (Assert-Check "followup_done_counter_idempotent" ([int]$leadRow.stats.followups_done -eq 1) "followups_done=$($leadRow.stats.followups_done)"),
  (Assert-Check "visit_done_counter_idempotent" ([int]$leadRow.stats.visits_done -eq 1) "visits_done=$($leadRow.stats.visits_done)"),
  (Assert-Check "followup_done_activity_once" (@($activities | Where-Object { $_.type -eq "followup_done" }).Count -eq 1) "count=$(@($activities | Where-Object { $_.type -eq "followup_done" }).Count)"),
  (Assert-Check "visit_completed_activity_once" (@($activities | Where-Object { $_.type -eq "visit_completed" }).Count -eq 1) "count=$(@($activities | Where-Object { $_.type -eq "visit_completed" }).Count)"),
  (Assert-Check "lifecycle_guard_activity_present" (@($activities | Where-Object { $_.type -eq "lifecycle_guard" }).Count -ge 1) "count=$(@($activities | Where-Object { $_.type -eq "lifecycle_guard" }).Count)"),
  (Assert-Check "reminder_pending_only_smoke" ($eligibleReminderCount -eq 1) "eligible_pending=$eligibleReminderCount total_test_reminders=$($reminders.Count)"),
  (Assert-Check "visit_status_completed" ($visitRow.visit_status -eq "completed") "saved=$($visitRow.visit_status)")
)

$summary = [PSCustomObject]@{
  baseUrl = $BaseUrl
  leadId = $leadId
  passed = @($checks | Where-Object { $_.passed }).Count
  failed = @($checks | Where-Object { -not $_.passed }).Count
  cleanupRequested = [bool]$Cleanup
  checks = $checks
}

if ($Cleanup) {
  foreach ($activity in $activities) {
    Delete-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "activities" -Id $activity.id
  }
  foreach ($id in @($followupId, $pendingReminderId, $completedReminderId, $cancelledReminderId)) {
    Delete-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "followups" -Id $id
  }
  Delete-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "visits" -Id $visitId
  Delete-Collection -Headers $headers -BaseUrl $BaseUrl -Collection "leads" -Id $leadId
}

$summary | ConvertTo-Json -Depth 8

if ($summary.failed -gt 0) {
  exit 1
}
