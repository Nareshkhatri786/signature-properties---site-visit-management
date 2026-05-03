import nodemailer from 'nodemailer';
import cron from 'node-cron';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { format, subDays } from 'date-fns';

dotenv.config();

let globalPool: mysql.Pool | null = null;

export function setDbPool(pool: mysql.Pool) {
  globalPool = pool;
}


function getPool() {
  if (!globalPool) {
    globalPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return globalPool;
}

async function sql<T = any>(q: string, p?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(q, p);
  return rows as T[];
}

const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "" },
};
const transporter = nodemailer.createTransport(smtpConfig);
const RECIPIENT = (process.env.REPORT_RECIPIENT || "diya9574466663@gmail.com").trim();

// --- Helpers ---

export async function getReportStats() {
  const tables = ["leads", "visits", "users", "projects", "call_logs", "followups"];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const [row] = await sql<any>(`SELECT COUNT(*) AS c FROM ${t}`);
    counts[t] = row?.c || 0;
  }
  return { 
    status: "ok", 
    db: "mysql", 
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS), 
    recipient: RECIPIENT, 
    collections: counts 
  };
}

export async function sendCustomEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (e: any) {
    console.error("[Email] Custom Send Failed:", e.message);
    return false;
  }
}

// --- Report Generators ---

