# Codex 任务卡 04 · 接口集成/鉴权/端到端测试 + CI

> 使用方式：把本文件全文复制给 Codex 执行。对应挑战「测试策略」中除算法单测外的全部层次，是本挑战的**核心评分点**。

## 背景

任务卡 01–03 已完成：三张表、7 个接口、健康算法及其单元测试（`lib/health.test.ts`）。
本次补齐 tech-design 第 6 节要求的其余测试层次——**集成 / 鉴权 / 端到端**——并接入 **GitHub Actions CI**。

先阅读：
- `docs/tech-design.md` 第 6 节（测试策略：单元/集成/鉴权/端到端各覆盖什么）
- `docs/codex-tasks/02-persistence-endpoints.md`、`03-health-algorithm-and-endpoints.md`（各接口行为与边界，测试以此为准）
- 已有 7 个 route handler 与 `lib/health.test.ts`（沿用其风格）

## ⚠️ 重要环境约定（务必遵守）

1. **测试直接调用导出的 route handler 函数**，不启真实 HTTP 服务器：
   - 从 route 文件 `import { POST, GET, PATCH }`，构造 `new Request(url, { method, body })` 传入。
   - 动态路由的第二参数是 `{ params: Promise<{ id: string }> }`，需传 `{ params: Promise.resolve({ id }) }`（Next 16 异步 params）。
   - 断言 `response.status` 与 `await response.json()`。
2. **必须连一个真实的测试用 Postgres 库**（Prisma 无法脱库跑集成测试）：
   - 用独立环境变量指向测试库（如 `.env.test` 里的 `DATABASE_URL`），**绝不指向生产/真实 Supabase 数据**。
   - CI 里用 GitHub Actions 的 `postgres` 服务容器作为测试库（见下）。
3. **测试间必须隔离**：写一个复位 helper，在每个测试前按外键顺序清空数据
   （先 `assessment`、`subscription`，再 `user`），保证用例互不污染。
4. **保持 `npm test` 一键运行**（跑全部：单元 + 集成 + 鉴权 + 端到端）。
   README 需说明本地跑集成测试要先准备测试库。

## 测试文件组织

- 复位与请求构造的公共逻辑放 `tests/helpers.ts`（或等价位置）。
- 按接口/主题分文件，如 `tests/assessments.integration.test.ts`、`tests/result.auth.test.ts`、`tests/funnel.e2e.test.ts`。
- 保留 `lib/health.test.ts` 不动。

## 测试范围（逐条覆盖，对应 tech-design 第 6 节）

### A. 集成 · 分步保存 + 进度恢复

- **中断恢复**：连续 PATCH 存入 gender、身高体重、一个 answers 键后，GET 能原样读回全部核心字段 + answers + 正确的 `currentStep`。
- **乱序 / 重复提交**：同一字段重复 PATCH、步骤号乱序到达，最终数据正确、不报错、不丢数据。
- **answers 合并而非覆盖**：两次 PATCH 传不同 answers 键，GET 后两个键都在（第二次不抹掉第一次）。
- **分步阶段字段缺失是正常的**：只填了一两个字段的 PATCH 不应报错。
- **非法 / 越界输入被 400 挡下**：`heightCm=-5`、`age=999`、`gender="xxx"`、`age=9`（低于 10）等各来一条，断言 400 且错误信息有意义。
- **未知 id → 404**：对随机 UUID 做 GET / PATCH 返回 404；**非法 UUID 格式 → 400**。

### B. 集成 · 提交计算（submit）

- 核心字段填满后 submit：返回 `status="completed"` 与 `bmi`/`recommendedCalories`；随后 GET 能看到 `status` 已变 completed。
- **字段不全就 submit → 400**，且错误信息**列出缺失字段**。
- **幂等**：对同一 assessment 连续 submit 两次，第二次仍正常返回、不报错。
- 未知 id → 404。

### C. 鉴权 · 结果脱敏 vs 完整（最重要，防数据泄漏）

- **非会员（free）**：result 返回 `bmi`/`recommendedCalories`、`locked.targetDate === true`、有 `upsell`；
  **关键断言**：把响应体 `JSON.stringify` 后，整段文本**不包含** `targetDate` 的真实 ISO 值
  （即验证不是"置空"，而是根本没泄漏该字段的真值）。
- **会员（active）**：result 返回 `targetDate` 的真实值。
- **未 submit 就取 result → 409**。

### D. 端到端 · 付费墙前后差异（对应交付要求）

- **完整漏斗**：`POST /api/session` → `POST /api/assessments` → 多次 PATCH 填满 → `POST /submit` →
  `GET /result` 得到**脱敏**版（无 targetDate）→ `POST /api/pay` → 再 `GET /result` 得到**完整**版（有 targetDate）。
- **账号级解锁**：同一 user 建**第二个** assessment 并 submit，付费后该 assessment 的 result **也是完整版**
  （验证订阅是账号级、不是单次测评级）。
- **pay 幂等**：对已 active 的用户再次 pay，正常返回 `{ status: "active" }`。
- **pay 未知 user → 404**。

## GitHub Actions CI

新建 `.github/workflows/ci.yml`：

- 触发：push 与 pull_request。
- 起一个 `postgres` 服务容器（如 `postgres:16`），设健康检查，暴露 5432。
- 步骤：checkout → `actions/setup-node`（Node 20+，启用 npm 缓存）→ `npm ci` →
  `npx prisma generate` → `npx prisma db push`（把 schema 建到服务容器库）→ `npm test`。
- 通过环境变量把 `DATABASE_URL` 指向服务容器（如 `postgresql://postgres:postgres@localhost:5432/postgres`）。
  > 注意 `lib/prisma.ts` 用的是 pg 适配器读 `DATABASE_URL`；测试库不需要 pgbouncer 参数。
- 在 README 顶部加 **CI 状态徽章**。

## 交付要求

- `tests/helpers.ts`（DB 复位 + 请求构造）+ 各测试文件，`npm test` 全绿（单元+集成+鉴权+端到端）。
- `.github/workflows/ci.yml`，推上去后 Actions 能跑通、徽章变绿。
- 更新 `README.md` 的**测试章节**（挑战明确要求）：
  - 如何一键运行测试；本地准备测试库的方法（`.env.test` 或环境变量）。
  - **覆盖了哪些场景、为什么**（按上面 A/B/C/D 列出）。
  - **哪些暂未覆盖及原因**（如并发写、真实 HTTP 层、前端 UI）。
- 若新增测试相关依赖（如 `dotenv` 加载 `.env.test`），装到 devDependencies。

## 验收标准（自检后逐条汇报）

- [ ] `npm test` 全绿，且**同时**包含单元 + 集成 + 鉴权 + 端到端四类
- [ ] 集成：中断恢复、乱序/重复、answers 合并、非法输入 400、未知 id 404 均有用例
- [ ] submit：完整/字段不全 400/幂等/未知 id 各有用例
- [ ] 鉴权：**free 响应体经 stringify 后确认不含 targetDate 真值**（这条必须有）
- [ ] 端到端：pay 前脱敏、pay 后完整、账号级解锁第二个 assessment、pay 幂等
- [ ] `.github/workflows/ci.yml` 存在，起了 postgres 服务，跑 `prisma db push` + `npm test`
- [ ] README 有 CI 徽章 + 测试章节（覆盖了什么/为什么/未覆盖什么）
- [ ] 测试间有 DB 复位、互不污染；测试库与真实数据隔离
- [ ] 汇报任何设计决定或偏离文档之处及原因
