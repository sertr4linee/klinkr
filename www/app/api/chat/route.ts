import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  modelId: string;
  stream?: boolean;
};

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, modelId, stream = true } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "No messages provided" },
        { status: 400 }
      );
    }

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: "No model ID provided" },
        { status: 400 }
      );
    }

    // In standalone Next.js mode, we simulate a response
    // When running in VS Code extension, this will be proxied to the Express server
    const lastMessage = messages[messages.length - 1];
    
    if (stream) {
      // Create a streaming response
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          // Simulate streaming response
          const response = `I received your message: "${lastMessage.content}". This is a simulated response in development mode. When running through the VS Code extension, this will use the actual Copilot models.`;
          
          // Stream word by word
          const words = response.split(" ");
          for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? " " : "");
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`)
            );
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          
          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: "", done: true })}\n\n`)
          );
          controller.close();
        },
      });

      return new Response(customReadable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      // Non-streaming response
      const response = `I received your message: "${lastMessage.content}". This is a simulated response in development mode.`;
      
      return NextResponse.json({
        success: true,
        message: {
          role: "assistant",
          content: response,
        },
        modelId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
