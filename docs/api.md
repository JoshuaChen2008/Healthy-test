# API 文档

所有接口请求和响应均使用 JSON。错误响应统一为：

```json
{ "error": "错误信息" }
```

## POST /api/session

创建一个用户/会话，并同时创建该用户的免费订阅记录。

**请求体**

无。可发送空 body 或 `{}`。

**成功响应**

`201 Created`

```json
{ "userId": "uuid" }
```

**状态码**

- `201`：创建成功
- `400`：请求体不是空对象或 JSON 格式错误
- `500`：服务端创建失败

**curl**

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{}'
```

## POST /api/assessments

为已有用户创建一次测评记录。

**请求体**

```json
{ "userId": "uuid" }
```

**成功响应**

`201 Created`

```json
{ "assessmentId": "uuid" }
```

**状态码**

- `201`：创建成功
- `400`：`userId` 缺失、不是 UUID，或请求体 JSON 格式错误
- `404`：用户不存在
- `500`：服务端创建失败

**curl**

```bash
curl -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000"}'
```

## PATCH /api/assessments/:id

分步保存测评进度。所有字段均可选；只更新本次请求传入的字段。`answers` 会与已有 JSON 浅合并，不会整体覆盖。

**请求体**

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
  "answers": {
    "sleep_hours": "6_7",
    "target_areas": ["belly"]
  }
}
```

**成功响应**

`200 OK`

```json
{ "ok": true, "currentStep": 3 }
```

**状态码**

- `200`：保存成功
- `400`：id 不是 UUID、请求体 JSON 格式错误、字段越界或枚举非法
- `404`：测评不存在
- `500`：服务端保存失败

**curl**

```bash
curl -X PATCH http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000 \
  -H "Content-Type: application/json" \
  -d '{"currentStep":3,"heightCm":175,"weightKg":70,"answers":{"sleep_hours":"6_7"}}'
```

## GET /api/assessments/:id

读取一次测评的填写进度，用于中断后恢复。

**请求体**

无。

**成功响应**

`200 OK`

```json
{
  "id": "uuid",
  "userId": "uuid",
  "gender": "male",
  "goal": "lose_weight",
  "age": 30,
  "heightCm": 175,
  "weightKg": 70,
  "targetWeightKg": 65,
  "workoutFrequency": "few_times_week",
  "email": "a@b.com",
  "name": "Alex",
  "answers": {
    "sleep_hours": "6_7"
  },
  "currentStep": 3,
  "status": "in_progress"
}
```

**状态码**

- `200`：读取成功
- `400`：id 不是 UUID
- `404`：测评不存在
- `500`：服务端读取失败

**curl**

```bash
curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000
```

## POST /api/assessments/:id/submit

提交一次测评并计算结果。已完成的测评可重复提交，会重新计算并覆盖结果。

**请求体**

无。可发送空 body 或 `{}`。

**成功响应**

`200 OK`

```json
{
  "status": "completed",
  "bmi": 24.2,
  "recommendedCalories": 1850
}
```

**状态码**

- `200`：提交并计算成功
- `400`：id 不是 UUID，或核心字段未填完整
- `404`：测评不存在
- `500`：服务端提交失败

**curl**

```bash
curl -X POST http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/submit \
  -H "Content-Type: application/json" \
  -d '{}'
```

## GET /api/assessments/:id/result

读取测评结果。非会员隐藏被保护字段 `targetDate`；会员返回完整结果。

**请求体**

无。

**非会员成功响应**

`200 OK`

```json
{
  "assessmentId": "uuid",
  "status": "completed",
  "membership": "free",
  "bmi": 24.2,
  "recommendedCalories": 1850,
  "locked": {
    "targetDate": true
  },
  "upsell": "解锁完整结果，查看你的目标达成日期与个性化计划"
}
```

**会员成功响应**

`200 OK`

```json
{
  "assessmentId": "uuid",
  "status": "completed",
  "membership": "active",
  "bmi": 24.2,
  "recommendedCalories": 1850,
  "targetDate": "2026-11-01T00:00:00.000Z"
}
```

**状态码**

- `200`：读取成功
- `400`：id 不是 UUID
- `404`：测评不存在
- `409`：测评尚未提交
- `500`：服务端读取失败，或测评结果不完整

**curl**

```bash
curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/result
```

## POST /api/pay

模拟支付。把用户订阅状态置为 `active`，并记录支付时间。已支付用户可重复调用。

**请求体**

```json
{ "userId": "uuid" }
```

**成功响应**

`200 OK`

```json
{ "status": "active" }
```

**状态码**

- `200`：支付成功，或用户原本已是 active
- `400`：`userId` 缺失、不是 UUID，或请求体 JSON 格式错误
- `404`：用户不存在
- `500`：服务端支付失败

**curl**

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000"}'
```

**付费前 vs 付费后**

同一个 `assessmentId`，支付前调用 result 不会返回真实 `targetDate`：

```bash
curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/result
```

支付后再次调用同一接口会返回完整结果：

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"11111111-1111-1111-1111-111111111111"}'

curl http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000000/result
```
