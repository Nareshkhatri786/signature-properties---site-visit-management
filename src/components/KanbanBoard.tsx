import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead, LeadStatus, LeadQuality, User as AppUser, FollowUp, Visit } from '../types';
import { Phone, Calendar, User as UserIcon, MoreVertical, MessageSquare, ShieldCheck, Star } from 'lucide-react';
import { cn, getLocalDateString } from '../lib/utils';
import { StatusBadge } from './Dashboard';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';

type FollowUpFilter = 'overdue' | 'today' | 'upcoming' | 'none' | null;

const STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New Inquiry', color: '#9A8262' },
  { id: 'contacted', label: 'Contacted', color: '#3498DB' },
  { id: 'visit_scheduled', label: 'Visit Scheduled', color: '#8E44AD' },
  { id: 'visit_done', label: 'Visit Done', color: '#27AE60' },
  { id: 'closed', label: 'Deal Closed', color: '#C9A84C' },
  { id: 'lost', label: 'Lead Lost', color: '#E74C3C' }
];

interface KanbanBoardProps {
  leads: Lead[];
  users: AppUser[];
  followUps: FollowUp[];
  visits: Visit[];
  onUpdateStatus: (leadId: string, newStatus: LeadStatus) => void;
  onSelectLead: (lead: Lead) => void;
  onCall: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
}

