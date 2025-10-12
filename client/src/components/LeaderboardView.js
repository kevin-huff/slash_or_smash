import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './LeaderboardView.css';

const socket = io();

function LeaderboardView() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    loadResults();

    socket.on('voting_locked', loadResults);
    socket.on('score_overridden', loadResults);

    return () => {
      socket.off('voting_locked');
      socket.off('score_overridden');
    };
  }, []);

  const loadResults = async () => {
    const res = await axios.get('/api/results');
    setResults(res.data);
  };

  return (
    <div className="leaderboard-view">
      <header className="leaderboard-header">
        <h1>📊 LEADERBOARD</h1>
        <p className="subtitle">Top Rated Horrors</p>
      </header>

      <div className="leaderboard-content">
        {results.length === 0 ? (
          <div className="no-data">
            <p>No ratings yet</p>
            <p>Check back after voting begins!</p>
          </div>
        ) : (
          <div className="leaderboard-table">
            <div className="table-header">
              <div className="col-rank">Rank</div>
              <div className="col-image">Image</div>
              <div className="col-name">Name</div>
              <div className="col-score">Score</div>
              <div className="col-votes">Votes</div>
            </div>
            
            {results.map((image, index) => {
              const voteCount = Object.keys(image.votes).length;
              const isPodium = index < 3;
              
              return (
                <div key={image.id} className={`table-row ${isPodium ? `podium-${index + 1}` : ''}`}>
                  <div className="col-rank">
                    <span className="rank-number">{index + 1}</span>
                    {index === 0 && <span className="trophy">🥇</span>}
                    {index === 1 && <span className="trophy">🥈</span>}
                    {index === 2 && <span className="trophy">🥉</span>}
                  </div>
                  
                  <div className="col-image">
                    <img src={`/uploads/${image.filename}`} alt={image.original_name} />
                  </div>
                  
                  <div className="col-name">
                    <span className="image-name">{image.original_name}</span>
                  </div>
                  
                  <div className="col-score">
                    <span className="score-value">{image.final_score.toFixed(2)}</span>
                  </div>
                  
                  <div className="col-votes">
                    <span className="vote-count">{voteCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardView;
