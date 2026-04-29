# DiyaCRM — MySQL Deployment Guide

## Prerequisites
- Node.js 18+
- MySQL 8.0 or MariaDB 10.6+

---

## Step 1: Create Database

```bash
mysql -u root -p
CREATE DATABASE diyacrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER `''`crm_user`''`@`''`localhost`''` IDENTIFIED BY `''`your_password`''`;
GRANT ALL PRIVILEGES ON diyacrm.* TO `''`crm_user`''`@`''`localhost`''`;
FLUSH PRIVILEGES;
EXIT;
```

## Step 2: Run Schema

```bash
mysql -u crm_user -p diyacrm < schema.sql
```

## Step 3: Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual DB credentials and JWT secret
```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Seed Admin User

```bash
npx tsx seed-admin.ts
# Creates: username=admin, password=admin123
```

## Step 6: (Optional) Import Firebase Backup

If you have a Firebase JSON export:
```bash
npx tsx migrate-from-firebase.ts ./firebase-backup.json
```

Firebase backup format expected:
```json
{
  "leads": [...],
  "visits": [...],
  "followups": [...],
  "users": [...],
  "projects": [...],
  "remarks": [...],
  "activities": [...],
  "call_logs": [...],
  "templates": [...],
  "webhook_configs": [...],
  "settings": {...}
}
```

## Step 7: Run Development

```bash
npm run dev
```

## Step 8: Production Build + Start

```bash
npm run build
npm start
```

---

## WhatsApp Webhook Mapping
The mapping in server.ts (`mappingTable`) links WhatsApp Business number IDs to projects:
```ts
"916390071558584":    { projectId: "p3", userName: "Hemant" },
"122101071140010719": { projectId: "p4", userName: "Priyank" },
"1152168267972565":   { projectId: "p2", userName: "Megha" },
```
Update this mapping via the Settings > Webhooks page or directly in server.ts.

---

## Environment Variables

| Variable | Description |
|---|---|
| DB_HOST | MySQL host (default: localhost) |
| DB_PORT | MySQL port (default: 3306) |
| DB_USER | MySQL username |
| DB_PASS | MySQL password |
| DB_NAME | Database name (default: diyacrm) |
| JWT_SECRET | JWT signing secret (change this!) |
| PORT | Server port (default: 3000) |
| SMTP_HOST | SMTP host for email reports |
| SMTP_PORT | SMTP port (587 or 465) |
| SMTP_USER | SMTP username/email |
| SMTP_PASS | SMTP app password |
| REPORT_RECIPIENT | Email to receive MIS reports |

---

## Google AI Studio Compatibility

The app now uses pure REST APIs (`/api/*`). 
You can use Google AI Studio to modify or extend:
- `server.ts` — add new API endpoints
- `src/App.tsx` — modify frontend logic
- `schema.sql` — add new tables/columns

No Firebase dependencies required.
