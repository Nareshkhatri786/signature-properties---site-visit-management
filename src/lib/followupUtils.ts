import { FollowUp, Visit } from '../types';
import { getLocalDateString } from './utils';

export type FollowUpDisplayStatus = 'overdue' | 'today' | 'upcoming' | 'completed' | 'none';

export function getLeadFollowUp(
  followUps: FollowUp[],
  leadId?: string,
  visitId?: string,
  visits?: Visit[]
): FollowUp | null {
  if (!leadId && !visitId) return null;

  const targetLeadId = leadId ? String(leadId) : null;
  const targetVisitId = visitId ? String(visitId) : null;

  const relevant = followUps.filter(f => {
    // Basic ID cleanup - ensure we don't treat "null" or "undefined" as valid string IDs
    const fLeadId = (f.leadId && f.leadId !== 'null' && f.leadId !== 'undefined') ? String(f.leadId) : null;
    const fVisitId = (f.visitId && f.visitId !== 'null' && f.visitId !== 'undefined') ? String(f.visitId) : null;

    // 1. Direct match by leadId
    if (targetLeadId && fLeadId && fLeadId === targetLeadId) return true;
    
    // 2. Direct match by visitId
    if (targetVisitId && fVisitId && fVisitId === targetVisitId) return true;
    
    // 3. Match via visits array (if we have leadId, check if follow-up's visitId belongs to lead)
    if (targetLeadId && visits && fVisitId) {
      const visit = visits.find(v => String(v.id) === fVisitId);
      if (visit && (visit.leadId && String(visit.leadId) === targetLeadId)) return true;
    }

    // 4. Inverse match via visits array (if we have visitId, check if follow-up's leadId matches visit's lead)
    if (targetVisitId && visits && fLeadId) {
      const visit = visits.find(v => String(v.id) === targetVisitId);
      if (visit && (visit.leadId && String(visit.leadId) === fLeadId)) return true;
    }
    
    return false;
  });

  if (relevant.length === 0) return null;

  // Find the earliest pending follow-up
  const pending = relevant
    .filter(f => (f.status || 'pending') === 'pending')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (pending.length > 0) return pending[0];

  // If no pending, find the most recent completed follow-up
  const completed = [...relevant]
    .filter(f => f.status === 'completed')
    .sort((a, b) => (b.completed_at || b.date || '').localeCompare(a.completed_at || a.date || ''));

  return completed.length > 0 ? completed[0] : null;
}

export function getFollowUpDisplayStatus(followUp: FollowUp | null | undefined): FollowUpDisplayStatus {
  if (!followUp) return 'none';
  if (followUp.status === 'completed') return 'completed';
  
  const today = getLocalDateString();
  if (followUp.date < today) return 'overdue';
  if (followUp.date === today) return 'today';
  return 'upcoming';
}

export function getFollowUpStatusInfo(status: FollowUpDisplayStatus, isLost?: boolean) {
  switch (status) {
    case 'overdue':
      return { label: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200' };
    case 'today':
      return { label: 'Due Today', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' };
    case 'upcoming':
      return { label: 'Upcoming', color: 'bg-blue-50 text-blue-600 border-blue-200' };
    case 'completed':
      return { label: 'Done', color: 'bg-green-50 text-green-600 border-green-200' };
    default:
      return { 
        label: isLost ? 'No Follow-up Required' : 'No Follow-up Scheduled', 
        color: 'bg-gray-50 text-gray-500 border-gray-200' 
      };
  }
}
