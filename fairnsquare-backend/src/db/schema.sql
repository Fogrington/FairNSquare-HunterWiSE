-- FairN² Database Schema
-- Run this file once to set up the database:
--   psql -U postgres -d fairn2 -f schema.sql

-- ─── Drop existing tables (for clean reset) ───────────────────────────────────
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS judge_project CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS criteria CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- ─── Admins ───────────────────────────────────────────────────────────────────
CREATE TABLE admins (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,  -- bcrypt hash
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Judges ───────────────────────────────────────────────────────────────────
CREATE TABLE judges (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  access_code  CHAR(4) NOT NULL,
  category_id  INTEGER,               -- grouping hint (nullable)
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Add FK after categories exists
ALTER TABLE judges
  ADD CONSTRAINT fk_judge_category
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  presenter    VARCHAR(255) NOT NULL,
  institution  VARCHAR(255),
  description  TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── Criteria ─────────────────────────────────────────────────────────────────
CREATE TABLE criteria (
  id      SERIAL PRIMARY KEY,
  label   VARCHAR(255) NOT NULL,
  description TEXT,
  weight  NUMERIC(4,2) NOT NULL  -- e.g. 0.30
);

-- ─── Judge–Project assignments (junction table) ───────────────────────────────
CREATE TABLE judge_project (
  judge_id    INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (judge_id, project_id)
);

-- ─── Scores ───────────────────────────────────────────────────────────────────
CREATE TABLE scores (
  id          SERIAL PRIMARY KEY,
  judge_id    INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  value       INTEGER NOT NULL CHECK (value >= 1 AND value <= 10),
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (judge_id, project_id, criterion_id)  -- one score per judge/project/criterion
);

-- ─── Seed data ────────────────────────────────────────────────────────────────

-- Admin user (password: admin123)
INSERT INTO admins (email, password, name) VALUES
  ('admin@hunterwise.org', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'HunterWiSE Admin');

-- Categories
INSERT INTO categories (id, name) VALUES
  (1, 'Engineering & Technology'),
  (2, 'Life Sciences & Health');

-- Judges (access codes are plain 4-digit strings — hashed in production)
INSERT INTO judges (id, name, email, access_code, category_id) VALUES
  (1, 'Sarah Chen',  'sarah.chen@hunterwise.org',  '1234', 1),
  (2, 'Marcus Webb', 'marcus.webb@hunterwise.org', '5678', 2),
  (3, 'Priya Nair',  'priya.nair@hunterwise.org',  '9012', 1);

-- Projects
INSERT INTO projects (id, category_id, title, presenter, institution, description) VALUES
  (101, 1, 'AquaFlow: Smart Irrigation System',      'Emma Bartlett',   'University of Newcastle',        'An IoT-based irrigation controller using soil moisture sensors and ML predictions to reduce water usage by up to 40%.'),
  (102, 1, 'BridgeScan: Structural Monitoring',      'Lena Kowalski',   'TAFE NSW Hunter',                'Low-cost vibration sensor array for real-time structural health monitoring of ageing bridge infrastructure.'),
  (103, 1, 'NanoGrid: Peer-to-Peer Energy Trading',  'Yuki Tanaka',     'University of Newcastle',        'Blockchain-enabled microgrid platform allowing households to trade surplus solar energy directly with neighbours.'),
  (104, 1, 'TrailSafe: Bushwalker SOS Beacon',       'Caitlin Moore',   'Hunter Valley Grammar',          'Ultra-low-power LoRa device providing GPS distress alerts from remote areas outside mobile coverage.'),
  (201, 2, 'DermAI: Skin Lesion Classifier',         'Aisha Okafor',    'University of Newcastle',        'CNN-based mobile app that classifies skin lesion images with GP-level accuracy to improve early melanoma detection.'),
  (202, 2, 'MindBridge: Rural Mental Health Platform','Zoe Patterson',  'University of Newcastle',        'Telehealth platform pairing rural patients with metropolitan psychologists, with async messaging and crisis escalation.'),
  (203, 2, 'GlucoWatch: Non-Invasive BGL Monitor',   'Fatima Al-Hassan','Hunter Medical Research Institute','Wearable using near-infrared spectroscopy to estimate blood glucose levels without skin puncture.');

-- Criteria
INSERT INTO criteria (id, label, description, weight) VALUES
  (1, 'Innovation',      'Originality and novelty of the approach',      0.30),
  (2, 'Technical Merit', 'Soundness of methodology and execution',        0.30),
  (3, 'Impact',          'Potential real-world benefit and scalability',  0.25),
  (4, 'Presentation',    'Clarity and professionalism of delivery',       0.15);

-- Initial assignments
INSERT INTO judge_project (judge_id, project_id) VALUES
  (1, 101), (1, 102),
  (3, 101), (3, 103),
  (2, 201), (2, 202);

-- Reset sequences to avoid PK conflicts after manual ID inserts
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('judges_id_seq',     (SELECT MAX(id) FROM judges));
SELECT setval('projects_id_seq',   (SELECT MAX(id) FROM projects));
SELECT setval('criteria_id_seq',   (SELECT MAX(id) FROM criteria));