// Workflow Visualization Component
// Displays browser automation workflow steps with chain of thought reasoning

import React from 'react';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from './chain-of-thought';
import type { Message } from '../types';

interface WorkflowStep {
  step: number;
  action: string;
  url?: string;
  success: boolean;
  timestamp: number;
  reasoning?: string;
  duration?: number;
}

interface WorkflowVisualizationProps {
  steps: WorkflowStep[];
  planningPhase?: {
    steps: number;
    complexity: number;
    confidence: number;
    duration: number;
  };
  currentStep?: number;
}

const StepIcon = ({ action }: { action: string }) => {
  const iconMap: { [key: string]: string } = {
    planning: '🧠',
    navigate: '🔷',
    getPageContext: '🔍',
    click: '🖱️',
    type_text: '⌨️',
    scroll: '📜',
    wait: '⏳',
    press_key: '⌨️',
    key_combo: '⌨️',
  };
  
  const icon = iconMap[action] || '🔧';
  return <span className="text-base">{icon}</span>;
};

export function WorkflowVisualization({ 
  steps, 
  planningPhase, 
  currentStep 
}: WorkflowVisualizationProps) {
  return (
    <div className="workflow-visualization p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        🔄 Workflow Execution
      </h3>
      
      <ChainOfThought>
        {/* Planning Phase */}
        {planningPhase && (
          <ChainOfThoughtStep defaultOpen={true}>
            <ChainOfThoughtTrigger leftIcon={<span>🧠</span>}>
              Planning Phase — {planningPhase.steps} steps planned ({(planningPhase.confidence * 100).toFixed(0)}% confidence)
            </ChainOfThoughtTrigger>
            <ChainOfThoughtContent>
              <ChainOfThoughtItem>
                <strong>Complexity:</strong> {(planningPhase.complexity * 100).toFixed(0)}%
              </ChainOfThoughtItem>
              <ChainOfThoughtItem>
                <strong>Estimated Steps:</strong> {planningPhase.steps}
              </ChainOfThoughtItem>
              <ChainOfThoughtItem>
                <strong>Duration:</strong> {planningPhase.duration}ms
              </ChainOfThoughtItem>
              <ChainOfThoughtItem className="mt-2 text-xs text-gray-500 italic">
                Plan generated using GEPA-optimized approach with fallback actions
              </ChainOfThoughtItem>
            </ChainOfThoughtContent>
          </ChainOfThoughtStep>
        )}
        
        {/* Execution Steps */}
        {steps.map((step, index) => {
          const isCurrentStep = currentStep === step.step;
          const isCompleted = !isCurrentStep && step.success;
          const statusIcon = isCompleted ? '✅' : isCurrentStep ? '⏳' : step.success ? '✅' : '❌';
          
          return (
            <ChainOfThoughtStep 
              key={step.step} 
              isLast={index === steps.length - 1}
              defaultOpen={isCurrentStep || index === steps.length - 1}
            >
              <ChainOfThoughtTrigger leftIcon={<StepIcon action={step.action} />}>
                Step {step.step}: {step.action} {statusIcon}
                {step.duration && ` (${step.duration}ms)`}
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                <ChainOfThoughtItem>
                  <strong>Action:</strong> {step.action}
                </ChainOfThoughtItem>
                {step.url && (
                  <ChainOfThoughtItem>
                    <strong>URL:</strong> <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{step.url}</code>
                  </ChainOfThoughtItem>
                )}
                <ChainOfThoughtItem>
                  <strong>Status:</strong> {step.success ? '✅ Success' : '❌ Failed'}
                </ChainOfThoughtItem>
                {step.duration && (
                  <ChainOfThoughtItem>
                    <strong>Duration:</strong> {step.duration}ms
                  </ChainOfThoughtItem>
                )}
                {step.reasoning && (
                  <ChainOfThoughtItem className="mt-2 p-2 bg-blue-50 rounded text-xs">
                    <strong className="block mb-1">💭 Reasoning:</strong>
                    {step.reasoning}
                  </ChainOfThoughtItem>
                )}
                <ChainOfThoughtItem className="text-xs text-gray-400">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </ChainOfThoughtItem>
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
          );
        })}
      </ChainOfThought>
    </div>
  );
}

// Helper to parse workflow steps from messages
export function parseWorkflowSteps(messages: Message[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  let stepCounter = 0;
  
  messages.forEach(msg => {
    if (msg.role !== 'assistant') return;
    
    // Parse step messages
    const stepMatch = msg.content.match(/\*\*Step (\d+):\s*([^*]+)\*\*/);
    if (stepMatch) {
      stepCounter++;
      const [, stepNum, action] = stepMatch;
      
      // Extract URL
      const urlMatch = msg.content.match(/\*\*(?:URL|New URL):\*\*\s*([^\n]+)/);
      
      // Extract duration
      const durationMatch = msg.content.match(/⏱️\s*Duration:\s*(\d+)ms/);
      
      // Extract reasoning
      const reasoningMatch = msg.content.match(/\*\*Reasoning:\*\*\s*([^\n]+)/);
      
      // Determine success
      const success = msg.content.includes('✅') || msg.content.includes('Complete');
      
      steps.push({
        step: parseInt(stepNum, 10),
        action: action.trim(),
        url: urlMatch ? urlMatch[1].trim() : undefined,
        success,
        timestamp: Date.now(),
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined,
        duration: durationMatch ? parseInt(durationMatch[1], 10) : undefined,
      });
    }
  });
  
  return steps;
}

