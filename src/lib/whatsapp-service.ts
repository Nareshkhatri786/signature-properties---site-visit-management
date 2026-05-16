import dotenv from 'dotenv';
dotenv.config();

const WA_API_KEY = process.env.WA_API_KEY || '';
// Defaulting to Phone ID 1 as the primary sender for now
const WA_PHONE_ID = process.env.WA_PHONE_ID_1 || ''; 
const WA_BASE_URL = 'https://app.waofficial.com/api/v1'; // Base URL to be verified against provider docs

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: any;
}

export class WhatsAppService {
  
  /**
   * Helper to make API requests to the provider
   */
  private static async makeRequest(endpoint: string, payload: any): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${WA_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API Error:', data);
        return { success: false, error: data };
      }

      return { success: true, messageId: data?.messages?.[0]?.id || data?.messageId };
    } catch (error) {
      console.error('WhatsApp API Request Failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Send a free-form "Session" message (only allowed within 24h of client's last message)
   * @param to Phone number with country code (e.g., 919876543210)
   * @param text The message content
   */
  public static async sendSessionMessage(to: string, text: string): Promise<SendMessageResponse> {
    const payload = {
      phoneNoId: WA_PHONE_ID,
      to: to,
      type: "text",
      text: {
        body: text
      }
    };

    return this.makeRequest('/messages/sendText', payload);
  }

  /**
   * Send a pre-approved Template message (required if 24h has expired)
   * @param to Phone number with country code
   * @param templateName The approved template name
   * @param language The language code (e.g., en_US, hi, gu)
   * @param bodyParams Array of dynamic text values to inject into the template
   */
  public static async sendTemplateMessage(
    to: string, 
    templateName: string, 
    language: string = 'en', 
    bodyParams: string[] = []
  ): Promise<SendMessageResponse> {
    const payload = {
      phoneNoId: WA_PHONE_ID,
      to: to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: language
        },
        components: [
          {
            type: "body",
            parameters: bodyParams.map(param => ({
              type: "text",
              text: param
            }))
          }
        ]
      }
    };

    return this.makeRequest('/messages/sendTemplate', payload);
  }

  /**
   * Send a Media message (Brochure / PDF / Image)
   */
  public static async sendMediaMessage(
    to: string, 
    mediaUrl: string, 
    mediaType: 'document' | 'image' | 'video', 
    caption?: string
  ): Promise<SendMessageResponse> {
    const payload = {
      phoneNoId: WA_PHONE_ID,
      to: to,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl,
        caption: caption
      }
    };

    return this.makeRequest(`/messages/sendMedia`, payload);
  }
}
