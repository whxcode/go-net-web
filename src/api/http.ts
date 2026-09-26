// src/api/http.ts
import { endSession, isExplicitLogoutSignal } from "../utils/session";
import { useStore } from "../store";

let refreshInFlight: Promise<string | null> | null = null;

function getBase(): string {
  return "";
}

// 你的后端响应格式
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers["token"] = token;
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(`${getBase()}${path}`, { ...opts, headers });

  // 401 刷新 token
  if (res.status === 401 && path !== "/api/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["token"] = refreshed;
      res = await fetch(`${getBase()}${path}`, { ...opts, headers });
    }
  }

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {} as T;
  }

  // 你的后端格式: { code, message, data }
  // code === 200 成功，否则失败
  if (data.code !== undefined) {
    // code === 200 才是成功
    if (data.code !== 200) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    // 直接返回 data 字段内容
    return data.data as T;
  }

  // 兼容其他格式
  if (isExplicitLogoutSignal(data, res.headers)) {
    endSession(
      String(data.code ?? data.type ?? data.action ?? "session_revoked"),
    );
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

// 刷新 token
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    endSession("reauth_required");
    return null;
  }
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${getBase()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.data?.token) {
        if (isExplicitLogoutSignal(data, res.headers))
          endSession("session_revoked");
        return null;
      }
      useStore.getState().setToken(data.data.token, data.data.refresh_token);
      return data.data.token as string;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// 升级 session
let upgradeInFlight: Promise<void> | null = null;
export function ensureRefreshToken(): Promise<void> {
  if (localStorage.getItem("refreshToken") || !localStorage.getItem("token"))
    return Promise.resolve();
  if (upgradeInFlight) return upgradeInFlight;

  upgradeInFlight = (async () => {
    try {
      const res = await fetch(`${getBase()}/api/auth/upgrade-session`, {
        method: "POST",
        headers: {
          token: `${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.data?.refresh_token) {
        localStorage.setItem("refreshToken", data.data.refresh_token);
      } else if (res.status === 401) {
        endSession("reauth_required");
      }
    } catch {
      // offline: preserve account and retry on the next reconnect
    } finally {
      upgradeInFlight = null;
    }
  })();
  return upgradeInFlight;
}

// Convenience methods
export const get = <T = any>(path: string) => api<T>(path);

export const post = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const put = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const del = <T = any>(path: string, body?: any) =>
  api<T>(path, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });

/** 上传接口返回的单个文件信息。后端当前只回文件 hash 字符串，这里保留对象写法做兼容 */
type UploadedFileInfo = { hash: string; filename?: string; size?: number }

export async function uploadFile(
  file: File,
): Promise<{ hash: string; url: string; filename: string; size: number }> {
  const form = new FormData();
  form.append("files", file);
  // 后端文件上传：POST /api/file/upload
  // 返回 data 是文件 hash 列表（string[]）；这里同时兼容 [{hash,filename,size}] 的对象数组
  const res = await post<Array<string | UploadedFileInfo>>(
    "/api/file/upload",
    form,
  );
  const first = Array.isArray(res) ? res[0] : null;
  const info: UploadedFileInfo | null =
    typeof first === "string" ? { hash: first } : first || null;
  const hash = info?.hash || "";
  return {
    hash,
    url: hash ? `/api/file/preview/${hash}` : "",
    filename: info?.filename || file.name,
    size: info?.size || file.size,
  };
}

export function uploadFileWithProgress(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ hash: string; url: string; filename: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("files", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.code === 200) {
          const first = Array.isArray(data.data) ? data.data[0] : null;
          // data.data: 文件 hash 列表（string[]），兼容 [{hash,filename,size}]
          const info = typeof first === "string" ? { hash: first } : first || null;
          const hash = info?.hash || "";
          resolve({
            hash,
            url: hash ? `/api/file/preview/${hash}` : "",
            filename: info?.filename || file.name,
            size: info?.size || file.size,
          });
        } else {
          reject(new Error(data.message || `HTTP ${xhr.status}`));
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    const token = localStorage.getItem("token");
    xhr.open("POST", `${getBase()}/api/file/upload`);
    if (token) xhr.setRequestHeader("token", token);
    xhr.send(form);
  });
}

export function normalizeFileUrl(url: string | null | undefined): string {
  if (!url) return "";
  const base = getBase();
  if (base && url.startsWith("/")) {
    return `${base}${url}`;
  }
  return url;
}
