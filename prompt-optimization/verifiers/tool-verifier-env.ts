/**
 * Tool Verifier Environment
 * Extended Verifiers environment for sample expansion and tool validation
 *
 * Key Features:
 * - Automatic sample generation from tool definitions
 * - Parallel tool call validation
 * - Structured output verification
 * - Integration with GEPA's reflection pipeline
 *
 * Sample Generation Strategies:
 * 1. Combinatorial: Test all tool combinations
 * 2. Synthetic: LLM-generated scenarios
 * 3. Mutation: Variants of existing samples
 * 4. Edge Cases: Boundary condition testing
 */

import type {
  ToolDefinition,
  DatasetEntry,
  RubricConfig,
  RubricFunction,
  ToolEnvConfig,
  ToolRubricConfig,
  ToolValidationResult,
  SampleGenerationConfig,
  EvaluationResult,
  ChatMessage,
  ToolCall
} from './types';
import { createGEPAEngine, type GEPAEvaluationResult } from './gepa-engine';

/**
 * Tool Verifier Environment
 * Extends Verifiers framework with sample expansion capabilities
 */
export class ToolVerifierEnv {
  private tools: ToolDefinition[];
  private rubricConfig: RubricConfig;
  private toolRubricConfig: ToolRubricConfig;
  private maxTurns: number;
  private generatedSamples: DatasetEntry[] = [];
  private gepaEngine: ReturnType<typeof createGEPAEngine> | null = null;

  constructor(config: {
    tools: ToolDefinition[];
    rubric?: RubricConfig;
    toolRubric?: ToolRubricConfig;
    maxTurns?: number;
  }) {
    this.tools = config.tools;
    this.maxTurns = config.maxTurns || 10;

    // Default tool rubric: count tool invocations
    this.toolRubricConfig = config.toolRubric || {
      exactMatch: true,
      incorrectPenalty: -0.5
    };

    // Default rubric with tool counting
    this.rubricConfig = config.rubric || {
      funcs: [this.createToolCountRubric()],
      weights: [1.0]
    };
  }

  /**
   * Create tool count rubric function
   */
  private createToolCountRubric(): RubricFunction {
    return (prompt, completion, answer, info, state) => {
      const toolCalls = this.extractToolCalls(completion);

      if (this.toolRubricConfig.exactMatch && this.toolRubricConfig.expectedCalls) {
        return toolCalls.length === this.toolRubricConfig.expectedCalls
          ? 1.0
          : this.toolRubricConfig.incorrectPenalty || 0.0;
      }

      // Reward proportional to tool usage
      return Math.min(toolCalls.length / (this.maxTurns / 2), 1.0);
    };
  }

