"use client";

import React, { createContext, useState, useEffect, ReactNode } from 'react';

// Define the shape of our data
export type Team = {
  id: string;
  name: string;
  theme: string;
  members: string[];
  judgeId: string | null;
  disqualified: boolean;
  disqualifyReason: string;
  leadName?: string;
  email?: string;
  college?: string;
  track?: string;
};

export type Judge = {
  id: string;
  name: string;
  email: string;
  initials: string;
  specialization: string;
  theme: string;
  expertise?: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  time: string;
  description: string;
  status: string;
};

type DataContextType = {
  teams: Team[];
  judges: Judge[];
  schedule: ScheduleItem[];
  addJudge: (judge: Partial<Judge>) => void;
  editJudge: (id: string, updated: Partial<Judge>) => void;
  deleteJudge: (id: string) => void;
  assignJudgeToTeam: (teamId: string, judgeId: string) => void;
  addTeam: (team: Partial<Team>) => void;
  editTeam: (id: string, updated: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  disqualifyTeam: (id: string, reason: string) => void;
  addScheduleItem: (item: Omit<ScheduleItem, "id"> | Partial<ScheduleItem>) => void;
  editScheduleItem: (id: string, updated: Partial<ScheduleItem>) => void;
  deleteScheduleItem: (id: string) => void;
};

export const DataContext = createContext<DataContextType>({} as DataContextType);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [isClient, setIsClient] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    setIsClient(true);
    const savedTeams = localStorage.getItem('ideathon_teams_v2');
    if (savedTeams) setTeams(JSON.parse(savedTeams));

    const savedJudges = localStorage.getItem('ideathon_judges_v2');
    if (savedJudges) setJudges(JSON.parse(savedJudges));

    const savedSchedule = localStorage.getItem('ideathon_schedule_v3');
    if (savedSchedule) setSchedule(JSON.parse(savedSchedule));
  }, []);

  useEffect(() => {
    if (isClient) localStorage.setItem('ideathon_teams_v2', JSON.stringify(teams));
  }, [teams, isClient]);

  useEffect(() => {
    if (isClient) localStorage.setItem('ideathon_judges_v2', JSON.stringify(judges));
  }, [judges, isClient]);

  useEffect(() => {
    if (isClient) localStorage.setItem('ideathon_schedule_v3', JSON.stringify(schedule));
  }, [schedule, isClient]);

  // Judge Actions
  const addJudge = (judge: Partial<Judge>) => {
    setJudges((prev) => [
      ...prev,
      {
        id: `J${Date.now()}`,
        name: judge.name || "",
        email: judge.email || "",
        initials: judge.initials || (judge.name ? judge.name.slice(0, 2).toUpperCase() : "JD"),
        specialization: judge.specialization || judge.expertise || "",
        theme: judge.theme || "",
        expertise: judge.expertise,
      },
    ]);
  };
  const editJudge = (id: string, updated: Partial<Judge>) => setJudges(prev => prev.map(j => j.id === id ? { ...j, ...updated } : j));
  const deleteJudge = (id: string) => {
    setJudges(prev => prev.filter(j => j.id !== id));
    setTeams(prev => prev.map(t => t.judgeId === id ? { ...t, judgeId: null } : t));
  };
  
  // Team Actions
  const assignJudgeToTeam = (teamId: string, judgeId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, judgeId: judgeId === "" ? null : judgeId } : t));
  };
  
  const addTeam = (team: Partial<Team>) => {
    setTeams((prev) => [
      ...prev,
      {
        id: `T${Date.now()}`,
        name: team.name || "",
        theme: team.theme || "",
        members: team.members || [],
        judgeId: null,
        disqualified: false,
        disqualifyReason: "",
        leadName: team.leadName,
        email: team.email,
        college: team.college,
        track: team.track,
      },
    ]);
  };
  
  const editTeam = (id: string, updated: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };
  
  const deleteTeam = (id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
  };
  
  const disqualifyTeam = (id: string, reason: string) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, disqualified: true, disqualifyReason: reason } : t));
  };

  // Schedule Actions
  const addScheduleItem = (item: Omit<ScheduleItem, "id"> | Partial<ScheduleItem>) => setSchedule(prev => [...prev, { title: "", time: "", description: "", status: "", ...item, id: `S${Date.now()}` }]);
  const editScheduleItem = (id: string, updated: Partial<ScheduleItem>) => setSchedule(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  const deleteScheduleItem = (id: string) => setSchedule(prev => prev.filter(s => s.id !== id));

  return (
    <DataContext.Provider value={{ 
      teams, 
      judges, 
      schedule,
      addJudge, editJudge, deleteJudge, 
      assignJudgeToTeam, addTeam, editTeam, deleteTeam, disqualifyTeam,
      addScheduleItem, editScheduleItem, deleteScheduleItem
    }}>
      {children}
    </DataContext.Provider>
  );
};
