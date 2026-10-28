import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Gavel, Calendar, Code, Settings, LogOut } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/Vice_verse_logo.png" alt="Vice Verse Logo" style={{ width: '80px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255, 0, 127, 0.4))' }} />
          <div>
            <h2 className="logo-text animate-flicker" style={{ color: 'var(--text-primary)' }}>Vice Verse Admin</h2>
            <p className="logo-subtext">Version 1.0</p>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        <p className="nav-label">Main Menu</p>
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/judges" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Gavel size={20} />
          <span>Judges Portal</span>
        </NavLink>
        <NavLink to="/participants" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={20} />
          <span>Participants Portal</span>
        </NavLink>
        <NavLink to="/event-flow" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>Event Flow</span>
        </NavLink>
        <NavLink to="/event-details" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Event Details</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <img src="/ivc-logo-transparent.png" alt="IVC logo" style={{ width: '70px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255, 0, 127, 0.4))' }} />
          <span style={{ fontFamily: 'var(--font-family-tech)', fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>x</span>
          <img src="vvce-logo-720x445-removebg-preview.png" alt="VVCE Logo" style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(251, 200, 21, 0.3))' }} />
        </div>
      </div>
    </aside>
  );
}
