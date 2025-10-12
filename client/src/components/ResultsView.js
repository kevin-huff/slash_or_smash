import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './ResultsView.css';

const socket = io();

function ResultsView() {
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
    <div className="results-view">
      <header className="results-header">
        <h1>🏆 Results</h1>
        <p>Final Scores - Horror Edition</p>
      </header>

      <div className="results-content">
        {results.length === 0 ? (
          <div className="no-results">
            <p>No completed ratings yet</p>
          </div>
        ) : (
          <div className="results-grid">
            {results.map((image, index) => (
              <div key={image.id} className="result-card">
                <div className="result-rank">#{index + 1}</div>
                <img src={`/uploads/${image.filename}`} alt={image.original_name} />
                <div className="result-info">
                  <h3>{image.original_name}</h3>
                  <div className="final-score">
                    Score: <span>{image.final_score.toFixed(2)}</span>
                  </div>
                  
                  <div className="judge-breakdown">
                    <h4>Judge Votes:</h4>
                    {Object.entries(image.votes).map(([judgeId, vote]) => (
                      <div key={judgeId} className="judge-result">
                        <span className="judge-name">{vote.judgeName}</span>
                        <span className="judge-score">{vote.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsView;
