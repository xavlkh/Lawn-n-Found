// =====================================================================
//  Lawn & Found Portal
//  PART E - Claims and admin approval workflow  (Alvin, 25038212)
//
//  This app.js contains ONLY my part plus the minimum scaffolding needed
//  to run and demonstrate the claims flow on its own. The real login /
//  register (Part A), reports CRUD (Parts B/C) and search (Part D) belong
//  to my teammates and are NOT implemented here.
// =====================================================================

const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();

// ---------- Database connection (mysql2) ----------
const db = mysql.createConnection({
  host: 'c237-adib-mysql.mysql.database.azure.com',
  user: 'c237_026',
  password: 'c237026@2026!',
  database: 'c237_026_team2_ca2',
  ssl: { rejectUnauthorized: false }
});
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database.');
});

// Show a database error on the page instead of crashing the whole server.
// (Using throw here would kill the Node process and 502 the entire site.)
function dbError(res, err) {
  console.error('Database error:', err);
  return res.status(500).send('Database error: ' + (err.sqlMessage || err.message));
}

// ---------- View engine & middleware ----------
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Sessions (L19 pattern) - lets the server remember who is logged in.
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  // Session expires after 1 week of inactivity
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Flash messages (temporary success / error messages)
app.use(flash());

// =====================================================================
//  Access-control middleware (L19)  -  used to protect MY routes
// =====================================================================
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
  }
};

const checkAdmin = (req, res, next) => {
  if (req.session.user.role === 'admin') {
    return next();
  } else {
    req.flash('error', 'Access denied');
    res.redirect('/');   // (L19 redirects to /dashboard, which is Part A's page)
  }
};

// =====================================================================
//  TEMP DEV SCAFFOLD  -  remove once Xavier's real auth (Part A) is in.
//  Real /login and /register are NOT my part; this only lets us set a
//  session user so the claims workflow can be demonstrated.
// =====================================================================
app.get('/login', (req, res) => {
  res.render('devLogin', {
    user: req.session.user,
    messages: req.flash('success'),
    errors: req.flash('error')
  });
});

