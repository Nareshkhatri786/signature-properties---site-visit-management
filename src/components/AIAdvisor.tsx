import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Lead, Visit, FollowUp, User } from '../types';
import { getDailySalesInsights, SalesInsight } from '../lib/gemini';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AIAdvisorProps {
  leads: Lead[];
  visits: Visit[];
  followUps: FollowUp[];
  user: User;
}

export default function AIAdvisor({ leads, visits, followUps, user }: AIAdvisorProps) {
  const [insight, setInsight] = useState<SalesInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchInsights = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getDailySalesInsights(leads, followUps, visits, user.name);
      setInsight(data);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch automatically if we haven't yet or if user explicitly clicks refresh
    const lastFetch = localStorage.getItem('ai_insight_timestamp');
    const now = Date.now();
    // Refresh every 6 hours
    if (!lastFetch || now - parseInt(lastFetch) > 21600000) {
      fetchInsights();
      localStorage.setItem('ai_insight_timestamp', now.toString());
    } else {
      const saved = localStorage.getItem('ai_insight_data');
      if (saved) setInsight(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (insight) {
      localStorage.setItem('ai_insight_data', JSON.stringify(insight));
    }
  }, [insight]);

  return (
    <div className="bg-gradient-to-br from-[#1C1207] to-[#2A1C00] rounded-2xl p-6 shadow-xl border border-[#C9A84C]/30 relative overflow-hidden group">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#C9A84C]/5 rounded-full blur-2xl -ml-24 -mb-24 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C9A84C] rounded-xl flex items-center justify-center text-[#1C1207] shadow-lg shadow-[#C9A84C]/20">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-white tracking-wide">Daily AI Advisor</h3>
              <p className="text-[11px] text-[#C9A84C] font-semibold uppercase tracking-widest opacity-80">Personalized Insights</p>
            </div>
          </div>
          <button 
            onClick={fetchInsights}
            disabled={loading}
            className="text-[11px] font-bold text-[#C9A84C] hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Refresh'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <p className="text-[#C9A84C]/60 text-sm font-medium italic">Analyzing lead pipelines and follow-ups...</p>
            </motion.div>
          ) : insight ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Summary */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-white/90 text-[14px] leading-relaxed italic font-['Cormorant_Garamond']">
                  "{insight.summary}"
                </p>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={12} /> Priority Steps
                  </h4>
                  <ul className="space-y-2">
                    {insight.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 group/item">
                        <div className="mt-1.5 w-1 h-1 bg-[#C9A84C] rounded-full shrink-0" />
                        <span className="text-white/70 text-[13px] leading-tight group-hover/item:text-white transition-colors">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <AlertCircle size={12} /> Leads to Focus
                  </h4>
                  <div className="space-y-2">
                    {insight.focusLeads.map((lead: any, i) => (
                      <div key={i} className="flex flex-col p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-transparent hover:border-[#C9A84C]/20 group/lead">
                        <span className="text-white font-bold text-[12.5px] group-hover/lead:text-[#C9A84C] transition-colors">{lead.name || 'High Interest Lead'}</span>
                        <span className="text-white/50 text-[11px] leading-tight mt-0.5 italic">{lead.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button className="w-full bg-[#C9A84C] hover:bg-[#E8C97A] text-[#1C1207] py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#C9A84C]/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                  Launch Daily Plan <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="py-8 text-center text-[#C9A84C]/50 text-sm">
              Click refresh to generate AI insights for today.
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
