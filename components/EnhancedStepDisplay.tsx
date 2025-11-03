// Enhanced Step Display Component using prompt-kit Steps
// Displays multi-step execution with collapsible layout and visual hierarchy

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Steps,
  StepsTrigger,
  StepsContent,
  StepsItem,
  StepsBar,
} from '@/components/ui/steps';
import type { Message } from '../types';

interface EnhancedStepDisplayProps {
  messages: Message[];
  className?: string;
}

interface ParsedStep {
  stepNumber?: number;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details: string[];
  reasoning?: string;
  icon: string;
  duration?: number;
  timestamp?: number;
}

function parseStepMessage(content: string): ParsedStep | null {
  // Parse step messages with formats like:
  // "Step X: Action Name", "🖱️ Step X: Clicking Element", etc.
  
  const stepMatch = content.match(/(?:Step\s+(\d+):|(\d+)\.)\s*(.+?)(?:\n|$)/i);
  if (!stepMatch) return null;

  const stepNumber = parseInt(stepMatch[1] || stepMatch[2] || '0');
  const actionText = stepMatch[3]?.trim() || '';
  
  // Extract icon
  const iconMatch = content.match(/^([🔍🖱️⌨️⏳📜🔧✅❌🧠🌐📋])/);
  const icon = iconMatch ? iconMatch[1] : '•';

  // Determine status
  let status: 'pending' | 'running' | 'completed' | 'error' = 'pending';
  if (content.includes('Complete') || content.includes('✅')) status = 'completed';
  else if (content.includes('Failed') || content.includes('Error') || content.includes('❌')) status = 'error';
  else if (content.includes('Step') && !content.includes('Complete')) status = 'running';

  // Extract details (lines after the step header)
  const lines = content.split('\n').slice(1).filter(l => l.trim());
  const details = lines.slice(0, 5); // Limit to 5 details

  // Extract reasoning
  const reasoningMatch = content.match(/\*\*Reasoning:\*\*\s*([^\n]+)/i);
  const reasoning = reasoningMatch ? reasoningMatch[1] : undefined;

  // Extract duration
  const durationMatch = content.match(/(?:Duration|⏱️):\s*(\d+)ms/i);
  const duration = durationMatch ? parseInt(durationMatch[1]) : undefined;

  return {
    stepNumber,
    action: actionText || 'Processing...',
    status,
    details,
    reasoning,
    icon,
    duration,
    timestamp: Date.now(),
  };
}

// Track logged messages to avoid excessive logging
const loggedStepMessages = new Set<string>();

export const EnhancedStepDisplay: React.FC<EnhancedStepDisplayProps> = ({ 
  messages, 
  className 
}) => {
  // Filter and parse step messages
  const stepMessages = messages
    .filter(msg => msg.role === 'assistant' && (
      msg.content.includes('Step') || 
      msg.content.includes('Planning') ||
      msg.content.match(/^(🔍|🖱️|⌨️|⏳|📜|🔧|✅|❌|🧠|🌐|📋)/)
    ))
    .map(msg => parseStepMessage(msg.content))
    .filter((step): step is ParsedStep => step !== null);

  if (stepMessages.length === 0) {
    return null;
  }

  // Group steps by workflow run
  const workflowSteps = stepMessages.filter(s => s.stepNumber);
  const planningSteps = stepMessages.filter(s => !s.stepNumber && s.action.includes('Planning'));

  // Only log once per unique message set
  const logKey = messages.map(m => m.id).join('-');
  if (!loggedStepMessages.has(logKey)) {
    loggedStepMessages.add(logKey);
    console.log('📊 [EnhancedStepDisplay] Step hierarchy detected:', {
      totalSteps: stepMessages.length,
      planningSteps: planningSteps.length,
      executionSteps: workflowSteps.length,
    });
  }

  return (
    <div className={cn("rounded-xl border border-slate-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60", className)}>
      {/* Planning Phase */}
      {planningSteps.length > 0 && (
        <Steps defaultOpen={true} className="mb-3">
          <StepsTrigger className="text-foreground" leftIcon={<span>🧠</span>}>
            Planning Phase
          </StepsTrigger>
          <StepsContent bar={<StepsBar className="bg-slate-300/50 dark:bg-white/15" /> }>
            {planningSteps.map((step, idx) => (
              <StepsItem key={idx}>
                <div className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">{step.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{step.action}</div>
                    {step.reasoning && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {step.reasoning}
                      </div>
                    )}
                    {step.details.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {step.details[0]}
                      </div>
                    )}
                  </div>
                </div>
              </StepsItem>
            ))}
          </StepsContent>
        </Steps>
      )}

      {/* Execution Steps */}
      {workflowSteps.length > 0 && (
        <Steps defaultOpen={true}>
          <StepsTrigger className="text-foreground" leftIcon={<span>⚙️</span>}>
            Execution Steps ({workflowSteps.length} steps)
          </StepsTrigger>
          <StepsContent bar={<StepsBar className="bg-slate-300/50 dark:bg-white/15" /> }>
            {workflowSteps.map((step, idx) => (
              <StepsItem key={idx}>
                <div className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">
                    {step.status === 'completed' ? '✅' : 
                     step.status === 'error' ? '❌' : 
                     step.status === 'running' ? '⏳' : '•'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Step {step.stepNumber}: {step.action}
                      </span>
                      {step.duration && (
                        <span className="text-xs text-muted-foreground">
                          ({step.duration}ms)
                        </span>
                      )}
                    </div>
                    {step.reasoning && (
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        💭 {step.reasoning}
                      </div>
                    )}
                    {step.details.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {step.details.slice(0, 2).map((detail, dIdx) => (
                          <div key={dIdx}>• {detail}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </StepsItem>
            ))}
          </StepsContent>
        </Steps>
      )}
    </div>
  );
};
