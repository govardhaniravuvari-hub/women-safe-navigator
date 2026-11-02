-- ============================================================
--  SAFEPATH - Women Safe Route Navigator
--  MySQL schema (MySQL 8.0+ / MariaDB 10.6+)
--  Run: npm run db:setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS safepath
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE safepath;

-- ------------------------------------------------------------
-- 1. Users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(190) NOT NULL UNIQUE,
  phone           VARCHAR(20)  NULL,
  password_hash   VARCHAR(255) NOT NULL,
  city            VARCHAR(120) NULL,
  blood_group     VARCHAR(8)   NULL,
  medical_notes   VARCHAR(400) NULL,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  last_login_at   DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. EmergencyContacts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  email        VARCHAR(190) NULL,
  relationship VARCHAR(60)  NULL,
  is_primary   TINYINT(1)   NOT NULL DEFAULT 0,
  verified     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_contacts_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. SafetyReports
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_reports (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  category       ENUM('unsafe_route','poor_lighting','harassment','suspicious_activity','unsafe_place','other')
                 NOT NULL,
  description    TEXT NOT NULL,
  latitude       DECIMAL(10,7) NOT NULL,
  longitude      DECIMAL(10,7) NOT NULL,
  address        VARCHAR(255) NULL,
  occurred_at    DATETIME NOT NULL,
  severity       ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  image_path     VARCHAR(255) NULL,
  status         ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  admin_note     VARCHAR(400) NULL,
  verified_by    INT UNSIGNED NULL,
  verified_at    DATETIME NULL,
  contact_ok     TINYINT(1) NOT NULL DEFAULT 0,
  is_sample      TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reports_status (status),
  INDEX idx_reports_geo (latitude, longitude),
  INDEX idx_reports_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. SafeRoutes (routes a user explicitly saved for later)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safe_routes (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  label            VARCHAR(140) NOT NULL,
  origin_label     VARCHAR(255) NULL,
  dest_label       VARCHAR(255) NULL,
  origin_lat       DECIMAL(10,7) NOT NULL,
  origin_lng       DECIMAL(10,7) NOT NULL,
  dest_lat         DECIMAL(10,7) NOT NULL,
  dest_lng         DECIMAL(10,7) NOT NULL,
  distance_meters  INT UNSIGNED NOT NULL,
  duration_seconds INT UNSIGNED NOT NULL,
  safety_score     TINYINT UNSIGNED NULL,
  safety_label     VARCHAR(40) NULL,
  geometry         LONGTEXT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_routes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_routes_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. PoliceStations  (local reference data / admin managed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS police_stations (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(190) NOT NULL,
  address    VARCHAR(255) NULL,
  phone      VARCHAR(30)  NULL,
  latitude   DECIMAL(10,7) NOT NULL,
  longitude  DECIMAL(10,7) NOT NULL,
  city       VARCHAR(120) NULL,
  source     VARCHAR(60)  NOT NULL DEFAULT 'sample',
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_police_geo (latitude, longitude)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. Hospitals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(190) NOT NULL,
  address       VARCHAR(255) NULL,
  phone         VARCHAR(30)  NULL,
  emergency_phone VARCHAR(30) NULL,
  latitude      DECIMAL(10,7) NOT NULL,
  longitude     DECIMAL(10,7) NOT NULL,
  city          VARCHAR(120) NULL,
  type          ENUM('hospital','clinic','ambulance','other') NOT NULL DEFAULT 'hospital',
  source        VARCHAR(60)  NOT NULL DEFAULT 'sample',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hospitals_geo (latitude, longitude)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. LocationHistory
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_history (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  latitude   DECIMAL(10,7) NOT NULL,
  longitude  DECIMAL(10,7) NOT NULL,
  accuracy   DECIMAL(8,2)  NULL,
  source     ENUM('gps','route','share','sos') NOT NULL DEFAULT 'gps',
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_loc_user_time (user_id, recorded_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- FK added after the admins table is created (see the end of this file)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 8. Notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       ENUM('safety_alert','report_update','emergency','announcement','system') NOT NULL DEFAULT 'system',
  title      VARCHAR(190) NOT NULL,
  body       TEXT NULL,
  link       VARCHAR(255) NULL,
  latitude   DECIMAL(10,7) NULL,
  longitude  DECIMAL(10,7) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. SharedLocations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_locations (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  token          CHAR(64) NOT NULL UNIQUE,
  label          VARCHAR(120) NULL,
  latitude       DECIMAL(10,7) NULL,
  longitude      DECIMAL(10,7) NULL,
  accuracy       DECIMAL(8,2) NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  expires_at     DATETIME NOT NULL,
  last_update_at DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stopped_at     DATETIME NULL,
  CONSTRAINT fk_shared_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_shared_user (user_id, is_active)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. Admins
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('super_admin','moderator') NOT NULL DEFAULT 'moderator',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Supporting tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sos_alerts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  latitude      DECIMAL(10,7) NULL,
  longitude     DECIMAL(10,7) NULL,
  accuracy      DECIMAL(8,2) NULL,
  message       VARCHAR(400) NULL,
  status        ENUM('active','cancelled','resolved') NOT NULL DEFAULT 'active',
  delivery_log  JSON NULL,
  contacts_notified SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at  DATETIME NULL,
  CONSTRAINT fk_sos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sos_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS awareness_content (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug       VARCHAR(80) NOT NULL UNIQUE,
  title      VARCHAR(190) NOT NULL,
  summary    VARCHAR(400) NULL,
  body       TEXT NOT NULL,
  category   ENUM('travel','night','digital','emergency','navigation','helplines','general') NOT NULL DEFAULT 'general',
  icon       VARCHAR(40) NULL,
  source     VARCHAR(255) NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_token (token_hash)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_audit (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id   INT UNSIGNED NULL,
  action     VARCHAR(80) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  INT UNSIGNED NULL,
  detail     VARCHAR(400) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- App settings (helplines shown in the UI, admin editable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Deferred foreign key: safety_reports.verified_by -> admins.id
-- (safe to re-run)
-- ------------------------------------------------------------
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'safety_reports'
    AND CONSTRAINT_NAME = 'fk_reports_admin'
);
SET @ddl = IF(@fk_exists = 0,
  'ALTER TABLE safety_reports ADD CONSTRAINT fk_reports_admin FOREIGN KEY (verified_by) REFERENCES admins(id) ON DELETE SET NULL',
  'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
