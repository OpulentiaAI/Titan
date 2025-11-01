// Chain of Thought Component - Production Hardened
// Displays step-by-step reasoning with collapsible thought processes
// Integrated with enhanced message parts and error boundaries

"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, Circle } from "lucide-react";
import React, { memo } from "react";
import { MinorErrorBoundary } from "../ErrorBoundary";
import { TextShimmer } from "../core/text-shimmer";

export type ChainOfThoughtItemProps = React.ComponentProps<"div">;

export const ChainOfThoughtItem = memo(({
  children,
  className,
  ...props
}: ChainOfThoughtItemProps) => {
  if (!children) {
    return null;
  }

  return (
    <div 
      className={cn("text-muted-foreground text-sm", className)} 
      role="listitem"
      {...props}
    >
      {children}
    </div>
  );
});

ChainOfThoughtItem.displayName = "ChainOfThoughtItem";

export type ChainOfThoughtTriggerProps = React.ComponentProps<
  typeof CollapsibleTrigger
> & {
  leftIcon?: React.ReactNode;
  swapIconOnHover?: boolean;
};

export const ChainOfThoughtTrigger = memo(({
  children,
  className,
  leftIcon,
  swapIconOnHover = true,
  ...props
}: ChainOfThoughtTriggerProps) => {
  return (
    <CollapsibleTrigger
      className={cn(
        "group text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-start gap-1 text-left text-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm",
        className
      )}
      aria-label={typeof children === "string" ? children : "Toggle reasoning step"}
      {...props}
    >
      <div className="flex items-center gap-2">
        {leftIcon ? (
          <span className="relative inline-flex size-4 items-center justify-center shrink-0">
            <span
              className={cn(
                "transition-opacity duration-200",
                swapIconOnHover && "group-hover:opacity-0"
              )}
            >
              {leftIcon}
            </span>
            {swapIconOnHover && (
              <ChevronDown 
                className="absolute size-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-data-[state=open]:rotate-180" 
                aria-hidden="true"
              />
            )}
          </span>
        ) : (
          <span className="relative inline-flex size-4 items-center justify-center shrink-0">
            <Circle className="size-2 fill-current" aria-hidden="true" />
          </span>
        )}
        <span className="flex-1">
          {typeof children === 'string' ? (
            <TextShimmer duration={2} spread={2} className="font-medium">
              {children}
            </TextShimmer>
          ) : (
            children
          )}
        </span>
      </div>
      {!leftIcon && (
        <ChevronDown 
          className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" 
          aria-hidden="true"
        />
      )}
    </CollapsibleTrigger>
  );
});

ChainOfThoughtTrigger.displayName = "ChainOfThoughtTrigger";

export type ChainOfThoughtContentProps = React.ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(({
  children,
  className,
  ...props
}: ChainOfThoughtContentProps) => {
  return (
    <CollapsibleContent
      className={cn(
        "text-popover-foreground overflow-hidden",
        "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    >
      <div 
        className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-4"
        role="list"
        aria-label="Reasoning items"
      >
        <div className="bg-primary/20 ml-1.75 h-full w-px group-data-[last=true]:hidden" aria-hidden="true" />
        <div className="ml-1.75 h-full w-px bg-transparent group-data-[last=false]:hidden" aria-hidden="true" />
        <div className="mt-2 space-y-2">{children}</div>
      </div>
    </CollapsibleContent>
  );
});

ChainOfThoughtContent.displayName = "ChainOfThoughtContent";

export type ChainOfThoughtProps = {
  children: React.ReactNode;
  className?: string;
};

export const ChainOfThought = memo(({ children, className }: ChainOfThoughtProps) => {
  const childrenArray = React.Children.toArray(children);

  if (childrenArray.length === 0) {
    return null;
  }

  return (
    <MinorErrorBoundary componentName="ChainOfThought">
      <div 
        className={cn("space-y-0", className)}
        role="region"
        aria-label="Chain of thought reasoning"
      >
        {childrenArray.map((child, index) => (
          <React.Fragment key={`cot-step-${index}`}>
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
    </MinorErrorBoundary>
  );
});

ChainOfThought.displayName = "ChainOfThought";

export type ChainOfThoughtStepProps = {
  children: React.ReactNode;
  className?: string;
  isLast?: boolean;
  defaultOpen?: boolean;
};

export const ChainOfThoughtStep = memo(({
  children,
  className,
  isLast = false,
  defaultOpen = false,
  ...props
}: ChainOfThoughtStepProps & React.ComponentProps<typeof Collapsible>) => {
  return (
    <Collapsible
      className={cn("group", className)}
      data-last={isLast}
      defaultOpen={defaultOpen}
      {...props}
    >
      {children}
      <div className="flex justify-start group-data-[last=true]:hidden" aria-hidden="true">
        <div className="bg-primary/20 ml-1.75 h-4 w-px" />
      </div>
    </Collapsible>
  );
});

ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
