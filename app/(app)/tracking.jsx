// TrackingScreen with Background Support
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Network from "expo-network";
import * as TaskManager from "expo-task-manager";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, View, Platform } from "react-native";
import { BATCH_LOCATIONS, LOCATIONS } from "../../constants/api";
import { BACKGROUND_LOCATION_TASK } from "../../services/backgroundLocationTask";

// Simple UUID v4 generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* =========================
   CONFIG
   ========================= */
const STORAGE_KEY = "offline_locations_v2";
const DEAD_KEY = "dead_locations_v2";
const PERSIST_INTERVAL_MS = 5000;
const FLUSH_INTERVAL_MS = 10_000;
const BATCH_SIZE = 25;
const MAX_QUEUE = 2000;
const MAX_BATCH_RETRY = 4;
const BASE_BACKOFF_MS = 1000;

/* =========================
   UTILS
   ========================= */
const safeParse = (s) => {
  try { return JSON.parse(s || "[]"); } catch { return []; }
};

async function loadStoredQueue() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

async function saveStoredQueue(arr) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

async function appendDead(item, meta = {}) {
  const raw = await AsyncStorage.getItem(DEAD_KEY);
  const arr = safeParse(raw);
  arr.push({ item, meta, failedAt: new Date().toISOString() });
  await AsyncStorage.setItem(DEAD_KEY, JSON.stringify(arr));
}

async function sendOneToServer(item) {
  const res = await fetch(LOCATIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`status:${res.status}`);
  return res;
}

async function sendBatchToServer(batch) {
  const res = await fetch(BATCH_LOCATIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`batch status:${res.status}`);
  return res;
}

/* =========================
   COMPONENT
   ========================= */
