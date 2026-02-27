const API_BASE = '/api';

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface Device {
  udid: string;
  name: string;
  state: string;
  runtime: string;
  deviceTypeIdentifier: string;
  isAvailable: boolean;
}

export interface SessionMeta {
  id: string;
  startedAt: string;
  endedAt: string | null;
  deviceName: string;
  deviceUdid: string;
  actionCount: number;
}

export interface ActionEntry {
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface ElementNode {
  ref: string;
  type: string;
  label: string;
  value: string;
  accessibilityId: string;
  frame: { x: number; y: number; width: number; height: number };
  enabled: boolean;
}

export const api = {
  getDevices: () => fetchJSON<{ devices: Device[] }>('/devices'),
  getBootedDevice: () => fetchJSON<{ device: Device }>('/devices/booted'),
  getSessions: () => fetchJSON<{ sessions: SessionMeta[] }>('/sessions'),
  getSession: (id: string) => fetchJSON<SessionMeta>(`/sessions/${id}`),
  getActions: (id: string) => fetchJSON<{ actions: ActionEntry[] }>(`/sessions/${id}/actions`),
  getElements: () => fetchJSON<{ elements: ElementNode[] }>('/elements'),
  getStreamStatus: () => fetchJSON<{ clients: number }>('/stream/status'),
  getHealth: () => fetchJSON<{ status: string; version: string }>('/health'),
  startStream: () => fetch(`${API_BASE}/stream/start`, { method: 'POST' }).then((r) => r.json()),
  stopStream: () => fetch(`${API_BASE}/stream/stop`, { method: 'POST' }).then((r) => r.json()),
  screenshotUrl: `${API_BASE}/screenshot`,
};
