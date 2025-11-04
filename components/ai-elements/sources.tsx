import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

export type SourcesProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const Sources = ({ className, children, ...props }: SourcesProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible
      className={cn("not-prose", className)}
      open={isOpen}
      onOpenChange={setIsOpen}
      {...props}
    >
      {children}
    </Collapsible>
  );
};

export type SourcesTriggerProps = HTMLAttributes<HTMLDivElement> & {
  count: number;
  children?: ReactNode;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => {
  return (
    <CollapsibleTrigger
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <LinkIcon className="h-3 w-3" />
          <span>{count} source{count !== 1 ? "s" : ""}</span>
        </>
      )}
    </CollapsibleTrigger>
  );
};

export type SourcesContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const SourcesContent = ({
  className,
  children,
  ...props
}: SourcesContentProps) => {
  return (
    <CollapsibleContent
      className={cn(
        "mt-2 rounded-lg border bg-card p-3 shadow-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2",
        className
      )}
      {...props}
    >
      <ScrollArea className="max-h-48">
        <div className="space-y-2">{children}</div>
      </ScrollArea>
    </CollapsibleContent>
  );
};

export type SourceProps = HTMLAttributes<HTMLDivElement> & {
  href: string;
  title?: string;
  children?: ReactNode;
};

export const Source = ({
  className,
  href,
  title,
  children,
  ...props
}: SourceProps) => {
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md p-2 text-sm hover:bg-accent/50",
        className
      )}
      {...props}
    >
      <ExternalLinkIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {title || href}
        </a>
        {children && (
          <div className="mt-1 text-xs text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};