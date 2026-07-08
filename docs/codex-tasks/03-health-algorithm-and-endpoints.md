# Codex 任务卡 03 · 健康算法 + 计算/结果/支付接口

> 使用方式：把本文件全文复制给 Codex 执行。对应挑战「第二阶段 · 结果计算、付费墙与鉴权」。

## 背景

项目已完成初始化、建表（任务卡 01）与「分步保存 + 进度恢复」接口（任务卡 02）。
本次实现**核心健康算法**与剩余 3 个接口：提交计算、差异化结果返回、模拟支付。
外加**接入 Vitest 并为算法写单元测试**（算法是纯函数，是整个挑战的测试重点起点）。

先阅读：
- `docs/PRD.md`（F5/F6/F7 功能定义、被保护字段）
- `docs/tech-design.md`（第 3 节 API 清单、第 4 节校验、第 5 节算法、第 6 节测试）
- `docs/schema-design.md`（字段语义、鉴权链路）
- `docs/api.md`（任务卡 02 已写的前 4 个接口文档，本次续写）

## ⚠️ 重要环境约定（务必遵守）

1. **本项目是 Next.js 16 + Prisma 7，版本很新**。写 Route Handler 前先看 `node_modules/next/dist/docs/`，动态路由 `params` 是异步的，需 `await`（参考任务卡 02 已写好的 `app/api/assessments/[id]/route.ts`）。
2. **复用已有基础设施，不要重复造轮子**：
   - Prisma 单例从 `@/lib/prisma` 导入。
   - 校验统一放 `lib/validation.ts`，错误信息用现有 `getValidationErrorMessage`。
   - JSON 读取沿用任务卡 02 里的 `readJsonBody` 模式（空体容错）。
   - 错误返回统一 `{ error: string }` + 合适状态码。
3. **算法必须是纯函数**：放 `lib/health.ts`，不依赖数据库、不读环境，入参出参都是普通对象，便于单测。

## 一、健康算法 `lib/health.ts`（核心逻辑，先写这个）

导出纯函数。所有公式在代码注释里注明来源。

### 1. BMI

```
height_m = heightCm / 100
bmi = weightKg / (height_m ^ 2)
```
结果保留 1 位小数。

### 2. 建议每日摄入热量 recommendedCalories（整数）

**第一步 BMR（Mifflin-St Jeor 公式，来源：Mifflin MD, St Jeor ST, 1990）：**
```
base = 10 * weightKg + 6.25 * heightCm - 5 * age
male   → base + 5
female → base - 161
other  → base - 78   // 取 male/female 偏移量的平均
```

**第二步 TDEE = BMR × 活动系数（运动频率映射，标准活动因子）：**
| workoutFrequency | 系数 |
|------------------|------|
| never            | 1.2  |
| rarely           | 1.375 |
| few_times_week   | 1.55 |
| often            | 1.725 |
| daily            | 1.9  |

**第三步 按目标调整：**
| goal | 调整 |
|------|------|
| lose_weight      | TDEE − 500（约 0.45 kg/周热量缺口）|
| build_muscle     | TDEE + 300 |
| improve_fitness  | TDEE（维持）|
| improve_health   | TDEE（维持）|

**第四步 安全下限**（低于此值则取下限）：male 1500，female/other 1200。
四舍五入为整数返回。

### 3. 目标预测日期 targetDate（Date）

```
diff = weightKg - targetWeightKg
```
- 减重（diff > 0）：速率 0.5 kg/周（安全区间）
- 增重（diff < 0，通常 build_muscle）：速率 0.25 kg/周
- `|diff| < 0.5`（已基本达标）：weeks = 0，targetDate = 今天
- 否则 `weeks = ceil(|diff| / 速率)`，`targetDate = 今天 + weeks * 7 天`

> 注意：以「计算发生的当天」为起点，不要写死日期。

### 建议提供一个组合函数

`computeAssessmentResult(input)` 接收 `{ gender, goal, age, heightCm, weightKg, targetWeightKg, workoutFrequency }`，返回 `{ bmi, recommendedCalories, targetDate }`，供 submit 接口直接调用。

## 二、Vitest 接入 + 算法单元测试

1. 安装 `vitest`（dev），`package.json` 加 `"test": "vitest run"` 和 `"test:watch": "vitest"`。
2. 新建 `lib/health.test.ts`，覆盖：
   - 正常值：一组已知输入验证 bmi / calories / targetDate 符合预期
   - 男/女/other 三种性别的 BMR 分支
   - 每个 goal 分支的热量调整
   - 热量安全下限被触发的场景
   - targetDate：减重、增重、已达标（weeks=0）三种情况
   - 边界：合法范围端点（age=10/100、height=80/250、weight=20/400）不报错
