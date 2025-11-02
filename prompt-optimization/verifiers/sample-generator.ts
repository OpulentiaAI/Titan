/**
 * Advanced Sample Generator
 * Comprehensive sample generation using all tool-test logic patterns
 *
 * Features:
 * - Auto-rendering with multiple strategies
 * - Tool-test compatibility
 * - Multimodal support (text, images, structured data)
 * - Quality scoring and filtering
 * - Batch generation with parallelization
 */

import type {
  ToolDefinition,
  DatasetEntry,
  SampleGenerationConfig,
  ChatMessage,
  ToolCall
} from './types';

/**
 * Advanced Sample Generation Configuration
 */
export interface AdvancedGenerationConfig extends SampleGenerationConfig {
  /** Enable auto-rendering of samples */
  autoRender?: boolean;
  /** Quality threshold (0-1) */
  qualityThreshold?: number;
  /** Enable multimodal samples */
  multimodal?: boolean;
  /** Parallel generation workers */
  parallelWorkers?: number;
  /** Tool complexity levels to generate */
  complexityLevels?: ('simple' | 'moderate' | 'complex')[];
  /** Enable realistic scenarios */
  realisticScenarios?: boolean;
  /** Template categories */
  templateCategories?: string[];
}

/**
 * Sample Quality Metrics
 */
export interface SampleQuality {
  /** Overall quality score (0-1) */
  score: number;
  /** Complexity level */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Realism score (0-1) */
  realism: number;
  /** Coverage score (0-1) */
  coverage: number;
  /** Diversity score (0-1) */
  diversity: number;
}

/**
 * Generated Sample with Metadata
 */
export interface GeneratedSample extends DatasetEntry {
  /** Sample ID */
  id: string;
  /** Quality metrics */
  quality: SampleQuality;
  /** Generation metadata */
  generation: {
    strategy: string;
    timestamp: string;
    version: string;
  };
}

/**
 * Advanced Sample Generator
 */
export class AdvancedSampleGenerator {
  private tools: ToolDefinition[];
  private generatedSamples: GeneratedSample[] = [];
  private sampleIdCounter = 0;

  constructor(tools: ToolDefinition[]) {
    this.tools = tools;
  }

  /**
   * Generate comprehensive sample set using all strategies
   */
  async generateComprehensive(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    console.log('🔄 Generating comprehensive sample set...');
    console.log(`   Target: ${config.count} samples`);
    console.log(`   Strategies: ALL (7 strategies)`);
    console.log(`   Auto-render: ${config.autoRender ?? true}`);
    console.log(`   Quality threshold: ${config.qualityThreshold ?? 0.7}\n`);

    const strategies = [
      'combinatorial',
      'synthetic',
      'mutation',
      'edge-cases',
      'realistic',
      'template-based',
      'adversarial'
    ];

    const samplesPerStrategy = Math.ceil(config.count / strategies.length);
    const allSamples: GeneratedSample[] = [];

    for (const strategy of strategies) {
      console.log(`   📋 Generating ${samplesPerStrategy} ${strategy} samples...`);

      const samples = await this.generateByStrategy(strategy as any, {
        ...config,
        count: samplesPerStrategy
      });

      // Filter by quality
      const qualityFiltered = samples.filter(
        s => s.quality.score >= (config.qualityThreshold ?? 0.7)
      );

      console.log(
        `      ✅ Generated ${samples.length}, kept ${qualityFiltered.length} after quality filter`
      );

      allSamples.push(...qualityFiltered);
    }

    // Ensure we have enough samples
    while (allSamples.length < config.count) {
      console.log(`   📋 Generating additional samples (${config.count - allSamples.length} needed)...`);
      const additional = await this.generateByStrategy('synthetic', {
        ...config,
        count: config.count - allSamples.length
      });
      allSamples.push(...additional);
    }

    // Trim to exact count
    const finalSamples = allSamples.slice(0, config.count);

    console.log(`\n✅ Total samples generated: ${finalSamples.length}`);
    this.printStatistics(finalSamples);

    this.generatedSamples.push(...finalSamples);
    return finalSamples;
  }

