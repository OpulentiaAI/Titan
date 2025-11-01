"use client";

import { CheckIcon, CopyIcon, AlertCircle } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import { type BundledLanguage, codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

export async function highlightCode(code: string, language: BundledLanguage) {
  return Promise.all([
    await codeToHtml(code, {
      lang: language,
      theme: "github-light",
    }),
    await codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    }),
  ]);
}

const CodeBlockComponent = ({
  code,
  language,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const [html, setHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!code) {
      return;
    }

    mounted.current = true;
    setError(null);

    highlightCode(code, language)
      .then(([light, dark]) => {
        if (mounted.current) {
          setHtml(light);
          setDarkHtml(dark);
        }
      })
      .catch((err) => {
        if (mounted.current) {
          setError(err);
          console.error("Failed to highlight code:", err);
        }
      });

    return () => {
      mounted.current = false;
    };
  }, [code, language]);

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to highlight code</span>
        </div>
        <pre className="mt-2 overflow-x-auto text-xs font-mono">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className="group relative" role="region" aria-label={`Code block in ${language}`}>
        <div
          className={cn(
            "overflow-x-auto dark:hidden [&>pre]:bg-transparent!",
            className
          )}
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
        <div
          className={cn(
            "hidden overflow-x-auto dark:block [&>pre]:bg-transparent!",
            className
          )}
          dangerouslySetInnerHTML={{ __html: darkHtml }}
          {...props}
        />
        {children}
      </div>
    </CodeBlockContext.Provider>
  );
};

export const CodeBlock = memo(CodeBlockComponent);

export type CodeBlockCopyButtonProps = ComponentProps<"button"> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

const CodeBlockCopyButtonComponent = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (!code) {
      return;
    }

    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      const error = new Error("Clipboard API not available");
      onError?.(error);
      setCopyError(true);
      setTimeout(() => setCopyError(false), timeout);
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setCopyError(false);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
      setCopyError(true);
      setTimeout(() => setCopyError(false), timeout);
    }
  };

  const Icon = copyError ? AlertCircle : (isCopied ? CheckIcon : CopyIcon);
  const ariaLabel = copyError ? "Copy failed" : (isCopied ? "Copied!" : "Copy code");

  return (
    <button
      className={cn(
        "absolute top-2 right-2 shrink-0 rounded-md p-3 opacity-0 transition-all",
        "hover:bg-secondary group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary",
        copyError && "text-red-500",
        isCopied && "text-green-500",
        className
      )}
      onClick={copyToClipboard}
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      {...props}
    >
      {children ?? <Icon size={14} />}
    </button>
  );
};

export const CodeBlockCopyButton = memo(CodeBlockCopyButtonComponent);

