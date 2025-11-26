/**
 * Telegram Loyalty Bot
 * 
 * A Cloudflare Worker that integrates Telegram communities with the Loyalteez rewards platform.
 * Rewards community members with LTZ tokens for joining groups and daily check-ins.
 * 
 * Features:
 * - Automatic join rewards (configurable per chat)
 * - Daily check-in rewards (/checkin command)
 * - Admin configuration via /config_checkin and /config_join
 * - Friendly name resolution (daily_checkin → custom event ID)
 * - Bot username authentication (platform-based security)
 * - Service bindings for fast worker-to-worker communication
 * 
 * @see https://github.com/Alpha4-Labs/telegram-loyalty-bot
 */

import { LoyalteezClient } from './utils/loyalteez.js';

// CORS headers for health checks from browser
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check endpoint (for testing) with CORS
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
          headers: { ...corsHeaders, "Content-Type": "application/json" }
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
    // Get configured join event ID (required - no default)
    let joinEventId = null;
    if (env.TELEGRAM_BOT_KV) {
      joinEventId = await env.TELEGRAM_BOT_KV.get(`JOIN_EVENT_ID:${chatId}`);
    }

    if (!joinEventId) {
      await sendMessage(env, chatId, `⚠️ Join reward not configured. Admin: Use /config_join <event_id> to set up.`);
      return;
    }

    for (const member of message.new_chat_members) {
      if (!member.is_bot) {
        const result = await triggerReward(env, joinEventId, member, chatId);
        if (result.success) {
          await sendMessage(env, chatId, `Welcome ${member.first_name}! You've earned ${result.ltzDistributed || 'LTZ'} tokens for joining.`);
        } else {
          await sendMessage(env, chatId, `Welcome ${member.first_name}! (Reward processing...)`);
        }
      }
    }
    return;
  }

  // --------------------------------------------
  // COMMAND: /checkin (Daily Reward)
  // --------------------------------------------
  if (text.startsWith("/checkin")) {
    // Get configured checkin event ID (required - no default)
    let checkinEventId = null;
    if (env.TELEGRAM_BOT_KV) {
      checkinEventId = await env.TELEGRAM_BOT_KV.get(`CHECKIN_EVENT_ID:${chatId}`);
    }

    if (!checkinEventId) {
      await sendMessage(env, chatId, `⚠️ Daily check-in not configured. Admin: Use /config_checkin <event_id> to set up.\n\nCreate an event in Partner Portal with "Telegram Bot Interaction" detection, then use the generated event ID.`);
      return;
    }

    const result = await triggerReward(env, checkinEventId, user, chatId);
    
    if (result.success) {
      await sendMessage(env, chatId, `✅ Daily check-in complete! ${result.ltzDistributed || result.rewardAmount || 'LTZ'} sent to your wallet.`);
    } else {
      // Handle cooldowns or errors
      if (result.error?.includes("cooldown")) {
         await sendMessage(env, chatId, `⏳ You've already checked in today. Come back tomorrow!`);
      } else if (result.error?.includes("not found") || result.error?.includes("Invalid event")) {
         await sendMessage(env, chatId, `❌ Event "${checkinEventId}" not found or inactive. Admin: Verify the event ID in Partner Portal.`);
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
      await sendMessage(env, chatId, "❌ Usage: /config_checkin <event_id_or_friendly_name>\n\nYou can use:\n- Custom event ID: <code>custom_4748e22F_1763993617509</code>\n- Friendly name: <code>daily_checkin</code>");
      return;
    }

    const inputName = parts[1];
    
    // Resolve friendly name to custom event ID if needed
    const resolvedEventId = await resolveEventId(env, inputName);
    
    if (env.TELEGRAM_BOT_KV) {
      await env.TELEGRAM_BOT_KV.put(`CHECKIN_EVENT_ID:${chatId}`, resolvedEventId);
      
      if (resolvedEventId !== inputName) {
        await sendMessage(env, chatId, `✅ Daily check-in event configured!\n\nFriendly name: <code>${escapeHtml(inputName)}</code>\nMaps to: <code>${escapeHtml(resolvedEventId)}</code>`);
      } else {
        await sendMessage(env, chatId, `✅ Daily check-in event updated to: <code>${escapeHtml(resolvedEventId)}</code>`);
      }
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
      await sendMessage(env, chatId, "❌ Usage: /config_join <event_id_or_friendly_name>\n\nYou can use:\n- Custom event ID: <code>custom_4748e22F_1763993617509</code>\n- Friendly name: <code>telegram_join</code>");
      return;
    }

    const inputName = parts[1];
    
    // Resolve friendly name to custom event ID if needed
    const resolvedEventId = await resolveEventId(env, inputName);
    
    if (env.TELEGRAM_BOT_KV) {
      await env.TELEGRAM_BOT_KV.put(`JOIN_EVENT_ID:${chatId}`, resolvedEventId);
      
      if (resolvedEventId !== inputName) {
        await sendMessage(env, chatId, `✅ Join event configured!\n\nFriendly name: <code>${escapeHtml(inputName)}</code>\nMaps to: <code>${escapeHtml(resolvedEventId)}</code>`);
      } else {
        await sendMessage(env, chatId, `✅ Join event updated to: <code>${escapeHtml(resolvedEventId)}</code>`);
      }
    } else {
      await sendMessage(env, chatId, "❌ KV Storage not configured. Cannot save settings.");
    }
    return;
  }

  // --------------------------------------------
  // COMMAND: /start
  // --------------------------------------------
  if (text.startsWith("/start")) {
    await sendMessage(env, chatId, `👋 Welcome to the community loyalty bot!\n\nCommands:\n/checkin - Earn daily points\n/balance - Check your balance\n\nAdmins:\n/config_checkin <event_id> - Set daily event ID\n/config_join <event_id> - Set join event ID\n\n📖 Setup: Create events in Partner Portal with "Telegram Bot Interaction" detection, then configure the bot with the generated event IDs.`);
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
 * Get bot username from Telegram API (cached)
 */
let cachedBotUsername = null;
async function getBotUsername(env) {
  if (cachedBotUsername) return cachedBotUsername;
  
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  
  try {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.result.username) {
      cachedBotUsername = `@${data.result.username}`;
      return cachedBotUsername;
    }
  } catch (e) {
    console.error("Failed to get bot username:", e);
  }
  return null;
}

/**
 * Call Loyalteez API to distribute reward
 * Uses Service Bindings if available (faster, no 522 errors)
 */
async function triggerReward(env, eventType, user, chatId) {
  if (!env.BRAND_ID) {
    console.error("BRAND_ID not configured");
    return { success: false, error: "Bot configuration error" };
  }

  const userEmail = `telegram_${user.id}@loyalteez.app`;
  
  // Get bot username for authentication
  const botUsername = await getBotUsername(env);
  
  // Use LoyalteezClient with service bindings if available
  const loyalteez = new LoyalteezClient(
    env.BRAND_ID,
    env.LOYALTEEZ_API_URL,
    env.EVENT_HANDLER,  // Service binding if configured
    env.PREGENERATION   // Service binding if configured
  );

  try {
    const result = await loyalteez.sendEvent(eventType, userEmail, {
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      chat_id: chatId,
      bot_username: botUsername  // Include bot username for authentication
    });

    return result;
  } catch (error) {
    console.error("Reward Error:", error);
    return { 
      success: false, 
      error: error.message || "Failed to process reward" 
    };
  }
}

/**
 * Escape HTML entities for Telegram HTML parse mode
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolve friendly event name to custom event ID
 * Queries event configs to find custom events with matching friendly name
 */
async function resolveEventId(env, friendlyName) {
  // If it already looks like a custom event ID, return as-is
  if (friendlyName.startsWith('custom_')) {
    return friendlyName;
  }

  // If no brand ID, can't resolve
  if (!env.BRAND_ID) {
    return friendlyName;
  }

  try {
    // Query event configs endpoint to get all events for this brand
    const apiUrl = env.LOYALTEEZ_API_URL || 'https://api.loyalteez.app';
    const configUrl = `${apiUrl}/loyalteez-api/event-config?brandId=${encodeURIComponent(env.BRAND_ID)}`;
    
    const response = await fetch(configUrl, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 522) {
        console.warn(`⚠️ Event config API timeout (522) for "${friendlyName}". This might be a temporary issue. Using friendly name as-is - event-handler will handle resolution.`);
      } else {
        console.warn(`⚠️ Failed to fetch event configs for name resolution: ${response.status}. Using friendly name as-is.`);
      }
      return friendlyName; // Fallback to original name - event-handler can resolve it
    }

    const data = await response.json();
    const configs = data.events || [];
    
    console.log(`🔍 Resolving friendly name "${friendlyName}" from ${configs.length} events`);
    
    // Look for event where eventNameMapping matches our friendly name
    // eventNameMapping stores the friendly name that maps TO this event's eventType
    for (const config of configs) {
      // If eventNameMapping matches, this event accepts the friendly name
      if (config.eventNameMapping === friendlyName) {
        const resolvedId = config.eventId || config.eventType;
        console.log(`✅ Found mapping: "${friendlyName}" → "${resolvedId}"`);
        return resolvedId;
      }
      
      // Also check if eventType itself matches (for backwards compatibility)
      if (config.eventType === friendlyName) {
        console.log(`✅ Found direct match: "${friendlyName}"`);
        return config.eventId || config.eventType;
      }
    }
    
    console.log(`⚠️ No mapping found for "${friendlyName}" in ${configs.length} events. Using as-is - event-handler will validate.`);
    // Not found, return original (will fail gracefully with proper error message from event-handler)
    return friendlyName;
  } catch (error) {
    console.error('Error resolving event name:', error);
    return friendlyName; // Fallback to original name
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
