"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ArtifactProps = ComponentProps<"div">;

export const Artifact = ({ className, ...props }: ArtifactProps) => (
  <div
    className={cn(
      "flex flex-col gap-0 rounded-xl border border-border bg-background shadow-sm",
      className
    )}
    {...props}
  />
);

export type ArtifactHeaderProps = ComponentProps<"div">;

export const ArtifactHeader = ({
  className,
  ...props
}: ArtifactHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 border-b border-border px-4 py-3",
      className
    )}
    {...props}
  />
);

export type ArtifactTitleProps = ComponentProps<"p">;

export const ArtifactTitle = ({ className, ...props }: ArtifactTitleProps) => (
  <p
    className={cn("text-sm font-semibold text-foreground", className)}
    {...props}
  />
);

export type ArtifactDescriptionProps = ComponentProps<"p">;

export const ArtifactDescription = ({
  className,
  ...props
}: ArtifactDescriptionProps) => (
  <p
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
);

export type ArtifactActionsProps = ComponentProps<"div">;

export const ArtifactActions = ({
  className,
  ...props
}: ArtifactActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type ArtifactActionProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size"
> & {
  tooltip?: string;
  label?: string;
  icon?: LucideIcon;
};

export const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  className,
  children,
  ...props
}: ArtifactActionProps) => {
  const button = (
    <Button
      className={cn(
        "h-8 gap-1.5 px-2.5 text-xs",
        className
      )}
      size="sm"
      variant="ghost"
      {...props}
    >
      {Icon && <Icon className="size-4" />}
      {label && <span>{label}</span>}
      {children}
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export type ArtifactCloseProps = ComponentProps<typeof Button>;

export const ArtifactClose = ({
  className,
  ...props
}: ArtifactCloseProps) => (
  <Button
    className={cn("size-6 p-0", className)}
    size="icon"
    variant="ghost"
    {...props}
  />
);

export type ArtifactContentProps = ComponentProps<"div">;

export const ArtifactContent = ({
  className,
  ...props
}: ArtifactContentProps) => (
  <div className={cn("p-4", className)} {...props} />
);

