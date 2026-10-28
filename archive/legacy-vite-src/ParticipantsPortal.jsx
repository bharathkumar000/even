import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, UserPlus, Edit3, Trash2, X, AlertTriangle } from 'lucide-react';
import { DataContext } from './DataContext';

export default function ParticipantsPortal() {
  const { teams, judges, assignJudgeToTeam, addTeam, editTeam, deleteTeam, disqualifyTeam } = useContext(DataContext);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', theme: '', member1: '', member2: '', member3: '' });

  const [isDisqualifyModalOpen, setIsDisqualifyModalOpen] = useState(false);
  const [teamToDisqualify, setTeamToDisqualify] = useState(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
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

  const openTeamModal = (team = null) => {
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

  const handleTeamSubmit = (e) => {
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

  const openDisqualifyModal = (team) => {
    setTeamToDisqualify(team);
    setDisqualifyReason('');
    setIsDisqualifyModalOpen(true);
  };

  const handleDisqualifySubmit = (e) => {
    e.preventDefault();
    if (teamToDisqualify) {
      disqualifyTeam(teamToDisqualify.id, disqualifyReason);
    }
    setIsDisqualifyModalOpen(false);
  };

  return (
    <>
      <div className="animate-fade-in" style={{ position: 'relative' }}>
        <header className="page-header">
        <div>
          <h1 className="text-gradient">Participants Portal</h1>
          <p>Monitor participant teams, submissions, and status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openTeamModal()}>
          <UserPlus size={18} /> Register Team
        </button>
      </header>

      <div className="stats-grid mt-4">
        <div className="card">
          <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px'}}>Total Teams</div>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{teams.length}</div>
        </div>
        <div className="card">
          <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px'}}>Teams Assigned</div>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{teams.filter(t => t.judgeId).length}</div>
        </div>
        <div className="card">
          <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px'}}>Pending Assignment</div>
          <div style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--status-warning)'}}>{pendingReview}</div>
        </div>
      </div>

      <div className="glass-panel mt-8" style={{padding: 0}}>
        <div style={{padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between'}}>
          <div style={{position: 'relative', width: '300px'}}>
            <Search size={18} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)'}} />
            <input 
              type="text" 
              placeholder="Search teams..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                background: 'var(--bg-color)', 
                border: '1px solid var(--border-color)', 
                padding: '10px 10px 10px 40px', 
                borderRadius: '8px', 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-family)',
                width: '100%'
              }} 
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Theme</th>
                <th>Members</th>
                <th>Assign Judge</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map(team => (
                <tr key={team.id} style={{ opacity: team.disqualified ? 0.6 : 1 }}>
                  <td>
                    <div style={{fontWeight: '600', color: team.disqualified ? 'var(--status-error)' : 'inherit'}}>
                      {team.name}
                    </div>
                    {team.disqualified && (
                      <div style={{fontSize: '0.75rem', color: 'var(--status-error)', marginTop: '4px'}}>
                        Reason: {team.disqualifyReason}
                      </div>
                    )}
                  </td>
                  <td>{team.theme}</td>
                  <td>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                      {team.members.map((m, i) => <span key={i}>{m}</span>)}
                    </div>
                  </td>
                  <td>
                    <select 
                      value={team.judgeId || ''} 
                      onChange={(e) => assignJudgeToTeam(team.id, e.target.value)}
                      disabled={team.disqualified}
                      style={{
                        background: 'rgba(13,13,20,0.7)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '8px',
                        borderRadius: '4px',
                        outline: 'none',
                        fontFamily: 'var(--font-family-body)',
                        opacity: team.disqualified ? 0.5 : 1
                      }}
                    >
                      <option value="">-- Unassigned --</option>
                      {judges.map(j => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {team.disqualified 
                      ? <span className="badge badge-error">Disqualified</span> 
                      : team.judgeId 
                        ? <span className="badge badge-success">Assigned</span> 
                        : <span className="badge badge-warning">Pending</span>
                    }
                  </td>
                  <td>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button className="btn btn-outline" style={{padding: '6px'}} title="Edit Team" onClick={() => openTeamModal(team)}><Edit3 size={16} /></button>
                      {!team.disqualified && (
                        <button className="btn btn-outline" style={{padding: '6px', color: 'var(--status-warning)', borderColor: 'var(--status-warning)'}} title="Disqualify" onClick={() => openDisqualifyModal(team)}><AlertTriangle size={16} /></button>
                      )}
                      <button className="btn btn-outline" style={{padding: '6px', color: 'var(--status-error)', borderColor: 'var(--status-error)'}} title="Delete" onClick={() => deleteTeam(team.id)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTeams.length === 0 && (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '24px'}}>No teams found. Click 'Register Team' to add one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Add / Edit Team Modal */}
      {isTeamModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <button type="button" className="modal-close" onClick={() => setIsTeamModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 style={{marginBottom: '24px', color: 'var(--accent-primary)'}}>{currentTeam ? 'Edit Team' : 'Register New Team'}</h2>
            <form onSubmit={handleTeamSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div style={{display: 'flex', gap: '16px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', flex: 1}}>
                  <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Team Name</label>
                  <input required type="text" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', flex: 1}}>
                  <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Theme</label>
                  <input required type="text" value={teamForm.theme} onChange={e => setTeamForm({...teamForm, theme: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
                </div>
              </div>
              
              <h3 style={{fontSize: '1rem', marginTop: '8px', color: 'var(--text-secondary)'}}>Team Members</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <input required placeholder="Member 1 Name" type="text" value={teamForm.member1} onChange={e => setTeamForm({...teamForm, member1: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px', borderRadius: '4px'}} />
                <input required placeholder="Member 2 Name" type="text" value={teamForm.member2} onChange={e => setTeamForm({...teamForm, member2: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px', borderRadius: '4px'}} />
                <input required placeholder="Member 3 Name" type="text" value={teamForm.member3} onChange={e => setTeamForm({...teamForm, member3: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px', borderRadius: '4px'}} />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{marginTop: '16px'}}>{currentTeam ? 'Update Team' : 'Register Team'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Disqualify Modal */}
      {isDisqualifyModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <button type="button" className="modal-close" onClick={() => setIsDisqualifyModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 style={{marginBottom: '16px', color: 'var(--status-error)'}}>Disqualify Team</h2>
            <p style={{marginBottom: '24px', color: 'var(--text-secondary)'}}>You are about to disqualify <strong>{teamToDisqualify?.name}</strong>. Please provide a reason below.</p>
            <form onSubmit={handleDisqualifySubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--status-error)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Reason for Disqualification</label>
                <textarea 
                  required 
                  rows="4"
                  value={disqualifyReason} 
                  onChange={e => setDisqualifyReason(e.target.value)} 
                  style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px', resize: 'vertical'}} 
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{marginTop: '16px', background: 'var(--status-error)'}}>Confirm Disqualification</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
