-- =====================================================================
--  Lawn & Found Portal  -  Database schema + seed data
--  Tables: users, categories, locations, reports (with images),
--          claims (with proof images)
--  Run this in MySQL Workbench before starting the app.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS c237_026_team2_ca2;
USE c237_026_team2_ca2;

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
  status          ENUM('Open','Resolved') NOT NULL DEFAULT 'Open',
  image         VARCHAR(500),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS found_notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  report_id       INT NOT NULL,
  finder_id       INT NOT NULL,
  message         TEXT NOT NULL,
  image           VARCHAR(500),
  status          ENUM('Pending', 'Confirmed', 'Dismissed')
                  NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (report_id)
    REFERENCES reports(report_id)
    ON DELETE CASCADE,

  FOREIGN KEY (finder_id)
    REFERENCES users(user_id)
);

-- ======================================================================
--  claims   <<<<<  PART E (Alvin) - MY TABLE  >>>>>
-- ======================================================================
CREATE TABLE IF NOT EXISTS claims (
  claim_id      INT AUTO_INCREMENT PRIMARY KEY,
  report_id     INT NOT NULL,               -- which found item is being claimed
  user_id       INT NOT NULL,               -- the student making the claim
  claim_message TEXT,                        -- proof / why the item is theirs
  image         VARCHAR(500),                -- proof image for claim
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
INSERT INTO reports (user_id, report_type, item_name, description, category_id, location_id, date_lost_found, status, image) VALUES
  (2, 'Found', 'Black Wallet',       'Found a black leather wallet near the library entrance.', 4, 1, '2026-07-15', 'Open', 'noImage.png'),
  (2, 'Found', 'Blue Water Bottle',  'Blue metal water bottle left in the canteen.',            3, 2, '2026-07-16', 'Open', 'noImage.png'),
  (3, 'Lost',  'Scientific Calculator','Lost my scientific calculator after class.',            1, 3, '2026-07-14', 'Open', 'noImage.png');
