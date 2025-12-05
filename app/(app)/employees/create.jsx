import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { USERS } from "../../../constants/api";
import { useAuth } from "../../../hooks/useAuth";

export default function EmployeeCreateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const preselectedShtabId = params.shtabId;
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim() || !role.trim()) {
      return Alert.alert("Xatolik", "Iltimos, barcha maydonlarni to'ldiring.");
    }
    try {
      setSubmitting(true);
      const res = await fetch(USERS, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user?.token}` },
        body: JSON.stringify({ name: name.trim(), role: role.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create user");
      const created = await res.json();
      // If a shtab was provided, forward it so assign screen can pre-select it
      router.replace({ pathname: '/(app)/employees/assign', params: { userId: created._id, shtabId: preselectedShtabId } });
    } catch (e) {
      Alert.alert("Xatolik", "Xodim yaratishda xatolik yuz berdi");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yangi xodim</Text>

      <TextInput
        style={styles.input}
        placeholder="Xodim ismi"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Xodim roli"
        placeholderTextColor="#888"
        value={role}
        onChangeText={setRole}
      />

      <TouchableOpacity style={[styles.button, submitting && { opacity: 0.7 }]} disabled={submitting} onPress={onSubmit}>
        <Text style={styles.buttonText}>{submitting ? "Yaratilmoqda..." : "Yaratish"}</Text>
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
  input: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 12,
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
