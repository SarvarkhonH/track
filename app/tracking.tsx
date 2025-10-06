import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TrackingScreen() {
  const { userId, shtabId } = useLocalSearchParams<{ userId: string; shtabId: string }>();
  const [watcher, setWatcher] = useState<Location.LocationSubscription | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);

  // 🔹 Save location offline
  const saveLocationOffline = async (body: any) => {
    const existing = await AsyncStorage.getItem("offline_locations");
    const locations = existing ? JSON.parse(existing) : [];
    locations.push(body);
    await AsyncStorage.setItem("offline_locations", JSON.stringify(locations));
    setOfflineCount(locations.length);
  };

  // 🔹 Send offline in bulk
  const sendSavedLocationsBulk = async () => {
    const stored = await AsyncStorage.getItem("offline_locations");
    const locations = stored ? JSON.parse(stored) : [];
    if (locations.length === 0) return;
    try {
      await fetch("http://192.168.100.152:3000/api/v1/locations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locations),
      });
      await AsyncStorage.removeItem("offline_locations");
      setOfflineCount(0);
    } catch (err) {
      console.error("❌ Bulk send error:", err);
    }
  };

  // 🔹 Send single location
  const sendLocationOnline = async (loc: any) => {
    try {
      await fetch("http://192.168.100.152:3000/api/v1/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      console.log("📡 Sent online:", loc);
    } catch {
      await saveLocationOffline(loc);
    }
  };

  // 🔹 Toggle tracking
  const toggleTracking = async () => {
    if (!watcher) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return alert("Permission denied");

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 0,
        },
        async (loc) => {
          const online = await Network.getNetworkStateAsync();
          const body = {
            userId,
            shtabId,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: new Date().toISOString(),
          };
          if (online.isConnected && online.isInternetReachable) {
            await sendSavedLocationsBulk();
            await sendLocationOnline(body);
            setIsOnline(true);
          } else {
            await saveLocationOffline(body);
            setIsOnline(false);
          }
        }
      );

      setWatcher(sub);
    } else {
      watcher.remove();
      setWatcher(null);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title={watcher ? "Stop Tracking" : "Start Tracking"}
        onPress={toggleTracking}
      />
      <Text style={styles.text}>{isOnline ? "🟢 Online" : "🔴 Offline"}</Text>
      <Text style={styles.text}>Offline saved: {offlineCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  text: { color: "white", fontSize: 18, marginTop: 10 },
});
