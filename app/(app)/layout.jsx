import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: "#1a1a1a" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
