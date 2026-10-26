"use client";

import React, { useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MapPin, Edit3, Plus, Trash2, X } from 'lucide-react';
import { DataContext, ScheduleItem } from '@/components/DataContext';
import SignOutButton from '@/components/SignOutButton';

export default function EventFlow() {
  const { schedule, addScheduleItem, editScheduleItem, deleteScheduleItem } = useContext(DataContext);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<ScheduleItem | null>(null);
  const [formData, setFormData] = useState({
    time: '',
    title: '',
    location: '',
    status: 'upcoming'
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openModal = (item: ScheduleItem | null = null) => {
    if (item) {
      setCurrentItem(item);
      setFormData({ time: item.time, title: item.title, location: item.description, status: item.status });
    } else {
      setCurrentItem(null);
      setFormData({ time: '', title: '', location: '', status: 'upcoming' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemData = {
      time: formData.time,
      title: formData.title,
      description: formData.location,
      status: formData.status
    };
    
    if (currentItem) {
      editScheduleItem(currentItem.id, itemData);
    } else {
      addScheduleItem(itemData);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="animate-fade-in relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-text-primary text-2xl sm:text-3xl md:text-[3rem] font-heading tracking-[2px] leading-[1.1] uppercase m-0 mb-2">Event Flow</h1>
            <p className="text-text-secondary text-xs sm:text-sm leading-[1.6] m-0">Manage and track the schedule for Eventra 1.0.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-xs sm:text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow" onClick={() => openModal()}>
              <Plus size={16} /> Add Schedule Item
            </button>
            <SignOutButton variant="button" label="Sign Out" />
          </div>
        </header>

        <div className="bg-surface-color rounded-lg border border-border-color p-6 transition-all duration-300 hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(255,0,127,0.15)] mt-4">
          <h2 className="text-[1.25rem] mb-4 text-text-primary font-heading tracking-[2px] leading-[1.1] uppercase">Event Timeline</h2>
          
          <div className="mt-6">
            {schedule.length === 0 && (
              <p className="text-text-secondary">No items in schedule. Add one to get started.</p>
            )}
            {schedule.map((item, index) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-3 sm:gap-6 mb-6" style={{ opacity: item.status === 'completed' ? 0.6 : 1 }}>
                <div className={`sm:w-[120px] flex items-center gap-2 shrink-0 ${item.status === 'active' ? 'text-accent-primary font-bold' : 'text-text-secondary font-normal'}`}>
                  <Clock size={16} />
                  <span>{item.time}</span>
                </div>
                
                <div className="hidden sm:flex relative flex-col items-center">
                  <div className={`w-4 h-4 rounded-full z-[2] ${item.status === 'active' ? 'bg-accent-primary border-2 border-accent-primary shadow-[0_0_10px_var(--accent-primary)]' : item.status === 'completed' ? 'bg-status-success border-2 border-status-success shadow-none' : 'bg-surface-color-light border-2 border-border-color shadow-none'}`}></div>
                  {index < schedule.length - 1 && (
                    <div className={`w-0.5 h-full absolute top-4 z-[1] ${item.status === 'completed' ? 'bg-status-success' : 'bg-border-color'}`}></div>
                  )}
                </div>
                
                <div className={`flex-1 p-3.5 sm:p-4 rounded-lg sm:-mt-3 flex justify-between items-start gap-3 ${item.status === 'active' ? 'bg-[rgba(251,200,21,0.1)] border border-[rgba(251,200,21,0.3)]' : 'bg-surface-color-light/20 sm:bg-transparent border border-border-color sm:border-transparent'}`}>
                  <div>
                    <h3 className="m-0 mb-2 text-[1.1rem] text-text-primary font-heading tracking-[2px] leading-[1.1] uppercase">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-text-secondary text-[0.9rem]">
                      <MapPin size={14} /> {item.description}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-text-primary bg-transparent text-text-primary hover:bg-text-primary hover:text-black" title="Edit Item" onClick={() => openModal(item)}><Edit3 size={16} /></button>
                    <button className="inline-flex items-center justify-center p-1.5 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border border-status-error bg-transparent text-status-error hover:bg-status-error hover:text-white" title="Delete Item" onClick={() => deleteScheduleItem(item.id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 bg-[rgba(5,5,8,0.85)] backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in overflow-y-auto">
          <div className="bg-surface-color border border-accent-primary rounded-xl w-full max-w-[500px] relative p-8 m-auto shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(251,200,21,0.2),0_0_20px_rgba(251,200,21,0.1)] transform translate-y-0" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button type="button" className="absolute top-4 right-4 bg-[rgba(255,255,255,0.05)] border border-border-color text-text-primary w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-status-error hover:border-status-error hover:text-white hover:rotate-90" onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 className="mb-6 text-accent-primary font-heading tracking-[2px] leading-[1.1] uppercase m-0 text-[2.2rem]">{currentItem ? 'Edit Schedule Item' : 'Add Schedule Item'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Time (e.g. 09:00 AM)</label>
                <input required type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Location</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.9rem] text-accent-primary uppercase font-tech font-bold tracking-[2px]">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="bg-[rgba(13,13,20,0.7)] border border-border-color text-white p-3 rounded outline-none focus:border-accent-primary transition-colors font-sans tracking-normal">
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow">{currentItem ? 'Update Item' : 'Add Item'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
