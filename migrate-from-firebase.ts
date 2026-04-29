/**
 * migrate-from-firebase.ts
 * 
 * Usage: npx tsx migrate-from-firebase.ts <path-to-firebase-export.json>
 * 
 * Imports Firebase JSON backup into MySQL.
 * Firebase export format (Firestore export or manual JSON):
 * { "leads": [...], "visits": [...], "followups": [...], ... }
 */

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { pool, execute, testConnection } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx migrate-from-firebase.ts <firebase-export.json>");
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
const data = JSON.parse(raw);

function safeStr(v: any) { return v != null ? String(v) : null; }
function safeJson(v: any) { if (!v) return null; return typeof v === "string" ? v : JSON.stringify(v); }
function safeDate(v: any) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  return null;
}
function safeBool(v: any) { return v ? 1 : 0; }

async function migrateProjects(projects: any[]) {
  console.log(`Migrating ${projects.length} projects...`);
  for (const p of projects) {
    await pool.execute(
      `INSERT INTO projects (id, name, description) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [safeStr(p.id), safeStr(p.name), safeStr(p.description)]
    );
  }
}

async function migrateUsers(users: any[]) {
  console.log(`Migrating ${users.length} users...`);
  for (const u of users) {
    let pwd = safeStr(u.password) || "changeme123";
    if (pwd && !pwd.startsWith("$2")) pwd = await bcrypt.hash(pwd, 10);
    await pool.execute(
      `INSERT INTO users (id,username,password,name,role,projectId,assignedProjectIds,workingHours,assignedLocation) VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE username=VALUES(username),name=VALUES(name),role=VALUES(role),projectId=VALUES(projectId)`,
      [u.id, safeStr(u.username), pwd, safeStr(u.name), safeStr(u.role)||"user", safeStr(u.projectId), safeJson(u.assignedProjectIds), safeJson(u.workingHours), safeJson(u.assignedLocation)]
    );
  }
}

async function migrateLeads(leads: any[]) {
  console.log(`Migrating ${leads.length} leads...`);
  for (const l of leads) {
    await pool.execute(
      `INSERT INTO leads (id,name,mobile,email,source,quality,status,budget,property_interest,priority,projectId,assignedTo,stats,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name),status=VALUES(status),quality=VALUES(quality),updated_at=VALUES(updated_at)`,
      [safeStr(l.id), safeStr(l.name), safeStr(l.mobile), safeStr(l.email), safeStr(l.source),
       safeStr(l.quality)||"pending", safeStr(l.status)||"new", safeStr(l.budget), safeStr(l.property_interest),
       l.priority||0, safeStr(l.projectId), l.assignedTo||null, safeJson(l.stats),
       safeDate(l.created_at)||new Date().toISOString(), safeDate(l.updated_at)||new Date().toISOString()]
    );
  }
}

async function migrateVisits(visits: any[]) {
  console.log(`Migrating ${visits.length} visits...`);
  for (const v of visits) {
    await pool.execute(
      `INSERT INTO visits (id,leadId,client_name,mobile,email,visit_date,visit_time,purpose,status,visit_status,assigned_to,source,budget,property_interest,priority,projectId,client_feedback,interest_level,outcome,reschedule_log,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE visit_status=VALUES(visit_status),outcome=VALUES(outcome)`,
      [safeStr(v.id), safeStr(v.leadId), safeStr(v.client_name)||"Unknown", safeStr(v.mobile), safeStr(v.email),
       safeStr(v.visit_date), safeStr(v.visit_time), safeStr(v.purpose),
       safeStr(v.status)||"pending", safeStr(v.visit_status)||"scheduled",
       safeStr(v.assigned_to), safeStr(v.source), safeStr(v.budget), safeStr(v.property_interest),
       v.priority||0, safeStr(v.projectId), safeStr(v.client_feedback), safeStr(v.interest_level),
       safeStr(v.outcome), safeJson(v.reschedule_log), safeDate(v.created_at)||new Date().toISOString()]
    );
  }
}

async function migrateFollowups(followups: any[]) {
  console.log(`Migrating ${followups.length} followups...`);
  for (const f of followups) {
    await pool.execute(
      `INSERT INTO followups (id,leadId,visitId,projectId,userId,userName,date,scheduled_at,purpose,method,status,created_at,completed_at,outcome_note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status),outcome_note=VALUES(outcome_note)`,
      [safeStr(f.id), safeStr(f.leadId), safeStr(f.visitId), safeStr(f.projectId),
       f.userId||null, safeStr(f.userName), safeStr(f.date), safeDate(f.scheduled_at),
       safeStr(f.purpose), safeStr(f.method)||"call", safeStr(f.status)||"pending",
       safeDate(f.created_at)||new Date().toISOString(), safeDate(f.completed_at), safeStr(f.outcome_note)]
    );
  }
}

async function migrateRemarks(remarks: any[]) {
  console.log(`Migrating ${remarks.length} remarks...`);
  for (const r of remarks) {
    await pool.execute(
      `INSERT IGNORE INTO remarks (id,targetId,text,\`by\`,at,type,category,sentiment) VALUES (?,?,?,?,?,?,?,?)`,
      [safeStr(r.id), safeStr(r.targetId), safeStr(r.text), safeStr(r.by), safeDate(r.at)||new Date().toISOString(), safeStr(r.type)||"remark", safeStr(r.category)||"general", safeStr(r.sentiment)||"neutral"]
    );
  }
}

async function migrateActivities(activities: any[]) {
  console.log(`Migrating ${activities.length} activities...`);
  for (const a of activities) {
    await pool.execute(
      `INSERT IGNORE INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,?,?)`,
      [safeStr(a.id), safeStr(a.type), a.userId||null, safeStr(a.userName), safeStr(a.projectId), safeStr(a.targetId), safeStr(a.targetName), safeDate(a.timestamp)||new Date().toISOString(), safeStr(a.details)]
    );
  }
}

async function migrateCallLogs(logs: any[]) {
  console.log(`Migrating ${logs.length} call_logs...`);
  for (const c of logs) {
    await pool.execute(
      `INSERT IGNORE INTO call_logs (id,visitId,leadId,projectId,outcome,note,timestamp,\`by\`) VALUES (?,?,?,?,?,?,?,?)`,
      [safeStr(c.id), safeStr(c.visitId), safeStr(c.leadId), safeStr(c.projectId), safeStr(c.outcome)||"not_answered", safeStr(c.note), safeDate(c.timestamp)||new Date().toISOString(), safeStr(c.by)]
    );
  }
}

async function migrateTemplates(templates: any[]) {
  console.log(`Migrating ${templates.length} templates...`);
  for (const t of templates) {
    await pool.execute(
      `INSERT INTO templates (id,name,type,message,fileData,fileName,fileType,active) VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name),message=VALUES(message)`,
      [safeStr(t.id), safeStr(t.name), safeStr(t.type)||"custom", safeStr(t.message)||"", safeStr(t.fileData), safeStr(t.fileName), safeStr(t.fileType)||"none", safeBool(t.active)]
    );
  }
}

async function migrateWebhooks(webhooks: any[]) {
  console.log(`Migrating ${webhooks.length} webhook_configs...`);
  for (const w of webhooks) {
    await pool.execute(
      `INSERT INTO webhook_configs (id,name,token,projectId,assignedTo,assignedUserIds,lastAssignedIndex,mapping,active) VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [safeStr(w.id), safeStr(w.name), safeStr(w.token)||"", safeStr(w.projectId), w.assignedTo||null, safeJson(w.assignedUserIds), w.lastAssignedIndex||0, safeJson(w.mapping)||"{}", safeBool(w.active)]
    );
  }
}

async function migrateSettings(settings: any) {
  console.log("Migrating settings...");
  const s = Array.isArray(settings) ? settings.find((x:any) => x.id === "main") || settings[0] : settings;
  if (!s) return;
  await pool.execute(
    `INSERT INTO settings (id,company,phone,address,sources,budgets,propertyInterests) VALUES ('main',?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE company=VALUES(company),sources=VALUES(sources),budgets=VALUES(budgets),propertyInterests=VALUES(propertyInterests)`,
    [safeStr(s.company), safeStr(s.phone), safeStr(s.address), safeJson(s.sources), safeJson(s.budgets), safeJson(s.propertyInterests)]
  );
}

async function main() {
  await testConnection();
  console.log("\n=== Firebase ? MySQL Migration Started ===\n");

  if (data.projects) await migrateProjects(data.projects);
  if (data.users)    await migrateUsers(data.users);
  if (data.settings) await migrateSettings(data.settings);
  if (data.leads)    await migrateLeads(data.leads);
  if (data.visits)   await migrateVisits(data.visits);
  if (data.followups) await migrateFollowups(data.followups);
  if (data.remarks)  await migrateRemarks(data.remarks);
  if (data.activities) await migrateActivities(data.activities);
  if (data.call_logs)  await migrateCallLogs(data.call_logs);
  if (data.templates)  await migrateTemplates(data.templates);
  if (data.webhook_configs) await migrateWebhooks(data.webhook_configs);

  await pool.end();
  console.log("\n=== Migration Complete! ===");
}

main().catch(e => { console.error("Migration failed:", e); process.exit(1); });
