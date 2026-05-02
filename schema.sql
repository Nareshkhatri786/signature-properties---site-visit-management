-- ============================================================
-- DiyaCRM — MySQL/MariaDB Schema
-- Real Estate CRM Database
-- ============================================================

CREATE DATABASE IF NOT EXISTS diyacrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE diyacrm;

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id           VARCHAR(50) PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                 INT PRIMARY KEY AUTO_INCREMENT,
  username           VARCHAR(100) UNIQUE NOT NULL,
  password           VARCHAR(255) NOT NULL,
  name               VARCHAR(255) NOT NULL,
  role               ENUM('admin','manager','user') DEFAULT 'user',
  projectId          VARCHAR(50),
  assignedProjectIds JSON,
  workingHours       JSON,
  assignedLocation   JSON,
  locationRequest    JSON,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id               VARCHAR(50) PRIMARY KEY DEFAULT 'main',
  company          VARCHAR(255),
  phone            VARCHAR(50),
  address          TEXT,
  sources          JSON,
  budgets          JSON,
  propertyInterests JSON,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id                VARCHAR(100) PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  mobile            VARCHAR(20),
  email             VARCHAR(255),
  source            VARCHAR(100),
  quality           ENUM('hot','warm','cold','pending','disq') DEFAULT 'pending',
  status            ENUM('new','contacted','visit_scheduled','visit_done','closed','lost') DEFAULT 'new',
  budget            VARCHAR(100),
  property_interest VARCHAR(255),
  priority          TINYINT DEFAULT 0,
  projectId         VARCHAR(50),
  assignedTo        INT,
  stats             JSON,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projectId (projectId),
  INDEX idx_assignedTo (assignedTo),
  INDEX idx_status (status),
  INDEX idx_quality (quality),
  INDEX idx_mobile (mobile),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
  id                VARCHAR(100) PRIMARY KEY,
  leadId            VARCHAR(100),
  client_name       VARCHAR(255) NOT NULL,
  mobile            VARCHAR(20),
  email             VARCHAR(255),
  visit_date        DATE,
  visit_time        VARCHAR(10),
  purpose           TEXT,
  status            ENUM('hot','warm','cold','pending','disq') DEFAULT 'pending',
  visit_status      ENUM('scheduled','rescheduled','completed','cancelled') DEFAULT 'scheduled',
  assigned_to       VARCHAR(255),
  source            VARCHAR(100),
  budget            VARCHAR(100),
  property_interest VARCHAR(255),
  priority          TINYINT DEFAULT 0,
  projectId         VARCHAR(50),
  reminders_sent    JSON,
  client_feedback   TEXT,
  interest_level    VARCHAR(20),
  outcome           VARCHAR(50),
  reschedule_log    JSON,
  completed_at      DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_projectId (projectId),
  INDEX idx_visit_date (visit_date),
  INDEX idx_visit_status (visit_status),
  INDEX idx_leadId (leadId),
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- REMARKS
-- ============================================================
CREATE TABLE IF NOT EXISTS remarks (
  id        VARCHAR(100) PRIMARY KEY,
  targetId  VARCHAR(100) NOT NULL,
  text      TEXT NOT NULL,
  `by`      VARCHAR(255),
  at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  type      VARCHAR(50) DEFAULT 'remark',
  category  VARCHAR(50) DEFAULT 'general',
  sentiment VARCHAR(50) DEFAULT 'neutral',
  INDEX idx_targetId (targetId)
) ENGINE=InnoDB;

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS followups (
  id           VARCHAR(100) PRIMARY KEY,
  leadId       VARCHAR(100),
  visitId      VARCHAR(100),
  projectId    VARCHAR(50),
  userId       INT,
  userName     VARCHAR(255),
  date         DATE,
  scheduled_at DATETIME,
  purpose      TEXT,
  method       ENUM('call','whatsapp','email','in_person') DEFAULT 'call',
  status       ENUM('pending','completed','cancelled') DEFAULT 'pending',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  outcome_note TEXT,
  INDEX idx_leadId (leadId),
  INDEX idx_projectId (projectId),
  INDEX idx_userId (userId),
  INDEX idx_date (date),
  INDEX idx_status (status),
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- CALL LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id        VARCHAR(100) PRIMARY KEY,
  visitId   VARCHAR(100),
  leadId    VARCHAR(100),
  projectId VARCHAR(50),
  outcome   ENUM('answered','not_answered','busy','switched_off') DEFAULT 'not_answered',
  note      TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  `by`      VARCHAR(255),
  INDEX idx_leadId (leadId),
  INDEX idx_projectId (projectId),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- ACTIVITIES (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id         VARCHAR(100) PRIMARY KEY,
  type       VARCHAR(100),
  userId     INT,
  userName   VARCHAR(255),
  projectId  VARCHAR(50),
  targetId   VARCHAR(100),
  targetName VARCHAR(255),
  timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
  details    TEXT,
  INDEX idx_projectId (projectId),
  INDEX idx_userId (userId),
  INDEX idx_targetId (targetId),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- WEBHOOK CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id                  VARCHAR(100) PRIMARY KEY,
  name                VARCHAR(255),
  token               VARCHAR(255) UNIQUE,
  projectId           VARCHAR(50),
  assignedTo          INT,
  assignedUserIds     JSON,
  lastAssignedIndex   INT DEFAULT 0,
  mapping             JSON,
  active              TINYINT(1) DEFAULT 1,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_projectId (projectId)
) ENGINE=InnoDB;

-- ============================================================
-- TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
  id        VARCHAR(100) PRIMARY KEY,
  name      VARCHAR(255),
  type      VARCHAR(50),
  message   TEXT,
  fileData  LONGTEXT,
  fileName  VARCHAR(255),
  fileType  VARCHAR(50) DEFAULT 'none',
  active    TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id       VARCHAR(100) PRIMARY KEY,
  userId   INT NOT NULL,
  date     DATE NOT NULL,
  checkIn  JSON,
  checkOut JSON,
  status   ENUM('present','absent','missed_punch') DEFAULT 'absent',
  INDEX idx_userId (userId),
  INDEX idx_date (date),
  UNIQUE KEY unique_user_date (userId, date),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id        VARCHAR(100) PRIMARY KEY,
  userId    INT,
  type      VARCHAR(100),
  title     VARCHAR(255),
  message   TEXT,
  `read`    TINYINT(1) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isAdmin   TINYINT(1) DEFAULT 0,
  metadata  JSON,
  date      DATE,
  INDEX idx_userId (userId),
  INDEX idx_isAdmin (isAdmin),
  INDEX idx_read (`read`),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB;

-- ============================================================
-- WHATSAPP MESSAGES LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                  VARCHAR(100) PRIMARY KEY,
  leadId              VARCHAR(100),
  visitId             VARCHAR(100),
  senderName          VARCHAR(255),
  senderPhoneNumber   VARCHAR(20),
  content             TEXT,
  timestamp           DATETIME DEFAULT CURRENT_TIMESTAMP,
  type                ENUM('incoming','outgoing') DEFAULT 'incoming',
  projectId           VARCHAR(50),
  INDEX idx_leadId (leadId),
  INDEX idx_projectId (projectId),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ============================================================
-- PUSH SUBSCRIPTIONS (WEB PUSH)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  userId      INT NOT NULL,
  endpoint    VARCHAR(500) NOT NULL,
  auth        VARCHAR(100) NOT NULL,
  p256dh      VARCHAR(100) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_endpoint (endpoint),
  INDEX idx_userId (userId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SEED: Default Projects
-- ============================================================
INSERT IGNORE INTO projects (id, name) VALUES
  ('p1', 'Signature Properties'),
  ('p2', 'Shreemad Family'),
  ('p3', 'Devi Bungalows'),
  ('p4', 'Royal Rudraksha');

-- ============================================================
-- SEED: Default Admin User (password: admin123)
-- ============================================================
INSERT IGNORE INTO users (id, username, password, name, role, projectId) VALUES
  (1, 'admin', '$2b$10$YourHashedPasswordHere', 'Admin User', 'admin', 'p1');

-- ============================================================
-- SEED: Default Settings
-- ============================================================
INSERT IGNORE INTO settings (id, company, phone, address, sources, budgets, propertyInterests)
VALUES (
  'main',
  'Signature Properties',
  '',
  '',
  '["Walk-in","Phone Call","Website","Reference","Social Media","Hoarding","Newspaper","Event","Other"]',
  '["< 50L","50L - 1Cr","1Cr - 2Cr","2Cr - 5Cr","> 5Cr"]',
  '["2 BHK","3 BHK","4 BHK","Penthouse","Villa","Plot","Commercial"]'
);

-- ============================================================
-- SEED: Default Templates
-- ============================================================
INSERT IGNORE INTO templates (id, name, type, message, fileType, active) VALUES
  ('1', 'Visit Reminder', 'reminder', 'Dear {client_name}, this is a reminder for your site visit scheduled on {visit_date}. We look forward to welcoming you. — Signature Properties', 'none', 1),
  ('2', 'Welcome Message', 'welcome', 'Welcome {client_name}! We are delighted to have you visit us today. Our team is ready to assist you with all your needs. — Signature Properties', 'none', 1),
  ('3', 'Thank You After Visit', 'thank_you', 'Dear {client_name}, thank you for visiting us today! It was a true pleasure meeting you. We hope to serve you soon. — Signature Properties', 'none', 1),
  ('4', 'Follow Up', 'follow_up', 'Dear {client_name}, hope you enjoyed your visit on {visit_date}. Please feel free to reach out anytime. We are here to help! — Signature Properties', 'none', 1),
  ('5', 'Call Not Answered', 'follow_up', 'Hello {client_name}, we were trying to connect with you but you seemed busy. Please call us back once you are free. Regards, Signature Properties.', 'none', 1);
-- ============================================================
-- WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id          VARCHAR(100) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  isActive    TINYINT(1) DEFAULT 1,
  `trigger`   VARCHAR(100) NOT NULL,
  conditions  JSON,
  actions     JSON,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
