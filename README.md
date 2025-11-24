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
    *   **Setup Required**: Create event in Partner Portal with "Telegram Bot Interaction" detection
    *   **Admin Config**: `/config_join <event_id>` (use the generated event ID from Partner Portal)
2.  **Daily Check-in**: Users can type `/checkin` once every 24 hours.
    *   **Setup Required**: Create event in Partner Portal with "Telegram Bot Interaction" detection
    *   **Admin Config**: `/config_checkin <event_id>` (use the generated event ID from Partner Portal)
3.  **Balance Check**: `/balance` links users to `perks.loyalteez.app`.

> ⚠️ **Important**: You must create custom events in the Partner Portal first, then configure the bot with the generated event IDs. Default event IDs (`telegram_join`, `daily_checkin`) will not work unless you create events with those exact names.

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
After deploying, configure Telegram to send events to your worker at `https://telegram-demo.loyalteez.app`.

**Basic setup** (no secret):
```bash
curl -F "url=https://telegram-demo.loyalteez.app" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

**With webhook secret** (recommended for security):
```bash
# First, set your secret: npx wrangler secret put WEBHOOK_SECRET
# Then set webhook with secret:
curl -F "url=https://telegram-demo.loyalteez.app?secret=YOUR_SECRET" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

**Verify webhook is set**:
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Expected response**:
```json
{
  "ok": true,
  "result": {
    "url": "https://telegram-demo.loyalteez.app",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## 🧪 Testing
1. Add your bot to a group and make it an admin (optional, but helps with reading messages).
2. **Join Test**: Join with an alt account to trigger the welcome reward.
3. **Check-in Test**: Type `/checkin`.
4. **Config Test**: As an admin, change the reward event: `/config_checkin special_event_100`.
5. **Balance**: Type `/balance`.
