"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export type ActionsProps = ComponentProps<"div"> & {
  children: ReactNode;
};

export const Actions = ({ className, children, ...props }: ActionsProps) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const Action = ({
  tooltip,
  children,
  label,
  className,
  variant = "ghost",
  size = "sm",
  title,
  ...props
}: ActionProps) => {
  return (
    <Button
      className={cn(
        "relative size-9 p-1.5 text-muted-foreground hover:text-foreground",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      title={tooltip || title || label}
      {...props}
    >
      {children}
      {label && <span className="sr-only">{label}</span>}
    </Button>
  );
};

