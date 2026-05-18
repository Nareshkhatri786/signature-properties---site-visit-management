import nodemailer from 'nodemailer';
import cron from 'node-cron';
import mysql from 'mysql2/promise';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { askClaudeAWS } from './claude-service.js';


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

const PROJECT_DAILY_MIS_RECIPIENTS: Array<{ projectNameLike: string; email: string }> = [
  { projectNameLike: "royal rudraksha", email: "ps002448@gmail.com" },
  { projectNameLike: "shreemad family", email: "pandya.keval91@gmail.com" },
  { projectNameLike: "devi bungalows", email: "hp8935311@gmail.com" },
];

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

// --- AI Insights Helper ---
async function getAIReportInsight(reportType: string, data: any) {
  const prompt = `
    Analyze this ${reportType} data for Signature Properties CRM and provide a concise executive summary.
    Focus on:
    1. Overall performance trends.
    2. Specific projects or users needing attention.
    3. Actionable advice for the management.
    
    Data:
    ${JSON.stringify(data)}
    
    Keep the tone professional and strategic. Use bullet points for action items.
  `;
  try {
    return await askClaudeAWS(prompt, "You are a senior real estate business analyst.");
  } catch (e) {
    return "AI Insight currently unavailable.";
  }
}

// --- Report Generators ---

