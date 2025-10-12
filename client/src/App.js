import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ProducerView from './components/ProducerView';
import JudgeView from './components/JudgeView';
import OverlayView from './components/OverlayView';
import ResultsView from './components/ResultsView';
import LeaderboardView from './components/LeaderboardView';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/producer" element={<ProducerView />} />
          <Route path="/judge" element={<JudgeView />} />
          <Route path="/overlay" element={<OverlayView />} />
          <Route path="/results" element={<ResultsView />} />
          <Route path="/leaderboard" element={<LeaderboardView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function Home() {
  return (
    <div className="home">
      <div className="home-container">
        <h1 className="horror-title">🔪 SLASH OR SMASH 🔪</h1>
        <h2 className="horror-subtitle">Hot-or-Not: Horror Edition</h2>
        <p className="event-date">October 29, 2025</p>
        
        <div className="home-links">
          <Link to="/producer" className="home-link producer">
            👻 Producer Dashboard
          </Link>
          <Link to="/judge" className="home-link judge">
            👹 Judge Portal
          </Link>
          <Link to="/overlay" className="home-link overlay">
            📺 Live Overlay
          </Link>
          <Link to="/results" className="home-link results">
            🏆 Results
          </Link>
          <Link to="/leaderboard" className="home-link leaderboard">
            📊 Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
