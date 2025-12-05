import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SHTABS } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [shtabs, setShtabs] = useState([]);
  const [selectedShtab, setSelectedShtab] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [showShtabDropdown, setShowShtabDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {    
      setSelectedUser({ _id: user.userId, name: user.name });
    } else {
      setSelectedUser(null);
      router.replace("/(auth)/LoginScreen");
    }
  }, [user, router]);

  const fetchShtabsForUser = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(SHTABS, {
        headers: {
          "Content-Type": "application/json",
          Authorization: user?.token ? `Bearer ${user.token}` : "",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        setShtabs([]);
        setSelectedShtab(null);
        return;
      }

      const filtered = data.filter((shtab) =>
        shtab.members.some((m) => m.user._id === user?.userId)
      );

      // Only load the list of shtabs; require explicit user selection
      setShtabs(filtered);
      setSelectedShtab(null);
    } catch (error) {
      console.error("Error fetching shtabs:", error);
      Alert.alert("Xatolik", "Shtablarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchShtabsForUser();
  }, [user, fetchShtabsForUser]);

  const userRole = selectedShtab?.members.find(
    (member) => member.user._id === selectedUser?._id
  )?.currentRole?.roleName;

  const handleLogout = async () => {
    await signOut();
  };

  const handleShtabSelect = (shtab) => {
    const member = shtab.members.find((m) => m.user._id === selectedUser?._id);

    if (!member) {
      Alert.alert("E'tibor", "Siz ushbu shtab a'zosi emassiz.");
      return;
    }

    setSelectedShtab(shtab);
    setShowShtabDropdown(false);
  };

  const startTracking = () => {
    if (!selectedShtab) {
      return Alert.alert("Xatolik", "Iltimos, shtabni tanlang.");
    }
    if (!selectedUser) {
      return Alert.alert("Xatolik", "Tizimga kirgan foydalanuvchi aniqlanmadi.");
    }

    router.push({
      pathname: "/(app)/tracking",
      params: {
        shtabId: selectedShtab._id,
        userId: selectedUser._id,
        shtabName: selectedShtab.shtabName,
        userName: selectedUser.name,
      },
    });
  };

  const DropdownModal = ({ visible, onClose, children }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownScroll}>{children}</ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Shtablar yuklanmoqda...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Geo Tracker</Text>

          <Text style={{ color: "#ccc", marginTop: 6 }}>
            Login: {selectedUser ? selectedUser.name : "Anonim"}
          </Text>
        </View>
        {user && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Chiqish</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dropdownSection}>
        <Text style={styles.label}>Select Shtab:</Text>
        <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowShtabDropdown(true)}>
          <Text style={styles.dropdownButtonText}>
            {selectedShtab ? selectedShtab.shtabName : "Choose a shtab..."}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {selectedShtab ? (
        <>
          <View style={styles.dropdownSection}>
            <Text style={styles.label}>Foydalanuvchi:</Text>
            <View style={[styles.dropdownButton, { justifyContent: "flex-start" }]}>
              <Text style={styles.dropdownButtonText}>{selectedUser ? selectedUser.name : "—"}</Text>
            </View>
          </View>

          {userRole === "Rahbar" && (
            <TouchableOpacity style={styles.attachButton} onPress={() => router.push({ pathname: '/(app)/employees/create', params: { shtabId: selectedShtab._id } })}>
              <Text style={styles.attachButtonText}>Xodim biriktirish</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.startButton} onPress={startTracking}>
            <Text style={styles.startButtonText}>🚀 Joylashuvni jo’natish</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <DropdownModal visible={showShtabDropdown} onClose={() => setShowShtabDropdown(false)}>
        {shtabs.length === 0 ? (
          <View style={styles.dropdownItem}>
            <Text style={styles.dropdownItemText}>Siz biron-bir shtabga biriktirilmagan ekansiz.</Text>
          </View>
        ) : (
          shtabs.map((shtab) => (
            <TouchableOpacity key={shtab._id} style={styles.dropdownItem} onPress={() => handleShtabSelect(shtab)}>
              <Text style={styles.dropdownItemText}>{shtab.shtabName}</Text>
              <Text style={styles.memberCount}>{shtab.members.length} members</Text>
            </TouchableOpacity>
          ))
        )}
      </DropdownModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#cccccc",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 18,
    color: "#ffffff",
    textAlign: "center",
  },
  dropdownSection: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 10,
  },
  dropdownButton: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#444444",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#ffffff",
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: "#888888",
  },
  startButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 20,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  attachButton: {
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#555555",
  },
  attachButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownContainer: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    maxHeight: 300,
    width: "80%",
    borderWidth: 1,
    borderColor: "#444444",
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444444",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#ffffff",
    flex: 1,
  },
  memberCount: {
    fontSize: 12,
    color: "#888888",
  },
});
