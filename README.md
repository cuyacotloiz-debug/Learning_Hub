# Learning HuB

Classroom workspace for teachers and students. Teachers create rooms with a join code, see who enrolled in each subject, and post class messages or online-meeting links. Students enroll with that code and read those messages.

- Frontend: React + Vite ([`src/`](./src))
- API: auth, classrooms, and enrollments ([`pages/api/`](./pages/api), [`lib/`](./lib))
- Data: Prisma ([`prisma/`](./prisma))

Repo: [cuyacotloiz-debug/Learning_Hub](https://github.com/cuyacotloiz-debug/Learning_Hub)

## Run the UI

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

If the API is offline, the UI uses a local demo store so you can still sign in, create classrooms, and join rooms.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Teacher | `teacher@example.com` | `Password123!` |
| Student | `student@example.com` | `Password123!` |

Student join code for the sample room: `LH-8K4P2X`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite UI |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
| `npm test` | Vitest |

## API

See [README_API.md](./README_API.md) for request bodies and status codes.

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Anyone |
| `POST` | `/api/auth/login` | Anyone |
| `POST` | `/api/auth/refresh` | Cookie session |
| `POST` | `/api/auth/logout` | Cookie session |
| `POST` | `/api/classrooms` | Teacher |
| `GET` | `/api/classrooms` | Teacher list (with roster and messages), or public active rooms |
| `POST` | `/api/classrooms/:id/join` | Student |
| `GET` | `/api/classrooms/:id/students` | Teacher |
| `GET` | `/api/classrooms/:id/messages` | Teacher or enrolled student |
| `POST` | `/api/classrooms/:id/messages` | Teacher |

## Database

Prisma is set up for PostgreSQL. Local SQLite notes are in [prisma/README.md](./prisma/README.md).

```bash
npx prisma generate
npx prisma db push
node -r ts-node/register prisma/seed.ts
```

Set `DATABASE_URL` before using Postgres.

## Push this repo to GitHub

Remote is already:

```text
origin  https://github.com/cuyacotloiz-debug/Learning_Hub.git
```

From this folder:

```bash
git add README.md
git commit -m "docs: add Learning HuB README"
git push -u origin main
```

When Git asks for a password, use a GitHub **personal access token**, not your account password. Username: `cuyacotloiz-debug`.

## More docs

- [README_API.md](./README_API.md) — endpoint details
- [SECURITY.md](./SECURITY.md) — auth, cookies, CSRF
- [prisma/README.md](./prisma/README.md) — schema and seed
