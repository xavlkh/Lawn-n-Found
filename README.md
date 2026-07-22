<div align="center">

<img src="./public/images/lawn-and-found-navbar-logo.png" alt="Lawn & Found" width="200" />

A campus lost-and-found portal for Republic Polytechnic students to report, search, claim, and recover lost or found items.

[![Node.js](https://img.shields.io/badge/Node.js->=18-3c873a?style=flat-square)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square)](https://expressjs.com)
[![EJS](https://img.shields.io/badge/EJS-6.x-a91e50?style=flat-square)](https://ejs.co)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#features) | [Tech Stack](#tech-stack) | [Self-Host Guide](#self-host-guide) | [Deployment](#deployment) | [Project Structure](#project-structure)

</div>

---

## About

**Lawn & Found** is a web-based lost-and-found management system built for campus use. Students can report lost items, post found items, claim items they recognize, and notify owners when they spot a belonging. Administrators oversee the entire workflow -- approving claims, managing users, and resolving reports.

The portal was developed as a team project (CA2) for the module **C237-026 Software Application Development** at Republic Polytechnic, Singapore.

## Features

### For Students
- **Report Lost/Found Items** -- Post an item with name, description, category, location, date, and an optional photo.
- **Search & Filter** -- Browse reports by keyword, type (Lost/Found), category, location, and status. Sort by newest or oldest.
- **Submit a Claim** -- Found a reported item? Submit a claim with a message and proof photo. Duplicate claims are blocked.
- **"I Found This Item" Alerts** -- Notify the owner of a lost item that you found it. Upload a photo and leave a message.
- **Confirm Recovery** -- Owners can confirm that a found notification matches their item, which marks the report as resolved.
- **My Reports / My Claims** -- View and manage all your submitted reports and claims in one place.
- **Self-Recovery** -- Mark your own lost item as recovered directly.

### For Administrators
- **Manage Claims** -- Review all claims with item details, claimant info, proof images, and claim messages. Approve or reject with a reason.
- **Auto-Rejection** -- Approving a claim automatically rejects all other pending claims for the same item and marks it resolved.
- **Manage Users** -- View all registered users and promote/demote roles between user and admin.
- **Pending Claim Badge** -- Navbar badge showing the count of claims awaiting review.

### General
- **Role-Based Access** -- Separate views and permissions for students and admins.
- **Image Uploads** -- JPEG, PNG, GIF, and WebP support for item photos and proof images.
- **Session Authentication** -- Server-side sessions with a 1-week cookie expiry.
- **Flash Messages** -- Success/error feedback on all actions.
- **Responsive UI** -- Bootstrap 5.3.3 with mobile-friendly navigation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js (>=18) |
| **Framework** | Express.js 5.x |
| **Templating** | EJS 6.x |
| **Database** | MySQL 8.x (via mysql2 with connection pooling) |
| **Session** | express-session (server-side) |
| **File Uploads** | Multer 2.x (disk storage) |
| **CSS** | Bootstrap 5.3.3 (CDN) |
| **Icons** | Bootstrap Icons 1.11.3 (CDN) |
| **Config** | dotenv |

## Self-Host Guide

### Prerequisites

- [Node.js](https://nodejs.org) >= 18
- [MySQL](https://www.mysql.com) 8.x (local install or remote server)
- [MySQL Workbench](https://www.mysql.com/products/workbench/) (recommended for schema import)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Lawn-n-Found
```

### 2. Set Up the Database

Open MySQL Workbench and run the schema file to create the database, tables, and seed data:

```sql
-- File: sql/schema.sql
-- This creates the database 'c237_026_team2_ca2' with all tables and sample data
```

Or from the command line:

```bash
mysql -u <your_user> -p < sql/schema.sql
```

> [!NOTE]
> The schema includes 3 pre-loaded users, 5 categories, 16 campus locations, and 3 sample reports.

### 3. Configure Environment Variables

Copy the example environment file and fill in your database credentials:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL connection details:

```
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=c237_026_team2_ca2
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start the Application

**Development mode** (auto-restarts on changes):

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

### 6. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000).

### Seed Accounts

| Username | Email | Password | Role |
|----------|-------|----------|------|
| Admin | admin@admin.com | password | admin |
| Test User | test@admin.com | password | user |
| Alvin | alvin@student.rp.edu.sg | password | user |

## Deployment

The application is deployed on [Render](https://render.com) (free tier) with an Azure-hosted MySQL database.

### Deploy to Render

1. Push your repository to GitHub.
2. Create a new **Web Service** on Render.
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Add environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) in Render's dashboard.
6. Deploy.

### Keep-Alive Workflow

A GitHub Actions workflow (`.github/workflows/keep-alive.yml`) pings the Render service every 10 minutes to prevent free-tier spin-down. It can also be triggered manually from the GitHub Actions UI.

> [!CAUTION]
> GitHub Actions does not guarantee reliable execution for schedules below 1 hour. Runs can be delayed minutes or even hours during high demand, and free-tier repos get lower priority. For a reliable 10-minute keep-alive, use an external cron service instead:
>
> - **[cron-job.org](https://cron-job.org)** -- free, supports 10-minute intervals.
> - **[UptimeRobot](https://uptimerobot.com)** -- free tier pings every 5 minutes and also provides uptime monitoring.

## Project Structure

```
Lawn-n-Found/
├── app.js                     # Express server, routes, middleware (all application logic)
├── package.json               # Dependencies and scripts
├── .env.example               # Environment variable template
├── .env                       # Database credentials (gitignored)
├── sql/
│   └── schema.sql             # Database schema + seed data
├── public/
│   ├── css/
│   │   └── style.css          # Custom CSS overrides
│   └── images/                # Uploaded images + static assets
├── views/
│   ├── partials/
│   │   ├── head.ejs           # Shared <head> with Bootstrap CDN
│   │   ├── navbar.ejs         # Role-based navigation bar
│   │   └── messages.ejs       # Flash message component
│   ├── login.ejs              # Login page
│   ├── register.ejs           # Registration page
│   ├── reports.ejs            # Homepage: browse/search/filter reports
│   ├── reportDetails.ejs      # Report detail view
│   ├── newReport.ejs          # Create report form
│   ├── updatereport.ejs       # Edit report form
│   ├── userReports.ejs        # My Reports page
│   ├── userSubmitClaim.ejs    # Submit a claim form
│   ├── userClaims.ejs         # My Claims page
│   ├── userSubmitFoundNotification.ejs  # "I Found This Item" form
│   ├── userLostItemAlerts.ejs # Lost Item Alerts inbox
│   ├── adminClaims.ejs        # Admin: Manage Claims
│   ├── updateClaim.ejs        # Admin: Edit Claim form
│   └── adminUsers.ejs         # Admin: Manage Users
└── .github/
    └── workflows/
        └── keep-alive.yml     # GitHub Actions: prevents Render spin-down
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles (user/admin) |
| `categories` | Item categories (Electronics, Books, Clothing, Cards & IDs, Others) |
| `locations` | Campus locations (16 locations across blocks E1-E6, W1-W6, canteens, TRCC) |
| `reports` | Lost/Found reports with item details, images, and status |
| `found_notifications` | "I Found This Item" alerts from finders to report owners |
| `claims` | Claims on found items with proof images and admin decisions |

## License

This project is licensed under the [MIT License](LICENSE).