export async function generateDailyMISReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const startOfWeek = format(subDays(now, 7), 'yyyy-MM-dd');
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  console.log(`[MIS] Generating Detailed Daily Report for ${today}...`);

  // 1. Project Stats
  const allProjectStats = await sql<any>(`
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
  `, [today, today, today, today, startOfWeek, monthStart]);

  // 2. User Stats (all users, all projects)
  const allUserStats = await sql<any>(`
    SELECT 
      u.id as userId,
      u.projectId as userProjectId,
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
  const [monthlyNew] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) >= ?", [monthStart]);

  const aiInsight = await getAIReportInsight('Daily MIS', { projectStats: allProjectStats, userStats: allUserStats });

  const [projectRows] = [await sql<any>("SELECT id, name FROM projects")];

  // Build project-wise daily mails to specific recipients
  for (const target of PROJECT_DAILY_MIS_RECIPIENTS) {
    const matchedProject = projectRows.find((p: any) => String(p.name || "").toLowerCase().includes(target.projectNameLike));
    if (!matchedProject?.id) continue;

    const projectStats = allProjectStats.filter((p: any) => String(p.id) === String(matchedProject.id));
    const userStats = allUserStats.filter((u: any) => String(u.userProjectId) === String(matchedProject.id));

    const projectInsight = await getAIReportInsight(`Daily MIS - ${matchedProject.name}`, { projectStats, userStats });

    const projectHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 1000px; padding: 20px;">
      <h2 style="font-size: 18px; margin-bottom: 8px; text-transform: uppercase; color: #C9A84C;">Daily MIS Report - ${today}</h2>
      <p style="margin-top: 0; font-size: 13px; color: #5C4820;"><b>Project:</b> ${matchedProject.name}</p>
      
      <div style="background: #FFF9E6; border: 1px solid #C9A84C; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin-top: 0; color: #1C1207; font-size: 16px; border-bottom: 1px solid #C9A84C; padding-bottom: 10px;">✨ Signature AI Audit</h3>
        <div style="font-size: 14px; line-height: 1.6; color: #444;">
          ${projectInsight.replace(/\n/g, '<br/>')}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; border: 1px solid #ddd;">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Project</th>
            <th style="padding: 10px; border: 1px solid #ddd;">New Leads</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Active Leads</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Sch Today</th>
            <th style="padding: 10px; border: 1px solid #ddd;">V.Done Today</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Weekly New</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Monthly New</th>
          </tr>
        </thead>
        <tbody>
          ${projectStats.map((p: any) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #fdfdfd;">${p.projectName}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.newLeads}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.activeLeads}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vSchToday}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.vDoneToday}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.weeklyNew}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.monthlyNew}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

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
          ${userStats.map((u: any) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #fdfdfd;">${u.userName}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.callsAttempted}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.callsConnected}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.leadsHandled}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.visitsSch}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${u.visitsDone}</td>
            </tr>
          `).join('')}
          ${userStats.length === 0 ? '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #777;">No users mapped to this project.</td></tr>' : ''}
        </tbody>
      </table>

      <p style="font-size: 11px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
        Sent automatically by Signature Properties CRM — Daily Performance Audit.
      </p>
    </div>
    `;

    await sendEmail(`Daily MIS Report - ${matchedProject.name} - ${today}`, projectHtml, target.email);
  }

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 1000px; padding: 20px;">
      <h2 style="font-size: 18px; margin-bottom: 20px; text-transform: uppercase; color: #C9A84C;">Daily MIS Report - ${today}</h2>
      
      <!-- AI AUDIT SECTION -->
      <div style="background: #FFF9E6; border: 1px solid #C9A84C; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin-top: 0; color: #1C1207; font-size: 16px; border-bottom: 1px solid #C9A84C; padding-bottom: 10px;">✨ Signature AI Audit</h3>
        <div style="font-size: 14px; line-height: 1.6; color: #444;">
          ${aiInsight.replace(/\n/g, '<br/>')}
        </div>
      </div>

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
          ${allProjectStats.map(p => `
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
          ${allUserStats.map(u => `
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

  await sendEmail(`Daily MIS Report (All Projects) - ${today}`, html);
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

export async function generateMonthlyDetailedMISReport() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthName = format(now, 'MMMM yyyy');
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  console.log(`[MIS] Generating Detailed Monthly Report for ${monthName}...`);

  // 1. Fetch regular users
  const users = await sql<any>("SELECT id, name, username FROM users WHERE role NOT IN ('admin', 'adm', 'manager')");
  if (users.length === 0) return console.log("[MIS] No regular users found for report.");

  const startStr = format(monthStart, 'yyyy-MM-dd 00:00:00');
  const endStr = format(monthEnd, 'yyyy-MM-dd 23:59:59');

  // 2. Fetch all raw metrics for the month
  const [leadMetrics, callMetrics, callAnsweredMetrics, whatsappMetrics, visitPlannedMetrics, visitDoneMetrics] = await Promise.all([
    // New Leads
    sql<any>(`SELECT assignedTo, DATE(created_at) as date, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY assignedTo, date`, [startStr, endStr]),
    // Calls Made
    sql<any>(`SELECT \`by\` as userName, DATE(timestamp) as date, COUNT(*) as count FROM call_logs WHERE timestamp BETWEEN ? AND ? GROUP BY userName, date`, [startStr, endStr]),
    // Calls Answered
    sql<any>(`SELECT \`by\` as userName, DATE(timestamp) as date, COUNT(*) as count FROM call_logs WHERE outcome = 'answered' AND timestamp BETWEEN ? AND ? GROUP BY userName, date`, [startStr, endStr]),
    // WhatsApp Sent
    sql<any>(`SELECT userName, DATE(timestamp) as date, COUNT(*) as count FROM activities WHERE type = 'whatsapp_sent' AND timestamp BETWEEN ? AND ? GROUP BY userName, date`, [startStr, endStr]),
    // Visits Planned
    sql<any>(`SELECT assigned_to as userName, DATE(visit_date) as date, COUNT(*) as count FROM visits WHERE visit_date BETWEEN ? AND ? GROUP BY userName, date`, [startStr, endStr]),
    // Visits Done
    sql<any>(`SELECT assigned_to as userName, DATE(visit_date) as date, COUNT(*) as count FROM visits WHERE visit_status = 'completed' AND visit_date BETWEEN ? AND ? GROUP BY userName, date`, [startStr, endStr])
  ]);

  const metrics = [
    { label: 'Calls Made', data: callMetrics, icon: '📞', color: '#FFF5F0', headerColor: '#FF7F50' },
    { label: 'Calls Answered', data: callAnsweredMetrics, icon: '✅', color: '#F0FFF4', headerColor: '#38A169' },
    { label: 'WhatsApp Sent', data: whatsappMetrics, icon: '💬', color: '#E6FFFA', headerColor: '#319795' },
    { label: 'New Leads', data: leadMetrics, icon: '👤', color: '#F0F7FF', headerColor: '#3182CE' },
    { label: 'Visits Planned', data: visitPlannedMetrics, icon: '📅', color: '#F5F0FF', headerColor: '#9F7AEA' },
    { label: 'Visits Done', data: visitDoneMetrics, icon: '🏠', color: '#FDF2F2', headerColor: '#E53E3E' }
  ];

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; max-width: 1200px; margin: auto; padding: 20px; background-color: #f7fafc;">
      <div style="background-color: #fff; padding: 30px; border-radius: 15px; shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: #2d3748; font-size: 28px;">Detailed MIS Report</h1>
            <p style="margin: 5px 0 0; color: #718096; font-size: 16px;">${monthName}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; color: #4a5568; font-weight: bold;">Signature Properties</p>
            <p style="margin: 0; color: #a0aec0; font-size: 12px;">Generated on: ${format(now, 'dd MMM yyyy HH:mm')}</p>
          </div>
        </div>

        ${metrics.map(metric => {
          const tableData = users.map(user => {
            const row: Record<string, any> = { name: user.name, total: 0 };
            daysInMonth.forEach(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              let count = 0;
              if (metric.label === 'New Leads') {
                count = metric.data.find((d: any) => d.assignedTo === user.id && format(new Date(d.date), 'yyyy-MM-dd') === dayStr)?.count || 0;
              } else {
                count = metric.data.find((d: any) => (d.userName === user.name || d.userName === user.username) && format(new Date(d.date), 'yyyy-MM-dd') === dayStr)?.count || 0;
              }
              row[dayStr] = count;
              row.total += count;
            });
            return row;
          });

          const dayTotals = daysInMonth.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            return tableData.reduce((acc, row) => acc + row[dayStr], 0);
          });
          const grandTotal = dayTotals.reduce((acc, t) => acc + t, 0);

          return `
            <div style="margin-bottom: 40px; overflow-x: auto;">
              <h3 style="color: ${metric.headerColor}; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                <span style="background: ${metric.color}; padding: 8px; border-radius: 8px;">${metric.icon}</span>
                ${metric.label}
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; background-color: white; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; position: sticky; left: 0; background-color: #f8fafc; min-width: 120px;">USER NAME</th>
                    ${daysInMonth.map(day => `<th style="padding: 12px 4px; border: 1px solid #e2e8f0; text-align: center; min-width: 25px;">${format(day, 'd')}</th>`).join('')}
                    <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; background-color: #edf2f7; min-width: 60px;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableData.map(row => `
                    <tr style="border-bottom: 1px solid #edf2f7;">
                      <td style="padding: 10px 8px; border: 1px solid #e2e8f0; font-weight: bold; position: sticky; left: 0; background-color: white;">${row.name}</td>
                      ${daysInMonth.map(day => {
                        const count = row[format(day, 'yyyy-MM-dd')];
                        return `<td style="padding: 10px 4px; border: 1px solid #e2e8f0; text-align: center; color: ${count > 0 ? '#2d3748' : '#cbd5e0'};">${count || '-'}</td>`;
                      }).join('')}
                      <td style="padding: 10px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; background-color: #f8fafc;">${row.total}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0;">
                    <td style="padding: 12px 8px; border: 1px solid #e2e8f0; position: sticky; left: 0; background-color: #f8fafc;">TOTAL</td>
                    ${dayTotals.map(t => `<td style="padding: 12px 4px; border: 1px solid #e2e8f0; text-align: center;">${t || '-'}</td>`).join('')}
                    <td style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: center; background-color: #edf2f7;">${grandTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
        }).join('')}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #edf2f7; text-align: center; color: #a0aec0; font-size: 12px;">
          <p>Note: This report is based on the data available for the current month. All counts are recorded per user per day.</p>
          <p>© 2026 Signature Properties CRM Automation</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail(`Monthly MIS Report - ${monthName}`, html);
}

async function sendEmail(subject: string, html: string, recipient?: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[MIS] SMTP not configured, printing to console");
    console.log("SUBJECT:", subject);
    return;
  }
  try {
    const to = (recipient || RECIPIENT).trim();
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
    console.log("[MIS] Email sent to", to);
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

  // Detailed Monthly MIS: Every Monday at 10:00 AM IST (04:30 UTC)
  cron.schedule("30 4 * * 1", () => {
    generateMonthlyDetailedMISReport().catch(console.error);
  });

  console.log("[MIS] Scheduled: Daily@8PM, Weekly@Mon9AM, Weekend@Sat-Sun10AM, Attendance@Mon-Sat10AM, MonthlyDetailed@Mon10AM");
}

