import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, User } from "@/src/lib/api";
import { router } from "expo-router";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    role: "student" | "teacher" | "parent"
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>("auth_token", "" as any);
      if (token) {
        try {
          const me = await api.get<User>("/auth/me");
          setUser(me);
        } catch {
          await storage.secureRemove("auth_token");
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    await storage.secureSet("auth_token", res.token);
    setUser(res.user);
    router.replace("/(tabs)/home");
  }, []);


  const register = useCallback(
  async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    role: "student" | "teacher" | "parent"
  ) => {

    const res = await api.post<{ token: string; user: User }>("/auth/register", {
      name,
      email,
      password,
      confirm_password: confirmPassword,
      role,
    });

    await storage.secureSet("auth_token", res.token);
    setUser(res.user);

    router.replace("/(tabs)/home");
  },
  []
);

  const logout = useCallback(async () => {
    await storage.secureRemove("auth_token");
    setUser(null);
    router.replace("/login");
  }, []);

  return (
   <AuthContext.Provider
  value={{user, loading, login, register, logout, }} >
  {children}
   </AuthContext.Provider>
  );
}




export const useAuth = () => useContext(AuthContext);
