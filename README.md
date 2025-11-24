# Telegram Loyalty Bot (Demo #3)

This is a **Cloudflare Worker** that integrates a Telegram Bot with the Loyalteez API. It rewards community members with LTZ tokens for joining the group and daily check-ins.

## 🏗 Architecture

```
Telegram Webhook (Event)
      ↓
Cloudflare Worker (src/index.js)
      ↓
Loyalteez API (/manual-event)
      ↓
Blockchain (Mint LTZ)
      ↓
Telegram Bot (Confirmation Message)
```

## 🚀 Features

1.  **Join Reward**: Automatically rewards users when they join the group.
    *   Default Event ID: `telegram_join`
    *   **Admin Config**: `/config_join <event_id>`
2.  **Daily Check-in**: Users can type `/checkin` once every 24 hours.
    *   Default Event ID: `daily_checkin`
    *   **Admin Config**: `/config_checkin <event_id>`
3.  **Balance Check**: `/balance` links users to `perks.loyalteez.app`.

## 🛠 Setup & Deployment

### 1. Create a Telegram Bot
1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the instructions.
3. Copy the **HTTP API Token**.

### 2. Create KV Namespace
For configuration persistence, create a KV namespace:
```bash
npx wrangler kv:namespace create TELEGRAM_BOT_KV
```
Copy the `id` output and replace it in `wrangler.toml`.

### 3. Configure the Worker
1. Copy `wrangler.toml` and set your `BRAND_ID` (from Loyalteez Dashboard).
2. Set your Telegram Bot Token as a secret:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   # Paste your token when prompted
   ```

### 4. Deploy
```bash
npm install
npm run deploy
```

### 5. Set Webhook
After deploying, you get a worker URL (e.g., `https://telegram-loyalty-bot.your-name.workers.dev`). You must tell Telegram to send events there.

Run this in your browser or terminal:
```bash
curl -F "url=https://your-worker-url.workers.dev" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

## 🧪 Testing
1. Add your bot to a group and make it an admin (optional, but helps with reading messages).
2. **Join Test**: Join with an alt account to trigger the welcome reward.
3. **Check-in Test**: Type `/checkin`.
4. **Config Test**: As an admin, change the reward event: `/config_checkin special_event_100`.
5. **Balance**: Type `/balance`.
