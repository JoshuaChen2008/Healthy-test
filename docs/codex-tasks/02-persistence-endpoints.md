# Codex 任务卡 02 · 分步保存 + 进度恢复接口（Persistence）

> 使用方式：把本文件全文复制给 Codex 执行。对应挑战「第一阶段 · 测评数据流与状态恢复」。

## 背景

项目已完成初始化与建表（见任务卡 01）。数据库三张表已在 Supabase 就绪。
本次实现「分步保存 + 进度恢复」的接口骨架，**不含**健康算法、鉴权、支付（后续任务）。

先阅读：`docs/tech-design.md`（API 清单、校验规则）、`docs/schema-design.md`（字段与 answers JSON 语义）。

## ⚠️ 重要环境约定（务必遵守）

1. **本项目是 Next.js 16 + Prisma 7，版本很新**。写 Route Handler 前，**先阅读 `node_modules/next/dist/docs/` 里的相关文档**，确认 App Router 下 route handler 的最新签名（尤其 **动态路由 `params` 在新版本是异步的**，需 `await`）。不要套用旧版写法。
2. **Prisma Client 用单例**：新建 `lib/prisma.ts`，导出全局单例，避免开发热重载耗尽连接。所有接口从这里导入。
3. **输入校验用 zod**：安装 `zod`，为每个接口的请求体定义 schema，做严格校验，非法输入返回 400。
4. 统一错误返回格式 `{ error: string }` + 合适状态码。

## 接口规格

### 1. `POST /api/session` — 创建用户/会话
- 请求体：无
- 行为：创建一条 `User`，同时创建对应 `Subscription`（status=free）
- 成功：`201` → `{ "userId": "<uuid>" }`

### 2. `POST /api/assessments` — 新建一次测评
- 请求体：`{ "userId": "<uuid>" }`
- 校验：userId 格式合法且用户存在（不存在返回 404）
- 行为：创建 `Assessment`（userId 关联，currentStep=0，status=in_progress，answers={}）
- 成功：`201` → `{ "assessmentId": "<uuid>" }`

### 3. `PATCH /api/assessments/:id` — 分步保存（增量）
- 请求体（全部字段可选，按用户当前步传对应字段）：
  ```json
  {
    "currentStep": 3,
    "gender": "male",
    "goal": "lose_weight",
    "age": 30,
    "heightCm": 175,
    "weightKg": 70,
    "targetWeightKg": 65,
    "workoutFrequency": "few_times_week",
    "email": "a@b.com",
    "name": "Alex",
    "answers": { "sleep_hours": "6_7", "target_areas": ["belly"] }
  }
  ```
- 校验（核心字段的边界，见 tech-design.md）：
  - age：整数 10–100
  - heightCm：80–250；weightKg：20–400；targetWeightKg：20–400
  - gender/goal/workoutFrequency：必须是 schema 里定义的枚举值
  - answers：必须是对象
  - 任一非法 → `400` + 明确错误信息
- 行为：
  - 传了的核心字段 → 写入对应列
  - `answers` → **合并进已有 answers（不整体覆盖）**：读出旧的、展开合并、写回
  - 传了 currentStep → 更新
  - id 不存在 → `404`
- 成功：`200` → `{ "ok": true, "currentStep": <当前步> }`

### 4. `GET /api/assessments/:id` — 进度恢复
- 行为：按 id 查该次测评，id 不存在 → `404`
- 成功：`200` → 返回该测评的核心字段 + `answers` + `currentStep` + `status`
- 说明：本接口用于恢复填写进度，**不做脱敏**（脱敏是后续 result 接口的事）

## 边界与健壮性（后续会写测试验证，现在就要支持）

- **中断恢复**：PATCH 存了几步后，GET 能原样读回已存数据与 currentStep。
- **乱序/重复提交**：同一字段重复 PATCH、或步骤乱序到达，都应能正确更新，不报错、不丢数据。
- **缺失字段**：分步阶段大量字段为空是正常的（列可空），不应因此报错。
- **非法/越界输入**：如 heightCm=-5、age=999、gender="xxx"，必须被 400 挡下。

## 交付要求

- 新建 `lib/prisma.ts`（Prisma 单例）。
- 4 个 route handler 文件，放在 `app/api/...` 对应位置。
- zod 校验 schema 单独组织（如 `lib/validation.ts`），并导出可复用的 TS 类型。
- 在 `docs/api.md` 里为这 4 个接口写简要文档（方法/路径/请求体/响应/状态码）+ 每个接口一条 `curl` 示例。

## 验收标准（自检后逐条汇报）

- [ ] 4 个接口均可访问，遵循 Next.js 16 route handler 写法（params 已正确 await）
- [ ] 完整走一遍：创建 session → 新建 assessment → PATCH 存入身高体重与一个 answers 键 → GET 能读回全部已存数据 + 正确的 currentStep
- [ ] answers 多次 PATCH 是**合并**而非覆盖（第二次 PATCH 不会抹掉第一次的键）
- [ ] 非法输入（如 heightCm=-5）返回 400；未知 id 返回 404
- [ ] `lib/prisma.ts` 单例、zod 校验、`docs/api.md` 均已就位
- [ ] 汇报任何设计决定或偏离文档之处及原因
