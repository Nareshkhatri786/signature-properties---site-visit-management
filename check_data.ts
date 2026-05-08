import { pool, query, queryOne } from "./db.js";

async function runCheck() {
  console.log("--- DATA INTEGRITY REPORT ---");
  try {
    const users = await query("SELECT id, name FROM users");
    const stats = [];
    for (const u of users) {
      const leads = await queryOne("SELECT COUNT(*) as c FROM leads WHERE assignedTo = ?", [u.id]);
      const followupsPending = await queryOne("SELECT COUNT(*) as c FROM followups WHERE userId = ? AND status = 'pending'", [u.id]);
      const visitsScheduled = await queryOne("SELECT COUNT(*) as c FROM visits v WHERE v.assigned_to = ? AND v.visit_status IN ('scheduled', 'rescheduled')", [u.name]);
      stats.push({ 
        User: u.name, 
        Leads: leads.c, 
        "Pending Followups": followupsPending.c, 
        "Scheduled Visits": visitsScheduled.c 
      });
    }
    
    const unassignedFups = await queryOne("SELECT COUNT(*) as c FROM followups WHERE userId IS NULL AND status = 'pending'");
    stats.push({ 
      User: "--- UNASSIGNED ---", 
      Leads: (await queryOne("SELECT COUNT(*) as c FROM leads WHERE assignedTo IS NULL")).c, 
      "Pending Followups": unassignedFups.c, 
      "Scheduled Visits": (await queryOne("SELECT COUNT(*) as c FROM visits WHERE assigned_to IS NULL AND visit_status IN ('scheduled', 'rescheduled')")).c
    });
    
    console.table(stats);

    // Check for mismatches
    const mismatchFup = await queryOne(`
      SELECT COUNT(*) as c 
      FROM followups f 
      JOIN leads l ON f.leadId = l.id 
      WHERE l.assignedTo IS NOT NULL AND f.userId != l.assignedTo
    `);
    
    const mismatchVisit = await queryOne(`
      SELECT COUNT(*) as c 
      FROM visits v 
      JOIN leads l ON v.leadId = l.id 
      JOIN users u ON l.assignedTo = u.id
      WHERE l.assignedTo IS NOT NULL AND v.assigned_to != u.name
    `);

    const overdue = await queryOne("SELECT COUNT(*) as c FROM followups WHERE status = 'pending' AND date < CURDATE()");
    const dueToday = await queryOne("SELECT COUNT(*) as c FROM followups WHERE status = 'pending' AND date = CURDATE()");
    const upcoming = await queryOne("SELECT COUNT(*) as c FROM followups WHERE status = 'pending' AND date > CURDATE()");
    const completed = await queryOne("SELECT COUNT(*) as c FROM followups WHERE status = 'completed'");

    console.log(`\n--- DISCREPANCIES ---`);
    console.log(`Mismatched Followups: ${mismatchFup.c}`);
    console.log(`Mismatched Visits: ${mismatchVisit.c}`);
    
    console.log(`\n--- DASHBOARD CROSS-CHECK ---`);
    console.log(`Overdue (Database): ${overdue.c} (Dashboard: 347)`);
    console.log(`Today (Database): ${dueToday.c} (Dashboard: 516)`);
    console.log(`Upcoming (Database): ${upcoming.c} (Dashboard: 235)`);
    console.log(`Completed (Database): ${completed.c} (Dashboard: 217)`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runCheck();
