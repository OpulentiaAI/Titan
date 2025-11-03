import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
};

export const Branch = ({
  className,
  defaultBranch = 0,
  children,
  ...props
}: BranchProps) => {
  const [currentBranch, setCurrentBranch] = React.useState(defaultBranch);

  return (
    <div
      className={cn("relative", className)}
      data-current-branch={currentBranch}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            currentBranch,
            setCurrentBranch,
          } as any);
        }
        return child;
      })}
    </div>
  );
};

export type BranchMessagesProps = HTMLAttributes<HTMLDivElement> & {
  currentBranch?: number;
  setCurrentBranch?: (branch: number) => void;
};

export const BranchMessages = ({
  className,
  currentBranch = 0,
  children,
  ...props
}: BranchMessagesProps) => (
  <div
    className={cn("flex flex-col", className)}
    data-current-branch={currentBranch}
    {...props}
  >
    {children}
  </div>
);

export type BranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
  currentBranch?: number;
  setCurrentBranch?: (branch: number) => void;
};

export const BranchSelector = ({
  className,
  from,
  currentBranch = 0,
  setCurrentBranch,
  children,
  ...props
}: BranchSelectorProps) => {
  if (!React.isValidElement(children)) return null;

  const totalBranches = React.Children.count(children) + 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 p-2 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            currentBranch,
            setCurrentBranch,
            totalBranches,
            from,
          } as any);
        }
        return child;
      })}
    </div>
  );
};

export type BranchPreviousProps = HTMLAttributes<HTMLButtonElement> & {
  currentBranch?: number;
  setCurrentBranch?: (branch: number) => void;
  totalBranches?: number;
};

export const BranchPrevious = ({
  className,
  currentBranch = 0,
  setCurrentBranch,
  totalBranches = 2,
  ...props
}: BranchPreviousProps) => {
  const canGoPrevious = currentBranch > 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-6 px-2 text-xs", className)}
      disabled={!canGoPrevious}
      onClick={() => setCurrentBranch?.(currentBranch - 1)}
      {...props}
    >
      <ChevronLeftIcon className="h-3 w-3 mr-1" />
      Previous
    </Button>
  );
};

export type BranchNextProps = HTMLAttributes<HTMLButtonElement> & {
  currentBranch?: number;
  setCurrentBranch?: (branch: number) => void;
  totalBranches?: number;
};

export const BranchNext = ({
  className,
  currentBranch = 0,
  setCurrentBranch,
  totalBranches = 2,
  ...props
}: BranchNextProps) => {
  const canGoNext = currentBranch < totalBranches - 1;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-6 px-2 text-xs", className)}
      disabled={!canGoNext}
      onClick={() => setCurrentBranch?.(currentBranch + 1)}
      {...props}
    >
      Next
      <ChevronRightIcon className="h-3 w-3 ml-1" />
    </Button>
  );
};

export type BranchPageProps = HTMLAttributes<HTMLDivElement> & {
  currentBranch?: number;
  setCurrentBranch?: (branch: number) => void;
  totalBranches?: number;
};

export const BranchPage = ({
  className,
  currentBranch = 0,
  setCurrentBranch,
  totalBranches = 2,
  ...props
}: BranchPageProps) => {
  if (totalBranches <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <Select
        value={currentBranch.toString()}
        onValueChange={(value) => setCurrentBranch?.(parseInt(value))}
      >
        <SelectTrigger className="h-6 w-16 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: totalBranches }, (_, i) => (
            <SelectItem key={i} value={i.toString()}>
              {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">
        of {totalBranches}
      </span>
    </div>
  );
};