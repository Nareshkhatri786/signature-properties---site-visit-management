import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, query, queryOne, execute, parseJsonFields, stringifyJsonFields, testConnection } from "./db.js";
import { setupMISReports, generateDailyMISReport, generateWeekendMISReport, setDbPool, getReportStats, sendCustomEmail } from "./reportService.js";
import { normalizePhoneNumber } from "./src/lib/phoneUtils.js";
import webPush from "web-push";
import dotenv from "dotenv";
dotenv.config();

const PUBLIC_VAPID_KEY = process.env.PUBLIC_VAPID_KEY || "BLraqx6JI2_b6uK3Q83waVcP2n8JXaAhzdPWrVJnqHhfLhusM8AextWDWwPx0_y51Ua9XxY-g-D4FvgJomgMpBE";
const PRIVATE_VAPID_KEY = process.env.PRIVATE_VAPID_KEY || "6d9cRb3i51P9Qw0niJSkTQ5_mGuK-Dqz2Wcj-itMUPQ";
webPush.setVapidDetails("mailto:admin@diyacrm.com", PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);

const JSON_FIELDS_LEADS = ["stats"];
const JSON_FIELDS_VISITS = ["reminders_sent", "reschedule_log"];
const JSON_FIELDS_USERS = ["workingHours", "assignedLocation", "locationRequest", "assignedProjectIds"];
const JSON_FIELDS_WEBHOOK = ["mapping", "assignedUserIds"];
const JSON_FIELDS_SETTINGS = ["sources", "budgets", "propertyInterests"];
const JSON_FIELDS_ATTENDANCE = ["checkIn", "checkOut"];
const JSON_FIELDS_NOTIF = ["metadata"];
const JSON_FIELDS_WORKFLOWS = ["conditions", "actions"];
const JSON_FIELDS_PROJECTS = ["location"];
const JWT_SECRET = process.env.JWT_SECRET || "diyacrm_secret_change_in_prod";

