import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import JudgesPortal from './JudgesPortal';
import ParticipantsPortal from './ParticipantsPortal';
import { DataProvider } from './DataContext';
import EventFlow from './EventFlow';
import EventDetails from './EventDetails';
import './index.css';

function App() {
  return (
    <DataProvider>
      <Router>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/judges" element={<JudgesPortal />} />
              <Route path="/participants" element={<ParticipantsPortal />} />
              <Route path="/event-flow" element={<EventFlow />} />
              <Route path="/event-details" element={<EventDetails />} />
            </Routes>
          </main>
        </div>
      </Router>
    </DataProvider>
  );
}

export default App;
