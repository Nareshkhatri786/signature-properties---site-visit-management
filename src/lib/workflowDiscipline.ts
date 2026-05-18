import { FollowUp, Lead, Visit } from '../types';
import { getLocalDateString } from './utils';

export const NEXT_ACTION_TYPES = [
  'Follow-up Call',
  'Callback Later',
  'Site Visit',
  'Visit Reminder',
  'Negotiation Call',
  'Loan Discussion',
  'Family Discussion',
  'Documentation',
  'Revisit',
  'Close Lead',
] as const;

export type NextActionType = typeof NEXT_ACTION_TYPES[number];

export const ACTIVE_LEAD_EXCLUDED_STATUSES = new Set(['closed', 'lost']);
export const ACTIVE_LEAD_EXCLUDED_QUALITIES = new Set(['disq']);

export function isLeadActiveForDiscipline(lead?: Lead | null) {
  if (!lead) return false;
  if (ACTIVE_LEAD_EXCLUDED_STATUSES.has(String(lead.status || '').toLowerCase())) return false;
  if (ACTIVE_LEAD_EXCLUDED_QUALITIES.has(String(lead.quality || '').toLowerCase())) return false;
  return true;
}

export function getLeadPendingNextAction(followUps: FollowUp[], leadId?: string | null) {
  if (!leadId) return null;
  return followUps
    .filter((f) => String(f.leadId || '') === String(leadId) && f.status === 'pending')
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null;
}

export function getOverdueState(nextAction?: FollowUp | null) {
  if (!nextAction || nextAction.status !== 'pending') return { overdue: false, days: 0 };
  const today = getLocalDateString();
  const date = String(nextAction.date || '').slice(0, 10);
  if (!date || date >= today) return { overdue: false, days: 0 };
  const diff = Math.max(
    1,
    Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  );
  return { overdue: true, days: diff };
}

export type QuickActionChipKey =
  | 'interested'
  | 'busy'
  | 'no_answer'
  | 'call_later'
  | 'visit_planned'
  | 'budget_issue'
  | 'loan_issue'
  | 'family_discussion';

export const QUICK_ACTION_CHIPS: Record<QuickActionChipKey, { label: string; actionType: NextActionType; days: number; method: 'call' | 'whatsapp'; suggestedPriority?: number }> = {
  interested: { label: 'Interested', actionType: 'Follow-up Call', days: 1, method: 'call', suggestedPriority: 3 },
  busy: { label: 'Busy', actionType: 'Callback Later', days: 0, method: 'call', suggestedPriority: 2 },
  no_answer: { label: 'No Answer', actionType: 'Callback Later', days: 0, method: 'call', suggestedPriority: 2 },
  call_later: { label: 'Call Later', actionType: 'Callback Later', days: 1, method: 'call', suggestedPriority: 2 },
  visit_planned: { label: 'Visit Planned', actionType: 'Visit Reminder', days: 1, method: 'whatsapp', suggestedPriority: 3 },
  budget_issue: { label: 'Budget Issue', actionType: 'Negotiation Call', days: 1, method: 'call', suggestedPriority: 2 },
  loan_issue: { label: 'Loan Issue', actionType: 'Loan Discussion', days: 1, method: 'call', suggestedPriority: 2 },
  family_discussion: { label: 'Family Discussion', actionType: 'Family Discussion', days: 2, method: 'call', suggestedPriority: 2 },
};

export function addDaysISO(baseDate: string, days: number) {
  const d = new Date(`${baseDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function visitNeedsStructuredNextAction(visit: Visit) {
  if (visit.visit_status !== 'completed') return false;
  const hasOutcome = !!String(visit.outcome || '').trim();
  return !hasOutcome || String(visit.outcome) === 'follow_up_required';
}
