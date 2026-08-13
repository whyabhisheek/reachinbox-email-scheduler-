const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };

  // If body is FormData, let the browser set the Content-Type boundary header.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers,
    ...options
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string; details?: unknown };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Response was not JSON; keep the generic message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getGoogleLoginUrl() {
  return `${apiBaseUrl}/api/auth/google`;
}
