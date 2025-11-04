/**
 * Arbor Server Process Management Tests
 *
 * This test suite verifies the server process management functionality
 * of the ArborGEPAAdapter class.
 */

import { ArborGEPAAdapter } from '../arbor-gepa-adapter';
import type { ArborGEPAAdapterConfig } from '../arbor-gepa-adapter';
import type { ArborServerConfig } from '../types';

/**
 * Test configuration
 */
const testConfig: ArborGEPAAdapterConfig = {
  server: {
    port: 8001,
    numTrainingGpus: 1,
    numInferenceGpus: 1
  },
  grpo: {
    train: {
      numEpochs: 5,
      learningRate: 0.001,
      batchSize: 16,
      warmupSteps: 50,
      maxGradNorm: 1.0,
      klPenalty: 0.1
    },
    compiler: {
      loraRank: 8,
      loraAlpha: 16,
      loraDropout: 0.05,
      targetModules: ['query', 'value'],
      useFlashAttn: false
    }
  },
  gepa: {
    populationSize: 10,
    mutationRate: 0.1,
    crossoverRate: 0.8,
    eliteSize: 2,
    targetImprovement: 0.1,
    convergenceTolerance: 0.01
  },
  integration: {
    enableHybridOptimization: true,
    adaptivePhaseSwitching: true,
    phaseSwitchThreshold: 0.05,
    maxPhaseRounds: 3
  }
};

/**
 * Test suite
 */
