/** A request the server refused, with the status and body so callers can react to the reason. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  const token = localStorage.getItem("auth_token");
  if (token) {
    (opts.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const text = await r.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error: ${r.status} ${r.statusText}`);
  }
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith("/api/auth/login")) {
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    throw new ApiError((data as { error?: string }).error || "Request failed", r.status, data);
  }
  return data as T;
}
