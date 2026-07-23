// =====================================================================
//  Lawn & Found Portal
//  Includes: login/register (Part A), reports CRUD (Parts B/C),
//  search (Part D), claims & admin approval (Part E - Alvin, 25038212)
// =====================================================================

const dotenv = require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');

const app = express();



// ---------- File upload config (multer) ----------
// Multer handles multipart/form-data file uploads. Files are saved to public/images/
// using the original filename (note: in production, use a random filename to prevent overwrites).
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// ---------- Database connection (mysql2) ----------
// createPool manages a pool of reusable connections (default 10).
// SSL is required for cloud-hosted MySQL (e.g. Azure, Render).
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});
db.getConnection((err) => {
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
// resave: false - don't save session if unmodified
// saveUninitialized: false - don't create session until something is stored
// cookie.maxAge: 1 week in milliseconds
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  // Session expires after 1 week of inactivity
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Flash messages (session-based, no connect-flash needed)
// Custom flash implementation that stores messages in the session.
// Usage: req.flash('success', 'message') to set, req.flash('success') to read and clear.
app.use((req, res, next) => {
  if (!req.session.flash) req.session.flash = {};
  req.flash = (type, message) => {
    if (message !== undefined) {
      if (!req.session.flash[type]) req.session.flash[type] = [];
      req.session.flash[type].push(message);
      return;
    }
    const messages = req.session.flash[type] || [];
    delete req.session.flash[type];
    return messages;
  };
  next();
});


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

// Done by Xavier
// Make the logged-in user available to every EJS template
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Navbar notification counts (Alvin) - shown as a number badge in the navbar.
//  - admin: number of Pending claims waiting to be reviewed
//  - user : number of Pending "I found your item" alerts on their lost reports
// This middleware runs on every request to keep the counts up to date.
app.use((req, res, next) => {
  res.locals.pendingClaims = 0;
  res.locals.pendingAlerts = 0;

  const u = req.session.user;
  if (!u) return next();

  if (u.role === 'admin') {
    db.query("SELECT COUNT(*) AS cnt FROM claims WHERE status = 'Pending'", (err, rows) => {
      if (!err && rows.length) res.locals.pendingClaims = rows[0].cnt;
      next();
    });
  } else {
    const sql = `SELECT COUNT(*) AS cnt
                 FROM found_notifications n
                 JOIN reports r ON n.report_id = r.report_id
                 WHERE r.user_id = ? AND n.status = 'Pending'`;
    db.query(sql, [u.user_id], (err, rows) => {
      if (!err && rows.length) res.locals.pendingAlerts = rows[0].cnt;
      next();
    });
  }
});

// Done by Xavier
// Registration route
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('success'), errors: req.flash('error'), formData: req.flash('formData')[0] });
});

