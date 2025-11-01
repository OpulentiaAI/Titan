import { LanguageModelUsage } from 'ai';

export type AtlasProvider = 'google' | 'gateway';

export type ComputerUseEngine = 'google' | 'gateway-flash-lite';

export interface AtlasModel {
  name: string;
  model_slug: string;
  provider: AtlasProvider;
  computerUseEngine: ComputerUseEngine;
  maxTokens: number;
}

export interface AtlasSettings {
  provider: AtlasProvider;
  apiKey: string;
  model: string;
  computerUseEngine: ComputerUseEngine;
  youApiKey?: string;
  braintrustApiKey?: string;
  braintrustProjectName?: string;
}

export interface AtlasResult {
  success: boolean;
  steps: number;
  usage: LanguageModelUsage;
  executionTime: number;
  error?: string;
  finalUrl?: string;
  screenshot?: string;
  messages: AtlasMessage[];
}

export interface AtlasMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TestCase {
  input: string;
  expectedUrl?: string;
  expectedContent?: string;
  expectedActions?: string[];
  description: string;
  category: 'navigation' | 'search' | 'form' | 'interaction' | 'complex';
}

