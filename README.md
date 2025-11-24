# Telegram Loyalty Bot

A production-ready **Cloudflare Worker** that integrates Telegram communities with the Loyalteez rewards platform. Reward your Telegram community members with LTZ tokens for joining groups and daily check-ins.

> 🎯 **Part of the Loyalteez Developer Demo Series** - This is Demo #3, showcasing Telegram integration patterns for third-party developers.

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

- **Join Rewards**: Automatically reward users when they join your Telegram group
- **Daily Check-ins**: Users can claim daily rewards with `/checkin` command
- **Admin Configuration**: Per-chat event ID configuration via `/config_checkin` and `/config_join`
- **Friendly Name Resolution**: Use friendly event names (e.g., `daily_checkin`) that automatically resolve to custom event IDs
- **Balance Links**: Quick access to marketplace via `/balance` command
- **Service Bindings**: Fast worker-to-worker communication (no 522 timeouts)
- **Bot Username Authentication**: Secure platform-based authentication (no domain required)

## 📋 Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Loyalteez Brand Address (from Partner Portal)

## 🛠 Quick Start

> 📖 **For detailed configuration, see [CONFIGURATION.md](./CONFIGURATION.md)**

### 1. Clone & Install

```bash
git clone https://github.com/Alpha4-Labs/telegram-loyalty-bot.git
cd telegram-loyalty-bot
npm install
```

### 2. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. Configure Worker

1. **Set Secrets**:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   # Paste your bot token when prompted
   
   npx wrangler secret put WEBHOOK_SECRET  # Optional but recommended
   # Enter a random secret string
   ```

2. **Create KV Namespace**:
   ```bash
   npx wrangler kv:namespace create TELEGRAM_BOT_KV
   # Copy the ID and update wrangler.toml
   
   npx wrangler kv:namespace create TELEGRAM_BOT_KV --preview
   # Copy the preview_id and update wrangler.toml
   ```

3. **Update `wrangler.toml`**:
   - Set `BRAND_ID` to your Loyalteez Brand Address
   - Update KV namespace IDs

### 4. Deploy

```bash
npm run deploy
```

### 5. Set Webhook

After deploying, configure Telegram to send events to your worker:

```bash
# Basic (no secret)
curl -F "url=https://telegram-demo.loyalteez.app" \
  https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook

# With secret (recommended)
curl -F "url=https://telegram-demo.loyalteez.app?secret=YOUR_SECRET" \
  https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook

# Verify
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

### 6. Create Events & Configure Bot

1. **Create Events** in Partner Portal:
   - Go to **Settings → Events**
   - Create event with **"Telegram Bot Interaction"** detection
   - Copy the generated event ID (e.g., `custom_474Be22F_1763997900293`)

2. **Configure Bot** in Telegram (as admin):
   ```
   /config_checkin daily_checkin
   /config_join telegram_join
   ```
   
   You can use either:
   - **Friendly name**: `daily_checkin` (automatically resolves to custom event ID)
   - **Custom event ID**: `custom_474Be22F_1763997900293` (used as-is)

## 📚 Documentation

- **[CONFIGURATION.md](./CONFIGURATION.md)** - Complete configuration guide for variables, secrets, and bindings
- **[RECIPES.md](./RECIPES.md)** - Integration recipes from basic to advanced
- **[TESTING.md](./TESTING.md)** - Testing guide and health check endpoints

## 🧪 Testing

See [TESTING.md](./TESTING.md) for detailed test procedures.

**Quick Test**:
1. Add your bot to a Telegram group (make it admin for best results)
2. **Join Test**: Join with an alt account → Should trigger welcome reward
3. **Check-in Test**: Type `/checkin` → Should reward daily check-in
4. **Config Test**: As admin, run `/config_checkin daily_checkin` → Should resolve to custom event ID
5. **Balance**: Type `/balance` → Should show marketplace link

## ❓ Troubleshooting

### "Event not configured" or "Invalid event data"
- **Check for typos**: Ensure you configured the correct event ID or friendly name
  - ❌ Wrong: `/config_checkin dailing_checkin`
  - ✅ Right: `/config_checkin daily_checkin`
- **Verify Event**: Ensure the event is created and **enabled** in Partner Portal
- **Check Event ID**: Use the full custom event ID if friendly name doesn't resolve

### "Domain not authorized"
- **Bot Username**: Add your Telegram Bot Username to **Partner Portal → Settings → Profile → Authentication Methods**
- **Exact Match**: Username must match exactly (e.g., `@MyBot` or `MyBot` - both work)
- **Verify**: Check that bot username is saved in `config_metadata.auth_methods.telegram`

### Service Binding Errors (522)
- **Check Bindings**: Verify `EVENT_HANDLER` and `PREGENERATION` service bindings are configured in Cloudflare Dashboard
- **Fallback**: Bot automatically falls back to HTTP if service binding fails
- **Logs**: Check Cloudflare Workers logs for detailed error messages

## 🎯 Use Cases

- **Community Engagement**: Reward daily active users
- **Growth Hacking**: Incentivize group joins
- **Gamification**: Build loyalty through consistent engagement
- **Cross-Platform Rewards**: Integrate Telegram with web and Discord rewards

## 🔧 Development

```bash
# Local development
npm run dev

# Deploy to production
npm run deploy

# View logs
npx wrangler tail
```

## 📖 Integration Recipes

See [RECIPES.md](./RECIPES.md) for:
- Level 1: Daily Habit (Basic)
- Level 2: Welcome Committee (Growth)
- Level 3: Web Quest (Intermediate)
- Level 4: Secret Word (Advanced)
- Level 5: Passive Tracking (Expert)

## 🤝 Contributing

This is a public demo repository. Contributions welcome! Please ensure:
- Code follows existing patterns
- Documentation is updated
- Tests pass

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Related Projects

- [Discord Loyalty Bot](https://github.com/Alpha4-Labs/discord-loyalty-bot) - Similar integration for Discord
- [Loyalteez Developer Docs](https://docs.loyalteez.app) - Complete API documentation
- [Partner Portal](https://loyalteez.app) - Manage your brand and events

## 💬 Support

- **Documentation**: See [CONFIGURATION.md](./CONFIGURATION.md) and [RECIPES.md](./RECIPES.md)
- **Issues**: Open an issue on GitHub
- **Partner Portal**: Contact support through your dashboard
