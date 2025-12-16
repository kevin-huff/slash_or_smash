import express from 'express';
import { getTwitchClient } from '../services/twitchClient.js';
import { getRunState, setRunState } from '../services/runStateStore.js';

const router = express.Router();

// Get Twitch integration status
router.get('/status', async (_req, res) => {
  console.log('[Twitch Route] /status endpoint called');
  try {
    const client = getTwitchClient();
    console.log('[Twitch Route] Got client:', client ? 'YES' : 'NO');
    
    if (!client) {
      console.log('[Twitch Route] Returning not configured');
      return res.json({
        connected: false,
        configured: false,
        error: 'Twitch credentials not configured',
      });
    }

    const connected = await client.isConnected();
    const enabled = getRunState('twitch_prediction_id') !== 'disabled';

    console.log('[Twitch Route] Connected:', connected, 'Enabled:', enabled);

    res.json({
      connected,
      configured: true,
      enabled,
    });
  } catch (error) {
    console.error('Error checking Twitch status:', error);
    res.status(500).json({ error: 'Failed to check Twitch status' });
  }
});

// Initiate OAuth flow
router.get('/connect', (_req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:5000/api/integrations/twitch/callback';

  if (!clientId) {
    return res.status(500).json({ error: 'Twitch not configured' });
  }

  const scopes = ['channel:manage:predictions', 'chat:read', 'chat:edit'];
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`;

  res.redirect(authUrl);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:5000/api/integrations/twitch/callback';

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const client = getTwitchClient();
    if (!client) {
      return res.status(500).send('Twitch not configured');
    }

    const tokens = await client.exchangeCodeForTokens(code, redirectUri);
    
    if (!tokens) {
      return res.status(500).send('Failed to exchange authorization code for tokens');
    }

    // Redirect back to control dashboard with success message
    res.redirect('/control?twitch=connected');
  } catch (error) {
    console.error('Error in Twitch OAuth callback:', error);
    res.status(500).send('OAuth callback failed');
  }
});

// Disconnect Twitch
router.post('/disconnect', async (_req, res) => {
  try {
    const client = getTwitchClient();
    
    if (!client) {
      return res.status(500).json({ error: 'Twitch not configured' });
    }

    await client.disconnect();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Twitch:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Enable/disable predictions
router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled) {
      // Clear the disabled flag
      setRunState('twitch_prediction_id', '');
    } else {
      // Set disabled flag
      setRunState('twitch_prediction_id', 'disabled');
    }
    
    res.json({ success: true, enabled });
  } catch (error) {
    console.error('Error toggling Twitch predictions:', error);
    res.status(500).json({ error: 'Failed to toggle predictions' });
  }
});

// Manual retry for failed prediction
router.post('/prediction/retry', async (req, res) => {
  try {
    const { imageId, duration } = req.body;
    
    if (!imageId || !duration) {
      return res.status(400).json({ error: 'Missing imageId or duration' });
    }

    const client = getTwitchClient();
    if (!client) {
      return res.status(500).json({ error: 'Twitch not configured' });
    }

    const connected = await client.isConnected();
    if (!connected) {
      return res.status(400).json({ error: 'Twitch not connected' });
    }

    // Create prediction
    const prediction = await client.createPrediction({
      title: 'Will this get a SMASH or SLASH? 🔥❌',
      outcomes: ['Smash', 'Slash'],
      predictionWindowSeconds: duration,
    });

    if (!prediction) {
      return res.status(500).json({ error: 'Failed to create prediction' });
    }

    // Store prediction ID
    setRunState('twitch_prediction_id', prediction.id);

    res.json({ success: true, predictionId: prediction.id });
  } catch (error) {
    console.error('Error retrying prediction:', error);
    res.status(500).json({ error: 'Failed to retry prediction' });
  }
});

export default router;