// Done by Xavier
// Create a middleware function validateRegistration
const validateRegistration = (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Done by Xavier
// Handle registration form submission.
// Password is hashed with SHA1 before storing in the database.
app.post('/register', validateRegistration, (req, res) => {
    const role = 'user'
    const { username, email, password } = req.body;

    const sql = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, SHA1(?), ?)';
    db.query(sql, [username, email, password, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// Done by Xavier
// Login route
app.get('/login', (req, res) => {
  res.render('login', {
    user: req.session.user,
    messages: req.flash('success'),
    errors: req.flash('error')
  });
});

// Done by Xavier
// Handle login form submission.
// Password is hashed with SHA1 before comparing to the database.
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Logged in as ' + results[0].username + ' (' + results[0].role + ')');
            res.redirect('/');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Logout (Xavier) - destroys the session and redirects to home.
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


// Part C - Update and Delete Reports/Claims - Done by Ahmad.
// Show the update report form with pre-filled data.
// Only the report owner can access this page.
app.get('/update/:id', checkAuthenticated, (req, res) => {
    const reportId = req.params.id;

    // Get the report
    const reportSql = "SELECT * FROM reports WHERE report_id = ?";

    db.query(reportSql, [reportId], (err, reports) => {
        if (err) return dbError(res, err);

        if (reports.length === 0) {
            req.flash("error", "Report not found.");
            return res.redirect("/reports");
        }

        // Get categories
        db.query(
            "SELECT category_id, name FROM categories ORDER BY name",
            (catErr, categories) => {
                if (catErr) return dbError(res, catErr);

                // Get locations
                db.query(
                    "SELECT location_id, name FROM locations ORDER BY name",
                    (locErr, locations) => {
                        if (locErr) return dbError(res, locErr);

                        res.render("updatereport", {
                            user: req.session.user,
                            report: reports[0],
                            categories,
                            locations,
                            today: new Date().toISOString().split("T")[0],
                            messages: req.flash("success"),
                            errors: req.flash("error")
                        });
                    }
                );
            }
        );
    });
});

// Handle report update with ownership check.
// Only the report owner can update their own reports.
// If a new image is uploaded, it replaces the old one.
app.post('/update/:id', checkAuthenticated, upload.single('image'), (req, res) => {
    const reportId = req.params.id;

    const {
        report_type,
        item_name,
        description,
        category_id,
        location_id,
        date_lost_found
    } = req.body;

    const checkOwnershipSql = "SELECT user_id FROM reports WHERE report_id = ?";
    db.query(checkOwnershipSql, [reportId], (err, results) => {
        if (err) return dbError(res, err);

        if (results.length === 0) {
            req.flash("error", "Report not found.");
            return res.redirect("/");
        }

        if (results[0].user_id !== req.session.user.user_id) {
            req.flash("error", "You do not have permission to update this report.");
            return res.redirect("/reports/" + reportId);
        }

        let sql;
        let values;

        if (req.file) {
            sql = `
                UPDATE reports
                SET report_type=?,
                    item_name=?,
                    description=?,
                    category_id=?,
                    location_id=?,
                    date_lost_found=?,
                    image=?
                WHERE report_id=?`;

            values = [
                report_type,
                item_name,
                description,
                category_id,
                location_id,
                date_lost_found,
                req.file.filename,
                reportId
            ];
        } else {
            sql = `
                UPDATE reports
                SET report_type=?,
                    item_name=?,
                    description=?,
                    category_id=?,
                    location_id=?,
                    date_lost_found=?
                WHERE report_id=?`;

            values = [
                report_type,
                item_name,
                description,
                category_id,
                location_id,
                date_lost_found,
                reportId
            ];
        }

        db.query(sql, values, (err) => {
            if (err) return dbError(res, err);

            req.flash("success", "Report updated successfully.");
            res.redirect("/reports/" + reportId);
        });
    });
});
// Delete Report (Ahmad)
// Only the report owner can delete their own reports.
app.post('/reports/delete/:id', checkAuthenticated, (req, res) => {
    const reportId = req.params.id;

    const checkOwnershipSql = "SELECT user_id FROM reports WHERE report_id = ?";
    db.query(checkOwnershipSql, [reportId], (err, results) => {
        if (err) return dbError(res, err);

        if (results.length === 0) {
            req.flash("error", "Report not found.");
            return res.redirect("/");
        }

        if (results[0].user_id !== req.session.user.user_id) {
            req.flash("error", "You do not have permission to delete this report.");
            return res.redirect("/reports/" + reportId);
        }

        const sql = "DELETE FROM reports WHERE report_id = ?";
        db.query(sql, [reportId], (err) => {
            if (err) return dbError(res, err);

            req.flash("success", "Report deleted successfully.");
            res.redirect("/reports");
        });
    });
});

// Admin Claim Edit (Ahmad)
// Shows the edit form for a specific claim. Only accessible by admins.
app.get("/admin/claims/update/:id", checkAuthenticated, checkAdmin, (req, res) => {
    const sql = `
        SELECT c.*, r.item_name
        FROM claims c
        JOIN reports r ON c.report_id = r.report_id
        WHERE c.claim_id = ?
    `;

    db.query(sql, [req.params.id], (err, results) => {
        if (err) return dbError(res, err);

        if (results.length === 0) {
            req.flash("error", "Claim not found.");
            return res.redirect("/admin/claims");
        }

        res.render("updateClaim", {
            user: req.session.user,
            claim: results[0],
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    });
});

// Handle claim update by admin (Ahmad)
// Allows updating claim message, status, and optionally the proof image.
app.post("/admin/claims/update/:id", checkAuthenticated, checkAdmin, upload.single("image"), (req, res) => {    const { claim_message, status } = req.body;

    let sql;
    let params;

    if (req.file) {
        sql = `
            UPDATE claims
            SET claim_message = ?, status = ?, image = ?
            WHERE claim_id = ?
        `;
        params = [claim_message, status, req.file.filename, req.params.id];
    } else {
        sql = `
            UPDATE claims
            SET claim_message = ?, status = ?
            WHERE claim_id = ?
        `;
        params = [claim_message, status, req.params.id];
    }

    db.query(sql, params, (err) => {
        if (err) throw err;

        req.flash("success", "Claim updated successfully.");
        res.redirect("/admin/claims");
    });
});

// Admin Claim Delete (Ahmad)
app.post('/admin/claims/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const claimId = req.params.id;

    const sql = "DELETE FROM claims WHERE claim_id = ?";

    db.query(sql, [claimId], (err) => {
        if (err) {
            return dbError(res, err);
        }

        req.flash("success", "Claim deleted successfully.");
        res.redirect("/admin/claims");
    });
});
// Part C Done.

// Part C.5 Adding and editing of location and category (Ahmad)
// These routes handle CRUD operations for locations and categories used in reports.

// ---------- LOCATION ROUTES ----------

// Show all locations in admin table.
app.get("/admin/locations", checkAuthenticated, checkAdmin, (req, res) => {

    const sql = "SELECT * FROM locations ORDER BY name";

    db.query(sql, (err, results) => {
        if (err) return dbError(res, err);

        res.render("adminLocations", {
            user: req.session.user,
            locations: results,
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    });

});

// Show all categories in admin table.
app.get("/admin/categories", checkAuthenticated, checkAdmin, (req, res) => {

    const sql = "SELECT * FROM categories ORDER BY name";

    db.query(sql, (err, results) => {
        if (err) return dbError(res, err);

        res.render("adminCategories", {
            user: req.session.user,
            categories: results,
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    });

});


// Add Location form (Ahmad)
app.get("/admin/locations/add", checkAuthenticated, checkAdmin, (req, res) => {
    res.render("locationForm", {
        user: req.session.user,
        isEdit: false,
        location: {},
        messages: req.flash("success"),
        errors: req.flash("error")
    });
});

// Handle location creation (Ahmad)
app.post("/admin/locations/add", checkAuthenticated, checkAdmin, (req, res) => {
    const { name } = req.body;

    const sql = "INSERT INTO locations (name) VALUES (?)";

    db.query(sql, [name], (err) => {
        if (err) return dbError(res, err);

        req.flash("success", "Location added successfully.");
        res.redirect("/admin/locations");
    });
});
// Update Location form (Ahmad)
app.get("/admin/locations/update/:id", checkAuthenticated, checkAdmin, (req, res) => {

    const sql = "SELECT * FROM locations WHERE location_id = ?";

    db.query(sql, [req.params.id], (err, results) => {

        if (err) return dbError(res, err);

        if (results.length === 0) {
            req.flash("error", "Location not found.");
            return res.redirect("/admin/locations");
        }

        res.render("locationForm", {
            user: req.session.user,
            isEdit: true,
            location: results[0],
            messages: req.flash("success"),
            errors: req.flash("error")
        });

    });

});

// Handle location update (Ahmad)
app.post("/admin/locations/update/:id", checkAuthenticated, checkAdmin, (req, res) => {

    const { name } = req.body;

    const sql = "UPDATE locations SET name = ? WHERE location_id = ?";

    db.query(sql, [name, req.params.id], (err) => {
        if (err) return dbError(res, err);

        req.flash("success", "Location updated successfully.");
        res.redirect("/admin/locations");
    });

});

// Delete Location (Ahmad)
app.post("/admin/locations/delete/:id", checkAuthenticated, checkAdmin, (req, res) => {
    const locationId = req.params.id;

    const sql = "DELETE FROM locations WHERE location_id = ?";

    db.query(sql, [locationId], (err) => {
        if (err) {
            return dbError(res, err);
        }

        req.flash("success", "Location deleted successfully.");
        res.redirect("/admin/locations");
    });
});

// Add Category form (Ahmad)
app.get("/admin/categories/add", checkAuthenticated, checkAdmin, (req, res) => {
    res.render("categoryForm", {
          user: req.session.user,
          isEdit: false,
          category: {},
          messages: req.flash("success"),
          errors: req.flash("error")
      });
    });

// Handle category creation (Ahmad)
app.post("/admin/categories/add", checkAuthenticated, checkAdmin, (req, res) => {
    const { name } = req.body;

    const sql = "INSERT INTO categories (name) VALUES (?)";

    db.query(sql, [name], (err) => {
        if (err) return dbError(res, err);

        req.flash("success", "Category added successfully.");
        res.redirect("/admin/categories");
    });
});

// Update Category form (Ahmad)
app.get("/admin/categories/update/:id", checkAuthenticated, checkAdmin, (req, res) => {

    const sql = "SELECT * FROM categories WHERE category_id = ?";

    db.query(sql, [req.params.id], (err, results) => {
        if (err) return dbError(res, err);

        if (results.length === 0) {
            req.flash("error", "Category not found.");
            return res.redirect("/admin/categories");
        }

        res.render("categoryForm", {
          user: req.session.user,
          isEdit: true,
          category: results[0],
          messages: req.flash("success"),
          errors: req.flash("error")
      });
    });
});

// Handle category update (Ahmad)
app.post("/admin/categories/update/:id", checkAuthenticated, checkAdmin, (req, res) => {

    const { name } = req.body;

    const sql = "UPDATE categories SET name = ? WHERE category_id = ?";

    db.query(sql, [name, req.params.id], (err) => {
        if (err) return dbError(res, err);

        req.flash("success", "Category updated successfully.");
        res.redirect("/admin/categories");
    });

});

// Delete Category (Ahmad)
app.post("/admin/categories/delete/:id", checkAuthenticated, checkAdmin, (req, res) => {
    const categoryId = req.params.id;

    const sql = "DELETE FROM categories WHERE category_id = ?";

    db.query(sql, [categoryId], (err) => {
        if (err) {
            return dbError(res, err);
        }

        req.flash("success", "Category deleted successfully.");
        res.redirect("/admin/categories");
    });
});

//End of C.5 done by ahmad

// PART D (search / filter / categories) is implemented on the homepage
// GET / and POST / routes (May). The old /search routes were removed as dead code.


// #####################################################################
// #####            PART E - CLAIMS & ADMIN APPROVAL              #####
// #####                     (Alvin, 25038212)                    #####
// #####################################################################

// ---------- STUDENT: show the "submit a claim" form for a found item (Alvin, 25038212) ----------
// Only accessible by non-admin users. Shows the claim form for a specific Found report.
app.get('/user/claims/submit/:reportId', checkAuthenticated, (req, res) => {
  // Admins manage claims - they don't submit them.
  if (req.session.user.role === 'admin') {
    req.flash('error', 'Admins cannot submit claims.');
    return res.redirect('/');
  }
  const sql = 'SELECT * FROM reports WHERE report_id = ?';
  db.query(sql, [req.params.reportId], (err, results) => {
    if (err) return dbError(res, err);
    if (results.length === 0) {
      req.flash('error', 'Report not found.');
      return res.redirect('/');
    }
    res.render('userSubmitClaim', {
      user: req.session.user,
      report: results[0],
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- STUDENT: handle the claim submission (Alvin, 25038212) ----------
// Validates: message and image required, report must be Open, no duplicate claims.
app.post('/user/claims/submit/:reportId', checkAuthenticated, upload.single('image'), (req, res) => {
  // Admins manage claims - they don't submit them.
  if (req.session.user.role === 'admin') {
    req.flash('error', 'Admins cannot submit claims.');
    return res.redirect('/');
  }
  const reportId = req.params.reportId;
  const userId = req.session.user.user_id;
  const { claim_message } = req.body;
  const image = req.file ? req.file.filename : null;

  // Server-side validation - require both a message and an image
  if (!claim_message || !req.file) {
    req.flash('error', 'Please describe why this item belongs to you and upload a proof image.');
    return res.redirect('/user/claims/submit/' + reportId);
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

// Prevent duplicate claims: each user can only claim a report once.
// This query checks if the user already has any claim (Pending/Approved/Rejected) for this report.
db.query('SELECT claim_id FROM claims WHERE report_id = ? AND user_id = ?', [reportId, userId], (dupErr, existing) => {
      if (dupErr) return dbError(res, dupErr);
      if (existing.length > 0) {
        req.flash('error', 'You have already submitted a claim for this item.');
        return res.redirect('/user/claims');
      }

      // Insert the new claim as "Pending".
      const insert = 'INSERT INTO claims (report_id, user_id, claim_message, image, status) VALUES (?, ?, ?, ?, "Pending")';
      db.query(insert, [reportId, userId, claim_message, image], (err2) => {
        if (err2) return dbError(res, err2);

        req.flash('success', 'Claim submitted! An admin will review it.');
        res.redirect('/user/claims');
      });
    });
  });
});


// =====================================================================
// PART B - CREATE AND VIEW REPORTS (Benny)
// =====================================================================

// Show the "Create Report" form with categories and locations for dropdowns.
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
        today: new Date().toISOString().split('T')[0],
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  });
});

// Handle report creation with validation:
// - All fields required
// - Date cannot be in the future
// - Category and location must exist in the database
// - Item name max 150 characters
app.post('/reports/new', checkAuthenticated, upload.single('image'), (req, res) => {
  const {
    report_type,
    item_name,
    description,
    category_id,
    location_id,
    date_lost_found
  } = req.body;

  const image = req.file ? req.file.filename : null;

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

  const categoryId = Number(category_id);
  const locationId = Number(location_id);

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(locationId) ||
    categoryId <= 0 ||
    locationId <= 0
  ) {
    req.flash('error', 'Invalid category or location.');
    return res.redirect('/reports/new');
  }

  if (item_name.trim().length > 150) {
    req.flash('error', 'Item name cannot exceed 150 characters.');
    return res.redirect('/reports/new');
  }

  const optionSql = `
    SELECT
      EXISTS(
        SELECT 1
        FROM categories
        WHERE category_id = ?
      ) AS category_exists,

      EXISTS(
        SELECT 1
        FROM locations
        WHERE location_id = ?
      ) AS location_exists
  `;

  db.query(optionSql, [categoryId, locationId], (optionError, rows) => {
    if (optionError) {
      return dbError(res, optionError);
    }

    if (!rows[0].category_exists || !rows[0].location_exists) {
      req.flash('error', 'The selected category or location does not exist.');
      return res.redirect('/reports/new');
    }

    const insertSql = `
      INSERT INTO reports
        (
          user_id,
          report_type,
          item_name,
          description,
          category_id,
          location_id,
          date_lost_found,
          status,
          image
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?)
    `;

    const values = [
      req.session.user.user_id,
      report_type,
      item_name.trim(),
      description.trim(),
      categoryId,
      locationId,
      date_lost_found,
      image
    ];

    db.query(insertSql, values, (insertError, result) => {
      if (insertError) {
        return dbError(res, insertError);
      }

      req.flash('success', 'Your report was created successfully.');
      res.redirect('/reports/' + result.insertId);
    });
  });
});

// PART D - SEARCH, FILTER & CATEGORIES (May) - runs on the /reports page
app.get('/', (req, res) => {
  // PART D - Default to showing only Open reports (May)
  const defaultSql = `
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
      ON r.user_id = u.user_id
    WHERE r.status = 'Open'
    ORDER BY r.created_at DESC
  `;

  db.query(defaultSql, (err, reports) => {
    if (err) return dbError(res, err);

    db.query('SELECT category_id, name FROM categories ORDER BY name', (catErr, categories) => {
      if (catErr) return dbError(res, catErr);

      db.query('SELECT location_id, name FROM locations ORDER BY name', (locErr, locations) => {
        if (locErr) return dbError(res, locErr);

        // report_ids the logged-in user has already claimed (0 = guest -> none)
        const uid = req.session.user ? req.session.user.user_id : 0;
        db.query('SELECT report_id FROM claims WHERE user_id = ?', [uid], (clErr, claimRows) => {
          if (clErr) return dbError(res, clErr);
          const claimedReportIds = claimRows.map(c => c.report_id);

          res.render('reports', {
            user: req.session.user,
            reports,
            categories,
            locations,
            claimedReportIds,
            filters: { searchText: '', report_type: '', category_id: '', location_id: '', status: 'Open', sort: 'newest' },
            messages: req.flash('success'),
            errors: req.flash('error')
          });
        });
      });
    });
  });
});

app.post('/', (req, res) => {
  const searchText = (req.body.searchText || '').toLowerCase();
  const reportType = req.body.report_type || '';
  const categoryId = req.body.category_id || '';
  const locationId = req.body.location_id || '';
  const status     = req.body.status;
  const sort       = req.body.sort || 'newest';

  // Build SQL with optional WHERE clause based on filters.
  // Status filter is applied in SQL for efficiency; other filters are applied in-memory.
  let filteredSql = `
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
      ON r.user_id = u.user_id
  `;

  const params = [];
  if (status !== '') {
    filteredSql += ' WHERE r.status = ?';
    params.push(status);
  }

  filteredSql += ' ORDER BY r.created_at DESC';

  db.query(filteredSql, params, (err, reports) => {
    if (err) return dbError(res, err);

  // In-memory filtering for search text, type, category, and location.
  // Note: For large datasets, these filters should be moved to SQL WHERE clauses.
  let results = reports.filter(report => {
      return report.item_name.toLowerCase().includes(searchText) ||
             (report.description || '').toLowerCase().includes(searchText);
    });

    // PART D - FILTER: Type (May)
    if (reportType !== '') {
      results = results.filter(report => report.report_type === reportType);
    }
    // PART D - CATEGORIES (May): filter by chosen category
    if (categoryId !== '') {
      results = results.filter(report => String(report.category_id) === categoryId);
    }
    // PART D - FILTER: Location (May)
    if (locationId !== '') {
      results = results.filter(report => String(report.location_id) === locationId);
    }
    // PART D - SORT (May): oldest first reverses the list
    if (sort === 'oldest') {
      results = results.reverse();
    }

    db.query('SELECT category_id, name FROM categories ORDER BY name', (catErr, categories) => {
      if (catErr) return dbError(res, catErr);

      db.query('SELECT location_id, name FROM locations ORDER BY name', (locErr, locations) => {
        if (locErr) return dbError(res, locErr);

        // report_ids the logged-in user has already claimed (0 = guest -> none)
        const uid = req.session.user ? req.session.user.user_id : 0;
        db.query('SELECT report_id FROM claims WHERE user_id = ?', [uid], (clErr, claimRows) => {
          if (clErr) return dbError(res, clErr);
          const claimedReportIds = claimRows.map(c => c.report_id);

          res.render('reports', {
            user: req.session.user,
            reports: results,
            categories,
            locations,
            claimedReportIds,
            filters: {
              searchText: req.body.searchText || '',
              report_type: reportType,
              category_id: categoryId,
              location_id: locationId,
              status: status,
              sort: sort
            },
            messages: req.flash('success'),
            errors: req.flash('error')
          });
        });
      });
    });
  });
});

// END OF PART D (May)

// ---------- VIEW MY REPORTS (Benny) ----------
// Shows all reports created by the logged-in user, with category and location names.
app.get('/user/reports', checkAuthenticated, (req, res) => {
  const sql = `
    SELECT
      r.*,
      c.name AS category_name,
      l.name AS location_name
    FROM reports r
    LEFT JOIN categories c
      ON r.category_id = c.category_id
    LEFT JOIN locations l
      ON r.location_id = l.location_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `;

  db.query(sql, [req.session.user.user_id], (err, reports) => {
    if (err) {
      return dbError(res, err);
    }

    res.render('userReports', {
      user: req.session.user,
      reports,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- VIEW REPORT DETAILS (Benny) ----------
// Shows full report info and contextual action buttons:
// - Guest: "Login to claim" / "Login to notify" (disabled)
// - Owner of Found: "Cannot claim own report" (disabled)
// - Owner of Lost: "Mark as Recovered" button
// - Admin: "Admin cannot claim" (disabled)
// - Other user on Found: "Claim This Item" (if not already claimed)
// - Other user on Lost: "I Found This Item"
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
      ON r.user_id = u.user_id
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

    // Has the logged-in user already claimed this report? (0 = guest -> no)
    const uid = req.session.user ? req.session.user.user_id : 0;
    db.query('SELECT claim_id FROM claims WHERE report_id = ? AND user_id = ?', [reportId, uid], (clErr, claimRows) => {
      if (clErr) return dbError(res, clErr);

      res.render('reportDetails', {
        user: req.session.user,
        report: results[0],
        alreadyClaimed: claimRows.length > 0,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  });
});

//------- Show "I Found This Item" form (Ahmad) -------
// Validates: report must be Lost, Open, and not owned by the finder.
app.get(
  '/user/lost-item-alerts/submit/:reportId',
  checkAuthenticated,
  (req, res) => {
    const sql = `
      SELECT *
      FROM reports
      WHERE report_id = ?
    `;

    db.query(sql, [req.params.reportId], (err, results) => {
      if (err) return dbError(res, err);

      if (results.length === 0) {
        req.flash('error', 'Report not found.');
        return res.redirect('/');
      }

      const report = results[0];

      if (report.report_type !== 'Lost') {
        req.flash(
          'error',
          'The “I Found This Item” feature is only for lost reports.'
        );
        return res.redirect('/reports/' + report.report_id);
      }

      if (report.status !== 'Open') {
        req.flash('error', 'This lost-item report is already resolved.');
        return res.redirect('/');
      }

      if (report.user_id === req.session.user.user_id) {
        req.flash('error', 'You cannot send a found alert to yourself.');
        return res.redirect('/reports/' + report.report_id);
      }

      res.render('userSubmitFoundNotification', {
        report,
        user: req.session.user,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  }
);

//------ Save the notification (Ahmad) ------------
// Saves a new found_notification with status 'Pending'.
// Validates: message >= 10 chars, report exists/is Open/Lost, not self-notification, no duplicate.
app.post(
  '/user/lost-item-alerts/submit/:reportId',
  checkAuthenticated,
  upload.single('image'),
  (req, res) => {
    const reportId = req.params.reportId;
    const finderId = req.session.user.user_id;
    const message = (req.body.message || '').trim();
    const image = req.file ? req.file.filename : null;

    if (message.length < 10) {
      req.flash(
        'error',
        'Please provide at least 10 characters of information.'
      );
      return res.redirect(
        '/user/lost-item-alerts/submit/' + reportId
      );
    }

    const reportSql = `
      SELECT report_id, user_id, report_type, status
      FROM reports
      WHERE report_id = ?
    `;

    db.query(reportSql, [reportId], (reportError, reports) => {
      if (reportError) return dbError(res, reportError);

      if (reports.length === 0) {
        req.flash('error', 'Report not found.');
        return res.redirect('/');
      }

      const report = reports[0];

      if (report.report_type !== 'Lost' || report.status !== 'Open') {
        req.flash('error', 'This lost report is no longer active.');
        return res.redirect('/');
      }

      if (report.user_id === finderId) {
        req.flash('error', 'You cannot send a found alert to yourself.');
        return res.redirect('/reports/' + reportId);
      }

  // Prevent duplicate notifications: each finder can only send one pending notification per report.
  const duplicateSql = `
    SELECT notification_id
    FROM found_notifications
    WHERE report_id = ?
      AND finder_id = ?
      AND status = 'Pending'
  `;

      db.query(
        duplicateSql,
        [reportId, finderId],
        (duplicateError, existingNotifications) => {
          if (duplicateError) return dbError(res, duplicateError);

          if (existingNotifications.length > 0) {
            req.flash(
              'error',
              'You already sent a notification for this lost item.'
            );
            return res.redirect('/reports/' + reportId);
          }

          const insertSql = `
            INSERT INTO found_notifications
              (report_id, finder_id, message, image, status)
            VALUES (?, ?, ?, ?, 'Pending')
          `;

          db.query(
            insertSql,
            [reportId, finderId, message, image],
            (insertError) => {
              if (insertError) return dbError(res, insertError);

              req.flash(
                'success',
                'The owner has been informed that you may have found the item.'
              );

              res.redirect('/reports/' + reportId);
            }
          );
        }
      );
    });
  }
);

//------- Display "I Found This Item" notifications received by owner (Ahmad) ---------
// Shows all found_notifications where the logged-in user is the report owner.
// Sorted by Pending first, then by newest.
app.get(
  '/user/lost-item-alerts',
  checkAuthenticated,
  (req, res) => {
    const sql = `
      SELECT
        n.*,
        r.item_name,
        r.status AS report_status,
        u.username AS finder_name
      FROM found_notifications n
      JOIN reports r
        ON n.report_id = r.report_id
      JOIN users u
        ON n.finder_id = u.user_id
      WHERE r.user_id = ?
      ORDER BY
        (n.status = 'Pending') DESC,
        n.created_at DESC
    `;

    db.query(sql, [req.session.user.user_id], (err, notifications) => {
      if (err) return dbError(res, err);

      res.render('userLostItemAlerts', {
        notifications,
        user: req.session.user,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  }
);

//------ Owner confirms the item was recovered (Ahmad) ----
// When owner confirms a notification:
// 1. Mark the notification as 'Confirmed'
// 2. Dismiss all other pending notifications for the same report
// 3. Mark the report as 'Resolved'
app.post(
  '/user/lost-item-alerts/:notificationId/confirm',
  checkAuthenticated,
  (req, res) => {
    const notificationId = req.params.notificationId;

    const selectSql = `
      SELECT
        n.notification_id,
        n.report_id,
        n.status AS notification_status,
        r.user_id AS owner_id,
        r.report_type,
        r.status AS report_status
      FROM found_notifications n
      JOIN reports r
        ON n.report_id = r.report_id
      WHERE n.notification_id = ?
    `;

    db.query(selectSql, [notificationId], (selectError, rows) => {
      if (selectError) return dbError(res, selectError);

      if (rows.length === 0) {
        req.flash('error', 'Notification not found.');
        return res.redirect('/user/lost-item-alerts');
      }

      const notification = rows[0];

      if (notification.owner_id !== req.session.user.user_id) {
        req.flash('error', 'You are not the owner of this report.');
        return res.redirect('/user/lost-item-alerts');
      }

  // Validate: notification must exist, report must be Open/Lost, and must be Pending
  if (
    notification.report_type !== 'Lost' ||
    notification.report_status !== 'Open' ||
    notification.notification_status !== 'Pending'
  ) {
        req.flash('error', 'This notification can no longer be confirmed.');
        return res.redirect('/user/lost-item-alerts');
      }

      db.query(
        `
          UPDATE found_notifications
          SET status = 'Confirmed'
          WHERE notification_id = ?
        `,
        [notificationId],
        (confirmError) => {
          if (confirmError) return dbError(res, confirmError);

          // Step 2: Dismiss all OTHER pending notifications for this report
          db.query(
            `
              UPDATE found_notifications
              SET status = 'Dismissed'
              WHERE report_id = ?
                AND notification_id != ?
                AND status = 'Pending'
            `,
            [notification.report_id, notificationId],
            (dismissError) => {
              if (dismissError) return dbError(res, dismissError);

              // Step 3: Mark the report as Resolved
              db.query(
                `
                  UPDATE reports
                  SET status = 'Resolved'
                  WHERE report_id = ?
                `,
                [notification.report_id],
                (reportError) => {
                  if (reportError) return dbError(res, reportError);

                  req.flash(
                    'success',
                    'Item recovery confirmed. The report is now resolved.'
                  );

                  res.redirect('/user/lost-item-alerts');
                }
              );
            }
          );
        }
      );
    });
  }
);


//-------- Owner dismisses an incorrect notification (Ahmad) -------
// Owner can dismiss a notification if they believe the finder is mistaken.
// Only Pending notifications can be dismissed.
app.post(
  '/user/lost-item-alerts/:notificationId/dismiss',
  checkAuthenticated,
  (req, res) => {
    const notificationId = req.params.notificationId;

    const selectSql = `
      SELECT
        n.notification_id,
        n.status,
        r.user_id AS owner_id
      FROM found_notifications n
      JOIN reports r
        ON n.report_id = r.report_id
      WHERE n.notification_id = ?
    `;

    db.query(selectSql, [notificationId], (selectError, rows) => {
      if (selectError) return dbError(res, selectError);

      if (
        rows.length === 0 ||
        rows[0].owner_id !== req.session.user.user_id
      ) {
        req.flash('error', 'Notification not found or access denied.');
        return res.redirect('/user/lost-item-alerts');
      }

      if (rows[0].status !== 'Pending') {
        req.flash('error', 'This notification has already been handled.');
        return res.redirect('/user/lost-item-alerts');
      }

      db.query(
        `
          UPDATE found_notifications
          SET status = 'Dismissed'
          WHERE notification_id = ?
        `,
        [notificationId],
        (updateError) => {
          if (updateError) return dbError(res, updateError);

          req.flash('success', 'The notification was dismissed.');
          res.redirect('/user/lost-item-alerts');
        }
      );
    });
  }
);

//------ Mark as Recovered (Alvin) - owner may recover an item by themselves ------
// Allows the report owner to mark their own Lost report as Resolved.
// The SQL WHERE clause ensures:
// - Report belongs to the logged-in user
// - Report type is 'Lost' (not 'Found')
// - Report is still 'Open' (not already resolved)
app.post(
  '/reports/:id/mark-recovered',
  checkAuthenticated,
  (req, res) => {
    const reportId = req.params.id;
    const userId = req.session.user.user_id;

    const sql = `
      UPDATE reports
      SET status = 'Resolved'
      WHERE report_id = ?
        AND user_id = ?
        AND report_type = 'Lost'
        AND status = 'Open'
    `;

    db.query(sql, [reportId, userId], (err, result) => {
      if (err) return dbError(res, err);

      if (result.affectedRows === 0) {
        req.flash(
          'error',
          'The report was not found, is already resolved, or does not belong to you.'
        );
        return res.redirect('/user/reports');
      }

      req.flash(
        'success',
        'The item was marked as recovered and the report is now resolved.'
      );

      res.redirect('/user/reports');
    });
  }
);


// ---------- STUDENT: view my own claims and their status (Alvin, 25038212) ----------
app.get('/user/claims', checkAuthenticated, (req, res) => {
  const sql = `SELECT c.*, r.item_name, r.report_type, r.image AS report_image
               FROM claims c
               JOIN reports r ON c.report_id = r.report_id
               WHERE c.user_id = ?
               ORDER BY c.created_at DESC`;
  db.query(sql, [req.session.user.user_id], (err, claims) => {
    if (err) return dbError(res, err);
    res.render('userClaims', {
      user: req.session.user,
      claims: claims,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- ADMIN: view and manage all claims (Alvin, 25038212) ----------
// Sorted by Pending first (using expression in ORDER BY), then by newest.
app.get('/admin/claims', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = `SELECT c.*, r.item_name, r.image AS report_image, u.username, u.email
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

// ---------- ADMIN: approve a claim (Alvin, 25038212) ----------
// Approving a claim triggers a cascade:
// 1. Find the claim to get the report_id
// 2. Set this claim to 'Approved'
// 3. Auto-reject all OTHER pending claims for the same report
// 4. Mark the report as 'Resolved'
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

      // 3. Auto-reject every OTHER pending claim for the same report,
      //    giving them a reason so those students know why.
      db.query("UPDATE claims SET status = 'Rejected', reject_reason = 'Another claim was approved for this item.' WHERE report_id = ? AND claim_id != ? AND status = 'Pending'",
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

// ---------- ADMIN: reject a single claim with a reason (Alvin, 25038212) ----------
app.post('/admin/claims/:claimId/reject', checkAuthenticated, checkAdmin, (req, res) => {
  // The admin can type a reason in the reject form; store it so the student
  // can see why their claim was rejected. Empty reason is stored as null.
  const reason = req.body.reject_reason ? req.body.reject_reason : null;
  db.query("UPDATE claims SET status = 'Rejected', reject_reason = ? WHERE claim_id = ?",
    [reason, req.params.claimId], (err) => {
      if (err) return dbError(res, err);
      req.flash('success', 'Claim rejected.');
      res.redirect('/admin/claims');
    });
});

// ---------- ADMIN: view and manage all users (Xavier) ----------
app.get('/admin/users', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = 'SELECT user_id, username, email, role, created_at FROM users ORDER BY created_at DESC';
  db.query(sql, (err, users) => {
    if (err) return dbError(res, err);
    res.render('adminUsers', {
      user: req.session.user,
      users: users,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  });
});

// ---------- ADMIN: change a user's role (Xavier) ----------
// Validates the role is either 'user' or 'admin', and prevents self-demotion.
app.post('/admin/users/:userId/role', checkAuthenticated, checkAdmin, (req, res) => {
  const userId = req.params.userId;
  const newRole = req.body.role;

  if (!['user', 'admin'].includes(newRole)) {
    req.flash('error', 'Invalid role.');
    return res.redirect('/admin/users');
  }

  // Prevent admin from changing their own role
  if (parseInt(userId) === req.session.user.user_id) {
    req.flash('error', 'You cannot change your own role.');
    return res.redirect('/admin/users');
  }

  db.query('UPDATE users SET role = ? WHERE user_id = ?', [newRole, userId], (err) => {
    if (err) return dbError(res, err);
    req.flash('success', 'User role updated to ' + newRole + '.');
    res.redirect('/admin/users');
  });
});

// ---------- ADMIN: delete a user account (Xavier) ----------
// Prevents admin from deleting their own account.
app.post('/admin/users/:userId/delete', checkAuthenticated, checkAdmin, (req, res) => {
  const userId = req.params.userId;

  if (parseInt(userId) === req.session.user.user_id) {
    req.flash('error', 'You cannot delete your own account.');
    return res.redirect('/admin/users');
  }

  db.query('DELETE FROM users WHERE user_id = ?', [userId], (err) => {
    if (err) return dbError(res, err);
    req.flash('success', 'User account deleted.');
    res.redirect('/admin/users');
  });
});

// #####################################################################
// #####                   END OF PART E                          #####
// #####################################################################

// ---------- Start the server (Xavier) ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});