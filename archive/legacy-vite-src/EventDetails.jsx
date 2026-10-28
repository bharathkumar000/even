import React, { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import './EventDetails.css';

export default function EventDetails() {
  const [formData, setFormData] = useState({
    clubName: 'IVC × InUnity',
    tagline: 'Ideate visualize create',
    eventName: 'Vice Verse 1.0 2026',
    venue: 'Sri H. Kempegowda Indoor Sports Complex',
    eventDate: '2026-10-26',
    eventTime: '09:00',
    notes: 'Bring your own laptops and chargers.'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // Logic to save the data goes here (e.g., API call)
    alert("Event Details Saved Successfully!");
  };

  return (
    <div className="event-details animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">Event Details</h1>
          <p>Configure the foundational details of your Ideathon.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> Save Changes
        </button>
      </header>

      <div className="card mt-8 animate-fade-in animate-delay-1">
        <h2 className="section-title mb-6" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={24} color="var(--accent-secondary)" /> General Information
        </h2>
        
        <div className="form-grid">
          <div className="form-group">
            <label>Club / Organization Name</label>
            <input 
              type="text" 
              name="clubName" 
              className="form-control" 
              value={formData.clubName}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>Event Name</label>
            <input 
              type="text" 
              name="eventName" 
              className="form-control" 
              value={formData.eventName}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>Tagline / Motto</label>
            <input 
              type="text" 
              name="tagline" 
              className="form-control" 
              value={formData.tagline}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>Venue</label>
            <input 
              type="text" 
              name="venue" 
              className="form-control" 
              value={formData.venue}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Event Date</label>
            <input 
              type="date" 
              name="eventDate" 
              className="form-control" 
              value={formData.eventDate}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>Event Time</label>
            <input 
              type="time" 
              name="eventTime" 
              className="form-control" 
              value={formData.eventTime}
              onChange={handleChange}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Additional Notes / Guidelines</label>
            <textarea 
              name="notes" 
              className="form-control" 
              value={formData.notes}
              onChange={handleChange}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
