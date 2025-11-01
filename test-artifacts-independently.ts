// Independent test for artifact utilities
// Run with: npx tsx test-artifacts-independently.ts

import { ExecutionPlanArtifact, streamExecutionPlan, createArtifactTool } from './lib/artifact-utils';

async function testArtifactsIndependently() {
  console.log('🧪 Testing Artifact Utilities Independently\n');

  try {
    // Test 1: Functions are available
    console.log('✅ Test 1: Artifact utilities imported successfully');

    if (ExecutionPlanArtifact && typeof ExecutionPlanArtifact.stream === 'function') {
      console.log('✅ Test 2: ExecutionPlanArtifact available');
    } else {
      console.log('❌ Test 2: ExecutionPlanArtifact not available');
      return;
    }

    if (typeof streamExecutionPlan === 'function') {
      console.log('✅ Test 3: streamExecutionPlan function available');
    } else {
      console.log('❌ Test 3: streamExecutionPlan function not available');
      return;
    }

    if (typeof createArtifactTool === 'function') {
      console.log('✅ Test 4: createArtifactTool function available');
    } else {
      console.log('❌ Test 4: createArtifactTool function not available');
      return;
    }

    // Test 2: createArtifactTool works
    const tool = createArtifactTool('test-tool', {});
    if (tool && typeof tool.execute === 'function') {
      console.log('✅ Test 5: createArtifactTool creates valid tool');
    } else {
      console.log('❌ Test 5: createArtifactTool failed');
      return;
    }

    console.log('\n🎉 All artifact utility tests passed!');

  } catch (error) {
    console.error('❌ Artifact utility test failed:', error);
  }
}

testArtifactsIndependently();