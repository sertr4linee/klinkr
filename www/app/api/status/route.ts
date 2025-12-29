import { NextResponse } from "next/server";

export async function GET() {
  try {
    // In Next.js standalone mode, we simulate the workspace path
    const workspacePath = process.env.WORKSPACE_PATH || process.cwd();

    return NextResponse.json({
      success: true,
      status: "connected",
      currentPath: workspacePath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
