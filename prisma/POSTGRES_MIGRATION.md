PostgreSQL migration instructions for Learning Hub (Prisma)

This file describes how to run Prisma migrations and generate the client using the PostgreSQL-ready schema at prisma/schema.postgres.prisma.

Prerequisites
1. A PostgreSQL database and a valid DATABASE_URL. Example format:

   export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

2. Node.js and project dependencies installed (run `npm install`).

Commands (development)

1. Generate Prisma client for the Postgres schema:

   npx prisma generate --schema=prisma/schema.postgres.prisma

2. Create and run a migration (dev flow — interactive):

   npx prisma migrate dev --schema=prisma/schema.postgres.prisma --name init

   This will create migration SQL files in prisma/migrations and apply them to the database.

3. (Optional) Seed the database using the existing seed script. Ensure DATABASE_URL is set in the environment before running the seed.

   NODE_ENV=development DATABASE_URL="$DATABASE_URL" node -r ts-node/register prisma/seed.ts

Commands (production / CI)

1. Generate Prisma client:

   npx prisma generate --schema=prisma/schema.postgres.prisma

2. Apply migrations non-interactively:

   npx prisma migrate deploy --schema=prisma/schema.postgres.prisma

3. Run any production seed tasks (if applicable) from your deployment pipeline.

Notes & tips
- The project currently uses prisma/schema.prisma with an SQLite datasource for local dev. The Postgres-ready schema is provided in prisma/schema.postgres.prisma so you can run Postgres migrations without changing local dev workflows.
- If you prefer to make Postgres the primary schema file, replace prisma/schema.prisma with the contents of prisma/schema.postgres.prisma or rename the file and run commands without the --schema flag.
- After running migrations/generate, ensure the Prisma client is available by importing it in your application code. The generated client references the migrations/schema used at generation time.
- Enums are supported by PostgreSQL and will be created as ENUM types during migration.
- Always back up production data before running migrations.
