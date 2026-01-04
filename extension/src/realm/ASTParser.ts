/**
 * REALM Protocol - AST Parser
 * 
 * Parse les fichiers source et extrait les éléments JSX/HTML
 * avec leur RealmID correspondant.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { RealmID, ElementInfo, SourceLocation, ElementAttributes, FrameworkMeta } from './types';
import { generateRealmID, extractComponentName, buildASTPath } from './RealmID';
import { ElementRegistry } from './ElementRegistry';

// ============================================================================
// Types
// ============================================================================

export interface ParseResult {
  filePath: string;
  elements: ElementInfo[];
  errors: ParseError[];
  parseTime: number;
}

export interface ParseError {
  message: string;
  location?: SourceLocation;
}

export interface ParseOptions {
  /** Extensions à traiter */
  extensions?: string[];
  /** Ignorer certains patterns */
  ignorePatterns?: RegExp[];
  /** Détecter automatiquement le framework */
  autoDetectFramework?: boolean;
}

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  extensions: ['.tsx', '.jsx', '.js', '.ts'],
  ignorePatterns: [/node_modules/, /\.next/, /dist/, /build/],
  autoDetectFramework: true,
};

// ============================================================================
// AST Parser Class
// ============================================================================

export class ASTParser {
  private options: Required<ParseOptions>;
  private registry: ElementRegistry;
  
  constructor(options: ParseOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.registry = ElementRegistry.getInstance();
  }
  
