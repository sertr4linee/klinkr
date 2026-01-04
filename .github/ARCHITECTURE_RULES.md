# REALM Protocol - Architecture Rules

> Règles strictes pour maintenir l'intégrité architecturale du projet

---

## 🏛️ Principes Fondamentaux

### 1. Single Source of Truth (SSOT)

```
ElementRegistry est LA source de vérité pour les éléments trackés.
ChangeLog est LA source de vérité pour l'historique des modifications.
```

**Règle**: Jamais de duplication d'état entre composants. Si une donnée existe dans le Registry, les autres composants y accèdent via le Registry.

### 2. Unidirectional Data Flow

```
User Action → Event → Transaction → File System → Event → UI Update
```

**Règle**: Les modifications ne remontent JAMAIS directement. Toujours passer par le système d'events.

### 3. Fail-Safe by Default

**Règle**: En cas de doute, NE PAS modifier le fichier. Mieux vaut échouer proprement que corrompre le code source.

---

## 📐 Règles de Structure

### R1: Séparation Extension / Panel

```
extension/     → Code côté VS Code (Node.js)
www/           → Code côté navigateur (Next.js)
shared/        → Types et utilitaires partagés (UNIQUEMENT types)
```

**Règle**: JAMAIS d'import direct entre extension/ et www/. Communication UNIQUEMENT via WebSocket.

### R2: Un Fichier = Une Responsabilité

| Fichier | Responsabilité UNIQUE |
|---------|----------------------|
| `RealmID.ts` | Génération et validation des IDs |
| `ElementRegistry.ts` | Stockage et lookup des éléments |
| `TransactionManager.ts` | Gestion du cycle de vie des transactions |
| `EventBus.ts` | Pub/sub d'events |

**Règle**: Si un fichier dépasse 500 lignes, il doit être refactorisé.

### R3: Layers ne sautent pas de niveau

```
┌─────────────────────────────────┐
│  Layer 4: UI (components)        │
├─────────────────────────────────┤
│  Layer 3: Sync (events, WS)      │
├─────────────────────────────────┤
│  Layer 2: Business (tx, adapt)   │
├─────────────────────────────────┤
│  Layer 1: Core (realm, registry) │
└─────────────────────────────────┘
```

**Règle**: Layer 4 peut appeler Layer 3, mais JAMAIS Layer 1 directement. Respecter la hiérarchie.

---

## 🔐 Règles de Sécurité

### S1: Validation des Inputs

```typescript
// ✅ OBLIGATOIRE - Valider TOUS les inputs externes
function handleWebSocketMessage(data: unknown): void {
  const parsed = WebSocketMessageSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn('Invalid message received', parsed.error);
    return;
  }
  // Utiliser parsed.data (typé)
}
```

### S2: Sanitization des Sélecteurs

```typescript
// ✅ OBLIGATOIRE - Jamais exécuter un sélecteur non validé
function validateSelector(selector: string): boolean {
  // Pas de scripts, pas de protocoles dangereux
  const dangerous = /javascript:|data:|vbscript:|on\w+=/i;
  return !dangerous.test(selector);
}
```

### S3: File Path Validation

```typescript
// ✅ OBLIGATOIRE - Vérifier que le path est dans le workspace
function isPathSafe(filePath: string, workspaceRoot: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(workspaceRoot) && !resolved.includes('..');
}
```

---

## 🔄 Règles de Transaction

### T1: Toujours Begin/Commit ou Rollback

```typescript
// ✅ Pattern obligatoire
const tx = await txManager.begin(realmId);
try {
  // ... opérations
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

### T2: Validation Avant Commit

```typescript
// ✅ OBLIGATOIRE - Jamais de commit sans validation
const validation = await tx.validate();
if (!validation.valid) {
  await tx.rollback();
  throw new ValidationError(validation.errors);
}
await tx.commit();
```

### T3: Timeout des Transactions

```typescript
// ✅ Les transactions ont un TTL de 5 minutes max
const TRANSACTION_TTL = 5 * 60 * 1000;

