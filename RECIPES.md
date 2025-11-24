# 🧪 Loyalteez Telegram Integration Recipes

This guide provides "recipes" for integrating Loyalteez into your Telegram community, ranging from simple commands to fully integrated Mini Apps.

---

## Level 1: The "Daily Habit" (Basic)
**Best for:** Daily engagement, retention, habit building.

The easiest way to keep your community active. Users type a command once a day to earn points.

### Steps
1.  **Create Event**: Go to **Partner Portal -> Settings -> Events**.
2.  **Configure**: Click **"Create Custom Event"**.
    *   Name: "Daily Check-in"
    *   **Reward**: 10 LTZ (or your choice).
    *   **Cooldown**: Set to **24 hours**.
    *   **Save Configuration**.
3.  **Get Event ID**: Expand the event and copy the ID (e.g., `daily_checkin` or `custom_x8s7...`).
4.  **Bind Command**: In your Telegram group (as Admin), run:
    ```
    /config_checkin custom_x8s7...
    ```
5.  **Result**: Users type `/checkin` and get rewarded instantly. The bot enforces the 24-hour cooldown.

---

## Level 2: The "Welcome Committee" (Growth)
**Best for:** Growing your group, rewarding new members.

Automatically reward users the moment they join your group.

### Steps
1.  **Create Event**: In Partner Portal, create a Custom Event named "Telegram Join".
    *   **Reward**: 50 LTZ.
    *   **Cooldown**: Set to **Indefinite** (one-time reward).
    *   **Save**.
2.  **Get Event ID**: Copy the ID (e.g., `telegram_join` or `custom_abc1...`).
3.  **Bind Event**: In your Telegram group (as Admin), run:
    ```
    /config_join custom_abc1...
    ```
4.  **Result**: When a new user joins, the bot welcomes them and mints tokens to their wallet immediately.

---

## Level 3: The "Web Quest" (Intermediate)
**Best for:** Driving traffic from Telegram to your website, blog, or shop.

Use Telegram as the distribution channel for external rewards.

### Steps
1.  **Create Event**: Create a "Page Visit" event in the Portal (e.g., "Read Whitepaper").
2.  **Post Link**: Send a message in your Telegram channel:
    > 📜 **New Quest Available!**
    > Read our latest whitepaper to earn 100 LTZ!
    > [Click here to read](https://yourbrand.com/whitepaper)
3.  **Result**:
    *   User clicks link -> Visits site.
    *   The Loyalteez Widget on your site detects the visit.
    *   Reward is processed on the web; the Telegram bot is just the messenger.

---

## Level 4: The "Secret Word" (Advanced / Developer)
**Best for:** AMAs, Scavenger Hunts, Podcasts.

Reward users who are paying attention by hiding a "secret keyword" in your content.

**Note:** This requires editing `src/index.js` in your worker.

### Code Snippet
Add this to your `handleMessage` function:

```javascript
// Inside handleMessage(message, env)
if (message.text && message.text.toLowerCase() === "purple elephant") {
  // Call API for "ama_reward" event
  const result = await triggerReward(env, "ama_reward", message.from, message.chat.id);
  if (result.success) {
    await sendMessage(env, message.chat.id, `🐘 You found the secret! Reward sent.`);
  }
}
```

### Result
During a voice chat or AMA, you say "The secret word is Purple Elephant". First users to type it get the reward.

---

## Level 5: Passive Tracking (Expert)
**Best for:** "Reward for every 100 messages", "Reputation Systems", "Sentiment Analysis".

**The Challenge**: This bot runs on Cloudflare Workers (Serverless). It sleeps when not in use and cannot "watch" a chat 24/7 cheaply or efficiently for high-volume groups.

### Solution: The Gateway Pattern
To track every single message for a "Leveling System", use a dedicated Gateway.

1.  **Deploy a Polling Bot**: Run a simple Node.js/Python bot on a VPS (e.g., Railway, DigitalOcean).
2.  **Listen**: Use `node-telegram-bot-api` to listen to `message` events.
3.  **Filter & Count**: Store counts in a local Redis/DB.
4.  **Trigger**: When a user crosses a threshold (e.g., 100 messages), call the Loyalteez API.

```javascript
// Conceptual Node.js Example
bot.on('message', async (msg) => {
  const count = await db.incr(`msg_count:${msg.from.id}`);
  if (count === 100) {
     // Call Loyalteez API for 'level_up_1' event
     await loyalteezApi.sendEvent('level_up_1', `telegram_${msg.from.id}@loyalteez.app`);
     bot.sendMessage(msg.chat.id, "💯 Level Up! You earned 100 LTZ.");
  }
});
```

---

## Summary of Commands

| Command | Description | Admin Only? | Setup Required? |
|---|---|---|---|
| `/checkin` | Claims daily reward | No | Uses default `daily_checkin` or configured ID |
| `/balance` | Link to Marketplace | No | No |
| `/config_checkin <id>` | Sets the event ID for /checkin | **Yes** | Requires Event ID from Portal |
| `/config_join <id>` | Sets the event ID for new joins | **Yes** | Requires Event ID from Portal |

