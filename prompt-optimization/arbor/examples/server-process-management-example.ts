/**
 * Arbor Server Process Management Example
 *
 * This example demonstrates how to use the ArborGEPAAdapter
 * with comprehensive server process management.
 */

import {
  ArborGEPAAdapter,
  type ArborGEPAAdapterConfig
} from '../arbor-gepa-adapter';
import type {
  ArborServerConfig,
  GRPOTrainConfig,
  GRPOCompilerConfig
} from '../types';

/**
 * Example configuration for server process management
 */
const exampleServerConfig: ArborServerConfig = {
  port: 8000,
  numTrainingGpus: 1,
  numInferenceGpus: 1,
  flashAttention: true
};

/**
 * Example GRPO training configuration
 */
const exampleTrainConfig: GRPOTrainConfig = {
  numEpochs: 10,
  learningRate: 0.001,
  batchSize: 32,
  warmupSteps: 100,
  maxGradNorm: 1.0,
  klPenalty: 0.1
};

/**
 * Example GRPO compiler configuration
 */
const exampleCompilerConfig: GRPOCompilerConfig = {
  loraRank: 16,
  loraAlpha: 32,
  loraDropout: 0.1,
  targetModules: ['query', 'value'],
  useFlashAttn: true
};

/**
 * Complete adapter configuration
 */
const adapterConfig: ArborGEPAAdapterConfig = {
  server: exampleServerConfig,
  grpo: {
    train: exampleTrainConfig,
    compiler: exampleCompilerConfig
  },
  gepa: {
    populationSize: 20,
    mutationRate: 0.1,
    crossoverRate: 0.8,
    eliteSize: 2,
    targetImprovement: 0.15,
    convergenceTolerance: 0.01
  },
  integration: {
    enableHybridOptimization: true,
    adaptivePhaseSwitching: true,
    phaseSwitchThreshold: 0.05,
    maxPhaseRounds: 5
  }
};

/**
 * Example 1: Basic Server Initialization
 */
async function example1BasicInitialization() {
  console.log('\n=== Example 1: Basic Server Initialization ===\n');

  const adapter = new ArborGEPAAdapter(adapterConfig);

  try {
    // Initialize the server
    const serverInfo = await adapter.initializeArborServer();
    console.log(`✅ Server initialized successfully!`);
    console.log(`   URL: ${serverInfo.baseUrl}`);
    console.log(`   Status: ${serverInfo.status}`);
    console.log(`   PID: ${serverInfo.pid}`);

    // Check if server is running
    const isRunning = await adapter.isServerRunning();
    console.log(`\n📊 Server running: ${isRunning}`);

    // Get detailed status
    const status = adapter.getServerStatus();
    console.log(`\n📈 Status Details:`);
    console.log(`   Running: ${status.running}`);
    console.log(`   Healthy: ${status.healthy}`);
    console.log(`   Uptime: ${Math.floor(status.uptime / 1000)}s`);

    // Cleanup
    await adapter.cleanup();
    console.log(`\n🧹 Server cleaned up`);

  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Example 2: Server Health Monitoring
 */
async function example2HealthMonitoring() {
  console.log('\n=== Example 2: Server Health Monitoring ===\n');

  const adapter = new ArborGEPAAdapter(adapterConfig);

  try {
    // Start server
    const serverInfo = await adapter.initializeArborServer();
    console.log(`✅ Server started at ${serverInfo.baseUrl}`);

    // Monitor for 10 seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = adapter.getServerStatus();
      console.log(`⏱️  ${i + 1}s - Running: ${status.running}, Healthy: ${status.healthy}`);

      if (!status.healthy) {
        console.log(`⚠️  Server unhealthy, auto-recovery will trigger`);
      }
    }

    await adapter.cleanup();

  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Example 3: Server Restart
 */
async function example3ServerRestart() {
  console.log('\n=== Example 3: Server Restart ===\n');

  const adapter = new ArborGEPAAdapter(adapterConfig);

  try {
    // Initial startup
    let serverInfo = await adapter.initializeArborServer();
    console.log(`🚀 Initial server: ${serverInfo.baseUrl} (PID: ${serverInfo.pid})`);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force restart
    console.log(`\n🔄 Forcing restart...`);
    serverInfo = await adapter.forceRestart();
    console.log(`✅ Restarted server: ${serverInfo.baseUrl} (PID: ${serverInfo.pid})`);

    // Verify it's working
    const isRunning = await adapter.isServerRunning();
    console.log(`\n📊 Server running after restart: ${isRunning}`);

    await adapter.cleanup();

  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Example 4: Multiple Adapters (Server Sharing)
 */
async function example4ServerSharing() {
  console.log('\n=== Example 4: Server Sharing Between Adapters ===\n');

  const adapter1 = new ArborGEPAAdapter(adapterConfig);
  const adapter2 = new ArborGEPAAdapter(adapterConfig);

  try {
    // Start first adapter
    const serverInfo1 = await adapter1.initializeArborServer();
    console.log(`✅ Adapter 1 started server: ${serverInfo1.baseUrl}`);

    // Second adapter should detect existing server
    const serverInfo2 = await adapter2.initializeArborServer();
    console.log(`✅ Adapter 2 detected existing server: ${serverInfo2.baseUrl}`);

    // Both should reference the same server
    const sameServer = serverInfo1.baseUrl === serverInfo2.baseUrl;
    console.log(`\n🔗 Same server: ${sameServer}`);

    // Both adapters can check status
    const status1 = adapter1.getServerStatus();
    const status2 = adapter2.getServerStatus();
    console.log(`\n📊 Adapter 1 healthy: ${status1.healthy}`);
    console.log(`📊 Adapter 2 healthy: ${status2.healthy}`);

    // Cleanup
    await adapter1.cleanup();
    await adapter2.cleanup();

  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Example 5: Server Logs
 */
async function example5ServerLogs() {
  console.log('\n=== Example 5: Server Logs ===\n');

  const adapter = new ArborGEPAAdapter(adapterConfig);

  try {
    await adapter.initializeArborServer();
    console.log(`✅ Server started`);

    // Get logs (currently returns placeholder)
    const logs = await adapter.getServerLogs(10);
    console.log(`\n📝 Server logs (last 10 lines):`);
    logs.forEach(log => console.log(`   ${log}`));

    await adapter.cleanup();

  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Example 6: Error Handling
 */
async function example6ErrorHandling() {
  console.log('\n=== Example 6: Error Handling ===\n');

  // Invalid configuration (port out of range)
  const invalidConfig: ArborGEPAAdapterConfig = {
    ...adapterConfig,
    server: {
      ...adapterConfig.server,
      port: 99999 // Invalid port
    }
  };

  const adapter = new ArborGEPAAdapter(invalidConfig);

  try {
    await adapter.initializeArborServer();
    console.log(`❌ Should not reach here`);
  } catch (error: any) {
    console.log(`✅ Caught expected error: ${error.message}`);
    console.log(`\n🛡️  Error handling prevents invalid configuration`);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Arbor Server Process Management - Examples       ║');
  console.log('╚════════════════════════════════════════════════════╝');

  await example1BasicInitialization();
  await example2HealthMonitoring();
  await example3ServerRestart();
  await example4ServerSharing();
  await example5ServerLogs();
  await example6ErrorHandling();

  console.log('\n✅ All examples completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => {
      console.log('\n🎉 Examples finished successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Example execution failed:', error);
      process.exit(1);
    });
}

export {
  example1BasicInitialization,
  example2HealthMonitoring,
  example3ServerRestart,
  example4ServerSharing,
  example5ServerLogs,
  example6ErrorHandling,
  runAllExamples
};
