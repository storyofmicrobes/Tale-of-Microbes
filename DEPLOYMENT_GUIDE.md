# Step-by-step Publishing Guide

## 1. Prepare project

Extract the ZIP. Confirm that these files exist:

- package.json
- src/server.js
- src/initDb.js
- public/index.html
- public/app.js
- .env.example

## 2. Test locally

```bash
npm install
npm run init-db
npm start
```

Open `http://localhost:3000`.

## 3. Upload to GitHub

Create a new GitHub repository, then upload all project files.

## 4. Deploy on Render

Create a Render account, choose New Web Service, connect the GitHub repo.

Settings:

- Environment: Node
- Build command: `npm install && npm run init-db`
- Start command: `npm start`

Environment variables:

- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `APP_NAME`

## 5. Launch pilot

Use the Render public URL to test with 10-20 students.

## 6. Add your course content

Login as admin, add courses, modules and lessons. For video lessons, paste YouTube unlisted embed links.

## 7. Upgrade later

When you start paid enrollments, use PostgreSQL and Razorpay.
