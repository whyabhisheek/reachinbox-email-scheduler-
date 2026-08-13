import { apiRequest } from "./api";
import type { AuthUser } from "../types/auth";

export async function getCurrentUser() {
  return apiRequest<{ user: AuthUser }>("/api/auth/me");
}

export async function logout() {
  return apiRequest<void>("/api/auth/logout", {
    method: "POST"
  });
}

export async function loginWithPassword(email: string, password: string) {
  return apiRequest<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}
