const KEY = "hajpex.auth.v1";

export type User = {
  name: string;
  email: string;
  initials: string;
  role: string;
};

const USERS = [
  { email: "max@test.se", password: "123123", name: "Max Stendahl", initials: "MS", role: "Mäklare" },
];

export function getAuth(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch { return null; }
}

export function login(email: string, password: string): User | null {
  const match = USERS.find((u) => u.email === email && u.password === password);
  if (!match) return null;
  const user: User = { name: match.name, email: match.email, initials: match.initials, role: match.role };
  window.localStorage.setItem(KEY, JSON.stringify({ user }));
  return user;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
