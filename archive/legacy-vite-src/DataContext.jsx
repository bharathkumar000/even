import React, { createContext, useState, useEffect } from 'react';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('ideathon_teams_v2');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [judges, setJudges] = useState(() => {
    const saved = localStorage.getItem('ideathon_judges_v2');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem('ideathon_schedule_v3');
    if (saved) return JSON.parse(saved);
    return [];
  });

  useEffect(() => {
    localStorage.setItem('ideathon_teams_v2', JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('ideathon_judges_v2', JSON.stringify(judges));
  }, [judges]);

  useEffect(() => {
    localStorage.setItem('ideathon_schedule_v3', JSON.stringify(schedule));
  }, [schedule]);

  // Judge Actions
  const addJudge = (judge) => setJudges(prev => [...prev, { ...judge, id: `J${Date.now()}` }]);
  const editJudge = (id, updated) => setJudges(prev => prev.map(j => j.id === id ? { ...j, ...updated } : j));
  const deleteJudge = (id) => {
    setJudges(prev => prev.filter(j => j.id !== id));
    setTeams(prev => prev.map(t => t.judgeId === id ? { ...t, judgeId: null } : t));
  };
  
  // Team Actions
  const assignJudgeToTeam = (teamId, judgeId) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, judgeId: judgeId === "" ? null : judgeId } : t));
  };
  
  const addTeam = (team) => {
    setTeams(prev => [...prev, { ...team, id: `T${Date.now()}`, judgeId: null, disqualified: false, disqualifyReason: '' }]);
  };
  
  const editTeam = (id, updated) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };
  
  const deleteTeam = (id) => {
    setTeams(prev => prev.filter(t => t.id !== id));
  };
  
  const disqualifyTeam = (id, reason) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, disqualified: true, disqualifyReason: reason } : t));
  };

  // Schedule Actions
  const addScheduleItem = (item) => setSchedule(prev => [...prev, { ...item, id: `S${Date.now()}` }]);
  const editScheduleItem = (id, updated) => setSchedule(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  const deleteScheduleItem = (id) => setSchedule(prev => prev.filter(s => s.id !== id));

  return (
    <DataContext.Provider value={{ 
      teams, setTeams, 
      judges, setJudges, 
      schedule, setSchedule,
      addJudge, editJudge, deleteJudge, 
      assignJudgeToTeam, addTeam, editTeam, deleteTeam, disqualifyTeam,
      addScheduleItem, editScheduleItem, deleteScheduleItem
    }}>
      {children}
    </DataContext.Provider>
  );
};
