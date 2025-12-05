// TrackingScreen.optimized.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { BATCH_LOCATIONS, LOCATIONS } from "../../constants/api";

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
const PERSIST_INTERVAL_MS = 5000;     // persist in-memory queue to storage every 5s
const FLUSH_INTERVAL_MS = 10_000;     // try flushing every 10s (if online)
const BATCH_SIZE = 25;                // send up to 25 items per batch
const MAX_QUEUE = 2000;               // cap to avoid uncontrolled growth
const MAX_BATCH_RETRY = 4;            // per batch
const BASE_BACKOFF_MS = 1000;

/* =========================
   UTILS
   ========================= */
// safe parse
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

// send one with fetch wrapper - throws on non-ok
async function sendOneToServer(item) {
  const res = await fetch(LOCATIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`status:${res.status}`);
  return res;
}
// send batch if backend supports it; must return ok boolean
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
  const [status, setStatus] = useState("Idle");
  const queueRef = useRef([]);           // in-memory queue of items
  const watcherRef = useRef(null);
  const persistTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const isFlushingRef = useRef(false);
  const mountedRef = useRef(true);

  // load persisted queue on mount
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const existing = await loadStoredQueue();
        queueRef.current = Array.isArray(existing) ? existing : [];
        setStatus((s) => `${s} | queued:${queueRef.current.length}`);
      } catch (_e) {
        console.warn("Load queue error", _e);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // persist queue periodically
  useEffect(() => {
    persistTimerRef.current = setInterval(async () => {
      try {
        // Persist only if changed length (simple heuristic)
        await saveStoredQueue(queueRef.current);
      } catch (_e) {
        // persist error ignored
      }
    }, PERSIST_INTERVAL_MS);
    return () => { clearInterval(persistTimerRef.current); };
  }, []);

  // non-blocking enqueue
  const enqueue = useCallback(async (item) => {
    // assign simple client id for idempotency/dedup
    const clientId = item.clientId || generateUUID();
    const obj = { clientId, ...item };
    queueRef.current.push(obj);
    // cap queue size
    if (queueRef.current.length > MAX_QUEUE) {
      queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    }
    // update UI status
    setStatus((s) => `Queued:${queueRef.current.length}`);
    // persist eventually (periodic timer will persist)
  }, []);

  // core flush function (process batches with retries) — DEFINE BEFORE EFFECTS THAT USE IT
  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;
    try {
      const net = await Network.getNetworkStateAsync();
      if (!(net.isConnected && net.isInternetReachable)) return;
      if (!queueRef.current.length) return;

      // create a local copy to work with to avoid concurrency issues
      while (queueRef.current.length) {
        const batch = queueRef.current.slice(0, BATCH_SIZE);
        // try batch send first (fast)
        try {
          await sendBatchToServer(batch);
        } catch (_e) {
          // batch failed — fallback to per-item send with retry/backoff
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            let ok = false;
            for (let attempt = 1; attempt <= MAX_BATCH_RETRY; attempt++) {
              try {
                await sendOneToServer(item);
                ok = true;
                break;
              } catch (_err) {
                // exponential backoff (await)
                const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
                await new Promise((r) => setTimeout(r, backoff));
              }
            }
            if (!ok) {
              // move to dead letter so it doesn't block the queue forever
              await appendDead(item, { reason: "send_failed" });
            }
          }
        } finally {
          // remove processed length regardless of success/failure to avoid infinite loop
          queueRef.current.splice(0, batch.length);
          // persist new queue state
          await saveStoredQueue(queueRef.current);
          setStatus(`Queued:${queueRef.current.length}`);
        }
        // slight delay between batches to prevent hammering
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  // network listener: flush when online
  useEffect(() => {
    const listener = Network.addNetworkStateListener(async (state) => {
      if (!mountedRef.current) return;
      if (state.isConnected && state.isInternetReachable) {
        // immediate flush attempt
        flushQueue().catch(() => { /* retry flush on reconnect */ });
      }
    });
    // also periodic flush attempt
    flushTimerRef.current = setInterval(() => {
      flushQueue().catch(() => {});
    }, FLUSH_INTERVAL_MS);

    return () => {
      listener && listener.remove && listener.remove();
      clearInterval(flushTimerRef.current);
    };
  }, [flushQueue]);

  // non-blocking send: push to queue and return immediately
  const enqueueLocation = useCallback(async (latitude, longitude, timestamp, extra = {}) => {
    const item = {
      userId,
      shtabId,
      latitude,
      longitude,
      timestamp: timestamp || new Date().toISOString(),
      ...extra,
    };
    // if online and small queue, try immediate send (fire-and-forget)
    const net = await Network.getNetworkStateAsync();
    if (net.isConnected && net.isInternetReachable && queueRef.current.length < 5) {
      // try optimistic send but do not await in caller
      sendOneToServer(item)
        .then(() => { /* success */ })
        .catch(async () => {
          // fallback to enqueue if send fails
          await enqueue(item);
        });
    } else {
      await enqueue(item);
    }
  }, [enqueue, userId, shtabId]);

  // start/stop tracking
  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Location permission is required to track.");
      return;
    }
    setTracking(true);
    setStatus("Tracking started");

    // watch position; callback must be non-blocking
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4000,
        distanceInterval: 3,
      },
      (loc) => {
        // non-blocking: enqueue quickly
        enqueueLocation(loc.coords.latitude, loc.coords.longitude, loc.timestamp);
        // optional UI update:
        setStatus((s) => `Queued:${queueRef.current.length}`);
      }
    );
    watcherRef.current = sub;
  }, [enqueueLocation]);

  const stopTracking = useCallback(async () => {
    setTracking(false);
    setStatus("Stopping...");
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }
    // final persist and try flush once
    await saveStoredQueue(queueRef.current);
    await flushQueue().catch(() => {});
    setStatus(`Stopped | queued:${queueRef.current.length}`);
  }, [flushQueue]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (watcherRef.current) watcherRef.current.remove();
      clearInterval(persistTimerRef.current);
      clearInterval(flushTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tracking (Optimized)</Text>
      
      {/* Display params */}
      <Text style={styles.paramText}>Shtab: {shtabName || "—"} ({shtabId || "—"})</Text>
      <Text style={styles.paramText}>User: {userName || "—"} ({userId || "—"})</Text>
      
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.note}>Local queue: {queueRef.current.length}</Text>

      {!tracking ? (
        <Button title="Start Tracking" onPress={startTracking} />
      ) : (
        <Button title="Stop Tracking" onPress={stopTracking} color="red" />
      )}

      <View style={{ height: 12 }} />

      <Button title="Flush Now" onPress={() => flushQueue().catch(() => {})} />
      <View style={{ height: 6 }} />
      <Button title="Clear Dead" onPress={async () => { await AsyncStorage.removeItem(DEAD_KEY); Alert.alert("Dead queue cleared"); }} />
    </View>
  );
}

/* =========================
   STYLES
   ========================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: "#0b0b0b", justifyContent: "center" },
  title: { fontSize: 20, color: "#fff", fontWeight: "700", marginBottom: 6 },
  paramText: { color: "#6366f1", marginBottom: 4, fontSize: 14 },
  text: { color: "#ddd", marginBottom: 8 },
  note: { color: "#9ca3af", marginBottom: 12 }
});
