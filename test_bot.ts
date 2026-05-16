import 'dotenv/config';
import { queryOne } from './db.js';
import { askGemini } from './gemini-service.js';

const WA_API_KEY = process.env.WA_API_KEY || '';
const WA_PHONE_ID = "1152168267972565"; // Shreemad Family
const TO_NUMBER = "919574466663"; // Naresh's number

(async () => {
    try {
        console.log("1. Checking DB...");
        const lead = await queryOne("SELECT * FROM leads WHERE mobile LIKE '%9574466663%' LIMIT 1");
        console.log("   ✅ DB OK. Found lead:", lead?.name || "No lead yet (will be created on incoming message)");

        console.log("\n2. Testing AI (Gemini)...");
        const aiResponse = await askGemini(
            "You are a helpful real estate assistant for Shreemad Family project. A client said: 'Hi, I am interested in Shreemad Family project. What options do you have?' Reply in JSON format: { replyText: '...' }",
            "Shreemad Family project"
        );
        console.log("   ✅ AI OK. Response:", aiResponse);

        console.log("\n3. Sending WhatsApp message...");
        const payload = JSON.parse(aiResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        const messageText = payload.replyText || "Hello! Thank you for your interest in Shreemad Family. How can we help you?";

        const res = await fetch('https://app.waofficial.com/api/v2/whatsapp-business/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNoId: WA_PHONE_ID,
                to: TO_NUMBER,
                type: "text",
                text: messageText
            })
        });

        const data = await res.json();
        if (data.id) {
            console.log("   ✅ WhatsApp message sent! Message ID:", data.id);
            console.log("   📱 Message delivered to your phone:", messageText);
        } else {
            console.log("   ❌ Failed to send WhatsApp message:", data);
        }

    } catch (e: any) {
        console.log("\n❌ ERROR OCCURRED:\n", e.message || e);
    }
    process.exit(0);
})();
