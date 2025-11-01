import * as braintrust from 'braintrust';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGateway } from '@ai-sdk/gateway';
import { atlasTask } from './atlasTask.js';
import { atlasScorer } from './atlasScorer.js';
import { TEST_CASES } from './testCases.js';
import type { AtlasModel, AtlasSettings } from './types.js';

const ATLAS_PROJECT = 'atlas-extension';

function atlasEval(model: AtlasModel, settings: AtlasSettings) {
  const experimentName = `${ATLAS_PROJECT}-${model.name}-${model.computerUseEngine}`;
  const environment = process.env.ENVIRONMENT ?? 'test';
  
  return braintrust.Eval(ATLAS_PROJECT, {
    experimentName,
    data: TEST_CASES.map((tc) => ({ input: tc.input })),
    task: (input) => atlasTask(model, settings, input),
    scores: [atlasScorer],
    maxConcurrency: 1, // Run sequentially to avoid browser conflicts
    metadata: {
      model: model.name,
      model_slug: model.model_slug,
      provider: model.provider,
      computer_use_engine: model.computerUseEngine,
      environment,
    },
  });
}

// Google Computer Use engine
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  const settings: AtlasSettings = {
    provider: 'google',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: 'gemini-2.5-pro',
    computerUseEngine: 'google',
    braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    braintrustProjectName: ATLAS_PROJECT,
  };

  atlasEval(
    {
      name: 'gemini-2.5-pro',
      model_slug: 'gemini-2.5-pro',
      provider: 'google',
      computerUseEngine: 'google',
      maxTokens: 8192,
    },
    settings
  );

  atlasEval(
    {
      name: 'gemini-2.5-flash',
      model_slug: 'gemini-2.5-flash',
      provider: 'google',
      computerUseEngine: 'google',
      maxTokens: 8192,
    },
    settings
  );
}

// AI Gateway Flash Lite engine
if (process.env.AI_GATEWAY_API_KEY) {
  const settings: AtlasSettings = {
    provider: 'gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY,
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    computerUseEngine: 'gateway-flash-lite',
    braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    braintrustProjectName: ATLAS_PROJECT,
  };

  atlasEval(
    {
      name: 'gateway-flash-lite',
      model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
      provider: 'gateway',
      computerUseEngine: 'gateway-flash-lite',
      maxTokens: 8192,
    },
    settings
  );
}

