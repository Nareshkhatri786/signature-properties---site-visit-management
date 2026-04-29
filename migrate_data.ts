import fs from 'fs';
import { pool } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const data = JSON.parse(fs.readFileSync('./shreemad_backup.json', 'utf8'));

async function migrate() {
  console.log('--- Starting Migration (v3) ---');

  const connection = await pool.getConnection();
  try {
    // DISABLE FK CHECKS
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    // 1. Collect and Create Projects
    const projectIds = new Set<string>();
    if (data.leads) data.leads.forEach((l: any) => { if (l.projectId) projectIds.add(l.projectId); });
    if (data.visits) data.visits.forEach((v: any) => { if (v.projectId) projectIds.add(v.projectId); });
    ['p1', 'p2', 'p3', 'p4'].forEach(p => projectIds.add(p));

    console.log(`Ensuring ${projectIds.size} projects exist...`);
    for (const pid of projectIds) {
      let name = 'Imported Project';
      if (pid === 'p1') name = 'Signature Properties';
      else if (pid === 'p2') name = 'Shreemad Family';
      else if (pid === 'p3') name = 'Devi Bungalows';
      else if (pid === 'p4') name = 'Royal Rudraksha';
      
      await connection.execute(
        'INSERT IGNORE INTO projects (id, name) VALUES (?, ?)',
        [pid, name]
      );
    }

    // 2. Create Dummy Users if they don't exist (to avoid broken UI)
    const userIds = new Set<any>();
    if (data.leads) data.leads.forEach((l: any) => { if (l.assignedTo) userIds.add(l.assignedTo); });
    
    console.log(`Ensuring ${userIds.size} users exist...`);
    for (const uid of userIds) {
      // Find name if possible
      const leadWithUser = data.leads.find((l: any) => l.assignedTo === uid);
      const name = leadWithUser ? `User ${uid}` : `User ${uid}`;
      
      await connection.execute(
        'INSERT IGNORE INTO users (id, username, password, name, role, projectId) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, `user_${uid}`, '$2b$10$YourHashedPasswordHere', name, 'user', 'p1']
      );
    }

    // 3. Leads
    if (data.leads && Array.isArray(data.leads)) {
      console.log(`Migrating ${data.leads.length} leads...`);
      for (const lead of data.leads) {
        const stats = JSON.stringify(lead.stats || {
          visits_planned: 0,
          visits_done: 0,
          calls_attempted: 0,
          calls_answered: 0,
          followups_done: 0
        });

        await connection.execute(
          `INSERT INTO leads 
          (id, name, mobile, email, source, quality, status, budget, property_interest, priority, projectId, assignedTo, stats, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status), quality=VALUES(quality), projectId=VALUES(projectId), assignedTo=VALUES(assignedTo)`,
          [
            lead.id,
            lead.name || 'Unknown',
            lead.mobile || '',
            lead.email || '',
            lead.source || 'Manual Entry',
            lead.quality || 'pending',
            lead.status || 'new',
            lead.budget || '',
            lead.property_interest || '',
            lead.priority || 0,
            lead.projectId || 'p1',
            lead.assignedTo || null,
            stats,
            lead.created_at ? new Date(lead.created_at).toISOString().slice(0, 19).replace('T', ' ') : null,
            lead.updated_at ? new Date(lead.updated_at).toISOString().slice(0, 19).replace('T', ' ') : null
          ]
        );
      }
    }

    // 4. Visits
    if (data.visits && Array.isArray(data.visits)) {
      console.log(`Migrating ${data.visits.length} visits...`);
      for (const visit of data.visits) {
        await connection.execute(
          `INSERT INTO visits 
          (id, leadId, client_name, mobile, email, visit_date, visit_time, purpose, status, visit_status, assigned_to, source, budget, property_interest, priority, projectId, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE client_name=VALUES(client_name), visit_status=VALUES(visit_status)`,
          [
            visit.id,
            visit.leadId || null,
            visit.client_name || 'Unknown',
            visit.mobile || '',
            visit.email || '',
            visit.visit_date || null,
            visit.visit_time || '',
            visit.purpose || '',
            visit.status || 'pending',
            visit.visit_status || 'scheduled',
            visit.assigned_to || '',
            visit.source || 'Manual Entry',
            visit.budget || '',
            visit.property_interest || '',
            visit.priority || 0,
            visit.projectId || 'p1',
            visit.created_at ? new Date(visit.created_at).toISOString().slice(0, 19).replace('T', ' ') : null
          ]
        );
      }
    }

    // 5. Call Logs
    if (data.callLogs && Array.isArray(data.callLogs)) {
      console.log(`Migrating ${data.callLogs.length} call logs...`);
      for (const log of data.callLogs) {
        await connection.execute(
          `INSERT INTO call_logs 
          (id, visitId, leadId, projectId, outcome, note, timestamp, \`by\`) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE note=VALUES(note)`,
          [
            log.id,
            log.visitId || null,
            log.leadId || null,
            log.projectId || 'p1',
            log.outcome || 'not_answered',
            log.note || '',
            log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 19).replace('T', ' ') : null,
            log.by || 'System'
          ]
        );
      }
    }

    await connection.commit();
    console.log('--- Migration Completed Successfully ---');
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error);
  } finally {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();
    process.exit();
  }
}

migrate();
