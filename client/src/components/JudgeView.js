import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './JudgeView.css';

const socket = io();

function JudgeView() {
  const [judge, setJudge] = useState(null);
  const [code, setCode] = useState('');
  const [currentImage, setCurrentImage] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const savedJudge = localStorage.getItem('judge');
    if (savedJudge) {
      setJudge(JSON.parse(savedJudge));
    }

    socket.on('current_image', (image) => {
      setCurrentImage(image);
      setMyVote(null);
      setIsLocked(false);
    });

    socket.on('voting_locked', ({ imageId }) => {
      if (currentImage && currentImage.id === imageId) {
        setIsLocked(true);
      }
    });

    return () => {
      socket.off('current_image');
      socket.off('voting_locked');
    };
  }, [currentImage]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/judges/verify', { code: code.toUpperCase() });
      setJudge(res.data);
      localStorage.setItem('judge', JSON.stringify(res.data));
    } catch (error) {
      alert('Invalid code');
    }
  };

  const handleVote = async (score) => {
    if (!judge || !currentImage || isLocked) return;

    try {
      await axios.post('/api/vote', {
        judgeId: judge.id,
        imageId: currentImage.id,
        score
      });
      setMyVote(score);
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Voting is locked for this image');
        setIsLocked(true);
      } else {
        alert('Error submitting vote');
      }
    }
  };

  const handleLogout = () => {
    setJudge(null);
    localStorage.removeItem('judge');
    setCode('');
  };

  if (!judge) {
    return (
      <div className="judge-view">
        <div className="judge-login">
          <div className="login-card">
            <h1>🔪 Judge Portal</h1>
            <h2>Horror Edition</h2>
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder="Enter your judge code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={8}
                autoFocus
              />
              <button type="submit">Enter</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="judge-view">
      <header className="judge-header">
        <div className="judge-info">
          <h2>👹 {judge.name}</h2>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </header>

      <div className="judge-content">
        {currentImage ? (
          <div className="voting-area">
            <div className="image-container">
              <img src={`/uploads/${currentImage.filename}`} alt="Rate this" />
            </div>

            {isLocked ? (
              <div className="voting-locked">
                <h3>🔒 Voting Locked</h3>
                <p>Waiting for next image...</p>
              </div>
            ) : (
              <>
                <div className="vote-buttons">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => handleVote(score)}
                      className={`vote-btn ${myVote === score ? 'selected' : ''}`}
                    >
                      {score}
                    </button>
                  ))}
                </div>

                {myVote && (
                  <div className="vote-confirmation">
                    <p>Your vote: <strong>{myVote}</strong></p>
                    <p className="hint">You can change your vote until it's locked</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="waiting">
            <h2>⏳ Waiting for images...</h2>
            <p>Stand by for the next horror to rate!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JudgeView;
