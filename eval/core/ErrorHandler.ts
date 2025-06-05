import { BenchmarkError, PluginError, ConfigurationError, LogLevel } from './types';

export interface HandledError {
  error: Error;
  timestamp: Date;
  stackTrace: string;
  metadata?: Record<string, any>;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  mostRecentError?: Date;
  oldestError?: Date;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  data?: any;
}

export type RecoveryStrategy = (error: Error) => RecoveryResult;
export type LoggerFunction = (level: keyof LogLevel, message: string, context?: any) => void;

export class ErrorHandler {
  private handledErrors: HandledError[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private logger?: LoggerFunction;

  constructor() {
    // Set up default recovery strategies
    this.setupDefaultRecoveryStrategies();
  }

  public setLogger(logger: LoggerFunction): void {
    this.logger = logger;
  }

  public handleError(error: Error, metadata?: Record<string, any>): void {
    const handledError: HandledError = {
      error,
      timestamp: new Date(),
      stackTrace: error.stack || 'No stack trace available',
      metadata
    };

    this.handledErrors.push(handledError);

    // Log the error if logger is available
    if (this.logger) {
      const logContext: any = {
        stack: error.stack
      };

      // Add additional context for custom error types
      if (error instanceof BenchmarkError) {
        logContext.code = error.code;
        logContext.context = error.context;
      }

      if (metadata) {
        logContext.metadata = metadata;
      }

      this.logger('ERROR', error.message, logContext);
    }
  }

  public getHandledErrors(): HandledError[] {
    return [...this.handledErrors];
  }

  public getErrorsByType(): Record<string, HandledError[]> {
    const errorsByType: Record<string, HandledError[]> = {};

    for (const handledError of this.handledErrors) {
      const errorType = handledError.error.constructor.name;
      if (!errorsByType[errorType]) {
        errorsByType[errorType] = [];
      }
      errorsByType[errorType].push(handledError);
    }

    return errorsByType;
  }

  public getErrorsOfType(errorType: string): HandledError[] {
    return this.handledErrors.filter(
      handledError => handledError.error.constructor.name === errorType
    );
  }

  public getErrorStatistics(): ErrorStatistics {
    const errorsByType: Record<string, number> = {};
    let mostRecentError: Date | undefined;
    let oldestError: Date | undefined;

    for (const handledError of this.handledErrors) {
      const errorType = handledError.error.constructor.name;
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

      if (!mostRecentError || handledError.timestamp > mostRecentError) {
        mostRecentError = handledError.timestamp;
      }

      if (!oldestError || handledError.timestamp < oldestError) {
        oldestError = handledError.timestamp;
      }
    }

    return {
      totalErrors: this.handledErrors.length,
      errorsByType,
      mostRecentError,
      oldestError
    };
  }

  public addRecoveryStrategy(errorCode: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(errorCode, strategy);
  }

  public attemptRecovery(error: Error): RecoveryResult {
    let errorCode: string = 'UNKNOWN_ERROR';

    // Determine error code for recovery strategy lookup
    if (error instanceof BenchmarkError && error.code) {
      errorCode = error.code;
    } else if (error instanceof PluginError) {
      errorCode = 'PLUGIN_ERROR';
    } else if (error instanceof ConfigurationError) {
      errorCode = 'CONFIG_ERROR';
    }

    const strategy = this.recoveryStrategies.get(errorCode);
    if (strategy) {
      try {
        return strategy(error);
      } catch (recoveryError) {
        return {
          success: false,
          message: `Recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`
        };
      }
    }

    return {
      success: false,
      message: `No recovery strategy available for error code: ${errorCode}`
    };
  }

  public clearErrors(): void {
    this.handledErrors = [];
  }

  public clearErrorsOfType(errorType: string): void {
    this.handledErrors = this.handledErrors.filter(
      handledError => handledError.error.constructor.name !== errorType
    );
  }

  public getErrorCount(): number {
    return this.handledErrors.length;
  }

  public hasErrors(): boolean {
    return this.handledErrors.length > 0;
  }

  public getLastError(): HandledError | undefined {
    return this.handledErrors[this.handledErrors.length - 1];
  }

  public getErrorsInTimeRange(startTime: Date, endTime: Date): HandledError[] {
    return this.handledErrors.filter(
      handledError => 
        handledError.timestamp >= startTime && 
        handledError.timestamp <= endTime
    );
  }

  public exportErrorsAsJson(): string {
    return JSON.stringify(this.handledErrors, null, 2);
  }

  public exportErrorSummary(): string {
    const stats = this.getErrorStatistics();
    const errorsByType = this.getErrorsByType();

    let summary = `Error Summary:\n`;
    summary += `Total Errors: ${stats.totalErrors}\n`;
    summary += `Error Types:\n`;

    for (const [errorType, count] of Object.entries(stats.errorsByType)) {
      summary += `  - ${errorType}: ${count}\n`;
    }

    if (stats.mostRecentError) {
      summary += `Most Recent Error: ${stats.mostRecentError.toISOString()}\n`;
    }

    if (stats.oldestError) {
      summary += `Oldest Error: ${stats.oldestError.toISOString()}\n`;
    }

    return summary;
  }

  private setupDefaultRecoveryStrategies(): void {
    // Default recovery strategy for plugin errors
    this.addRecoveryStrategy('PLUGIN_ERROR', (error: Error) => {
      if (error instanceof PluginError) {
        return {
          success: false,
          message: `Plugin '${error.pluginName}' failed and cannot be automatically recovered. Manual intervention required.`
        };
      }
      return { success: false, message: 'Unknown plugin error' };
    });

    // Default recovery strategy for configuration errors
    this.addRecoveryStrategy('CONFIG_ERROR', (error: Error) => {
      if (error instanceof ConfigurationError) {
        return {
          success: false,
          message: `Configuration error in field '${error.field || 'unknown'}'. Please check configuration and retry.`
        };
      }
      return { success: false, message: 'Unknown configuration error' };
    });

    // Default recovery strategy for generic benchmark errors
    this.addRecoveryStrategy('BENCHMARK_ERROR', (error: Error) => {
      return {
        success: false,
        message: 'Benchmark error occurred. Consider retrying the operation or checking system resources.'
      };
    });
  }
}