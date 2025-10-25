# Twitch Predictions Integration

This guide explains how to set up automatic Twitch Predictions for the Slash or Smash show.

## Overview

The Twitch integration automatically:
- Creates a prediction when voting starts (options: "Smash" vs "Slash")
- Resolves the prediction when voting locks based on the judge average:
  - **≥ 2.5 average = Smash wins**
  - **< 2.5 average = Slash wins**
- Cancels the prediction if voting is reopened (refunds channel points)
- Syncs the prediction window with the voting timer (default 120 seconds)

## Setup

### 1. Create a Twitch Application

1. Go to https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
3. Fill in the details:
   - **Name**: "Slash or Smash" (or your preferred name)
   - **OAuth Redirect URLs**: 
     - Local: `http://localhost:5000/api/integrations/twitch/callback`
     - Production: `https://yourdomain.com/api/integrations/twitch/callback`
   - **Category**: "Broadcasting Suite"
4. Click "Create"
5. Copy the **Client ID**
6. Click "New Secret" and copy the **Client Secret**

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# Twitch Integration
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:5000/api/integrations/twitch/callback
```

For production, update `TWITCH_REDIRECT_URI` to match your deployed domain.

### 3. Connect Your Twitch Account

1. Start the application
2. Log in to the Producer Dashboard at `/control`
3. Scroll to the "Overrides & Settings" section
4. Find the "Twitch Integration" card
5. Click "Connect Twitch Account"
6. Authorize the application on Twitch
7. You'll be redirected back to the dashboard

### 4. Enable Predictions

Once connected:
1. Toggle "Automatic Predictions" to **ON**
2. Predictions will now auto-create when you start voting
3. They will auto-resolve when voting locks

## Usage

### During the Show

**Starting a Round:**
1. Arm the next image (Ready state)
2. Click "Start Voting"
3. A Twitch prediction is automatically created with "Smash" vs "Slash" options

**Locking Votes:**
1. Click "Lock" or wait for the timer to expire
2. The prediction is automatically resolved based on the judge average
3. Twitch chat sees the winner immediately

**Reopening a Round:**
1. Click "Reopen"
2. The existing prediction is canceled (refunds points)
3. When you click "Start Voting" again, a new prediction is created

### Manual Control

If a prediction fails to create or resolve:
1. Check the integration status in the dashboard
2. Try disconnecting and reconnecting your Twitch account
3. Use the "Retry" button (if available) to manually create a prediction
4. As a fallback, manually create/resolve predictions on Twitch.tv

## Troubleshooting

### "Twitch integration not configured"
- Make sure `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are set in your `.env` file
- Restart the server after adding environment variables

### "Failed to connect"
- Check that your redirect URI matches exactly what's configured in the Twitch app
- Make sure your Twitch channel is Affiliate or Partner (required for Predictions)
- Verify you're authorizing with the correct Twitch account (broadcaster)

### "Failed to create prediction"
- Ensure predictions are enabled on your Twitch channel
- Check that you don't have another active prediction running
- Verify your access token hasn't expired (should auto-refresh)

### Predictions not resolving
- Check the server logs for errors
- Verify votes are being received from judges
- Ensure the average calculation is working (check Results screen)

## Technical Details

### Threshold Logic

The verdict is determined by the judge average:
```typescript
average >= 2.5 ? 'Smash' : 'Slash'
```

This matches the overlay display logic for consistency.

### Prediction Lifecycle

1. **round:start** → Create prediction
   - Title: "Will this get a SMASH or SLASH? 🔥❌"
   - Outcomes: ["Smash", "Slash"]
   - Duration: Same as voting timer (default 120s)

2. **round:lock** → Resolve prediction
   - Calculate judge average
   - Determine winner (≥2.5 = Smash, <2.5 = Slash)
   - Resolve prediction with winning outcome

3. **round:reopen** → Cancel prediction
   - Cancel active prediction (refunds points)
   - Create new prediction when voting restarts

### OAuth Scopes

The integration requires:
- `channel:manage:predictions` - Create, update, and cancel predictions

### Token Storage

- Access tokens and refresh tokens are stored in the `run_state` table
- Tokens are automatically refreshed before expiration
- Disconnect clears all stored tokens

## Security Notes

- Client secret should never be committed to git
- Use environment variables for all credentials
- Tokens are stored server-side only (never sent to frontend)
- OAuth flow uses state parameter for CSRF protection

## Future Enhancements

Potential improvements:
- Custom prediction titles per image
- Configurable threshold (make 2.5 adjustable)
- Prediction result analytics/history
- Discord/chat notifications when predictions resolve
- Multi-language support for prediction text
