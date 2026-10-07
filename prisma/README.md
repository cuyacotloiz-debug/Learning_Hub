Prisma schema and seed for Learning Hub

This repository contains two Prisma schema variants:

- prisma/schema.prisma (PostgreSQL-ready; uses enums)
- prisma/schema.postgres.prisma (alias of the same Postgres schema)

Local development (recommended SQLite workflow)

If you prefer to use the lightweight local SQLite database for development, restore the SQLite datasource in prisma/schema.prisma or use the existing sqlite schema file. To switch to SQLite for quick local testing:

1. Overwrite prisma/schema.prisma with a SQLite datasource, for example:

   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }

2. Generate the Prisma client and push the schema:

   npm install
   npx prisma generate
   npx prisma db push

3. Run the seed script:

   node -r ts-node/register prisma/seed.ts

PostgreSQL (production) — recommended when deploying

1. Set DATABASE_URL to point to your Postgres database. Example:

   export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

2. Use the Postgres-ready schema (prisma/schema.prisma already set to PostgreSQL in this repo). Generate client and create migrations:

   npx prisma generate --schema=prisma/schema.prisma
   npx prisma migrate dev --schema=prisma/schema.prisma --name init

3. Seed the database (ensure DATABASE_URL is set):

   NODE_ENV=development DATABASE_URL="$DATABASE_URL" node -r ts-node/register prisma/seed.ts

Notes & recommendations:
- The seed script uses bcryptjs to hash demo passwords (Password123!). Change these credentials for production.
- Enums are supported by PostgreSQL and will be created as ENUM types during migration.
- Always back up production data before running migrations.
- If you want me to switch prisma/schema.prisma back to SQLite for local dev, say so and I'll do it. Currently prisma/schema.prisma is configured for PostgreSQL as requested.