  /**
   * Extract tool calls from completion messages
   */
  private extractToolCalls(messages: ChatMessage[]): ToolCall[] {
    const calls: ToolCall[] = [];

    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        calls.push(...msg.toolCalls);
      }
    }

    return calls;
  }

  /**
   * Generate samples from tool definitions
   */
  async generateSamples(config: SampleGenerationConfig): Promise<DatasetEntry[]> {
    console.log('🔄 Generating samples...');
    console.log(`   Strategy: ${config.strategy}`);
    console.log(`   Count: ${config.count}`);

    const samples: DatasetEntry[] = [];

    switch (config.strategy) {
      case 'combinatorial':
        samples.push(...(await this.generateCombinatorialSamples(config)));
        break;

      case 'synthetic':
        samples.push(...(await this.generateSyntheticSamples(config)));
        break;

      case 'mutation':
        samples.push(...(await this.generateMutationSamples(config)));
        break;

      case 'edge-cases':
        samples.push(...(await this.generateEdgeCaseSamples(config)));
        break;
    }

    this.generatedSamples.push(...samples);
    console.log(`✅ Generated ${samples.length} samples`);

    return samples;
  }

  /**
   * Generate combinatorial samples (all tool combinations)
   */
  private async generateCombinatorialSamples(
    config: SampleGenerationConfig
  ): Promise<DatasetEntry[]> {
    const samples: DatasetEntry[] = [];
    const tools = config.tools || this.tools;

    // Single tool samples
    for (const tool of tools) {
      const sample = this.createSampleForTool(tool);
      samples.push(sample);

      if (samples.length >= config.count) break;
    }

    // Multi-tool combinations
    if (samples.length < config.count && tools.length > 1) {
      for (let i = 0; i < tools.length && samples.length < config.count; i++) {
        for (let j = i + 1; j < tools.length && samples.length < config.count; j++) {
          const sample = this.createSampleForTools([tools[i], tools[j]]);
          samples.push(sample);
        }
      }
    }

    return samples.slice(0, config.count);
  }

  /**
   * Generate synthetic samples using LLM
   */
  private async generateSyntheticSamples(
    config: SampleGenerationConfig
  ): Promise<DatasetEntry[]> {
    console.log('🧠 Generating synthetic samples with LLM...');
    
    const samples: DatasetEntry[] = [];
    const baseTools = config.tools || this.tools;
    
    // Create diverse scenarios for each tool
    for (const tool of baseTools) {
      if (samples.length >= config.count) break;
      
      // Generate scenarios using LLM
      const scenarios = await this.generateToolScenarios(tool, Math.ceil(config.count / baseTools.length));
      
      for (const scenario of scenarios) {
        if (samples.length >= config.count) break;
        
        const sample = await this.createSampleFromScenario(tool, scenario);
        if (sample) {
          samples.push(sample);
        }
      }
    }
    
    return samples;
  }

  /**
   * Generate diverse scenarios for a tool using LLM
   */
  private async generateToolScenarios(
    tool: ToolDefinition,
    count: number
  ): Promise<string[]> {
    const scenarios: string[] = [];
    
    try {
      // Create diverse scenario prompts
      const scenarioPrompts = [
        `Generate a realistic user request that would naturally require using the ${tool.name} tool. The request should be specific and actionable.`,
        `Create a business scenario where ${tool.name} would be the most appropriate solution.`,
        `Generate a troubleshooting scenario where ${tool.name} would help resolve an issue.`,
        `Create a research scenario that necessitates using ${tool.name}.`,
        `Generate a workflow scenario where ${tool.name} is the critical step.`
      ];
      
      // TODO: Replace with actual LLM call
      // For now, generate scenarios based on tool characteristics
      for (let i = 0; i < count; i++) {
        const scenario = this.generateScenarioFromTool(tool, i);
        scenarios.push(scenario);
      }
      
      console.log(`✅ Generated ${scenarios.length} synthetic scenarios for ${tool.name}`);
      
    } catch (error) {
      console.warn('LLM scenario generation failed, using fallback:', error);
      
      // Fallback to rule-based scenario generation
      for (let i = 0; i < count; i++) {
        const scenario = this.generateFallbackScenario(tool, i);
        scenarios.push(scenario);
      }
    }
    
    return scenarios;
  }

  /**
   * Generate scenario from tool characteristics
   */
  private generateScenarioFromTool(tool: ToolDefinition, index: number): string {
    const scenarios = {
      navigate: [
        "Navigate to the company dashboard to check project status",
        "Go to the product page to get pricing information",
        "Visit the documentation site to find installation instructions",
        "Navigate to the blog to read the latest article",
        "Go to the support page to find contact information"
      ],
      click: [
        "Click on the main navigation menu to access different sections",
        "Click the login button to start the authentication process", 
        "Click on the user profile icon to access account settings",
        "Click the filter button to narrow down search results",
        "Click the download button to save the report"
      ],
      type_text: [
        "Enter the search term 'machine learning tutorials' in the search box",
        "Type the email address 'john.doe@company.com' in the contact form",
        "Enter the product name 'Wireless Headphones' in the search field",
        "Fill in the shipping address with '123 Main St, New York, NY 10001'",
        "Type the job title 'Senior Software Engineer' in the position field"
      ],
      scroll: [
        "Scroll down to see more product reviews",
        "Scroll up to return to the top of the page after reading an article",
        "Scroll down to find the footer information",
        "Scroll down to see additional search results",
        "Scroll to the bottom of the page to find the subscribe button"
      ]
    };
    
    const toolScenarios = scenarios[tool.name as keyof typeof scenarios] || [
      `Use ${tool.name} to accomplish a common web interaction task`,
      `Utilize ${tool.name} as part of a multi-step workflow`,
      `Apply ${tool.name} to solve a specific user problem`,
      `Use ${tool.name} in a business context`,
      `Apply ${tool.name} for research or information gathering`
    ];
    
    return toolScenarios[index % toolScenarios.length];
  }

  /**
   * Generate fallback scenario for when LLM is unavailable
   */
  private generateFallbackScenario(tool: ToolDefinition, index: number): string {
    const baseScenarios = [
      `Complete a standard web task using ${tool.name}`,
      `Perform a business operation with ${tool.name}`,
      `Gather information using ${tool.name}`,
      `Navigate through a workflow with ${tool.name}`,
      `Access specific content using ${tool.name}`,
      `Perform data entry using ${tool.name}`,
      `Search and retrieve information with ${tool.name}`,
      `Interact with a web interface using ${tool.name}`,
      `Complete a form or registration process with ${tool.name}`,
      `Access user account features using ${tool.name}`
    ];
    
    return baseScenarios[index % baseScenarios.length];
  }

  /**
   * Create a dataset entry from a scenario
   */
  private async createSampleFromScenario(
    tool: ToolDefinition,
    scenario: string
  ): Promise<DatasetEntry | null> {
    try {
      const exampleArgs = this.generateExampleArguments(tool);
      const expectedToolCall = {
        id: 'call-1',
        type: 'function',
        function: {
          name: tool.name,
          arguments: JSON.stringify(exampleArgs)
        }
      };

      return {
        prompt: [
          {
            role: 'user',
            content: scenario
          }
        ],
        answer: JSON.stringify({
          role: 'assistant',
          content: `I will use the ${tool.name} tool to accomplish this task.`,
          toolCalls: [expectedToolCall]
        }),
        info: {
          targetTool: tool.name,
          exampleArgs,
          expectedToolCalls: [expectedToolCall],
          scenario,
          generated: true
        },
        task: 'synthetic-scenario'
      };
    } catch (error) {
      console.warn('Failed to create sample from scenario:', error);
      return null;
    }
  }

  /**
   * Generate mutation samples (variants of existing)
   */
  private async generateMutationSamples(
    config: SampleGenerationConfig
  ): Promise<DatasetEntry[]> {
    const sourceSamples = config.sourceSamples || this.generatedSamples;
    if (sourceSamples.length === 0) {
      throw new Error('No source samples for mutation');
    }

    const samples: DatasetEntry[] = [];
    const mutationsPerSample = Math.ceil(config.count / sourceSamples.length);

    for (const source of sourceSamples) {
      for (let m = 0; m < mutationsPerSample && samples.length < config.count; m++) {
        const mutated = this.mutateSample(source, config.diversity || 0.3);
        samples.push(mutated);
      }
    }

    return samples.slice(0, config.count);
  }

  /**
   * Generate edge case samples
   */
  private async generateEdgeCaseSamples(
    config: SampleGenerationConfig
  ): Promise<DatasetEntry[]> {
    const samples: DatasetEntry[] = [];

    for (const tool of this.tools) {
      // Empty parameters
      samples.push(this.createEdgeCaseSample(tool, 'empty'));

      // Maximum parameters
      samples.push(this.createEdgeCaseSample(tool, 'max'));

      // Invalid parameters
      samples.push(this.createEdgeCaseSample(tool, 'invalid'));

      if (samples.length >= config.count) break;
    }

    return samples.slice(0, config.count);
  }

  /**
   * Create sample for a single tool
   */
  private createSampleForTool(tool: ToolDefinition): DatasetEntry {
    const exampleArgs = this.generateExampleArguments(tool);
    const expectedToolCall = {
      id: 'call-1',
      type: 'function',
      function: {
        name: tool.name,
        arguments: JSON.stringify(exampleArgs)
      }
    };

    return {
      prompt: [
        {
          role: 'user',
          content: `Use the ${tool.name} tool to: ${tool.description}\n\nExample: ${JSON.stringify(exampleArgs)}`
        }
      ],
      answer: JSON.stringify({
        role: 'assistant',
        content: `I will use the ${tool.name} tool.`,
        toolCalls: [expectedToolCall]
      }),
      info: {
        targetTool: tool.name,
        exampleArgs,
        expectedToolCalls: [expectedToolCall]
      },
      task: 'tool-usage'
    };
  }

  /**
   * Create sample for multiple tools
   */
  private createSampleForTools(tools: ToolDefinition[]): DatasetEntry {
    const descriptions = tools.map(t => `${t.name}: ${t.description}`).join('\n- ');
    const expectedToolCalls = tools.map((tool, idx) => ({
      id: `call-${idx + 1}`,
      type: 'function',
      function: {
        name: tool.name,
        arguments: JSON.stringify(this.generateExampleArguments(tool))
      }
    }));

    return {
      prompt: [
        {
          role: 'user',
          content: `Complete this task using the following tools:\n- ${descriptions}\n\nUse the tools in sequence to accomplish the goal.`
        }
      ],
      answer: JSON.stringify({
        role: 'assistant',
        content: `I will use the tools in sequence: ${tools.map(t => t.name).join(', ')}.`,
        toolCalls: expectedToolCalls
      }),
      info: {
        targetTools: tools.map(t => t.name),
        multiTool: true,
        expectedToolCalls
      },
      task: 'multi-tool-workflow'
    };
  }

  /**
   * Generate example arguments for a tool
   */
  private generateExampleArguments(tool: ToolDefinition): Record<string, any> {
    const args: Record<string, any> = {};
    const { properties, required } = tool.parameters;

    for (const [name, schema] of Object.entries(properties)) {
      const isRequired = required?.includes(name);

      switch ((schema as any).type) {
        case 'string':
          args[name] = isRequired ? `example-${name}` : undefined;
          break;
        case 'number':
          args[name] = isRequired ? 42 : undefined;
          break;
        case 'boolean':
          args[name] = isRequired ? true : undefined;
          break;
        case 'array':
          args[name] = isRequired ? ['item1', 'item2'] : undefined;
          break;
        case 'object':
          args[name] = isRequired ? {} : undefined;
          break;
      }
    }

    // Remove undefined values
    return Object.fromEntries(Object.entries(args).filter(([_, v]) => v !== undefined));
  }

  /**
   * Mutate a sample
   */
  private mutateSample(
    sample: DatasetEntry,
    diversity: number
  ): DatasetEntry {
    const mutated = { ...sample };

    if (mutated.prompt) {
      mutated.prompt = mutated.prompt.map(msg => ({
        ...msg,
        content:
          typeof msg.content === 'string'
            ? this.mutateText(msg.content, diversity)
            : msg.content
      }));
    }

    return mutated;
  }

  /**
   * Mutate text content
   */
  private mutateText(text: string, diversity: number): string {
    // Simple mutation: add variation suffix
    const variations = [
      'Please help with this.',
      'Can you assist?',
      'I need help with this task.',
      'Could you handle this?'
    ];

    if (Math.random() < diversity) {
      const variation = variations[Math.floor(Math.random() * variations.length)];
      return `${text} ${variation}`;
    }

    return text;
  }

  /**
   * Create edge case sample
   */
  private createEdgeCaseSample(
    tool: ToolDefinition,
    caseType: 'empty' | 'max' | 'invalid'
  ): DatasetEntry {
    let args: Record<string, any> = {};

    switch (caseType) {
      case 'empty':
        // Only required parameters
        args = this.generateExampleArguments(tool);
        break;

      case 'max':
        // All parameters with maximum values
        args = this.generateMaxArguments(tool);
        break;

      case 'invalid':
        // Invalid parameter types
        args = this.generateInvalidArguments(tool);
        break;
    }

    // For edge cases, the expected behavior might be an error or graceful handling
    const expectedToolCall = {
      id: 'call-1',
      type: 'function',
      function: {
        name: tool.name,
        arguments: JSON.stringify(args)
      }
    };

    return {
      prompt: [
        {
          role: 'user',
          content: `Test ${tool.name} with ${caseType} parameters: ${JSON.stringify(args)}`
        }
      ],
      answer: JSON.stringify({
        role: 'assistant',
        content: `I will test the ${tool.name} tool with ${caseType} parameters.`,
        toolCalls: [expectedToolCall]
      }),
      info: {
        targetTool: tool.name,
        edgeCase: caseType,
        args,
        expectedToolCalls: [expectedToolCall]
      },
      task: 'tool-edge-case'
    };
  }

  /**
   * Generate maximum arguments
   */
  private generateMaxArguments(tool: ToolDefinition): Record<string, any> {
    const args: Record<string, any> = {};
    const { properties } = tool.parameters;

    for (const [name, schema] of Object.entries(properties)) {
      switch ((schema as any).type) {
        case 'string':
          args[name] = 'x'.repeat(1000);
          break;
        case 'number':
          args[name] = Number.MAX_SAFE_INTEGER;
          break;
        case 'boolean':
          args[name] = true;
          break;
        case 'array':
          args[name] = Array(100).fill('item');
          break;
      }
    }

    return args;
  }

  /**
   * Generate invalid arguments
   */
  private generateInvalidArguments(tool: ToolDefinition): Record<string, any> {
    const args: Record<string, any> = {};
    const { properties } = tool.parameters;

    for (const [name, schema] of Object.entries(properties)) {
      // Intentionally wrong types
      switch ((schema as any).type) {
        case 'string':
          args[name] = 12345; // number instead of string
          break;
        case 'number':
          args[name] = 'not-a-number';
          break;
        case 'boolean':
          args[name] = 'yes'; // string instead of boolean
          break;
      }
    }

    return args;
  }

  /**
   * Validate tool usage in execution
   */
  validateToolUsage(
    prompt: ChatMessage[],
    completion: ChatMessage[]
  ): ToolValidationResult {
    const toolCalls = this.extractToolCalls(completion);
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    // Validate each tool call
    for (const call of toolCalls) {
      const tool = this.tools.find(t => t.name === call.function.name);

      if (!tool) {
        errors.push(`Unknown tool: ${call.function.name}`);
        score -= 0.2;
        continue;
      }

      // Validate arguments
      try {
        const args = JSON.parse(call.function.arguments);
        const validation = this.validateToolArguments(tool, args);

        if (!validation.valid) {
          errors.push(...validation.errors);
          score -= 0.1 * validation.errors.length;
        }

        warnings.push(...validation.warnings);
      } catch (error: any) {
        errors.push(`Invalid JSON arguments: ${error.message}`);
        score -= 0.2;
      }
    }

    // Check for expected tools (if configured)
    if (this.toolRubricConfig.toolNames) {
      const calledTools = toolCalls.map(c => c.function.name);
      const missing = this.toolRubricConfig.toolNames.filter(
        t => !calledTools.includes(t)
      );

      if (missing.length > 0) {
        warnings.push(`Missing expected tools: ${missing.join(', ')}`);
        score -= 0.1 * missing.length;
      }
    }

    return {
      valid: errors.length === 0,
      toolCalls,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(
    tool: ToolDefinition,
    args: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { properties, required } = tool.parameters;

    // Check required parameters
    for (const req of required || []) {
      if (!(req in args)) {
        errors.push(`Missing required parameter: ${req}`);
      }
    }

    // Check parameter types
    for (const [name, value] of Object.entries(args)) {
      const schema = properties[name];

      if (!schema) {
        warnings.push(`Unknown parameter: ${name}`);
        continue;
      }

      const expectedType = (schema as any).type;
      const actualType = Array.isArray(value)
        ? 'array'
        : typeof value;

      if (expectedType !== actualType) {
        errors.push(
          `Type mismatch for ${name}: expected ${expectedType}, got ${actualType}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create dataset from generated samples
   */
  createDataset(): DatasetEntry[] {
    return this.generatedSamples;
  }

  /**
   * Get tool environment configuration
   */
  getToolEnvConfig(): ToolEnvConfig {
    return {
      type: 'tool',
      dataset: this.generatedSamples,
      rubric: this.rubricConfig,
      tools: this.tools,
      maxTurns: this.maxTurns,
      parallelToolCalls: true
    };
  }

  /**
   * Evaluate samples using GEPA engine
   */
  async evaluateSamplesWithGEPA(
    prompt: string,
    apiKey?: string
  ): Promise<GEPAEvaluationResult | null> {
    if (this.generatedSamples.length === 0) {
      return null;
    }

    // Initialize GEPA engine if not already done
    if (!this.gepaEngine) {
      this.gepaEngine = createGEPAEngine({
        maxRollouts: 5,
        batchSize: 3,
        reflectionModel: 'https://openrouter.ai/minimax/minimax-m2:free',
        taskModel: 'https://build.nvidia.com/minimaxai/minimax-m2/modelcard',
        metrics: ['accuracy', 'efficiency', 'completeness']
      });
    }

    // Convert samples to TrainingExample format
    const trainingExamples = this.generatedSamples.map(sample => ({
      id: `sample-${Math.random().toString(36).substr(2, 9)}`,
      input: sample.prompt,
      output: sample.answer || '',
      metadata: sample.info
    }));

    return this.gepaEngine.evaluatePrompt(prompt, trainingExamples, apiKey);
  }

  /**
   * Get statistics about generated samples
   */
  getStatistics(): {
    totalSamples: number;
    byTask: Record<string, number>;
    byTool: Record<string, number>;
    edgeCases: number;
  } {
    const stats = {
      totalSamples: this.generatedSamples.length,
      byTask: {} as Record<string, number>,
      byTool: {} as Record<string, number>,
      edgeCases: 0
    };

    for (const sample of this.generatedSamples) {
      // Count by task
      const task = sample.task || 'unknown';
      stats.byTask[task] = (stats.byTask[task] || 0) + 1;

      // Count by tool
      const targetTool = sample.info?.targetTool;
      if (targetTool) {
        stats.byTool[targetTool] = (stats.byTool[targetTool] || 0) + 1;
      }

      // Count edge cases
      if (sample.info?.edgeCase) {
        stats.edgeCases++;
      }
    }

    return stats;
  }
}

/**
 * Factory function for creating ToolVerifierEnv
 */
export function createToolVerifierEnv(
  tools: ToolDefinition[],
  options?: {
    maxTurns?: number;
    exactMatch?: boolean;
    expectedCalls?: number;
  }
): ToolVerifierEnv {
  return new ToolVerifierEnv({
    tools,
    maxTurns: options?.maxTurns || 10,
    toolRubric: {
      exactMatch: options?.exactMatch ?? true,
      expectedCalls: options?.expectedCalls
    }
  });
}

export default ToolVerifierEnv;