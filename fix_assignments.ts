import { pool, execute, query, queryOne } from "./db.js";

async function fixAssignments() {
  console.log("Starting assignment fix...");
  try {
    // 1. Sync followups with lead owners
    const [fupResult] = await pool.execute(`
      UPDATE followups f
      JOIN leads l ON f.leadId = l.id
      JOIN users u ON l.assignedTo = u.id
      SET f.userId = l.assignedTo, f.userName = u.name
      WHERE l.assignedTo IS NOT NULL AND (f.userId != l.assignedTo OR f.userId IS NULL)
    `);
    console.log(`Follow-ups updated: ${(fupResult as any).affectedRows}`);
    
    // 2. Sync visits with lead owners
    const [visitResult] = await pool.execute(`
      UPDATE visits v
      JOIN leads l ON v.leadId = l.id
      JOIN users u ON l.assignedTo = u.id
      SET v.assigned_to = u.name
      WHERE l.assignedTo IS NOT NULL AND (v.assigned_to != u.name OR v.assigned_to IS NULL)
    `);
    console.log(`Visits updated: ${(visitResult as any).affectedRows}`);
    
    // 3. Ensure every assigned lead has at least one pending follow-up
    console.log("Checking for missing follow-ups...");
    const assignedLeads = await query<any>("SELECT id, assignedTo, projectId FROM leads WHERE assignedTo IS NOT NULL");
    let autoFupCount = 0;
    
    for (const lead of assignedLeads) {
      const existing = await queryOne<any>("SELECT id FROM followups WHERE leadId = ? AND status = 'pending'", [lead.id]);
      if (!existing) {
        const user = await queryOne<any>("SELECT name FROM users WHERE id = ?", [lead.assignedTo]);
        const userName = user?.name || "Assigned User";
        
        const fupId = `fup_fix_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const now = new Date();
        const scheduledAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later
        
        await execute(
          `INSERT INTO followups (id, leadId, projectId, userId, userName, date, scheduled_at, purpose, method, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'call', 'pending', NOW())`,
          [fupId, lead.id, lead.projectId, lead.assignedTo, userName, scheduledAt.split('T')[0], scheduledAt.slice(0, 19).replace('T', ' '), "Initial Follow-up (Auto-Fix)"]
        );
        autoFupCount++;
      }
    }
    console.log(`Auto follow-ups created: ${autoFupCount}`);
    
    console.log("Assignment fix completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Fix failed:", err);
    process.exit(1);
  }
}

fixAssignments();
