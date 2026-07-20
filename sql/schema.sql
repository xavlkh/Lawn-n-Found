-- =====================================================================
--  Lawn & Found Portal  -  Database schema + seed data
--  Scope of THIS file for the demo:
--    * claims        <-- PART E (Alvin) : the resource I own
--    * users, categories, locations, reports  <-- owned by teammates,
--      included here ONLY so the claims table has valid data to join to
--      and the claims flow can be demonstrated on its own.
--  Run this in MySQL Workbench before starting the app.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS lawn_found;
USE lawn_found;

-- ---------- users  (Part A - Xavier) : minimal version for FK/session ----------
CREATE TABLE IF NOT EXISTS users (
  user_id    INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(100) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE,
  password   VARCHAR(100) NOT NULL,
  role       ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- categories & locations  (Part D - May) : minimal ----------
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL
);

-- ---------- reports  (Part B/C - Benny/Ahmad) : minimal, claims point here ----------
CREATE TABLE IF NOT EXISTS reports (
  report_id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT,
  report_type     ENUM('Lost','Found') NOT NULL,
  item_name       VARCHAR(150) NOT NULL,
  description     TEXT,
  category_id     INT,
  location_id     INT,
  date_lost_found DATE,
  status          ENUM('Open','Claimed','Resolved') NOT NULL DEFAULT 'Open',
  image_url       VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================
--  claims   <<<<<  PART E (Alvin) - MY TABLE  >>>>>
-- ======================================================================
CREATE TABLE IF NOT EXISTS claims (
  claim_id      INT AUTO_INCREMENT PRIMARY KEY,
  report_id     INT NOT NULL,               -- which found item is being claimed
  user_id       INT NOT NULL,               -- the student making the claim
  claim_message TEXT,                        -- proof / why the item is theirs
  status        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id),
  FOREIGN KEY (user_id)   REFERENCES users(user_id)
);

-- =====================================================================
--  Seed data  (passwords hashed with SHA1, matching the L19 pattern)
-- =====================================================================
INSERT INTO users (username, email, password, role) VALUES
  ('Admin',     'admin@admin.com',            SHA1('password'), 'admin'),
  ('Test User', 'test@admin.com',             SHA1('password'), 'user'),
  ('Alvin',     'alvin@student.rp.edu.sg',    SHA1('password'), 'user');

INSERT INTO categories (name) VALUES
  ('Electronics'), ('Books'), ('Clothing'), ('Cards & IDs');

INSERT INTO locations (name) VALUES
  ('Library'), ('Canteen'), ('Lecture Theatre 1'), ('Sports Hall');

-- A couple of FOUND items so there is something to claim, plus one LOST item.
INSERT INTO reports (user_id, report_type, item_name, description, category_id, location_id, date_lost_found, status) VALUES
  (2, 'Found', 'Black Wallet',       'Found a black leather wallet near the library entrance.', 4, 1, '2026-07-15', 'Open'),
  (2, 'Found', 'Blue Water Bottle',  'Blue metal water bottle left in the canteen.',            3, 2, '2026-07-16', 'Open'),
  (3, 'Lost',  'Scientific Calculator','Lost my scientific calculator after class.',            1, 3, '2026-07-14', 'Open');