export async function generateDailyMISReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const startOfWeek = format(subDays(now, 7), 'yyyy-MM-dd');
  const startOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  console.log(`[MIS] Generating Detailed Daily Report for ${today}...`);

  // 1. Project Stats
  const projectStats = await sql<any>(`
    SELECT 
      p.id,
      p.name as projectName,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND DATE(l.created_at) = ?) as newLeads,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND l.status NOT IN ('closed', 'lost')) as activeLeads,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND l.status = 'new') as newStg,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND l.status = 'contacted') as contStg,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND l.status = 'visit_scheduled') as vSchStg,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND l.status = 'visit_done') as vDoneStg,
      (SELECT COUNT(*) FROM visits v WHERE v.projectId = p.id AND v.outcome = 'booked' AND DATE(v.completed_at) = ?) as booked,
      (SELECT COUNT(*) FROM visits v WHERE v.projectId = p.id AND v.visit_date = ? AND v.visit_status IN ('scheduled', 'rescheduled')) as vSchToday,
      (SELECT COUNT(*) FROM visits v WHERE v.projectId = p.id AND v.visit_date = ? AND v.visit_status = 'completed') as vDoneToday,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND DATE(l.created_at) >= ?) as weeklyNew,
      (SELECT COUNT(*) FROM leads l WHERE l.projectId = p.id AND DATE(l.created_at) >= ?) as monthlyNew
    FROM projects p
  `, [today, today, today, today, startOfWeek, startOfMonth]);

  // 2. User Stats
  const userStats = await sql<any>(`
    SELECT 
      u.name as userName,
      (SELECT COUNT(*) FROM call_logs c WHERE (c.by = u.name OR c.by = u.username) AND DATE(c.timestamp) = ?) as callsAttempted,
      (SELECT COUNT(*) FROM call_logs c WHERE (c.by = u.name OR c.by = u.username) AND DATE(c.timestamp) = ? AND c.outcome = 'answered') as callsConnected,
      (SELECT COUNT(*) FROM leads l WHERE l.assignedTo = u.id) as leadsHandled,
      (SELECT COUNT(*) FROM visits v WHERE v.assigned_to = u.name AND v.visit_date = ? AND v.visit_status IN ('scheduled', 'rescheduled')) as visitsSch,
      (SELECT COUNT(*) FROM visits v WHERE v.assigned_to = u.name AND v.visit_date = ? AND v.visit_status = 'completed') as visitsDone
    FROM users u
    WHERE u.role != 'admin'
  `, [today, today, today, today]);

  // 3. Summary Stats
  const [weeklyNew] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) >= ?", [startOfWeek]);
  const [monthlyNew] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) >= ?", [startOfMonth]);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 1000px; padding: 20px;">
      <h2 style="font-size: 18px; margin-bottom: 20px; text-transform: uppercase;">Daily MIS Report - ${today}</h2>
      
      <!-- Project Wise Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; border: 1px solid #ddd;">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Project</th>
            <th style="padding: 10px; border: 1px solid #ddd;">New Leads</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Active Leads</th>
            <th style="padding: 10px; border: 1px solid #ddd;">New Stg</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Cont Stg</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Sch Stg</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Done Stg</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Booked</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Sch Today</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Done Today</th>
            <th style="padding: 10px; border: 1px solid #ddd; background: #f0f7ff;">Weekly New</th>
            <th style="padding: 10px; border: 1px solid #ddd; background: #f0fff4;">Monthly New</th>
          </tr>
        </thead>
        <tbody>
          ${projectStats.map(p => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #fdfdfd;">${p.projectName}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.newLeads}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.activeLeads}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.newStg}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.contStg}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vSchStg}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vDoneStg}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.booked}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vSchToday}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vDoneToday}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; background: #f0f7ff;">${p.weeklyNew}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; background: #f0fff4;">${p.monthlyNew}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- User Performance Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; border: 1px solid #ddd;">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">User</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Calls Attempted</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Calls Connected</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Leads Handled</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Visits Scheduled</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Visits Done</th>
          </tr>
        </thead>
        <tbody>
          ${userStats.map(u => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #fdfdfd;">${u.userName}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.callsAttempted}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.callsConnected}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.leadsHandled}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.visitsSch}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.visitsDone}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 11px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
        Sent automatically by Signature Properties CRM — Daily Performance Audit.
      </p>
    </div>
  `;

  await sendEmail(`Daily MIS Report - ${today}`, html);
}

export async function generateWeeklyMISReport() {
  const start = format(subDays(new Date(), 7), 'yyyy-MM-dd'); // Last Monday approx
  const end = format(subDays(new Date(), 1), 'yyyy-MM-dd');   // Last Sunday
  console.log(`[MIS] Generating Weekly Report for ${start} to ${end}...`);

  const [totalLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) BETWEEN ? AND ?", [start, end]);
  const [hotLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) BETWEEN ? AND ? AND quality = 'hot'", [start, end]);
  const [warmLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) BETWEEN ? AND ? AND quality = 'warm'", [start, end]);
  
  const [visitsDone] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE visit_date BETWEEN ? AND ? AND visit_status = 'completed'", [start, end]);
  const [followupsDone] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE date BETWEEN ? AND ? AND status = 'completed'", [start, end]);

  const users = await sql<any>("SELECT id, name FROM users");
  const userStats = await Promise.all(users.map(async u => {
    const [l] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE assignedTo = ? AND DATE(created_at) BETWEEN ? AND ?", [u.id, start, end]);
    const [v] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE assigned_to = ? AND visit_date BETWEEN ? AND ? AND visit_status = 'completed'", [u.id, start, end]);
    const [f] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE userId = ? AND date BETWEEN ? AND ? AND status = 'completed'", [u.id, start, end]);
    return { name: u.name, leads: l.c, visits: v.c, followups: f.c };
  }));

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 10px;">Weekly Performance Report</h2>
      <p style="color: #7f8c8d; font-size: 14px;">Period: <b>${start}</b> to <b>${end}</b> (Mon-Sun)</p>
      
      <div style="margin: 20px 0; background: #ecf0f1; padding: 15px; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr;">
        <div>
          <p style="margin:5px 0">Total Leads: <b>${totalLeads.c}</b></p>
          <p style="margin:5px 0">Hot Leads: <b style="color:#e74c3c">${hotLeads.c}</b></p>
          <p style="margin:5px 0">Warm Leads: <b style="color:#e67e22">${warmLeads.c}</b></p>
        </div>
        <div>
          <p style="margin:5px 0">Visits Done: <b>${visitsDone.c}</b></p>
          <p style="margin:5px 0">Follow-ups: <b>${followupsDone.c}</b></p>
        </div>
      </div>

      <h3>User Contribution (Full Week)</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #34495e; color: white; text-align: left;">
            <th style="padding: 8px; border: 1px solid #ddd;">User</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Leads</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Visits</th>
            <th style="padding: 8px; border: 1px solid #ddd;">F-ups</th>
          </tr>
        </thead>
        <tbody>
          ${userStats.map(s => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${s.name}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${s.leads}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${s.visits}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${s.followups}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 12px; color: #999; margin-top: 30px;">Weekly report generated on Monday morning.</p>
    </div>
  `;

  await sendEmail(`Weekly MIS Report (${start} - ${end})`, html);
}

export async function generateWeekendMISReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dayName = format(new Date(), 'EEEE');
  console.log(`[MIS] Generating Weekend Summary (${dayName})...`);
  
  // Reuse daily logic but with different title
  await generateDailyMISReport();
}

export async function generateAttendanceMISReport() {
  const now = new Date();
  const startOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
  const endOfMonth = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
  const monthName = format(now, 'MMMM yyyy');

  console.log(`[MIS] Generating Attendance Report for ${monthName}...`);

  const attendanceData = await sql<any>(`
    SELECT a.*, u.name as userName 
    FROM attendance a 
    JOIN users u ON a.userId = u.id 
    WHERE a.date BETWEEN ? AND ?
    ORDER BY a.date DESC, u.name ASC
  `, [startOfMonth, endOfMonth]);

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 800px; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">Attendance MIS Report - ${monthName}</h2>
      <p style="color: #7f8c8d; font-size: 14px;">Generated on: <b>${format(new Date(), 'PPP p')}</b></p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #27ae60; color: white; text-align: left;">
            <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
            <th style="padding: 10px; border: 1px solid #ddd;">User</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Clock In</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Clock Out</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceData.length === 0 ? '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No attendance records found for this month yet.</td></tr>' : ''}
          ${attendanceData.map(a => {
            const checkIn = a.checkIn ? format(new Date(a.checkIn.time), 'hh:mm a') : '---';
            const checkOut = a.checkOut ? format(new Date(a.checkOut.time), 'hh:mm a') : '---';
            const statusColor = a.status === 'present' ? '#27ae60' : (a.status === 'missed_punch' ? '#f39c12' : '#e74c3c');
            
            return `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${format(new Date(a.date), 'dd MMM (EEE)')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${a.userName}</td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #27ae60;">${checkIn}</td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #2980b9;">${checkOut}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">
                  <span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase; font-size: 10px;">${a.status.replace('_', ' ')}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <p style="font-size: 12px; color: #999; margin-top: 30px;">This report is sent every Monday and Saturday morning to track staff attendance.</p>
    </div>
  `;

  await sendEmail(`Attendance MIS Report - ${monthName}`, html);
}

async function sendEmail(subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[MIS] SMTP not configured, printing to console");
    console.log("SUBJECT:", subject);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: RECIPIENT, subject, html });
    console.log("[MIS] Email sent to", RECIPIENT);
  } catch (e: any) {
    console.error("[MIS] Email Failed:", e.message);
  }
}

export function setupMISReports() {
  console.log("[MIS] Scheduling reports...");
  
  // Daily at 8:00 PM IST (14:30 UTC)
  cron.schedule("30 14 * * *", () => {
    generateDailyMISReport().catch(console.error);
  });

  // Weekly at 9:00 AM IST on Monday (03:30 UTC)
  cron.schedule("30 3 * * 1", () => {
    generateWeeklyMISReport().catch(console.error);
  });

  // Saturday & Sunday at 10:00 AM IST (04:30 UTC)
  cron.schedule("30 4 * * 6,0", () => {
    generateWeekendMISReport().catch(console.error);
  });

  // Attendance Report: Monday & Saturday at 10:00 AM IST (04:30 UTC)
  cron.schedule("30 4 * * 1,6", () => {
    generateAttendanceMISReport().catch(console.error);
  });

  console.log("[MIS] Scheduled: Daily@8PM, Weekly@Mon9AM, Weekend@Sat-Sun10AM, Attendance@Mon-Sat10AM");
}

