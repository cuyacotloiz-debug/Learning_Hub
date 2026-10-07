Updated: Request validation and join endpoint

Changes:
- Added request validation using zod in lib/validations.ts
- Auth endpoints (register, login) now use zod schemas for input validation
- Classroom creation endpoint uses createClassroomSchema for validation
- New endpoint: POST /api/classrooms/:id/join — students can join classrooms by classroomId

Join behavior:
- Endpoint: POST /api/classrooms/:id/join
- Auth: Authorization: Bearer <token> (student role required)
- Finds classroom by its classroomId (e.g., LH-8K4P2X)
- Creates an Enrollment row; handles duplicate enrollment gracefully (409 Already enrolled)

Notes:
- The endpoints return validation errors with details from zod under the `details` key when applicable.
- For production, add rate-limiting, request size limits, and stronger classroomId generation.

Original endpoints scaffold (for reference):

POST /api/auth/register
  - Body: { firstName, lastName, email, password, role }
  - Creates a user (role = TEACHER|STUDENT), returns { user, token }

POST /api/auth/login
  - Body: { email, password }
  - Returns { user, token }

POST /api/classrooms
  - Auth: Authorization: Bearer <token> (must be TEACHER)
  - Body: { name, subject, description }
  - Creates classroom with generated classroomId and returns { classroom }

GET /api/classrooms
  - If Authorization header of a TEACHER is provided, returns that teacher's classrooms.
  - Otherwise returns up to 20 ACTIVE classrooms publicly.

Install dependencies
- jsonwebtoken and zod are required; install with:
    npm install jsonwebtoken zod

Next steps
- Add robust classroomId generation with DB-checked uniqueness and retry logic.
- Implement refresh tokens or server-side sessions instead of plain JWTs for production.
- Add secure cookie handling and CSRF protection for browser use.
- Add request throttling and audit logging for sensitive endpoints.
