# REALM Protocol - Copilot Instructions

> Ces instructions guident GitHub Copilot pour maintenir une architecture propre et robuste lors du développement du protocole REALM.

## 🎯 Contexte du Projet

Ce projet est une **extension VS Code** couplée à un **panel Next.js** permettant l'édition visuelle en temps réel d'applications web. Le protocole REALM (Real-time Element Adaptation Layer for Modifications) vise à atteindre 90%+ de fiabilité.

### Stack Technique
- **Extension**: TypeScript, VS Code API, Express, WebSocket, Babel AST
- **Panel Web**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Communication**: WebSocket (port 57129), PostMessage (iframe)

---

## 📁 Structure des Fichiers

### Extension VS Code (`extension/src/`)

```
extension/src/
├── extension.ts           # Point d'entrée - NE PAS surcharger
├── server.ts              # Serveur HTTP/WS - Router uniquement
├── modelBridge.ts         # API vscode.lm - Singleton
├── chatParticipant.ts     # @builder participant
├── activityTracker.ts     # Events tracking
├── sidebarProvider.ts     # Webview provider
├── types.ts               # Types PARTAGÉS avec www/
│
└── realm/                 # 🆕 REALM Protocol
    ├── index.ts           # Exports publics
    ├── RealmID.ts         # Identification éléments
    ├── ElementRegistry.ts # Registry singleton
    ├── TransactionManager.ts
    ├── ChangeLog.ts
    │
    ├── adapters/          # Stratégies par framework
    │   ├── types.ts
    │   ├── AdapterRegistry.ts
    │   ├── ReactTailwindAdapter.ts
    │   └── ...
    │
    └── sync/              # Synchronisation
        ├── EventBus.ts
        ├── SyncEngine.ts
        └── events.ts
```

### Panel Web (`www/src/`)

```
www/src/
├── app/
│   ├── page.tsx           # Page principale - Composition uniquement
│   └── layout.tsx         # Layout global
│
├── components/
│   ├── LivePreviewWithSelector.tsx  # Container preview
│   ├── ElementEditor.tsx            # Éditeur visuel
│   ├── DOMOverlay.tsx               # Overlay SVG
│   ├── ai-elements/                 # Composants UI réutilisables
│   └── ui/                          # shadcn/ui components
│
├── hooks/
│   ├── useVSCodeBridge.ts           # WebSocket principal
│   ├── useDOMSelectorPostMessage.ts # Sélection DOM
│   └── useRealmSync.ts              # 🆕 Sync REALM
│
├── lib/
│   ├── utils.ts                     # Utilitaires (cn, etc.)
│   ├── css-to-tailwind.ts           # Conversion CSS→TW
│   └── position-to-tailwind.ts      # Position→TW
│
├── realm/                           # 🆕 REALM client
│   ├── RealmClient.ts
│   └── types.ts
│
└── types.ts                         # Types PARTAGÉS
```

---

## 🏗️ Patterns Architecturaux

### 1. Singleton Pattern (Extension)

```typescript
// ✅ BON - Singleton pour les services partagés
export class ElementRegistry {
  private static instance: ElementRegistry;
  
  private constructor() {}
  
  public static getInstance(): ElementRegistry {
    if (!ElementRegistry.instance) {
      ElementRegistry.instance = new ElementRegistry();
    }
    return ElementRegistry.instance;
  }
}

// ❌ MAUVAIS - Instances multiples
const registry1 = new ElementRegistry();
const registry2 = new ElementRegistry();
```

### 2. Adapter Pattern (Frameworks)

```typescript
// ✅ BON - Interface commune, implémentations spécifiques
interface FrameworkAdapter {
  name: string;
  detect(filePath: string, content: string): boolean;
  parseElement(ast: AST, realmId: RealmID): ParsedElement;
  applyStyles(element: ParsedElement, styles: StyleChanges): ModifiedAST;
}

class ReactTailwindAdapter implements FrameworkAdapter {
  // Implémentation spécifique React + Tailwind
}

class VueSFCAdapter implements FrameworkAdapter {
  // Implémentation spécifique Vue SFC
}
```

