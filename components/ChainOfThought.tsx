// Chain of Thought UI Component
// Displays collapsible step-by-step reasoning and execution

import React from 'react';

export interface ChainOfThoughtItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const ChainOfThoughtItem = ({ children, className, ...props }: ChainOfThoughtItemProps) => (
  <div className={`text-gray-600 dark:text-gray-400 text-sm ${className || ''}`} {...props}>
    {children}
  </div>
);

export interface ChainOfThoughtTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  leftIcon?: React.ReactNode;
  isOpen?: boolean;
  onClick?: () => void;
}

export const ChainOfThoughtTrigger = ({ 
  children, 
  className, 
  leftIcon,
  isOpen = false,
  onClick,
  ...props 
}: ChainOfThoughtTriggerProps) => (
  <button
    type="button"
    className={`group text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex cursor-pointer items-center justify-start gap-2 text-sm transition-colors w-full text-left ${className || ''}`}
    onClick={onClick}
    {...props}
  >
    <div className="flex items-center gap-2">
      {leftIcon && (
        <span className="relative inline-flex items-center justify-center">
          {leftIcon}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </div>
    <svg
      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
);

export interface ChainOfThoughtContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
}

export const ChainOfThoughtContent = ({ 
  children, 
  className,
  isOpen = false,
  ...props 
}: ChainOfThoughtContentProps) => {
  if (!isOpen) return null;
  
  return (
    <div
      className={`overflow-hidden ${className || ''}`}
      {...props}
    >
      <div className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-4">
        <div className="ml-2 h-full w-px bg-blue-200 dark:bg-blue-800" />
        <div className="mt-2 space-y-2 pb-2">{children}</div>
      </div>
    </div>
  );
};

export interface ChainOfThoughtStepProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  isLast?: boolean;
  defaultOpen?: boolean;
}

export const ChainOfThoughtStep = ({ 
  children, 
  className,
  isLast = false,
  defaultOpen = false,
  ...props 
}: ChainOfThoughtStepProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  
  // Extract trigger and content from children
  const childrenArray = React.Children.toArray(children);
  const trigger = childrenArray.find((child: any) => child?.type?.name === 'ChainOfThoughtTrigger');
  const content = childrenArray.find((child: any) => child?.type?.name === 'ChainOfThoughtContent');
  const otherChildren = childrenArray.filter((child: any) => 
    child?.type?.name !== 'ChainOfThoughtTrigger' && child?.type?.name !== 'ChainOfThoughtContent'
  );
  
  return (
    <div
      className={`group ${className || ''}`}
      data-last={isLast}
      {...props}
    >
      {trigger && React.cloneElement(trigger as React.ReactElement, { 
        isOpen,
        onClick: () => setIsOpen(!isOpen),
      })}
      {content && React.cloneElement(content as React.ReactElement, { isOpen })}
      {otherChildren}
      {!isLast && (
        <div className="flex justify-start">
          <div className="ml-2 h-4 w-px bg-blue-200 dark:bg-blue-800" />
        </div>
      )}
    </div>
  );
};

export interface ChainOfThoughtProps {
  children: React.ReactNode;
  className?: string;
}

export function ChainOfThought({ children, className }: ChainOfThoughtProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={`space-y-0 ${className || ''}`}>
      {childrenArray.map((child, index) => (
        <React.Fragment key={index}>
          {React.isValidElement(child) &&
            React.cloneElement(child as React.ReactElement<ChainOfThoughtStepProps>, {
              isLast: index === childrenArray.length - 1,
            })}
        </React.Fragment>
      ))}
    </div>
  );
}

