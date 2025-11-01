// Chain of Thought UI Component
// Displays step-by-step reasoning and collapsible thought processes

import React from 'react';

export interface ChainOfThoughtItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChainOfThoughtItem = ({
  children,
  className = '',
  ...props
}: ChainOfThoughtItemProps) => (
  <div 
    className={`text-gray-600 text-sm leading-relaxed ${className}`} 
    {...props}
  >
    {children}
  </div>
);

export interface ChainOfThoughtTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  leftIcon?: React.ReactNode;
  swapIconOnHover?: boolean;
  isOpen?: boolean;
}

export const ChainOfThoughtTrigger = ({
  children,
  className = '',
  leftIcon,
  swapIconOnHover = true,
  isOpen = false,
  onClick,
  ...props
}: ChainOfThoughtTriggerProps) => (
  <button
    className={`group text-gray-600 hover:text-gray-900 flex cursor-pointer items-center justify-start gap-2 text-sm transition-colors w-full text-left ${className}`}
    onClick={onClick}
    {...props}
  >
    <div className="flex items-center gap-2">
      {leftIcon && (
        <span className="relative inline-flex size-4 items-center justify-center">
          {leftIcon}
        </span>
      )}
      {!leftIcon && (
        <span className="relative inline-flex size-2 items-center justify-center">
          <span className="size-2 rounded-full bg-blue-500" />
        </span>
      )}
      <span className="flex-1">{children}</span>
    </div>
    <svg 
      className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
);

export interface ChainOfThoughtContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean;
}

export const ChainOfThoughtContent = ({
  children,
  className = '',
  isOpen = false,
  ...props
}: ChainOfThoughtContentProps) => {
  if (!isOpen) return null;
  
  return (
    <div
      className={`overflow-hidden transition-all ${className}`}
      {...props}
    >
      <div className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-4 mt-2">
        <div className="bg-blue-200 ml-2 w-px" style={{ height: '100%' }} />
        <div className="space-y-2 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
};

export interface ChainOfThoughtStepProps extends React.HTMLAttributes<HTMLDivElement> {
  isLast?: boolean;
  defaultOpen?: boolean;
}

export const ChainOfThoughtStep = ({
  children,
  className = '',
  isLast = false,
  defaultOpen = false,
  ...props
}: ChainOfThoughtStepProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  
  // Clone children to pass isOpen state
  const enhancedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      if (child.type === ChainOfThoughtTrigger) {
        return React.cloneElement(child as any, {
          isOpen,
          onClick: () => setIsOpen(!isOpen),
        });
      }
      if (child.type === ChainOfThoughtContent) {
        return React.cloneElement(child as any, { isOpen });
      }
    }
    return child;
  });
  
  return (
    <div
      className={`group ${className}`}
      data-last={isLast}
      {...props}
    >
      {enhancedChildren}
      {!isLast && (
        <div className="flex justify-start">
          <div className="bg-blue-200 ml-2 h-4 w-px" />
        </div>
      )}
    </div>
  );
};

export interface ChainOfThoughtProps {
  children: React.ReactNode;
  className?: string;
}

export function ChainOfThought({ children, className = '' }: ChainOfThoughtProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={`space-y-0 ${className}`}>
      {childrenArray.map((child, index) => (
        <React.Fragment key={index}>
          {React.isValidElement(child) &&
            React.cloneElement(
              child as React.ReactElement<ChainOfThoughtStepProps>,
              {
                isLast: index === childrenArray.length - 1,
              }
            )}
        </React.Fragment>
      ))}
    </div>
  );
}

