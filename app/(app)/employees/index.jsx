import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { USERS } from "../../../constants/api";

export default function EmployeesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await fetch(USERS);
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to fetch employees", e);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name?.toLowerCase().includes(q));
  }, [employees, query]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xodimlar royxati</Text>

      <TextInput
        style={styles.search}
        placeholder="Xodim nomi (izlash)"
        placeholderTextColor="#888"
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loaderText}>Yuklanmoqda...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.item} onPress={() => router.push({ pathname: '/(app)/employees/assign', params: { userId: item._id } })}>
              <Text style={styles.itemText}>{index + 1}. {item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Hech narsa topilmadi</Text>}
        />
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push("/(app)/employees/create")}
      >
        <Text style={styles.createButtonText}>Xodim yaratish</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    padding: 16,
    paddingTop: 40,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  search: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 12,
  },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  itemText: {
    color: "#fff",
    fontSize: 16,
  },
  empty: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loaderText: {
    color: "#fff",
    marginLeft: 10,
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
