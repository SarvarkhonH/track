import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ASSIGN_TO_SHTAB, SHTABS } from "../../../constants/api";

export default function AssignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId;

  const [shtabs, setShtabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShtab, setSelectedShtab] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchShtabs = async () => {
      try {
        setLoading(true);
        const res = await fetch(SHTABS);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setShtabs(list);
        // If a shtabId was passed via params (e.g. from create flow), preselect it
        const pre = params.shtabId;
        if (pre) {
          const found = list.find((s) => String(s._id) === String(pre));
          if (found) setSelectedShtab(pre);
        }
      } catch (e) {
        console.error("Failed to fetch shtabs", e);
        Alert.alert("Xatolik", "Shtablar yuklanmadi");
      } finally {
        setLoading(false);
      }
    };
    fetchShtabs();
  }, [params.shtabId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shtabs;
    return shtabs.filter((s) => s.name?.toLowerCase().includes(q));
  }, [shtabs, query]);

  const roles = ["Rahbar", "Yordamchi", "A'zo"];

  const onConfirm = async () => {
    if (!userId) return Alert.alert("Xatolik", "Foydalanuvchi belgilanmagan.");
    if (!selectedShtab) return Alert.alert("Xatolik", "Shtab tanlanmagan.");
    if (!selectedRole) return Alert.alert("Xatolik", "Rol tanlanmagan.");

    try {
      setSubmitting(true);
      const res = await fetch(ASSIGN_TO_SHTAB(selectedShtab), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: selectedRole }),
      });
      if (!res.ok) throw new Error("Assign failed");
      Alert.alert("Muvaffaqiyat", "Xodim shtabga tayinlandi", [
        { text: "OK", onPress: () => router.replace("/(app)/employees") },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Xatolik", "Tayinlashda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shtabga tayinlash</Text>

      <Text style={styles.subtitle}>Foydalanuvchi: <Text style={{ fontWeight: '700' }}>{userId ?? '—'}</Text></Text>

      <TextInput
        style={styles.search}
        placeholder="Shtab nomi bo'yicha qidirish"
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
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.item, selectedShtab === item._id && styles.selectedItem]} onPress={() => setSelectedShtab(item._id)}>
              <Text style={styles.itemText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Shtablar topilmadi</Text>}
        />
      )}

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Rol tanlash</Text>
      <View style={styles.rolesRow}>
        {roles.map((r) => (
          <TouchableOpacity key={r} style={[styles.roleButton, selectedRole === r && styles.roleButtonSelected]} onPress={() => setSelectedRole(r)}>
            <Text style={[styles.roleText, selectedRole === r && { fontWeight: '700' }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.button, submitting && { opacity: 0.7 }]} disabled={submitting} onPress={onConfirm}>
        <Text style={styles.buttonText}>{submitting ? 'Tayinlanmoqda...' : 'Tayinlash'}</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 8,
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
  selectedItem: { backgroundColor: '#003f7f' },
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
  sectionTitle: {
    color: '#fff',
    marginTop: 6,
    marginBottom: 6,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  roleButtonSelected: {
    backgroundColor: '#0055cc',
  },
  roleText: {
    color: '#fff',
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
