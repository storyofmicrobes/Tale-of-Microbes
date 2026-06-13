# Gene Prospera Academy LMS

A deployable web-based Learning Management System inspired by modern AI career accelerator LMS patterns, built for original Gene Prospera Biotech courses.

## Included Features

- Admin login
- Student registration and login
- Course catalogue
- Course enrollment
- Personalized learning dashboard
- Modules and lessons
- Embedded video lessons using YouTube/Vimeo/Bunny Stream embed URLs
- PDF/resource link support
- Quizzes with scoring
- Assignments and project submissions
- Live session links
- Progress tracking
- Certificate generation and PDF download
- Admin dashboard with users, courses and submissions

## Default Login

Admin:

```text
Email: geneprosperabiotech@gmail.com
Password: admin1234
```

Demo student:

```text
Email: student@example.com
Password: student123
```

Change these before public launch.

## Local Setup

1. Install Node.js 20 or higher.
2. Extract this folder.
3. Copy `.env.example` to `.env`.
4. Run:

```bash
npm install
npm run init-db
npm start
```

5. Open:

```text
http://localhost:3000
```

## Free Hosting Stack

For the first few months, use:

- GitHub for source code
- Render free web service for this app
- SQLite included for pilot testing
- YouTube unlisted videos for video hosting

For production, upgrade to PostgreSQL/Supabase and paid Render/DigitalOcean.

## Render Deployment

1. Upload this project to GitHub.
2. Render → New Web Service → connect GitHub repository.
3. Build command:

```bash
npm install && npm run init-db
```

4. Start command:

```bash
npm start
```

5. Add environment variables:

```text
SESSION_SECRET=use-a-long-random-secret
ADMIN_EMAIL=geneprosperabiotech@gmail.com
ADMIN_PASSWORD=admin1234
APP_NAME=Gene Prospera Academy LMS
```

6. Deploy.

## Important Production Improvements

Before real paid-course launch, add:

- Razorpay payment gateway
- PostgreSQL database
- Proper file upload with S3/Supabase Storage
- Password reset
- Email/SMS/WhatsApp notification
- Stronger admin password
- Daily database backup
- Privacy policy and terms page
