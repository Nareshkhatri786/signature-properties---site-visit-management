export type LeadStatus = 'new' | 'contacted' | 'visit_scheduled' | 'visit_done' | 'closed' | 'lost';
export type LeadQuality = 'hot' | 'warm' | 'cold' | 'pending' | 'disq';
export type VisitStatus = 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
export type VisitOutcome = 'booked' | 'highly_interested' | 'follow_up_required' | 'shared_quotation' | 'negotiation' | 'not_interested';

export type TemplateType = 'reminder' | 'welcome' | 'thank_you' | 'follow_up' | 'custom';

export type Page = 'dashboard' | 'leads' | 'lead-detail' | 'visits' | 'add-visit' | 'detail' | 'whatsapp' | 'templates' | 'settings' | 'reports' | 'webhooks' | 'followups' | 'workflow';

export type CallOutcome = 'answered' | 'not_answered' | 'busy' | 'switched_off';

export type ActivityType = 
  | 'lead_created' 
  | 'lead_updated' 
  | 'lead_status_changed'
  | 'lead_quality_changed'
  | 'lead_transferred' 
  | 'call_attempted' 
  | 'call_answered' 
  | 'visit_scheduled' 
  | 'visit_rescheduled'
  | 'visit_completed'
  | 'visit_done' 
  | 'visit_cancelled'
  | 'visit_no_show'
  | 'whatsapp_sent' 
  | 'remark_added'
  | 'followup_scheduled'
  | 'followup_completed'
  | 'followup_done'
  | 'followup_rescheduled'
  | 'followup_cancelled'
  | 'bulk_assigned'
  | 'client_visit_reminder';

export interface Activity {
  id: string;
  type: ActivityType;
  userId: number;
  userName: string;
  projectId: string;
  targetId: string; // Lead or Visit ID
  targetName: string;
  timestamp: string;
  details?: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';
export type FollowUpMethod = 'call' | 'whatsapp';

export interface FollowUp {
  id: string;
  leadId?: string;
  visitId?: string;
  projectId: string;
  userId?: number;
  userName?: string;
  date: string;
  scheduled_at?: string;
  purpose: string;
  method: FollowUpMethod;
  status: FollowUpStatus;
  created_at: string;
  completed_at?: string;
  outcome_note?: string;
}

export interface Project {
  id: string;
  name: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
    radius: number;
  };
}

export interface Settings {
  company: string;
  phone: string;
  address: string;
  sources: string[];
  budgets: string[];
  propertyInterests: string[];
}

export interface User {
  id: number;
  username: string;
  password?: string;
  name: string;
  projectId: string;
  role: 'admin' | 'manager' | 'user';
  uid?: string; // Firebase Auth UID for session recovery
  assignedProjectIds?: string[]; // Projects managed by this user (if role is manager)
  workingHours?: {
    start: string; // HH:mm
    end: string;   // HH:mm
  };
  assignedLocation?: {
    lat: number;
    lng: number;
    address: string;
    radius: number; // in meters
  };
}

export interface Attendance {
  id: string;
  userId: number;
  date: string; // YYYY-MM-DD
  checkIn?: {
    time: string; // ISO
    lat: number;
    lng: number;
    onTime: boolean;
  };
  checkOut?: {
    time: string; // ISO
    lat: number;
    lng: number;
    forced: boolean;
  };
  status: 'present' | 'absent' | 'missed_punch';
}

export interface UserNotification {
  id: string;
  userId: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  isAdmin: boolean;
  metadata?: any;
}

export interface Lead {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  source: string;
  quality: LeadQuality;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  projectId: string;
  assignedTo?: number;
  assignedToName?: string;
  budget?: string;
  property_interest?: string;
  priority?: number;
  
  // Lifecycle tracking
  stats: {
    visits_planned: number;
    visits_done: number;
    calls_attempted: number;
    calls_answered: number;
    followups_done: number;
  };
}

export interface WebhookConfig {
  id: string;
  name: string;
  token: string;
  projectId?: string;
  assignedTo?: number;
  assignedUserIds?: number[];
  lastAssignedIndex?: number;
  mapping: Record<string, string>; // e.g. { "full_name": "name", "phone_number": "mobile" }
  active: boolean;
}

export interface CallLog {
  id: string;
  visitId: string;
  leadId?: string;
  projectId: string;
  outcome: CallOutcome;
  note?: string;
  timestamp: string;
  by: string;
}

export type RemarkCategory = 'general' | 'price' | 'location' | 'amenities' | 'legal' | 'competitor' | 'negotiation';
export type RemarkSentiment = 'neutral' | 'positive' | 'negative' | 'excited' | 'skeptical';

export interface Remark {
  id: string;
  text: string;
  by: string;
  at: string;
  type?: 'remark' | 'visit_note';
  category?: RemarkCategory;
  sentiment?: RemarkSentiment;
}

export interface VisitFilters {
  period?: 'today' | 'week' | 'month' | '';
  status?: LeadQuality | '';
  visitStatus?: VisitStatus | '';
  search?: string;
}

export interface Visit {
  id: string;
  leadId?: string; // Link to Lead
  client_name: string;
  mobile: string;
  email?: string;
  visit_date: string;
  visit_time?: string;
  purpose?: string;
  status: LeadQuality; // Renamed from LeadStatus to LeadQuality in types
  visit_status: VisitStatus;
  projectId: string;
  created_at: string;
  completed_at?: string;
  assigned_to?: string;
  source?: string;
  budget?: string;
  property_interest?: string;
  priority?: number;
  reminders_sent?: string[]; // e.g. ['24h', '2h']
  
  // Post-visit data
  client_feedback?: string;
  interest_level?: LeadQuality;
  outcome?: VisitOutcome;
  
  // Reschedule history
  reschedule_log?: {
    previous_date: string;
    previous_time?: string;
    new_date: string;
    new_time?: string;
    at: string;
  }[];
}

export interface WhatsAppMessage {
  id: string;
  leadId?: string;
  visitId?: string;
  senderName: string;
  senderPhoneNumber: string;
  content: string;
  timestamp: string;
  type: 'incoming' | 'outgoing';
}

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  message: string;
  fileData?: string | null;
  fileName?: string | null;
  fileType: 'image' | 'pdf' | 'video' | 'none';
  active: boolean;
}
export type WorkflowTrigger = 'lead_created' | 'status_changed' | 'visit_scheduled' | 'no_activity';
export type WorkflowAction = 'assign_user' | 'send_whatsapp' | 'schedule_followup' | 'change_status';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: WorkflowTrigger;
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  }[];
  actions: {
    type: WorkflowAction;
    params: Record<string, any>;
  }[];
  createdAt: string;
  updatedAt: string;
}
