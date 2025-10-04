import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Button } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

export default function TrackingScreen() {
  const { userId, shtabId } = useLocalSearchParams<{ userId: string; shtabId: string }>();
  const [sending, setSending] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [tracking, setTracking] = useState(false);

  // 🔹 Save location offline
  const saveLocationOffline = async (body: any) => {
    try {
      const existing = await AsyncStorage.getItem("offline_locations");
      const locations = existing ? JSON.parse(existing) : [];
      locations.push(body);
      await AsyncStorage.setItem("offline_locations", JSON.stringify(locations));
      setOfflineCount(locations.length);
    } catch (err) {
      console.error("❌ Error saving offline location:", err);
    }
  };

  // 🔹 Send offline locations in bulk
  const sendSavedLocationsBulk = async () => {
    try {
      const stored = await AsyncStorage.getItem("offline_locations");
      const locations = stored ? JSON.parse(stored) : [];
      if (locations.length === 0) return;

      await fetch("http://192.168.100.152:3000/api/v1/locations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locations),
      });

      console.log(`✅ Bulk sent ${locations.length} locations`);
      await AsyncStorage.removeItem("offline_locations");
      setOfflineCount(0);
    } catch (err) {
      console.error("❌ Error sending bulk locations:", err);
    }
  };

  // 🔹 Check internet
  const checkInternetStatus = async () => {
    const state = await Network.getNetworkStateAsync();
    setIsOnline(state.isConnected && state.isInternetReachable);
    return state.isConnected && state.isInternetReachable;
  };

  // 🔹 Send single location
  const sendLocationOnline = async (loc: any) => {
    try {
      await fetch("http://192.168.100.152:3000/api/v1/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      console.log("📡 Location sent online:", loc);
    } catch (err) {
      console.error("❌ Error sending online location:", err);
      await saveLocationOffline(loc);
    }
  };

  // 🔹 Task Manager: background location
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) return console.error(error);
    if (data) {
      const { locations } = data as any;
      const loc = locations[locations.length - 1]; // oxirgi location
      const body = {
        userId,
        shtabId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: new Date().toISOString(),
      };
      const online = await checkInternetStatus();
      if (online) {
        await sendSavedLocationsBulk();
        await sendLocationOnline(body);
      } else {
        await saveLocationOffline(body);
      }
    }
  });

  // 🔹 Start/Stop tracking
  const toggleTracking = async () => {
    if (!tracking) {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") return alert("Foreground location denied");

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== "granted") return alert("Background location denied");

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Tracking Active",
          notificationBody: "Your location is being tracked in background",
        },
      });

      setTracking(true);
    } else {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setTracking(false);
    }
  };

  // 🔹 Periodic internet check for UI update
  useEffect(() => {
    const interval = setInterval(checkInternetStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Button
        title={tracking ? "Stop Tracking" : "Start Tracking"}
        onPress={toggleTracking}
      />
      <Text style={styles.text}>
        {isOnline ? "🟢 Online" : "🔴 Offline"}
      </Text>
      <Text style={styles.text}>
        Offline stored locations: {offlineCount}
      </Text>
      {sending && (
        <View style={{ marginTop: 15 }}>
          <ActivityIndicator size="large" color="yellow" />
          <Text style={styles.text}>📡 Sending Location...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  text: { color: "white", fontSize: 18, marginTop: 15 },
});
