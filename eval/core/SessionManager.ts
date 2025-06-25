import { promises as fs } from 'fs';
import { join } from 'path';
import { BenchmarkSession, Logger } from './types.js';

export class SessionManager {
  private sessionsDir: string;
  private logger: Logger;
  private sessions: Map<string, BenchmarkSession> = new Map();

  constructor(sessionsDir: string, logger: Logger) {
    this.sessionsDir = sessionsDir;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      await this.loadExistingSessions();
      this.logger.info(`SessionManager initialized with directory: ${this.sessionsDir}`);
    } catch (error) {
      this.logger.error(`Failed to initialize SessionManager`, error as Error);
      throw error;
    }
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const sessionPath = join(this.sessionsDir, file);
          const sessionData = await fs.readFile(sessionPath, 'utf-8');
          const session: BenchmarkSession = JSON.parse(sessionData);
          
          // Convert date strings back to Date objects
          session.startTime = new Date(session.startTime);
          session.lastUpdateTime = new Date(session.lastUpdateTime);
          
          // Convert test case dates
          session.results?.forEach(result => {
            if (result.startTime) result.startTime = new Date(result.startTime);
            if (result.endTime) result.endTime = new Date(result.endTime);
            if (result.llmRequest?.timestamp) {
              result.llmRequest.timestamp = new Date(result.llmRequest.timestamp);
            }
            if (result.llmResponse?.timestamp) {
              result.llmResponse.timestamp = new Date(result.llmResponse.timestamp);
            }
          });

          this.sessions.set(session.id, session);
          this.logger.debug(`Loaded session: ${session.id}`);
        } catch (error) {
          this.logger.warn(`Failed to load session file ${file}:`, error);
        }
      }

      this.logger.info(`Loaded ${this.sessions.size} existing sessions`);
    } catch (error) {
      this.logger.warn(`Failed to load existing sessions:`, error);
    }
  }

  async saveSession(session: BenchmarkSession): Promise<void> {
    try {
      const sessionPath = join(this.sessionsDir, `${session.id}.json`);
      const sessionData = JSON.stringify(session, null, 2);
      await fs.writeFile(sessionPath, sessionData, 'utf-8');
      
      this.sessions.set(session.id, session);
      this.logger.debug(`Saved session: ${session.id}`);
    } catch (error) {
      this.logger.error(`Failed to save session ${session.id}`, error as Error);
      throw error;
    }
  }

  async loadSession(sessionId: string): Promise<BenchmarkSession | null> {
    // First check in-memory cache
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Try to load from disk
    try {
      const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      const session: BenchmarkSession = JSON.parse(sessionData);
      
      // Convert date strings back to Date objects
      session.startTime = new Date(session.startTime);
      session.lastUpdateTime = new Date(session.lastUpdateTime);
      
      // Convert test case dates
      session.results?.forEach(result => {
        if (result.startTime) result.startTime = new Date(result.startTime);
        if (result.endTime) result.endTime = new Date(result.endTime);
        if (result.llmRequest?.timestamp) {
          result.llmRequest.timestamp = new Date(result.llmRequest.timestamp);
        }
        if (result.llmResponse?.timestamp) {
          result.llmResponse.timestamp = new Date(result.llmResponse.timestamp);
        }
      });

      this.sessions.set(session.id, session);
      this.logger.debug(`Loaded session from disk: ${sessionId}`);
      return session;
    } catch (error) {
      this.logger.debug(`Session ${sessionId} not found on disk`);
      return null;
    }
  }


  listSessions(): BenchmarkSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): BenchmarkSession[] {
    return this.listSessions().filter(session => 
      session.status === 'running' || session.status === 'paused'
    );
  }

  getCompletedSessions(): BenchmarkSession[] {
    return this.listSessions().filter(session => 
      session.status === 'completed'
    );
  }

  getFailedSessions(): BenchmarkSession[] {
    return this.listSessions().filter(session => 
      session.status === 'failed'
    );
  }

  async getLatestSession(): Promise<BenchmarkSession | null> {
    const sessions = this.listSessions();
    if (sessions.length === 0) return null;

    return sessions.reduce((latest, current) => 
      current.lastUpdateTime > latest.lastUpdateTime ? current : latest
    );
  }


  async updateSession(session: BenchmarkSession): Promise<void> {
    session.lastUpdateTime = new Date();
    await this.saveSession(session);
  }

  async createSession(sessionData: Omit<BenchmarkSession, 'lastUpdateTime'>): Promise<BenchmarkSession> {
    const session: BenchmarkSession = {
      ...sessionData,
      lastUpdateTime: new Date()
    };

    await this.saveSession(session);
    return session;
  }

  // Utility methods for session recovery
  async findResumableSession(pluginName: string): Promise<BenchmarkSession | null> {
    const sessions = this.listSessions().filter(session => 
      session.pluginName === pluginName
    );
    
    // Find the most recent paused or failed session
    const resumableSessions = sessions.filter(session => 
      session.status === 'paused' || 
      (session.status === 'failed' && session.progress.completedTestCases > 0)
    );

    if (resumableSessions.length === 0) return null;

    return resumableSessions.reduce((latest, current) => 
      current.lastUpdateTime > latest.lastUpdateTime ? current : latest
    );
  }


  // Session statistics
  getSessionStats(): {
    total: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    byPlugin: Record<string, number>;
  } {
    const sessions = this.listSessions();
    const stats = {
      total: sessions.length,
      running: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      byPlugin: {} as Record<string, number>
    };

    sessions.forEach(session => {
      switch (session.status) {
        case 'running':
          stats.running++;
          break;
        case 'paused':
          stats.paused++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      stats.byPlugin[session.pluginName] = (stats.byPlugin[session.pluginName] || 0) + 1;
    });

    return stats;
  }


}