import { NextResponse } from "next/server";

// Mock Copilot models for standalone Next.js app
const MOCK_MODELS = [
  {
    id: "gpt-4",
    name: "GPT-4",
    family: "gpt-4",
    version: "0613",
    vendor: "OpenAI",
    maxInputTokens: 8192,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    family: "gpt-4",
    version: "turbo",
    vendor: "OpenAI",
    maxInputTokens: 128000,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    family: "gpt-3.5-turbo",
    version: "0125",
    vendor: "OpenAI",
    maxInputTokens: 16385,
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    family: "claude-3",
    version: "opus",
    vendor: "Anthropic",
    maxInputTokens: 200000,
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    family: "claude-3",
    version: "sonnet",
    vendor: "Anthropic",
    maxInputTokens: 200000,
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    family: "claude-3",
    version: "haiku",
    vendor: "Anthropic",
    maxInputTokens: 200000,
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    family: "gemini",
    version: "pro",
    vendor: "Google",
    maxInputTokens: 32768,
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    family: "mistral",
    version: "large",
    vendor: "Mistral",
    maxInputTokens: 32000,
  },
];

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      models: MOCK_MODELS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
