import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Visit, VisitStatus, User, FollowUp, Lead } from '../types';
import { Phone, Calendar, User as UserIcon, MessageSquare, Star, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { StatusBadge, VisitBadge } from './Dashboard';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';

const STAGES: { id: VisitStatus; label: string; color: string }[] = [
  { id: 'scheduled', label: 'Scheduled', color: '#8E44AD' },
  { id: 'completed', label: 'Done / Completed', color: '#27AE60' },
  { id: 'rescheduled', label: 'Rescheduled', color: '#F39C12' },
  { id: 'cancelled', label: 'Cancelled', color: '#E74C3C' }
];

interface VisitKanbanBoardProps {
  visits: Visit[];
  users: User[];
  leads: Lead[];
  followUps: FollowUp[];
  onUpdateStatus?: (visitId: string, newStatus: VisitStatus) => void;
  onSelectVisit: (visit: Visit) => void;
  onCall: (visit: Visit) => void;
  onWhatsApp: (visit: Visit) => void;
}

export default function VisitKanbanBoard({ visits, users, leads, followUps, onUpdateStatus, onSelectVisit, onCall, onWhatsApp }: VisitKanbanBoardProps) {
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !onUpdateStatus) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    onUpdateStatus(draggableId, destination.droppableId as VisitStatus);
  };

  return (
    <div className="h-[calc(100vh-280px)] overflow-x-auto pb-6">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const stageVisits = visits
              .filter(v => v.visit_status === stage.id)
              .sort((a, b) => b.visit_date.localeCompare(a.visit_date));

            return (
              <div key={stage.id} className="w-80 flex flex-col group">
                <div className="mb-4 px-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] uppercase tracking-wide">
                        {stage.label}
                      </h3>
                      <span className="bg-[#E6D8B8]/30 px-2 py-0.5 rounded text-[10px] font-bold text-[#9A8262]">
                        {stage.id === 'scheduled' 
                          ? stageVisits.length + visits.filter(v => !v.visit_status || !STAGES.find(s => s.id === v.visit_status)).length 
                          : stageVisits.length}
                      </span>
                    </div>
                  </div>
                </div>

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
                        {[
                          ...stageVisits,
                          ...(stage.id === 'scheduled' ? visits.filter(v => !v.visit_status || !STAGES.find(s => s.id === v.visit_status)) : [])
                        ].map((visit, index) => {
                          const DraggableComponent = Draggable as any;
                          const lead = leads.find(l => l.id === visit.leadId);
                          const nextFup = getLeadFollowUp(followUps, visit.leadId, visit.id, visits);
                          const fupStatus = getFollowUpDisplayStatus(nextFup);

                          return (
                            <DraggableComponent key={visit.id} draggableId={visit.id} index={index}>
                              {(provided: any, snapshot: any) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-white border border-[#E6D8B8] rounded-xl p-4 shadow-sm hover:shadow-md transition-all",
                                    snapshot.isDragging && "shadow-xl border-[#C9A84C] scale-105 rotate-2"
                                  )}
                                  onClick={() => onSelectVisit(visit)}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <StatusBadge status={visit.status} />
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3].map((s) => (
                                        <Star 
                                          key={s} 
                                          size={10} 
                                          className={cn(s <= (visit.priority || 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} 
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  <h4 className="font-['Cormorant_Garamond'] text-[15px] font-bold text-[#2A1C00] mb-1">
                                    {visit.client_name}
                                  </h4>
                                  
                                  <div className="flex flex-col gap-1.5 mb-3">
                                    <p className="text-[#9A8262] text-[11px] font-medium flex items-center gap-1.5">
                                      <UserIcon size={12} /> {visit.mobile}
                                    </p>
                                    <p className="text-[#5C4820] text-[11px] font-bold flex items-center gap-1.5 bg-[#FDFAF2] px-2 py-1 rounded-lg w-fit">
                                      <Clock size={12} className="text-[#C9A84C]" />
                                      {new Date(visit.visit_date).toLocaleDateString()} at {visit.visit_time || 'TBD'}
                                    </p>
                                  </div>

                                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#E6D8B8]/50">
                                    <div className="flex flex-col gap-1">
                                      {visit.assigned_to && (
                                        <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider">
                                          {visit.assigned_to}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <div className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          fupStatus === 'overdue' ? "bg-red-500" :
                                          fupStatus === 'today' ? "bg-orange-500" :
                                          fupStatus === 'upcoming' ? "bg-green-500" : "bg-gray-300"
                                        )} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#9A8262]">
                                          FUP: {fupStatus}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        onClick={() => onCall(visit)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      >
                                        <Phone size={14} />
                                      </button>
                                      <button 
                                        onClick={() => onWhatsApp(visit)}
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
