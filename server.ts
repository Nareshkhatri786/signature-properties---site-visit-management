import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, query, queryOne, execute, parseJsonFields, stringifyJsonFields, testConnection } from "./db.js";
import { setupMISReports, generateDailyMISReport, generateWeekendMISReport, generateMonthlyDetailedMISReport, setDbPool, getReportStats, sendCustomEmail } from "./reportService.js";
import { normalizePhoneNumber } from "./src/lib/phoneUtils.js";
import webPush from "web-push";
import { Server } from "socket.io";
import { createServer } from "http";
import { processIncomingWhatsAppMessage } from "./src/lib/whatsapp-ai-bot.js";
import { WhatsAppService } from "./src/lib/whatsapp-service.js";

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

const cleanSqlId = (id: any) => (id === null || id === undefined || String(id) === "null" || String(id) === "undefined" || String(id).trim() === "") ? null : id;
const ALLOWED_FOLLOWUP_METHODS = new Set(["call", "whatsapp", "email", "in_person"]);
const ALLOWED_FOLLOWUP_STATUSES = new Set(["pending", "completed", "cancelled"]);
const ALLOWED_VISIT_STATUSES = new Set(["scheduled", "reminder_sent", "confirmed", "rescheduled", "no_show", "arrived", "completed", "cancelled"]);
const ALLOWED_LEAD_STATUSES = new Set(["new", "contacted", "visit_scheduled", "visit_done", "closed", "lost"]);
const ALLOWED_LEAD_QUALITIES = new Set(["hot", "warm", "cold", "pending", "disq"]);
const ALLOWED_CALL_OUTCOMES = new Set(["answered", "not_answered", "busy", "switched_off"]);

const getSafeId = async (table: string, id: any) => {
  const cleanId = cleanSqlId(id);
  if (!cleanId) return null;
  try {
    const [rows] = await pool.execute(`SELECT id FROM ${table} WHERE id = ?`, [cleanId]);
    return (rows as any[]).length > 0 ? cleanId : null;
  } catch (e) {
    console.error(`[DB] getSafeId error for ${table}:`, e);
    return null;
  }
};

// Helper to format ISO dates for MySQL
function formatMySQLDate(isoString: string | null) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

function formatMySQLDateOnly(isoString: string | null) {
  if (!isoString) return null;
  try {
    // For DATE columns, we only need YYYY-MM-DD
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.split('T')[0]; // Fallback if Date parsing fails but string has T
    return d.toISOString().split('T')[0];
  } catch {
    if (typeof isoString === 'string' && isoString.includes('T')) {
      return isoString.split('T')[0];
    }
    return null;
  }
}

const OPEN_WINDOW_GREETINGS = [
  "Good morning Sir/Madam. Hope you are doing well. Aaj aapko project related koi update chahiye ho to main turant share kar sakta hoon.",
  "Jay Shree Krishna Sir. Kem chho? Royal Rudraksha vishe short update joiye to hu havej mokli dau.",
  "Namaste Sir/Madam. Aapki convenience ke hisaab se aaj ek short site visit slot arrange kar sakte hain.",
  "Good morning. Premium family homes ke latest availability aur visit slots ready hain, jab aap bolo share kar deta hoon.",
  "Jay Shree Krishna. Aaje sanje 5-7 athva kal savare 11-1 maathi koi slot comfortable hoy to janavo."
];

function isWithin24hWindow(lastClientReplyAt: any) {
  if (!lastClientReplyAt) return false;
  const d = new Date(lastClientReplyAt);
  if (isNaN(d.getTime())) return false;
  return ((Date.now() - d.getTime()) / (1000 * 60 * 60)) < 24;
}

