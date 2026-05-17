-- =========================================================
-- PRODUCTION PERFORMANCE INDEXES (Fixed Version)
-- Uses CREATE INDEX syntax to avoid MySQL ENUM bug
-- Safe to run multiple times
-- =========================================================

-- Disable strict mode temporarily to avoid ENUM duplicate errors
SET SESSION sql_mode = '';

-- =========================================================
-- LEADS TABLE INDEXES
-- =========================================================

-- Fast WhatsApp lead lookup by mobile number
SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='leads' AND index_name='idx_leads_mobile');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_leads_mobile ON leads (mobile)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fast load for project-based lead filtering with sort
SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='leads' AND index_name='idx_leads_project_updated');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_leads_project_updated ON leads (projectId, updated_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fast lookup by assigned user
SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='leads' AND index_name='idx_leads_assigned');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_leads_assigned ON leads (assignedTo)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fast GROUP BY status for stats
SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='leads' AND index_name='idx_leads_status');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_leads_status ON leads (status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fast today count query
SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='leads' AND index_name='idx_leads_created');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_leads_created ON leads (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Leads indexes done' AS status;

-- =========================================================
-- FOLLOWUPS TABLE INDEXES
-- =========================================================

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='followups' AND index_name='idx_followups_lead_status');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_followups_lead_status ON followups (leadId, status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='followups' AND index_name='idx_followups_project_date');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_followups_project_date ON followups (projectId, date)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='followups' AND index_name='idx_followups_user');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_followups_user ON followups (userId)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='followups' AND index_name='idx_followups_scheduled');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_followups_scheduled ON followups (status, scheduled_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Followups indexes done' AS status;

-- =========================================================
-- VISITS TABLE INDEXES
-- =========================================================

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='visits' AND index_name='idx_visits_lead');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_visits_lead ON visits (leadId)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='visits' AND index_name='idx_visits_status_date');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_visits_status_date ON visits (visit_status, visit_date)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='visits' AND index_name='idx_visits_project_date');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_visits_project_date ON visits (projectId, visit_date)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Visits indexes done' AS status;

-- =========================================================
-- ACTIVITIES TABLE INDEXES
-- =========================================================

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='activities' AND index_name='idx_activities_target');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_activities_target ON activities (targetId, timestamp)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='activities' AND index_name='idx_activities_timestamp');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_activities_timestamp ON activities (timestamp)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Activities indexes done' AS status;

-- =========================================================
-- WHATSAPP MESSAGES TABLE INDEXES
-- =========================================================

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='whatsapp_messages' AND index_name='idx_wa_lead');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_wa_lead ON whatsapp_messages (leadId, timestamp)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='whatsapp_messages' AND index_name='idx_wa_sender');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_wa_sender ON whatsapp_messages (senderPhoneNumber)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'WhatsApp indexes done' AS status;

-- =========================================================
-- OTHER TABLES
-- =========================================================

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='notifications' AND index_name='idx_notif_user_created');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_notif_user_created ON notifications (userId, createdAt)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='remarks' AND index_name='idx_remarks_target');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_remarks_target ON remarks (targetId, at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='attendance' AND index_name='idx_attendance_user_date');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_attendance_user_date ON attendance (userId, date)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema=DATABASE() AND table_name='call_logs' AND index_name='idx_calllogs_lead');
SET @sql = IF(@exists=0, 'CREATE INDEX idx_calllogs_lead ON call_logs (leadId)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'All other indexes done' AS status;

-- =========================================================
-- FINAL VERIFICATION
-- =========================================================
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND INDEX_NAME LIKE 'idx_%'
ORDER BY TABLE_NAME, INDEX_NAME;
