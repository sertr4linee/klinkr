"use strict";
/**
 * REALM Protocol - React Tailwind Adapter
 *
 * Adapter pour React avec Tailwind CSS.
 * Gère la modification des classes Tailwind dans les composants React.
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
exports.ReactTailwindAdapter = void 0;
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
const RealmID_1 = require("../RealmID");
// ============================================================================
// React Tailwind Adapter
// ============================================================================
class ReactTailwindAdapter {
    name = 'react-tailwind';
    priority = 100; // Haute priorité
    // ============================================================================
    // Detection
    // ============================================================================
    detect(filePath, content) {
        // Doit être un fichier React (.jsx, .tsx)
        const isReactFile = /\.(jsx|tsx)$/.test(filePath);
        if (!isReactFile)
            return false;
        // Doit avoir des classes Tailwind
        const hasTailwindClasses = /className\s*=\s*["'`][^"'`]*(?:flex|grid|p-|m-|text-|bg-|w-|h-|rounded|shadow|border)/.test(content);
        // Ou utiliser cn/clsx/classnames
        const usesTailwindHelper = /import\s+.*\{?\s*(?:cn|clsx|classnames)\s*\}?/.test(content);
        return hasTailwindClasses || usesTailwindHelper;
    }
    // ============================================================================
    // Parsing
    // ============================================================================
    parseElement(ast, realmId) {
        let found = null;
        (0, traverse_1.default)(ast, {
            JSXElement: (path) => {
                const node = path.node;
                const loc = node.loc;
                if (!loc)
                    return;
                // Comparer avec la position dans le RealmID
                if (loc.start.line === realmId.sourceLocation.start.line &&
                    loc.start.column === realmId.sourceLocation.start.column) {
                    found = {
                        realmId,
                        node,
                        ast,
                        attributes: this.extractAttributes(node),
                        path: realmId.astPath,
                        meta: {
                            framework: 'react',
                            styleSystem: 'tailwind',
                            isComponent: this.isComponent(node),
                        },
                    };
                    path.stop();
                }
            },
        });
        return found;
    }
    findAllElements(ast, filePath) {
        const elements = [];
        const componentStack = [];
        (0, traverse_1.default)(ast, {
            FunctionDeclaration: {
                enter: (path) => {
                    if (path.node.id?.name) {
                        componentStack.push(path.node.id.name);
                    }
                },
                exit: (path) => {
                    if (path.node.id?.name) {
                        componentStack.pop();
                    }
                },
            },
            VariableDeclarator: {
                enter: (path) => {
                    if (t.isIdentifier(path.node.id) &&
                        (t.isArrowFunctionExpression(path.node.init) ||
                            t.isFunctionExpression(path.node.init))) {
                        componentStack.push(path.node.id.name);
                    }
                },
                exit: (path) => {
                    if (t.isIdentifier(path.node.id) &&
                        (t.isArrowFunctionExpression(path.node.init) ||
                            t.isFunctionExpression(path.node.init))) {
                        componentStack.pop();
                    }
                },
            },
            JSXElement: (path) => {
                const node = path.node;
                const componentName = componentStack[componentStack.length - 1] || 'Unknown';
                const ancestors = path.getAncestry().map(p => p.node);
                const astPath = (0, RealmID_1.buildASTPath)(ancestors);
                const realmId = (0, RealmID_1.generateRealmID)(filePath, componentName, node, astPath);
                elements.push({
                    realmId,
                    node,
                    ast,
                    attributes: this.extractAttributes(node),
                    path: astPath,
                    meta: {
                        framework: 'react',
                        styleSystem: 'tailwind',
                        isComponent: this.isComponent(node),
                    },
                });
            },
        });
        return elements;
    }
    // ============================================================================
    // Modification
    // ============================================================================
    applyStyles(element, styles) {
        const ast = t.cloneNode(element.ast, true);
        const targetLoc = element.realmId.sourceLocation;
        (0, traverse_1.default)(ast, {
            JSXElement: (path) => {
                const loc = path.node.loc;
                if (!loc)
                    return;
                if (loc.start.line === targetLoc.start.line &&
                    loc.start.column === targetLoc.start.column) {
                    this.updateClassName(path, styles);
                    path.stop();
                }
            },
        });
        return ast;
    }
    applyText(element, text) {
        const ast = t.cloneNode(element.ast, true);
        const targetLoc = element.realmId.sourceLocation;
        (0, traverse_1.default)(ast, {
            JSXElement: (path) => {
                const loc = path.node.loc;
                if (!loc)
                    return;
                if (loc.start.line === targetLoc.start.line &&
                    loc.start.column === targetLoc.start.column) {
                    // Remplacer le contenu texte
                    path.node.children = [t.jsxText(text)];
                    path.stop();
                }
            },
        });
        return ast;
    }
    applyClasses(element, changes) {
        const ast = t.cloneNode(element.ast, true);
        const targetLoc = element.realmId.sourceLocation;
        (0, traverse_1.default)(ast, {
            JSXElement: (path) => {
                const loc = path.node.loc;
                if (!loc)
                    return;
                if (loc.start.line === targetLoc.start.line &&
                    loc.start.column === targetLoc.start.column) {
                    this.modifyClasses(path, changes);
                    path.stop();
                }
            },
        });
        return ast;
    }
    // ============================================================================
    // Code Generation
    // ============================================================================
    generateCode(ast, originalContent) {
        const result = (0, generator_1.default)(ast, {
            retainLines: true,
            retainFunctionParens: true,
            comments: true,
        }, originalContent);
        return result.code;
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
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
                    else {
                        attrs[name] = value;
                    }
                }
            }
        }
        return attrs;
    }
    extractAttributeValue(value) {
        if (value === null)
            return true;
        if (t.isStringLiteral(value))
            return value.value;
        if (t.isJSXExpressionContainer(value)) {
            const expr = value.expression;
            if (t.isStringLiteral(expr))
                return expr.value;
            if (t.isTemplateLiteral(expr) && expr.quasis.length === 1) {
                return expr.quasis[0].value.cooked;
            }
        }
        return undefined;
    }
    isComponent(node) {
        const name = node.openingElement.name;
        if (t.isJSXIdentifier(name)) {
            // Composants commencent par une majuscule
            return /^[A-Z]/.test(name.name);
        }
        return false;
    }
    updateClassName(path, styles) {
        const classNames = this.stylesToTailwind(styles);
        if (classNames.length === 0)
            return;
        const openingElement = path.node.openingElement;
        const classAttr = openingElement.attributes.find(attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className');
        if (classAttr) {
            // Mettre à jour l'attribut existant
            const currentValue = this.extractAttributeValue(classAttr.value);
            const currentClasses = typeof currentValue === 'string' ? currentValue.split(/\s+/) : [];
            // Merger intelligemment (remplacer les conflits)
            const mergedClasses = this.mergeClasses(currentClasses, classNames);
            classAttr.value = t.stringLiteral(mergedClasses.join(' '));
        }
        else {
            // Ajouter l'attribut
            openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(classNames.join(' '))));
        }
    }
    modifyClasses(path, changes) {
        const openingElement = path.node.openingElement;
        const classAttr = openingElement.attributes.find(attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'className');
        let classes = [];
        if (classAttr) {
            const currentValue = this.extractAttributeValue(classAttr.value);
            classes = typeof currentValue === 'string' ? currentValue.split(/\s+/).filter(Boolean) : [];
        }
        // Appliquer les changements
        if (changes.add) {
            for (const cls of changes.add) {
                if (!classes.includes(cls)) {
                    classes.push(cls);
                }
            }
        }
        if (changes.remove) {
            classes = classes.filter(cls => !changes.remove.includes(cls));
        }
        if (changes.replace) {
            for (const { from, to } of changes.replace) {
                const index = classes.indexOf(from);
                if (index !== -1) {
                    classes[index] = to;
                }
            }
        }
        // Mettre à jour ou créer l'attribut
        const newValue = classes.join(' ');
        if (classAttr) {
            classAttr.value = t.stringLiteral(newValue);
        }
        else if (classes.length > 0) {
            openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(newValue)));
        }
    }
    stylesToTailwind(styles) {
        const classes = [];
        // Mapping CSS → Tailwind (simplifié)
        const mapping = {
            backgroundColor: (v) => this.colorToTailwind('bg', v),
            color: (v) => this.colorToTailwind('text', v),
            padding: (v) => this.spacingToTailwind('p', v),
            paddingTop: (v) => this.spacingToTailwind('pt', v),
            paddingRight: (v) => this.spacingToTailwind('pr', v),
            paddingBottom: (v) => this.spacingToTailwind('pb', v),
            paddingLeft: (v) => this.spacingToTailwind('pl', v),
            margin: (v) => this.spacingToTailwind('m', v),
            marginTop: (v) => this.spacingToTailwind('mt', v),
            marginRight: (v) => this.spacingToTailwind('mr', v),
            marginBottom: (v) => this.spacingToTailwind('mb', v),
            marginLeft: (v) => this.spacingToTailwind('ml', v),
            width: (v) => this.sizeToTailwind('w', v),
            height: (v) => this.sizeToTailwind('h', v),
            fontSize: (v) => this.fontSizeToTailwind(v),
            fontWeight: (v) => this.fontWeightToTailwind(v),
            borderRadius: (v) => this.borderRadiusToTailwind(v),
            display: (v) => v === 'flex' ? 'flex' : v === 'grid' ? 'grid' : v === 'block' ? 'block' : v === 'none' ? 'hidden' : null,
            flexDirection: (v) => v === 'column' ? 'flex-col' : v === 'row' ? 'flex-row' : null,
            justifyContent: (v) => this.justifyToTailwind(v),
            alignItems: (v) => this.alignToTailwind(v),
            gap: (v) => this.spacingToTailwind('gap', v),
        };
        for (const [prop, value] of Object.entries(styles)) {
            if (value && mapping[prop]) {
                const twClass = mapping[prop](value);
                if (twClass)
                    classes.push(twClass);
            }
        }
        return classes;
    }
    colorToTailwind(prefix, value) {
        // Simplification: on accepte les couleurs Tailwind directement ou hex
        if (value.startsWith('#')) {
            return `${prefix}-[${value}]`;
        }
        // Assume c'est déjà une couleur Tailwind
        return `${prefix}-${value}`;
    }
    spacingToTailwind(prefix, value) {
        const num = parseFloat(value);
        if (isNaN(num))
            return null;
        // Tailwind spacing scale
        const scale = {
            0: '0', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6',
            32: '8', 40: '10', 48: '12', 64: '16', 80: '20', 96: '24',
        };
        if (scale[num]) {
            return `${prefix}-${scale[num]}`;
        }
        return `${prefix}-[${value}]`;
    }
    sizeToTailwind(prefix, value) {
        if (value === '100%')
            return `${prefix}-full`;
        if (value === 'auto')
            return `${prefix}-auto`;
        if (value === 'fit-content')
            return `${prefix}-fit`;
        return `${prefix}-[${value}]`;
    }
    fontSizeToTailwind(value) {
        const sizes = {
            '12px': 'text-xs', '14px': 'text-sm', '16px': 'text-base',
            '18px': 'text-lg', '20px': 'text-xl', '24px': 'text-2xl',
            '30px': 'text-3xl', '36px': 'text-4xl',
        };
        return sizes[value] || `text-[${value}]`;
    }
    fontWeightToTailwind(value) {
        const weights = {
            '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
            '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
            '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black',
        };
        return weights[value] || null;
    }
    borderRadiusToTailwind(value) {
        const radii = {
            '0': 'rounded-none', '2px': 'rounded-sm', '4px': 'rounded',
            '6px': 'rounded-md', '8px': 'rounded-lg', '12px': 'rounded-xl',
            '16px': 'rounded-2xl', '24px': 'rounded-3xl', '9999px': 'rounded-full',
        };
        return radii[value] || `rounded-[${value}]`;
    }
    justifyToTailwind(value) {
        const map = {
            'flex-start': 'justify-start', 'flex-end': 'justify-end',
            'center': 'justify-center', 'space-between': 'justify-between',
            'space-around': 'justify-around', 'space-evenly': 'justify-evenly',
        };
        return map[value] || null;
    }
    alignToTailwind(value) {
        const map = {
            'flex-start': 'items-start', 'flex-end': 'items-end',
            'center': 'items-center', 'baseline': 'items-baseline',
            'stretch': 'items-stretch',
        };
        return map[value] || null;
    }
    mergeClasses(existing, incoming) {
        // Groupes de classes conflictuelles
        const conflictGroups = [
            /^(p|pt|pr|pb|pl|px|py)-/,
            /^(m|mt|mr|mb|ml|mx|my)-/,
            /^(w|min-w|max-w)-/,
            /^(h|min-h|max-h)-/,
            /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[)/,
            /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/,
            /^bg-/,
            /^rounded/,
            /^(flex|grid|block|inline|hidden)$/,
            /^justify-/,
            /^items-/,
            /^gap-/,
        ];
        const result = [...existing];
        for (const incomingClass of incoming) {
            // Trouver quel groupe de conflit
            let conflictGroup = null;
            for (const group of conflictGroups) {
                if (group.test(incomingClass)) {
                    conflictGroup = group;
                    break;
                }
            }
            if (conflictGroup) {
                // Supprimer les classes existantes du même groupe
                for (let i = result.length - 1; i >= 0; i--) {
                    if (conflictGroup.test(result[i])) {
                        result.splice(i, 1);
                    }
                }
            }
            result.push(incomingClass);
        }
        return result;
    }
}
exports.ReactTailwindAdapter = ReactTailwindAdapter;
//# sourceMappingURL=ReactTailwindAdapter.js.map