/**
 * REALM Protocol - RealmID Generation
 * 
 * Génération d'identifiants uniques et stables pour les éléments.
 * Le RealmID survit aux modifications de contenu tant que la structure reste stable.
 */

import { createHash } from 'crypto';
import * as t from '@babel/types';
import type { RealmID, SourceLocation } from './types';

/**
 * Génère un RealmID unique pour un élément JSX
 * 
 * @param filePath - Chemin du fichier source (relatif au workspace)
 * @param componentName - Nom du composant parent
 * @param node - Noeud AST de l'élément
 * @param astPath - Chemin dans l'AST
 */
export function generateRealmID(
  filePath: string,
  componentName: string,
  node: t.Node,
  astPath: string
): RealmID {
  const location = extractSourceLocation(node);
  
  // Hash basé sur des éléments stables
  const hashInput = [
    filePath,
    componentName,
    astPath,
    location.start.line,
    location.start.column,
  ].join(':');
  
  const hash = createHash('sha256')
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
export function extractSourceLocation(node: t.Node): SourceLocation {
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
export function isValidRealmID(realmId: unknown): realmId is RealmID {
  if (!realmId || typeof realmId !== 'object') {
    return false;
  }
  
  const r = realmId as Record<string, unknown>;
  
  return (
    typeof r.hash === 'string' &&
    r.hash.length === 12 &&
    typeof r.sourceFile === 'string' &&
    typeof r.componentName === 'string' &&
    typeof r.astPath === 'string' &&
    typeof r.version === 'number' &&
    isValidSourceLocation(r.sourceLocation)
  );
}

/**
 * Valide une SourceLocation
 */
export function isValidSourceLocation(loc: unknown): loc is SourceLocation {
  if (!loc || typeof loc !== 'object') {
    return false;
  }
  
  const l = loc as Record<string, unknown>;
  
  const isValidPos = (pos: unknown): boolean => {
    if (!pos || typeof pos !== 'object') return false;
    const p = pos as Record<string, unknown>;
    return (
      typeof p.line === 'number' &&
      typeof p.column === 'number' &&
      typeof p.index === 'number'
    );
  };
  
  return isValidPos(l.start) && isValidPos(l.end);
}

/**
 * Compare deux RealmIDs (même hash)
 */
export function isSameRealmID(a: RealmID, b: RealmID): boolean {
  return a.hash === b.hash;
}

/**
 * Compare deux RealmIDs avec version
 */
export function isSameVersion(a: RealmID, b: RealmID): boolean {
  return a.hash === b.hash && a.version === b.version;
}

/**
 * Incrémente la version d'un RealmID
 */
export function bumpVersion(realmId: RealmID): RealmID {
  return {
    ...realmId,
    version: realmId.version + 1,
  };
}

/**
 * Sérialise un RealmID pour transport
 */
export function serializeRealmID(realmId: RealmID): string {
  return JSON.stringify(realmId);
}

/**
 * Désérialise un RealmID
 */
export function deserializeRealmID(serialized: string): RealmID | null {
  try {
    const parsed = JSON.parse(serialized);
    if (isValidRealmID(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Génère un hash court pour debug/display
 */
export function shortHash(realmId: RealmID): string {
  return realmId.hash.substring(0, 6);
}

/**
 * Génère un identifiant lisible pour debug
 */
export function toDebugString(realmId: RealmID): string {
  return `[${shortHash(realmId)}] ${realmId.componentName}@${realmId.sourceFile}:${realmId.sourceLocation.start.line}`;
}

/**
 * Trouve le chemin AST d'un noeud (pour reconstruction)
 */
export function buildASTPath(ancestors: t.Node[]): string {
  const parts: string[] = [];
  
  for (let i = 0; i < ancestors.length; i++) {
    const node = ancestors[i];
    const parent = ancestors[i - 1];
    
    if (!parent) {
      parts.push(node.type);
      continue;
    }
    
    // Trouver la clé dans le parent
    for (const key of Object.keys(parent)) {
      const value = (parent as unknown as Record<string, unknown>)[key];
      
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
export function extractComponentName(node: t.Node): string {
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