// Auto-rollback si timeout
if (Date.now() - tx.createdAt > TRANSACTION_TTL) {
  await tx.rollback();
  throw new TransactionTimeoutError();
}
```

---

## 🔌 Règles d'Adapter

### A1: Interface Complète

```typescript
// ✅ TOUS les adapters DOIVENT implémenter TOUTES les méthodes
interface FrameworkAdapter {
  readonly name: string;
  detect(filePath: string, content: string): boolean;
  parseElement(ast: AST, realmId: RealmID): ParsedElement | null;
  applyStyles(element: ParsedElement, styles: StyleChanges): ModifiedAST;
  applyText(element: ParsedElement, text: string): ModifiedAST;
  applyClasses(element: ParsedElement, classes: ClassChanges): ModifiedAST;
  generateCode(ast: ModifiedAST): string;
}
```

### A2: Détection Non-Destructive

```typescript
// ✅ detect() ne doit JAMAIS modifier quoi que ce soit
detect(filePath: string, content: string): boolean {
  // Lecture seule, pas d'effets de bord
  return content.includes('className=') && filePath.endsWith('.tsx');
}
```

### A3: Fallback Chain

```typescript
// ✅ Toujours avoir un fallback
const adapters = [
  new ReactTailwindAdapter(),
  new ReactCSSModulesAdapter(),
  new PlainHTMLAdapter(), // ← Fallback obligatoire
];
```

---

## 📡 Règles de Synchronisation

### Y1: Events Immutables

```typescript
// ✅ Les events sont read-only après création
interface RealmEvent {
  readonly id: string;
  readonly type: string;
  readonly timestamp: number;
  readonly payload: Readonly<unknown>;
}
```

### Y2: Idempotence

```typescript
// ✅ Appliquer le même event 2x doit donner le même résultat
function applyEvent(state: State, event: RealmEvent): State {
  // Vérifier si déjà appliqué
  if (state.appliedEvents.has(event.id)) {
    return state; // No-op
  }
  // Appliquer et marquer
  return {
    ...newState,
    appliedEvents: new Set([...state.appliedEvents, event.id])
  };
}
```

### Y3: Order Preservation

```typescript
// ✅ Les events DOIVENT être traités dans l'ordre
class EventBus {
  private queue: RealmEvent[] = [];
  private processing = false;
  
  async emit(event: RealmEvent): Promise<void> {
    this.queue.push(event);
    if (!this.processing) {
      await this.processQueue(); // FIFO
    }
  }
}
```

---

## 🧪 Règles de Test (Futur)

### X1: Tests Unitaires Obligatoires

```typescript
// Fonctions dans ces modules DOIVENT avoir des tests:
// - RealmID.ts
// - css-to-tailwind.ts
// - position-to-tailwind.ts
// - Tous les Adapters
```

### X2: Tests d'Intégration

```typescript
// Scénarios DOIVENT être testés end-to-end:
// - Sélection DOM → Modification → Sauvegarde → Reload → Vérification
// - Transaction commit + rollback
// - Conflict detection et resolution
```

### X3: Mocking VS Code API

```typescript
// ✅ Pattern pour tests
const mockVSCode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  window: {
    showInformationMessage: jest.fn(),
  },
};
```

---

## 📊 Métriques de Qualité

| Métrique | Seuil Minimum |
|----------|---------------|
| Couverture de code | 70% |
| Complexité cyclomatique | < 15 par fonction |
| Lignes par fichier | < 500 |
| Dépendances par module | < 10 |
| Temps de réponse sync | < 200ms |

---

## 🚨 Violations et Conséquences

| Violation | Action |
|-----------|--------|
| Modification sans transaction | Revert + refactor obligatoire |
| Import direct extension↔www | Revert immédiat |
| any non justifié | Review bloquante |
| Test manquant sur core | PR bloquée |
| File > 500 lignes | Refactor avant merge |

---

## ✅ Checklist Architecture

Avant chaque PR, vérifier:

- [ ] Aucune violation des règles R1-R3
- [ ] Transactions utilisées pour toutes modifications
- [ ] Events émis pour changements d'état
- [ ] Adapters implémentent l'interface complète
- [ ] Pas de dépendances circulaires
- [ ] Types explicites partout
- [ ] Logging approprié (pas de console.log)
- [ ] Error handling complet
