import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

type DetectedProject = {
  type: string;
  name: string;
  version?: string;
  description: string;
  files: string[];
  path: string;
};

function checkFileExists(basePath: string, fileName: string): boolean {
  try {
    return fs.existsSync(path.join(basePath, fileName));
  } catch {
    return false;
  }
}

function readPackageJson(basePath: string): any {
  try {
    const packagePath = path.join(basePath, "package.json");
    if (fs.existsSync(packagePath)) {
      const content = fs.readFileSync(packagePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading package.json:", err);
  }
  return null;
}

function detectProjectsInDir(basePath: string, relativePath: string = "."): DetectedProject[] {
  const projects: DetectedProject[] = [];
  const packageJson = readPackageJson(basePath);

  // Detect Next.js
  if (packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps["next"]) {
      projects.push({
        type: "Next.js",
        name: packageJson.name || "Next.js Project",
        version: deps["next"],
        description: "React framework for production-grade applications",
        files: ["next.config.js", "next.config.ts", "app/", "pages/"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect React (Vite)
    if (deps["react"] && deps["vite"]) {
      projects.push({
        type: "React (Vite)",
        name: packageJson.name || "React Project",
        version: deps["react"],
        description: "Fast and modern React development with Vite",
        files: ["vite.config.js", "vite.config.ts", "index.html"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect Vue
    if (deps["vue"]) {
      projects.push({
        type: "Vue.js",
        name: packageJson.name || "Vue Project",
        version: deps["vue"],
        description: "Progressive JavaScript framework",
        files: ["vue.config.js", "vite.config.js", "src/App.vue"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect Angular
    if (deps["@angular/core"]) {
      projects.push({
        type: "Angular",
        name: packageJson.name || "Angular Project",
        version: deps["@angular/core"],
        description: "Platform for building web applications",
        files: ["angular.json", "src/app/"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect Svelte
    if (deps["svelte"]) {
      projects.push({
        type: "Svelte",
        name: packageJson.name || "Svelte Project",
        version: deps["svelte"],
        description: "Cybernetically enhanced web apps",
        files: ["svelte.config.js", "vite.config.js"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect Express
    if (deps["express"]) {
      projects.push({
        type: "Express.js",
        name: packageJson.name || "Express Server",
        version: deps["express"],
        description: "Fast, unopinionated web framework for Node.js",
        files: ["server.js", "app.js", "index.js"].filter((f) =>
          checkFileExists(basePath, f)
        ),
        path: relativePath,
      });
    }

    // Detect Node.js project (generic)
    if (
      Object.keys(deps).length > 0 &&
      projects.length === 0 &&
      packageJson.name
    ) {
      projects.push({
        type: "Node.js",
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description || "Node.js project",
        files: ["package.json"],
        path: relativePath,
      });
    }
  }

  // Detect Python projects
  if (
    checkFileExists(basePath, "requirements.txt") ||
    checkFileExists(basePath, "setup.py") ||
    checkFileExists(basePath, "pyproject.toml")
  ) {
    projects.push({
      type: "Python",
      name: "Python Project",
      description: "Python application or package",
      files: ["requirements.txt", "setup.py", "pyproject.toml"].filter((f) =>
        checkFileExists(basePath, f)
      ),
      path: relativePath,
    });
  }

  // Detect Rust projects
  if (checkFileExists(basePath, "Cargo.toml")) {
    projects.push({
      type: "Rust",
      name: "Rust Project",
      description: "Rust application or library",
      files: ["Cargo.toml", "Cargo.lock"].filter((f) =>
        checkFileExists(basePath, f)
      ),
      path: relativePath,
    });
  }

  // Detect Go projects
  if (checkFileExists(basePath, "go.mod")) {
    projects.push({
      type: "Go",
      name: "Go Project",
      description: "Go application or package",
      files: ["go.mod", "go.sum", "main.go"].filter((f) =>
        checkFileExists(basePath, f)
      ),
      path: relativePath,
    });
  }

  return projects;
}

function scanWorkspaceForProjects(workspacePath: string): DetectedProject[] {
  const allProjects: DetectedProject[] = [];
  const ignoreDirs = ["node_modules", ".git", "dist", "build", ".next", "out", "coverage"];

  // Scan root directory
  allProjects.push(...detectProjectsInDir(workspacePath, "."));

  // Scan subdirectories (1 level deep)
  try {
    const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !ignoreDirs.includes(entry.name) && !entry.name.startsWith(".")) {
        const subPath = path.join(workspacePath, entry.name);
        const subProjects = detectProjectsInDir(subPath, entry.name);
        allProjects.push(...subProjects);
      }
    }
  } catch (err) {
    console.error("Error scanning subdirectories:", err);
  }

  return allProjects;
}

export async function GET() {
  try {
    const workspacePath = process.env.WORKSPACE_PATH || process.cwd();
    const projects = scanWorkspaceForProjects(workspacePath);

    return NextResponse.json({
      success: true,
      projects,
      workspacePath,
    });
  } catch (error) {
    console.error("Error detecting projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
