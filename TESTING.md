# Telegram Bot Tests

Simple test script to verify the worker is functioning correctly.

## Prerequisites

1. Deploy the worker: `npm run deploy`
2. Set secrets: `npx wrangler secret put TELEGRAM_BOT_TOKEN`
3. Configure BRAND_ID in `wrangler.toml`

## Tests

### 1. Health Check

```bash
curl https://telegram-demo.loyalteez.app/health
```

Expected: JSON response with status "healthy" and configuration details.

### 2. Webhook Test (Manual)

Use Telegram's Bot API to send a test update:

```bash
curl -X POST https://telegram-demo.loyalteez.app \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": -1001234567890,
        "title": "Test Group",
        "type": "group"
      },
      "date": 1234567890,
      "text": "/checkin"
    }
  }'
```

Expected: `OK` response (200).

### 3. Invalid Method

```bash
curl https://telegram-demo.loyalteez.app
```

Expected: `Method not allowed` (405).

### 4. Invalid Secret (if configured)

```bash
curl -X POST "https://telegram-demo.loyalteez.app?secret=wrong" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `Unauthorized` (401).