  /**
   * Parse un fichier et enregistre ses éléments
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const startTime = Date.now();
    const errors: ParseError[] = [];
    const elements: ElementInfo[] = [];
    
    // Vérifier l'extension
    const ext = path.extname(filePath);
    if (!this.options.extensions.includes(ext)) {
      return { filePath, elements, errors, parseTime: 0 };
    }
    
    // Vérifier les patterns ignorés
    if (this.options.ignorePatterns.some(p => p.test(filePath))) {
      return { filePath, elements, errors, parseTime: 0 };
    }
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const ast = this.parseContent(content, filePath);
      
      if (!ast) {
        errors.push({ message: 'Failed to parse AST' });
        return { filePath, elements, errors, parseTime: Date.now() - startTime };
      }
      
      // Détecter le framework
      const framework = this.detectFramework(content, filePath);
      
      // Extraire les éléments
      const extracted = this.extractElements(ast, filePath, framework);
      elements.push(...extracted);
      
      // Enregistrer dans le registry
      for (const element of elements) {
        this.registry.register(element);
      }
      
      console.log(`[ASTParser] Parsed ${filePath}: ${elements.length} elements`);
      
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
      });
    }
    
    return {
      filePath,
      elements,
      errors,
      parseTime: Date.now() - startTime,
    };
  }
  
  /**
   * Parse le contenu d'un fichier en AST
   */
  parseContent(content: string, filePath: string): t.File | null {
    try {
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
      
      return parser.parse(content, {
        sourceType: 'module',
        plugins: [
          isJSX ? 'jsx' : null,
          isTypeScript ? 'typescript' : null,
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
        ].filter(Boolean) as parser.ParserPlugin[],
        sourceFilename: filePath,
        errorRecovery: true,
      });
    } catch (error) {
      console.error(`[ASTParser] Parse error in ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Détecte le framework utilisé dans le fichier
   */
  detectFramework(content: string, filePath: string): FrameworkMeta {
    // Détection React
    const hasReactImport = /import\s+.*\s+from\s+['"]react['"]/.test(content);
    const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+\s/.test(content);
    
    // Détection Tailwind
    const hasTailwindClasses = /className\s*=\s*["'`][^"'`]*(?:flex|grid|p-|m-|text-|bg-|w-|h-)/.test(content);
    
    // Détection CSS Modules
    const hasCSSModulesImport = /import\s+\w+\s+from\s+['"].*\.module\.css['"]/.test(content);
    
    // Détection styled-components
    const hasStyledComponents = /import\s+styled\s+from\s+['"]styled-components['"]/.test(content);
    
    let styleSystem: FrameworkMeta['styleSystem'] = 'css';
    if (hasTailwindClasses) {
      styleSystem = 'tailwind';
    } else if (hasCSSModulesImport) {
      styleSystem = 'css-modules';
    } else if (hasStyledComponents) {
      styleSystem = 'styled-components';
    } else if (content.includes('style={{') || content.includes('style={')) {
      styleSystem = 'inline';
    }
    
    return {
      framework: hasReactImport || hasJSX ? 'react' : 'html',
      styleSystem,
      isComponent: /^[A-Z]/.test(path.basename(filePath, path.extname(filePath))),
      componentPath: filePath,
    };
  }
  
  /**
   * Extrait tous les éléments JSX d'un AST
   */
  extractElements(ast: t.File, filePath: string, framework: FrameworkMeta): ElementInfo[] {
    const elements: ElementInfo[] = [];
    const componentStack: string[] = [];
    
    traverse(ast, {
      // Tracker le composant courant
      FunctionDeclaration: {
        enter: (nodePath: NodePath<t.FunctionDeclaration>) => {
          if (nodePath.node.id?.name) {
            componentStack.push(nodePath.node.id.name);
          }
        },
        exit: (nodePath: NodePath<t.FunctionDeclaration>) => {
          if (nodePath.node.id?.name) {
            componentStack.pop();
          }
        },
      },
      
      VariableDeclarator: {
        enter: (nodePath: NodePath<t.VariableDeclarator>) => {
          if (
            t.isIdentifier(nodePath.node.id) &&
            (t.isArrowFunctionExpression(nodePath.node.init) ||
             t.isFunctionExpression(nodePath.node.init))
          ) {
            componentStack.push(nodePath.node.id.name);
          }
        },
        exit: (nodePath: NodePath<t.VariableDeclarator>) => {
          if (
            t.isIdentifier(nodePath.node.id) &&
            (t.isArrowFunctionExpression(nodePath.node.init) ||
             t.isFunctionExpression(nodePath.node.init))
          ) {
            componentStack.pop();
          }
        },
      },
      
      // Extraire les éléments JSX
      JSXElement: (nodePath: NodePath<t.JSXElement>) => {
        const node = nodePath.node;
        const componentName = componentStack[componentStack.length - 1] || 'Unknown';
        
        // Construire le chemin AST depuis les ancêtres
        const ancestors = nodePath.getAncestry().map(p => p.node);
        const astPath = buildASTPath(ancestors);
        
        // Générer le RealmID
        const realmId = generateRealmID(filePath, componentName, node, astPath);
        
        // Extraire les attributs
        const attributes = this.extractAttributes(node);
        
        // Extraire le tag name
        const tagName = this.getTagName(node.openingElement);
        
        // Extraire le contenu texte direct
        const textContent = this.extractTextContent(node);
        
        // Construire ElementInfo
        const elementInfo: ElementInfo = {
          realmId,
          tagName,
          attributes,
          styles: this.parseInlineStyles(attributes.style),
          textContent,
          children: [], // Sera rempli lors d'un second passage si nécessaire
          frameworkMeta: framework,
        };
        
        elements.push(elementInfo);
      },
    });
    
    return elements;
  }
  
  /**
   * Extrait le nom du tag JSX
   */
  private getTagName(openingElement: t.JSXOpeningElement): string {
    const name = openingElement.name;
    
    if (t.isJSXIdentifier(name)) {
      return name.name;
    }
    
    if (t.isJSXMemberExpression(name)) {
      // Ex: Icons.Home -> "Icons.Home"
      const parts: string[] = [];
      let current: t.JSXMemberExpression | t.JSXIdentifier = name;
      
      while (t.isJSXMemberExpression(current)) {
        parts.unshift(current.property.name);
        current = current.object as t.JSXMemberExpression | t.JSXIdentifier;
      }
      
      if (t.isJSXIdentifier(current)) {
        parts.unshift(current.name);
      }
      
      return parts.join('.');
    }
    
    if (t.isJSXNamespacedName(name)) {
      return `${name.namespace.name}:${name.name.name}`;
    }
    
    return 'Unknown';
  }
  
  /**
   * Extrait les attributs d'un élément JSX
   */
  private extractAttributes(node: t.JSXElement): ElementAttributes {
    const attrs: ElementAttributes = {};
    
    for (const attr of node.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const name = attr.name.name;
        const value = this.extractAttributeValue(attr.value);
        
        if (value !== undefined) {
          if (name === 'className') {
            attrs.className = String(value);
          } else if (name === 'id') {
            attrs.id = String(value);
          } else if (name === 'style') {
            attrs.style = typeof value === 'object' ? value as Record<string, string> : undefined;
          } else {
            attrs[name] = value;
          }
        }
      }
    }
    
    return attrs;
  }
  
  /**
   * Extrait la valeur d'un attribut JSX
   */
  private extractAttributeValue(
    value: t.JSXAttribute['value']
  ): string | boolean | Record<string, string> | undefined {
    if (value === null) {
      return true; // Boolean attribute like `disabled`
    }
    
    if (t.isStringLiteral(value)) {
      return value.value;
    }
    
    if (t.isJSXExpressionContainer(value)) {
      const expr = value.expression;
      
      if (t.isStringLiteral(expr)) {
        return expr.value;
      }
      
      if (t.isTemplateLiteral(expr) && expr.quasis.length === 1) {
        return expr.quasis[0].value.cooked || expr.quasis[0].value.raw;
      }
      
      if (t.isObjectExpression(expr)) {
        // Pour les styles inline
        const obj: Record<string, string> = {};
        for (const prop of expr.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            if (t.isStringLiteral(prop.value)) {
              obj[prop.key.name] = prop.value.value;
            } else if (t.isNumericLiteral(prop.value)) {
              obj[prop.key.name] = String(prop.value.value);
            }
          }
        }
        return obj;
      }
      
      // Pour les expressions complexes, on garde une représentation string
      if (t.isIdentifier(expr)) {
        return `{${expr.name}}`;
      }
    }
    
    return undefined;
  }
  
  /**
   * Extrait le contenu texte direct d'un élément
   */
  private extractTextContent(node: t.JSXElement): string | undefined {
    const textParts: string[] = [];
    
    for (const child of node.children) {
      if (t.isJSXText(child)) {
        const text = child.value.trim();
        if (text) {
          textParts.push(text);
        }
      } else if (t.isJSXExpressionContainer(child)) {
        if (t.isStringLiteral(child.expression)) {
          textParts.push(child.expression.value);
        }
      }
    }
    
    return textParts.length > 0 ? textParts.join(' ') : undefined;
  }
  
  /**
   * Parse les styles inline en objet
   */
  private parseInlineStyles(style?: Record<string, string>): Record<string, string> {
    if (!style || typeof style !== 'object') {
      return {};
    }
    return style;
  }
  
  /**
   * Trouve un élément par sa position dans le fichier
   */
  findElementAtPosition(
    ast: t.File,
    filePath: string,
    line: number,
    column: number
  ): t.JSXElement | null {
    let found: t.JSXElement | null = null;
    
    traverse(ast, {
      JSXElement: (nodePath: NodePath<t.JSXElement>) => {
        const loc = nodePath.node.loc;
        if (!loc) return;
        
        const inRange =
          line >= loc.start.line &&
          line <= loc.end.line &&
          (line > loc.start.line || column >= loc.start.column) &&
          (line < loc.end.line || column <= loc.end.column);
        
        if (inRange) {
          // On garde le plus profond (le plus spécifique)
          found = nodePath.node;
        }
      },
    });
    
    return found;
  }
  
  /**
   * Parse tous les fichiers d'un répertoire
   */
  async parseDirectory(dirPath: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    
    async function walk(dir: string): Promise<string[]> {
      const files: string[] = [];
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await walk(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
      
      return files;
    }
    
    const files = await walk(dirPath);
    
    for (const file of files) {
      // Skip ignored patterns
      if (this.options.ignorePatterns.some(p => p.test(file))) {
        continue;
      }
      
      const result = await this.parseFile(file);
      if (result.elements.length > 0 || result.errors.length > 0) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Re-parse un fichier et met à jour le registry
   */
  async reparseFile(filePath: string): Promise<ParseResult> {
    // Clear les anciens éléments de ce fichier
    this.registry.clearFile(filePath);
    
    // Re-parser
    return this.parseFile(filePath);
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let parserInstance: ASTParser | null = null;

export function getASTParser(options?: ParseOptions): ASTParser {
  if (!parserInstance) {
    parserInstance = new ASTParser(options);
  }
  return parserInstance;
}

export function resetASTParser(): void {
  parserInstance = null;
}
