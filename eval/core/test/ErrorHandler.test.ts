import { ErrorHandler } from '../ErrorHandler';
import { Logger } from '../Logger';
import { BenchmarkError, PluginError, ConfigurationError, LogLevel, LogEntry } from '../types';
import * as fs from 'fs';

describe('ErrorHandler', () => {
  describe('Custom Error Types', () => {
    test('should have BenchmarkError defined', () => {
      const error = new BenchmarkError('Test benchmark error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BenchmarkError);
      expect(error.name).toBe('BenchmarkError');
      expect(error.message).toBe('Test benchmark error');
    });

    test('should have PluginError defined', () => {
      const error = new PluginError('Test plugin error', 'test-plugin');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BenchmarkError);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.name).toBe('PluginError');
      expect(error.message).toBe('Test plugin error');
      expect(error.pluginName).toBe('test-plugin');
      expect(error.code).toBe('PLUGIN_ERROR');
    });

    test('should have ConfigurationError defined', () => {
      const error = new ConfigurationError('Test config error', 'testField');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BenchmarkError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Test config error');
      expect(error.field).toBe('testField');
      expect(error.code).toBe('CONFIG_ERROR');
    });

    test('should support error context', () => {
      const context = { userId: '123', sessionId: 'abc' };
      const error = new BenchmarkError('Error with context', 'TEST_ERROR', context);
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual(context);
    });
  });

  describe('Error Handling System', () => {
    test('should be able to instantiate ErrorHandler', () => {
      expect(() => new ErrorHandler()).not.toThrow();
    });

    test('should handle errors without crashing the system', () => {
      const errorHandler = new ErrorHandler();
      
      const testError = new BenchmarkError('Test error');
      
      // Should not throw when handling error
      expect(() => errorHandler.handleError(testError)).not.toThrow();
      
      // Should track handled errors
      const handledErrors = errorHandler.getHandledErrors();
      expect(handledErrors.length).toBe(1);
      expect(handledErrors[0].error).toBe(testError);
    });

    test('should log errors with appropriate context', () => {
      const errorHandler = new ErrorHandler();
      const mockLogger = jest.fn();
      errorHandler.setLogger(mockLogger);
      
      const testError = new BenchmarkError('Test error with context', 'TEST_CODE', { 
        operation: 'benchmark-run',
        timestamp: Date.now()
      });
      
      errorHandler.handleError(testError);
      
      expect(mockLogger).toHaveBeenCalledWith('ERROR', 'Test error with context', {
        code: 'TEST_CODE',
        context: testError.context,
        stack: testError.stack
      });
    });

    test('should categorize errors by type', () => {
      const errorHandler = new ErrorHandler();
      
      const benchmarkError = new BenchmarkError('Benchmark error');
      const pluginError = new PluginError('Plugin error', 'test-plugin');
      const configError = new ConfigurationError('Config error', 'testField');
      
      errorHandler.handleError(benchmarkError);
      errorHandler.handleError(pluginError);
      errorHandler.handleError(configError);
      
      const errorsByType = errorHandler.getErrorsByType();
      expect(errorsByType.BenchmarkError).toHaveLength(1);
      expect(errorsByType.PluginError).toHaveLength(1);
      expect(errorsByType.ConfigurationError).toHaveLength(1);
    });

    test('should provide error statistics', () => {
      const errorHandler = new ErrorHandler();
      
      // Add multiple errors
      errorHandler.handleError(new BenchmarkError('Error 1'));
      errorHandler.handleError(new PluginError('Error 2', 'plugin1'));
      errorHandler.handleError(new PluginError('Error 3', 'plugin2'));
      errorHandler.handleError(new ConfigurationError('Error 4', 'field1'));
      
      const stats = errorHandler.getErrorStatistics();
      
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByType.BenchmarkError).toBe(1);
      expect(stats.errorsByType.PluginError).toBe(2);
      expect(stats.errorsByType.ConfigurationError).toBe(1);
    });

    test('should support error recovery strategies', () => {
      const errorHandler = new ErrorHandler();
      
      const recoveryStrategy = jest.fn(() => ({ success: true, message: 'Recovered' }));
      errorHandler.addRecoveryStrategy('PLUGIN_ERROR', recoveryStrategy);
      
      const pluginError = new PluginError('Plugin failed', 'test-plugin');
      const result = errorHandler.attemptRecovery(pluginError);
      
      expect(recoveryStrategy).toHaveBeenCalledWith(pluginError);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Recovered');
    });

    test('should handle unknown error types gracefully', () => {
      const errorHandler = new ErrorHandler();
      
      const unknownError = new Error('Unknown error type');
      
      expect(() => errorHandler.handleError(unknownError)).not.toThrow();
      
      const handledErrors = errorHandler.getHandledErrors();
      expect(handledErrors.length).toBe(1);
      expect(handledErrors[0].error).toBe(unknownError);
    });

    test('should support error filtering', () => {
      const errorHandler = new ErrorHandler();
      
      errorHandler.handleError(new BenchmarkError('Benchmark error'));
      errorHandler.handleError(new PluginError('Plugin error', 'test-plugin'));
      errorHandler.handleError(new ConfigurationError('Config error', 'field1'));
      
      const pluginErrors = errorHandler.getErrorsOfType('PluginError');
      expect(pluginErrors).toHaveLength(1);
      expect(pluginErrors[0].error).toBeInstanceOf(PluginError);
    });

    test('should support error clearing', () => {
      const errorHandler = new ErrorHandler();
      
      errorHandler.handleError(new BenchmarkError('Error 1'));
      errorHandler.handleError(new BenchmarkError('Error 2'));
      
      expect(errorHandler.getHandledErrors()).toHaveLength(2);
      
      errorHandler.clearErrors();
      
      expect(errorHandler.getHandledErrors()).toHaveLength(0);
    });
  });

  describe('Error Context and Debugging', () => {
    test('should capture stack traces', () => {
      const errorHandler = new ErrorHandler();
      
      const testError = new BenchmarkError('Test error');
      errorHandler.handleError(testError);
      
      const handledErrors = errorHandler.getHandledErrors();
      expect(handledErrors[0].stackTrace).toBeDefined();
      expect(typeof handledErrors[0].stackTrace).toBe('string');
    });

    test('should timestamp error occurrences', () => {
      const errorHandler = new ErrorHandler();
      
      const beforeTime = Date.now();
      errorHandler.handleError(new BenchmarkError('Test error'));
      const afterTime = Date.now();
      
      const handledErrors = errorHandler.getHandledErrors();
      const errorTime = handledErrors[0].timestamp.getTime();
      
      expect(errorTime).toBeGreaterThanOrEqual(beforeTime);
      expect(errorTime).toBeLessThanOrEqual(afterTime);
    });

    test('should support error metadata', () => {
      const errorHandler = new ErrorHandler();
      
      const metadata = {
        userId: '123',
        sessionId: 'abc',
        operation: 'benchmark-execution'
      };
      
      errorHandler.handleError(new BenchmarkError('Test error'), metadata);
      
      const handledErrors = errorHandler.getHandledErrors();
      expect(handledErrors[0].metadata).toEqual(metadata);
    });
  });

  describe('Logging System', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should be able to instantiate Logger', () => {
      expect(() => new Logger()).not.toThrow();
    });

    test('should configure logging with different levels', () => {
      const logger = new Logger();
      
      expect(typeof logger.setLevel).toBe('function');
      expect(() => logger.setLevel('DEBUG')).not.toThrow();
      expect(() => logger.setLevel('INFO')).not.toThrow();
      expect(() => logger.setLevel('WARN')).not.toThrow();
      expect(() => logger.setLevel('ERROR')).not.toThrow();
    });

    test('should log messages at different levels', () => {
      const logger = new Logger('DEBUG', 1000, false); // Disable default console output
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      const logs = logger.getLogs();
      expect(logs.length).toBe(4);
      expect(logs[0].level).toBe('DEBUG');
      expect(logs[1].level).toBe('INFO');
      expect(logs[2].level).toBe('WARN');
      expect(logs[3].level).toBe('ERROR');
    });

    test('should respect log level filtering', () => {
      const logger = new Logger('WARN', 1000, false); // Start with WARN level, disable console
      
      logger.debug('Debug message'); // Should be filtered
      logger.info('Info message');   // Should be filtered
      logger.warn('Warning message'); // Should be logged
      logger.error('Error message');  // Should be logged
      
      const logs = logger.getLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].level).toBe('WARN');
      expect(logs[1].level).toBe('ERROR');
    });

    test('should write logs to appropriate outputs', () => {
      const logger = new Logger('INFO', 1000, false); // Disable console output for test
      
      // Test that file output method exists and can be called
      expect(typeof logger.addFileOutput).toBe('function');
      expect(() => logger.addFileOutput('./test-logs.txt')).not.toThrow();
      
      // Test that custom output method exists
      expect(typeof logger.addCustomOutput).toBe('function');
      
      const customOutput = jest.fn();
      logger.addCustomOutput(customOutput);
      logger.info('Test log message');
      
      // Verify custom output was called
      expect(customOutput).toHaveBeenCalled();
    });

    test('should support structured logging format', () => {
      const logger = new Logger('INFO', 1000, false);
      
      const context = {
        userId: '123',
        operation: 'benchmark-run',
        metadata: { version: '1.0' }
      };
      
      logger.info('Structured log message', context);
      
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].context).toEqual(context);
      expect(logs[0].message).toBe('Structured log message');
    });

    test('should format log messages consistently', () => {
      const logger = new Logger('INFO', 1000, false);
      
      logger.info('Test message', { key: 'value' });
      
      const logs = logger.getLogs();
      const logEntry = logs[0];
      
      expect(logEntry).toHaveProperty('level');
      expect(logEntry).toHaveProperty('message');
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('context');
      expect(logEntry.timestamp).toBeInstanceOf(Date);
    });

    test('should support multiple output targets', () => {
      const logger = new Logger('INFO', 1000, false);
      
      const consoleOutput = jest.fn();
      const fileOutput = jest.fn();
      const customOutput = jest.fn();
      
      logger.addConsoleOutput(consoleOutput);
      logger.addCustomOutput(customOutput);
      
      logger.info('Multi-output message');
      
      // Verify the logger can handle multiple outputs
      expect(typeof logger.addConsoleOutput).toBe('function');
      expect(typeof logger.addCustomOutput).toBe('function');
    });

    test('should handle log rotation', () => {
      const logger = new Logger('INFO', 1000, false);
      
      // Add many log entries to test rotation
      for (let i = 0; i < 1005; i++) {
        logger.info(`Log message ${i}`);
      }
      
      const logs = logger.getLogs();
      // Should maintain maximum log count (default 1000)
      expect(logs.length).toBeLessThanOrEqual(1000);
    });

    test('should export logs in different formats', () => {
      const logger = new Logger('INFO', 1000, false);
      
      logger.info('Test message 1');
      logger.warn('Test message 2');
      logger.error('Test message 3');
      
      // JSON format
      const jsonLogs = logger.exportLogs('json');
      expect(typeof jsonLogs).toBe('string');
      const parsed = JSON.parse(jsonLogs);
      expect(Array.isArray(parsed)).toBe(true);
      
      // Text format
      const textLogs = logger.exportLogs('text');
      expect(typeof textLogs).toBe('string');
      expect(textLogs).toContain('Test message 1');
      expect(textLogs).toContain('Test message 2');
    });

    test('should integrate with ErrorHandler', () => {
      const logger = new Logger('INFO', 1000, false);
      const errorHandler = new ErrorHandler();
      
      // Set logger as the error handler's logger
      errorHandler.setLogger((level, message, context) => {
        logger.log(level, message, context);
      });
      
      errorHandler.handleError(new BenchmarkError('Integration test error'));
      
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].message).toBe('Integration test error');
    });
  });
});