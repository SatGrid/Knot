# Knot

Knot is a simple, focused chat application designed to grow into a feature-rich communication platform without losing its clarity.

## Foundation

- Next.js and TypeScript
- Tailwind CSS
- PostgreSQL
- Real-time messaging with deployment-safe synchronization
- Permanent cloud uploads through Vercel Blob in production

## Development

Copy `.env.example` to `.env` and provide the local database and authentication values, then run `npm run dev`.

## Production deployment

Knot is prepared for Vercel, Neon Postgres, and Vercel Blob. Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `BLOB_READ_WRITE_TOKEN` in Vercel. The deployment build applies committed Prisma migrations before compiling the app. Local development continues to store files in `public/uploads` when no Blob token is configured.
