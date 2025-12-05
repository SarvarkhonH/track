import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(undefined);

const STORAGE_KEY_TOKEN = "user_auth_token";
const STORAGE_KEY_USER_ID = "user_auth_userId";
const STORAGE_KEY_USER_NAME = "user_auth_name";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const [token, userId, name] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER_ID),
          AsyncStorage.getItem(STORAGE_KEY_USER_NAME),
        ]);

        if (token && userId && name) {
          setUser({ token, userId, name });
        }
      } catch (error) {
        console.error("Failed to load user from AsyncStorage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const signIn = async (token, userId, name) => {
    setIsLoading(true);
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEY_USER_ID, userId),
        AsyncStorage.setItem(STORAGE_KEY_USER_NAME, name),
      ]);

      setUser({ token, userId, name });
    } catch (error) {
      console.error("Sign in failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEY_USER_ID),
        AsyncStorage.removeItem(STORAGE_KEY_USER_NAME),
      ]);

      setUser(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = { user, isLoading, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
