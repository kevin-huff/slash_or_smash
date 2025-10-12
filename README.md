# slash_or_smash

Hot-or-Not: Horror Edition - A live, judge-only image rating show for October 29, 2025.

## Features

- **Producer Dashboard**: Upload and queue images, manage timer, control voting
- **Judge Portal**: Mobile-friendly scoring interface with one-time code access
- **Live Overlay**: Real-time display of current image, timer, and voting bars
- **Results & Leaderboard**: View final scores with per-judge breakdowns
- **Dark Horror Theme**: Immersive dark theme throughout the application
- **Audit Logging**: All producer actions (overrides, timer changes) are logged
- **Real-time Updates**: Socket.IO powered live updates across all views
- **SQLite Persistence**: All data persisted to database

## Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, Socket.IO Client
- **Database**: SQLite (better-sqlite3)
- **File Uploads**: Multer

## Installation

1. Clone the repository:
```bash
git clone https://github.com/kevin-huff/slash_or_smash.git
cd slash_or_smash
```

2. Install dependencies:
```bash
npm install
cd client && npm install && cd ..
```

3. Start the application:

For production:
```bash
# Build the client first
npm run build

# Start the server
npm start
```

For development:
```bash
# Run both server and client in development mode
npm run dev
```

The server will run on port 3001 by default.

## Usage

### Producer Dashboard (`/producer`)
- Upload images using the upload button
- Images are automatically added to the queue
- Click "Show" on any queued image to display it
- Use timer controls to start/pause/stop the 30-second timer
- Extend timer with +10s or +30s buttons
- View live voting bars and per-judge votes
- Lock voting when ready to finalize scores
- Override scores with audit-logged reason if needed
- Create judge access codes

### Judge Portal (`/judge`)
- Enter your unique judge code to access
- View the current image
- Vote 1-5 (last vote counts until locked)
- Change your vote anytime before locking
- Mobile-friendly design for easy judging

### Live Overlay (`/overlay`)
- Display on stream/screen for audience
- Shows current image with live voting bars
- Timer display in top-right corner
- Auto-updates in real-time

### Results (`/results`)
- View all completed ratings
- See final scores with judge breakdowns
- Sorted by highest score first

### Leaderboard (`/leaderboard`)
- Clean table view of all ratings
- Top 3 highlighted with medals
- Shows rank, image, name, score, and vote count

## Producer Controls

### Timer
- Default: 30 seconds
- Can be started, paused, stopped, extended
- Timer duration can be changed in settings
- Auto-stops at 0 and emits completion event

### Voting Lock
- Locks voting for current image
- Calculates final score from last vote per judge
- Prevents further vote changes

### Score Override
- Manual override with audit logging
- Requires reason to be entered
- Used for tie-breaks or corrections

## Database Schema

- **images**: Uploaded images and their queue positions
- **judges**: Judge codes and names
- **votes**: All votes (last per judge/image counts)
- **audit_log**: All producer actions with timestamps
- **settings**: System configuration and state

## License

This is free and unencumbered software released into the public domain (Unlicense).
