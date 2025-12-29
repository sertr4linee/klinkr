import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

type FileNode = {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
};

// Directories and files to ignore
const IGNORE_LIST = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vscode",
  ".idea",
  "coverage",
  ".DS_Store",
  "*.log",
];

function shouldIgnore(name: string): boolean {
  return IGNORE_LIST.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(name);
    }
    return name === pattern;
  });
}

function buildFileTree(dirPath: string, basePath: string = ""): FileNode | null {
  try {
    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);
    const relativePath = basePath ? `${basePath}/${name}` : name;

    if (shouldIgnore(name)) {
      return null;
    }

    if (stats.isDirectory()) {
      const children: FileNode[] = [];
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const childPath = path.join(dirPath, item);
          const childNode = buildFileTree(childPath, relativePath);
          if (childNode) {
            children.push(childNode);
          }
        }
      } catch (err) {
        console.error(`Error reading directory ${dirPath}:`, err);
      }

      // Sort: directories first, then files, both alphabetically
      children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === "directory" ? -1 : 1;
      });

      return {
        name,
        type: "directory",
        path: relativePath,
        children,
      };
    } else {
      return {
        name,
        type: "file",
        path: relativePath,
      };
    }
  } catch (err) {
    console.error(`Error accessing ${dirPath}:`, err);
    return null;
  }
}

export async function GET() {
  try {
    // Get the workspace path from environment or use current directory
    const workspacePath = process.env.WORKSPACE_PATH || process.cwd();
    
    const tree = buildFileTree(workspacePath);

    return NextResponse.json({
      success: true,
      tree,
      workspacePath,
    });
  } catch (error) {
    console.error("Error building file tree:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