// Helper to format ISO dates for MySQL
function formatMySQLDate(isoString: string | null) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  app.use(express.json({ limit: "50mb" }));
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // -- LOGIN ----------------------------------------------
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await queryOne<any>("SELECT * FROM users WHERE username = ?", [username]);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, projectId: user.projectId, name: user.name }, JWT_SECRET, { expiresIn: "30d" });
      const safeUser = parseJsonFields({ ...user }, JSON_FIELDS_USERS);
      delete safeUser.password;
      return res.json({ token, user: safeUser });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // -- PUSH NOTIFICATIONS ---------------------------------
  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: PUBLIC_VAPID_KEY });
  });

  app.post("/api/push/subscribe", authMiddleware, async (req, res) => {
    const { endpoint, keys } = req.body;
    const userId = (req as any).user.id;
    try {
      await pool.execute(
        `INSERT IGNORE INTO push_subscriptions (userId, endpoint, auth, p256dh) VALUES (?, ?, ?, ?)`,
        [userId, endpoint, keys.auth, keys.p256dh]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/push/send", authMiddleware, async (req, res) => {
    const { userIds, title, body, url } = req.body;
    try {
      await sendPushNotification(userIds, { title, body, url });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  async function sendPushNotification(userIds: string[], payload: any) {
    if (!userIds || userIds.length === 0) return;
    try {
      const placeholders = userIds.map(() => '?').join(',');
      const subs = await query<any>(`SELECT * FROM push_subscriptions WHERE userId IN (${placeholders})`, userIds);
      
      const pushPayload = JSON.stringify(payload);
      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh }
        };
        try {
          await webPush.sendNotification(pushSubscription, pushPayload);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await pool.execute(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [sub.endpoint]);
          } else {
            console.error("Push sending error:", err);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
    }
  }

  // -- CHANGE PASSWORD ------------------------------------
  app.post("/api/change-password", authMiddleware, async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    try {
      const user = await queryOne<any>("SELECT * FROM users WHERE id = ?", [userId]);
      if (!user) return res.status(404).json({ error: "User not found" });
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) return res.status(401).json({ error: "Wrong current password" });
      const hash = await bcrypt.hash(newPassword, 10);
      await execute("UPDATE users SET password = ? WHERE id = ?", [hash, userId]);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // -- INITIALIZATION (Static Data) -----------------------
  app.get("/api/init", authMiddleware, async (req, res) => {
    try {
      const [projects, templates, settingsRow, workflows] = await Promise.all([
        query("SELECT * FROM projects"),
        query("SELECT * FROM templates"),
        queryOne("SELECT * FROM settings WHERE id = 'main'"),
        query("SELECT * FROM workflows")
      ]);
      const settings = settingsRow ? parseJsonFields(settingsRow, JSON_FIELDS_SETTINGS) : {};
      res.json({ projects, templates, settings, workflows: workflows.map((r: any) => parseJsonFields(r, JSON_FIELDS_WORKFLOWS)) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- DELTA SYNC (Fetch only changed data) ---------------
  app.get("/api/sync", authMiddleware, async (req, res) => {
    const { since } = req.query;
    const sinceTime = since ? new Date(since as string).toISOString().slice(0, 19).replace('T', ' ') : '1970-01-01 00:00:00';
    
    try {
      const u = (req as any).user;
      const uRole = u.role?.toLowerCase();
      const isAdmin = uRole === "admin" || uRole === "adm";
      const projectFilter = isAdmin ? "" : "AND projectId = ?";
      const projectParams = isAdmin ? [] : [u.projectId];

      const [leads, visits, followups, notifications] = await Promise.all([
        query(`SELECT * FROM leads WHERE updated_at > ? ${projectFilter}`, [sinceTime, ...projectParams]),
        query(`SELECT * FROM visits WHERE created_at > ? ${projectFilter}`, [sinceTime, ...projectParams]),
        query(`SELECT * FROM followups WHERE created_at > ? ${projectFilter}`, [sinceTime, ...projectParams]),
        query(`SELECT * FROM notifications WHERE createdAt > ? AND (userId = ? OR isAdmin = 1)`, [sinceTime, u.id])
      ]);
      
      console.log(`[Sync Debug] User: ${u.username}, Role: ${u.role}, isAdmin: ${isAdmin}, Leads Found: ${leads.length}`);

      res.json({
        leads: leads.map((r: any) => parseJsonFields(r, JSON_FIELDS_LEADS)),
        visits: visits.map((r: any) => parseJsonFields(r, JSON_FIELDS_VISITS)),
        followups,
        notifications,
        serverTime: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- MODULE SPECIFIC ENDPOINTS ---------------------------
  app.get("/api/leads", authMiddleware, async (req, res) => {
    const { page = 1, limit = 50, search = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const searchFilter = search ? `AND (name LIKE ? OR mobile LIKE ?)` : "";
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];
    
    try {
      const u = (req as any).user;
      const uRole = u.role?.toLowerCase();
      const isAdmin = uRole === "admin" || uRole === "adm";
      const projectFilter = isAdmin ? "" : "AND projectId = ?";
      const projectParams = isAdmin ? [] : [u.projectId];

      const rows = await query(`SELECT * FROM leads WHERE 1=1 ${projectFilter} ${searchFilter} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, 
        [...projectParams, ...searchParams, Number(limit), offset]);
      res.json(rows.map((r: any) => parseJsonFields(r, JSON_FIELDS_LEADS)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/stats", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const uRole = u.role?.toLowerCase();
      const isAdmin = uRole === "admin" || uRole === "adm";
      const filter = isAdmin ? "" : "WHERE projectId = ?";
      const params = isAdmin ? [] : [u.projectId];

      const [statusStats, qualityStats, todayLeads] = await Promise.all([
        query(`SELECT status, COUNT(*) as count FROM leads ${filter} GROUP BY status`, params),
        query(`SELECT quality, COUNT(*) as count FROM leads ${filter} GROUP BY quality`, params),
        queryOne(`SELECT COUNT(*) as count FROM leads ${isAdmin ? 'WHERE' : 'AND'} created_at >= CURDATE() ${filter}`, params)
      ]);

      res.json({ statusStats, qualityStats, todayCount: (todayLeads as any)?.count || 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- LEGACY (to be phased out) --------------------------
  app.get("/api/data", authMiddleware, async (req, res) => {
    // ... existing logic but limited to 100 records for performance
    try {
      const u = (req as any).user;
      const uRole = u.role?.toLowerCase();
      const isAdmin = uRole === "admin" || uRole === "adm";
      const projectFilter = isAdmin ? "" : "WHERE projectId = ?";
      const projectParams = isAdmin ? [] : [u.projectId];

      console.log(`[Data Debug] User: ${u.username}, Role: ${u.role}, isAdmin: ${isAdmin}`);

      const [users, projects, leads, visits, followups, activities, call_logs, templates, webhook_configs, notifications, attendance, workflows] = await Promise.all([
        query("SELECT * FROM users"),
        query("SELECT * FROM projects"),
        query(`SELECT * FROM leads ${projectFilter} ORDER BY updated_at DESC LIMIT 5000`, projectParams),
        query(`SELECT * FROM visits ${projectFilter} ORDER BY visit_date DESC LIMIT 5000`, projectParams),
        query(`SELECT * FROM followups ${projectFilter} ORDER BY date DESC LIMIT 5000`, projectParams),
        query(`SELECT * FROM activities ${projectFilter} ORDER BY timestamp DESC LIMIT 5000`, projectParams),
        query(`SELECT * FROM call_logs ${projectFilter} ORDER BY timestamp DESC LIMIT 5000`, projectParams),
        query("SELECT * FROM templates"),
        query("SELECT * FROM webhook_configs"),
        query("SELECT * FROM notifications WHERE (userId = ? OR isAdmin = 1) ORDER BY createdAt DESC LIMIT 500", [u.id]),
        query(isAdmin ? "SELECT * FROM attendance ORDER BY date DESC LIMIT 500" : "SELECT * FROM attendance WHERE userId = ? ORDER BY date DESC LIMIT 500", isAdmin ? [] : [u.id]),
        query("SELECT * FROM workflows"),
      ]);

      console.log(`[Data Debug] User: ${u.username}, Role: ${u.role}, Leads: ${leads.length}, Users: ${users.length}, Projects: ${projects.length}`);

      const settingsRow = await queryOne("SELECT * FROM settings WHERE id = 'main'");
      const settings = settingsRow ? parseJsonFields(settingsRow, JSON_FIELDS_SETTINGS) : {};

      res.json({
        users: users.map((r: any) => parseJsonFields(r, JSON_FIELDS_USERS)),
        projects,
        leads: leads.map((r: any) => parseJsonFields(r, JSON_FIELDS_LEADS)),
        visits: visits.map((r: any) => parseJsonFields(r, JSON_FIELDS_VISITS)),
        attendance: attendance.map((r: any) => parseJsonFields(r, JSON_FIELDS_ATTENDANCE)),
        followups,
        activities,
        call_logs,
        templates,
        notifications, webhook_configs, settings, workflows
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- SAVE (upsert) --------------------------------------
  app.post("/api/save", authMiddleware, async (req, res) => {
    const { collection: col, data } = req.body;
    try {
      if (col === "leads") {
        const d = stringifyJsonFields(data, JSON_FIELDS_LEADS);
        
        // Check if this is a new lead BEFORE saving
        const leadExists = await queryOne("SELECT id FROM leads WHERE id = ?", [d.id]);
        const isNewLead = !leadExists;

        await pool.execute(
          `INSERT INTO leads (id,name,mobile,email,source,quality,status,budget,property_interest,priority,projectId,assignedTo,stats,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name),mobile=VALUES(mobile),email=VALUES(email),source=VALUES(source),quality=VALUES(quality),status=VALUES(status),budget=VALUES(budget),property_interest=VALUES(property_interest),priority=VALUES(priority),assignedTo=VALUES(assignedTo),stats=VALUES(stats),updated_at=NOW()`,
          [d.id,d.name,d.mobile||null,d.email||null,d.source||null,d.quality||"pending",d.status||"new",d.budget||null,d.property_interest||null,d.priority||0,d.projectId||null,d.assignedTo||null,d.stats||null,formatMySQLDate(d.created_at),new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );

        // AUTO FOLLOW-UP LOGIC: Only create a welcome call if NO follow-ups exist for this lead
        if (d.status === "new") {
          const existingFupCount = await queryOne("SELECT COUNT(*) as count FROM followups WHERE leadId = ?", [d.id]);
          if (!existingFupCount || existingFupCount.count === 0) {
            const tenMinsLater = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const dateOnly = tenMinsLater.split('T')[0];
            
            await pool.execute(
              `INSERT IGNORE INTO followups (id, leadId, projectId, date, scheduled_at, purpose, method, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'call', 'pending', NOW())`,
              [`fup_auto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, d.id, d.projectId, dateOnly, tenMinsLater, `Welcome call for ${d.source || 'New'} Lead`]
            );
          }
        }
      } else if (col === "visits") {
        const d = stringifyJsonFields(data, JSON_FIELDS_VISITS);
        await pool.execute(
          `INSERT INTO visits (id,leadId,client_name,mobile,email,visit_date,visit_time,purpose,status,visit_status,assigned_to,source,budget,property_interest,priority,projectId,reminders_sent,client_feedback,interest_level,outcome,reschedule_log,completed_at,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE leadId=VALUES(leadId),client_name=VALUES(client_name),mobile=VALUES(mobile),email=VALUES(email),visit_date=VALUES(visit_date),visit_time=VALUES(visit_time),purpose=VALUES(purpose),status=VALUES(status),visit_status=VALUES(visit_status),assigned_to=VALUES(assigned_to),source=VALUES(source),budget=VALUES(budget),property_interest=VALUES(property_interest),priority=VALUES(priority),reminders_sent=VALUES(reminders_sent),client_feedback=VALUES(client_feedback),interest_level=VALUES(interest_level),outcome=VALUES(outcome),reschedule_log=VALUES(reschedule_log),completed_at=VALUES(completed_at)`,
          [d.id,d.leadId||null,d.client_name,d.mobile||null,d.email||null,d.visit_date||null,d.visit_time||null,d.purpose||null,d.status||"pending",d.visit_status||"scheduled",d.assigned_to||null,d.source||null,d.budget||null,d.property_interest||null,d.priority||0,d.projectId||null,d.reminders_sent||null,d.client_feedback||null,d.interest_level||null,d.outcome||null,d.reschedule_log||null,formatMySQLDate(d.completed_at),formatMySQLDate(d.created_at || new Date().toISOString())]
        );
      } else if (col === "followups") {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          console.log(`[Follow-up] Processing save for ID: ${data.id}, Status: ${data.status}`);
          
          // 1. Save/Update Follow-up
          await connection.execute(
            `INSERT INTO followups (id,leadId,visitId,projectId,userId,userName,date,scheduled_at,purpose,method,status,created_at,completed_at,outcome_note)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE leadId=VALUES(leadId),visitId=VALUES(visitId),date=VALUES(date),purpose=VALUES(purpose),method=VALUES(method),status=VALUES(status),completed_at=VALUES(completed_at),outcome_note=VALUES(outcome_note)`,
            [data.id,data.leadId||null,data.visitId||null,data.projectId||null,data.userId||null,data.userName||null,formatMySQLDate(data.date),formatMySQLDate(data.scheduled_at),data.purpose||null,data.method||"call",data.status||"pending",formatMySQLDate(data.created_at || new Date().toISOString()),formatMySQLDate(data.completed_at),data.outcome_note||null]
          );

          // 2. If status is 'completed', handle Lead stats and Activity Log
          if (data.status === "completed") {
            // Ensure we have leadId (sometimes frontend sends partial updates)
            let effectiveLeadId = data.leadId;
            if (!effectiveLeadId) {
              const [rows] = await connection.execute("SELECT leadId FROM followups WHERE id = ?", [data.id]);
              if ((rows as any[]).length > 0) effectiveLeadId = (rows as any[])[0].leadId;
            }

            if (effectiveLeadId) {
              console.log(`[Follow-up] Incrementing stats and logging activity for Lead: ${effectiveLeadId}`);
              // Update lead stats
              const [leads] = await connection.execute("SELECT stats FROM leads WHERE id = ?", [effectiveLeadId]);
              if ((leads as any[]).length > 0) {
                let stats = (leads as any[])[0].stats;
                if (typeof stats === 'string') stats = JSON.parse(stats);
                if (!stats) stats = { visits_planned: 0, visits_done: 0, calls_attempted: 0, calls_answered: 0, followups_done: 0 };
                
                stats.followups_done = (stats.followups_done || 0) + 1;
                await connection.execute("UPDATE leads SET stats = ?, updated_at = NOW() WHERE id = ?", [JSON.stringify(stats), effectiveLeadId]);
              }

              // Create Activity entry
              const activityId = `act_fup_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
              const uId = data.userId ? parseInt(String(data.userId)) : null;
              await connection.execute(
                `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
                [activityId, 'followup_done', uId, data.userName||null, data.projectId||null, effectiveLeadId, data.clientName||'Lead', `Follow-up completed: ${data.outcome_note || 'Completed'}`]
              );
            }
          }

          await connection.commit();
          console.log(`[Follow-up] Successfully committed transaction for ID: ${data.id}`);
        } catch (err) {
          console.error(`[Follow-up] Transaction failed for ID: ${data.id}`, err);
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      } else if (col === "users") {
        const d = stringifyJsonFields(data, JSON_FIELDS_USERS);
        const passwordUpdate = (data.password && data.password.trim() !== "" && !data.password.startsWith("$2")) ? ",password=VALUES(password)" : "";
        const passwordValue = (data.password && data.password.trim() !== "" && !data.password.startsWith("$2")) ? await bcrypt.hash(data.password, 10) : (data.password || "");
        await pool.execute(
          `INSERT INTO users (id,username,password,name,role,projectId,assignedProjectIds,workingHours,assignedLocation)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE username=VALUES(username),name=VALUES(name),role=VALUES(role),projectId=VALUES(projectId),assignedProjectIds=VALUES(assignedProjectIds),workingHours=VALUES(workingHours),assignedLocation=VALUES(assignedLocation)${passwordUpdate}`,
          [d.id,d.username,passwordValue,d.name,d.role||"user",d.projectId||null,d.assignedProjectIds||null,d.workingHours||null,d.assignedLocation||null]
        );
      } else if (col === "projects") {
        const d = stringifyJsonFields(data, JSON_FIELDS_PROJECTS);
        await pool.execute(
          `INSERT INTO projects (id,name,description,location) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),location=VALUES(location)`,
          [d.id, d.name, d.description||null, d.location||null]
        );
      } else if (col === "settings") {
        const d = stringifyJsonFields(data, JSON_FIELDS_SETTINGS);
        await pool.execute(
          `INSERT INTO settings (id,company,phone,address,sources,budgets,propertyInterests) VALUES ('main',?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE company=VALUES(company),phone=VALUES(phone),address=VALUES(address),sources=VALUES(sources),budgets=VALUES(budgets),propertyInterests=VALUES(propertyInterests)`,
          [d.company||null,d.phone||null,d.address||null,d.sources||null,d.budgets||null,d.propertyInterests||null]
        );
      } else if (col === "templates") {
        await pool.execute(
          `INSERT INTO templates (id,name,type,message,fileData,fileName,fileType,active) VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name),type=VALUES(type),message=VALUES(message),fileData=VALUES(fileData),fileName=VALUES(fileName),fileType=VALUES(fileType),active=VALUES(active)`,
          [data.id,data.name,data.type||"custom",data.message||"",data.fileData||null,data.fileName||null,data.fileType||"none",data.active?1:0]
        );
      } else if (col === "webhook_configs") {
        const d = stringifyJsonFields(data, JSON_FIELDS_WEBHOOK);
        await pool.execute(
          `INSERT INTO webhook_configs (id,name,token,projectId,assignedTo,assignedUserIds,lastAssignedIndex,mapping,active) VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name),projectId=VALUES(projectId),assignedTo=VALUES(assignedTo),assignedUserIds=VALUES(assignedUserIds),mapping=VALUES(mapping),active=VALUES(active)`,
          [d.id,d.name,d.token||"",d.projectId||null,d.assignedTo||null,d.assignedUserIds||null,d.lastAssignedIndex||0,d.mapping||"{}",d.active?1:0]
        );
      } else if (col === "call_logs") {
        await pool.execute(
          `INSERT INTO call_logs (id,visitId,leadId,projectId,outcome,note,timestamp,\`by\`) VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE outcome=VALUES(outcome),note=VALUES(note)`,
          [data.id,data.visitId||null,data.leadId||null,data.projectId||null,data.outcome||"not_answered",data.note||null,formatMySQLDate(data.timestamp || new Date().toISOString()),data.by||null]
        );
      } else if (col === "activities") {
        await pool.execute(
          `INSERT IGNORE INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,?,?)`,
          [data.id,data.type,data.userId||null,data.userName||null,data.projectId||null,data.targetId||null,data.targetName||null,formatMySQLDate(data.timestamp || new Date().toISOString()),data.details||null]
        );
      } else if (col === "attendance") {
        const d = stringifyJsonFields(data, JSON_FIELDS_ATTENDANCE);
        try {
          await pool.execute(
            `INSERT INTO attendance (id,userId,date,checkIn,checkOut,status) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE checkIn=VALUES(checkIn),checkOut=VALUES(checkOut),status=VALUES(status)`,
            [d.id, d.userId, d.date, d.checkIn||null, d.checkOut||null, d.status||"absent"]
          );
          console.log(`[Attendance] Saved for user ${d.userId} on ${d.date}`);
        } catch (err) {
          console.error(`[Attendance Error] User ${d.userId}, Date ${d.date}:`, err);
          throw err;
        }
      } else if (col === "notifications") {
        const d = stringifyJsonFields(data, JSON_FIELDS_NOTIF);
        await pool.execute(
          `INSERT INTO notifications (id,userId,type,title,message,\`read\`,createdAt,isAdmin,metadata,date) VALUES (?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE \`read\`=VALUES(\`read\`)`,
          [d.id,d.userId||null,d.type||"",d.title||"",d.message||"",d.read?1:0,formatMySQLDate(d.createdAt||new Date().toISOString()),d.isAdmin?1:0,d.metadata||null,d.date||null]
        );
      } else if (col === "workflows") {
        const d = stringifyJsonFields(data, JSON_FIELDS_WORKFLOWS);
        await pool.execute(
          `INSERT INTO workflows (id,name,description,isActive,\`trigger\`,conditions,actions,createdAt,updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),isActive=VALUES(isActive),\`trigger\`=VALUES(\`trigger\`),conditions=VALUES(conditions),actions=VALUES(actions),updatedAt=NOW()`,
          [d.id, d.name, d.description||null, d.isActive?1:0, d.trigger, d.conditions||"[]", d.actions||"[]", formatMySQLDate(d.createdAt||new Date().toISOString()), formatMySQLDate(new Date().toISOString())]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error(`POST /api/save error (${col}):`, e);
      res.status(500).json({ error: e.message });
    }
  });

  // -- DELETE ---------------------------------------------
  app.post("/api/delete", authMiddleware, async (req, res) => {
    const { collection: col, id } = req.body;
    try {
      const tableMap: Record<string, string> = {
        leads: "leads", visits: "visits", followups: "followups",
        activities: "activities", call_logs: "call_logs", templates: "templates",
        webhook_configs: "webhook_configs", users: "users", projects: "projects",
        notifications: "notifications", attendance: "attendance", workflows: "workflows"
      };
      const table = tableMap[col];
      if (!table) return res.status(400).json({ error: "Unknown collection" });
      await execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/remarks/:targetId", authMiddleware, async (req, res) => {
    try {
      const rows = await query("SELECT * FROM remarks WHERE targetId = ? ORDER BY at ASC", [req.params.targetId]);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/activities/:targetId", authMiddleware, async (req, res) => {
    try {
      const rows = await query("SELECT * FROM activities WHERE targetId = ? ORDER BY timestamp DESC", [req.params.targetId]);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/whatsapp/:targetId", authMiddleware, async (req, res) => {
    try {
      const rows = await query("SELECT * FROM whatsapp_messages WHERE leadId = ? ORDER BY timestamp DESC", [req.params.targetId]);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/remarks", authMiddleware, async (req, res) => {
    const { targetId, remark } = req.body;
    try {
      await pool.execute(
        `INSERT INTO remarks (id,targetId,text,\`by\`,at,type,category,sentiment) VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE text=VALUES(text)`,
        [remark.id, targetId, remark.text, remark.by||"", formatMySQLDate(remark.at||new Date().toISOString()), remark.type||"remark", remark.category||"general", remark.sentiment||"neutral"]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- NOTIFICATIONS: mark read ---------------------------
  app.post("/api/notifications/read", authMiddleware, async (req, res) => {
    const { id } = req.body;
    try {
      if (id === "all") {
        const u = (req as any).user;
        await execute("UPDATE notifications SET `read` = 1 WHERE userId = ? OR isAdmin = 1", [u.id]);
      } else {
        await execute("UPDATE notifications SET `read` = 1 WHERE id = ?", [id]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- WEBHOOK (token-based lead capture) -----------------
  const handleWebhook = async (req: express.Request, res: express.Response) => {
    const { token } = req.params;
    try {
      const config = await queryOne<any>("SELECT * FROM webhook_configs WHERE token = ? AND active = 1", [token]);
      if (!config) return res.status(404).json({ error: "Invalid or inactive webhook token" });
      const parsedConfig = parseJsonFields(config, JSON_FIELDS_WEBHOOK);

      const payload = { ...req.body, ...req.query };
      let assignedUserId = parsedConfig.assignedTo || null;
      if (parsedConfig.assignedUserIds && parsedConfig.assignedUserIds.length > 0) {
        const lastIndex = parsedConfig.lastAssignedIndex ?? -1;
        const nextIndex = (lastIndex + 1) % parsedConfig.assignedUserIds.length;
        assignedUserId = parsedConfig.assignedUserIds[nextIndex];
        await execute("UPDATE webhook_configs SET lastAssignedIndex = ? WHERE id = ?", [nextIndex, config.id]);
      }

      const leadId = "lead_" + Date.now() + Math.random().toString(36).slice(2, 5);
      const now = new Date().toISOString();
      const leadData: any = {
        id: leadId, created_at: now, updated_at: now,
        status: "new", quality: "pending",
        stats: JSON.stringify({ visits_planned: 0, visits_done: 0, calls_attempted: 0, calls_answered: 0, followups_done: 0 }),
        source: parsedConfig.name, projectId: parsedConfig.projectId,
        assignedTo: assignedUserId || null,
      };

      const mapping = parsedConfig.mapping || {};
      Object.entries(mapping as Record<string, string>).forEach(([pk, lk]) => {
        let val = payload[pk] !== undefined ? payload[pk] : "";
        if (lk === "mobile") val = normalizePhoneNumber(String(val));
        leadData[lk] = val;
      });

      const existing = await queryOne<any>("SELECT id, created_at FROM leads WHERE mobile = ?", [leadData.mobile || ""]);
      if (existing) {
        leadData.id = existing.id;
        leadData.created_at = existing.created_at;
      }

      await pool.execute(
        `INSERT INTO leads (id,name,mobile,source,quality,status,projectId,assignedTo,stats,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name),mobile=VALUES(mobile),source=VALUES(source),updated_at=NOW()`,
        [leadData.id, leadData.name||"Unknown", leadData.mobile||null, leadData.source, leadData.quality, leadData.status, leadData.projectId, leadData.assignedTo, leadData.stats, formatMySQLDate(leadData.created_at), formatMySQLDate(now)]
      );

      res.json({ success: true, leadId: leadData.id });
    } catch (e: any) {
      console.error("Webhook error:", e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post("/api/webhooks/:token", handleWebhook);
  app.get("/api/webhooks/:token", handleWebhook);

  // -- WHATSAPP WEBHOOK ------------------------------------
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const { event, data } = req.body;
      if (event !== "message") return res.json({ success: true });

      const { senderName, senderPhoneNumber, recipientPhoneNumberId, content } = data;
      const messageText = content?.text || "";
      const normalizedMobile = normalizePhoneNumber(String(senderPhoneNumber));

      const mappingTable: Record<string, { projectId: string; userName: string }> = {
        "916390071558584":   { projectId: "p3", userName: "Hemant" },
        "122101071140010719":{ projectId: "p4", userName: "Vani" },
        "1152168267972565":  { projectId: "p2", userName: "Megha" },
      };

      const mapping = mappingTable[recipientPhoneNumberId];
      if (!mapping) return res.status(404).json({ error: "Project mapping not found" });

      const { projectId, userName } = mapping;
      const now = new Date().toISOString();
      const dateOnly = now.split("T")[0];

      let clientName = String(senderName || "WhatsApp Contact").trim()
        .split(" ").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(" ");

      const targetUser = await queryOne<any>("SELECT * FROM users WHERE LOWER(name) LIKE ?", [`%${userName.toLowerCase()}%`]);
      const assignedUserId = targetUser?.id || null;

      const existingLead = await queryOne<any>("SELECT * FROM leads WHERE mobile = ?", [normalizedMobile]);

      const msgId = "msg_" + Date.now();
      await pool.execute(
        `INSERT IGNORE INTO whatsapp_messages (id,leadId,senderName,senderPhoneNumber,content,timestamp,type,projectId) VALUES (?,?,?,?,?,?,?,?)`,
        [msgId, existingLead?.id || null, clientName, normalizedMobile, messageText, formatMySQLDate(now), "incoming", projectId]
      );

      if (existingLead) {
        const leadId = existingLead.id;
        const existingFup = await queryOne<any>("SELECT id FROM followups WHERE leadId = ? AND date = ? AND method = 'WhatsApp'", [leadId, dateOnly]);

        if (!existingFup) {
          const fupId = "fup_" + Date.now();
          await pool.execute(
            `INSERT INTO followups (id,leadId,projectId,date,scheduled_at,purpose,method,status,created_at,outcome_note) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [fupId, leadId, projectId, dateOnly, formatMySQLDate(now), `Re-enquiry via WhatsApp`, "WhatsApp", "pending", formatMySQLDate(now), `Client: ${messageText}`]
          );
        }
        await pool.execute("UPDATE leads SET updated_at = NOW() WHERE id = ?", [leadId]);
        return res.json({ success: true, leadId, action: "followup_created" });
      } else {
        const leadId = "lead_" + Date.now();
        await pool.execute(
          `INSERT INTO leads (id,name,mobile,source,quality,status,projectId,assignedTo,stats,created_at,updated_at,property_interest) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [leadId, clientName, normalizedMobile, "WhatsApp", "warm", "new", projectId, assignedUserId, JSON.stringify({ visits_planned:0, visits_done:0, calls_attempted:0, calls_answered:0, followups_done:0 }), formatMySQLDate(now), formatMySQLDate(now), messageText]
        );
        
        // Log lead creation as an explicit activity
        await pool.execute(
          `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,?,?)`,
          ["act_" + Date.now(), "lead_created", 0, "System (WhatsApp)", projectId, leadId, clientName, formatMySQLDate(now), `Via WhatsApp: ${messageText.substring(0,50)}`]
        );

        const fupId = "fup_" + Date.now();
        await pool.execute(
          `INSERT INTO followups (id,leadId,projectId,date,scheduled_at,purpose,method,status,created_at,outcome_note) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [fupId, leadId, projectId, dateOnly, formatMySQLDate(now), `New WhatsApp enquiry`, "WhatsApp", "pending", formatMySQLDate(now), `Client: ${messageText}`]
        );
        await pool.execute("UPDATE whatsapp_messages SET leadId = ? WHERE id = ?", [leadId, msgId]);
        return res.json({ success: true, leadId, action: "lead_created" });
      }
    } catch (e: any) {
      console.error("[WhatsApp Webhook] ERROR:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok", db: "mysql", ts: new Date().toISOString() }));

  // -- REPORTS --------------------------------------------
  app.get("/api/reports/status", authMiddleware, async (req, res) => {
    try { res.json(await getReportStats()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/reports/trigger", authMiddleware, async (req, res) => {
    const { type } = req.body;
    try {
      if (type === "daily") await generateDailyMISReport();
      else if (type === "weekend") await generateWeekendMISReport();
      else return res.status(400).json({ error: "Invalid type" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // -- ATTENDANCE MAINTENANCE (every 15 min) --------------
  async function runAttendanceMaintenance() {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const users = await query<any>("SELECT * FROM users");
      const attendance = await query<any>("SELECT * FROM attendance WHERE date = ?", [todayStr]);
      for (const user of users) {
        const schedule = user.workingHours ? (typeof user.workingHours === "string" ? JSON.parse(user.workingHours) : user.workingHours) : { start: "10:00", end: "19:00" };
        const [sH, sM] = schedule.start.split(":").map(Number);
        const [eH, eM] = schedule.end.split(":").map(Number);
        const startMins = sH * 60 + sM, endMins = eH * 60 + eM;
        const record = attendance.find((a: any) => a.userId === user.id);
        const notifId = `missed_in_${user.id}_${todayStr}`;
        if (!record && currentTime > startMins + 30) {
          const existing = await queryOne("SELECT id FROM notifications WHERE id = ?", [notifId]);
          if (!existing) {
            await pool.execute(
              `INSERT IGNORE INTO notifications (id,userId,type,title,message,\`read\`,createdAt,isAdmin,date) VALUES (?,?,?,?,?,0,?,1,?)`,
              [notifId, user.id, "MISSED_PUNCH_IN", "Missed Clock-In", `${user.name} has not clocked in. (Scheduled: ${schedule.start})`, now.toISOString(), todayStr]
            );
          }
        }
        if (record && record.checkIn && !record.checkOut && currentTime > endMins + 60) {
          const checkIn = typeof record.checkIn === "string" ? JSON.parse(record.checkIn) : record.checkIn;
          if (checkIn) {
            const forcedTime = new Date(); forcedTime.setHours(eH, eM, 0, 0);
            const co = JSON.stringify({ time: forcedTime.toISOString(), lat: 0, lng: 0, forced: true });
            await execute("UPDATE attendance SET checkOut = ?, status = 'missed_punch' WHERE id = ?", [co, record.id]);
          }
        }
      }
    } catch (e) { console.error("[Attendance Maintenance]", e); }
  }
  setInterval(runAttendanceMaintenance, 15 * 60 * 1000);

  // -- REMINDER MAINTENANCE (every 10 min) ----------------
  async function runReminderMaintenance() {
    try {
      const now = new Date();
      const upcoming = new Date(now.getTime() + 60 * 60 * 1000);
      const thirtyAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const fups = await query<any>("SELECT * FROM followups WHERE status = 'pending'");
      for (const fup of fups) {
        if (!fup.scheduled_at) continue;
        const fupDate = new Date(fup.scheduled_at);
        if (fupDate <= upcoming && fupDate >= thirtyAgo) {
          const notifId = `fup_remind_${fup.id}`;
          const existing = await queryOne("SELECT id FROM notifications WHERE id = ?", [notifId]);
          if (!existing) {
            await pool.execute(
              `INSERT IGNORE INTO notifications (id,userId,type,title,message,\`read\`,createdAt,isAdmin) VALUES (?,?,?,?,?,0,?,?)`,
              [notifId, fup.userId||null, "FOLLOW_UP_REMINDER", "Follow-up Due Soon", `Reminder: ${fup.purpose}`, now.toISOString(), fup.userId?0:1]
            );
          }
        }
      }
      const visits = await query<any>("SELECT * FROM visits WHERE visit_status = 'scheduled'");
      for (const v of visits) {
        if (!v.visit_date) continue;
        const vDate = new Date(`${v.visit_date}T${v.visit_time||"10:00"}`);
        const twoHr = new Date(now.getTime() + 120 * 60 * 1000);
        if (vDate <= twoHr && vDate >= thirtyAgo) {
          const notifId = `visit_remind_${v.id}`;
          const existing = await queryOne("SELECT id FROM notifications WHERE id = ?", [notifId]);
          if (!existing) {
            await pool.execute(
              `INSERT IGNORE INTO notifications (id,userId,type,title,message,\`read\`,createdAt,isAdmin,metadata) VALUES (?,?,?,?,?,0,?,?,?)`,
              [notifId, v.assigned_to||null, "VISIT_REMINDER", "Site Visit Reminder", `Upcoming visit with ${v.client_name} at ${v.visit_time}`, now.toISOString(), v.assigned_to?0:1, JSON.stringify({ visitId: v.id })]
            );
          }
          if (v.email) {
            const emailHtml = `<h3>Site Visit Reminder</h3><p>Dear ${v.client_name},</p><p>Your site visit is today at <b>${v.visit_time}</b>. We look forward to seeing you!</p>`;
            await sendCustomEmail(v.email, "Site Visit Reminder", emailHtml);
          }
        }
      }
    } catch (e) { console.error("[Reminder Maintenance]", e); }
  }
  setInterval(runReminderMaintenance, 10 * 60 * 1000);

  // -- VITE / STATIC SERVE --------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT} (MySQL mode)`);
    setDbPool(pool);
    setupMISReports();
    runAttendanceMaintenance();
    runReminderMaintenance();
  });
}

startServer().catch(async (err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
