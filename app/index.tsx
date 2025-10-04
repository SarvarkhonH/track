import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const [data, setData] = useState<any[]>([]);
  const [selectedShtab, setSelectedShtab] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("http://192.168.100.152:3000/api/v1/shtabs")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err));
  }, []);

  const handleShtabPress = (id: string) => {
    setSelectedShtab(selectedShtab === id ? null : id);
  };

  const handleUserPress = (shtabId: string, userId: string) => {
    router.push({
      pathname: "/tracking",
      params: { shtabId, userId },
    });
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => handleShtabPress(item._id)}>
        <Text style={styles.shtab}>{item.shtabName}</Text>
      </TouchableOpacity>

      {selectedShtab === item._id && (
        <View style={{ marginLeft: 10, marginTop: 8 }}>
          {item.members.length > 0 ? (
            item.members.map((m: any) => (
              <TouchableOpacity
                key={m._id}
                onPress={() => handleUserPress(item._id, m.user?._id)}
              >
                <Text style={styles.user}>👤 {m.user?.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noMembers}>No members yet</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList 
        data={data} 
        renderItem={renderItem} 
        keyExtractor={(item) => item._id} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#1a1a1aff" },
  card: { marginTop: 30, marginBottom: 15, padding: 10, backgroundColor: "#b2bfc1ff", borderRadius: 8 },
  shtab: { fontSize: 20, fontWeight: "bold" },
  user: { fontSize: 16, color: "gray" },
  noMembers: { fontSize: 14, color: "red" },
});
