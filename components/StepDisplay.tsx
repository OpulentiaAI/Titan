// Step Display Component - Renders workflow steps with Chain of Thought UI

import React from 'react';
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from '@/components/ui/chain-of-thought';

interface StepMessage {
  id: string;
  role: string;
  content: string;
}

interface StepDisplayProps {
  messages: StepMessage[];
  className?: string;
}

// Parse step information from message content
function parseStep(content: string): {
  stepNumber?: number;
  stepType: 'planning' | 'navigation' | 'click' | 'type' | 'scroll' | 'wait' | 'analyze' | 'key' | 'reasoning' | 'summary' | 'other';
  title: string;
  details: string[];
  icon: string;
  isComplete: boolean;
} {
  const isComplete = content.includes('✅') || content.includes('Complete');
  const stepMatch = content.match(/\*\*Step (\d+):/);
  const stepNumber = stepMatch ? parseInt(stepMatch[1]) : undefined;
  
  let stepType: any = 'other';
  let icon = '🔷';
  
  if (content.includes('Planning')) {
    stepType = 'planning';
    icon = '🧠';
  } else if (content.includes('Navigating') || content.includes('Navigation')) {
    stepType = 'navigation';
    icon = '🔷';
  } else if (content.includes('Clicking') || content.includes('Click')) {
    stepType = 'click';
    icon = '🖱️';
  } else if (content.includes('Typing') || content.includes('Type')) {
    stepType = 'type';
    icon = '⌨️';
  } else if (content.includes('Scrolling') || content.includes('Scroll')) {
    stepType = 'scroll';
    icon = '📜';
  } else if (content.includes('Waiting') || content.includes('Wait')) {
    stepType = 'wait';
    icon = '⏳';
  } else if (content.includes('Analyzing') || content.includes('Analysis')) {
    stepType = 'analyze';
    icon = '🔍';
  } else if (content.includes('Key') || content.includes('Pressing')) {
    stepType = 'key';
    icon = '⌨️';
  } else if (content.includes('Reasoning')) {
    stepType = 'reasoning';
    icon = '💭';
  } else if (content.includes('Summary')) {
    stepType = 'summary';
    icon = '📋';
  }
  
  // Extract title (first line) and remove emojis from title
  const lines = content.split('\n').filter(l => l.trim());
  const rawTitle = lines[0]?.replace(/\*\*/g, '').replace(/#{1,6}\s/, '') || 'Step';
  // Remove emoji from title since we'll show it separately
  const title = rawTitle.replace(/^[🔷🔍🖱️⌨️📜⏳💭📋🧠]\s*/, '');
  
  // Extract details (remaining lines) and clean up markdown
  const details = lines.slice(1)
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !l.startsWith('**Reasoning:**')); // Reasoning is shown separately
  
  return {
    stepNumber,
    stepType,
    title,
    details,
    icon,
    isComplete,
  };
}

export const StepDisplay: React.FC<StepDisplayProps> = ({ messages, className }) => {
  // Filter only step-related messages
  const stepMessages = messages.filter(msg => 
    msg.role === 'assistant' && (
      msg.content.includes('Step') || 
      msg.content.includes('Planning') ||
      msg.content.includes('Reasoning')
    )
  );

  if (stepMessages.length === 0) {
    return null;
  }

  return (
    <div className={`my-2 ${className || ''}`}>
      <ChainOfThought>
        {stepMessages.map((msg, index) => {
          const parsed = parseStep(msg.content);
          
          // Extract reasoning from content
          const reasoningMatch = msg.content.match(/\*\*Reasoning:\*\*\s*([^\n]+)/);
          const reasoning = reasoningMatch ? reasoningMatch[1] : null;
          
          return (
            <ChainOfThoughtStep 
              key={msg.id} 
              isLast={index === stepMessages.length - 1}
              defaultOpen={!parsed.isComplete || index === stepMessages.length - 1}
            >
              <ChainOfThoughtTrigger 
                leftIcon={<span style={{ fontSize: '16px' }}>{parsed.icon}</span>}
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{parsed.title}</span>
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                {reasoning && (
                  <ChainOfThoughtItem>
                    <strong style={{ fontSize: '12px' }}>Reasoning:</strong>{' '}
                    <span style={{ fontSize: '12px' }}>{reasoning}</span>
                  </ChainOfThoughtItem>
                )}
                {parsed.details.slice(0, 5).map((detail, idx) => (
                  <ChainOfThoughtItem key={idx} style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
                    {detail}
                  </ChainOfThoughtItem>
                ))}
                {parsed.details.length === 0 && !reasoning && (
                  <ChainOfThoughtItem style={{ fontSize: '12px', fontStyle: 'italic', color: '#888' }}>
                    Processing...
                  </ChainOfThoughtItem>
                )}
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
          );
        })}
      </ChainOfThought>
    </div>
  );
};

