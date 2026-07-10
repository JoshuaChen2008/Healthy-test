[![CI](https://github.com/JoshuaChen2008/Healthy-test/actions/workflows/ci.yml/badge.svg)](https://github.com/JoshuaChen2008/Healthy-test/actions/workflows/ci.yml)

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

## 环境变量

本地运行时，将 `.env.example` 复制为 `.env` 并填写可用的 PostgreSQL 连接串：

```bash
cp .env.example .env
```

部署到 Vercel 时，在项目的环境变量中配置 `DATABASE_URL` 即可；不要提交真实连接串或密钥。

## API 文档

所有接口的请求、响应和完整 curl 示例见 [`docs/api.md`](docs/api.md)。下面用同一个 `assessmentId` 展示 `/pay` 付费前后的结果差异。

付费前，结果接口会隐藏真实的 `targetDate`：

```bash
curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/result
```

调用 `/pay` 后，再查询同一份评估会返回完整结果：

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"11111111-1111-1111-1111-111111111111"}'

curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/result
```

## 在线演示 / 已支付 sessionId

- 线上地址：TODO(部署后填 Vercel URL)
- 已支付测试 userId：TODO(部署后用 /api/pay 造一个并填这里)

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
