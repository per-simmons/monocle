import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, appendFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';

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

export class SessionManager {
  private id: string;
  private dir: string;
  private meta: SessionMeta;
  private actionCount = 0;

  private constructor(id: string, dir: string, meta: SessionMeta) {
    this.id = id;
    this.dir = dir;
    this.meta = meta;
  }

  static async create(deviceName: string, deviceUdid: string): Promise<SessionManager> {
    const id = randomUUID().slice(0, 8);
    const dir = join(config.sessionsDir, id);
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, 'screenshots'), { recursive: true });

    const meta: SessionMeta = {
      id,
      startedAt: new Date().toISOString(),
      endedAt: null,
      deviceName,
      deviceUdid,
      actionCount: 0,
    };

    await writeFile(join(dir, 'session.json'), JSON.stringify(meta, null, 2));
    await writeFile(join(dir, 'actions.jsonl'), '');

    return new SessionManager(id, dir, meta);
  }

  getId(): string {
    return this.id;
  }

  getDir(): string {
    return this.dir;
  }

  /**
   * Log a tool call action to the session.
   */
  async logAction(
    tool: string,
    params: Record<string, unknown>,
    result: Record<string, unknown>
  ): Promise<void> {
    this.actionCount++;
    const entry: ActionEntry = {
      timestamp: new Date().toISOString(),
      tool,
      params,
      result,
    };

    await appendFile(
      join(this.dir, 'actions.jsonl'),
      JSON.stringify(entry) + '\n'
    );
  }

  /**
   * Save a screenshot to the session.
   */
  async saveScreenshot(buffer: Buffer, label?: string): Promise<string> {
    const name = `${String(this.actionCount).padStart(3, '0')}${label ? `-${label}` : ''}.jpg`;
    const path = join(this.dir, 'screenshots', name);
    await writeFile(path, buffer);
    return path;
  }

  /**
   * End the session and write final metadata.
   */
  async end(): Promise<SessionMeta> {
    this.meta.endedAt = new Date().toISOString();
    this.meta.actionCount = this.actionCount;
    await writeFile(
      join(this.dir, 'session.json'),
      JSON.stringify(this.meta, null, 2)
    );
    return this.meta;
  }

  /**
   * List all sessions.
   */
  static async listSessions(): Promise<SessionMeta[]> {
    try {
      const dirs = await readdir(config.sessionsDir);
      const sessions: SessionMeta[] = [];
      for (const dir of dirs) {
        try {
          const metaPath = join(config.sessionsDir, dir, 'session.json');
          const raw = await readFile(metaPath, 'utf-8');
          sessions.push(JSON.parse(raw) as SessionMeta);
        } catch {
          // skip invalid sessions
        }
      }
      return sessions.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } catch {
      return [];
    }
  }
}
