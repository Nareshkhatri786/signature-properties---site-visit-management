import React, { useState } from 'react';
import { Home, User, Lock, ArrowRight } from 'lucide-react';
import { User as UserType } from '../types';
import { motion } from 'motion/react';
import { storage } from '../lib/storage';
import { apiService } from '../lib/api-service';

interface LoginProps {
  onLogin: (user: UserType) => void;
  users: UserType[];
}

export default function Login({ onLogin, users }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { token, user } = await apiService.login(username, password);
      localStorage.setItem('crm_token', token);
      storage.saveAuth(user);
      onLogin(user as UserType);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_50%,rgba(201,168,76,0.12)_0%,transparent_60%),radial-gradient(ellipse_at_75%_25%,rgba(201,168,76,0.08)_0%,transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(201,168,76,1) 40px,rgba(201,168,76,1) 41px)' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[400px] bg-gradient-to-br from-[#2A1F08] to-[#1C1508] border border-[#C9A84C]/30 rounded-[20px] p-10 shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(201,168,76,0.18)]"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] rounded-full mx-auto mb-4 flex items-center justify-center text-[#1C1207] shadow-[0_8px_24px_rgba(201,168,76,0.4)]">
            <Home size={32} />
          </div>
          <h1 className="font-['Cormorant_Garamond'] text-[#E8C97A] text-2xl font-bold">Signature Properties</h1>
          <p className="text-[#C9A84C]/45 text-[11px] tracking-[2.5px] uppercase mt-1">Site Visit Management</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[#C9A84C]/75 text-[10.5px] tracking-[1.5px] uppercase font-semibold block">Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-[#C9A84C]/20 rounded-lg py-2.5 pl-10 pr-4 text-[#FFFDF6] focus:outline-none focus:border-[#C9A84C] focus:bg-white/10 transition-all placeholder:text-white/20"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#C9A84C]/75 text-[10.5px] tracking-[1.5px] uppercase font-semibold block">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-[#C9A84C]/20 rounded-lg py-2.5 pl-10 pr-4 text-[#FFFDF6] focus:outline-none focus:border-[#C9A84C] focus:bg-white/10 transition-all placeholder:text-white/20"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] font-bold py-3 rounded-lg shadow-[0_4px_16px_rgba(201,168,76,0.3)] hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(201,168,76,0.45)] transition-all flex items-center justify-center gap-2 text-sm tracking-widest uppercase disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (
              <>
                Login <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[#C9A84C]/35 text-[11px] mt-8">
          Powered by Signature CRM
        </p>
      </motion.div>
    </div>
  );
}
