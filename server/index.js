const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../client/build')));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${nanoid(10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database helper functions
const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
};

const logAudit = (action, imageId = null, details = null) => {
  db.prepare('INSERT INTO audit_log (action, image_id, details) VALUES (?, ?, ?)').run(action, imageId, details);
};

// Timer management
let timerInterval = null;

const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval);
  
  setSetting('timer_state', 'running');
  setSetting('timer_started_at', Date.now());
  
  timerInterval = setInterval(() => {
    const startedAt = parseInt(getSetting('timer_started_at'));
    const duration = parseInt(getSetting('timer_duration'));
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    
    setSetting('timer_remaining', remaining);
    io.emit('timer_update', { remaining, state: 'running' });
    
    if (remaining <= 0) {
      stopTimer();
      io.emit('timer_complete');
    }
  }, 100);
};

const pauseTimer = () => {
  if (timerInterval) clearInterval(timerInterval);
  setSetting('timer_state', 'paused');
  io.emit('timer_update', { 
    remaining: parseInt(getSetting('timer_remaining')), 
    state: 'paused' 
  });
};

const stopTimer = () => {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  setSetting('timer_state', 'stopped');
  const duration = parseInt(getSetting('timer_duration'));
  setSetting('timer_remaining', duration);
  io.emit('timer_update', { remaining: duration, state: 'stopped' });
};

const extendTimer = (seconds) => {
  const currentDuration = parseInt(getSetting('timer_duration'));
  const newDuration = currentDuration + seconds;
  setSetting('timer_duration', newDuration);
  
  const state = getSetting('timer_state');
  if (state === 'running') {
    const startedAt = parseInt(getSetting('timer_started_at'));
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, newDuration - elapsed);
    setSetting('timer_remaining', remaining);
  } else {
    setSetting('timer_remaining', newDuration);
  }
  
  logAudit('TIMER_EXTENDED', null, `Extended by ${seconds} seconds to ${newDuration}s total`);
  io.emit('timer_update', { 
    remaining: parseInt(getSetting('timer_remaining')), 
    state 
  });
};

// API Routes

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const maxPosition = db.prepare('SELECT MAX(queue_position) as max FROM images').get();
    const position = (maxPosition.max || 0) + 1;
    
    const result = db.prepare(
      'INSERT INTO images (filename, original_name, queue_position) VALUES (?, ?, ?)'
    ).run(req.file.filename, req.file.originalname, position);
    
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(result.lastInsertRowid);
    
    logAudit('IMAGE_UPLOADED', image.id, `File: ${req.file.originalname}`);
    io.emit('queue_updated');
    
    res.json(image);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue
app.get('/api/queue', (req, res) => {
  const images = db.prepare(
    'SELECT * FROM images WHERE queue_position IS NOT NULL ORDER BY queue_position'
  ).all();
  res.json(images);
});

// Reorder queue
app.post('/api/queue/reorder', (req, res) => {
  const { imageIds } = req.body;
  
  const stmt = db.prepare('UPDATE images SET queue_position = ? WHERE id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => {
      stmt.run(index + 1, id);
    });
  });
  
  transaction(imageIds);
  logAudit('QUEUE_REORDERED', null, `New order: ${imageIds.join(', ')}`);
  io.emit('queue_updated');
  
  res.json({ success: true });
});

// Remove from queue
app.delete('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE images SET queue_position = NULL WHERE id = ?').run(id);
  
  logAudit('IMAGE_REMOVED', id, 'Removed from queue');
  io.emit('queue_updated');
  
  res.json({ success: true });
});

