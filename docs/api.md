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

