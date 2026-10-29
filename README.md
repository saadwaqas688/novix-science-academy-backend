# Novix Science Academy — Backend API

Frontend repo: [novix-science-academy-frontend](https://github.com/saadwaqas688/novix-science-academy-frontend)

Learning app for Federal Board (FBISE) students — Physics, Chemistry, Mathematics and Computer Science.
Students read chapter notes, watch YouTube lectures and take topic-wise MCQ tests (10 questions each) with a progress history.
The academy admin approves sign-ups and manages users, courses, notes, videos, assessments and the teacher profile.

| Part | Tech |
|---|---|
| Backend (`/backend`) | Node.js 22, Express 5, TypeScript, PostgreSQL 16, Drizzle ORM, JWT auth, Zod validation, Multer uploads |
| Frontend (`/frontend`) | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui components (Radix), TanStack Query, Recharts |
| Infra | Docker Compose (db + backend + frontend) |

The design uses the PetsInSync theme (teal → indigo → violet, glass cards, Plus Jakarta Sans / Outfit fonts) and is mobile-first.

---

## 1. Run everything with Docker (recommended)

Requirements: **Docker Desktop**.

```bash
# API + PostgreSQL only
cp .env.example .env          # optional — defaults work for local use
docker compose up -d --build

# Full stack (API + PostgreSQL + Next.js frontend):
# clone both repos side by side, then run from this folder
#   parent/
#     novix-science-academy-backend/   <- this repo
#     novix-science-academy-frontend/
docker compose --profile full up -d --build
```

Open:

- Student app: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- API: http://localhost:4000/api (health check: http://localhost:4000/health)

On first start the backend runs the database migrations and creates:

| Account | Email | Password |
|---|---|---|
| Admin | `admin@novix.pk` | `Admin@12345` |
| Demo student (approved) | `ayesha@student.pk` | `Student@123` |
| Demo students (pending approval) | `bilal@student.pk`, `zainab@student.pk` | `Student@123` |

Change `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` before the first start to use your own admin account.
Set `SEED_DEMO_DATA=false` to start without demo students, sample tests and sample videos (subjects, chapters and the admin are always created).

Useful commands:

```bash
docker compose logs -f backend      # backend logs
docker compose down                 # stop
docker compose down -v              # stop AND delete the database + uploaded files
```

Uploaded PDFs and photos are stored in the `uploads` Docker volume; the database lives in the `db_data` volume.

## 2. Run for development (hot reload)

```bash
# 1) database only
docker compose up -d db

# 2) backend — http://localhost:4000
npm install
npm run dev            # uses postgres://novix:novix_password@localhost:5433/novix by default

# 3) frontend — http://localhost:3000 (in the frontend repo)
cd ../novix-science-academy-frontend
npm install
npm run dev            # talks to http://localhost:4000 (set NEXT_PUBLIC_API_URL to change)
```

## 3. Features

**Student app**
- Home page with the teacher's photo, name, introduction, highlights and stats (all editable by the admin).
- Course books (Physics, Chemistry, Mathematics, Computer Science) per class (9, 10; 11 and 12 ready but marked "coming soon").
- Opening a course requires sign-in. Sign-up creates a *pending* account; the student can sign in only after the admin approves it.
- Course page: book PDF, chapter tiles and test progress.
- Chapter page with three tabs — **Notes** (PDF), **Videos** (YouTube links), **Assessments**. Empty tabs show "Coming soon".
- Assessments: 10 MCQs, move back and forth freely, question palette, timer, keyboard shortcuts (1–4 / A–D, ← →). The score is calculated on the server; correct answers are never sent before submitting.
- Result page with score ring and answer review.
- Progress page: bar-chart history (filter by subject), average per subject, list of all attempts.
- Profile page (edit name/phone, change password).

**Admin panel** (`/admin`)
- Dashboard: approved/pending counts, tests taken, average score, pending approvals, content status, recent attempts.
- Users: approve / reject / disable / delete, search, add users directly (auto-approved).
- Courses & chapters: upload the course book PDF, add/rename/delete chapters, upload chapter notes (PDF), add YouTube lecture links.
- Assessments: create/edit/delete topic-wise tests per chapter (exactly 10 questions × 4 options), hide/show tests.
- Results: every attempt by every student, filter and search.
- Teacher profile: name, title, introduction, highlights, stats and photo shown on the home page.

## 4. Project structure

```
backend/
  src/
    app.ts, index.ts, config.ts
    db/schema.ts          ← tables (Drizzle)
    db/seed.ts, seed-data.ts  ← admin, subjects, chapters, demo data
    routes/auth.ts        ← signup, login, me
    routes/public.ts      ← teacher profile, subjects
    routes/student.ts     ← subject page, chapter, take test, results, progress
    routes/admin/*.ts     ← users, content (chapters/notes/videos/books/teacher), assessments, stats/results
    middleware/           ← auth (JWT), uploads (PDF/images), error handler
  drizzle/                ← SQL migrations (applied automatically on start)
frontend/
  src/app/(site)/         ← student pages: home, courses, chapters, results, progress, profile, login, signup
  src/app/test/[id]       ← full-screen test page
  src/app/admin/          ← admin panel pages
  src/components/ui/      ← shadcn/ui components
  src/lib/                ← API client, auth, types
```

## 5. Changing the database schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` — creates a new SQL file in `drizzle/`.
3. Restart the backend — new migrations are applied automatically.

## 6. API overview

All routes are under `/api`. Send `Authorization: Bearer <token>` for protected routes.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/signup` · `POST /auth/login` · `GET/PATCH /auth/me` | public / user | Accounts |
| `GET /teacher` · `GET /subjects?classLevel=9` | public | Home page data |
| `GET /subjects/:slug?classLevel=9` | student | Book + chapters + progress |
| `GET /chapters/:id` | student | Notes, videos, assessments |
| `GET /assessments/:id` · `POST /assessments/:id/attempts` | student | Take a test / submit answers |
| `GET /attempts/:id` · `GET /me/progress` | student | Result review, progress history |
| `GET/POST/PATCH/DELETE /admin/users…` | admin | User management & approvals |
| `/admin/subjects…`, `/admin/chapters…`, `/admin/books…`, `/admin/teacher…` | admin | Content management & uploads |
| `GET/POST/PUT/DELETE /admin/assessments…` | admin | MCQ tests |
| `GET /admin/stats` · `GET /admin/results` | admin | Dashboard & results |

## 7. Before going live

- Set a long random `JWT_SECRET`, a strong `ADMIN_PASSWORD` and `SEED_DEMO_DATA=false` in `.env`.
- Set `BACKEND_PUBLIC_URL` to the public URL of the API and `CORS_ORIGIN` to the public URL of the frontend, then rebuild (`docker compose up -d --build`) — the frontend bakes the API URL in at build time.
- Put the app behind HTTPS (e.g. Nginx / Caddy / a cloud load balancer).
- Note: uploaded files (notes, books, photo) are served publicly by URL so that PDFs open directly in the browser.