### 3. Transaction Pattern (Modifications)

```typescript
// ✅ BON - Toujours utiliser des transactions
const tx = await transactionManager.beginTransaction(realmId);
try {
  tx.addOperation({ type: 'style', ... });
  await tx.validate();
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}

// ❌ MAUVAIS - Modification directe sans transaction
fs.writeFileSync(file, newContent);
```

### 4. Event-Driven (Synchronisation)

```typescript
// ✅ BON - Communication via events
eventBus.emit({
  type: 'STYLE_CHANGED',
  realmId,
  styles,
  source: 'editor'
});

eventBus.on('STYLE_CHANGED', (event) => {
  // Réagir au changement
});

// ❌ MAUVAIS - Appels directs entre modules
elementEditor.updateStyle(...);
domPreview.refresh();
sourceFile.modify(...);
```

---

## 📝 Conventions de Code

### Nommage

```typescript
// Types et Interfaces - PascalCase
interface RealmID { ... }
type FrameworkAdapter = { ... }

// Classes - PascalCase
class TransactionManager { ... }

// Fonctions et méthodes - camelCase
function generateRealmHash() { ... }
async applyChangesToFile() { ... }

// Constantes - SCREAMING_SNAKE_CASE
const MAX_TRANSACTION_AGE = 300000;
const DEFAULT_PORT = 57129;

// Variables - camelCase
const realmId = generateRealmHash();
let isProcessing = false;
```

### Fichiers

```typescript
// Un fichier = Un concept principal
// ✅ RealmID.ts - Contient RealmID type + fonctions associées
// ❌ utils.ts avec 50 fonctions non liées

// Nommage des fichiers
// PascalCase pour classes/composants: TransactionManager.ts, ElementEditor.tsx
// camelCase pour hooks: useRealmSync.ts
// kebab-case pour utilitaires: css-to-tailwind.ts
```

### Imports

```typescript
// ✅ BON - Ordre des imports
// 1. Node.js built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External packages
import * as vscode from 'vscode';
import express from 'express';
import * as t from '@babel/types';

// 3. Internal modules (absolus)
import { RealmID } from './realm/RealmID';
import { TransactionManager } from './realm/TransactionManager';

// 4. Types (si séparés)
import type { FrameworkAdapter } from './realm/adapters/types';
```

### Commentaires

```typescript
// ✅ BON - JSDoc pour les APIs publiques
/**
 * Génère un RealmID unique pour un élément
 * @param filePath - Chemin absolu du fichier source
 * @param astNode - Noeud AST de l'élément
 * @returns RealmID avec hash stable
 */
export function generateRealmID(filePath: string, astNode: t.Node): RealmID {
  // ...
}

// ✅ BON - Commentaire explicatif pour logique complexe
// On utilise nth-of-type car les éléments peuvent avoir les mêmes classes
// mais être à des positions différentes dans le DOM
const nthIndex = selectorParts.match(/:nth-of-type\((\d+)\)/);

// ❌ MAUVAIS - Commentaire évident
// Incrémente le compteur
counter++;
```

---

## 🚫 Anti-Patterns à Éviter

### 1. God Object

```typescript
// ❌ MAUVAIS - server.ts fait tout
class AppBuilderServer {
  // 2500+ lignes avec HTTP, WS, AST, fichiers, projets...
}

// ✅ BON - Responsabilités séparées
class HttpRouter { ... }
class WebSocketHandler { ... }
class RealmController { ... }
```

### 2. Callback Hell

```typescript
// ❌ MAUVAIS
fs.readFile(file, (err, data) => {
  parseAST(data, (err, ast) => {
    findElement(ast, (err, element) => {
      // ...
    });
  });
});

// ✅ BON - async/await
const data = await fs.promises.readFile(file);
const ast = await parseAST(data);
const element = await findElement(ast);
```

