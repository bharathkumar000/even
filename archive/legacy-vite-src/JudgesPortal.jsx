import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit3, Trash2, X } from 'lucide-react';
import { DataContext } from './DataContext';

export default function JudgesPortal() {
  const { judges, addJudge, editJudge, deleteJudge, teams } = useContext(DataContext);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentJudge, setCurrentJudge] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', email: '', specialization: '' });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenModal = (judge = null) => {
    if (judge) {
      setCurrentJudge(judge);
      setFormData({ name: judge.name, email: judge.email, specialization: judge.specialization });
    } else {
      setCurrentJudge(null);
      setFormData({ name: '', email: '', specialization: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
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
      <div className="animate-fade-in" style={{ position: 'relative' }}>
        <header className="page-header">
        <div>
          <h1 className="text-gradient">Judges Control Portal</h1>
          <p>Manage judging panels, scorecards, and evaluations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Judge
        </button>
      </header>

      <div className="card mt-4" style={{display: 'flex', justifyContent: 'space-between', padding: '16px 24px'}}>
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
          <div style={{position: 'relative'}}>
            <Search size={18} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)'}} />
            <input 
              type="text" 
              placeholder="Search judges..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'var(--bg-color)', 
                border: '1px solid var(--border-color)', 
                padding: '10px 10px 10px 40px', 
                borderRadius: '8px', 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-family)',
                width: '300px'
              }} 
            />
          </div>
        </div>
      </div>

      <div className="glass-panel mt-4" style={{padding: 0}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Judge Name</th>
              <th>Specialization</th>
              <th>Teams Assigned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJudges.map(judge => {
              const assignedCount = teams.filter(t => t.judgeId === judge.id).length;
              return (
                <tr key={judge.id}>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{width: '40px', height: '40px', borderRadius: '4px', background: `linear-gradient(135deg, ${judge.theme}, var(--bg-color))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff'}}>
                        {judge.initials}
                      </div>
                      <div>
                        <div style={{fontWeight: '500'}}>{judge.name}</div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{judge.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{judge.specialization}</td>
                  <td>{assignedCount} Teams</td>
                  <td>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button className="btn btn-outline" style={{padding: '6px'}} title="Edit Details" onClick={() => handleOpenModal(judge)}><Edit3 size={16} /></button>
                      <button className="btn btn-outline" style={{padding: '6px', color: 'var(--status-error)', borderColor: 'var(--status-error)'}} title="Delete" onClick={() => deleteJudge(judge.id)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredJudges.length === 0 && (
              <tr>
                <td colSpan="4" style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '24px'}}>No judges found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 style={{marginBottom: '24px', color: 'var(--accent-primary)'}}>{currentJudge ? 'Edit Judge' : 'Add Judge'}</h2>
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Specialization</label>
                <input required type="text" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <button type="submit" className="btn btn-primary" style={{marginTop: '16px'}}>{currentJudge ? 'Update Judge' : 'Add Judge'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
