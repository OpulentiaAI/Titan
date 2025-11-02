#!/usr/bin/env tsx

/**
 * Test OpenRouter MiniMax-M2 integration
 * Model: minimax/minimax-m2 - Mixture-of-Experts with interleaved thinking
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOpenRouterMiniMax() {
  console.log('🧪 Testing OpenRouter MiniMax-M2 Integration');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment variables');
    console.log('Get your API key from: https://openrouter.ai/keys');
    process.exit(1);
  }

  try {
    console.log('🔑 Creating OpenRouter client...');

    const openrouter = createOpenRouter({
      apiKey,
    });

    console.log('🤖 Creating MiniMax-M2 model instance...');
    const model = openrouter('minimax/minimax-m2');

    console.log('📝 Generating text with MiniMax-M2...');
    const { text, usage, finishReason } = await generateText({
      model,
      prompt: 'Explain what makes you unique as an AI model in 2-3 sentences.',
    });

    console.log('✅ MiniMax-M2 Success!');
    console.log('📄 Response:', text);
    console.log('📊 Usage:', usage);
    console.log('🏁 Finish Reason:', finishReason);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testOpenRouterMiniMax();