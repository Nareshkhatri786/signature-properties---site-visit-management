import { generateDailyMISReport } from './reportService';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log("--- Signature CRM Email Test ---");
  console.log("Recipent:", process.env.REPORT_RECIPIENT || "diya9574466663@gmail.com");
  console.log("SMTP User:", process.env.SMTP_USER);
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("ERROR: SMTP_USER or SMTP_PASS is missing in .env!");
    process.exit(1);
  }

  try {
    await generateDailyMISReport();
    console.log("SUCCESS: Test report sent! Please check your inbox.");
  } catch (e: any) {
    console.error("FAILED:", e.message);
  }
  process.exit(0);
}

test();
