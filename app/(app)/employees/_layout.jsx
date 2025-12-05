import { Stack } from "expo-router";

export default function EmployeesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: "#1a1a1a" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="index" options={{ title: "Xodimlar" }} />
      <Stack.Screen name="create" options={{ title: "Yangi xodim" }} />
    </Stack>
  );
}
