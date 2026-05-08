import { query, execute } from "./db.js";

async function audit() {
  console.log("--- AUDITING PENDING FOLLOWUPS ---");
  try {
    const fups = await query(`
      SELECT f.id, f.leadId, l.name as leadName, l.status as leadStatus, f.status as fupStatus 
      FROM followups f 
      LEFT JOIN leads l ON f.leadId = l.id 
      WHERE f.status = 'pending'
    `);
    
    const lostWithFup = fups.filter(x => x.leadStatus === 'lost');
    const orphanFup = fups.filter(x => !x.leadStatus);
    const closedWithFup = fups.filter(x => x.leadStatus === 'closed');
    
    console.log(`Total Pending Followups: ${fups.length}`);
    console.log(`Lost Leads with pending Followups: ${lostWithFup.length}`);
    console.log(`Closed Leads with pending Followups: ${closedWithFup.length}`);
    console.log(`Orphan Followups (Lead not found): ${orphanFup.length}`);

    if (lostWithFup.length > 0 || closedWithFup.length > 0) {
      console.log("Deleting followups for Lost/Closed leads...");
      const result = await execute("DELETE f FROM followups f JOIN leads l ON f.leadId = l.id WHERE l.status IN ('lost', 'closed') AND f.status = 'pending'");
      console.log(`Deleted ${(result as any).affectedRows} records.`);
    }

    // Double check: any pending followup where lead status is NOT active
    const result2 = await execute(`
      DELETE f FROM followups f 
      JOIN leads l ON f.leadId = l.id 
      WHERE f.status = 'pending' 
      AND l.status NOT IN ('new', 'contacted', 'visit_scheduled', 'visit_done')
    `);
    console.log(`Aggressive cleanup: Deleted ${(result2 as any).affectedRows} additional records.`);

    console.log("Audit and cleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();
