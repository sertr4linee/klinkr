// Test rapide de la fonction mergeClasses
// Exécuter avec: node test-merge.js

// Copie simplifiée de la logique pour tester
const classGroups = {
  textColor: /^text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?$/,
  bgColor: /^bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?$/,
  fontSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
  fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  textAlign: /^text-(left|center|right|justify|start|end)$/,
};

function getClassGroup(cls) {
  for (const [group, pattern] of Object.entries(classGroups)) {
    if (pattern.test(cls)) {
      return group;
    }
  }
  return null;
}

function mergeClasses(existingClasses, newClasses) {
  const existing = existingClasses.split(/\s+/).filter(Boolean);
  const newOnes = newClasses.split(/\s+/).filter(Boolean);
  
  const existingGroups = new Map();
  const ungroupedExisting = [];
  
  for (const cls of existing) {
    const group = getClassGroup(cls);
    if (group) {
      if (!existingGroups.has(group)) {
        existingGroups.set(group, []);
      }
      existingGroups.get(group).push(cls);
    } else {
      ungroupedExisting.push(cls);
    }
  }
  
  const result = [...ungroupedExisting];
  const usedGroups = new Set();
  
  for (const cls of newOnes) {
    const group = getClassGroup(cls);
    if (group) {
      usedGroups.add(group);
      result.push(cls);
    } else {
      if (!result.includes(cls)) {
        result.push(cls);
      }
    }
  }
  
  for (const [group, classes] of existingGroups.entries()) {
    if (!usedGroups.has(group)) {
      result.push(...classes);
    }
  }
  
  return result.join(' ');
}

// Tests
console.log('\n=== Tests de mergeClasses ===\n');

// Test 1: Background color
const test1 = mergeClasses('flex p-4 bg-blue-500 text-white', 'bg-red-500');
console.log('Test 1 - Background color:');
console.log('  Input:  "flex p-4 bg-blue-500 text-white"');
console.log('  Change: "bg-red-500"');
console.log('  Result:', test1);
console.log('  ✓ Attendu: classes flex, p-4, text-white préservées, bg-blue-500 → bg-red-500\n');

// Test 2: Text color
const test2 = mergeClasses('flex text-xl text-blue-500 font-bold', 'text-red-500');
console.log('Test 2 - Text color:');
console.log('  Input:  "flex text-xl text-blue-500 font-bold"');
console.log('  Change: "text-red-500"');
console.log('  Result:', test2);
console.log('  ✓ Attendu: flex, text-xl, font-bold préservés, text-blue-500 → text-red-500\n');

// Test 3: Text color avec text-align
const test3 = mergeClasses('text-center text-xl text-gray-700', 'text-red-500');
console.log('Test 3 - Text color avec text-align:');
console.log('  Input:  "text-center text-xl text-gray-700"');
console.log('  Change: "text-red-500"');
console.log('  Result:', test3);
console.log('  ✓ Attendu: text-center, text-xl préservés, text-gray-700 → text-red-500\n');

// Test 4: Multiple changes
const test4 = mergeClasses('flex text-xl text-blue-500 bg-white', 'text-red-500 bg-black');
console.log('Test 4 - Multiple changes:');
console.log('  Input:  "flex text-xl text-blue-500 bg-white"');
console.log('  Change: "text-red-500 bg-black"');
console.log('  Result:', test4);
console.log('  ✓ Attendu: flex, text-xl préservés, text-blue-500 → text-red-500, bg-white → bg-black\n');

// Debug: voir les groupes détectés
console.log('=== Debug: Détection des groupes ===\n');
const testClasses = ['text-red-500', 'text-xl', 'text-center', 'bg-blue-500', 'flex'];
testClasses.forEach(cls => {
  console.log(`  "${cls}" → groupe: ${getClassGroup(cls)}`);
});
