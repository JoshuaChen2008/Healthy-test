# 数据库 Schema 设计

> 供 Codex 转成 `prisma/schema.prisma`。三张表，关系为 1:多 和 1:1。

## 表关系

```
users (1) ──────< (多) assessments     一个用户可有多条测评记录
   │
   └──────────────< (1) subscriptions   订阅是账号级别，一个用户一条
```

## 表 1：users（用户 / 会话）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | 主键 | 随机生成的用户/会话标识 |
| created_at | DateTime | 默认 now | |
| updated_at | DateTime | 自动更新 | |

## 表 2：assessments（测评数据记录）

设计原则：**核心列 + JSON 弹性区（混合式）**。算法要用的字段做成强类型独立列以便严格校验；其余 30 多个生活方式/个性化答案统一存进 `answers` JSON，保证扩展性。单位固定 cm/kg，不做单位切换。

**A. 核心列（强类型，参与校验与算法）**

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 主键 | |
| user_id | UUID | 否 | 外键 → users.id（**不唯一**，一个用户多条）|
| gender | String | 是 | 性别（枚举）|
| goal | String | 是 | 主目标（步骤3，单选，枚举）|
| age | Int | 是 | 年龄（步骤32）|
| height_cm | Float | 是 | 身高(cm，步骤29)|
| weight_kg | Float | 是 | 体重(kg，步骤30)|
| target_weight_kg | Float | 是 | 目标体重(kg，步骤31)|
| workout_frequency | String | 是 | 运动频率（步骤10，枚举）|

**B. 弹性答案区**

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| answers | Json | 否 | 其余所有问卷答案，默认 `{}`。单选→字符串，多选→数组，分支题谁答谁有键 |

**C. 联系方式（BetterMe 步骤35/36，可选）**

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| email | String | 是 | 邮箱（步骤35）|
| name | String | 是 | 名字（步骤36）|

**D. 进度与结果**

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| current_step | Int | 否 | 当前填到第几步，默认 0（进度恢复用）|
| status | String | 否 | in_progress / completed，默认 in_progress |
| bmi | Float | 是 | 计算结果 |
| recommended_calories | Int | 是 | 建议摄入 |
| target_date | DateTime | 是 | 目标预测日期（**被保护字段**）|
| created_at | DateTime | 否 | 默认 now |
| updated_at | DateTime | 否 | 自动更新 |

> 问卷字段与计算结果字段**可空**：分步填写时一开始为空，提交后才有计算结果。
> 这个可空设计正是支撑「分步保存 / 进度恢复」的关键。
>
> **分步保存逻辑**：每步把核心字段写入对应列、把生活方式答案合并进 `answers`，并更新 `current_step`。进度恢复即读取该行的核心列 + `answers` + `current_step`。

### answers JSON 示例

```json
{
  "tried_pilates_before": "no",
  "additional_goals": ["flexibility", "reduce_stress"],
  "body_type": "average",
  "target_areas": ["belly", "legs"],
  "sleep_hours": "6_7",
  "diet_preference": "balanced",
  "important_event": true,
  "event_date": "2026-09-01"
}
```

## 表 3：subscriptions（订阅信息）

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 主键 | |
| user_id | UUID | 否 | 外键 → users.id（**唯一**，一个用户一条）|
| status | String | 否 | free / active，默认 free |
| paid_at | DateTime | 是 | 支付时间 |
| created_at | DateTime | 否 | 默认 now |
| updated_at | DateTime | 否 | 自动更新 |

## 鉴权链路

```
拿 assessmentId → 查 assessment.user_id → 查该 user 的 subscription.status
  → active：返回完整结果
  → free：返回脱敏结果（隐藏 target_date 等）
```

## 给 Codex 的落地要点

- 枚举值（gender/goal/workout_frequency/status）建议用 Prisma enum 或做应用层校验，二选一并保持一致。
- `answers` 用 Prisma `Json` 类型，默认值 `{}`；只对核心列做数值/枚举校验，`answers` 不强约束。
- 身高体重单位固定 cm/kg，不支持单位切换。
- `email` / `name` 可空，不做唯一约束（本项目无账号体系）。
- `subscriptions.user_id` 加唯一约束；`assessments.user_id` 加普通索引。
- 时间字段统一用 `@default(now())` 和 `@updatedAt`。
