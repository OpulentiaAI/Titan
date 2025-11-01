"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useState,
} from "react";
import { cn } from "../../lib/utils";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language?: string;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

export const CodeBlock = ({
  code,
  language = "text",
  className,
  children,
  ...props
}: CodeBlockProps) => {
  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className="group relative">
        <div
          className={cn(
            "overflow-x-auto rounded-lg border bg-muted p-4",
            className
          )}
          {...props}
        >
          <div className="mb-2 text-xs text-muted-foreground">{language}</div>
          <pre className="overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        </div>
        {children}
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<"button"> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <button
      className={cn(
        "absolute top-2 right-2 shrink-0 rounded-md p-2 opacity-0 transition-all",
        "hover:bg-secondary group-hover:opacity-100",
        className
      )}
      onClick={copyToClipboard}
      type="button"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </button>
  );
};