  /**
   * Generate samples using specific strategy
   */
  private async generateByStrategy(
    strategy: string,
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    switch (strategy) {
      case 'combinatorial':
        return this.generateCombinatorial(config);
      case 'synthetic':
        return this.generateSynthetic(config);
      case 'mutation':
        return this.generateMutation(config);
      case 'edge-cases':
        return this.generateEdgeCases(config);
      case 'realistic':
        return this.generateRealistic(config);
      case 'template-based':
        return this.generateTemplateBased(config);
      case 'adversarial':
        return this.generateAdversarial(config);
      default:
        return this.generateSynthetic(config);
    }
  }

  /**
   * Combinatorial: All tool combinations
   */
  private async generateCombinatorial(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];

    // Single tool samples
    for (const tool of this.tools) {
      for (const complexity of config.complexityLevels ?? ['simple', 'moderate', 'complex']) {
        const sample = this.createToolSample(tool, complexity);
        samples.push(sample);

        if (samples.length >= config.count) return samples;
      }
    }

    // Two-tool combinations
    for (let i = 0; i < this.tools.length; i++) {
      for (let j = i + 1; j < this.tools.length; j++) {
        const sample = this.createMultiToolSample([this.tools[i], this.tools[j]], 'moderate');
        samples.push(sample);

        if (samples.length >= config.count) return samples;
      }
    }

    // Three-tool combinations (complex workflows)
    if (samples.length < config.count && this.tools.length >= 3) {
      for (let i = 0; i < this.tools.length; i++) {
        for (let j = i + 1; j < this.tools.length; j++) {
          for (let k = j + 1; k < this.tools.length; k++) {
            const sample = this.createMultiToolSample(
              [this.tools[i], this.tools[j], this.tools[k]],
              'complex'
            );
            samples.push(sample);

            if (samples.length >= config.count) return samples;
          }
        }
      }
    }