### 3. Magic Strings

```typescript
// ❌ MAUVAIS
if (message.type === 'applyElementChanges') { ... }
ws.send(JSON.stringify({ type: 'elementChangesApplied' }));

// ✅ BON - Constantes typées
const MessageTypes = {
  APPLY_ELEMENT_CHANGES: 'applyElementChanges',
  ELEMENT_CHANGES_APPLIED: 'elementChangesApplied',
} as const;

if (message.type === MessageTypes.APPLY_ELEMENT_CHANGES) { ... }
```

### 4. Mutation directe d'état

```typescript
// ❌ MAUVAIS
element.styles.backgroundColor = 'red';
existingClasses.push(newClass);

// ✅ BON - Immutabilité
const newStyles = { ...element.styles, backgroundColor: 'red' };
const newClasses = [...existingClasses, newClass];
```

---

## 🔧 Règles Spécifiques REALM

### RealmID

```typescript
// Le RealmID DOIT être stable entre les sessions
// Il est basé sur: filePath + componentName + astPosition

interface RealmID {
  hash: string;        // SHA256 court (12 chars)
  sourceFile: string;  // Chemin relatif au workspace
  astPath: string;     // Ex: "JSXElement[0].children[2]"
  componentName: string;
}

// ✅ BON - Hash déterministe
const hash = createHash('sha256')
  .update(`${filePath}:${componentName}:${astStart}:${astEnd}`)
  .digest('hex')
  .substring(0, 12);
```

### Transactions

```typescript
// TOUTE modification de fichier DOIT passer par une transaction
// Exceptions: lectures seules, fichiers temporaires

// ✅ BON
const tx = await txManager.begin(realmId);
tx.addOperation({ type: 'style', target: realmId, payload: styles });
const validation = await tx.validate();
if (validation.valid) {
  await tx.commit();
}

// ❌ MAUVAIS - Modification sans transaction
fs.writeFileSync(file, modifiedContent);
```

### Adapters

```typescript
// Chaque adapter DOIT implémenter l'interface complète
// L'adapter DOIT être auto-détectable via detect()

// ✅ BON
class MyAdapter implements FrameworkAdapter {
  name = 'my-adapter';
  
  detect(filePath: string, content: string): boolean {
    // Logique de détection claire
    return filePath.endsWith('.tsx') && content.includes('myFramework');
  }
  
  // ... toutes les méthodes implémentées
}
```

### Events

```typescript
// Les events DOIVENT être typés strictement
// Les events DOIVENT inclure la source

type RealmEvent = 
  | { type: 'STYLE_CHANGED'; realmId: RealmID; styles: StyleChanges; source: EventSource }
  | { type: 'TEXT_CHANGED'; realmId: RealmID; text: string; source: EventSource }
  // ...

type EventSource = 'editor' | 'panel' | 'dom' | 'file-watcher';
```

---

## 📋 Checklist Avant Commit

### Code Quality
- [ ] Pas de `any` non justifié
- [ ] Tous les types sont explicites
- [ ] Pas de console.log en production (utiliser le logger)
- [ ] Erreurs gérées avec try/catch appropriés
- [ ] Pas de TODO sans issue associée

### Architecture
- [ ] Nouveau code dans le bon dossier
- [ ] Pas de dépendance circulaire
- [ ] Interface définie avant implémentation
- [ ] Singleton si état partagé nécessaire

### REALM Specific
- [ ] Modifications via Transaction
- [ ] Events émis pour changements d'état
- [ ] RealmID utilisé (pas de sélecteurs CSS bruts)
- [ ] Adapter pattern pour nouveau framework

### Tests (Futur)
- [ ] Tests unitaires pour fonctions pures
- [ ] Tests d'intégration pour transactions
- [ ] Mocks pour VS Code API

---

## 🔗 Références

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Babel Parser](https://babeljs.io/docs/babel-parser)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
