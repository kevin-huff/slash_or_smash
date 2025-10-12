import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './ProducerView.css';

const socket = io();

function ProducerView() {
  const [queue, setQueue] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [timer, setTimer] = useState({ remaining: 30, state: 'stopped' });
  const [votes, setVotes] = useState({});
  const [judges, setJudges] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [timerDuration, setTimerDuration] = useState(30);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  useEffect(() => {
    loadQueue();
    loadJudges();
    loadState();

    socket.on('queue_updated', loadQueue);
    socket.on('current_image', setCurrentImage);
    socket.on('timer_update', setTimer);
    socket.on('vote_received', ({ votes }) => setVotes(votes));
    socket.on('voting_locked', loadQueue);

    return () => {
      socket.off('queue_updated');
      socket.off('current_image');
      socket.off('timer_update');
      socket.off('vote_received');
      socket.off('voting_locked');
    };
  }, []);

  const loadQueue = async () => {
    const res = await axios.get('/api/queue');
    setQueue(res.data);
  };

  const loadJudges = async () => {
    const res = await axios.get('/api/judges');
    setJudges(res.data);
  };

  const loadState = async () => {
    const res = await axios.get('/api/state');
    if (res.data.currentImage) setCurrentImage(res.data.currentImage);
    setTimer(res.data.timer);
    setVotes(res.data.votes);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      await axios.post('/api/upload', formData);
    }

    setUploading(false);
    e.target.value = '';
  };

  const showImage = async (id) => {
    await axios.post(`/api/show/${id}`);
  };

  const removeFromQueue = async (id) => {
    if (window.confirm('Remove this image from queue?')) {
      await axios.delete(`/api/queue/${id}`);
    }
  };

  const startTimer = async () => {
    await axios.post('/api/timer/start');
  };

  const pauseTimer = async () => {
    await axios.post('/api/timer/pause');
  };

  const stopTimer = async () => {
    await axios.post('/api/timer/stop');
  };

  const extendTimer = async (seconds) => {
    await axios.post('/api/timer/extend', { seconds });
  };

  const setDuration = async () => {
    await axios.post('/api/timer/set', { duration: timerDuration });
  };

  const lockVoting = async () => {
    if (currentImage && window.confirm('Lock voting for current image?')) {
      await axios.post(`/api/lock/${currentImage.id}`);
    }
  };

  const handleOverride = async () => {
    if (currentImage) {
      await axios.post(`/api/override/${currentImage.id}`, {
        score: parseFloat(overrideScore),
        reason: overrideReason
      });
      setShowOverrideModal(false);
      setOverrideScore('');
      setOverrideReason('');
    }
  };

  const createJudge = async () => {
    if (newJudgeName.trim()) {
      const res = await axios.post('/api/judges/create', { name: newJudgeName });
      alert(`Judge created!\nName: ${res.data.name}\nCode: ${res.data.code}`);
      setNewJudgeName('');
      loadJudges();
    }
  };

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

  return (
    <div className="producer-view">
      <header className="producer-header">
        <h1>🔪 Producer Dashboard</h1>
        <div className="header-stats">
          <span>Judges: {judges.length}</span>
          <span>Queue: {queue.length}</span>
        </div>
      </header>

      <div className="producer-content">
        {/* Current Image Section */}
        <section className="current-section">
          <h2>Current Image</h2>
          {currentImage ? (
            <div className="current-image-card">
              <img src={`/uploads/${currentImage.filename}`} alt={currentImage.original_name} />
              <div className="current-image-info">
                <h3>{currentImage.original_name}</h3>
                <div className="timer-display">
                  <div className={`timer ${timer.state}`}>
                    {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
                  </div>
                  <div className="timer-state">{timer.state.toUpperCase()}</div>
                </div>
                
                <div className="timer-controls">
                  {timer.state === 'stopped' && (
                    <button onClick={startTimer} className="btn-start">▶ Start</button>
                  )}
                  {timer.state === 'running' && (
                    <button onClick={pauseTimer} className="btn-pause">⏸ Pause</button>
                  )}
                  {timer.state === 'paused' && (
                    <>
                      <button onClick={startTimer} className="btn-start">▶ Resume</button>
                      <button onClick={stopTimer} className="btn-stop">⏹ Stop</button>
                    </>
                  )}
                  <button onClick={() => extendTimer(10)} className="btn-extend">+10s</button>
                  <button onClick={() => extendTimer(30)} className="btn-extend">+30s</button>
                </div>

                <div className="vote-summary">
                  <h4>Live Votes ({totalVotes}) - Avg: {avgScore.toFixed(2)}</h4>
                  <div className="vote-bars">
                    {[5, 4, 3, 2, 1].map(score => (
                      <div key={score} className="vote-bar">
                        <span className="score-label">{score}</span>
                        <div className="bar-container">
                          <div 
                            className="bar-fill" 
                            style={{ width: `${totalVotes > 0 ? (scores[score] / totalVotes) * 100 : 0}%` }}
                          />
                          <span className="bar-count">{scores[score]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="judge-votes">
                    {Object.entries(votes).map(([judgeId, vote]) => (
                      <div key={judgeId} className="judge-vote">
                        <span>{vote.judgeName}:</span>
                        <span className="vote-score">{vote.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="action-buttons">
                  {!currentImage.locked_at ? (
                    <button onClick={lockVoting} className="btn-lock">🔒 Lock Voting</button>
                  ) : (
                    <span className="locked-badge">🔒 LOCKED</span>
                  )}
                  <button onClick={() => setShowOverrideModal(true)} className="btn-override">
                    ⚠️ Override Score
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-image">
              <p>No image currently showing</p>
              <p>Select an image from the queue below</p>
            </div>
          )}
        </section>

        {/* Queue Section */}
        <section className="queue-section">
          <div className="section-header">
            <h2>Queue ({queue.length})</h2>
            <div className="upload-area">
              <label className="btn-upload">
                {uploading ? '⏳ Uploading...' : '📁 Upload Images'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
          
          <div className="queue-grid">
            {queue.map(image => (
              <div key={image.id} className="queue-item">
                <img src={`/uploads/${image.filename}`} alt={image.original_name} />
                <div className="queue-item-info">
                  <span className="queue-name">{image.original_name}</span>
                  <div className="queue-actions">
                    <button onClick={() => showImage(image.id)} className="btn-show">
                      📺 Show
                    </button>
                    <button onClick={() => removeFromQueue(image.id)} className="btn-remove">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Judges Section */}
        <section className="judges-section">
          <h2>Judges ({judges.length})</h2>
          <div className="create-judge">
            <input
              type="text"
              placeholder="Judge name"
              value={newJudgeName}
              onChange={(e) => setNewJudgeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createJudge()}
            />
            <button onClick={createJudge} className="btn-create">Create Judge</button>
          </div>
          
          <div className="judges-list">
            {judges.map(judge => (
              <div key={judge.id} className="judge-card">
                <div className="judge-info">
                  <strong>{judge.name}</strong>
                  <code className="judge-code">{judge.code}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timer Settings */}
        <section className="settings-section">
          <h2>Timer Settings</h2>
          <div className="timer-settings">
            <input
              type="number"
              value={timerDuration}
              onChange={(e) => setTimerDuration(parseInt(e.target.value))}
              min="5"
              max="300"
            />
            <button onClick={setDuration} className="btn-set">Set Duration</button>
          </div>
        </section>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Override Score</h2>
            <p className="warning">⚠️ This action will be audit logged</p>
            <input
              type="number"
              placeholder="Score (0-5)"
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              min="0"
              max="5"
              step="0.1"
            />
            <textarea
              placeholder="Reason for override"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows="3"
            />
            <div className="modal-buttons">
              <button onClick={handleOverride} className="btn-confirm">Confirm Override</button>
              <button onClick={() => setShowOverrideModal(false)} className="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProducerView;