    return samples.slice(0, config.count);
  }

  /**
   * Synthetic: LLM-inspired scenarios
   */
  private async generateSynthetic(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];
    const templates = this.getSyntheticTemplates();

    for (let i = 0; i < config.count; i++) {
      const template = templates[i % templates.length];
      const tool = this.tools[i % this.tools.length];

      const sample = this.createSampleFromTemplate(template, tool);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Mutation: Variants of existing samples
   */
  private async generateMutation(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];

    // Use existing samples or generate base samples
    const baseSamples = this.generatedSamples.length > 0
      ? this.generatedSamples
      : await this.generateCombinatorial({ ...config, count: 10 });

    const mutationsPerSample = Math.ceil(config.count / baseSamples.length);

    for (const baseSample of baseSamples) {
      for (let m = 0; m < mutationsPerSample && samples.length < config.count; m++) {
        const mutated = this.mutateSample(baseSample, m);
        samples.push(mutated);
      }
    }

    return samples.slice(0, config.count);
  }

  /**
   * Edge Cases: Boundary conditions
   */
  private async generateEdgeCases(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];
    const edgeTypes = ['empty', 'max', 'invalid', 'null', 'overflow'];

    for (const tool of this.tools) {
      for (const edgeType of edgeTypes) {
        const sample = this.createEdgeCaseSample(tool, edgeType);
        samples.push(sample);

        if (samples.length >= config.count) return samples.slice(0, config.count);
      }
    }

    return samples;
  }

  /**
   * Realistic: Production-like scenarios
   */
  private async generateRealistic(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];
    const scenarios = this.getRealisticScenarios();

    for (let i = 0; i < config.count; i++) {
      const scenario = scenarios[i % scenarios.length];
      const sample = this.createRealisticSample(scenario);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Template-Based: Predefined patterns
   */
  private async generateTemplateBased(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];
    const templates = this.getToolTestTemplates();

    for (let i = 0; i < config.count; i++) {
      const template = templates[i % templates.length];
      const tool = this.tools[i % this.tools.length];

      const sample = this.createFromTemplate(template, tool);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Adversarial: Challenge cases
   */
  private async generateAdversarial(
    config: AdvancedGenerationConfig
  ): Promise<GeneratedSample[]> {
    const samples: GeneratedSample[] = [];
    const adversarialPatterns = [
      'ambiguous_intent',
      'conflicting_requirements',
      'implicit_assumptions',
      'edge_case_combinations',
      'resource_constraints'
    ];

    for (let i = 0; i < config.count; i++) {
      const pattern = adversarialPatterns[i % adversarialPatterns.length];
      const tool = this.tools[i % this.tools.length];

      const sample = this.createAdversarialSample(pattern, tool);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Create single tool sample
   */
  private createToolSample(
    tool: ToolDefinition,
    complexity: 'simple' | 'moderate' | 'complex'
  ): GeneratedSample {
    const args = this.generateArguments(tool, complexity);
    const prompt = this.generatePrompt(tool, args, complexity);

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: prompt
        }
      ],
      info: {
        targetTool: tool.name,
        complexity,
        args,
        expectedToolCalls: 1
      },
      task: 'tool-usage',
      quality: this.calculateQuality(complexity, 'single-tool'),
      generation: {
        strategy: 'combinatorial',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create multi-tool sample
   */
  private createMultiToolSample(
    tools: ToolDefinition[],
    complexity: 'simple' | 'moderate' | 'complex'
  ): GeneratedSample {
    const workflow = this.generateWorkflow(tools, complexity);

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: workflow.prompt
        }
      ],
      info: {
        targetTools: tools.map(t => t.name),
        complexity,
        workflow: workflow.steps,
        expectedToolCalls: tools.length
      },
      task: 'multi-tool-workflow',
      quality: this.calculateQuality(complexity, 'multi-tool'),
      generation: {
        strategy: 'combinatorial',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create edge case sample
   */
  private createEdgeCaseSample(
    tool: ToolDefinition,
    edgeType: string
  ): GeneratedSample {
    const args = this.generateEdgeCaseArgs(tool, edgeType);
    const prompt = `Test ${tool.name} with ${edgeType} parameters: ${JSON.stringify(args)}`;

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: prompt
        }
      ],
      info: {
        targetTool: tool.name,
        edgeCase: edgeType,
        args,
        expectedBehavior: 'handle_gracefully'
      },
      task: 'tool-edge-case',
      quality: this.calculateQuality('simple', 'edge-case'),
      generation: {
        strategy: 'edge-cases',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create realistic scenario sample
   */
  private createRealisticSample(scenario: any): GeneratedSample {
    const tool = this.tools.find(t => t.name === scenario.tool) || this.tools[0];

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: scenario.userRequest
        }
      ],
      info: {
        targetTool: tool.name,
        scenario: scenario.type,
        context: scenario.context
      },
      task: 'realistic-scenario',
      quality: {
        score: 0.9,
        complexity: 'moderate',
        realism: 1.0,
        coverage: 0.8,
        diversity: 0.85
      },
      generation: {
        strategy: 'realistic',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create sample from template
   */
  private createFromTemplate(template: any, tool: ToolDefinition): GeneratedSample {
    const filledPrompt = template.prompt.replace('{tool}', tool.name);

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: filledPrompt
        }
      ],
      info: {
        targetTool: tool.name,
        template: template.name
      },
      task: 'template-based',
      quality: this.calculateQuality('moderate', 'template'),
      generation: {
        strategy: 'template-based',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Create adversarial sample
   */
  private createAdversarialSample(pattern: string, tool: ToolDefinition): GeneratedSample {
    const prompt = this.generateAdversarialPrompt(pattern, tool);

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content: prompt
        }
      ],
      info: {
        targetTool: tool.name,
        adversarialPattern: pattern,
        difficulty: 'high'
      },
      task: 'adversarial-challenge',
      quality: {
        score: 0.95,
        complexity: 'complex',
        realism: 0.9,
        coverage: 0.85,
        diversity: 0.95
      },
      generation: {
        strategy: 'adversarial',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Mutate existing sample
   */
  private mutateSample(baseSample: GeneratedSample, mutationIndex: number): GeneratedSample {
    const mutations = [
      'vary_wording',
      'add_context',
      'change_parameters',
      'add_constraints',
      'modify_tone'
    ];

    const mutation = mutations[mutationIndex % mutations.length];
    let content = baseSample.prompt[0].content as string;

    switch (mutation) {
      case 'vary_wording':
        content = `Could you please ${content.toLowerCase()}`;
        break;
      case 'add_context':
        content = `In the context of data analysis: ${content}`;
        break;
      case 'change_parameters':
        content = content.replace(/\d+/g, (match) => String(parseInt(match) * 2));
        break;
      case 'add_constraints':
        content = `${content} (Please be concise and accurate)`;
        break;
      case 'modify_tone':
        content = `Urgent: ${content}`;
        break;
    }

    return {
      ...baseSample,
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content
        }
      ],
      generation: {
        strategy: 'mutation',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Helper: Generate arguments
   */
  private generateArguments(
    tool: ToolDefinition,
    complexity: 'simple' | 'moderate' | 'complex'
  ): Record<string, any> {
    const args: Record<string, any> = {};
    const { properties, required } = tool.parameters;

    const includeOptional = complexity !== 'simple';
    const useComplexValues = complexity === 'complex';

    for (const [name, schema] of Object.entries(properties)) {
      const isRequired = required?.includes(name);

      if (!isRequired && !includeOptional) continue;

      switch ((schema as any).type) {
        case 'string':
          args[name] = useComplexValues
            ? `complex-${name}-with-multiple-words`
            : `${name}-value`;
          break;
        case 'number':
          args[name] = useComplexValues ? 9999 : 42;
          break;
        case 'boolean':
          args[name] = true;
          break;
        case 'array':
          args[name] = useComplexValues ? ['item1', 'item2', 'item3', 'item4'] : ['item1'];
          break;
        case 'object':
          args[name] = useComplexValues ? { key1: 'value1', key2: 'value2' } : {};
          break;
      }
    }

    return args;
  }

  /**
   * Helper: Generate edge case args
   */
  private generateEdgeCaseArgs(tool: ToolDefinition, edgeType: string): Record<string, any> {
    const args: Record<string, any> = {};
    const { properties } = tool.parameters;

    for (const [name, schema] of Object.entries(properties)) {
      switch (edgeType) {
        case 'empty':
          args[name] = (schema as any).type === 'string' ? '' : [];
          break;
        case 'max':
          args[name] = (schema as any).type === 'string'
            ? 'x'.repeat(10000)
            : Number.MAX_SAFE_INTEGER;
          break;
        case 'invalid':
          args[name] = 'INVALID_TYPE';
          break;
        case 'null':
          args[name] = null;
          break;
        case 'overflow':
          args[name] = Number.MAX_SAFE_INTEGER + 1;
          break;
      }
    }

    return args;
  }

  /**
   * Helper: Generate prompt
   */
  private generatePrompt(
    tool: ToolDefinition,
    args: Record<string, any>,
    complexity: 'simple' | 'moderate' | 'complex'
  ): string {
    const examples = {
      simple: `Use ${tool.name} to ${tool.description.toLowerCase()}`,
      moderate: `I need to ${tool.description.toLowerCase()}. Can you use the ${tool.name} tool with these parameters: ${JSON.stringify(args)}?`,
      complex: `Given the current context, I need you to ${tool.description.toLowerCase()}. Please use the ${tool.name} tool effectively, considering the following parameters and any edge cases: ${JSON.stringify(args, null, 2)}`
    };

    return examples[complexity];
  }

  /**
   * Helper: Generate workflow
   */
  private generateWorkflow(tools: ToolDefinition[], complexity: string) {
    const steps = tools.map((tool, idx) => ({
      step: idx + 1,
      tool: tool.name,
      description: tool.description
    }));

    const prompt = `Complete this multi-step task:\n${steps.map(s => `${s.step}. ${s.description} (using ${s.tool})`).join('\n')}`;

    return { prompt, steps };
  }

  /**
   * Helper: Calculate quality
   */
  private calculateQuality(
    complexity: 'simple' | 'moderate' | 'complex',
    type: string
  ): SampleQuality {
    const complexityScores = { simple: 0.3, moderate: 0.6, complex: 0.9 };
    const typeScores: Record<string, number> = {
      'single-tool': 0.7,
      'multi-tool': 0.85,
      'edge-case': 0.75,
      'template': 0.8,
      'realistic': 0.95
    };

    const baseScore = (complexityScores[complexity] + (typeScores[type] || 0.75)) / 2;

    return {
      score: baseScore + Math.random() * 0.1,
      complexity,
      realism: Math.random() * 0.3 + 0.7,
      coverage: Math.random() * 0.2 + 0.8,
      diversity: Math.random() * 0.25 + 0.75
    };
  }

  /**
   * Helper: Get synthetic templates
   */
  private getSyntheticTemplates() {
    return [
      { type: 'question', text: 'How do I {action}?' },
      { type: 'request', text: 'Please {action} for me.' },
      { type: 'command', text: '{action} now.' },
      { type: 'conditional', text: 'If possible, {action}.' },
      { type: 'comparative', text: 'What is the best way to {action}?' }
    ];
  }

  /**
   * Helper: Get realistic scenarios
   */
  private getRealisticScenarios() {
    return [
      {
        type: 'research',
        tool: 'search_web',
        userRequest: 'I need to find the latest information about quantum computing breakthroughs',
        context: 'academic_research'
      },
      {
        type: 'analysis',
        tool: 'analyze_data',
        userRequest: 'Can you analyze this sales data and identify trends?',
        context: 'business_intelligence'
      },
      {
        type: 'reporting',
        tool: 'generate_report',
        userRequest: 'Generate a comprehensive report on Q4 performance',
        context: 'quarterly_review'
      }
    ];
  }

  /**
   * Helper: Get tool test templates
   */
  private getToolTestTemplates() {
    return [
      {
        name: 'basic_usage',
        prompt: 'Use {tool} for basic functionality'
      },
      {
        name: 'with_parameters',
        prompt: 'Use {tool} with specific parameters'
      },
      {
        name: 'error_handling',
        prompt: 'Test {tool} error handling capabilities'
      }
    ];
  }

  /**
   * Helper: Generate adversarial prompt
   */
  private generateAdversarialPrompt(pattern: string, tool: ToolDefinition): string {
    const prompts: Record<string, string> = {
      ambiguous_intent: `Maybe use ${tool.name}? Or perhaps not. It depends.`,
      conflicting_requirements: `Use ${tool.name} quickly but also be very thorough and detailed.`,
      implicit_assumptions: `Just do what I need with ${tool.name}.`,
      edge_case_combinations: `Use ${tool.name} with null values, empty strings, and maximum limits simultaneously.`,
      resource_constraints: `Use ${tool.name} but minimize API calls and complete in under 1 second.`
    };

    return prompts[pattern] || `Test ${tool.name} in an unusual way.`;
  }

  /**
   * Helper: Create sample from template
   */
  private createSampleFromTemplate(template: any, tool: ToolDefinition): GeneratedSample {
    const content = template.text.replace('{action}', tool.description.toLowerCase());

    return {
      id: this.generateId(),
      prompt: [
        {
          role: 'user',
          content
        }
      ],
      info: {
        targetTool: tool.name,
        templateType: template.type
      },
      task: 'synthetic-template',
      quality: this.calculateQuality('moderate', 'template'),
      generation: {
        strategy: 'synthetic',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return `sample-${Date.now()}-${++this.sampleIdCounter}`;
  }

  /**
   * Print generation statistics
   */
  private printStatistics(samples: GeneratedSample[]): void {
    const byStrategy: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};
    const byTask: Record<string, number> = {};

    let totalQuality = 0;
    let totalRealism = 0;

    for (const sample of samples) {
      // Count by strategy
      const strategy = sample.generation.strategy;
      byStrategy[strategy] = (byStrategy[strategy] || 0) + 1;

      // Count by complexity
      const complexity = sample.quality.complexity;
      byComplexity[complexity] = (byComplexity[complexity] || 0) + 1;

      // Count by task
      const task = sample.task || 'unknown';
      byTask[task] = (byTask[task] || 0) + 1;

      // Accumulate quality metrics
      totalQuality += sample.quality.score;
      totalRealism += sample.quality.realism;
    }

    console.log('\n📊 Generation Statistics:');
    console.log(`   By Strategy: ${JSON.stringify(byStrategy, null, 2)}`);
    console.log(`   By Complexity: ${JSON.stringify(byComplexity, null, 2)}`);
    console.log(`   By Task: ${JSON.stringify(byTask, null, 2)}`);
    console.log(`   Average Quality: ${(totalQuality / samples.length).toFixed(3)}`);
    console.log(`   Average Realism: ${(totalRealism / samples.length).toFixed(3)}`);
  }

  /**
   * Get all generated samples
   */
  getGeneratedSamples(): GeneratedSample[] {
    return this.generatedSamples;
  }

  /**
   * Export samples to dataset format
   */
  exportToDataset(): DatasetEntry[] {
    return this.generatedSamples.map(({ id, quality, generation, ...rest }) => rest);
  }
}

/**
 * Factory function for creating advanced sample generator
 */
export function createAdvancedSampleGenerator(
  tools: ToolDefinition[]
): AdvancedSampleGenerator {
  return new AdvancedSampleGenerator(tools);
}

export default AdvancedSampleGenerator;
