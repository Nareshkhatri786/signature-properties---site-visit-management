import { Lead, Visit, LeadStatus, VisitStatus, Activity, ActivityType, User } from '../types';
import { generateId } from './storage';

/**
 * The SyncEngine is responsible for maintaining data integrity across the app.
 * It ensures that when one entity (e.g., a Visit) changes, all related entities 
 * (e.g., the Lead's status and stats) are updated accordingly.
 */
export const syncEngine = {
  /**
   * Updates a lead's status and stats based on a visit's completion.
   */
  handleVisitCompletion: (
    lead: Lead, 
    visit: Visit, 
    outcome: string, 
    feedback: string,
    user: User
  ): { updatedLead: Lead; updatedVisit: Visit; activity: Activity } => {
    const completedAt = new Date().toISOString();

    // 1. Update the Visit
    const updatedVisit: Visit = {
      ...visit,
      visit_status: 'completed' as VisitStatus,
      client_feedback: feedback,
      outcome: outcome,
      completed_at: completedAt
    };

    // 2. Update the Lead
    const updatedLead: Lead = {
      ...lead,
      status: 'visit_done' as LeadStatus,
      updated_at: completedAt,
      stats: {
        ...lead.stats,
        visits_done: (lead.stats.visits_done || 0) + 1
      }
    };

    // 3. Create Activity Log
    const activity: Activity = {
      id: generateId(),
      type: 'visit_done' as ActivityType,
      userId: user.id,
      userName: user.name,
      projectId: visit.projectId,
      targetId: lead.id,
      targetName: lead.name,
      timestamp: completedAt,
      details: `Outcome: ${outcome.toUpperCase()} | Feedback: ${feedback}`
    };

    return { updatedLead, updatedVisit, activity };
  },

  /**
   * Re-calculates lead stats based on actual visit records.
   * Useful for "Self-Healing" data audits.
   */
  reconcileLeadStats: (lead: Lead, leadVisits: Visit[]): Lead => {
    const planned = leadVisits.filter(v => v.visit_status === 'scheduled' || v.visit_status === 'rescheduled').length;
    const done = leadVisits.filter(v => v.visit_status === 'completed').length;

    return {
      ...lead,
      stats: {
        ...lead.stats,
        visits_planned: planned,
        visits_done: done
      }
    };
  }
};
