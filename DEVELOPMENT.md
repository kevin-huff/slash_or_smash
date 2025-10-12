# Development Notes

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Development mode (both server and client with hot reload)
npm run dev

# Production mode
npm run build  # Builds client
npm start      # Starts server on port 3001
```

## Architecture

### Backend (server/)
- `server/index.js` - Main Express + Socket.IO server
- `server/database.js` - SQLite database initialization and schema

### Frontend (client/src/)
- `App.js` - Main routing
- `components/ProducerView.js` - Producer dashboard
- `components/JudgeView.js` - Judge voting interface
- `components/OverlayView.js` - Live stream overlay
- `components/ResultsView.js` - Results with judge breakdowns
- `components/LeaderboardView.js` - Leaderboard table

## Database Schema

### images
- id, filename, original_name
- queue_position (null when removed from queue)
- uploaded_at, shown_at, locked_at
- final_score

### judges
- id, code (unique), name
- created_at, last_active

### votes
- id, image_id, judge_id, score (1-5)
- voted_at

### audit_log
- id, action, image_id, details
- timestamp

### settings
- key, value (stores timer state, current image, etc.)

## API Endpoints

### Images
- POST /api/upload - Upload image(s)
- GET /api/queue - Get queued images
- POST /api/queue/reorder - Reorder queue
- DELETE /api/queue/:id - Remove from queue
- POST /api/show/:id - Show image as current

### Timer
- POST /api/timer/start - Start timer
- POST /api/timer/pause - Pause timer
- POST /api/timer/stop - Stop timer
- POST /api/timer/extend - Extend timer by seconds
- POST /api/timer/set - Set timer duration

### Voting
- POST /api/lock/:id - Lock voting for image
- POST /api/override/:id - Override score (audit logged)
- POST /api/vote - Submit judge vote

### Judges
- POST /api/judges/create - Create judge with code
- GET /api/judges - List all judges
- POST /api/judges/verify - Verify judge code

### State
- GET /api/state - Get current state (image, timer, votes)
- GET /api/results - Get all results with votes
- GET /api/audit - Get audit log

## Socket.IO Events

### Server → Client
- `current_image` - New image shown
- `timer_update` - Timer state change
- `vote_received` - New vote submitted
- `voting_locked` - Voting locked for image
- `score_overridden` - Score manually overridden
- `queue_updated` - Queue changed
- `timer_complete` - Timer reached 0

## Features

### Producer Controls
- Upload multiple images at once
- Drag to reorder queue (API ready, UI could be enhanced)
- 30s default timer (configurable)
- Pause/resume/stop/extend timer
- View live voting bars
- See per-judge votes
- Lock voting (calculates average of last vote per judge)
- Override final score with reason (audit logged)

### Judge Experience
- Login with one-time code
- View current image
- Vote 1-5 (can change until locked)
- Mobile-optimized large buttons
- Auto-logout capability

### Live Overlay
- Full-screen image display
- Timer in top-right corner
- Live voting bars (top-left)
- Smooth animations
- Stream/projector ready

### Results & Leaderboard
- Sort by final score
- Gold/silver/bronze highlights
- Per-judge vote breakdown
- Support for tie-breaks via override

## Future Enhancements (Not Required)
- Drag-and-drop queue reordering in UI
- Multiple simultaneous shows with sessions
- Export results to CSV
- Custom timer sounds
- Vote history graph per judge
- Image preview in queue
- Bulk image upload via folder
