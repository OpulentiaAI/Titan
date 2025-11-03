// Enhanced Chat Integration Examples
// Shows how to use the enhanced components in existing interfaces

"use client";

import React, { useState } from "react";
import { EnhancedChainOfThoughtChatExample } from "./chain-of-thought-example";

// 1. Basic Enhanced Chat Integration
export function BasicEnhancedChat() {
  return (
    <div className="h-screen">
      <EnhancedChainOfThoughtChatExample />
    </div>
  );
}

// 2. Integration with Existing Sidebar
export function EnhancedSidebarChat({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-full">
      {/* Your existing sidebar content */}
      <div className="w-80 border-r bg-background">
        {children}
      </div>
      
      {/* Enhanced chat interface */}
      <div className="flex-1">
        <EnhancedChainOfThoughtChatExample />
      </div>
    </div>
  );
}

// 3. Enhanced Message Component Usage
export function CustomChatMessage() {
  return (
    <div className="space-y-4">
      {/* User message with enhanced styling */}
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="group rounded-[24px] rounded-br-sm border bg-background px-4 py-3 text-foreground">
            <p>Hello! How can I help you today?</p>
          </div>
        </div>
      </div>
      
      {/* Assistant message with reasoning */}
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-2">
          {/* Reasoning section */}
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              <span>Thinking about how to help...</span>
            </div>
          </div>
          
          {/* Sources section */}
          <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80">
            <span>🔗</span>
            <span>2 sources</span>
          </div>
          
          {/* Main response */}
          <div className="bg-transparent p-0 text-foreground">
            <p>I'd be happy to help you with that! Let me think about the best approach...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Enhanced Prompt Input Integration
export function EnhancedPromptInputExample() {
  const [text, setText] = React.useState("");
  
  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <form className="w-full overflow-hidden rounded-xl border bg-muted shadow-xs divide-y-0 rounded-[28px]">
        {/* Textarea with enhanced styling */}
        <textarea
          className="w-full resize-none rounded-none border-none p-3 shadow-none outline-hidden ring-0 px-5 md:text-base bg-transparent"
          placeholder="How can I help?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        
        {/* Enhanced footer with tools */}
        <div className="flex items-center justify-between p-2.5">
          {/* Tools section */}
          <div className="flex items-center gap-1">
            {/* File attachment button */}
            <button
              type="button"
              className="shrink-0 gap-1.5 rounded-lg border !rounded-full text-foreground"
            >
              📎
            </button>
            
            {/* Search button */}
            <button
              type="button"
              className="shrink-0 gap-1.5 rounded-lg !rounded-l-full text-foreground"
            >
              🔍 DeepSearch
            </button>
            
            {/* Think button */}
            <button
              type="button"
              className="shrink-0 gap-1.5 rounded-lg !rounded-full text-foreground"
            >
              💡 Think
            </button>
          </div>
          
          {/* Model selection and send */}
          <div className="flex items-center gap-2">
            <select className="text-sm border-none bg-transparent">
              <option>Grok-3</option>
              <option>Grok-2-1212</option>
            </select>
            <button
              type="button"
              className="shrink-0 gap-1.5 rounded-lg rounded-full bg-foreground font-medium text-background"
            >
              🎤
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// 5. Enhanced Conversation with Branches
export function BranchedConversationExample() {
  const messages = [
    {
      id: "1",
      from: "user" as const,
      content: "What are the best practices for React state management?",
      versions: [
        { id: "v1", content: "What are the best practices for React state management?" },
        { id: "v2", content: "What are the most effective React state management patterns?" }
      ]
    },
    {
      id: "2", 
      from: "assistant" as const,
      content: "Here are the key React state management practices...",
      versions: [
        { id: "v1", content: "Here are the key React state management practices..." },
        { id: "v2", content: "Let me explain the essential React state patterns..." }
      ]
    }
  ];

  return (
    <div className="h-full max-w-4xl mx-auto">
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-secondary">
        {/* Enhanced conversation */}
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto h-full max-w-4xl">
            <div className="relative flex-1 overflow-y-auto bg-secondary">
              <div className="mx-auto h-full max-w-4xl p-4">
                {messages.map(({ versions, ...message }) => (
                  <div key={message.id} className="relative">
                    {/* Branch container */}
                    <div className="relative">
                      {/* Messages */}
                      <div className="flex flex-col">
                        {versions.map((version) => (
                          <div key={version.id} className="group flex w-full items-end justify-end gap-2 py-4">
                            <div className="flex flex-col gap-2 text-sm">
                              <div className={`flex flex-col gap-2 text-sm group-[.is-user]:rounded-[24px] group-[.is-user]:rounded-br-sm group-[.is-user]:border group-[.is-user]:bg-background group-[.is-user]:text-foreground group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0 group-[.is-assistant]:text-foreground`}>
                                <p>{version.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Branch selector */}
                      {versions.length > 1 && (
                        <div className="flex items-center justify-between gap-2 p-2 text-sm text-muted-foreground px-0">
                          <button className="h-6 px-2 text-xs rounded border">Previous</button>
                          <div className="flex items-center gap-2">
                            <select className="h-6 w-16 px-2 text-xs border rounded">
                              <option value="0">1</option>
                              <option value="1">2</option>
                            </select>
                            <span className="text-xs text-muted-foreground">of 2</span>
                          </div>
                          <button className="h-6 px-2 text-xs rounded border">Next</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced prompt input at bottom */}
        <div className="shrink-0 p-4">
          <EnhancedPromptInputExample />
        </div>
      </div>
    </div>
  );
}

// 6. Responsive Enhanced Chat
export function ResponsiveEnhancedChat() {
  return (
    <div className="h-screen md:h-full">
      <div className="flex h-full flex-col md:flex-row">
        {/* Chat interface - full width on mobile, 2/3 on desktop */}
        <div className="flex-1 min-h-0">
          <EnhancedChainOfThoughtChatExample />
        </div>
        
        {/* Side panel - hidden on mobile, 1/3 on desktop */}
        <div className="hidden md:block w-80 border-l bg-background">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Chat Context</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="p-2 bg-muted rounded">
                <div className="font-medium text-foreground">Current Topic</div>
                <div>React State Management</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium text-foreground">Messages</div>
                <div>12 messages in this conversation</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export all examples
export const enhancedChatExamples = {
  BasicEnhancedChat,
  EnhancedSidebarChat,
  CustomChatMessage,
  EnhancedPromptInputExample,
  BranchedConversationExample,
  ResponsiveEnhancedChat,
};

export default enhancedChatExamples;