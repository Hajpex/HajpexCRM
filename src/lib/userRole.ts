// Tillfällig rollhantering tills riktig auth är på plats (Lovable Cloud).
// Sätt rollen via localStorage: localStorage.setItem('userRole', 'kontorschef')
import { useEffect, useState } from "react";

export type UserRole = "kontorschef" | "maklare";
const KEY = "userRole";

export function getUserRole(): UserRole {
  if (typeof window === "undefined") return "maklare";
  const v = window.localStorage.getItem(KEY);
  return v === "kontorschef" ? "kontorschef" : "maklare";
}

export function setUserRole(role: UserRole) {
  window.localStorage.setItem(KEY, role);
  window.dispatchEvent(new Event("userrole:change"));
}

export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(() => getUserRole());
  useEffect(() => {
    const update = () => setRole(getUserRole());
    window.addEventListener("userrole:change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("userrole:change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return role;
}

export function isKontorschef(role: UserRole) {
  return role === "kontorschef";
}
