"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronsUpDown } from "lucide-react"
import { Shimmer } from "./shimmer"

type PlanContextValue = {
  isStreaming: boolean
}

const PlanContext = React.createContext<PlanContextValue | null>(null)

const usePlan = () => {
  const context = React.useContext(PlanContext)
  if (!context) {
    throw new Error("Plan components must be used within Plan")
  }
  return context
}

export interface PlanProps extends React.ComponentProps<typeof Collapsible> {
  isStreaming?: boolean
}

export const Plan = React.forwardRef<
  HTMLDivElement,
  PlanProps
>(({ className, isStreaming = false, children, ...props }, ref) => {
  return (
    <PlanContext.Provider value={{ isStreaming }}>
      <Collapsible asChild {...props}>
        <div
          ref={ref}
          className={cn(
            "rounded-lg border bg-card text-card-foreground shadow-sm",
            className
          )}
          data-slot="plan"
        >
          {children}
        </div>
      </Collapsible>
    </PlanContext.Provider>
  )
})
Plan.displayName = "Plan"

export interface PlanHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PlanHeader = React.forwardRef<HTMLDivElement, PlanHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col space-y-1.5 p-6 pb-4",
          className
        )}
        data-slot="plan-header"
        {...props}
      />
    )
  }
)
PlanHeader.displayName = "PlanHeader"

export interface PlanTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: string
}

export const PlanTitle = React.forwardRef<HTMLHeadingElement, PlanTitleProps>(
  ({ children, className, ...props }, ref) => {
    const { isStreaming } = usePlan()
    return (
      <h3
        ref={ref}
        className={cn(
          "text-2xl font-semibold leading-none tracking-tight",
          className
        )}
        data-slot="plan-title"
        {...props}
      >
        {isStreaming ? <Shimmer>{children}</Shimmer> : children}
      </h3>
    )
  }
)
PlanTitle.displayName = "PlanTitle"

export interface PlanDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: string
}

export const PlanDescription = React.forwardRef<HTMLParagraphElement, PlanDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    const { isStreaming } = usePlan()
    return (
      <p
        ref={ref}
        className={cn("text-sm text-muted-foreground text-balance", className)}
        data-slot="plan-description"
        {...props}
      >
        {isStreaming ? <Shimmer>{children}</Shimmer> : children}
      </p>
    )
  }
)
PlanDescription.displayName = "PlanDescription"

export interface PlanTriggerProps extends React.ComponentProps<typeof CollapsibleTrigger> {}

export const PlanTrigger = React.forwardRef<
  HTMLButtonElement,
  PlanTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <CollapsibleTrigger asChild>
      <Button
        ref={ref}
        className={cn("h-8 w-8", className)}
        data-slot="plan-trigger"
        size="icon"
        variant="ghost"
        {...props}
      >
        <ChevronsUpDown className="h-4 w-4" />
        <span className="sr-only">Toggle plan</span>
      </Button>
    </CollapsibleTrigger>
  )
})
PlanTrigger.displayName = "PlanTrigger"

export interface PlanContentProps extends React.ComponentProps<typeof CollapsibleContent> {}

export const PlanContent = React.forwardRef<HTMLDivElement, PlanContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <CollapsibleContent asChild>
        <div
          ref={ref}
          className={cn("px-6 pb-6 pt-0", className)}
          data-slot="plan-content"
          {...props}
        />
      </CollapsibleContent>
    )
  }
)
PlanContent.displayName = "PlanContent"

export interface PlanFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PlanFooter = React.forwardRef<HTMLDivElement, PlanFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        data-slot="plan-footer"
        {...props}
      />
    )
  }
)
PlanFooter.displayName = "PlanFooter"

export interface PlanActionProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PlanAction = React.forwardRef<HTMLDivElement, PlanActionProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("", className)}
        data-slot="plan-action"
        {...props}
      />
    )
  }
)
PlanAction.displayName = "PlanAction"

