// Background Location Task
// This module defines and exports the background location task that runs even when the app is closed
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { BATCH_LOCATIONS, LOCATIONS } from '../constants/api';

// Task name - must be unique across the app
export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Storage keys
const STORAGE_KEY = 'offline_locations_v2';
const DEAD_KEY = 'dead_locations_v2';

// Simple UUID generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Safe JSON parse
const safeParse = (s) => {
  try { return JSON.parse(s || '[]'); } catch { return []; }
};

// Load stored queue
async function loadStoredQueue() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

// Save stored queue
async function saveStoredQueue(arr) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// Append to dead letter queue
async function appendDead(item, meta = {}) {
  const raw = await AsyncStorage.getItem(DEAD_KEY);
  const arr = safeParse(raw);
  arr.push({ item, meta, failedAt: new Date().toISOString() });
  await AsyncStorage.setItem(DEAD_KEY, JSON.stringify(arr));
}

// Send single location to server
async function sendOneToServer(item) {
  const res = await fetch(LOCATIONS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`status:${res.status}`);
  return res;
}

// Send batch of locations to server
async function sendBatchToServer(batch) {
  const res = await fetch(BATCH_LOCATIONS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`batch status:${res.status}`);
  return res;
}

// Enqueue location data
async function enqueueLocation(locationData) {
  try {
    const queue = await loadStoredQueue();
    const clientId = generateUUID();
    const item = { clientId, ...locationData };

    queue.push(item);

    // Cap queue at 2000 items
    if (queue.length > 2000) {
      queue.splice(0, queue.length - 2000);
    }

    await saveStoredQueue(queue);
    console.log('[BG Task] Enqueued location, queue size:', queue.length);

    // Try to flush if online
    await tryFlushQueue();
  } catch (error) {
    console.error('[BG Task] Error enqueueing location:', error);
  }
}

// Try to flush queue to server
async function tryFlushQueue() {
  try {
    const net = await Network.getNetworkStateAsync();
    if (!(net.isConnected && net.isInternetReachable)) {
      console.log('[BG Task] Offline, skipping flush');
      return;
    }

    const queue = await loadStoredQueue();
    if (queue.length === 0) return;

    console.log('[BG Task] Flushing queue, size:', queue.length);

    // Process in batches of 25
    const BATCH_SIZE = 25;
    const batch = queue.slice(0, BATCH_SIZE);

    try {
      // Try batch send first
      await sendBatchToServer(batch);
      console.log('[BG Task] Batch sent successfully');

      // Remove sent items
      queue.splice(0, batch.length);
      await saveStoredQueue(queue);
    } catch (error) {
      console.log('[BG Task] Batch failed, trying individual sends');

      // Fallback to individual sends
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        try {
          await sendOneToServer(item);
          // Remove successful item
          queue.shift();
        } catch (err) {
          console.error('[BG Task] Item send failed:', err);
          // Move to dead letter queue
          await appendDead(item, { reason: 'send_failed' });
          queue.shift();
        }
      }

      await saveStoredQueue(queue);
    }
  } catch (error) {
    console.error('[BG Task] Error flushing queue:', error);
  }
}

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BG Task] Error:', error);
    return;
  }

  if (data) {
    const { locations } = data;

    // Get tracking metadata from storage
    const trackingDataRaw = await AsyncStorage.getItem('tracking_metadata');
    const trackingData = trackingDataRaw ? JSON.parse(trackingDataRaw) : null;

    if (!trackingData || !trackingData.userId || !trackingData.shtabId) {
      console.log('[BG Task] No tracking metadata found');
      return;
    }

    // Process each location
    for (const location of locations) {
      const locationData = {
        userId: trackingData.userId,
        shtabId: trackingData.shtabId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date(location.timestamp).toISOString(),
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
      };

      console.log('[BG Task] Processing location:', locationData);
      await enqueueLocation(locationData);
    }
  }
});

// Check if task is defined
export function isTaskDefined() {
  return TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
}
