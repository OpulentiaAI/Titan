// Test types for Atlas
export interface AtlasModel {
  name: string;
  model_slug: string;
  provider: string;
  computerUseEngine: string;
  maxTokens: number;
}

export interface AtlasSettings {
  provider: 'google' | 'gateway';
  apiKey: string;
  model: string;
  computerUseEngine: string;
}

export interface TestCase {
  description: string;
  category: string;
  input: string;
  expectedUrl?: string;
  expectedContent?: string;
  expectedActions?: string[];
}

export interface AtlasTaskResult {
  success: boolean;
  steps: number;
  finalUrl?: string;
  error?: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}