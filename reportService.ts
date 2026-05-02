import nodemailer from 'nodemailer';
import cron from 'node-cron';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { format, subDays } from 'date-fns';

dotenv.config();

let globalPool: mysql.Pool | null = null;

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

// --- Report Generators ---

export async function generateDailyMISReport() {
  const today = format(new Date(), 'yyyy-MM-dd');
  console.log(`[MIS] Generating Daily Report for ${today}...`);

  const [newLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) = ?", [today]);
  const [hotLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) = ? AND quality = 'hot'", [today]);
  const [warmLeads] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) = ? AND quality = 'warm'", [today]);
  
  const [visitsSch] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE visit_date = ? AND visit_status = 'scheduled'", [today]);
  const [visitsDone] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE visit_date = ? AND visit_status = 'completed'", [today]);

  const [followupsDone] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE date = ? AND status = 'completed'", [today]);

  const users = await sql<any>("SELECT id, name FROM users");
  const userStats = await Promise.all(users.map(async u => {
    const [l] = await sql<any>("SELECT COUNT(*) AS c FROM leads WHERE assignedTo = ? AND DATE(created_at) = ?", [u.id, today]);
    const [v] = await sql<any>("SELECT COUNT(*) AS c FROM visits WHERE assigned_to = ? AND visit_date = ? AND visit_status = 'completed'", [u.id, today]);
    const [f] = await sql<any>("SELECT COUNT(*) AS c FROM followups WHERE userId = ? AND date = ? AND status = 'completed'", [u.id, today]);
    return { name: u.name, leads: l.c, visits: v.c, followups: f.c };
  }));

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #C9A84C; border-bottom: 2px solid #C9A84C; padding-bottom: 10px;">Daily MIS Report - ${today}</h2>
      
      <div style="margin: 20px 0; background: #f9f9f9; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top:0">Today's Overview</h3>
        <table style="width: 100%; text-align: left;">
          <tr><td>New Leads:</td><td><b>${newLeads.c}</b> (Hot: ${hotLeads.c}, Warm: ${warmLeads.c})</td></tr>
          <tr><td>Visits:</td><td><b>${visitsDone.c} Completed</b> (${visitsSch.c} Scheduled)</td></tr>
          <tr><td>Follow-ups:</td><td><b>${followupsDone.c} Completed</b></td></tr>
        </table>
      </div>

      <h3>User Performance (Today)</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f0f0f0; text-align: left;">
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

      <p style="font-size: 12px; color: #999; margin-top: 30px;">Sent automatically by Signature Properties CRM at 8:00 PM IST.</p>
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

  console.log("[MIS] Scheduled: Daily@8PM, Weekly@Mon9AM, Weekend@Sat-Sun10AM");
}

