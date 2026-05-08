import { execute } from "./db.js";

async function cleanupLost() {
  try {
    const result = await execute("DELETE f FROM followups f JOIN leads l ON f.leadId = l.id WHERE l.status = 'lost' AND f.status = 'pending'");
    console.log(`Deleted ${(result as any).affectedRows} followups for lost leads.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanupLost();