export default function KanbanBoard({ leads, users, followUps, visits, onUpdateStatus, onSelectLead, onCall, onWhatsApp }: KanbanBoardProps) {
  const [columnFilters, setColumnFilters] = useState<Record<string, FollowUpFilter>>({});
  const today = getLocalDateString();

  const getFollowUpStatus = (leadId: string) => {
    const nextFollowUp = getLeadFollowUp(followUps, leadId, undefined, visits);
    return getFollowUpDisplayStatus(nextFollowUp);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    onUpdateStatus(draggableId, destination.droppableId as LeadStatus);
  };

  const toggleFilter = (stageId: string, status: FollowUpFilter) => {
    setColumnFilters(prev => ({
      ...prev,
      [stageId]: prev[stageId] === status ? null : status
    }));
  };

  return (
    <div className="h-[calc(100vh-280px)] overflow-x-auto pb-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const allStageLeads = [
              ...leads.filter(l => l.status === stage.id),
              ...(stage.id === 'new' ? leads.filter(l => !l.status || !STAGES.find(s => s.id === l.status)) : [])
            ].sort((a, b) => {
                const priA = a.priority || 0;
                const priB = b.priority || 0;
                if (priA !== priB) return priB - priA;
                return b.created_at.localeCompare(a.created_at);
              });

            const activeFilter = columnFilters[stage.id];
            
            const stageLeads = activeFilter 
              ? allStageLeads.filter(l => getFollowUpStatus(l.id) === activeFilter)
              : allStageLeads;

            // Calculate Follow-up Health Bar Data
            const counts = allStageLeads.reduce((acc, lead) => {
              const status = getFollowUpStatus(lead.id);
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const total = allStageLeads.length;
            const getPercent = (count: number) => total > 0 ? (count / total) * 100 : 0;
            
            return (
              <div key={stage.id} className="w-80 flex flex-col group">
                {/* Column Header */}
                <div className="mb-4 px-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <div className="flex flex-col">
                        <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] uppercase tracking-wide">
                          {stage.label}
                        </h3>
                        {activeFilter && (
                          <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider -mt-1">
                            Filtering: {activeFilter}
                          </span>
                        )}
                      </div>
                      <span className="bg-[#E6D8B8]/30 px-2 py-0.5 rounded text-[10px] font-bold text-[#9A8262]">
                        {stageLeads.length} / {total}
                      </span>
                    </div>
                    <button className="text-[#9A8262] opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  {/* Horizontal Health Bar */}
                  <div className="h-2 w-full bg-[#E6D8B8]/20 rounded-full overflow-hidden flex cursor-pointer shadow-inner">
                    <div 
                      className={cn(
                        "h-full bg-red-500 transition-all duration-300 hover:brightness-110",
                        activeFilter === 'overdue' ? "ring-2 ring-inset ring-white" : activeFilter ? "opacity-30" : ""
                      )} 
                      style={{ width: `${getPercent(counts.overdue || 0)}%` }} 
                      title={`Overdue: ${counts.overdue || 0}`}
                      onClick={() => toggleFilter(stage.id, 'overdue')}
                    />
                    <div 
                      className={cn(
                        "h-full bg-orange-500 transition-all duration-300 hover:brightness-110 border-l border-white/20",
                        activeFilter === 'today' ? "ring-2 ring-inset ring-white" : activeFilter ? "opacity-30" : ""
                      )} 
                      style={{ width: `${getPercent(counts.today || 0)}%` }}
                      title={`Today: ${counts.today || 0}`}
                      onClick={() => toggleFilter(stage.id, 'today')}
                    />
                    <div 
                      className={cn(
                        "h-full bg-green-500 transition-all duration-300 hover:brightness-110 border-l border-white/20",
                        activeFilter === 'upcoming' ? "ring-2 ring-inset ring-white" : activeFilter ? "opacity-30" : ""
                      )} 
                      style={{ width: `${getPercent(counts.upcoming || 0)}%` }}
                      title={`Upcoming: ${counts.upcoming || 0}`}
                      onClick={() => toggleFilter(stage.id, 'upcoming')}
                    />
                    <div 
                      className={cn(
                        "h-full bg-gray-300 transition-all duration-300 hover:brightness-110 border-l border-white/20",
                        activeFilter === 'none' ? "ring-2 ring-inset ring-white" : activeFilter ? "opacity-30" : ""
                      )} 
                      style={{ width: `${getPercent(counts.none || 0)}%` }}
                      title={`No Follow-up: ${counts.none || 0}`}
                      onClick={() => toggleFilter(stage.id, 'none')}
                    />
                  </div>
                </div>

                {/* Column Content */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "flex-1 bg-[#F5F1E6]/50 border border-dashed border-[#E6D8B8] rounded-2xl p-3 transition-colors overflow-y-auto min-h-[150px]",
                        snapshot.isDraggingOver && "bg-[#C9A84C]/5 border-[#C9A84C]/30"
                      )}
                    >
                      <div className="space-y-3">
                        {stageLeads.map((lead, index) => {
                          const DraggableComponent = Draggable as any;
                          const priority = lead.priority || 0;
                          return (
                            <DraggableComponent key={lead.id} draggableId={lead.id} index={index}>
                              {(provided: any, snapshot: any) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-white border border-[#E6D8B8] rounded-xl p-4 shadow-sm hover:shadow-md transition-all active:scale-95",
                                    snapshot.isDragging && "shadow-xl border-[#C9A84C] scale-105 rotate-2"
                                  )}
                                  onClick={() => onSelectLead(lead)}
                                >
                                <div className="flex justify-between items-start mb-2">
                                  <StatusBadge status={lead.quality} />
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3].map((s) => (
                                      <Star 
                                        key={s} 
                                        size={10} 
                                        className={cn(s <= priority ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} 
                                      />
                                    ))}
                                  </div>
                                </div>
                                
                                <h4 className="font-['Cormorant_Garamond'] text-[15px] font-bold text-[#2A1C00] mb-1">
                                  {lead.name}
                                </h4>
                                
                                <p className="text-[#9A8262] text-[11px] font-medium flex items-center gap-1.5 mb-2">
                                  <UserIcon size={12} /> {lead.mobile}
                                </p>
                                
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#E6D8B8]/50">
                                  <div className="flex flex-col gap-1">
                                    <p className="text-[10px] text-[#9A8262] italic flex items-center gap-1">
                                      <Phone size={10} className={cn((lead.stats?.calls_answered || 0) > 0 ? "text-green-500" : "text-gray-300")} />
                                      {lead.stats?.calls_answered || 0} Ans.
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <Calendar size={10} className={cn(
                                        getFollowUpStatus(lead.id) === 'overdue' ? "text-red-500" :
                                        getFollowUpStatus(lead.id) === 'today' ? "text-orange-500" :
                                        getFollowUpStatus(lead.id) === 'upcoming' ? "text-green-500" : "text-gray-300"
                                      )} />
                                      <span className="text-[9px] font-bold uppercase tracking-wider">
                                        {getFollowUpStatus(lead.id) === 'none' && lead.status === 'lost' ? 'Not Required' : getFollowUpStatus(lead.id)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      onClick={() => onCall(lead)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                      <Phone size={14} />
                                    </button>
                                    <button 
                                      onClick={() => onWhatsApp(lead)}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    >
                                      <MessageSquare size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DraggableComponent>
                        );
                      })}
                      </div>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