3. `npm test` 一键跑通，全绿。

> 本任务卡只要求算法的单元测试；接口的集成/鉴权/端到端测试放在下一张任务卡。

## 三、接口规格

### 4. `POST /api/assessments/:id/submit` — 提交并计算

- 行为：
  1. 按 id 查测评，不存在 → `404`
  2. 校验核心字段完整：`gender, goal, age, heightCm, weightKg, targetWeightKg, workoutFrequency` 必须都有值；缺任一 → `400`，错误信息列出缺失字段
  3. 调 `computeAssessmentResult` 算出 bmi / recommendedCalories / targetDate
  4. 写回这三列，并置 `status = completed`
- **幂等**：对已 completed 的测评再次 submit，允许重新计算并正常返回（不报错）
- 成功：`200` → `{ "status": "completed", "bmi": <n>, "recommendedCalories": <n> }`
  （target_date 不在此返回，结果差异化交给 result 接口）

### 5. `GET /api/assessments/:id/result` — 差异化结果（鉴权核心）

- 行为：
  1. 按 id 查测评，不存在 → `404`
  2. `status != completed` → `409` + `{ error: "Assessment not submitted yet." }`
  3. 经 `assessment.userId` 查该用户 `subscription.status`
  4. 按订阅状态差异化返回（见下）
- **非会员（free）响应**（隐藏被保护字段 `targetDate`）：
  ```json
  {
    "assessmentId": "...",
    "status": "completed",
    "membership": "free",
    "bmi": 24.2,
    "recommendedCalories": 1850,
    "locked": { "targetDate": true },
    "upsell": "解锁完整结果，查看你的目标达成日期与个性化计划"
  }
  ```
- **会员（active）响应**（返回全部）：
  ```json
  {
    "assessmentId": "...",
    "status": "completed",
    "membership": "active",
    "bmi": 24.2,
    "recommendedCalories": 1850,
    "targetDate": "2026-11-01T00:00:00.000Z"
  }
  ```
- ⚠️ 安全要求：非会员响应体里**绝对不能出现** `targetDate` 的真实值（不是置空，是根本不返回该键的真值）。这条后续会有测试专门验证。

### 6. `POST /api/pay` — 模拟支付

- 请求体：`{ "userId": "<uuid>" }`
- 校验：userId 是合法 UUID 且用户存在（不存在 → `404`）
- 行为：把该用户的 `Subscription` 置为 `status = active`、`paidAt = now`
  （用 upsert：有则更新，无则创建 active 记录）
- **幂等**：已 active 再次支付，正常返回，不报错
- 成功：`200` → `{ "status": "active" }`

## 四、边界与健壮性（后续会写测试验证，现在就要支持）

- submit 前字段不全 → 400，且能明确指出缺哪些
- 未 submit 就取 result → 409
- 非会员拿不到 targetDate 真值；支付后立即能拿到（同一 assessment，付费前脱敏、付费后完整）
- 所有接口非法/未知 id → 404，非法 body → 400

## 五、交付要求

- 新建 `lib/health.ts`（纯函数，公式来源注释齐全）
- 新建 `lib/health.test.ts`，`npm test` 全绿
- 3 个 route handler：`submit` / `result` / `pay`，放 `app/api/...` 对应位置
- `pay` 的请求体校验 schema 加入 `lib/validation.ts` 并复用
- 在 `docs/api.md` 续写这 3 个接口（方法/路径/请求体/响应/状态码 + 每个一条 `curl` 示例，含一个「付费前 vs 付费后」对比示例）

## 六、验收标准（自检后逐条汇报）

- [ ] `npm test` 全绿，算法单测覆盖性别/目标/下限/日期各分支
- [ ] 完整走一遍：session → assessment → 分步 PATCH 填满 → submit 返回 bmi/calories → result（free）看不到 targetDate → pay → result（active）能看到 targetDate
- [ ] submit 幂等；pay 幂等
- [ ] 字段不全 submit → 400 且列出缺失；未 submit 取 result → 409
- [ ] 非会员响应体确认不含 targetDate 真值
- [ ] `lib/health.ts` 不 import prisma、不读 env（纯函数）
- [ ] `docs/api.md` 三个接口文档 + curl 示例已补全
- [ ] 汇报任何设计决定或偏离文档之处及原因