describe('ArborGEPAAdapter - Server Process Management', () => {
  let adapter: ArborGEPAAdapter;

  beforeEach(() => {
    adapter = new ArborGEPAAdapter(testConfig);
  });

  afterEach(async () => {
    // Ensure cleanup after each test
    if (adapter) {
      await adapter.cleanup().catch(() => {
        // Ignore cleanup errors in tests
      });
    }
  });

  describe('Server Initialization', () => {
    test('should initialize server successfully', async () => {
      const serverInfo = await adapter.initializeArborServer();

      expect(serverInfo).toBeDefined();
      expect(serverInfo.baseUrl).toBe('http://localhost:8001');
      expect(serverInfo.status).toBe('running');
      expect(serverInfo.pid).toBeDefined();
      expect(serverInfo.config).toEqual(testConfig.server);
    });

    test('should detect already running server', async () => {
      // Start server first time
      const serverInfo1 = await adapter.initializeArborServer();

      // Try to start again (should detect existing)
      const serverInfo2 = await adapter.initializeArborServer();

      expect(serverInfo1.baseUrl).toBe(serverInfo2.baseUrl);
    });

    test('should throw error for invalid port', async () => {
      const invalidConfig: ArborGEPAAdapterConfig = {
        ...testConfig,
        server: {
          ...testConfig.server,
          port: 99999
        }
      };

      const invalidAdapter = new ArborGEPAAdapter(invalidConfig);

      await expect(invalidAdapter.initializeArborServer()).rejects.toThrow();
    });
  });

  describe('Server Status', () => {
    test('should return correct server status', async () => {
      await adapter.initializeArborServer();

      const status = adapter.getServerStatus();

      expect(status).toBeDefined();
      expect(status.running).toBe(true);
      expect(status.healthy).toBe(true);
      expect(status.url).toBe('http://localhost:8001');
      expect(status.pid).toBeDefined();
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.config).toEqual(testConfig.server);
    });

    test('should detect server not running', async () => {
      const isRunning = await adapter.isServerRunning();
      expect(isRunning).toBe(false);

      const status = adapter.getServerStatus();
      expect(status.running).toBe(false);
      expect(status.healthy).toBe(false);
    });
  });

  describe('Server Restart', () => {
    test('should restart server successfully', async () => {
      // Start initial server
      const serverInfo1 = await adapter.initializeArborServer();
      const initialPid = serverInfo1.pid;

      // Restart server
      const serverInfo2 = await adapter.forceRestart();
      const newPid = serverInfo2.pid;

      expect(serverInfo2.status).toBe('running');
      expect(newPid).toBeDefined();
      // PID might be different after restart
    });

    test('should handle restart when server not running', async () => {
      // Restart without initial start
      const serverInfo = await adapter.forceRestart();

      expect(serverInfo).toBeDefined();
      expect(serverInfo.status).toBe('running');
    });
  });

  describe('Server Logs', () => {
    test('should return logs when server running', async () => {
      await adapter.initializeArborServer();

      const logs = await adapter.getServerLogs(10);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should return message when server not running', async () => {
      const logs = await adapter.getServerLogs(10);

      expect(logs).toBeDefined();
      expect(logs[0]).toContain('No server process running');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup server successfully', async () => {
      await adapter.initializeArborServer();

      // Verify server is running
      expect(await adapter.isServerRunning()).toBe(true);

      // Cleanup
      await adapter.cleanup();

      // Verify server is stopped
      expect(await adapter.isServerRunning()).toBe(false);
    });

    test('should handle cleanup when server not running', async () => {
      // Cleanup without starting
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });

    test('should cleanup multiple times safely', async () => {
      await adapter.initializeArborServer();

      await adapter.cleanup();
      await adapter.cleanup(); // Second cleanup should not throw
      await adapter.cleanup(); // Third cleanup should not throw
    });
  });

  describe('Error Handling', () => {
    test('should handle server startup failure', async () => {
      const configWithBadPort: ArborGEPAAdapterConfig = {
        ...testConfig,
        server: {
          ...testConfig.server,
          port: -1
        }
      };

      const badAdapter = new ArborGEPAAdapter(configWithBadPort);

      await expect(badAdapter.initializeArborServer()).rejects.toThrow();
    });

    test('should cleanup on initialization failure', async () => {
      const configWithBadPort: ArborGEPAAdapterConfig = {
        ...testConfig,
        server: {
          ...testConfig.server,
          port: -1
        }
      };

      const badAdapter = new ArborGEPAAdapter(configWithBadPort);

      try {
        await badAdapter.initializeArborServer();
      } catch (error) {
        // Expected to fail
      }

      // Verify cleanup happened
      expect(await badAdapter.isServerRunning()).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate port range', async () => {
      const configs = [
        { port: 1023, expected: 'below range' },
        { port: 65536, expected: 'above range' },
        { port: 8000, expected: 'valid' }
      ];

      for (const config of configs) {
        const testConfigWithPort: ArborGEPAAdapterConfig = {
          ...testConfig,
          server: {
            ...testConfig.server,
            port: config.port
          }
        };

        const testAdapter = new ArborGEPAAdapter(testConfigWithPort);

        if (config.expected === 'valid') {
          await expect(testAdapter.initializeArborServer()).resolves.toBeDefined();
        } else {
          await expect(testAdapter.initializeArborServer()).rejects.toThrow();
        }
      }
    });

    test('should require server configuration', async () => {
      const configWithoutServer: Partial<ArborGEPAAdapterConfig> = {
        grpo: testConfig.grpo,
        gepa: testConfig.gepa,
        integration: testConfig.integration
      };

      expect(() => new ArborGEPAAdapter(configWithoutServer as ArborGEPAAdapterConfig)).toThrow();
    });

    test('should require GRPO configuration', async () => {
      const configWithoutGRPO: Partial<ArborGEPAAdapterConfig> = {
        server: testConfig.server,
        gepa: testConfig.gepa,
        integration: testConfig.integration
      };

      expect(() => new ArborGEPAAdapter(configWithoutGRPO as ArborGEPAAdapterConfig)).toThrow();
    });

    test('should require GEPA configuration', async () => {
      const configWithoutGEPA: Partial<ArborGEPAAdapterConfig> = {
        server: testConfig.server,
        grpo: testConfig.grpo,
        integration: testConfig.integration
      };

      expect(() => new ArborGEPAAdapter(configWithoutGEPA as ArborGEPAAdapterConfig)).toThrow();
    });
  });

  describe('Integration with Existing Functionality', () => {
    test('should not interfere with GEPA operations', async () => {
      await adapter.initializeArborServer();

      // Verify we can still access existing properties
      expect(adapter).toHaveProperty('gepaEngine');
      expect(adapter).toHaveProperty('paretoFrontier');
      expect(adapter).toHaveProperty('currentPhase');

      // The adapter should maintain its state
      expect(Array.isArray(adapter.paretoFrontier)).toBe(true);
      expect(['idle', 'gepa', 'grpo', 'refinement']).toContain(adapter.currentPhase);
    });

    test('should maintain configuration after server operations', async () => {
      await adapter.initializeArborServer();

      // Get status (uses config)
      const status = adapter.getServerStatus();
      expect(status.config).toEqual(testConfig.server);

      // Restart server
      await adapter.forceRestart();

      // Config should still be the same
      const newStatus = adapter.getServerStatus();
      expect(newStatus.config).toEqual(testConfig.server);
    });
  });

  describe('Process Management Edge Cases', () => {
    test('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await adapter.initializeArborServer();
        await adapter.cleanup();
      }

      // Should complete without errors
      expect(await adapter.isServerRunning()).toBe(false);
    });

    test('should handle concurrent initializations', async () => {
      const adapter1 = new ArborGEPAAdapter(testConfig);
      const adapter2 = new ArborGEPAAdapter(testConfig);

      // Start both at the same time
      const [info1, info2] = await Promise.all([
        adapter1.initializeArborServer(),
        adapter2.initializeArborServer()
      ]);

      expect(info1.baseUrl).toBe(info2.baseUrl);

      // Cleanup
      await adapter1.cleanup();
      await adapter2.cleanup();
    });
  });
});

/**
 * Performance tests
 */
describe('ArborGEPAAdapter - Performance', () => {
  let adapter: ArborGEPAAdapter;

  beforeEach(() => {
    adapter = new ArborGEPAAdapter(testConfig);
  });

  afterEach(async () => {
    await adapter.cleanup().catch(() => {});
  });

  test('should start server within reasonable time', async () => {
    const startTime = Date.now();

    await adapter.initializeArborServer();

    const duration = Date.now() - startTime;

    // Should start within 10 seconds (timeout is 60s)
    expect(duration).toBeLessThan(10000);
  });

  test('should get status quickly', async () => {
    await adapter.initializeArborServer();

    const startTime = Date.now();
    const status = adapter.getServerStatus();
    const duration = Date.now() - startTime;

    expect(status).toBeDefined();
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  test('should cleanup quickly', async () => {
    await adapter.initializeArborServer();

    const startTime = Date.now();
    await adapter.cleanup();
    const duration = Date.now() - startTime;

    // Cleanup should be fast
    expect(duration).toBeLessThan(5000);
  });
});

export default {};