function pickRotatingGreeting(seed: string) {
  const daySeed = new Date().toISOString().slice(0, 10);
  const raw = `${seed || ""}_${daySeed}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i);
  const idx = Math.abs(hash) % OPEN_WINDOW_GREETINGS.length;
  return OPEN_WINDOW_GREETINGS[idx];
}

function normalizeFollowUpMethod(method: any) {
  const normalized = String(method || "call").toLowerCase().trim();
  return ALLOWED_FOLLOWUP_METHODS.has(normalized) ? normalized : "call";
}

function normalizeSetValue(value: any, allowed: Set<string>, fallback: string) {
  const normalized = String(value || "").toLowerCase().trim();
  return allowed.has(normalized) ? normalized : fallback;
}

// -- OWNERSHIP SYNC HELPERS -----------------------------
async function syncLeadOwnership(leadId: string, newUserId: number | null) {
  if (!newUserId) {
    // If unassigned, we could optionally unassign related data, 
    // but usually, it's better to keep the last owner or set to null.
    // Industry practice: set related pending tasks to null or keep them with last owner.
    // Here we will set to NULL to match lead status.
    await execute("UPDATE followups SET userId = NULL, userName = NULL WHERE leadId = ? AND status = 'pending'", [leadId]);
    await execute("UPDATE visits SET assigned_to = NULL WHERE leadId = ? AND visit_status IN ('scheduled', 'rescheduled')", [leadId]);
    return;
  }
  
  try {
    const user = await queryOne<any>("SELECT name FROM users WHERE id = ?", [newUserId]);
    if (!user) return;
    
    const userName = user.name;
    
    // Update ALL followups (as requested: "assign all follow ups to lead owner not who created this")
    await execute(
      "UPDATE followups SET userId = ?, userName = ? WHERE leadId = ?",
      [newUserId, userName, leadId]
    );
    
    // Update ALL visits
    await execute(
      "UPDATE visits SET assigned_to = ? WHERE leadId = ?",
      [userName, leadId]
    );
    
    console.log(`[Sync] Reassigned lead ${leadId} all data to user ${userName} (${newUserId})`);
  } catch (err) {
    console.error(`[Sync Error] Failed to sync ownership for lead ${leadId}:`, err);
  }
}

// Optimized: fetch only the columns we actually need to avoid full-row transfer
async function ensurePendingFollowup(leadId: string, userId: number | null, projectId: string | null) {
  if (!userId) return;
  
  try {
    // Parallel: check lead status AND existing followup AT THE SAME TIME
    const [leadRow, existingFup] = await Promise.all([
      queryOne<any>("SELECT status FROM leads WHERE id = ?", [leadId]),
      queryOne<any>("SELECT id FROM followups WHERE leadId = ? AND status = 'pending' LIMIT 1", [leadId]),
    ]);
    if (leadRow?.status === 'lost') return;
    if (existingFup) return; // already has pending followup

    const user = await queryOne<any>("SELECT name FROM users WHERE id = ?", [userId]);
    const userName = user?.name || "Assigned User";
    
    const fupId = `fup_auto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const dateOnly = scheduledAt.split('T')[0];
    
    await execute(
      `INSERT INTO followups (id, leadId, projectId, userId, userName, date, scheduled_at, purpose, method, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'call', 'pending', NOW())`,
      [fupId, leadId, projectId, userId, userName, dateOnly, formatMySQLDate(scheduledAt), "Auto-generated Follow-up"]
    );
    console.log(`[Auto-FUP] Created for lead ${leadId} assigned to ${userName}`);
  } catch (err) {
    console.error(`[Auto-FUP Error] Failed for lead ${leadId}:`, err);
  }
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    console.log(`[Auth] Missing or invalid header for ${req.url}`);
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.log(`[Auth] Token verification failed for ${req.url}:`, err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = parseInt(process.env.PORT || "3000");

  // Track connected users
  const userSockets = new Map<string, string[]>();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    if (userId) {
      const current = userSockets.get(String(userId)) || [];
      userSockets.set(String(userId), [...current, socket.id]);
      console.log(`[Socket] User ${userId} connected (${socket.id})`);
    }

    socket.on("disconnect", () => {
      if (userId) {
        const current = userSockets.get(String(userId)) || [];
        userSockets.set(String(userId), current.filter(id => id !== socket.id));
        console.log(`[Socket] User ${userId} disconnected`);
      }
    });
  });

  // Global emitter helper — DEBOUNCED to prevent Socket.io broadcast storms
  // If the same collection is updated multiple times within 300ms, only 1 broadcast fires
  const pendingEmits = new Map<string, ReturnType<typeof setTimeout>>();
  const notifyChanges = (type: string, data: any, targetUserId?: string) => {
    const key = targetUserId ? `${type}:${targetUserId}` : type;
    const existing = pendingEmits.get(key);
    if (existing) clearTimeout(existing);
    pendingEmits.set(key, setTimeout(() => {
      pendingEmits.delete(key);
      if (targetUserId) {
        io.to(targetUserId).emit("data_update", { type, data });
      } else {
        io.emit("data_update", { type, data });
      }
    }, 300)); // 300ms debounce
  };

  // Inject io into app for routes
  (app as any).io = io;
  (app as any).notifyChanges = notifyChanges;

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

  // -- AI CHATBOT (GOOGLE GEMINI) ---------------------------
  app.post("/api/ai/ask", authMiddleware, async (req, res) => {
    const { prompt, context } = req.body;
    try {
      const { askGemini } = await import('./gemini-service.js');
      const response = await askGemini(prompt, context || "");
      res.json({ response });
    } catch (e: any) {
      console.error("[AI Ask] Error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });


  // -- WHATSAPP WEBHOOK (WAOFFICIAL) -----------------------
  // GET: Webhook verification by the provider
  app.get("/api/webhook/whatsapp", (req, res) => {
    const verify_token = process.env.WEBHOOK_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === verify_token) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
      } else {
        return res.sendStatus(403);
      }
    }
    return res.status(200).send("Webhook is alive");
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

      const whereClause = isAdmin ? "WHERE 1=1" : "WHERE projectId = ?";
      const [statusStats, qualityStats, todayLeads] = await Promise.all([
        query(`SELECT status, COUNT(*) as count FROM leads ${whereClause} GROUP BY status`, params),
        query(`SELECT quality, COUNT(*) as count FROM leads ${whereClause} GROUP BY quality`, params),
        queryOne(`SELECT COUNT(*) as count FROM leads ${whereClause} AND created_at >= CURDATE()`, params)
      ]);

      res.json({ statusStats, qualityStats, todayCount: (todayLeads as any)?.count || 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/data", authMiddleware, async (req, res) => {
    try {
      const uToken = (req as any).user;
      const userFromDb = await queryOne<any>("SELECT * FROM users WHERE id = ?", [uToken.id]);
      if (!userFromDb) return res.status(401).json({ error: "User not found" });

      const uRole = userFromDb.role?.toLowerCase();
      const isAdmin = uRole === "admin" || uRole === "adm";
      const isManager = uRole === "manager";

      // For managers: get their assignedProjectIds
      const managerUser = parseJsonFields({ ...userFromDb }, JSON_FIELDS_USERS);
      const managedProjectIds: string[] = isManager
        ? (managerUser.assignedProjectIds || (managerUser.projectId ? [managerUser.projectId] : []))
        : [];

      // Build lead/visit filter:
      // - Admin: no filter
      // - Manager: leads from any of their managed projects
      // - User: leads from their own project OR leads directly assigned to them
      let leadQuery: string;
      let leadParams: any[];

      if (isAdmin) {
        leadQuery = "SELECT * FROM leads ORDER BY updated_at DESC LIMIT 5000";
        leadParams = [];
      } else if (isManager && managedProjectIds.length > 0) {
        const placeholders = managedProjectIds.map(() => '?').join(',');
        leadQuery = `SELECT * FROM leads WHERE (projectId IN (${placeholders}) OR assignedTo = ?) ORDER BY updated_at DESC LIMIT 5000`;
        leadParams = [...managedProjectIds, userFromDb.id];
      } else {
        // Regular user: see their project's leads + leads directly assigned to them
        leadQuery = "SELECT * FROM leads WHERE (projectId = ? OR assignedTo = ?) ORDER BY updated_at DESC LIMIT 5000";
        leadParams = [userFromDb.projectId, userFromDb.id];
      }

      // Build visit/followup filter:
      // Users should see tasks for their own project OR tasks linked to leads they own
      let taskQueryFilter: string;
      let taskParams: any[];

      if (isAdmin) {
        taskQueryFilter = "";
        taskParams = [];
      } else if (isManager && managedProjectIds.length > 0) {
        const placeholders = managedProjectIds.map(() => '?').join(',');
        taskQueryFilter = `WHERE (f.projectId IN (${placeholders}) OR l.assignedTo = ?)`;
        taskParams = [...managedProjectIds, userFromDb.id];
      } else {
        taskQueryFilter = `WHERE (f.projectId = ? OR l.assignedTo = ?)`;
        taskParams = [userFromDb.projectId, userFromDb.id];
      }

      const safeCurrentUser = parseJsonFields({ ...userFromDb }, JSON_FIELDS_USERS);
      delete safeCurrentUser.password;

      console.log(`[Data Debug] User: ${userFromDb.username}, Role: ${userFromDb.role}, isAdmin: ${isAdmin}`);

      const [users, projects, leads, visits, followups, activities, call_logs, templates, webhook_configs, notifications, attendance, workflows, inventory_units, settingsRow] = await Promise.all([
        // Only fetch columns needed by the frontend — avoids SELECT * overhead
        query("SELECT id, username, name, role, projectId, assignedProjectIds, workingHours, assignedLocation FROM users"),
        query("SELECT id, name, description, location, brochure_link, walkthrough_video, sample_house_video, testimonial_video, google_maps_link, ai_rules FROM projects"),
        query(leadQuery, leadParams),
        query(`SELECT v.id, v.leadId, v.client_name, v.mobile, v.email, v.visit_date, v.visit_time, v.purpose, v.status, v.visit_status, v.assigned_to, v.source, v.budget, v.property_interest, v.priority, v.projectId, v.reminders_sent, v.client_feedback, v.interest_level, v.outcome, v.reschedule_log, v.completed_at, v.created_at FROM visits v LEFT JOIN leads l ON v.leadId = l.id ${taskQueryFilter.replace(/f\./g, 'v.')} ORDER BY v.visit_date DESC LIMIT 2000`, taskParams),
        query(`SELECT f.id, f.leadId, f.visitId, f.projectId, f.userId, f.userName, f.date, f.scheduled_at, f.purpose, f.method, f.status, f.created_at, f.completed_at, f.outcome_note FROM followups f LEFT JOIN leads l ON f.leadId = l.id ${taskQueryFilter} ORDER BY f.date DESC LIMIT 2000`, taskParams),
        query(`SELECT a.id, a.type, a.userId, a.userName, a.projectId, a.targetId, a.targetName, a.timestamp, a.details FROM activities a LEFT JOIN leads l ON a.targetId = l.id ${taskQueryFilter.replace(/f\./g, 'a.')} ORDER BY a.timestamp DESC LIMIT 1000`, taskParams),
        query(`SELECT c.id, c.visitId, c.leadId, c.projectId, c.outcome, c.note, c.timestamp, c.by FROM call_logs c LEFT JOIN leads l ON c.leadId = l.id ${taskQueryFilter.replace(/f\./g, 'c.')} ORDER BY c.timestamp DESC LIMIT 1000`, taskParams),
        query("SELECT id, name, type, message, fileName, fileType, active FROM templates"),
        query("SELECT id, name, token, projectId, assignedTo, assignedUserIds, lastAssignedIndex, mapping, active FROM webhook_configs"),
        query("SELECT id, userId, type, title, message, `read`, createdAt, isAdmin, metadata, date FROM notifications WHERE (userId = ? OR isAdmin = 1) ORDER BY createdAt DESC LIMIT 200", [userFromDb.id]),
        query(isAdmin ? "SELECT id, userId, date, checkIn, checkOut, status FROM attendance ORDER BY date DESC LIMIT 300" : "SELECT id, userId, date, checkIn, checkOut, status FROM attendance WHERE userId = ? ORDER BY date DESC LIMIT 300", isAdmin ? [] : [userFromDb.id]),
        query("SELECT id, name, description, isActive, `trigger`, conditions, actions, createdAt, updatedAt FROM workflows"),
        query(`SELECT id, projectId, unitCode, unitTitle, inventoryUrl, status, shortlistedByLeadId, shortlistedByVisitId, note, updatedByUserId, updatedByUserName, created_at, updated_at FROM inventory_units ${isAdmin ? "" : "WHERE projectId = ?"} ORDER BY updated_at DESC`, isAdmin ? [] : [userFromDb.projectId]),
        queryOne("SELECT * FROM settings WHERE id = 'main'"),
      ]);

      console.log(`[Data Debug] User: ${userFromDb.username}, Role: ${userFromDb.role}, Leads: ${leads.length}, Users: ${users.length}, Projects: ${projects.length}`);
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
        notifications, webhook_configs, settings, workflows,
        inventory_units,
        currentUser: safeCurrentUser
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
        
        // 1. Check current assignment to detect change
        const currentLead = await queryOne<any>("SELECT assignedTo, projectId, status, quality FROM leads WHERE id = ?", [d.id]);
        const isAssignmentChanged = currentLead && currentLead.assignedTo != d.assignedTo;
        const isNewLead = !currentLead;
        const leadStatus = normalizeSetValue(d.status, ALLOWED_LEAD_STATUSES, currentLead?.status || "new");
        const leadQuality = normalizeSetValue(d.quality, ALLOWED_LEAD_QUALITIES, currentLead?.quality || "pending");

        // 2. Save/Update lead
        await pool.execute(
          `INSERT INTO leads (id,name,mobile,email,source,quality,status,budget,property_interest,priority,projectId,assignedTo,stats,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name),mobile=VALUES(mobile),email=VALUES(email),source=VALUES(source),quality=VALUES(quality),status=VALUES(status),budget=VALUES(budget),property_interest=VALUES(property_interest),priority=VALUES(priority),assignedTo=VALUES(assignedTo),stats=VALUES(stats),updated_at=NOW()`,
          [d.id,d.name,d.mobile||null,d.email||null,d.source||null,leadQuality,leadStatus,d.budget||null,d.property_interest||null,d.priority||0,cleanSqlId(d.projectId),cleanSqlId(d.assignedTo),d.stats||null,formatMySQLDate(d.created_at),new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );

        // 3. Sync ownership if changed or new
        if (isAssignmentChanged || (isNewLead && d.assignedTo)) {
          await syncLeadOwnership(d.id, d.assignedTo);
        }

        // 4. AUTO FOLLOW-UP LOGIC: Ensure a pending follow-up exists if assigned
        if (leadStatus === "lost") {
          // If lost, remove all pending followups
          await execute("DELETE FROM followups WHERE leadId = ? AND status = 'pending'", [d.id]);
          console.log(`[Lost Lead] Cleaned up followups for ${d.id}`);
        } else if (d.assignedTo) {
          await ensurePendingFollowup(d.id, d.assignedTo, d.projectId || (currentLead?.projectId));
        } else if (isNewLead && leadStatus === "new") {
          // Fallback for unassigned new leads: create a system follow-up
          const fupId = `fup_auto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
          const tenMinsLater = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          await pool.execute(
            `INSERT IGNORE INTO followups (id, leadId, projectId, date, scheduled_at, purpose, method, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'call', 'pending', NOW())`,
            [fupId, d.id, d.projectId, tenMinsLater.split('T')[0], formatMySQLDate(tenMinsLater), `Welcome call for ${d.source || 'New'} Lead`]
          );
        }
        (app as any).notifyChanges("leads", d);
      } else if (col === "visits") {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const d = stringifyJsonFields(data, JSON_FIELDS_VISITS);
          const [existingVisitRows] = await connection.execute("SELECT visit_status FROM visits WHERE id = ?", [d.id]);
          const prevVisitStatus = (existingVisitRows as any[]).length > 0 ? (existingVisitRows as any[])[0].visit_status : null;
          const visitStatus = normalizeSetValue(d.visit_status, ALLOWED_VISIT_STATUSES, "scheduled");
          const visitLeadQuality = normalizeSetValue(d.status, ALLOWED_LEAD_QUALITIES, "pending");
          
          // 1. Save/Update Visit
          await connection.execute(
            `INSERT INTO visits (id,leadId,client_name,mobile,email,visit_date,visit_time,purpose,status,visit_status,assigned_to,source,budget,property_interest,priority,projectId,reminders_sent,client_feedback,interest_level,outcome,reschedule_log,completed_at,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE leadId=VALUES(leadId),client_name=VALUES(client_name),mobile=VALUES(mobile),email=VALUES(email),visit_date=VALUES(visit_date),visit_time=VALUES(visit_time),purpose=VALUES(purpose),status=VALUES(status),visit_status=VALUES(visit_status),assigned_to=VALUES(assigned_to),source=VALUES(source),budget=VALUES(budget),property_interest=VALUES(property_interest),priority=VALUES(priority),reminders_sent=VALUES(reminders_sent),client_feedback=VALUES(client_feedback),interest_level=VALUES(interest_level),outcome=VALUES(outcome),reschedule_log=VALUES(reschedule_log),completed_at=VALUES(completed_at)`,
            [d.id,cleanSqlId(d.leadId),d.client_name,d.mobile||null,d.email||null,formatMySQLDateOnly(d.visit_date),d.visit_time||null,d.purpose||null,visitLeadQuality,visitStatus,d.assigned_to||null,d.source||null,d.budget||null,d.property_interest||null,d.priority||0,cleanSqlId(d.projectId),d.reminders_sent||null,d.client_feedback||null,d.interest_level||null,d.outcome||null,d.reschedule_log||null,formatMySQLDate(d.completed_at),formatMySQLDate(d.created_at || new Date().toISOString())]
          );

          // 2. If Visit is Completed, Sync with Lead
          if (visitStatus === "completed" && prevVisitStatus !== "completed" && d.leadId) {
            // Get current lead stats
            const [leads] = await connection.execute("SELECT stats, quality, status FROM leads WHERE id = ?", [d.leadId]);
            if ((leads as any[]).length > 0) {
              const lead = (leads as any[])[0];
              let stats = lead.stats;
              if (typeof stats === 'string') stats = JSON.parse(stats);
              if (!stats) stats = { visits_planned: 0, visits_done: 0, calls_attempted: 0, calls_answered: 0, followups_done: 0 };
              
              stats.visits_done = (stats.visits_done || 0) + 1;
              
              // Logic: If visits > 1, auto-hot. Else warm.
              let newQuality = lead.quality;
              if (stats.visits_done > 1) newQuality = 'hot';
              else if (newQuality === 'pending' || newQuality === 'cold') newQuality = 'warm';

              await connection.execute(
                "UPDATE leads SET status = 'visit_done', quality = ?, stats = ?, updated_at = NOW() WHERE id = ?", 
                [newQuality, JSON.stringify(stats), d.leadId]
              );

              // Log Activity
              const activityId = `act_vis_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
              await connection.execute(
                `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
                [activityId, 'visit_completed', null, d.assigned_to||'System', d.projectId||null, d.leadId, d.client_name, `Visit status transition: ${prevVisitStatus || 'new'} -> completed. Total visits: ${stats.visits_done}. Lead upgraded to ${newQuality}.`]
              );
            }
          } else if (visitStatus === "completed" && prevVisitStatus === "completed" && d.leadId) {
            const activityId = `act_guard_vis_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            await connection.execute(
              `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
              [activityId, 'lifecycle_guard', null, d.assigned_to||'System', d.projectId||null, d.leadId, d.client_name, `Visit status transition ignored: completed -> completed. Counters were not changed.`]
            );
          } else if (d.leadId) {
            // Log visit scheduled/updated
            const activityId = `act_vis_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            const visitActivityType =
              visitStatus === 'rescheduled' ? 'visit_rescheduled'
              : visitStatus === 'no_show' ? 'visit_no_show'
              : 'visit_scheduled';
            await connection.execute(
              `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
              [activityId, visitActivityType, null, d.assigned_to||'System', d.projectId||null, d.leadId, d.client_name, `Visit status transition: ${prevVisitStatus || 'new'} -> ${visitStatus}. Date: ${d.visit_date} ${d.visit_time || ''}`]
            );
          }

          await connection.commit();
        } catch (err) {
          await connection.rollback();
          console.error("[Visit Save Error]:", err);
          throw err;
        } finally {
          connection.release();
        }
        (app as any).notifyChanges("visits", data);
      } else if (col === "followups") {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          console.log(`[Follow-up] Processing save for ID: ${data.id}, Status: ${data.status}`);
          const [existingFollowupRows] = await connection.execute("SELECT status, leadId, date, scheduled_at FROM followups WHERE id = ?", [data.id]);
          const prevFollowupStatus = (existingFollowupRows as any[]).length > 0 ? (existingFollowupRows as any[])[0].status : null;
          const prevFollowupLeadId = (existingFollowupRows as any[]).length > 0 ? (existingFollowupRows as any[])[0].leadId : null;
          const prevFollowupDate = (existingFollowupRows as any[]).length > 0 ? formatMySQLDateOnly((existingFollowupRows as any[])[0].date) : null;
          const followupStatus = normalizeSetValue(data.status, ALLOWED_FOLLOWUP_STATUSES, "pending");
          const followupDate = formatMySQLDateOnly(data.date);
          
          // 1. Validate Foreign Keys before insert/update (parallel for speed)
          const [safeLeadId, safeVisitId, safeProjectId, safeUserId] = await Promise.all([
            getSafeId('leads', data.leadId),
            getSafeId('visits', data.visitId),
            getSafeId('projects', data.projectId),
            getSafeId('users', data.userId),
          ]);

          await connection.execute(
            `INSERT INTO followups (id,leadId,visitId,projectId,userId,userName,date,scheduled_at,purpose,method,status,created_at,completed_at,outcome_note)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE leadId=VALUES(leadId),visitId=VALUES(visitId),projectId=VALUES(projectId),userId=VALUES(userId),userName=VALUES(userName),date=VALUES(date),scheduled_at=VALUES(scheduled_at),purpose=VALUES(purpose),method=VALUES(method),status=VALUES(status),completed_at=VALUES(completed_at),outcome_note=VALUES(outcome_note)`,
            [data.id,safeLeadId,safeVisitId,safeProjectId,safeUserId,data.userName||null,followupDate,formatMySQLDate(data.scheduled_at),data.purpose||null,normalizeFollowUpMethod(data.method),followupStatus,formatMySQLDate(data.created_at || new Date().toISOString()),formatMySQLDate(data.completed_at),data.outcome_note||null]
          );

          // 2. If status is 'completed', handle Lead stats and Activity Log
          if (followupStatus === "completed" && prevFollowupStatus !== "completed") {
            // Ensure we have leadId (sometimes frontend sends partial updates)
            let effectiveLeadId = data.leadId || prevFollowupLeadId;
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
                [activityId, 'followup_done', uId, data.userName||null, data.projectId||null, effectiveLeadId, data.clientName||'Lead', `Follow-up status transition: ${prevFollowupStatus || 'new'} -> completed. Outcome: ${data.outcome_note || 'Completed'}`]
              );
            }
          } else {
            const effectiveLeadId = data.leadId || prevFollowupLeadId;
            const uId = data.userId ? parseInt(String(data.userId)) : null;
            if (followupStatus === "completed" && prevFollowupStatus === "completed" && effectiveLeadId) {
              const activityId = `act_guard_fup_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
              await connection.execute(
                `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
                [activityId, 'lifecycle_guard', uId, data.userName||null, data.projectId||null, effectiveLeadId, data.clientName||'Lead', `Follow-up status transition ignored: completed -> completed. Counters were not changed.`]
              );
            } else if (prevFollowupStatus === "pending" && followupStatus === "pending" && prevFollowupDate && followupDate && prevFollowupDate !== followupDate && effectiveLeadId) {
              const activityId = `act_fup_res_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
              await connection.execute(
                `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
                [activityId, 'followup_rescheduled', uId, data.userName||null, data.projectId||null, effectiveLeadId, data.clientName||'Lead', `Follow-up status transition: pending -> pending rescheduled. Date: ${prevFollowupDate} -> ${followupDate}`]
              );
            } else if (followupStatus === "cancelled" && prevFollowupStatus !== "cancelled" && effectiveLeadId) {
              const activityId = `act_fup_cancel_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
              await connection.execute(
                `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
                [activityId, 'followup_cancelled', uId, data.userName||null, data.projectId||null, effectiveLeadId, data.clientName||'Lead', `Follow-up status transition: ${prevFollowupStatus || 'new'} -> cancelled. Reason: ${data.outcome_note || 'Not provided'}`]
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
          `INSERT INTO projects (id,name,description,location,sample_house_video,walkthrough_video,testimonial_video,brochure_link,google_maps_link,ai_rules) 
           VALUES (?,?,?,?,?,?,?,?,?,?) 
           ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),location=VALUES(location),
           sample_house_video=VALUES(sample_house_video),walkthrough_video=VALUES(walkthrough_video),
           testimonial_video=VALUES(testimonial_video),brochure_link=VALUES(brochure_link),
           google_maps_link=VALUES(google_maps_link),ai_rules=VALUES(ai_rules)`,
          [
            d.id, 
            d.name, 
            d.description||null, 
            d.location||null,
            d.sample_house_video||null,
            d.walkthrough_video||null,
            d.testimonial_video||null,
            d.brochure_link||null,
            d.google_maps_link||null,
            d.ai_rules||null
          ]
        );
      } else if (col === "settings") {
        const d = stringifyJsonFields(data, JSON_FIELDS_SETTINGS);
        await pool.execute(
          `INSERT INTO settings (id,company,phone,address,sources,budgets,propertyInterests) VALUES ('main',?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE company=VALUES(company),phone=VALUES(phone),address=VALUES(address),sources=VALUES(sources),budgets=VALUES(budgets),propertyInterests=VALUES(propertyInterests)`,
          [d.company||null,d.phone||null,d.address||null,d.sources||null,d.budgets||null,d.propertyInterests||null]
        );
      } else if (col === "inventory_units") {
        await pool.execute(
          `INSERT INTO inventory_units (id,projectId,unitCode,unitTitle,inventoryUrl,status,shortlistedByLeadId,shortlistedByVisitId,note,updatedByUserId,updatedByUserName,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE projectId=VALUES(projectId),unitCode=VALUES(unitCode),unitTitle=VALUES(unitTitle),inventoryUrl=VALUES(inventoryUrl),status=VALUES(status),shortlistedByLeadId=VALUES(shortlistedByLeadId),shortlistedByVisitId=VALUES(shortlistedByVisitId),note=VALUES(note),updatedByUserId=VALUES(updatedByUserId),updatedByUserName=VALUES(updatedByUserName),updated_at=VALUES(updated_at)`,
          [
            data.id,
            cleanSqlId(data.projectId),
            data.unitCode || null,
            data.unitTitle || null,
            data.inventoryUrl || null,
            normalizeSetValue(data.status, new Set(["available", "shortlisted", "hold", "sold", "booked"]), "shortlisted"),
            cleanSqlId(data.shortlistedByLeadId),
            cleanSqlId(data.shortlistedByVisitId),
            data.note || null,
            cleanSqlId(data.updatedByUserId),
            data.updatedByUserName || null,
            formatMySQLDate(data.created_at || new Date().toISOString()),
            formatMySQLDate(data.updated_at || new Date().toISOString())
          ]
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
        const callOutcome = normalizeSetValue(data.outcome, ALLOWED_CALL_OUTCOMES, "not_answered");
        await pool.execute(
          `INSERT INTO call_logs (id,visitId,leadId,projectId,outcome,note,timestamp,\`by\`) VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE outcome=VALUES(outcome),note=VALUES(note)`,
          [data.id,cleanSqlId(data.visitId),cleanSqlId(data.leadId),cleanSqlId(data.projectId),callOutcome,data.note||null,formatMySQLDate(data.timestamp || new Date().toISOString()),data.by||null]
        );
      } else if (col === "activities") {
        await pool.execute(
          `INSERT IGNORE INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,?,?)`,
          [data.id,data.type,cleanSqlId(data.userId),data.userName||null,cleanSqlId(data.projectId),cleanSqlId(data.targetId),data.targetName||null,formatMySQLDate(data.timestamp || new Date().toISOString()),data.details||null]
        );
      } else if (col === "attendance") {
        const d = stringifyJsonFields(data, JSON_FIELDS_ATTENDANCE);
        try {
          await pool.execute(
            `INSERT INTO attendance (id,userId,date,checkIn,checkOut,status) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE checkIn=VALUES(checkIn),checkOut=VALUES(checkOut),status=VALUES(status)`,
            [d.id, d.userId, formatMySQLDateOnly(d.date), d.checkIn||null, d.checkOut||null, d.status||"absent"]
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
          [d.id,d.userId||null,d.type||"",d.title||"",d.message||"",d.read?1:0,formatMySQLDate(d.createdAt||new Date().toISOString()),d.isAdmin?1:0,d.metadata||null,formatMySQLDateOnly(d.date)]
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
      (app as any).notifyChanges(col, data);
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
        notifications: "notifications", attendance: "attendance", workflows: "workflows",
        inventory_units: "inventory_units"
      };
      const table = tableMap[col];
      if (!table) return res.status(400).json({ error: "Unknown collection" });
      if (id === undefined) return res.status(400).json({ error: "ID cannot be undefined" });
      
      await execute(`DELETE FROM ${table} WHERE id = ?`, [id || null]);
      (app as any).notifyChanges(col, { id, deleted: true });
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

  app.post("/api/whatsapp/send", authMiddleware, async (req, res) => {
    try {
      const { leadId, visitId, to, type, text, mediaUrl, caption, fileName, fromPhoneId, projectId } = req.body || {};
      const messageType = String(type || "text").toLowerCase();
      if (!["text", "image", "video", "document"].includes(messageType)) {
        return res.status(400).json({ error: "Invalid type. Use text/image/video/document." });
      }

      let lead: any = null;
      let resolvedLeadId: string | null = cleanSqlId(leadId);
      let resolvedProjectId: string | null = cleanSqlId(projectId);
      let targetPhone = normalizePhoneNumber(String(to || ""));

      if (!resolvedLeadId && visitId) {
        const visit = await queryOne<any>("SELECT leadId, projectId, mobile FROM visits WHERE id = ? LIMIT 1", [visitId]);
        if (visit?.leadId) resolvedLeadId = String(visit.leadId);
        if (!resolvedProjectId && visit?.projectId) resolvedProjectId = String(visit.projectId);
        if (!targetPhone && visit?.mobile) targetPhone = normalizePhoneNumber(String(visit.mobile));
      }
      if (resolvedLeadId) {
        lead = await queryOne<any>("SELECT id, name, mobile, projectId, last_client_reply_at FROM leads WHERE id = ? LIMIT 1", [resolvedLeadId]);
        if (lead?.mobile && !targetPhone) targetPhone = normalizePhoneNumber(String(lead.mobile));
        if (!resolvedProjectId && lead?.projectId) resolvedProjectId = String(lead.projectId);
      }
      if (!targetPhone) return res.status(400).json({ error: "Recipient number missing." });

      const openWindow = isWithin24hWindow(lead?.last_client_reply_at);
      if (!openWindow) {
        return res.status(400).json({
          error: "24-hour window closed. Session messages/media are blocked. Wait for client reply or use approved template flow."
        });
      }

      let waRes: any = null;
      if (messageType === "text") {
        const msg = String(text || "").trim();
        if (!msg) return res.status(400).json({ error: "Text message is required." });
        waRes = await WhatsAppService.sendSessionMessage(targetPhone, msg, fromPhoneId);
      } else {
        const link = String(mediaUrl || "").trim();
        if (!link) return res.status(400).json({ error: "mediaUrl is required for image/video/document." });
        waRes = await WhatsAppService.sendMediaMessage(
          targetPhone,
          link,
          messageType as "image" | "video" | "document",
          String(caption || "").trim() || undefined,
          String(fileName || "").trim() || undefined,
          fromPhoneId
        );
      }

      if (!waRes?.success) {
        return res.status(502).json({ error: "WhatsApp send failed", providerError: waRes?.error || null });
      }

      const outMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const content = messageType === "text"
        ? String(text || "")
        : `[${messageType.toUpperCase()}] ${String(caption || "").trim() || ""} ${String(mediaUrl || "").trim()}`.trim();
      await pool.execute(
        `INSERT INTO whatsapp_messages (id,leadId,senderName,senderPhoneNumber,content,timestamp,type,projectId) VALUES (?,?,?,?,?,?,?,?)`,
        [outMsgId, resolvedLeadId || null, "CRM Sender", targetPhone, content, formatMySQLDate(new Date().toISOString()), "outgoing", resolvedProjectId || null]
      );

      res.json({ success: true, messageId: waRes.messageId || null, openWindow });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/whatsapp/send-open-window-greeting", authMiddleware, async (req, res) => {
    try {
      const { leadId, visitId, to, fromPhoneId } = req.body || {};
      let lead: any = null;
      let targetPhone = normalizePhoneNumber(String(to || ""));
      let resolvedLeadId: string | null = cleanSqlId(leadId);
      let resolvedProjectId: string | null = null;

      if (!resolvedLeadId && visitId) {
        const visit = await queryOne<any>("SELECT leadId, projectId, mobile FROM visits WHERE id = ? LIMIT 1", [visitId]);
        if (visit?.leadId) resolvedLeadId = String(visit.leadId);
        if (visit?.projectId) resolvedProjectId = String(visit.projectId);
        if (!targetPhone && visit?.mobile) targetPhone = normalizePhoneNumber(String(visit.mobile));
      }
      if (resolvedLeadId) {
        lead = await queryOne<any>("SELECT id, name, mobile, projectId, last_client_reply_at FROM leads WHERE id = ? LIMIT 1", [resolvedLeadId]);
        if (lead?.mobile && !targetPhone) targetPhone = normalizePhoneNumber(String(lead.mobile));
        if (!resolvedProjectId && lead?.projectId) resolvedProjectId = String(lead.projectId);
      }
      if (!targetPhone) return res.status(400).json({ error: "Recipient number missing." });
      if (!isWithin24hWindow(lead?.last_client_reply_at)) {
        return res.status(400).json({ error: "Greeting blocked: only send inside open 24-hour window." });
      }

      const greeting = pickRotatingGreeting(String(resolvedLeadId || targetPhone));
      const waRes = await WhatsAppService.sendSessionMessage(targetPhone, greeting, fromPhoneId);
      if (!waRes?.success) return res.status(502).json({ error: "WhatsApp send failed", providerError: waRes?.error || null });

      const outMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await pool.execute(
        `INSERT INTO whatsapp_messages (id,leadId,senderName,senderPhoneNumber,content,timestamp,type,projectId) VALUES (?,?,?,?,?,?,?,?)`,
        [outMsgId, resolvedLeadId || null, "CRM Greeting Bot", targetPhone, greeting, formatMySQLDate(new Date().toISOString()), "outgoing", resolvedProjectId || null]
      );
      res.json({ success: true, greeting, messageId: waRes.messageId || null });
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
      (app as any).notifyChanges("remarks", { ...remark, targetId });
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
      (app as any).notifyChanges("notifications", { id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- ADMIN: FIX ASSIGNMENTS -----------------------------
  app.post("/api/admin/fix-assignments", authMiddleware, async (req, res) => {
    const u = (req as any).user;
    if (u.role !== "admin" && u.role !== "adm") return res.status(403).json({ error: "Forbidden" });
    
    try {
      console.log("[Admin] Starting assignment fix...");
      
      // 1. Sync followups with lead owners
      const [fupResult] = await pool.execute(`
        UPDATE followups f
        JOIN leads l ON f.leadId = l.id
        JOIN users u ON l.assignedTo = u.id
        SET f.userId = l.assignedTo, f.userName = u.name
        WHERE l.assignedTo IS NOT NULL AND (f.userId != l.assignedTo OR f.userId IS NULL)
      `);
      
      // 2. Sync visits with lead owners
      const [visitResult] = await pool.execute(`
        UPDATE visits v
        JOIN leads l ON v.leadId = l.id
        JOIN users u ON l.assignedTo = u.id
        SET v.assigned_to = u.name
        WHERE l.assignedTo IS NOT NULL AND (v.assigned_to != u.name OR v.assigned_to IS NULL)
      `);
      
      // 3. Ensure every assigned lead has at least one pending follow-up
      const assignedLeads = await query<any>("SELECT id, assignedTo, projectId FROM leads WHERE assignedTo IS NOT NULL");
      let autoFupCount = 0;
      for (const lead of assignedLeads) {
        const existing = await queryOne<any>("SELECT id FROM followups WHERE leadId = ? AND status = 'pending'", [lead.id]);
        if (!existing) {
          await ensurePendingFollowup(lead.id, lead.assignedTo, lead.projectId);
          autoFupCount++;
        }
      }

      res.json({ 
        success: true, 
        message: "Assignments synchronized successfully.",
        stats: {
          followupsUpdated: (fupResult as any).affectedRows,
          visitsUpdated: (visitResult as any).affectedRows,
          autoFollowupsCreated: autoFupCount
        }
      });
    } catch (e: any) {
      console.error("[Admin Fix Error]:", e);
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

      const existing = await queryOne<any>("SELECT id, created_at, assignedTo FROM leads WHERE mobile = ?", [leadData.mobile || ""]);
      if (existing) {
        leadData.id = existing.id;
        leadData.created_at = existing.created_at;
        // If lead already assigned, don't overwrite assignment unless the config explicitly says so
        // For now, keep current assignment if it exists
        if (existing.assignedTo && !leadData.assignedTo) {
          leadData.assignedTo = existing.assignedTo;
        }
      }

      await pool.execute(
        `INSERT INTO leads (id,name,mobile,source,quality,status,projectId,assignedTo,stats,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name),mobile=VALUES(mobile),source=VALUES(source),assignedTo=VALUES(assignedTo),updated_at=NOW()`,
        [leadData.id, leadData.name||"Unknown", leadData.mobile||null, leadData.source, leadData.quality, leadData.status, leadData.projectId, leadData.assignedTo, leadData.stats, formatMySQLDate(leadData.created_at), formatMySQLDate(now)]
      );

      // Sync data for the lead (handles reassignment and auto-followup)
      if (leadData.assignedTo) {
        await syncLeadOwnership(leadData.id, leadData.assignedTo);
        await ensurePendingFollowup(leadData.id, leadData.assignedTo, leadData.projectId);
      }

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

      const staticUserByPhone: Record<string, string> = {
        "916390071558584": "Hemant",      // Devi Bungalows
        "122101071140010719": "Vani",     // Royal Rudraksha (existing)
        "1152168267972565": "Megha",      // Shreemad Family (existing)
      };

      const inferProjectKeywordByPhone: Record<string, string> = {
        "916390071558584": "devi",
        "122101071140010719": "royal",
        "1152168267972565": "shreemad",
      };

      const projectKeyword = inferProjectKeywordByPhone[recipientPhoneNumberId];
      let project: any = null;
      if (projectKeyword) {
        project = await queryOne<any>("SELECT id, name FROM projects WHERE LOWER(name) LIKE ? ORDER BY updated_at DESC LIMIT 1", [`%${projectKeyword}%`]);
      }
      if (!project) {
        // Fallback to any active project to avoid webhook drop; still keeps per-number context
        project = await queryOne<any>("SELECT id, name FROM projects ORDER BY updated_at DESC LIMIT 1");
      }
      if (!project?.id) return res.status(404).json({ error: "Project mapping not found" });

      const projectId = String(project.id);
      const userName = staticUserByPhone[recipientPhoneNumberId] || "";
      const now = new Date().toISOString();
      const dateOnly = now.split("T")[0];

      let clientName = String(senderName || "WhatsApp Contact").trim()
        .split(" ").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(" ");

      const targetUser = userName
        ? await queryOne<any>("SELECT * FROM users WHERE LOWER(name) LIKE ?", [`%${userName.toLowerCase()}%`])
        : null;
      const assignedUserId = targetUser?.id || null;

      const existingLead = await queryOne<any>(
        "SELECT * FROM leads WHERE mobile = ? AND projectId = ? ORDER BY updated_at DESC LIMIT 1",
        [normalizedMobile, projectId]
      );

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

        // Trigger AI in background
        setImmediate(() => {
          processIncomingWhatsAppMessage({ 
            from: normalizedMobile, 
            message: messageText, 
            projectId: projectId,
            recipientPhoneNumberId: recipientPhoneNumberId
          }).catch(e => console.error("AI Error:", e));
        });

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
        
        // Trigger AI in background
        setImmediate(() => {
          processIncomingWhatsAppMessage({ 
            from: normalizedMobile, 
            message: messageText, 
            projectId: projectId,
            recipientPhoneNumberId: recipientPhoneNumberId
          }).catch(e => console.error("AI Error:", e));
        });

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
      else if (type === "detailed_monthly") await generateMonthlyDetailedMISReport();
      else return res.status(400).json({ error: "Invalid type" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/reports/funnel", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const role = (u?.role || "").toLowerCase();
      const range = String(req.query.range || "month");
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const fromDate = range === "today" ? today : range === "week" ? weekStart.toISOString().slice(0, 10) : monthStart.toISOString().slice(0, 10);

      const [allLeads, users, projects] = await Promise.all([
        query<any>("SELECT id, name, source, status, projectId, assignedTo, created_at FROM leads WHERE DATE(created_at) >= ?", [fromDate]),
        query<any>("SELECT id, name FROM users"),
        query<any>("SELECT id, name FROM projects"),
      ]);

      const isAdmin = role === "admin" || role === "adm";
      const visibleLeads = isAdmin
        ? allLeads
        : allLeads.filter((l: any) => String(l.projectId || "") === String(u.projectId || "") || String(l.assignedTo || "") === String(u.id || ""));

      const baseCounters = () => ({
        total: 0,
        contacted: 0,
        visit_scheduled: 0,
        visit_done: 0,
        closed: 0
      });

      const bySource: Record<string, any> = {};
      const byUser: Record<string, any> = {};
      const byProject: Record<string, any> = {};
      const userMap = new Map<number, string>(users.map((x: any) => [Number(x.id), x.name || `User ${x.id}`]));
      const projectMap = new Map<string, string>(projects.map((x: any) => [String(x.id), x.name || x.id]));

      const agg = baseCounters();
      for (const lead of visibleLeads) {
        const status = String(lead.status || "new");
        const source = String(lead.source || "Unknown");
        const userName = userMap.get(Number(lead.assignedTo || 0)) || "Unassigned";
        const projectName = projectMap.get(String(lead.projectId || "")) || "Unknown";

        for (const bag of [agg, bySource[source] || (bySource[source] = baseCounters()), byUser[userName] || (byUser[userName] = baseCounters()), byProject[projectName] || (byProject[projectName] = baseCounters())]) {
          bag.total += 1;
          if (["contacted", "visit_scheduled", "visit_done", "closed"].includes(status)) bag.contacted += 1;
          if (["visit_scheduled", "visit_done", "closed"].includes(status)) bag.visit_scheduled += 1;
          if (["visit_done", "closed"].includes(status)) bag.visit_done += 1;
          if (status === "closed") bag.closed += 1;
        }
      }

      const toRows = (obj: Record<string, any>) =>
        Object.entries(obj).map(([name, v]: [string, any]) => ({
          name,
          ...v,
          drop_contact_to_visit: Math.max(0, v.contacted - v.visit_scheduled),
          drop_visit_to_done: Math.max(0, v.visit_scheduled - v.visit_done),
          drop_done_to_close: Math.max(0, v.visit_done - v.closed),
          close_rate_pct: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0
        })).sort((a: any, b: any) => b.total - a.total);

      res.json({
        generatedAt: new Date().toISOString(),
        range,
        overall: {
          ...agg,
          close_rate_pct: agg.total > 0 ? Math.round((agg.closed / agg.total) * 100) : 0
        },
        bySource: toRows(bySource),
        byUser: toRows(byUser),
        byProject: toRows(byProject)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/sla/status", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const role = (u?.role || "").toLowerCase();
      const isAdmin = role === "admin" || role === "adm";
      const isManager = role === "manager";
      const notify = String(req.query.notify || "0") === "1";
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const range = String(req.query.range || "today");
      const fromDate = range === "week" ? weekStart.toISOString().slice(0, 10) : today;

      const [leads, followups, visits, callLogs, users] = await Promise.all([
        query<any>("SELECT id, name, status, quality, source, projectId, assignedTo, updated_at, created_at FROM leads WHERE status NOT IN ('closed','lost')"),
        query<any>("SELECT id, leadId, visitId, status, date, created_at FROM followups"),
        query<any>("SELECT id, leadId, client_name, visit_status, outcome, completed_at, visit_date, assigned_to FROM visits"),
        query<any>("SELECT id, leadId, outcome, timestamp FROM call_logs"),
        query<any>("SELECT id, name, role, projectId FROM users"),
      ]);

      const visibleLeads = (isAdmin || isManager)
        ? leads
        : leads.filter((l: any) => String(l.projectId || "") === String(u.projectId || "") || String(l.assignedTo || "") === String(u.id || ""));

      const leadIdSet = new Set<string>(visibleLeads.map((l: any) => String(l.id)));
      const visibleVisits = visits.filter((v: any) => !v.leadId || leadIdSet.has(String(v.leadId)));
      const visibleFollowups = followups.filter((f: any) => !f.leadId || leadIdSet.has(String(f.leadId)));
      const visibleCalls = callLogs.filter((c: any) => !c.leadId || leadIdSet.has(String(c.leadId)));

      const pendingByLead = new Set<string>(
        visibleFollowups.filter((f: any) => f.status === "pending" && f.leadId).map((f: any) => String(f.leadId))
      );
      const pendingByVisit = new Set<string>(
        visibleFollowups.filter((f: any) => f.status === "pending" && f.visitId).map((f: any) => String(f.visitId))
      );

      const breaches: any[] = [];
      for (const lead of visibleLeads) {
        const created = new Date(lead.created_at);
        const due = new Date(created.getTime() + 10 * 60 * 1000);
        const hasFirstTouch =
          visibleCalls.some((c: any) => String(c.leadId || "") === String(lead.id)) ||
          visibleFollowups.some((f: any) => String(f.leadId || "") === String(lead.id)) ||
          visibleVisits.some((v: any) => String(v.leadId || "") === String(lead.id));
        if (!hasFirstTouch && now > due) {
          breaches.push({
            type: "first_response_breach",
            leadId: lead.id,
            name: lead.name,
            assignedTo: lead.assignedTo,
            detail: "No first touch within SLA 10 minutes",
            severity: "high"
          });
        }

        if (!pendingByLead.has(String(lead.id))) {
          breaches.push({
            type: "missed_followup",
            leadId: lead.id,
            name: lead.name,
            assignedTo: lead.assignedTo,
            detail: "Active lead has no pending follow-up",
            severity: "medium"
          });
        }

        if (String(lead.quality) === "hot") {
          const updatedAt = new Date(lead.updated_at || lead.created_at);
          const ageHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
          if (ageHours >= 24) {
            breaches.push({
              type: "stale_hot_lead",
              leadId: lead.id,
              name: lead.name,
              assignedTo: lead.assignedTo,
              detail: `Hot lead stale for ${Math.floor(ageHours)}h`,
              severity: "high"
            });
          }
        }
      }

      for (const v of visibleVisits) {
        if (String(v.visit_status) !== "completed") continue;
        const completedDate = String(v.completed_at || v.visit_date || "").slice(0, 10);
        if (completedDate < fromDate) continue;
        const hasOutcome = !!String(v.outcome || "").trim();
        const needsNext = String(v.outcome || "") === "follow_up_required";
        const hasNext = pendingByVisit.has(String(v.id)) || (v.leadId && pendingByLead.has(String(v.leadId)));
        if (!hasOutcome || (needsNext && !hasNext)) {
          breaches.push({
            type: "missed_visit_outcome",
            visitId: v.id,
            leadId: v.leadId,
            name: v.client_name,
            detail: !hasOutcome ? "Visit completed without outcome" : "Follow-up required but next action missing",
            severity: "high"
          });
        }
      }

      const pendingOverdue = visibleFollowups.filter((f: any) => f.status === "pending" && String(f.date || "") < today);
      for (const f of pendingOverdue.slice(0, 200)) {
        breaches.push({
          type: "overdue_followup",
          followupId: f.id,
          leadId: f.leadId,
          detail: `Pending follow-up overdue since ${f.date}`,
          severity: "medium"
        });
      }

      if (notify && (isAdmin || isManager)) {
        const mgrs = users.filter((x: any) => {
          const r = String(x.role || "").toLowerCase();
          return r === "manager" || r === "admin" || r === "adm";
        });
        const cnt = breaches.length;
        for (const m of mgrs) {
          const notifId = `sla_${today}_${m.id}`;
          await pool.execute(
            `INSERT IGNORE INTO notifications (id,userId,type,title,message,\`read\`,createdAt,isAdmin,date) VALUES (?,?,?,?,?,0,?,1,?)`,
            [notifId, m.id, "SLA_BREACH", "SLA Exceptions Detected", `${cnt} active SLA exceptions need review.`, new Date().toISOString(), today]
          );
        }
      }

      res.json({
        generatedAt: new Date().toISOString(),
        range,
        summary: {
          totalBreaches: breaches.length,
          firstResponseBreaches: breaches.filter((b: any) => b.type === "first_response_breach").length,
          missedFollowups: breaches.filter((b: any) => b.type === "missed_followup").length,
          missedVisitOutcomes: breaches.filter((b: any) => b.type === "missed_visit_outcome").length,
          staleHotLeads: breaches.filter((b: any) => b.type === "stale_hot_lead").length,
          overdueFollowups: breaches.filter((b: any) => b.type === "overdue_followup").length,
        },
        breaches: breaches.slice(0, 200)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/sales/priority-queue", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const role = (u?.role || "").toLowerCase();
      const isAdmin = role === "admin" || role === "adm";
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
      const now = new Date();

      const [leads, followups, callLogs] = await Promise.all([
        query<any>("SELECT id, name, mobile, source, quality, status, assignedTo, projectId, created_at, updated_at FROM leads WHERE status NOT IN ('closed','lost')"),
        query<any>("SELECT id, leadId, status, date, purpose FROM followups"),
        query<any>("SELECT id, leadId, outcome, timestamp FROM call_logs"),
      ]);

      const visibleLeads = isAdmin
        ? leads
        : leads.filter((l: any) => String(l.projectId || "") === String(u.projectId || "") || String(l.assignedTo || "") === String(u.id || ""));

      const byLeadFollowups = new Map<string, any[]>();
      for (const f of followups) {
        const k = String(f.leadId || "");
        if (!k) continue;
        const arr = byLeadFollowups.get(k) || [];
        arr.push(f);
        byLeadFollowups.set(k, arr);
      }
      const byLeadCalls = new Map<string, any[]>();
      for (const c of callLogs) {
        const k = String(c.leadId || "");
        if (!k) continue;
        const arr = byLeadCalls.get(k) || [];
        arr.push(c);
        byLeadCalls.set(k, arr);
      }

      const sourceBoost = (source: string) => {
        const s = String(source || "").toLowerCase();
        if (s.includes("google")) return 12;
        if (s.includes("meta") || s.includes("facebook") || s.includes("social")) return 10;
        if (s.includes("reference")) return 8;
        return 0;
      };

      const queued = visibleLeads.map((lead: any) => {
        let score = 0;
        const reasons: string[] = [];
        const quality = String(lead.quality || "pending");
        if (quality === "hot") { score += 40; reasons.push("Hot lead"); }
        else if (quality === "warm") { score += 25; reasons.push("Warm lead"); }
        else if (quality === "pending") { score += 12; }
        else if (quality === "cold") { score += 6; }
        else if (quality === "disq") { score -= 25; }

        const leadFups = byLeadFollowups.get(String(lead.id)) || [];
        const pendingFups = leadFups.filter((f: any) => f.status === "pending");
        if (pendingFups.length === 0) { score += 22; reasons.push("No pending follow-up"); }
        const overdueFups = pendingFups.filter((f: any) => String(f.date || "") < now.toISOString().slice(0, 10));
        if (overdueFups.length > 0) { score += 18; reasons.push("Overdue follow-up"); }

        const leadCalls = byLeadCalls.get(String(lead.id)) || [];
        if (leadCalls.length === 0) { score += 20; reasons.push("No call attempt yet"); }
        const unanswered = leadCalls.filter((c: any) => ["not_answered", "busy", "switched_off"].includes(String(c.outcome || ""))).length;
        if (unanswered >= 2) { score += 10; reasons.push("Multiple unanswered calls"); }

        if (String(lead.status) === "new") { score += 15; reasons.push("New lead"); }
        score += sourceBoost(lead.source);

        const updated = new Date(lead.updated_at || lead.created_at);
        const ageHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
        if (ageHours >= 24) { score += 15; reasons.push("Stale lead"); }
        else if (ageHours >= 6) { score += 8; }

        return {
          leadId: lead.id,
          name: lead.name,
          mobile: lead.mobile,
          source: lead.source,
          quality: lead.quality,
          status: lead.status,
          score,
          reasons: reasons.slice(0, 4)
        };
      }).sort((a: any, b: any) => b.score - a.score).slice(0, limit);

      res.json({
        generatedAt: new Date().toISOString(),
        totalCandidates: visibleLeads.length,
        queue: queued
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/compliance", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const role = (u?.role || "").toLowerCase();
      if (role !== "admin" && role !== "adm" && role !== "manager") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const range = String(req.query.range || "today");
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const fromDate = range === "week" ? weekStartStr : today;

      const [users, activeLeads, pendingFollowups, completedVisits, pendingVisitFollowups] = await Promise.all([
        query<any>("SELECT id, name, role FROM users"),
        query<any>(
          "SELECT id, assignedTo FROM leads WHERE assignedTo IS NOT NULL AND status NOT IN ('closed', 'lost')"
        ),
        query<any>(
          "SELECT id, leadId FROM followups WHERE status = 'pending'"
        ),
        query<any>(
          "SELECT id, leadId, assigned_to, outcome, completed_at, visit_date FROM visits WHERE visit_status = 'completed' AND (DATE(COALESCE(completed_at, visit_date)) >= ?)",
          [fromDate]
        ),
        query<any>(
          "SELECT id, visitId, leadId, status FROM followups WHERE status = 'pending'"
        ),
      ]);

      const userRows = users
        .filter((x: any) => {
          const r = String(x.role || "").toLowerCase();
          return r !== "admin" && r !== "adm";
        })
        .map((x: any) => ({
          userId: Number(x.id),
          userName: x.name || `User ${x.id}`,
          activeLeads: 0,
          leadsWithPendingFollowup: 0,
          leadFollowupCompliancePct: 0,
          visitsCompleted: 0,
          visitsWithOutcome: 0,
          visitsWithNextAction: 0,
          visitOutcomeCompliancePct: 0,
          visitNextActionCompliancePct: 0,
          overallCompliancePct: 0,
        }));

      const byId = new Map<number, any>(userRows.map((r: any) => [r.userId, r]));
      const pendingLeadIds = new Set<string>(pendingFollowups.map((f: any) => String(f.leadId || "")));
      const pendingVisitIds = new Set<string>(pendingVisitFollowups.map((f: any) => String(f.visitId || "")));
      const pendingLeadIdsFromVisitFollowup = new Set<string>(pendingVisitFollowups.map((f: any) => String(f.leadId || "")));

      for (const lead of activeLeads) {
        const row = byId.get(Number(lead.assignedTo));
        if (!row) continue;
        row.activeLeads += 1;
        if (pendingLeadIds.has(String(lead.id))) row.leadsWithPendingFollowup += 1;
      }

      for (const visit of completedVisits) {
        const row = userRows.find((r: any) => r.userName === visit.assigned_to);
        if (!row) continue;
        row.visitsCompleted += 1;

        const hasOutcome = !!String(visit.outcome || "").trim();
        if (hasOutcome) row.visitsWithOutcome += 1;

        const needsNextAction = String(visit.outcome || "") === "follow_up_required";
        const hasNextAction =
          pendingVisitIds.has(String(visit.id)) ||
          (visit.leadId ? pendingLeadIdsFromVisitFollowup.has(String(visit.leadId)) : false);
        if (!needsNextAction || hasNextAction) row.visitsWithNextAction += 1;
      }

      for (const row of userRows) {
        row.leadFollowupCompliancePct = row.activeLeads > 0
          ? Math.round((row.leadsWithPendingFollowup / row.activeLeads) * 100)
          : 100;
        row.visitOutcomeCompliancePct = row.visitsCompleted > 0
          ? Math.round((row.visitsWithOutcome / row.visitsCompleted) * 100)
          : 100;
        row.visitNextActionCompliancePct = row.visitsCompleted > 0
          ? Math.round((row.visitsWithNextAction / row.visitsCompleted) * 100)
          : 100;
        row.overallCompliancePct = Math.round(
          row.leadFollowupCompliancePct * 0.5 +
          row.visitOutcomeCompliancePct * 0.25 +
          row.visitNextActionCompliancePct * 0.25
        );
      }

      res.json({
        generatedAt: new Date().toISOString(),
        range,
        totals: {
          activeLeads: userRows.reduce((a: number, r: any) => a + r.activeLeads, 0),
          leadsWithPendingFollowup: userRows.reduce((a: number, r: any) => a + r.leadsWithPendingFollowup, 0),
          visitsCompleted: userRows.reduce((a: number, r: any) => a + r.visitsCompleted, 0),
          visitsWithOutcome: userRows.reduce((a: number, r: any) => a + r.visitsWithOutcome, 0),
          visitsWithNextAction: userRows.reduce((a: number, r: any) => a + r.visitsWithNextAction, 0),
        },
        rows: userRows.sort((a: any, b: any) => b.overallCompliancePct - a.overallCompliancePct)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/compliance/bulk-fix", authMiddleware, async (req, res) => {
    try {
      const u = (req as any).user;
      const role = String(u?.role || "").toLowerCase();
      if (!["admin", "adm", "manager"].includes(role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const mode = String(req.body?.mode || "");
      const limit = Math.max(1, Math.min(500, Number(req.body?.limit || 100)));
      const today = new Date().toISOString().slice(0, 10);
      let fixed = 0;

      if (mode === "missed_followups") {
        const leads = await query<any>(
          "SELECT id, name, assignedTo, projectId, status FROM leads WHERE status NOT IN ('closed','lost') ORDER BY updated_at ASC LIMIT ?",
          [limit * 3]
        );
        for (const lead of leads) {
          const existingPending = await queryOne<any>(
            "SELECT id FROM followups WHERE leadId = ? AND status = 'pending' LIMIT 1",
            [lead.id]
          );
          if (existingPending) continue;

          if (lead.assignedTo) {
            await ensurePendingFollowup(lead.id, lead.assignedTo, lead.projectId || null);
          } else {
            const fupId = `fup_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await pool.execute(
              `INSERT INTO followups (id, leadId, projectId, date, scheduled_at, purpose, method, status, created_at, outcome_note)
               VALUES (?,?,?,?,?,?,?,?,?,?)`,
              [
                fupId,
                lead.id,
                lead.projectId || null,
                today,
                formatMySQLDate(new Date().toISOString()),
                "Auto recovery follow-up (compliance fix)",
                "call",
                "pending",
                formatMySQLDate(new Date().toISOString()),
                "Created by compliance bulk fix"
              ]
            );
          }

          const actId = `act_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await pool.execute(
            `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
            [actId, "followup_scheduled", u.id, u.name || u.username || "System", lead.projectId || null, lead.id, lead.name || "Lead", "Bulk fix: Created pending follow-up for missed follow-up compliance."]
          );
          fixed++;
          if (fixed >= limit) break;
        }
      } else if (mode === "missed_visit_outcomes") {
        const visits = await query<any>(
          "SELECT id, leadId, client_name, projectId, outcome, visit_status, completed_at, visit_date FROM visits WHERE visit_status = 'completed' ORDER BY COALESCE(completed_at, visit_date) DESC LIMIT ?",
          [limit * 3]
        );
        for (const visit of visits) {
          const hasOutcome = !!String(visit.outcome || "").trim();
          if (!hasOutcome) {
            await pool.execute("UPDATE visits SET outcome = ? WHERE id = ?", ["follow_up_required", visit.id]);
          }
          const needsNext = String(visit.outcome || "follow_up_required") === "follow_up_required";
          let hasPending = false;
          if (needsNext) {
            const pending = await queryOne<any>(
              "SELECT id FROM followups WHERE status = 'pending' AND (visitId = ? OR leadId = ?) LIMIT 1",
              [visit.id, visit.leadId || null]
            );
            hasPending = !!pending;
          }
          if (needsNext && !hasPending) {
            const next = new Date();
            next.setDate(next.getDate() + 1);
            const nextDate = next.toISOString().slice(0, 10);
            const fupId = `fup_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await pool.execute(
              `INSERT INTO followups (id, leadId, visitId, projectId, date, scheduled_at, purpose, method, status, created_at, outcome_note)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [
                fupId,
                visit.leadId || null,
                visit.id,
                visit.projectId || null,
                nextDate,
                formatMySQLDate(next.toISOString()),
                "Auto next step after completed visit (compliance fix)",
                "call",
                "pending",
                formatMySQLDate(new Date().toISOString()),
                "Created by compliance bulk fix"
              ]
            );
          }

          const actId = `act_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await pool.execute(
            `INSERT INTO activities (id,type,userId,userName,projectId,targetId,targetName,timestamp,details) VALUES (?,?,?,?,?,?,?,NOW(),?)`,
            [actId, "visit_completed", u.id, u.name || u.username || "System", visit.projectId || null, visit.id, visit.client_name || "Visit", "Bulk fix: Visit outcome/next action compliance repaired."]
          );
          fixed++;
          if (fixed >= limit) break;
        }
      } else {
        return res.status(400).json({ error: "Invalid mode. Use missed_followups or missed_visit_outcomes." });
      }

      res.json({ success: true, mode, fixed });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -- ATTENDANCE MAINTENANCE (every 15 min) --------------
  async function runAttendanceMaintenance() {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTime = now.getHours() * 60 + now.getMinutes();
      // Fetch users and today's attendance in parallel (faster)
      const [users, attendance] = await Promise.all([
        query<any>("SELECT id, name, workingHours FROM users"),
        query<any>("SELECT * FROM attendance WHERE date = ?", [todayStr]),
      ]);
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
      // Only fetch followups that are due within the next 2 hours (avoids loading all pending)
      const fups = await query<any>("SELECT * FROM followups WHERE status = 'pending' AND scheduled_at IS NOT NULL AND scheduled_at <= ? AND scheduled_at >= ?", [upcoming.toISOString().slice(0,19).replace('T',' '), new Date(now.getTime() - 30*60*1000).toISOString().slice(0,19).replace('T',' ')]);
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
      // Only fetch visits due within the next 2 hours (avoids loading all scheduled visits)
      const todayStr = now.toISOString().split('T')[0];
      const twoHrStr = new Date(now.getTime() + 120 * 60 * 1000).toISOString().split('T')[0];
      const visits = await query<any>("SELECT * FROM visits WHERE visit_status = 'scheduled' AND visit_date >= ? AND visit_date <= ?", [todayStr, twoHrStr]);
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

  // Ensure inventory table exists for unit shortlist/hold/booked workflow
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_units (
      id VARCHAR(100) PRIMARY KEY,
      projectId VARCHAR(50) NOT NULL,
      unitCode VARCHAR(100) NOT NULL,
      unitTitle VARCHAR(255) NULL,
      inventoryUrl TEXT NULL,
      status ENUM('available','shortlisted','hold','sold','booked') DEFAULT 'shortlisted',
      shortlistedByLeadId VARCHAR(100) NULL,
      shortlistedByVisitId VARCHAR(100) NULL,
      note TEXT NULL,
      updatedByUserId INT NULL,
      updatedByUserName VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_project (projectId),
      INDEX idx_inv_status (status),
      INDEX idx_inv_unit (unitCode)
    ) ENGINE=InnoDB
  `);

  // -- VITE / STATIC SERVE --------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT} (Socket.io enabled)`);
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