export default function TrackingScreenOptimized() {
  const params = useLocalSearchParams();
  const { userId, shtabId, shtabName, userName } = params;
  const [tracking, setTracking] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [status, setStatus] = useState("Idle");
  const queueRef = useRef([]);
  const watcherRef = useRef(null);
  const persistTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const isFlushingRef = useRef(false);
  const mountedRef = useRef(true);

  // Check if background tracking is already running on mount
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const existing = await loadStoredQueue();
        queueRef.current = Array.isArray(existing) ? existing : [];
        setStatus((s) => `${s} | queued:${queueRef.current.length}`);

        // Check if background task is already running
        const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isTaskRegistered) {
          setBackgroundTracking(true);
          setStatus("Background tracking active");
        }
      } catch (_e) {
        console.warn("Load queue error", _e);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // Persist queue periodically
  useEffect(() => {
    persistTimerRef.current = setInterval(async () => {
      try {
        await saveStoredQueue(queueRef.current);
      } catch (_e) {
        // persist error ignored
      }
    }, PERSIST_INTERVAL_MS);
    return () => { clearInterval(persistTimerRef.current); };
  }, []);

  // Non-blocking enqueue
  const enqueue = useCallback(async (item) => {
    const clientId = item.clientId || generateUUID();
    const obj = { clientId, ...item };
    queueRef.current.push(obj);

    if (queueRef.current.length > MAX_QUEUE) {
      queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    }

    setStatus(`Queued:${queueRef.current.length}`);
  }, []);

  // Core flush function
  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;
    try {
      const net = await Network.getNetworkStateAsync();
      if (!(net.isConnected && net.isInternetReachable)) return;
      if (!queueRef.current.length) return;

      while (queueRef.current.length) {
        const batch = queueRef.current.slice(0, BATCH_SIZE);
        try {
          await sendBatchToServer(batch);
        } catch (_e) {
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            let ok = false;
            for (let attempt = 1; attempt <= MAX_BATCH_RETRY; attempt++) {
              try {
                await sendOneToServer(item);
                ok = true;
                break;
              } catch (_err) {
                const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
                await new Promise((r) => setTimeout(r, backoff));
              }
            }
            if (!ok) {
              await appendDead(item, { reason: "send_failed" });
            }
          }
        } finally {
          queueRef.current.splice(0, batch.length);
          await saveStoredQueue(queueRef.current);
          setStatus(`Queued:${queueRef.current.length}`);
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  // Network listener: flush when online
  useEffect(() => {
    const listener = Network.addNetworkStateListener(async (state) => {
      if (!mountedRef.current) return;
      if (state.isConnected && state.isInternetReachable) {
        flushQueue().catch(() => {});
      }
    });

    flushTimerRef.current = setInterval(() => {
      flushQueue().catch(() => {});
    }, FLUSH_INTERVAL_MS);

    return () => {
      listener && listener.remove && listener.remove();
      clearInterval(flushTimerRef.current);
    };
  }, [flushQueue]);

  // Non-blocking send: push to queue and return immediately
  const enqueueLocation = useCallback(async (latitude, longitude, timestamp, extra = {}) => {
    const item = {
      userId,
      shtabId,
      latitude,
      longitude,
      timestamp: timestamp || new Date().toISOString(),
      ...extra,
    };

    const net = await Network.getNetworkStateAsync();
    if (net.isConnected && net.isInternetReachable && queueRef.current.length < 5) {
      sendOneToServer(item)
        .then(() => {})
        .catch(async () => {
          await enqueue(item);
        });
    } else {
      await enqueue(item);
    }
  }, [enqueue, userId, shtabId]);

  // Start foreground tracking
  const startTracking = useCallback(async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      Alert.alert("Permission required", "Location permission is required to track.");
      return;
    }

    setTracking(true);
    setStatus("Foreground tracking started");

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4000,
        distanceInterval: 3,
      },
      (loc) => {
        enqueueLocation(loc.coords.latitude, loc.coords.longitude, loc.timestamp);
        setStatus(`Queued:${queueRef.current.length}`);
      }
    );
    watcherRef.current = sub;
  }, [enqueueLocation]);

  // Stop foreground tracking
  const stopTracking = useCallback(async () => {
    setTracking(false);
    setStatus("Stopping...");
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }

    await saveStoredQueue(queueRef.current);
    await flushQueue().catch(() => {});
    setStatus(`Stopped | queued:${queueRef.current.length}`);
  }, [flushQueue]);

  // Start background tracking
  const startBackgroundTracking = useCallback(async () => {
    try {
      // Request foreground permission first
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") {
        Alert.alert("Permission required", "Location permission is required.");
        return;
      }

      // Request background permission (Android 10+)
      if (Platform.OS === 'android' && Platform.Version >= 29) {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== "granted") {
          Alert.alert(
            "Background Permission Required",
            "Please allow 'All the time' location access for background tracking."
          );
          return;
        }
      }

      // Store tracking metadata
      await AsyncStorage.setItem('tracking_metadata', JSON.stringify({
        userId,
        shtabId,
        shtabName,
        userName,
      }));

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000, // 5 seconds
        distanceInterval: 10, // 10 meters
        foregroundService: {
          notificationTitle: "Geo Tracker Active",
          notificationBody: `Tracking for ${shtabName}`,
          notificationColor: "#007AFF",
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      setBackgroundTracking(true);
      setStatus("Background tracking started");
      Alert.alert("Success", "Background tracking is now active. The app will track your location even when closed.");
    } catch (error) {
      console.error("Error starting background tracking:", error);
      Alert.alert("Error", `Failed to start background tracking: ${error.message}`);
    }
  }, [userId, shtabId, shtabName, userName]);

  // Stop background tracking
  const stopBackgroundTracking = useCallback(async () => {
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }

      await AsyncStorage.removeItem('tracking_metadata');
      setBackgroundTracking(false);
      setStatus("Background tracking stopped");
      Alert.alert("Success", "Background tracking has been stopped.");
    } catch (error) {
      console.error("Error stopping background tracking:", error);
      Alert.alert("Error", `Failed to stop background tracking: ${error.message}`);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watcherRef.current) watcherRef.current.remove();
      clearInterval(persistTimerRef.current);
      clearInterval(flushTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tracking (with Background)</Text>

      <Text style={styles.paramText}>Shtab: {shtabName || "—"} ({shtabId || "—"})</Text>
      <Text style={styles.paramText}>User: {userName || "—"} ({userId || "—"})</Text>

      <Text style={styles.text}>{status}</Text>
      <Text style={styles.note}>Local queue: {queueRef.current.length}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Foreground Tracking</Text>
        {!tracking ? (
          <Button title="Start Foreground Tracking" onPress={startTracking} />
        ) : (
          <Button title="Stop Foreground Tracking" onPress={stopTracking} color="red" />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Tracking</Text>
        <Text style={styles.helperText}>
          Tracks location even when app is closed or in background
        </Text>
        {!backgroundTracking ? (
          <Button
            title="Start Background Tracking"
            onPress={startBackgroundTracking}
            color="#28a745"
          />
        ) : (
          <Button
            title="Stop Background Tracking"
            onPress={stopBackgroundTracking}
            color="red"
          />
        )}
      </View>

      <View style={{ height: 12 }} />

      <Button title="Flush Queue Now" onPress={() => flushQueue().catch(() => {})} />
      <View style={{ height: 6 }} />
      <Button
        title="Clear Dead Queue"
        onPress={async () => {
          await AsyncStorage.removeItem(DEAD_KEY);
          Alert.alert("Success", "Dead queue cleared");
        }}
      />
    </View>
  );
}

/* =========================
   STYLES
   ========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: "#0b0b0b",
    justifyContent: "center"
  },
  title: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
    marginBottom: 6
  },
  paramText: {
    color: "#6366f1",
    marginBottom: 4,
    fontSize: 14
  },
  text: {
    color: "#ddd",
    marginBottom: 8
  },
  note: {
    color: "#9ca3af",
    marginBottom: 20
  },
  section: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 12,
  },
});
