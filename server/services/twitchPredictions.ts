import { getTwitchClient } from './twitchClient.js';
import { getRunState, setRunState, clearRunState } from './runStateStore.js';
import { getVoteSummary } from './voteStore.js';
import { db } from '../db.js';

const SMASH_THRESHOLD = 2.5;

/**
 * Create a Twitch prediction when voting starts
 */
export async function createPredictionForRound(imageId: string, durationSeconds: number): Promise<void> {
  try {
    // Check if predictions are enabled
    const disabled = getRunState('twitch_prediction_id') === 'disabled';
    if (disabled) {
      console.log('Twitch predictions are disabled');
      return;
    }

    const client = getTwitchClient();
    if (!client) {
      console.log('Twitch client not available');
      return;
    }

    const connected = await client.isConnected();
    if (!connected) {
      console.log('Twitch not connected');
      return;
    }

    // Cancel any existing prediction first
    await cancelActivePrediction();

    // Create new prediction
    const prediction = await client.createPrediction({
      title: 'Will this get a SMASH or SLASH? 🔥❌',
      outcomes: ['Smash', 'Slash'],
      predictionWindowSeconds: durationSeconds,
    });

    if (prediction) {
      // Store prediction ID
      setRunState('twitch_prediction_id', prediction.id);
      
      // Store outcome IDs for later resolution
      // outcomes[0] = Smash, outcomes[1] = Slash
      if (prediction.outcomes && prediction.outcomes.length === 2) {
        setTwitchState('prediction_smash_outcome_id', prediction.outcomes[0].id);
        setTwitchState('prediction_slash_outcome_id', prediction.outcomes[1].id);
      }
      
      console.log(`Created Twitch prediction ${prediction.id} for image ${imageId}`);
    } else {
      console.error('Failed to create Twitch prediction');
    }
  } catch (error) {
    console.error('Error creating Twitch prediction:', error);
  }
}

// Helper functions for storing prediction outcome IDs
function setTwitchState(key: string, value: string): void {
  const stmt = db.prepare<[string, string]>(
    `INSERT INTO run_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  stmt.run(`twitch_${key}`, value);
}

function getTwitchState(key: string): string | null {
  const stmt = db.prepare<[string]>(`SELECT value FROM run_state WHERE key = ?`);
  const row = stmt.get(`twitch_${key}`) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * Resolve a Twitch prediction when voting is locked
 */
export async function resolvePredictionForRound(imageId: string): Promise<void> {
  try {
    const predictionId = getRunState('twitch_prediction_id');
    if (!predictionId || predictionId === 'disabled') {
      return;
    }

    const client = getTwitchClient();
    if (!client) {
      return;
    }

    // Get vote summary to determine winner
    const summary = getVoteSummary(imageId);
    if (!summary || summary.average === null) {
      console.error('No vote summary available for image', imageId);
      return;
    }

    // Get stored outcome IDs
    const smashOutcomeId = getTwitchState('prediction_smash_outcome_id');
    const slashOutcomeId = getTwitchState('prediction_slash_outcome_id');
    
    if (!smashOutcomeId || !slashOutcomeId) {
      console.error('Missing outcome IDs for prediction resolution');
      clearRunState('twitch_prediction_id');
      return;
    }

    // Determine winner based on threshold
    // >= 2.5 = Smash, < 2.5 = Slash
    const isSmash = summary.average >= SMASH_THRESHOLD;
    const winningOutcomeId = isSmash ? smashOutcomeId : slashOutcomeId;
    
    console.log(
      `Resolving prediction ${predictionId}: average=${summary.average}, threshold=${SMASH_THRESHOLD}, winner=${
        isSmash ? 'Smash' : 'Slash'
      }`
    );

    const success = await client.resolvePrediction({
      predictionId,
      winningOutcomeId,
    });

    if (success) {
      console.log(`Resolved prediction ${predictionId} with winner: ${isSmash ? 'Smash' : 'Slash'}`);
    } else {
      console.error('Failed to resolve prediction');
    }
    
    // Clear the prediction ID
    clearRunState('twitch_prediction_id');
  } catch (error) {
    console.error('Error resolving Twitch prediction:', error);
  }
}

/**
 * Cancel active prediction (used when reopening voting)
 */
export async function cancelActivePrediction(): Promise<void> {
  try {
    const predictionId = getRunState('twitch_prediction_id');
    if (!predictionId || predictionId === 'disabled') {
      return;
    }

    const client = getTwitchClient();
    if (!client) {
      return;
    }

    const success = await client.cancelPrediction(predictionId);
    if (success) {
      console.log(`Cancelled Twitch prediction ${predictionId}`);
    }

    clearRunState('twitch_prediction_id');
  } catch (error) {
    console.error('Error canceling Twitch prediction:', error);
  }
}
