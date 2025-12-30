"use client";

import { useState, useCallback, useRef } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  modelId?: string;
  reasoning?: string;
  isStreaming?: boolean;
  tasks?: Array<{
    title: string;
    files?: Array<{ name: string; type: string }>;
  }>;
};

export type UseChatOptions = {
  onError?: (error: Error) => void;
  onFinish?: (message: ChatMessage) => void;
};

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, modelId: string) => {
      if (!content.trim() || !modelId) {
        return;
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setIsLoading(true);
      setError(null);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Build the complete messages array BEFORE updating state
        const allMessages = [...messages, userMessage];
        
        // Update state with new messages
        setMessages(allMessages);

        // Prepare messages for API (convert to simple format)
        const apiMessages = allMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        console.log('[useChat] Sending request with:', {
          messagesCount: apiMessages.length,
          modelId,
          messages: apiMessages
        });

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: apiMessages,
            modelId,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        console.log('[useChat] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('[useChat] Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          modelId,
          reasoning: "",
          isStreaming: true,
        };

        // Add assistant message to chat
        setMessages((prev) => [...prev, assistantMessage]);

        // Read the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }

                if (!data.done) {
                  // Update assistant message content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? { 
                            ...msg, 
                            content: msg.content + data.content,
                            reasoning: data.reasoning || msg.reasoning,
                            tasks: data.tasks || msg.tasks,
                            isStreaming: true
                          }
                        : msg
                    )
                  );
                } else {
                  // Mark streaming as complete
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        // Call onFinish callback
        if (options.onFinish) {
          setMessages((prev) => {
            const finalAssistantMessage = prev.find(
              (msg) => msg.id === assistantMessage.id
            );
            if (finalAssistantMessage) {
              options.onFinish!(finalAssistantMessage);
            }
            return prev;
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        
        // Don't set error if request was aborted
        if (error.name !== "AbortError") {
          setError(error);
          if (options.onError) {
            options.onError(error);
          }
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [options]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
  };
}
