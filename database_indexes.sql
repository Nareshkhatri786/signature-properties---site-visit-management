-- =========================================================
-- PRODUCTION PERFORMANCE INDEXES
-- Signature Properties CRM
-- Run this ONCE on your MySQL server to add all indexes
-- Safe to run multiple times (uses IF NOT EXISTS logic)
-- =========================================================

-- LEADS TABLE INDEXES
-- Problem: SELECT * FROM leads WHERE mobile = ? does full table scan
-- Fix: Index on mobile for fast WhatsApp lead lookup
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_leads_mobile (mobile);

-- Problem: WHERE projectId = ? ORDER BY updated_at DESC is slow at 50k records
-- Fix: Composite index on projectId + updated_at
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_leads_project_updated (projectId, updated_at);

-- Problem: WHERE assignedTo = ? is used in every user's data load
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_leads_assigned (assignedTo);

-- Problem: WHERE status = 'lost' OR status = 'new' GROUP BY status
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_leads_status (status);

-- Problem: WHERE created_at >= CURDATE() for today's count (stats endpoint)
ALTER TABLE leads ADD INDEX IF NOT EXISTS idx_leads_created (created_at);

-- FOLLOWUPS TABLE INDEXES
-- Problem: WHERE leadId = ? AND status = 'pending' is called on EVERY lead save
ALTER TABLE followups ADD INDEX IF NOT EXISTS idx_followups_lead_status (leadId, status);

-- Problem: WHERE projectId = ? ORDER BY date DESC for data load
ALTER TABLE followups ADD INDEX IF NOT EXISTS idx_followups_project_date (projectId, date);

-- Problem: WHERE userId = ? for user-specific followup loading
ALTER TABLE followups ADD INDEX IF NOT EXISTS idx_followups_user (userId);

-- Problem: WHERE scheduled_at <= ? AND status = 'pending' for reminder loop
ALTER TABLE followups ADD INDEX IF NOT EXISTS idx_followups_scheduled (status, scheduled_at);

-- VISITS TABLE INDEXES
-- Problem: WHERE leadId = ? in multiple places
ALTER TABLE visits ADD INDEX IF NOT EXISTS idx_visits_lead (leadId);

-- Problem: WHERE visit_status = 'scheduled' AND visit_date >= ? for reminder loop
ALTER TABLE visits ADD INDEX IF NOT EXISTS idx_visits_status_date (visit_status, visit_date);

-- Problem: WHERE projectId = ? ORDER BY visit_date DESC
ALTER TABLE visits ADD INDEX IF NOT EXISTS idx_visits_project_date (projectId, visit_date);

-- ACTIVITIES TABLE INDEXES
-- Problem: WHERE targetId = ? ORDER BY timestamp DESC (Lead detail page)
ALTER TABLE activities ADD INDEX IF NOT EXISTS idx_activities_target (targetId, timestamp);

-- Problem: ORDER BY timestamp DESC for data loading
ALTER TABLE activities ADD INDEX IF NOT EXISTS idx_activities_timestamp (timestamp);

-- WHATSAPP MESSAGES TABLE INDEXES
-- Problem: WHERE leadId = ? ORDER BY timestamp DESC (WhatsApp history)
ALTER TABLE whatsapp_messages ADD INDEX IF NOT EXISTS idx_wa_lead (leadId, timestamp);

-- Problem: WHERE senderPhoneNumber = ? (duplicate message check)
ALTER TABLE whatsapp_messages ADD INDEX IF NOT EXISTS idx_wa_sender (senderPhoneNumber);

-- NOTIFICATIONS TABLE INDEXES
-- Problem: WHERE (userId = ? OR isAdmin = 1) ORDER BY createdAt DESC
ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_notif_user_created (userId, createdAt);

-- REMARKS TABLE INDEXES  
-- Problem: WHERE targetId = ? ORDER BY at ASC (Lead timeline)
ALTER TABLE remarks ADD INDEX IF NOT EXISTS idx_remarks_target (targetId, at);

-- ATTENDANCE TABLE INDEXES
-- Problem: WHERE userId = ? AND date = ?
ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_attendance_user_date (userId, date);

-- CALL LOGS TABLE INDEXES
-- Problem: WHERE leadId = ? for lead detail
ALTER TABLE call_logs ADD INDEX IF NOT EXISTS idx_calllogs_lead (leadId);

-- =========================================================
-- VERIFY: Check all indexes were created
-- =========================================================
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND INDEX_NAME LIKE 'idx_%'
ORDER BY TABLE_NAME, INDEX_NAME;