// Show image (set as current)
app.post('/api/show/:id', (req, res) => {
  const { id } = req.params;
  
  // Update current image
  setSetting('current_image_id', id);
  db.prepare('UPDATE images SET shown_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  
  // Reset timer
  const duration = parseInt(getSetting('timer_duration'));
  setSetting('timer_remaining', duration);
  setSetting('timer_state', 'stopped');
  
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  
  logAudit('IMAGE_SHOWN', id, `Showing: ${image.original_name}`);
  io.emit('current_image', image);
  io.emit('timer_update', { remaining: duration, state: 'stopped' });
  
  res.json(image);
});

// Timer controls
app.post('/api/timer/start', (req, res) => {
  startTimer();
  logAudit('TIMER_STARTED', getSetting('current_image_id'));
  res.json({ success: true });
});

app.post('/api/timer/pause', (req, res) => {
  pauseTimer();
  logAudit('TIMER_PAUSED', getSetting('current_image_id'));
  res.json({ success: true });
});

app.post('/api/timer/stop', (req, res) => {
  stopTimer();
  logAudit('TIMER_STOPPED', getSetting('current_image_id'));
  res.json({ success: true });
});

app.post('/api/timer/extend', (req, res) => {
  const { seconds } = req.body;
  extendTimer(seconds || 10);
  res.json({ success: true });
});

app.post('/api/timer/set', (req, res) => {
  const { duration } = req.body;
  setSetting('timer_duration', duration);
  setSetting('timer_remaining', duration);
  logAudit('TIMER_DURATION_SET', null, `Duration set to ${duration} seconds`);
  io.emit('timer_update', { remaining: duration, state: getSetting('timer_state') });
  res.json({ success: true });
});

// Lock voting
app.post('/api/lock/:id', (req, res) => {
  const { id } = req.params;
  
  db.prepare('UPDATE images SET locked_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  
  // Calculate final score
  const votes = db.prepare(`
    SELECT v.score, v.judge_id, v.voted_at
    FROM votes v
    WHERE v.image_id = ?
    ORDER BY v.judge_id, v.voted_at DESC
  `).all(id);
  
  // Get last vote per judge
  const lastVotes = {};
  votes.forEach(vote => {
    if (!lastVotes[vote.judge_id]) {
      lastVotes[vote.judge_id] = vote.score;
    }
  });
  
  const scores = Object.values(lastVotes);
  const finalScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  db.prepare('UPDATE images SET final_score = ? WHERE id = ?').run(finalScore, id);
  
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  
  logAudit('VOTING_LOCKED', id, `Final score: ${finalScore.toFixed(2)}`);
  io.emit('voting_locked', { imageId: id, finalScore });
  
  res.json(image);
});

// Override score
app.post('/api/override/:id', (req, res) => {
  const { id } = req.params;
  const { score, reason } = req.body;
  
  db.prepare('UPDATE images SET final_score = ?, locked_at = CURRENT_TIMESTAMP WHERE id = ?').run(score, id);
  
  logAudit('SCORE_OVERRIDDEN', id, `Score set to ${score}. Reason: ${reason || 'N/A'}`);
  io.emit('score_overridden', { imageId: id, score });
  
  res.json({ success: true });
});

// Generate judge code
app.post('/api/judges/create', (req, res) => {
  const { name } = req.body;
  const code = nanoid(8).toUpperCase();
  
  const result = db.prepare('INSERT INTO judges (code, name) VALUES (?, ?)').run(code, name);
  const judge = db.prepare('SELECT * FROM judges WHERE id = ?').get(result.lastInsertRowid);
  
  logAudit('JUDGE_CREATED', null, `Judge: ${name}, Code: ${code}`);
  
  res.json(judge);
});

// Get all judges
app.get('/api/judges', (req, res) => {
  const judges = db.prepare('SELECT * FROM judges ORDER BY created_at DESC').all();
  res.json(judges);
});

// Verify judge code
app.post('/api/judges/verify', (req, res) => {
  const { code } = req.body;
  const judge = db.prepare('SELECT * FROM judges WHERE code = ?').get(code);
  
  if (judge) {
    db.prepare('UPDATE judges SET last_active = CURRENT_TIMESTAMP WHERE id = ?').run(judge.id);
    res.json(judge);
  } else {
    res.status(404).json({ error: 'Invalid code' });
  }
});

// Submit vote
app.post('/api/vote', (req, res) => {
  const { judgeId, imageId, score } = req.body;
  
  // Check if voting is locked
  const image = db.prepare('SELECT locked_at FROM images WHERE id = ?').get(imageId);
  if (image && image.locked_at) {
    return res.status(403).json({ error: 'Voting is locked for this image' });
  }
  
  // Record vote (last vote counts)
  db.prepare('INSERT INTO votes (image_id, judge_id, score) VALUES (?, ?, ?)').run(imageId, judgeId, score);
  
  db.prepare('UPDATE judges SET last_active = CURRENT_TIMESTAMP WHERE id = ?').run(judgeId);
  
  // Get current vote summary
  const votes = db.prepare(`
    SELECT v.score, v.judge_id, j.name as judge_name
    FROM votes v
    JOIN judges j ON v.judge_id = j.id
    WHERE v.image_id = ?
    ORDER BY v.judge_id, v.voted_at DESC
  `).all(imageId);
  
  // Get last vote per judge
  const lastVotes = {};
  votes.forEach(vote => {
    if (!lastVotes[vote.judge_id]) {
      lastVotes[vote.judge_id] = {
        score: vote.score,
        judgeName: vote.judge_name
      };
    }
  });
  
  io.emit('vote_received', { imageId, judgeId, score, votes: lastVotes });
  
  res.json({ success: true });
});

// Get current state
app.get('/api/state', (req, res) => {
  const currentImageId = getSetting('current_image_id');
  const currentImage = currentImageId !== 'null' 
    ? db.prepare('SELECT * FROM images WHERE id = ?').get(currentImageId)
    : null;
  
  const timerState = getSetting('timer_state');
  const timerRemaining = parseInt(getSetting('timer_remaining'));
  
  let votes = {};
  if (currentImage) {
    const allVotes = db.prepare(`
      SELECT v.score, v.judge_id, j.name as judge_name
      FROM votes v
      JOIN judges j ON v.judge_id = j.id
      WHERE v.image_id = ?
      ORDER BY v.judge_id, v.voted_at DESC
    `).all(currentImage.id);
    
    // Get last vote per judge
    allVotes.forEach(vote => {
      if (!votes[vote.judge_id]) {
        votes[vote.judge_id] = {
          score: vote.score,
          judgeName: vote.judge_name
        };
      }
    });
  }
  
  res.json({
    currentImage,
    timer: { state: timerState, remaining: timerRemaining },
    votes
  });
});

// Get results
app.get('/api/results', (req, res) => {
  const images = db.prepare(`
    SELECT * FROM images 
    WHERE final_score IS NOT NULL 
    ORDER BY final_score DESC, shown_at DESC
  `).all();
  
  const results = images.map(image => {
    const votes = db.prepare(`
      SELECT v.score, v.judge_id, j.name as judge_name
      FROM votes v
      JOIN judges j ON v.judge_id = j.id
      WHERE v.image_id = ?
      ORDER BY v.judge_id, v.voted_at DESC
    `).all(image.id);
    
    const lastVotes = {};
    votes.forEach(vote => {
      if (!lastVotes[vote.judge_id]) {
        lastVotes[vote.judge_id] = {
          score: vote.score,
          judgeName: vote.judge_name
        };
      }
    });
    
    return {
      ...image,
      votes: lastVotes
    };
  });
  
  res.json(results);
});

// Get audit log
app.get('/api/audit', (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100').all();
  res.json(logs);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current state on connection
  const currentImageId = getSetting('current_image_id');
  if (currentImageId !== 'null') {
    const currentImage = db.prepare('SELECT * FROM images WHERE id = ?').get(currentImageId);
    socket.emit('current_image', currentImage);
  }
  
  socket.emit('timer_update', {
    remaining: parseInt(getSetting('timer_remaining')),
    state: getSetting('timer_state')
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve React app for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cleanup on exit
process.on('SIGTERM', () => {
  if (timerInterval) clearInterval(timerInterval);
  db.close();
  server.close();
});
