import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './OverlayView.css';

const socket = io();

function OverlayView() {
  const [currentImage, setCurrentImage] = useState(null);
  const [timer, setTimer] = useState({ remaining: 30, state: 'stopped' });
  const [votes, setVotes] = useState({});

  useEffect(() => {
    socket.on('current_image', setCurrentImage);
    socket.on('timer_update', setTimer);
    socket.on('vote_received', ({ votes }) => setVotes(votes));
    socket.on('voting_locked', () => {
      setTimeout(() => {
        setVotes({});
      }, 3000);
    });

    return () => {
      socket.off('current_image');
      socket.off('timer_update');
      socket.off('vote_received');
      socket.off('voting_locked');
    };
  }, []);

  const getCurrentScores = () => {
    const scores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    Object.values(votes).forEach(vote => {
      scores[vote.score]++;
    });
    return scores;
  };

  const scores = getCurrentScores();
  const totalVotes = Object.values(votes).length;
  const avgScore = totalVotes > 0 
    ? Object.values(votes).reduce((sum, v) => sum + v.score, 0) / totalVotes 
    : 0;
  const maxVotes = Math.max(...Object.values(scores), 1);

  if (!currentImage) {
    return (
      <div className="overlay-view">
        <div className="overlay-standby">
          <h1 className="standby-title">🔪 SLASH OR SMASH 🔪</h1>
          <p className="standby-text">Horror Edition</p>
          <p className="standby-subtext">Coming up next...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay-view">
      {/* Current Image Display */}
      <div className="overlay-image">
        <img src={`/uploads/${currentImage.filename}`} alt="Current" />
      </div>

      {/* Timer Overlay */}
      <div className="overlay-timer">
        <div className={`timer-circle ${timer.state}`}>
          <span className="timer-value">
            {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Live Voting Bars */}
      <div className="overlay-votes">
        <div className="votes-header">
          <h3>LIVE VOTES</h3>
          {totalVotes > 0 && (
            <div className="avg-score">
              Avg: <span>{avgScore.toFixed(2)}</span>
            </div>
          )}
        </div>
        
        <div className="vote-bars-overlay">
          {[5, 4, 3, 2, 1].map(score => (
            <div key={score} className="vote-bar-overlay">
              <span className="bar-label">{score}</span>
              <div className="bar-track">
                <div 
                  className={`bar-progress bar-${score}`}
                  style={{ width: `${(scores[score] / maxVotes) * 100}%` }}
                >
                  <span className="bar-value">{scores[score]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="total-votes">
          Total Votes: {totalVotes}
        </div>
      </div>

      {/* Image Name */}
      <div className="overlay-name">
        {currentImage.original_name}
      </div>
    </div>
  );
}

export default OverlayView;
