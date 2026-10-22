import React, { useContext } from 'react';
import { Users, Gavel, CalendarCheck, Zap } from 'lucide-react';
import { DataContext } from './DataContext';
import './Dashboard.css';

export default function Dashboard() {
  const { teams, judges } = useContext(DataContext);

  return (
    <div className="dashboard animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">Vice Verse Dashboard</h1>
          <p>Welcome to the central command center for Vice Verse 1.0 2026.</p>
        </div>
        <button className="btn btn-primary">
          <Zap size={18} /> Quick Action
        </button>
      </header>

      <div className="stats-grid mt-4">
        <div className="card stat-card animate-fade-in animate-delay-1">
          <div className="stat-icon-wrapper" style={{background: 'rgba(251, 200, 21, 0.1)', color: 'var(--accent-primary)'}}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{teams.length * 3}</h3>
            <p>Total Participants</p>
          </div>
        </div>

        <div className="card stat-card animate-fade-in animate-delay-2">
          <div className="stat-icon-wrapper" style={{background: 'rgba(255, 0, 127, 0.1)', color: 'var(--accent-secondary)'}}>
            <Gavel size={24} />
          </div>
          <div className="stat-content">
            <h3>{judges.length}</h3>
            <p>Active Judges</p>
          </div>
        </div>


      </div>

      <div className="recent-activity-section mt-8 animate-fade-in animate-delay-3">
        <h2 className="section-title">Active Judges Panel</h2>
        <div className="glass-panel" style={{padding: '0'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Judge</th>
                <th>Specialization</th>
                <th>Assigned Teams</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {judges.map(judge => {
                const assignedCount = teams.filter(t => t.judgeId === judge.id).length;
                return (
                  <tr key={judge.id}>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <div style={{width: '32px', height: '32px', borderRadius: '4px', background: `linear-gradient(135deg, ${judge.theme}, var(--bg-color))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff'}}>
                          {judge.initials}
                        </div>
                        <div>
                          <div style={{fontWeight: '500'}}>{judge.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{judge.specialization}</td>
                    <td>{assignedCount}</td>
                    <td><span className="badge badge-success">Online</span></td>
                  </tr>
                );
              })}
              {judges.length === 0 && (
                <tr>
                  <td colSpan="4" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>No judges currently active.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
