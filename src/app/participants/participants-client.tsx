"use client";

import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Edit3, Trash2, X, AlertTriangle } from 'lucide-react';
import { DataContext, Team } from '@/components/DataContext';
import SignOutButton from '@/components/SignOutButton';

export default function ParticipantsPortal() {
  const { teams, judges, assignJudgeToTeam, addTeam, editTeam, deleteTeam, disqualifyTeam } = useContext(DataContext);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', theme: '', member1: '', member2: '', member3: '' });

  const [isDisqualifyModalOpen, setIsDisqualifyModalOpen] = useState(false);
  const [teamToDisqualify, setTeamToDisqualify] = useState<Team | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTeamModalOpen(false);
        setIsDisqualifyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.theme.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingReview = teams.filter(t => !t.judgeId && !t.disqualified).length;

  const openTeamModal = (team: Team | null = null) => {
    if (team) {
      setCurrentTeam(team);
      setTeamForm({ 
        name: team.name, 
        theme: team.theme, 
        member1: team.members[0] || '', 
        member2: team.members[1] || '', 
        member3: team.members[2] || '' 
      });
    } else {
      setCurrentTeam(null);
      setTeamForm({ name: '', theme: '', member1: '', member2: '', member3: '' });
    }
    setIsTeamModalOpen(true);
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const membersArray = [teamForm.member1, teamForm.member2, teamForm.member3].filter(Boolean);
    const newTeamData = {
      name: teamForm.name,
      theme: teamForm.theme,
      members: membersArray
    };

    if (currentTeam) {
      editTeam(currentTeam.id, newTeamData);
    } else {
      addTeam(newTeamData);
    }
    setIsTeamModalOpen(false);
  };

  const openDisqualifyModal = (team: Team) => {
    setTeamToDisqualify(team);
    setDisqualifyReason('');
    setIsDisqualifyModalOpen(true);
  };

  const handleDisqualifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamToDisqualify) {
      disqualifyTeam(teamToDisqualify.id, disqualifyReason);
    }
    setIsDisqualifyModalOpen(false);
  };

  return (
    <>
      <div className="animate-fade-in relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-text-primary text-2xl sm:text-3xl md:text-[3rem] font-heading tracking-[2px] leading-[1.1] uppercase m-0 mb-2">Participants Portal</h1>
            <p className="text-text-secondary text-xs sm:text-sm leading-[1.6] m-0">Monitor participant teams, submissions, and status.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-xs sm:text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow" onClick={() => openTeamModal()}>
              <UserPlus size={16} /> Register Team
            </button>
            <SignOutButton variant="button" label="Sign Out" />
          </div>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 mt-4">
          <div className="bg-surface-color rounded-lg border border-border-color p-6 transition-all duration-300 hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(255,0,127,0.15)]">
            <div className="text-text-secondary text-[0.9rem] mb-2 font-tech uppercase tracking-[1px] font-bold">Total Teams</div>
            <div className="text-[2rem] font-bold font-heading text-text-primary">{teams.length}</div>
          </div>
          <div className="bg-surface-color rounded-lg border border-border-color p-6 transition-all duration-300 hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(255,0,127,0.15)]">
            <div className="text-text-secondary text-[0.9rem] mb-2 font-tech uppercase tracking-[1px] font-bold">Teams Assigned</div>
            <div className="text-[2rem] font-bold font-heading text-text-primary">{teams.filter(t => t.judgeId).length}</div>
          </div>
          <div className="bg-surface-color rounded-lg border border-border-color p-6 transition-all duration-300 hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(255,0,127,0.15)]">
            <div className="text-text-secondary text-[0.9rem] mb-2 font-tech uppercase tracking-[1px] font-bold">Pending Assignment</div>
            <div className="text-[2rem] font-bold font-heading text-status-warning">{pendingReview}</div>
          </div>
        </div>

        <div className="glass-panel mt-8 p-0">
          <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-b border-border-color flex justify-between">
            <div className="relative w-full sm:w-[300px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Search teams..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-bg-color border border-border-color pl-10 pr-3 py-2.5 rounded-lg text-text-primary font-sans tracking-normal w-full outline-none focus:border-accent-primary transition-colors text-xs sm:text-sm"
              />
            </div>
          </div>
          <div className="overflow-y-auto overflow-x-auto max-h-[500px] w-full">
            <table className="w-full border-collapse min-w-[500px]">
              <thead>
                <tr>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Team Name</th>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Theme</th>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Members</th>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Assign Judge</th>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Status</th>
                  <th className="p-4 text-left border-b border-border-color text-accent-primary font-tech text-[0.9rem] uppercase tracking-[1px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map(team => (
                  <tr key={team.id} className="transition-colors duration-200 hover:bg-[rgba(255,0,127,0.05)] border-b border-border-color last:border-b-0" style={{ opacity: team.disqualified ? 0.6 : 1 }}>
                    <td className="p-4 text-left">
                      <div className={`font-semibold ${team.disqualified ? 'text-status-error' : 'text-text-primary'}`}>
                        {team.name}
                      </div>
                      {team.disqualified && (
                        <div className="text-[0.75rem] text-status-error mt-1">
                          Reason: {team.disqualifyReason}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-left">{team.theme}</td>
                    <td className="p-4 text-left">
                      <div className="text-[0.8rem] text-text-secondary flex flex-col gap-1">
                        {team.members.map((m, i) => <span key={i}>{m}</span>)}
                      </div>
                    </td>
                    <td className="p-4 text-left">
                      <select 
                        value={team.judgeId || ''} 
                        onChange={(e) => assignJudgeToTeam(team.id, e.target.value)}
                        disabled={team.disqualified}
                        className="bg-[rgba(13,13,20,0.7)] text-text-primary border border-border-color p-2 rounded outline-none font-body w-full max-w-[150px] focus:border-accent-primary"
                        style={{ opacity: team.disqualified ? 0.5 : 1 }}
                      >
                        <option value="">-- Unassigned --</option>
                        {judges.map(j => (
                          <option key={j.id} value={j.id}>{j.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-left">
                      {team.disqualified 
                        ? <span className="px-2.5 py-1 text-xs font-bold font-tech tracking-[1px] uppercase bg-[rgba(255,0,127,0.1)] text-status-error border border-status-error">Disqualified</span> 
                        : team.judgeId 
                          ? <span className="px-2.5 py-1 text-xs font-bold font-tech tracking-[1px] uppercase bg-[rgba(16,185,129,0.1)] text-status-success border border-status-success">Assigned</span> 
                          : <span className="px-2.5 py-1 text-xs font-bold font-tech tracking-[1px] uppercase bg-[rgba(251,200,21,0.1)] text-accent-primary border border-accent-primary">Pending</span>
                      }
                    </td>
                    <td className="p-4 text-left">
                      <div className="flex gap-2">
                        <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-text-primary bg-transparent text-text-primary hover:bg-text-primary hover:text-black" title="Edit Team" onClick={() => openTeamModal(team)}><Edit3 size={16} /></button>
                        {!team.disqualified && (
                          <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-status-warning bg-transparent text-status-warning hover:bg-status-warning hover:text-black" title="Disqualify" onClick={() => openDisqualifyModal(team)}><AlertTriangle size={16} /></button>
                        )}
                        <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-status-error bg-transparent text-status-error hover:bg-status-error hover:text-white" title="Delete" onClick={() => deleteTeam(team.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr className="border-b border-border-color last:border-b-0">
                    <td colSpan={6} className="p-6 text-center text-text-secondary">No teams found. Click &apos;Register Team&apos; to add one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isTeamModalOpen && mounted && createPortal(
        <div className="fixed inset-0 bg-[rgba(5,5,8,0.85)] backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
          <div className="bg-surface-color border border-accent-primary rounded-xl w-full max-w-[500px] relative p-8 m-auto shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(251,200,21,0.2),0_0_20px_rgba(251,200,21,0.1)] transform translate-y-0" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button type="button" className="absolute top-4 right-4 bg-[rgba(255,255,255,0.05)] border border-border-color text-text-primary w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-status-error hover:border-status-error hover:text-white hover:rotate-90" onClick={() => setIsTeamModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 className="mb-6 text-accent-primary font-heading tracking-[2px] leading-[1.1] uppercase m-0 text-[2.2rem]">{currentTeam ? 'Edit Team' : 'Register New Team'}</h2>
            <form onSubmit={handleTeamSubmit} className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Team Name</label>
                  <input required type="text" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Theme</label>
                  <input required type="text" value={teamForm.theme} onChange={e => setTeamForm({...teamForm, theme: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
                </div>
              </div>
              
              <h3 className="text-[1rem] mt-2 mb-1 text-text-secondary font-heading tracking-[2px] uppercase">Team Members</h3>
              <div className="flex flex-col gap-3">
                <input required placeholder="Member 1 Name" type="text" value={teamForm.member1} onChange={e => setTeamForm({...teamForm, member1: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-2.5 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
                <input required placeholder="Member 2 Name" type="text" value={teamForm.member2} onChange={e => setTeamForm({...teamForm, member2: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-2.5 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
                <input required placeholder="Member 3 Name" type="text" value={teamForm.member3} onChange={e => setTeamForm({...teamForm, member3: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-2.5 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              
              <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow">{currentTeam ? 'Update Team' : 'Register Team'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isDisqualifyModalOpen && mounted && createPortal(
        <div className="fixed inset-0 bg-[rgba(5,5,8,0.85)] backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
          <div className="bg-surface-color border border-status-error rounded-xl w-full max-w-[500px] relative p-8 m-auto shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,0,127,0.2),0_0_20px_rgba(255,0,127,0.1)] transform translate-y-0" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button type="button" className="absolute top-4 right-4 bg-[rgba(255,255,255,0.05)] border border-border-color text-text-primary w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-status-error hover:border-status-error hover:text-white hover:rotate-90" onClick={() => setIsDisqualifyModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 className="mb-4 text-status-error font-heading tracking-[2px] leading-[1.1] uppercase m-0 text-[2.2rem]">Disqualify Team</h2>
            <p className="mb-6 text-text-secondary leading-[1.6]">You are about to disqualify <strong>{teamToDisqualify?.name}</strong>. Please provide a reason below.</p>
            <form onSubmit={handleDisqualifySubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-status-error uppercase font-tech font-bold tracking-[2px]">Reason for Disqualification</label>
                <textarea 
                  required 
                  rows={4}
                  value={disqualifyReason} 
                  onChange={e => setDisqualifyReason(e.target.value)} 
                  className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-status-error transition-colors resize-y font-sans tracking-normal"
                />
              </div>
              <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-base bg-status-error text-white hover:bg-status-error hover:shadow-[0_0_15px_rgba(255,0,127,0.4)]">Confirm Disqualification</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
