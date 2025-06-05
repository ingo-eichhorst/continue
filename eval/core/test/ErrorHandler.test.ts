import { ErrorHandler } from '../ErrorHandler';
import { BenchmarkError, PluginError, ConfigurationError } from '../types';

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
});