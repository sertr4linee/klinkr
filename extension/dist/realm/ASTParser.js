"use strict";
/**
 * REALM Protocol - AST Parser
 *
 * Parse les fichiers source et extrait les éléments JSX/HTML
 * avec leur RealmID correspondant.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTParser = void 0;
exports.getASTParser = getASTParser;
exports.resetASTParser = resetASTParser;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const RealmID_1 = require("./RealmID");
const ElementRegistry_1 = require("./ElementRegistry");
const DEFAULT_OPTIONS = {
    extensions: ['.tsx', '.jsx', '.js', '.ts'],
    ignorePatterns: [/node_modules/, /\.next/, /dist/, /build/],
    autoDetectFramework: true,
};
// ============================================================================
// AST Parser Class
// ============================================================================
class ASTParser {
    options;
    registry;
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.registry = ElementRegistry_1.ElementRegistry.getInstance();
    }
    /**
     * Parse un fichier et enregistre ses éléments
     */
    async parseFile(filePath) {
        const startTime = Date.now();
        const errors = [];
        const elements = [];
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
        }
        catch (error) {
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
    parseContent(content, filePath) {
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
                ].filter(Boolean),
                sourceFilename: filePath,
                errorRecovery: true,
            });
        }
        catch (error) {
            console.error(`[ASTParser] Parse error in ${filePath}:`, error);
            return null;
        }
    }
    /**
     * Détecte le framework utilisé dans le fichier
     */
    detectFramework(content, filePath) {
        // Détection React
        const hasReactImport = /import\s+.*\s+from\s+['"]react['"]/.test(content);
        const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+\s/.test(content);
        // Détection Tailwind
        const hasTailwindClasses = /className\s*=\s*["'`][^"'`]*(?:flex|grid|p-|m-|text-|bg-|w-|h-)/.test(content);
        // Détection CSS Modules
        const hasCSSModulesImport = /import\s+\w+\s+from\s+['"].*\.module\.css['"]/.test(content);
        // Détection styled-components
        const hasStyledComponents = /import\s+styled\s+from\s+['"]styled-components['"]/.test(content);
        let styleSystem = 'css';
        if (hasTailwindClasses) {
            styleSystem = 'tailwind';
        }
        else if (hasCSSModulesImport) {
            styleSystem = 'css-modules';
        }
        else if (hasStyledComponents) {
            styleSystem = 'styled-components';
        }
        else if (content.includes('style={{') || content.includes('style={')) {
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
    extractElements(ast, filePath, framework) {
        const elements = [];
        const componentStack = [];
        (0, traverse_1.default)(ast, {
            // Tracker le composant courant
            FunctionDeclaration: {
                enter: (nodePath) => {
                    if (nodePath.node.id?.name) {
                        componentStack.push(nodePath.node.id.name);
                    }
                },
                exit: (nodePath) => {
                    if (nodePath.node.id?.name) {
                        componentStack.pop();
                    }
                },
            },
            VariableDeclarator: {
                enter: (nodePath) => {
                    if (t.isIdentifier(nodePath.node.id) &&
                        (t.isArrowFunctionExpression(nodePath.node.init) ||
                            t.isFunctionExpression(nodePath.node.init))) {
                        componentStack.push(nodePath.node.id.name);
                    }
                },
                exit: (nodePath) => {
                    if (t.isIdentifier(nodePath.node.id) &&
                        (t.isArrowFunctionExpression(nodePath.node.init) ||
                            t.isFunctionExpression(nodePath.node.init))) {
                        componentStack.pop();
                    }
                },
            },
            // Extraire les éléments JSX
            JSXElement: (nodePath) => {
                const node = nodePath.node;
                const componentName = componentStack[componentStack.length - 1] || 'Unknown';
                // Construire le chemin AST depuis les ancêtres
                const ancestors = nodePath.getAncestry().map(p => p.node);
                const astPath = (0, RealmID_1.buildASTPath)(ancestors);
                // Générer le RealmID
                const realmId = (0, RealmID_1.generateRealmID)(filePath, componentName, node, astPath);
                // Extraire les attributs
                const attributes = this.extractAttributes(node);
                // Extraire le tag name
                const tagName = this.getTagName(node.openingElement);
                // Extraire le contenu texte direct
                const textContent = this.extractTextContent(node);
                // Construire ElementInfo
                const elementInfo = {
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
    getTagName(openingElement) {
        const name = openingElement.name;
        if (t.isJSXIdentifier(name)) {
            return name.name;
        }
        if (t.isJSXMemberExpression(name)) {
            // Ex: Icons.Home -> "Icons.Home"
            const parts = [];
            let current = name;
            while (t.isJSXMemberExpression(current)) {
                parts.unshift(current.property.name);
                current = current.object;
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
    extractAttributes(node) {
        const attrs = {};
        for (const attr of node.openingElement.attributes) {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const name = attr.name.name;
                const value = this.extractAttributeValue(attr.value);
                if (value !== undefined) {
                    if (name === 'className') {
                        attrs.className = String(value);
                    }
                    else if (name === 'id') {
                        attrs.id = String(value);
                    }
                    else if (name === 'style') {
                        attrs.style = typeof value === 'object' ? value : undefined;
                    }
                    else {
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
    extractAttributeValue(value) {
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
                const obj = {};
                for (const prop of expr.properties) {
                    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                        if (t.isStringLiteral(prop.value)) {
                            obj[prop.key.name] = prop.value.value;
                        }
                        else if (t.isNumericLiteral(prop.value)) {
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
    extractTextContent(node) {
        const textParts = [];
        for (const child of node.children) {
            if (t.isJSXText(child)) {
                const text = child.value.trim();
                if (text) {
                    textParts.push(text);
                }
            }
            else if (t.isJSXExpressionContainer(child)) {
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
    parseInlineStyles(style) {
        if (!style || typeof style !== 'object') {
            return {};
        }
        return style;
    }
    /**
     * Trouve un élément par sa position dans le fichier
     */
    findElementAtPosition(ast, filePath, line, column) {
        let found = null;
        (0, traverse_1.default)(ast, {
            JSXElement: (nodePath) => {
                const loc = nodePath.node.loc;
                if (!loc)
                    return;
                const inRange = line >= loc.start.line &&
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
    async parseDirectory(dirPath) {
        const results = [];
        async function walk(dir) {
            const files = [];
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await walk(fullPath));
                }
                else if (entry.isFile()) {
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
    async reparseFile(filePath) {
        // Clear les anciens éléments de ce fichier
        this.registry.clearFile(filePath);
        // Re-parser
        return this.parseFile(filePath);
    }
}
exports.ASTParser = ASTParser;
// ============================================================================
// Singleton instance
// ============================================================================
let parserInstance = null;
function getASTParser(options) {
    if (!parserInstance) {
        parserInstance = new ASTParser(options);
    }
    return parserInstance;
}
function resetASTParser() {
    parserInstance = null;
}
//# sourceMappingURL=ASTParser.js.map