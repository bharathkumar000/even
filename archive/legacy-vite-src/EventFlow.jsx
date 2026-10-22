import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, MapPin, Edit3, Plus, Trash2, X } from 'lucide-react';
import { DataContext } from './DataContext';

export default function EventFlow() {
  const { schedule, addScheduleItem, editScheduleItem, deleteScheduleItem } = useContext(DataContext);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({
    time: '',
    title: '',
    location: '',
    status: 'upcoming'
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openModal = (item = null) => {
    if (item) {
      setCurrentItem(item);
      setFormData({ time: item.time, title: item.title, location: item.location, status: item.status });
    } else {
      setCurrentItem(null);
      setFormData({ time: '', title: '', location: '', status: 'upcoming' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentItem) {
      editScheduleItem(currentItem.id, formData);
    } else {
      addScheduleItem(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="animate-fade-in" style={{ position: 'relative' }}>
        <header className="page-header">
        <div>
          <h1 className="text-gradient">Event Flow</h1>
          <p>Manage and track the schedule for Vice Verse 1.0.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Schedule Item
        </button>
      </header>

      <div className="card mt-4">
        <h2 className="section-title">Event Timeline</h2>
        
        <div style={{marginTop: '24px'}}>
          {schedule.length === 0 && (
            <p style={{color: 'var(--text-secondary)'}}>No items in schedule. Add one to get started.</p>
          )}
          {schedule.map((item, index) => (
            <div key={item.id} style={{
              display: 'flex', 
              gap: '24px', 
              marginBottom: '24px',
              opacity: item.status === 'completed' ? 0.6 : 1
            }}>
              <div style={{
                width: '120px', 
                color: item.status === 'active' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: item.status === 'active' ? 'bold' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Clock size={16} />
                {item.time}
              </div>
              
              <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: item.status === 'active' ? 'var(--accent-primary)' : 
                             item.status === 'completed' ? 'var(--status-success)' : 'var(--surface-color-light)',
                  border: `2px solid ${item.status === 'active' ? 'var(--accent-primary)' : 
                                      item.status === 'completed' ? 'var(--status-success)' : 'var(--border-color)'}`,
                  zIndex: 2,
                  boxShadow: item.status === 'active' ? '0 0 10px var(--accent-primary)' : 'none'
                }}></div>
                {index < schedule.length - 1 && (
                  <div style={{
                    width: '2px',
                    height: '100%',
                    background: item.status === 'completed' ? 'var(--status-success)' : 'var(--border-color)',
                    position: 'absolute',
                    top: '16px',
                    zIndex: 1
                  }}></div>
                )}
              </div>
              
              <div style={{
                flex: 1, 
                background: item.status === 'active' ? 'rgba(251, 200, 21, 0.1)' : 'transparent',
                padding: '16px',
                borderRadius: '8px',
                border: item.status === 'active' ? '1px solid rgba(251, 200, 21, 0.3)' : '1px solid transparent',
                marginTop: '-12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div>
                  <h3 style={{margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-primary)'}}>
                    {item.title}
                  </h3>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
                    <MapPin size={14} /> {item.location}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button className="btn btn-outline" style={{padding: '6px'}} title="Edit Item" onClick={() => openModal(item)}><Edit3 size={16} /></button>
                  <button className="btn btn-outline" style={{padding: '6px', color: 'var(--status-error)', borderColor: 'var(--status-error)'}} title="Delete Item" onClick={() => deleteScheduleItem(item.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 style={{marginBottom: '24px', color: 'var(--accent-primary)'}}>{currentItem ? 'Edit Schedule Item' : 'Add Schedule Item'}</h2>
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Time (e.g. 09:00 AM)</label>
                <input required type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Location</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px'}} />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{fontSize: '0.9rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-tech)'}}>Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{background: 'rgba(13,13,20,0.7)', border: '1px solid var(--border-color)', color: '#fff', padding: '12px', borderRadius: '4px', outline: 'none'}}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <button type="submit" className="btn btn-primary" style={{marginTop: '16px'}}>{currentItem ? 'Update Item' : 'Add Item'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
