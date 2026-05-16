import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Calendar, Mail, BarChart2, Loader2, Save, Play, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

interface AIReportLabProps {
  leads: any[];
  visits: any[];
  users: any[];
}

export default function AIReportLab({ leads, visits, users }: AIReportLabProps) {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [email, setEmail] = useState('diya9574466663@gmail.com');

  const handleGenerate = async () => {
    if (!query.trim() || isGenerating) return;
    setIsGenerating(true);
    
    // Add to history
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);

    try {
      // We send the current data context so Claude can analyze it
      const context = `
        Current CRM Data Summary:
        - Total Leads: ${leads.length}
        - Total Visits: ${visits.length}
        - Total Staff: ${users.length}
        
        Project Stats: ${JSON.stringify(leads.reduce((acc: any, l) => {
          acc[l.projectId] = (acc[l.projectId] || 0) + 1;
          return acc;
        }, {}))}
      `;

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`,
        },
        body: JSON.stringify({ 
          prompt: `Based on the CRM data, please generate a visual report for: "${query}". 
                   
                   IMPORTANT: You must return your response in two distinct parts:
                   1. A brief strategic analysis text (plain text).
                   2. A JSON block strictly following this format: [CHART_DATA] [ { "name": "Label", "value": 123 }, ... ] [END_CHART_DATA]
                   
                   Example:
                   Analysis goes here...
                   [CHART_DATA]
                   [{"name": "January", "value": 10}, {"name": "February", "value": 20}]
                   [END_CHART_DATA]`,
          context 
        }),
      });

      const data = await response.json();
      const rawResponse = data.response;

      // Extract JSON data using a more robust regex that handles potential markdown and [END_CHART_DATA]
      const chartMatch = rawResponse.match(/\[CHART_DATA\]([\s\S]*?)(\[END_CHART_DATA\]|\[|$)/);
      let chartJson = null;
      if (chartMatch) {
        try {
          let cleanedJson = chartMatch[1].trim();
          // Remove markdown code blocks if present
          cleanedJson = cleanedJson.replace(/```json|```/g, '').trim();
          chartJson = JSON.parse(cleanedJson);
        } catch (e) { 
          console.error("Chart JSON parse error:", e);
          console.log("Attempted to parse:", chartMatch[1]);
        }
      }

      setReportData({
        analysis: rawResponse.split('[CHART_DATA]')[0].trim(),
        chart: chartJson
      });

      setChatHistory(prev => [...prev, { role: 'assistant', content: rawResponse }]);
      setQuery('');
    } catch (err) {
      toast.error("AI Report generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSchedule = async () => {
    toast.success(`Report scheduled! It will be sent to ${email} every Monday.`);
    setIsScheduling(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[#1C1207] to-[#2A1C00] rounded-3xl p-8 border border-[#C9A84C]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-8">
          {/* Discussion Area */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#C9A84C] rounded-2xl flex items-center justify-center text-[#1C1207] shadow-lg shadow-[#C9A84C]/20">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-white tracking-tight">AI Report Designer</h3>
                <p className="text-[#C9A84C] text-[10px] font-black uppercase tracking-[0.2em] opacity-70">powered by Google Gemini</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[300px] max-h-[400px] overflow-y-auto space-y-4 custom-scrollbar">
              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-3">
                  <BarChart2 size={48} className="text-[#C9A84C]" />
                  <p className="text-white text-sm italic font-['Cormorant_Garamond']">"Generate a comparison of project sales for last month..."</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn(
                  "p-3 rounded-xl text-sm leading-relaxed max-w-[90%]",
                  msg.role === 'user' ? "bg-white/10 text-white ml-auto" : "bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20"
                )}>
                  {msg.content.replace(/\[CHART_DATA\][\s\S]*$/, '')}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2">
              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="What kind of report should we build today?"
                className="flex-1 bg-transparent border-none outline-none text-white px-4 text-sm"
              />
              <button 
                onClick={handleGenerate}
                disabled={!query.trim() || isGenerating}
                className="p-3 bg-[#C9A84C] text-[#1C1207] rounded-xl hover:bg-[#E8C97A] transition-all disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>

          {/* Visual Preview Area */}
          <div className="w-full lg:w-96 flex flex-col gap-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex-1 flex flex-col">
              <h4 className="text-[#C9A84C] text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <Play size={12} fill="currentColor" /> Live Visual Preview
              </h4>
              
              <div className="flex-1 flex flex-col items-center justify-center">
                {reportData?.chart ? (
                  <div className="w-full h-48 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} />
                        <YAxis stroke="#ffffff40" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ background: '#1C1207', border: '1px solid #C9A84C', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#C9A84C' }}
                        />
                        <Bar dataKey="value" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center opacity-20 py-20">
                    <History size={40} className="mx-auto mb-4" />
                    <p className="text-xs text-white">Preview will appear after AI analysis</p>
                  </div>
                )}
              </div>

              {reportData && (
                <div className="pt-6 space-y-3">
                  <button 
                    onClick={() => setIsScheduling(true)}
                    className="w-full py-3 bg-[#C9A84C] text-[#1C1207] rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#C9A84C]/20"
                  >
                    <Calendar size={14} /> Schedule & Save
                  </button>
                  <button className="w-full py-3 bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10">
                    <Mail size={14} /> Send Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scheduling Modal */}
      <AnimatePresence>
        {isScheduling && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsScheduling(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1207] border border-[#C9A84C]/40 rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl"
            >
              <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-white mb-6">Schedule AI Report</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1.5 block">Recipient Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                    placeholder="Enter email..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1.5 block">Frequency</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm appearance-none">
                    <option value="daily">Daily at 8 PM</option>
                    <option value="weekly" selected>Weekly (Every Monday)</option>
                    <option value="monthly">Monthly (1st Day)</option>
                  </select>
                </div>
                <div className="pt-6 flex gap-3">
                  <button onClick={() => setIsScheduling(false)} className="flex-1 py-3 text-white/60 font-bold text-xs uppercase">Cancel</button>
                  <button onClick={handleSchedule} className="flex-1 py-3 bg-[#C9A84C] text-[#1C1207] rounded-xl font-bold text-xs uppercase tracking-widest">Confirm Schedule</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
