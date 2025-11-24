/**
 * Loyalteez API Client for Telegram Bot (Cloudflare Workers)
 * 
 * Uses Service Bindings for Worker-to-Worker communication (zero latency, no 522 errors)
 * Falls back to HTTP fetch if service binding is not available
 */

export class LoyalteezClient {
  /**
   * @param {string} brandId - The Brand ID (wallet address)
   * @param {string} apiUrl - Base API URL (fallback only, not used with Service Bindings)
   * @param {Object} eventHandlerBinding - Service binding to event-handler worker (optional)
   * @param {Object} pregenerationBinding - Service binding to pregeneration worker (optional)
   */
  constructor(brandId, apiUrl, eventHandlerBinding = null, pregenerationBinding = null) {
    this.brandId = brandId;
    this.apiUrl = apiUrl || 'https://api.loyalteez.app';
    this.endpoint = `${this.apiUrl}/loyalteez-api/manual-event`;
    this.pregenerationEndpoint = `${this.apiUrl}/loyalteez-api/pregenerate-user`;
    this.eventHandler = eventHandlerBinding; // Service binding if available
    this.pregeneration = pregenerationBinding; // Service binding if available
  }

  /**
   * Ensure wallet exists for user (pregenerate if needed)
   * 
   * @param {string} userEmail - The user's email
   * @returns {Promise<string>} - Wallet address
   */
  async ensureWallet(userEmail) {
    const payload = {
      email: userEmail,
      brand_id: this.brandId
    };

    console.log(`Ensuring wallet exists for: ${userEmail}`);

    // Use Service Binding if available (preferred method)
    if (this.pregeneration) {
      try {
        console.log('Using Service Binding to pregeneration');
        const serviceBindingUrl = 'https://api.loyalteez.app/loyalteez-api/pregenerate-user';
        const request = new Request(serviceBindingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const response = await this.pregeneration.fetch(request);
        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse pregeneration response:', responseText.substring(0, 200));
          throw new Error(`Pregeneration returned invalid JSON: ${response.status}`);
        }

        if (!response.ok) {
          console.error('Pregeneration Error (Service Binding):', data);
          throw new Error(data.error || `Pregeneration returned ${response.status}`);
        }

        console.log('Wallet ensured via Service Binding:', data.wallet_address);
        return data.wallet_address;
      } catch (error) {
        console.error('Service Binding pregeneration failed, falling back to HTTP:', error);
        // Fall through to HTTP fetch
      }
    }

    // Fallback to HTTP fetch
    console.log('Using HTTP fetch to pregeneration');
    try {
      const response = await fetch(this.pregenerationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Loyalteez-Telegram-Bot/1.0',
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(`Failed to parse pregeneration JSON. Raw response: ${text.substring(0, 200)}...`);
        throw new Error(`Pregeneration returned non-JSON response: ${response.status}`);
      }

      if (!response.ok) {
        console.error('Pregeneration Error:', data);
        throw new Error(data.error || `Pregeneration returned ${response.status}`);
      }

      console.log('Wallet ensured via HTTP:', data.wallet_address);
      return data.wallet_address;
    } catch (error) {
      console.error('Failed to ensure wallet via pregeneration:', error);
      // Don't throw - wallet creation will happen in event-handler as fallback
      return null;
    }
  }

  /**
   * Send a reward event to Loyalteez
   * 
   * Uses Service Binding if available (fast, no 522 errors), otherwise falls back to HTTP
   * Ensures wallet exists before sending event
   * 
   * @param {string} eventType - The event type identifier (e.g. 'telegram_join')
   * @param {string} userEmail - The user's email or unique identifier
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - The API response
   */
  async sendEvent(eventType, userEmail, metadata = {}) {
    // Ensure wallet exists first (non-blocking - event-handler will create if this fails)
    try {
      await this.ensureWallet(userEmail);
    } catch (error) {
      console.warn('Wallet pregeneration failed, continuing anyway (event-handler will handle):', error.message);
    }
    if (!this.brandId) {
      throw new Error('Loyalteez Brand ID is not configured.');
    }

    const payload = {
      brandId: this.brandId,
      eventType,
      userEmail,
      domain: 'telegram.loyalteez.app',
      metadata: {
        platform: 'telegram',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    console.log(`Sending Loyalteez Event: ${eventType} for ${userEmail}`);

    // Use Service Binding if available (preferred method)
    if (this.eventHandler) {
      try {
        console.log('Using Service Binding to event-handler');
        const serviceBindingUrl = 'https://api.loyalteez.app/loyalteez-api/manual-event';
        const request = new Request(serviceBindingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const response = await this.eventHandler.fetch(request);
        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse service binding response:', responseText.substring(0, 200));
          throw new Error(`Service binding returned invalid JSON: ${response.status}`);
        }

        if (!response.ok) {
          console.error('Loyalteez API Error (Service Binding):', data);
          const errorMsg = data.error || `API returned ${response.status}`;
          const errorDetails = data.errors ? ` Errors: ${JSON.stringify(data.errors)}` : '';
          throw new Error(errorMsg + errorDetails);
        }

        console.log('Success via Service Binding:', data);
        return data;
      } catch (error) {
        console.error('Service Binding failed, falling back to HTTP:', error);
        // Fall through to HTTP fetch
      }
    }

    // Fallback to HTTP fetch (original method)
    console.log('Using HTTP fetch to event-handler');
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Loyalteez-Telegram-Bot/1.0',
        },
        body: JSON.stringify(payload)
      });

      console.log(`Loyalteez API Status: ${response.status} ${response.statusText}`);

      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(`Failed to parse JSON. Raw response: ${text.substring(0, 200)}...`);
        throw new Error(`API returned non-JSON response: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('Loyalteez API Error:', data);
        throw new Error(data.error || `API returned ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to send event to Loyalteez:', error);
      throw error;
    }
  }
}

