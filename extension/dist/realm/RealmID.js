"use strict";
/**
 * REALM Protocol - RealmID Generation
 *
 * Génération d'identifiants uniques et stables pour les éléments.
 * Le RealmID survit aux modifications de contenu tant que la structure reste stable.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRealmID = generateRealmID;
exports.extractSourceLocation = extractSourceLocation;
exports.isValidRealmID = isValidRealmID;
exports.isValidSourceLocation = isValidSourceLocation;
exports.isSameRealmID = isSameRealmID;
exports.isSameVersion = isSameVersion;
exports.bumpVersion = bumpVersion;
exports.serializeRealmID = serializeRealmID;
exports.deserializeRealmID = deserializeRealmID;
exports.shortHash = shortHash;
exports.toDebugString = toDebugString;
exports.buildASTPath = buildASTPath;
exports.extractComponentName = extractComponentName;
const crypto_1 = require("crypto");
const t = __importStar(require("@babel/types"));
/**
 * Génère un RealmID unique pour un élément JSX
 *
 * @param filePath - Chemin du fichier source (relatif au workspace)
 * @param componentName - Nom du composant parent
 * @param node - Noeud AST de l'élément
 * @param astPath - Chemin dans l'AST
 */
function generateRealmID(filePath, componentName, node, astPath) {
    const location = extractSourceLocation(node);
    // Hash basé sur des éléments stables
    const hashInput = [
        filePath,
        componentName,
        astPath,
        location.start.line,
        location.start.column,
    ].join(':');
    const hash = (0, crypto_1.createHash)('sha256')
        .update(hashInput)
        .digest('hex')
        .substring(0, 12);
    return {
        hash,
        sourceFile: filePath,
        componentName,
        astPath,
        sourceLocation: location,
        version: 1,
    };
}
/**
 * Extrait la location source d'un noeud AST
 */
function extractSourceLocation(node) {
    const loc = node.loc;
    const start = node.start ?? 0;
    const end = node.end ?? 0;
    return {
        start: {
            line: loc?.start.line ?? 0,
            column: loc?.start.column ?? 0,
            index: start,
        },
        end: {
            line: loc?.end.line ?? 0,
            column: loc?.end.column ?? 0,
            index: end,
        },
    };
}
/**
 * Valide un RealmID
 */
function isValidRealmID(realmId) {
    if (!realmId || typeof realmId !== 'object') {
        return false;
    }
    const r = realmId;
    return (typeof r.hash === 'string' &&
        r.hash.length === 12 &&
        typeof r.sourceFile === 'string' &&
        typeof r.componentName === 'string' &&
        typeof r.astPath === 'string' &&
        typeof r.version === 'number' &&
        isValidSourceLocation(r.sourceLocation));
}
/**
 * Valide une SourceLocation
 */
function isValidSourceLocation(loc) {
    if (!loc || typeof loc !== 'object') {
        return false;
    }
    const l = loc;
    const isValidPos = (pos) => {
        if (!pos || typeof pos !== 'object')
            return false;
        const p = pos;
        return (typeof p.line === 'number' &&
            typeof p.column === 'number' &&
            typeof p.index === 'number');
    };
    return isValidPos(l.start) && isValidPos(l.end);
}
/**
 * Compare deux RealmIDs (même hash)
 */
function isSameRealmID(a, b) {
    return a.hash === b.hash;
}
/**
 * Compare deux RealmIDs avec version
 */
function isSameVersion(a, b) {
    return a.hash === b.hash && a.version === b.version;
}
/**
 * Incrémente la version d'un RealmID
 */
function bumpVersion(realmId) {
    return {
        ...realmId,
        version: realmId.version + 1,
    };
}
/**
 * Sérialise un RealmID pour transport
 */
function serializeRealmID(realmId) {
    return JSON.stringify(realmId);
}
/**
 * Désérialise un RealmID
 */
function deserializeRealmID(serialized) {
    try {
        const parsed = JSON.parse(serialized);
        if (isValidRealmID(parsed)) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Génère un hash court pour debug/display
 */
function shortHash(realmId) {
    return realmId.hash.substring(0, 6);
}
/**
 * Génère un identifiant lisible pour debug
 */
function toDebugString(realmId) {
    return `[${shortHash(realmId)}] ${realmId.componentName}@${realmId.sourceFile}:${realmId.sourceLocation.start.line}`;
}
/**
 * Trouve le chemin AST d'un noeud (pour reconstruction)
 */
function buildASTPath(ancestors) {
    const parts = [];
    for (let i = 0; i < ancestors.length; i++) {
        const node = ancestors[i];
        const parent = ancestors[i - 1];
        if (!parent) {
            parts.push(node.type);
            continue;
        }
        // Trouver la clé dans le parent
        for (const key of Object.keys(parent)) {
            const value = parent[key];
            if (value === node) {
                parts.push(`${node.type}.${key}`);
                break;
            }
            if (Array.isArray(value)) {
                const index = value.indexOf(node);
                if (index !== -1) {
                    parts.push(`${node.type}[${index}]`);
                    break;
                }
            }
        }
    }
    return parts.join(' > ');
}
/**
 * Extrait le nom du composant depuis un noeud fonction/classe
 */
function extractComponentName(node) {
    // Function declaration: function MyComponent() {}
    if (t.isFunctionDeclaration(node) && node.id) {
        return node.id.name;
    }
    // Arrow function in variable: const MyComponent = () => {}
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
        return node.id.name;
    }
    // Class declaration: class MyComponent {}
    if (t.isClassDeclaration(node) && node.id) {
        return node.id.name;
    }
    // Export default function: export default function() {}
    if (t.isExportDefaultDeclaration(node)) {
        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            return node.declaration.id.name;
        }
    }
    return 'Anonymous';
}
//# sourceMappingURL=RealmID.js.map