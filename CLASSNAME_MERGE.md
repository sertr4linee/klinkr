# Système de Fusion des Classes Tailwind

## Problème Résolu

Lorsqu'on modifiait une couleur (text ou background) dans l'ElementEditor, le système réécrivait **toutes** les classes CSS de l'élément au lieu de simplement modifier la classe de couleur. Par exemple :

### Avant (problème)
- Classes existantes : `flex h-12 w-full items-center text-blue-500`
- Changement de couleur → `text-red-500`
- Résultat : `text-red-500` (perte de toutes les autres classes ❌)

### Après (solution)
- Classes existantes : `flex h-12 w-full items-center text-blue-500`
- Changement de couleur → `text-red-500`
- Résultat : `flex h-12 w-full items-center text-red-500` (fusion intelligente ✅)

## Solution Implémentée

### 1. Détection des Groupes de Classes (css-to-tailwind.ts)

Au lieu d'utiliser un système de préfixes simple qui confondait `text-red-500` avec `text-xl`, nous utilisons maintenant des **groupes de classes** basés sur des regex :

```typescript
const classGroups: Record<string, RegExp> = {
  textColor: /^text-(slate|gray|zinc|...|rose|white|black)(-\d+)?$/,
  bgColor: /^bg-(slate|gray|zinc|...|transparent)(-\d+)?$/,
  fontSize: /^text-(xs|sm|base|lg|xl|2xl|...)$/,
  fontWeight: /^font-(thin|extralight|light|normal|...)$/,
  // ... et beaucoup d'autres groupes
};
```

### 2. Fusion Intelligente des Classes (mergeClasses)

La fonction `mergeClasses()` maintenant :

1. **Identifie le groupe** de chaque classe Tailwind existante
2. **Préserve les classes** qui n'appartiennent pas aux groupes modifiés
3. **Remplace uniquement** les classes du même groupe que les nouvelles classes

```typescript
export function mergeClasses(existingClasses: string, newClasses: string): string {
  // Sépare les classes en groupes
  // Remplace seulement les classes des groupes concernés
  // Préserve toutes les autres classes
}
```

### 3. Exemples de Fusion

#### Changement de couleur de texte
```typescript
mergeClasses('flex text-xl text-blue-500 font-bold', 'text-red-500')
// Résultat: 'flex text-xl font-bold text-red-500'
// ✅ Remplace seulement text-blue-500
// ✅ Garde text-xl, flex, font-bold
```

#### Changement de background
```typescript
mergeClasses('p-4 bg-blue-100 rounded-lg', 'bg-red-500')
// Résultat: 'p-4 rounded-lg bg-red-500'
// ✅ Remplace seulement bg-blue-100
// ✅ Garde p-4, rounded-lg
```

#### Ajout de plusieurs classes
```typescript
mergeClasses('flex items-center', 'flex-col bg-white p-4')
// Résultat: 'items-center flex-col bg-white p-4'
// ✅ flex-col remplace flex (même groupe: flexDirection)
// ✅ Ajoute bg-white et p-4 (nouveaux groupes)
```

## Groupes de Classes Supportés

- **Couleurs** : textColor, bgColor, borderColor
- **Typographie** : fontSize, fontWeight, textAlign, lineHeight, fontFamily
- **Espacement** : padding (p-, px-, py-, pt-, pr-, pb-, pl-), margin (m-, mx-, my-, mt-, mr-, mb-, ml-)
- **Dimensionnement** : width, height, minWidth, maxWidth, minHeight, maxHeight
- **Layout** : display, position, overflow
- **Flexbox** : flexDirection, flexWrap, justifyContent, alignItems, alignSelf, gap
- **Bordures** : borderRadius, borderWidth
- **Effets** : shadow, opacity

## Architecture

```
www/src/lib/css-to-tailwind.ts
├── classGroups: Record<string, RegExp>
├── getClassGroup(cls): string | null
└── mergeClasses(existing, new): string

www/src/components/ElementEditor.tsx
└── handleApplyToCode()
    ├── Convertit styles → Tailwind avec cssToTailwind()
    ├── Fusionne avec mergeClasses()
    └── Envoie au backend via applyElementChanges()

extension/src/server.ts
└── applyChangesToReactFile()
    └── Applique className directement (déjà fusionné par frontend)
```

## Améliorations Futures

1. Support des variantes (hover:, focus:, etc.)
2. Support des valeurs arbitraires ([color:#abc123])
3. Détection automatique des conflits entre groupes apparentés
4. Mode "strict" qui refuse les conflits au lieu de les résoudre

## Tests

Pour tester le système :

1. Ouvrir ElementEditor
2. Sélectionner un élément avec plusieurs classes
3. Changer la couleur du texte ou du background
4. Vérifier que les autres classes sont préservées
5. Appliquer au code et vérifier le fichier source
