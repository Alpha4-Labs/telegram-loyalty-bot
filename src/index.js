/**
 * Telegram Loyalty Bot
 * Integrates Telegram community activity with Loyalteez rewards.
 * 
 * Features:
 * - Reward new joins (telegram_join)
 * - Reward daily check-ins (/checkin)
 * - Configurable event IDs via admin commands
 * - Check balance link (/balance)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Health check endpoint (for testing)
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "telegram-loyalty-bot",
          timestamp: new Date().toISOString(),
          config: {
            brandId: env.BRAND_ID ? "configured" : "missing",
            apiUrl: env.LOYALTEEZ_API_URL || "https://api.loyalteez.app",
            kvConfigured: !!env.TELEGRAM_BOT_KV,
            tokenConfigured: !!env.TELEGRAM_BOT_TOKEN
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Only accept POST requests for webhooks
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify secret token if configured (security best practice)
    if (env.WEBHOOK_SECRET && url.searchParams.get("secret") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const update = await request.json();
      
      // Handle the update
      await handleUpdate(update, env);

      return new Response("OK", { status: 200 });
    } catch (e) {
      console.error("Error processing update:", e);
      return new Response(
        JSON.stringify({ error: "Internal server error", message: e.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

async function handleUpdate(update, env) {
  // 1. Handle Message
  if (update.message) {
    await handleMessage(update.message, env);
  }
  
  // 2. Handle Chat Member Updates (optional, for stricter join tracking)
  // Note: 'message.new_chat_members' is usually sufficient for groups
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const user = message.from;
  const text = message.text || "";

  // Ignore bots
  if (user.is_bot) return;

  // --------------------------------------------
  // EVENT: User Joined Group
  // --------------------------------------------
  if (message.new_chat_members) {
    // Get configured join event ID or default
    let joinEventId = "telegram_join";
    if (env.TELEGRAM_BOT_KV) {
      const storedId = await env.TELEGRAM_BOT_KV.get(`JOIN_EVENT_ID:${chatId}`);
      if (storedId) joinEventId = storedId;
    }

    for (const member of message.new_chat_members) {
      if (!member.is_bot) {
        await triggerReward(env, joinEventId, member, chatId);
        await sendMessage(env, chatId, `Welcome ${member.first_name}! You've earned LTZ tokens for joining.`);
      }
    }
    return;
  }

  // --------------------------------------------
  // COMMAND: /checkin (Daily Reward)
  // --------------------------------------------
  if (text.startsWith("/checkin")) {
    // Get configured checkin event ID or default
    let checkinEventId = "daily_checkin";
    if (env.TELEGRAM_BOT_KV) {
      const storedId = await env.TELEGRAM_BOT_KV.get(`CHECKIN_EVENT_ID:${chatId}`);
      if (storedId) checkinEventId = storedId;
    }

    const result = await triggerReward(env, checkinEventId, user, chatId);
    
    if (result.success) {
      await sendMessage(env, chatId, `✅ Daily check-in complete! ${result.ltzDistributed || 10} LTZ sent to your wallet.`);
    } else {
      // Handle cooldowns or errors
      if (result.error?.includes("cooldown")) {
         await sendMessage(env, chatId, `⏳ You've already checked in today. Come back tomorrow!`);
      } else if (result.error?.includes("not found")) {
         await sendMessage(env, chatId, `❌ Check-in event (${checkinEventId}) not configured or inactive.`);
      } else {
         await sendMessage(env, chatId, `❌ Check-in failed: ${result.error || "Unknown error"}`);
      }
    }
    return;
  }

  // --------------------------------------------
  // COMMAND: /balance
  // --------------------------------------------
  if (text.startsWith("/balance") || text.startsWith("/ltz")) {
    await sendMessage(env, chatId, `💰 View your LTZ balance and spend tokens here:\nhttps://perks.loyalteez.app`);
    return;
  }

  // --------------------------------------------
  // ADMIN COMMAND: /config_checkin <event_id>
  // --------------------------------------------
  if (text.startsWith("/config_checkin")) {
    if (!(await isAdmin(env, chatId, user.id))) {
      await sendMessage(env, chatId, "❌ Only admins can configure the bot.");
      return;
    }

    const parts = text.split(" ");
    if (parts.length < 2) {
      await sendMessage(env, chatId, "❌ Usage: /config_checkin <event_id>");
      return;
    }

    const eventId = parts[1];
    if (env.TELEGRAM_BOT_KV) {
      await env.TELEGRAM_BOT_KV.put(`CHECKIN_EVENT_ID:${chatId}`, eventId);
      await sendMessage(env, chatId, `✅ Daily check-in event updated to: <code>${eventId}</code>`);
    } else {
      await sendMessage(env, chatId, "❌ KV Storage not configured. Cannot save settings.");
    }
    return;
  }

  // --------------------------------------------
  // ADMIN COMMAND: /config_join <event_id>
  // --------------------------------------------
  if (text.startsWith("/config_join")) {
    if (!(await isAdmin(env, chatId, user.id))) {
      await sendMessage(env, chatId, "❌ Only admins can configure the bot.");
      return;
    }

    const parts = text.split(" ");
    if (parts.length < 2) {
      await sendMessage(env, chatId, "❌ Usage: /config_join <event_id>");
      return;
    }

    const eventId = parts[1];
    if (env.TELEGRAM_BOT_KV) {
      await env.TELEGRAM_BOT_KV.put(`JOIN_EVENT_ID:${chatId}`, eventId);
      await sendMessage(env, chatId, `✅ Join event updated to: <code>${eventId}</code>`);
    } else {
      await sendMessage(env, chatId, "❌ KV Storage not configured. Cannot save settings.");
    }
    return;
  }

  // --------------------------------------------
  // COMMAND: /start
  // --------------------------------------------
  if (text.startsWith("/start")) {
    await sendMessage(env, chatId, `👋 Welcome to the community loyalty bot!\n\nCommands:\n/checkin - Earn daily points\n/balance - Check your balance\n\nAdmins:\n/config_checkin <id> - Set daily event\n/config_join <id> - Set join event`);
    return;
  }
}

/**
 * Check if user is an admin in the chat
 */
async function isAdmin(env, chatId, userId) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  // Private chats always allow config (owner)
  if (chatId > 0) return true; 

  const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) {
      const status = data.result.status;
      return ["creator", "administrator"].includes(status);
    }
  } catch (e) {
    console.error("Admin check failed:", e);
  }
  return false;
}

/**
 * Call Loyalteez API to distribute reward
 */
async function triggerReward(env, eventType, user, chatId) {
  if (!env.BRAND_ID) {
    console.error("BRAND_ID not configured");
    return { success: false, error: "Bot configuration error" };
  }

  const endpoint = `${env.LOYALTEEZ_API_URL || "https://api.loyalteez.app"}/loyalteez-api/manual-event`;
  
  const userEmail = `telegram_${user.id}@loyalteez.app`;
  
  const payload = {
    brandId: env.BRAND_ID,
    eventType: eventType,
    userEmail: userEmail,
    domain: "telegram",
    metadata: {
      platform: "telegram",
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      chat_id: chatId,
      timestamp: new Date().toISOString()
    }
  };

  console.log(`🚀 Triggering reward: ${eventType} for ${userEmail}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("API Error:", data);
      return { success: false, error: data.error || "API call failed" };
    }

    return data;
  } catch (error) {
    console.error("Network Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message to Telegram Chat
 */
async function sendMessage(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error("Telegram API Error:", err);
    }
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
  }
}
