# Telegram Bot Worker Configuration

## Required Variables (wrangler.toml `[vars]`)

These are non-sensitive configuration values that can be committed to git:

### `BRAND_ID` (Required)
- **Type**: String (Ethereum address)
- **Description**: Your Loyalteez Brand Address (0x...)
- **Example**: `"0xf8964eB6D654659a4935363595db1095474Be22F"`
- **How to get**: From Partner Portal → Settings → Account Overview

### `LOYALTEEZ_API_URL` (Optional, has default)
- **Type**: String (URL)
- **Description**: Base URL for Loyalteez API
- **Default**: `"https://api.loyalteez.app"`
- **When to change**: Only if using a custom API endpoint or staging environment

### `WELCOME_MESSAGE` (Optional)
- **Type**: String
- **Description**: Custom welcome message sent when users join
- **Default**: `"Welcome to the community! You've earned LTZ tokens."`
- **Note**: Currently not used in code, but reserved for future customization

---

## Required Secrets (Set via `wrangler secret put`)

These are sensitive values that should **NEVER** be committed to git:

### `TELEGRAM_BOT_TOKEN` (Required)
- **Type**: String
- **Description**: Your Telegram Bot API token from @BotFather
- **Format**: `"123456789:ABCdefGHIjklMNOpqrsTUVwxyz"`
- **How to get**:
  1. Message [@BotFather](https://t.me/BotFather) on Telegram
  2. Send `/newbot` and follow instructions
  3. Copy the token provided
- **Set command**: `npx wrangler secret put TELEGRAM_BOT_TOKEN`
- **Security**: This token allows full control of your bot - keep it secret!

### `WEBHOOK_SECRET` (Optional, Recommended)
- **Type**: String
- **Description**: Secret token to verify webhook requests (prevents unauthorized access)
- **Format**: Any random string (e.g., `"my-secret-webhook-key-12345"`)
- **How to use**: Add `?secret=YOUR_SECRET` to your Telegram webhook URL
- **Set command**: `npx wrangler secret put WEBHOOK_SECRET`
- **Security**: Without this, anyone with your webhook URL can send fake events

---

## Optional Service Bindings (For Production)

These enable faster worker-to-worker communication (like Discord bot):

### `EVENT_HANDLER` (Optional)
- **Type**: Service Binding
- **Description**: Direct binding to `loyalteez-event-handler` worker
- **Benefit**: Avoids HTTP timeouts (522 errors) and reduces latency
- **Setup**: Add to `wrangler.toml`:
  ```toml
  [[services]]
  binding = "EVENT_HANDLER"
  service = "loyalteez-event-handler"
  ```

### `PREGENERATION` (Optional)
- **Type**: Service Binding
- **Description**: Direct binding to `loyalteez-pregeneration` worker
- **Benefit**: Faster wallet creation/lookup
- **Setup**: Add to `wrangler.toml`:
  ```toml
  [[services]]
  binding = "PREGENERATION"
  service = "loyalteez-pregeneration"
  ```

---

## KV Namespace (Required)

### `TELEGRAM_BOT_KV` (Required)
- **Type**: KV Namespace Binding
- **Description**: Stores per-chat configuration (event IDs for `/config_checkin` and `/config_join`)
- **Setup**:
  1. Create namespace: `npx wrangler kv:namespace create TELEGRAM_BOT_KV`
  2. Copy the `id` from output
  3. Update `wrangler.toml` with the ID
  4. Create preview: `npx wrangler kv:namespace create TELEGRAM_BOT_KV --preview`
  5. Update `preview_id` in `wrangler.toml`

---

## Quick Setup Checklist

```bash
# 1. Set required secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
# (Paste your bot token when prompted)

# 2. Set optional webhook secret (recommended)
npx wrangler secret put WEBHOOK_SECRET
# (Enter a random secret string)

# 3. Create KV namespace
npx wrangler kv:namespace create TELEGRAM_BOT_KV
# Copy the ID and update wrangler.toml

# 4. Update wrangler.toml with:
# - BRAND_ID (your brand address)
# - KV namespace ID

# 5. Deploy
npm run deploy

# 6. Create events in Partner Portal:
#    - Go to Settings → Events
#    - Create event with "Telegram Bot Interaction" detection
#    - Copy the generated event ID (e.g., custom_474Be22F_1763993407388)

# 7. Configure bot in Telegram:
#    - As admin, run: /config_checkin <event_id>
#    - As admin, run: /config_join <event_id>
```

---

## Environment-Specific Configuration

### Development (Local)
- Use `.dev.vars` file (gitignored) for local secrets:
  ```
  TELEGRAM_BOT_TOKEN=your-dev-token
  WEBHOOK_SECRET=dev-secret
  BRAND_ID=0x...
  ```

### Production
- Set secrets via `wrangler secret put` (stored securely in Cloudflare)
- Variables in `wrangler.toml` are deployed with the worker

---

## Security Best Practices

1. ✅ **Never commit secrets** - Use `wrangler secret put` or `.dev.vars`
2. ✅ **Use WEBHOOK_SECRET** - Prevents unauthorized webhook calls
3. ✅ **Rotate tokens** - If token is compromised, regenerate via @BotFather
4. ✅ **Limit bot permissions** - Only grant necessary permissions in Telegram
5. ✅ **Monitor logs** - Check Cloudflare Workers logs for suspicious activity

