#!/usr/bin/env tsx

/**
 * Test NVIDIA NIM integration with available models
 * Testing DeepSeek-R1 (working) and MiniMax-M2 (investigating access)
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testNIMIntegration() {
  console.log('🧪 Testing NVIDIA NIM Integration');

  const apiKey = process.env.NIM_API_KEY;
  if (!apiKey) {
    console.error('❌ NIM_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔑 Creating NIM client...');

    const nim = createOpenAICompatible({
      name: 'nim',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Test DeepSeek-R1 first (known to work)
    console.log('🤖 Testing DeepSeek-R1 model...');
    const deepseekModel = nim.chatModel('deepseek-ai/deepseek-r1');

    // Test DeepSeek-R1
    console.log('📝 Generating text with DeepSeek-R1...');
    const { text: deepseekText, usage: deepseekUsage, finishReason: deepseekFinishReason } = await generateText({
      model: deepseekModel,
      prompt: 'Tell me a brief history of artificial intelligence in 3 sentences.',
    });

    console.log('✅ DeepSeek-R1 Success!');
    console.log('📄 Response:', deepseekText);
    console.log('📊 Usage:', deepseekUsage);
    console.log('🏁 Finish Reason:', deepseekFinishReason);

    // Test MiniMax-M2 (may not be available)
    console.log('\n🤖 Testing MiniMax-M2 model...');
    try {
      const minimaxModel = nim.chatModel('minimaxai/minimax-m2');

      console.log('📝 Generating text with MiniMax-M2...');
      const { text: minimaxText, usage: minimaxUsage, finishReason: minimaxFinishReason } = await generateText({
        model: minimaxModel,
        prompt: 'Explain what makes you unique as an AI model in 2 sentences.',
      });

      console.log('✅ MiniMax-M2 Success!');
      console.log('📄 Response:', minimaxText);
      console.log('📊 Usage:', minimaxUsage);
      console.log('🏁 Finish Reason:', minimaxFinishReason);

    } catch (minimaxError) {
      console.log('⚠️  MiniMax-M2 not available for this account');
      console.log('Error details:', minimaxError.message || minimaxError);
      console.log('This may require special access or subscription.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testNIMIntegration();