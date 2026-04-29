import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import cron from "node-cron";
import dotenv from "dotenv";
dotenv.config();

let globalPool: mysql.Pool | null = null;

export function setDbPool(pool: mysql.Pool) {
  globalPool = pool;
  console.log("[Report] MySQL pool injected.");
}

function getPool(): mysql.Pool {
  if (!globalPool) throw new Error("DB pool not initialized in reportService");
  return globalPool;
}

async function sql<T = any>(q: string, p?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(q, p);
  return rows as T[];
}

const smtpConfig = {
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "" },
};
const transporter = nodemailer.createTransport(smtpConfig);
const RECIPIENT = (process.env.REPORT_RECIPIENT || "").trim();

export async function getReportStats() {
  const tables = ["leads","visits","users","projects","call_logs","followups"];
  const counts: Record<string,number> = {};
  for (const t of tables) {
    const [row] = await sql<any>(`SELECT COUNT(*) AS c FROM ${t}`);
    counts[t] = row?.c || 0;
  }
  return { status: "ok", db: "mysql", smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS), recipient: RECIPIENT, collections: counts };
}

export async function generateDailyMISReport() {
  console.log("[MIS] Generating Daily Report...");
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;

  const projects = await sql<any>("SELECT * FROM projects");
  const users = await sql<any>("SELECT * FROM users");

  const projectRows = await Promise.all(projects.map(async p => {
    const [totRow] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=?", [p.id]);
    const [newRow] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=? AND DATE(created_at)=?", [p.id, today]);
    const [activeRow] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=? AND status NOT IN ('lost','closed')", [p.id]);
    const statuses = ["new","contacted","visit_scheduled","visit_done","closed","lost"];
    const stageCounts: Record<string,number> = {};
    for (const s of statuses) {
      const [r] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=? AND status=?", [p.id, s]);
      stageCounts[s] = r?.c || 0;
    }
    const [vSch] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND visit_date=? AND visit_status='scheduled'", [p.id, today]);
    const [vDone] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND visit_date=? AND visit_status='completed'", [p.id, today]);
    return { name: p.name, newToday: newRow?.c||0, active: activeRow?.c||0, stageCounts, vSch: vSch?.c||0, vDone: vDone?.c||0 };
  }));

  const userRows = await Promise.all(users.map(async u => {
    const [calls] = await sql<any>("SELECT COUNT(*) AS c FROM call_logs WHERE `by`=? AND DATE(timestamp)=?", [u.name, today]);
    const [answered] = await sql<any>("SELECT COUNT(*) AS c FROM call_logs WHERE `by`=? AND DATE(timestamp)=? AND outcome='answered'", [u.name, today]);
    const [leads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE assignedTo=?", [u.id]);
    const [fSch] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE userId=? AND date=? AND status='pending'", [u.id, today]);
    const [fDone] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE userId=? AND date=? AND status='completed'", [u.id, today]);
    const [fOver] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE userId=? AND date<? AND status='pending'", [u.id, today]);
    return { name: u.name, calls: calls?.c||0, answered: answered?.c||0, leads: leads?.c||0, fSch: fSch?.c||0, fDone: fDone?.c||0, fOver: fOver?.c||0 };
  }));

  const [weekLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) >= ?", [weekStartStr]);
  const [monthLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) >= ?", [monthStart]);

  const html = `
<h2>DAILY MIS REPORT — ${today}</h2>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f2f2f2"><th>Project</th><th>New Today</th><th>Active</th><th>New</th><th>Contacted</th><th>V.Sch</th><th>V.Done</th><th>Booked</th><th>Visits Sch Today</th><th>Visits Done Today</th></tr></thead>
<tbody>${projectRows.map(r=>`<tr><td>${r.name}</td><td>${r.newToday}</td><td>${r.active}</td><td>${r.stageCounts.new}</td><td>${r.stageCounts.contacted}</td><td>${r.stageCounts.visit_scheduled}</td><td>${r.stageCounts.visit_done}</td><td>${r.stageCounts.closed}</td><td>${r.vSch}</td><td>${r.vDone}</td></tr>`).join("")}</tbody>
</table>
<br/>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f2f2f2"><th>User</th><th>Calls</th><th>Connected</th><th>Leads</th><th>F/U Today</th><th>F/U Done</th><th>Overdue F/U</th></tr></thead>
<tbody>${userRows.map(r=>`<tr><td>${r.name}</td><td>${r.calls}</td><td>${r.answered}</td><td>${r.leads}</td><td>${r.fSch}</td><td>${r.fDone}</td><td style="color:${r.fOver>0?"red":"black"}">${r.fOver}</td></tr>`).join("")}</tbody>
</table>
<p><b>Weekly New Leads:</b> ${weekLeads?.c||0} &nbsp; <b>Monthly New Leads:</b> ${monthLeads?.c||0}</p>`;

  await sendEmail(`Daily MIS Report — ${today}`, html);
}

export async function generateWeekendMISReport() {
  console.log("[MIS] Generating Weekend Report...");
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const lastSat = new Date(now); lastSat.setDate(now.getDate()-(now.getDay()+1));
  const lastSatStr = lastSat.toISOString().split("T")[0];

  const projects = await sql<any>("SELECT * FROM projects");
  const weekendRows = await Promise.all(projects.map(async p => {
    const [hot] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND (visit_date=? OR visit_date=?) AND visit_status='scheduled' AND status='hot'", [p.id, today, tomorrowStr]);
    const [warm] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND (visit_date=? OR visit_date=?) AND visit_status='scheduled' AND status='warm'", [p.id, today, tomorrowStr]);
    const [cold] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND (visit_date=? OR visit_date=?) AND visit_status='scheduled' AND status='cold'", [p.id, today, tomorrowStr]);
    const [total] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE projectId=? AND (visit_date=? OR visit_date=?) AND visit_status='scheduled'", [p.id, today, tomorrowStr]);
    const [newL] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=? AND DATE(created_at)>=?", [p.id, lastSatStr]);
    const [active] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE projectId=? AND status NOT IN ('lost','closed')", [p.id]);
    return { name: p.name, total: total?.c||0, hot: hot?.c||0, warm: warm?.c||0, cold: cold?.c||0, newL: newL?.c||0, active: active?.c||0 };
  }));

  const html = `
<h2>WEEKEND MIS REPORT — ${today}</h2>
<h3>Planned Visits (Sat+Sun)</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f2f2f2"><th>Project</th><th>Total Visits</th><th>Hot</th><th>Warm</th><th>Cold</th><th>New Leads (This Week)</th><th>Active Leads</th></tr></thead>
<tbody>${weekendRows.map(r=>`<tr><td>${r.name}</td><td>${r.total}</td><td>${r.hot}</td><td>${r.warm}</td><td>${r.cold}</td><td>${r.newL}</td><td>${r.active}</td></tr>`).join("")}</tbody>
</table>`;

  await sendEmail(`Weekend MIS Report — ${today}`, html);
}

async function sendEmail(subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[MIS] SMTP not configured, printing to console");
    console.log("SUBJECT:", subject);
    return;
  }
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: RECIPIENT, subject, html });
  console.log("[MIS] Email sent to", RECIPIENT);
}

export async function sendCustomEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (e: any) { console.error("[Email]", e.message); return false; }
}

export function setupMISReports() {
  console.log("[MIS] Scheduling reports...");
  cron.schedule("30 14 * * *", () => generateDailyMISReport().catch(console.error));
  cron.schedule("30 3 * * 6", () => generateWeekendMISReport().catch(console.error));
  console.log("[MIS] Daily@8PM IST, Weekend@Sat9AM IST");
}
