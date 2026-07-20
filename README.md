# Lawn & Found - Part E (Claims & Admin Approval)

**Owner:** Alvin (25038212) — Part E of the Lawn & Found Portal.

This is a **self-contained demo of my part only**. Real login/register (Part A),
reports CRUD (Parts B/C) and search (Part D) are my teammates' work and are **not**
implemented here — only minimal scaffolding is included so the claims flow runs.

## What I built (Part E)
- **Submit a claim** for a Found item (student) — stored as `Pending`
- **My Claims** — a student views their own claims and status
- **Manage Claims** (admin) — approve / reject
- **Approval enhancement:** approving a claim marks the report `Resolved` and
  **auto-rejects all other pending claims** for that report

## Setup
1. Import the database: run `sql/schema.sql` in MySQL Workbench.
2. In `app.js`, set your MySQL `password`.
3. Install packages:
   ```
   npm install
   ```
   (express, ejs, mysql2, express-session, connect-flash)
4. Start the app:
   ```
   npx nodemon app.js
   ```
5. Open http://localhost:3000

## Demo steps
1. Go to **Login** → log in as **Test User**, submit a claim on a Found item.
2. (Optional) Login as **Alvin**, submit a second claim on the *same* item.
3. Login as **Admin** → **Manage Claims** → **Approve** one claim.
4. See the report become **Resolved** and the other pending claim auto-**Rejected**.

## Note on the dev login
`/login` + `/dev/login/:id` are **temporary scaffolding** to set a session user
without Xavier's real authentication. Remove them when Part A is integrated.