// Pick a seeded user to "log in" as (DEV ONLY).
app.get('/dev/login/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE user_id = ?', [req.params.id], (err, results) => {
    if (err) return dbError(res, err);
    if (results.length > 0) {
      req.session.user = results[0];   // store the user row in the session (L19)
      req.flash('success', 'Logged in as ' + results[0].username + ' (' + results[0].role + ')');
    }
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Scaffold home page: lists FOUND items so a user can submit a claim.
// (The real Browse Reports page is Benny's Part B.)
app.get('/', (req, res) => {
  const sql = "SELECT * FROM reports WHERE report_type = 'Found' ORDER BY created_at DESC";
  db.query(sql, (err, reports) => {
    if (err) return dbError(res, err);
    res.render('index', {
      user: req.session.user,
      reports: reports,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// #####################################################################
// #####            PART E - CLAIMS & ADMIN APPROVAL              #####
// #####                     (Alvin, 25038212)                    #####
// #####################################################################

// ---------- STUDENT: show the "submit a claim" form for a found item ----------
app.get('/claims/submit/:reportId', checkAuthenticated, (req, res) => {
  const sql = 'SELECT * FROM reports WHERE report_id = ?';
  db.query(sql, [req.params.reportId], (err, results) => {
    if (err) return dbError(res, err);
    if (results.length === 0) {
      req.flash('error', 'Report not found.');
      return res.redirect('/');
    }
    res.render('submitClaim', {
      user: req.session.user,
      report: results[0],
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- STUDENT: handle the claim submission ----------
app.post('/claims/submit/:reportId', checkAuthenticated, (req, res) => {
  const reportId = req.params.reportId;
  const userId = req.session.user.user_id;
  const { claim_message } = req.body;

  // Server-side validation
  if (!claim_message) {
    req.flash('error', 'Please describe why this item belongs to you.');
    return res.redirect('/claims/submit/' + reportId);
  }

  // Don't allow claiming an item that is already resolved.
  db.query('SELECT status FROM reports WHERE report_id = ?', [reportId], (err, rows) => {
    if (err) return dbError(res, err);
    if (rows.length === 0) {
      req.flash('error', 'Report not found.');
      return res.redirect('/');
    }
    if (rows[0].status === 'Resolved') {
      req.flash('error', 'This item has already been resolved.');
      return res.redirect('/');
    }

    // Insert the new claim as "Pending".
    const insert = 'INSERT INTO claims (report_id, user_id, claim_message, status) VALUES (?, ?, ?, "Pending")';
    db.query(insert, [reportId, userId, claim_message], (err2) => {
      if (err2) return dbError(res, err2);

      // Mark the report as "Claimed" so others can see a claim is in progress.
      db.query("UPDATE reports SET status = 'Claimed' WHERE report_id = ? AND status = 'Open'", [reportId], (err3) => {
        if (err3) return dbError(res, err3);
        req.flash('success', 'Claim submitted! An admin will review it.');
        res.redirect('/claims/my');
      });
    });
  });
});

// =====================================================================
// PART B - CREATE AND VIEW REPORTS
// =====================================================================

app.get('/reports/new', checkAuthenticated, (req, res) => {
  const categorySql =
    'SELECT category_id, name FROM categories ORDER BY name';

  const locationSql =
    'SELECT location_id, name FROM locations ORDER BY name';

  db.query(categorySql, (categoryError, categories) => {
    if (categoryError) {
      return dbError(res, categoryError);
    }

    db.query(locationSql, (locationError, locations) => {
      if (locationError) {
        return dbError(res, locationError);
      }

      res.render('newReport', {
        user: req.session.user,
        categories,
        locations,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  });
});

app.post('/reports', checkAuthenticated, (req, res) => {
  const {
    report_type,
    item_name,
    description,
    category_id,
    location_id,
    date_lost_found
  } = req.body;

  const validReportTypes = ['Lost', 'Found'];

  if (
    !validReportTypes.includes(report_type) ||
    !item_name?.trim() ||
    !description?.trim() ||
    !category_id ||
    !location_id ||
    !date_lost_found
  ) {
    req.flash('error', 'Please complete all report fields.');
    return res.redirect('/reports/new');
  }

  const selectedDate = new Date(date_lost_found);
  const today = new Date();

  selectedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
    req.flash('error', 'The lost or found date cannot be in the future.');
    return res.redirect('/reports/new');
  }

  const sql = `
    INSERT INTO reports
      (
        user_id,
        report_type,
        item_name,
        description,
        category_id,
        location_id,
        date_lost_found,
        status
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
  `;

  const values = [
    req.session.user.user_id,
    report_type,
    item_name.trim(),
    description.trim(),
    category_id,
    location_id,
    date_lost_found
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      return dbError(res, err);
    }

    req.flash('success', 'Your report was created successfully.');
    res.redirect('/reports/' + result.insertId);
  });
});

app.get('/reports/:id', (req, res) => {
  const reportId = req.params.id;

  const sql = `
    SELECT
      r.*,
      c.name AS category_name,
      l.name AS location_name,
      u.username AS reporter_name
    FROM reports r
    LEFT JOIN categories c
      ON r.category_id = c.category_id
    LEFT JOIN locations l
      ON r.location_id = l.location_id
    LEFT JOIN users u
      ON r.user_id = u.id
    WHERE r.report_id = ?
  `;

  db.query(sql, [reportId], (err, results) => {
    if (err) {
      return dbError(res, err);
    }

    if (results.length === 0) {
      req.flash('error', 'Report not found.');
      return res.redirect('/');
    }

    res.render('reportDetails', {
      user: req.session.user,
      report: results[0],
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- STUDENT: view my own claims and their status ----------
app.get('/claims/my', checkAuthenticated, (req, res) => {
  const sql = `SELECT c.*, r.item_name, r.report_type
               FROM claims c
               JOIN reports r ON c.report_id = r.report_id
               WHERE c.user_id = ?
               ORDER BY c.created_at DESC`;
  db.query(sql, [req.session.user.user_id], (err, claims) => {
    if (err) return dbError(res, err);
    res.render('myClaims', {
      user: req.session.user,
      claims: claims,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- ADMIN: view and manage all claims ----------
app.get('/admin/claims', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = `SELECT c.*, r.item_name, u.username, u.email
               FROM claims c
               JOIN reports r ON c.report_id = r.report_id
               JOIN users u   ON c.user_id = u.user_id
               ORDER BY (c.status = 'Pending') DESC, c.created_at DESC`;
  db.query(sql, (err, claims) => {
    if (err) return dbError(res, err);
    res.render('adminClaims', {
      user: req.session.user,
      claims: claims,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- ADMIN: approve a claim (the main enhancement) ----------
app.post('/admin/claims/:claimId/approve', checkAuthenticated, checkAdmin, (req, res) => {
  const claimId = req.params.claimId;

  // 1. Find the claim so we know which report it belongs to.
  db.query('SELECT * FROM claims WHERE claim_id = ?', [claimId], (err, results) => {
    if (err) return dbError(res, err);
    if (results.length === 0) {
      req.flash('error', 'Claim not found.');
      return res.redirect('/admin/claims');
    }
    const reportId = results[0].report_id;

    // 2. Approve this claim.
    db.query("UPDATE claims SET status = 'Approved' WHERE claim_id = ?", [claimId], (err2) => {
      if (err2) return dbError(res, err2);

      // 3. Auto-reject every OTHER pending claim for the same report.
      db.query("UPDATE claims SET status = 'Rejected' WHERE report_id = ? AND claim_id != ? AND status = 'Pending'",
        [reportId, claimId], (err3) => {
          if (err3) return dbError(res, err3);

          // 4. Mark the report as Resolved.
          db.query("UPDATE reports SET status = 'Resolved' WHERE report_id = ?", [reportId], (err4) => {
            if (err4) return dbError(res, err4);
            req.flash('success', 'Claim approved. Report resolved and other pending claims rejected.');
            res.redirect('/admin/claims');
          });
        });
    });
  });
});

// ---------- ADMIN: reject a single claim ----------
app.post('/admin/claims/:claimId/reject', checkAuthenticated, checkAdmin, (req, res) => {
  db.query("UPDATE claims SET status = 'Rejected' WHERE claim_id = ?", [req.params.claimId], (err) => {
    if (err) return dbError(res, err);
    req.flash('success', 'Claim rejected.');
    res.redirect('/admin/claims');
  });
});

// #####################################################################
// #####                   END OF PART E                          #####
// #####################################################################

// ---------- Start the server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
