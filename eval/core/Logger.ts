import { LogLevel, LogEntry } from './types';
import * as fs from 'fs';
import * as path from 'path';

export type LogOutputFunction = (entry: LogEntry) => void;

export class Logger {
  private logs: LogEntry[] = [];
  private currentLevel: keyof LogLevel = 'INFO';
  private maxLogCount: number = 1000;
  private outputs: LogOutputFunction[] = [];

  private readonly logLevels: LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  constructor(level: keyof LogLevel = 'INFO', maxLogCount: number = 1000, addDefaultConsole: boolean = true) {
    this.currentLevel = level;
    this.maxLogCount = maxLogCount;
    
    // Add default console output unless disabled
    if (addDefaultConsole) {
      this.addConsoleOutput();
    }
  }

  public setLevel(level: keyof LogLevel): void {
    this.currentLevel = level;
  }

  public getLevel(): keyof LogLevel {
    return this.currentLevel;
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log('DEBUG', message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log('INFO', message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log('WARN', message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
    this.log('ERROR', message, context);
  }

  public log(level: keyof LogLevel, message: string, context?: Record<string, any>): void {
    // Check if log level should be logged
    if (this.logLevels[level] < this.logLevels[this.currentLevel]) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: context || {}
    };

    // Add to internal log storage
    this.logs.push(logEntry);

    // Rotate logs if necessary
    if (this.logs.length > this.maxLogCount) {
      this.logs = this.logs.slice(-this.maxLogCount);
    }

    // Send to all outputs
    this.outputs.forEach(output => {
      try {
        output(logEntry);
      } catch (error) {
        // Prevent logging errors from crashing the application
        console.error('Logger output error:', error);
      }
    });
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getLogsByLevel(level: keyof LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  public getLogsInTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return this.logs.filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public addConsoleOutput(customConsole?: (entry: LogEntry) => void): void {
    const consoleOutput: LogOutputFunction = customConsole || ((entry: LogEntry) => {
      const timestamp = entry.timestamp.toISOString();
      const contextStr = Object.keys(entry.context || {}).length > 0 
        ? ` ${JSON.stringify(entry.context)}` 
        : '';
      
      const logMessage = `[${timestamp}] ${entry.level}: ${entry.message}${contextStr}`;
      
      switch (entry.level) {
        case 'DEBUG':
        case 'INFO':
          console.log(logMessage);
          break;
        case 'WARN':
          console.warn(logMessage);
          break;
        case 'ERROR':
          console.error(logMessage);
          break;
      }
    });

    this.outputs.push(consoleOutput);
  }

  public addFileOutput(filePath: string): void {
    const fileOutput: LogOutputFunction = (entry: LogEntry) => {
      try {
        const logDir = path.dirname(filePath);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        const timestamp = entry.timestamp.toISOString();
        const contextStr = Object.keys(entry.context || {}).length > 0 
          ? ` ${JSON.stringify(entry.context)}` 
          : '';
        
        const logLine = `[${timestamp}] ${entry.level}: ${entry.message}${contextStr}\n`;
        
        fs.appendFileSync(filePath, logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    };

    this.outputs.push(fileOutput);
  }

  public addCustomOutput(outputFunction: LogOutputFunction): void {
    this.outputs.push(outputFunction);
  }

  public removeAllOutputs(): void {
    this.outputs = [];
  }

  public exportLogs(format: 'json' | 'text' | 'csv'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);
      
      case 'text':
        return this.logs.map(log => {
          const timestamp = log.timestamp.toISOString();
          const contextStr = Object.keys(log.context || {}).length > 0 
            ? ` ${JSON.stringify(log.context)}` 
            : '';
          return `[${timestamp}] ${log.level}: ${log.message}${contextStr}`;
        }).join('\n');
      
      case 'csv':
        const csvHeader = 'timestamp,level,message,context\n';
        const csvRows = this.logs.map(log => {
          const timestamp = log.timestamp.toISOString();
          const message = log.message.replace(/"/g, '""');
          const context = JSON.stringify(log.context || {}).replace(/"/g, '""');
          return `"${timestamp}","${log.level}","${message}","${context}"`;
        }).join('\n');
        return csvHeader + csvRows;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  public getLogStatistics(): {
    totalLogs: number;
    logsByLevel: Record<keyof LogLevel, number>;
    oldestLog?: Date;
    newestLog?: Date;
  } {
    const logsByLevel: Record<keyof LogLevel, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0
    };

    let oldestLog: Date | undefined;
    let newestLog: Date | undefined;

    for (const log of this.logs) {
      logsByLevel[log.level]++;
      
      if (!oldestLog || log.timestamp < oldestLog) {
        oldestLog = log.timestamp;
      }
      
      if (!newestLog || log.timestamp > newestLog) {
        newestLog = log.timestamp;
      }
    }

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      oldestLog,
      newestLog
    };
  }

  public setMaxLogCount(maxCount: number): void {
    this.maxLogCount = maxCount;
    
    // Trim logs if necessary
    if (this.logs.length > this.maxLogCount) {
      this.logs = this.logs.slice(-this.maxLogCount);
    }
  }

  public getMaxLogCount(): number {
    return this.maxLogCount;
  }

  public searchLogs(query: string, options?: {
    level?: keyof LogLevel;
    caseSensitive?: boolean;
    contextSearch?: boolean;
  }): LogEntry[] {
    const caseSensitive = options?.caseSensitive || false;
    const contextSearch = options?.contextSearch || false;
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    return this.logs.filter(log => {
      // Filter by level if specified
      if (options?.level && log.level !== options.level) {
        return false;
      }

      // Search in message
      const message = caseSensitive ? log.message : log.message.toLowerCase();
      if (message.includes(searchQuery)) {
        return true;
      }

      // Search in context if enabled
      if (contextSearch && log.context) {
        const contextStr = caseSensitive 
          ? JSON.stringify(log.context)
          : JSON.stringify(log.context).toLowerCase();
        return contextStr.includes(searchQuery);
      }

      return false;
    });
  }
}