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

> 📖 **For detailed configuration guide, see [CONFIGURATION.md](./CONFIGURATION.md)**

### Quick Start

1. **Create Telegram Bot**: Message [@BotFather](https://t.me/BotFather), send `/newbot`, copy token
2. **Set Secrets**:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET  # Optional but recommended
   ```
3. **Create KV Namespace**:
   ```bash
   npx wrangler kv:namespace create TELEGRAM_BOT_KV
   # Copy the ID and update wrangler.toml
   ```
4. **Configure Variables**: Update `wrangler.toml` with your `BRAND_ID`
5. **Deploy**: `npm run deploy`
6. **Set Webhook**: See [CONFIGURATION.md](./CONFIGURATION.md) for webhook setup

### 4. Deploy
```bash
npm install
npm run deploy
```

### 5. Set Webhook
After deploying, configure Telegram to send events to your worker.

**Using the custom domain** (recommended):
```bash
curl -F "url=https://telegram-demo.loyalteez.app" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

**Or using the worker URL**:
```bash
curl -F "url=https://telegram-loyalty-bot.your-name.workers.dev" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

**With webhook secret** (if you set `WEBHOOK_SECRET`):
```bash
curl -F "url=https://telegram-demo.loyalteez.app?secret=YOUR_SECRET" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

**Verify webhook is set**:
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

## 🧪 Testing
1. Add your bot to a group and make it an admin (optional, but helps with reading messages).
2. **Join Test**: Join with an alt account to trigger the welcome reward.
3. **Check-in Test**: Type `/checkin`.
4. **Config Test**: As an admin, change the reward event: `/config_checkin special_event_100`.
5. **Balance**: Type `/balance`.
