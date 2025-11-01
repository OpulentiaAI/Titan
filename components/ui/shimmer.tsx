"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ShimmerProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: string
}

export const Shimmer = React.forwardRef<HTMLSpanElement, ShimmerProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-block animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] bg-clip-text text-transparent",
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)
Shimmer.displayName = "Shimmer"

