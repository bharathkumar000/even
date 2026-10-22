"use client";

import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit3, Trash2, X } from 'lucide-react';
import { DataContext, Judge } from '@/components/DataContext';
import SignOutButton from '@/components/SignOutButton';

export default function JudgesPortal() {
  const { judges, addJudge, editJudge, deleteJudge, teams } = useContext(DataContext);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentJudge, setCurrentJudge] = useState<Judge | null>(null);
  
  const [formData, setFormData] = useState({ name: '', email: '', specialization: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenModal = (judge: Judge | null = null) => {
    if (judge) {
      setCurrentJudge(judge);
      setFormData({ name: judge.name, email: judge.email, specialization: judge.specialization });
    } else {
      setCurrentJudge(null);
      setFormData({ name: '', email: '', specialization: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentJudge) {
      editJudge(currentJudge.id, formData);
    } else {
      addJudge({
        ...formData,
        initials: formData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        theme: `var(--accent-${['primary', 'secondary', 'tertiary'][Math.floor(Math.random() * 3)]})`
      });
    }
    setIsModalOpen(false);
  };

  const filteredJudges = judges.filter(j => 
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="animate-fade-in relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-text-primary text-2xl sm:text-3xl md:text-[3rem] font-heading tracking-[2px] leading-[1.1] uppercase m-0 mb-2">Judges Control Portal</h1>
            <p className="text-text-secondary text-xs sm:text-sm leading-[1.6] m-0">Manage judging panels, scorecards, and evaluations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-xs sm:text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow" onClick={() => handleOpenModal()}>
              <Plus size={16} /> Add Judge
            </button>
            <SignOutButton variant="button" label="Sign Out" />
          </div>
        </header>

        <div className="bg-surface-color rounded-lg border border-border-color p-3.5 sm:p-4 px-4 sm:px-6 flex justify-between mt-4">
          <div className="flex gap-4 items-center w-full sm:w-auto">
            <div className="relative w-full sm:w-[300px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Search judges..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-bg-color border border-border-color pl-10 pr-3 py-2.5 rounded-lg text-text-primary font-sans tracking-normal w-full outline-none focus:border-accent-primary transition-colors text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel mt-4 p-0 overflow-x-auto w-full">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr>
                <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Judge Name</th>
                <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Specialization</th>
                <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Teams Assigned</th>
                <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJudges.map(judge => {
                const assignedCount = teams.filter(t => t.judgeId === judge.id).length;
                return (
                  <tr key={judge.id} className="transition-colors duration-200 hover:bg-[rgba(255,0,127,0.05)] border-b border-border-color last:border-b-0">
                    <td className="p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-white" style={{ background: `linear-gradient(135deg, ${judge.theme}, var(--bg-color))` }}>
                          {judge.initials}
                        </div>
                        <div>
                          <div className="font-medium">{judge.name}</div>
                          <div className="text-[0.8rem] text-text-secondary">{judge.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-left">{judge.specialization}</td>
                    <td className="p-4 text-left">{assignedCount} Teams</td>
                    <td className="p-4 text-left">
                      <div className="flex gap-2">
                        <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-text-primary bg-transparent text-text-primary hover:bg-text-primary hover:text-black" title="Edit Details" onClick={() => handleOpenModal(judge)}><Edit3 size={16} /></button>
                        <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-status-error bg-transparent text-status-error hover:bg-status-error hover:text-white" title="Delete" onClick={() => deleteJudge(judge.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredJudges.length === 0 && (
                <tr className="border-b border-border-color last:border-b-0">
                  <td colSpan={4} className="p-6 text-center text-text-secondary">No judges found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 bg-[rgba(5,5,8,0.85)] backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
          <div className="bg-surface-color border border-accent-primary rounded-xl w-full max-w-[500px] relative p-8 m-auto shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(251,200,21,0.2),0_0_20px_rgba(251,200,21,0.1)] transform translate-y-0" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button type="button" className="absolute top-4 right-4 bg-[rgba(255,255,255,0.05)] border border-border-color text-text-primary w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-status-error hover:border-status-error hover:text-white hover:rotate-90" onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 className="mb-6 text-accent-primary font-heading tracking-[2px] leading-[1.1] uppercase m-0 text-[2.2rem]">{currentJudge ? 'Edit Judge' : 'Add Judge'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Specialization</label>
                <input required type="text" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow">{currentJudge ? 'Update Judge' : 'Add Judge'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
