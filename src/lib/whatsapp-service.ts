import dotenv from 'dotenv';
dotenv.config();

const WA_API_KEY = process.env.WA_API_KEY || '';
// Defaulting to Phone ID 1 as the primary sender for now
const WA_PHONE_ID = process.env.WA_PHONE_ID_1 || ''; 
const WA_BASE_URL = 'https://app.waofficial.com/api/v2/whatsapp-business';
const WA_TEXT_ENDPOINT = process.env.WA_TEXT_ENDPOINT || '/messages';
const WA_IMAGE_ENDPOINT = process.env.WA_IMAGE_ENDPOINT || '/send-image-message-by-url';
const WA_VIDEO_ENDPOINT = process.env.WA_VIDEO_ENDPOINT || '/send-video-message-by-url';
const WA_DOCUMENT_ENDPOINT = process.env.WA_DOCUMENT_ENDPOINT || '/send-document-message';
const WA_API_KEYS_BY_PHONE: Record<string, string> = {
  // Devi Bungalows dedicated WhatsApp credentials
  "916390071558584": process.env.WA_API_KEY_916390071558584 || "cf709fc71c6ca4178196df5bde5e2942c2bc93699b9ab9b68b3db0d08c8a74e6",
};

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: any;
}

export class WhatsAppService {
  private static normalizeTo(to: string): string {
    return String(to || "").replace(/[^\d]/g, "");
  }
  
  /**
   * Helper to make API requests to the provider
   */
  private static resolveApiKey(phoneNoId?: string): string {
    const key = phoneNoId ? WA_API_KEYS_BY_PHONE[String(phoneNoId)] : "";
    return key || WA_API_KEY;
  }

  private static async makeRequest(endpoint: string, payload: any): Promise<SendMessageResponse> {
    try {
      const selectedApiKey = this.resolveApiKey(payload?.phoneNoId);
      const response = await fetch(`${WA_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${selectedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API Error:', data);
        return { success: false, error: data };
      }

      return { success: true, messageId: data?.messages?.[0]?.id || data?.messageId || data?.id };
    } catch (error) {
      console.error('WhatsApp API Request Failed:', error);
      return { success: false, error };
    }
  }

  private static async makeRequestWithCandidates(endpoint: string, candidates: any[]): Promise<SendMessageResponse> {
    let lastError: any = null;
    for (const payload of candidates) {
      const res = await this.makeRequest(endpoint, payload);
      if (res.success) return res;
      lastError = res.error;
    }
    return { success: false, error: lastError || 'All payload formats failed' };
  }

  /**
   * Send a free-form "Session" message (only allowed within 24h of client's last message)
   * @param to Phone number with country code (e.g., 919876543210)
   * @param text The message content
   */
  public static async sendSessionMessage(to: string, text: string, fromPhoneId?: string): Promise<SendMessageResponse> {
    const toNum = this.normalizeTo(to);
    const phoneNoId = fromPhoneId || WA_PHONE_ID;
    return this.makeRequestWithCandidates(WA_TEXT_ENDPOINT, [
      { phoneNoId, to: toNum, type: "text", text },
      { phoneNoId, to: toNum, message: text },
      { to: toNum, text, phoneNoId },
      { to: toNum, message: text, phoneNoId },
    ]);
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

    return this.makeRequest('/messages', payload);
  }

  /**
   * Send a Media message (Brochure / PDF / Image)
   */
  public static async sendMediaMessage(
    to: string, 
    mediaUrl: string, 
    mediaType: 'document' | 'image' | 'video', 
    caption?: string,
    fileName?: string,
    fromPhoneId?: string
  ): Promise<SendMessageResponse> {
    const toNum = this.normalizeTo(to);
    const endpoint = mediaType === 'image'
      ? WA_IMAGE_ENDPOINT
      : mediaType === 'video'
        ? WA_VIDEO_ENDPOINT
        : WA_DOCUMENT_ENDPOINT;
    const phoneNoId = fromPhoneId || WA_PHONE_ID;
    const captionText = caption || '';
    const inferredName = fileName || mediaUrl.split('/').pop() || `${mediaType}_${Date.now()}`;

    const providerCandidates = mediaType === 'document'
          ? [
          { phoneNoId, to: toNum, documentUrl: mediaUrl, fileName: inferredName, caption: captionText },
          { phoneNoId, to: toNum, url: mediaUrl, fileName: inferredName, caption: captionText, type: "document" },
        ]
      : mediaType === 'image'
        ? [
            { phoneNoId, to: toNum, imageUrl: mediaUrl, caption: captionText },
            { phoneNoId, to: toNum, url: mediaUrl, caption: captionText, type: "image" },
          ]
        : [
            { phoneNoId, to: toNum, videoUrl: mediaUrl, caption: captionText },
            { phoneNoId, to: toNum, url: mediaUrl, caption: captionText, type: "video" },
          ];

    const genericMessagesCandidates = [
      {
        phoneNoId,
        to: toNum,
        type: mediaType,
        [mediaType]: { link: mediaUrl, caption: captionText, filename: inferredName }
      },
      {
        phoneNoId,
        to: toNum,
        type: mediaType,
        [mediaType]: { url: mediaUrl, caption: captionText, filename: inferredName }
      },
    ];

    return this.makeRequestWithCandidates(endpoint, [...providerCandidates, ...genericMessagesCandidates]);
  }
}
