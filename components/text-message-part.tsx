// Text Message Part Component
// Renders text content with streaming support

"use client";

import { memo } from "react";
import { Response } from "./ai-elements/response";

type TextMessagePartProps = {
  content: string;
  isStreaming?: boolean;
  className?: string;
};

function PureTextMessagePart({
  content,
  isStreaming = false,
  className,
}: TextMessagePartProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={className}>
      <Response isAnimating={isStreaming}>
        {content}
      </Response>
    </div>
  );
}

export const TextMessagePart = memo(PureTextMessagePart);

