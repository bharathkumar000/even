"use client";

import React, { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import SignOutButton from '@/components/SignOutButton';

export default function EventDetails() {
  const [formData, setFormData] = useState({
    clubName: 'IVC × InUnity',
    tagline: 'Ideate visualize create',
    eventName: 'Eventra 1.0 2026',
    venue: 'Sri H. Kempegowda Indoor Sports Complex',
    eventDate: '2026-10-26',
    eventTime: '09:00',
    notes: 'Bring your own laptops and chargers.'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    alert("Event Details Saved Successfully!");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-text-primary text-2xl sm:text-3xl md:text-[3rem] font-heading tracking-[2px] leading-[1.1] uppercase m-0 mb-2">Event Details</h1>
          <p className="text-text-secondary text-xs sm:text-sm leading-[1.6] m-0">Configure the foundational details of your Ideathon.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 font-bold font-tech uppercase tracking-[1px] cursor-pointer transition-all duration-200 border-none text-xs sm:text-base bg-accent-primary text-black hover:bg-accent-primary-hover hover:shadow-[0_0_15px_rgba(251,200,21,0.4)] animate-glow" onClick={handleSave}>
            <Save size={16} /> Save Changes
          </button>
          <SignOutButton variant="button" label="Sign Out" />
        </div>
      </header>

      <div className="bg-surface-color rounded-lg border border-border-color p-6 transition-all duration-300 hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(255,0,127,0.15)] mt-2 animate-fade-in animate-delay-1">
        <h2 className="text-[1.25rem] text-text-primary font-heading tracking-[2px] leading-[1.1] uppercase mb-6 flex items-center gap-2">
          <Settings size={24} color="var(--accent-secondary)" /> General Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Club / Organization Name</label>
            <input 
              type="text" 
              name="clubName" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.clubName}
              onChange={handleChange}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Event Name</label>
            <input 
              type="text" 
              name="eventName" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.eventName}
              onChange={handleChange}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Tagline / Motto</label>
            <input 
              type="text" 
              name="tagline" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.tagline}
              onChange={handleChange}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Venue</label>
            <input 
              type="text" 
              name="venue" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.venue}
              onChange={handleChange}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Event Date</label>
            <input 
              type="date" 
              name="eventDate" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.eventDate}
              onChange={handleChange}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Event Time</label>
            <input 
              type="time" 
              name="eventTime" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)]" 
              value={formData.eventTime}
              onChange={handleChange}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="font-tech text-accent-primary uppercase text-[0.9rem] tracking-[1px] font-bold">Additional Notes / Guidelines</label>
            <textarea 
              name="notes" 
              className="w-full py-3 px-4 bg-[rgba(13,13,20,0.7)] border border-border-color text-text-primary rounded font-sans tracking-normal transition-all duration-200 outline-none focus:border-accent-secondary focus:shadow-[0_0_10px_rgba(255,0,127,0.2)] resize-y min-h-[100px]" 
              value={formData.notes}
              onChange={handleChange}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
