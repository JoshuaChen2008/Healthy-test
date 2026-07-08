[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

# Health Assessment

This is a [Next.js](https://nextjs.org) project for a health assessment backend with Prisma, PostgreSQL, and Vitest coverage across unit, integration, auth, and end-to-end flows.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

Run the full suite with:

```bash
npm test
```

The test command runs all Vitest suites:

- Unit tests for the pure health algorithm in `lib/health.test.ts`.
- Integration tests for incremental assessment saving, progress restore, validation, unknown IDs, submit calculation, incomplete submit errors, and submit idempotency.
- Auth tests for free vs active result responses, including the critical check that the free response body does not contain the real `targetDate` ISO value.
- End-to-end route-handler tests for the full funnel: create session, create assessment, patch answers, submit, read masked result, pay, read full result, account-level unlock, pay idempotency, and unknown-user pay errors.

Integration, auth, and end-to-end tests require a real PostgreSQL test database because Prisma cannot run these flows without a database. Use a dedicated test database, never production Supabase data.

Create a local `.env.test` file or export `DATABASE_URL` before running tests:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/health_assessment_test"
```

Then prepare the schema:

```bash
npx prisma generate
npx prisma db push
npm test
```

Each test resets data before it runs by deleting `assessment`, then `subscription`, then `user` records, so test cases remain isolated from each other.

### Coverage Notes

Covered:

- A. Step-by-step persistence and progress recovery, including sparse fields, repeated/out-of-order PATCH calls, merged `answers`, invalid input 400s, unknown UUID 404s, and invalid UUID 400s.
- B. Submit calculation, completed status persistence, incomplete-field 400s with missing field names, submit idempotency, and unknown assessment 404s.
- C. Result authorization, including free response masking, active response completeness, and 409 before submit.
- D. Paid funnel behavior, including masked-before-pay vs full-after-pay, account-level unlock for a second assessment, idempotent pay, and unknown-user pay 404s.

Not covered yet:

- Concurrent writes to the same assessment; current tests cover sequential repeated/out-of-order writes only.
- A real HTTP server layer; tests directly invoke exported route handlers to keep feedback fast and deterministic.
- Frontend UI flows; this challenge stage focuses on backend API behavior and CI.

GitHub Actions runs the same suite in CI using a PostgreSQL 16 service container, `npx prisma db push`, and `npm test`.
