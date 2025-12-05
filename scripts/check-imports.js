#!/usr/bin/env node
/**
 * Verify all expo-router imports are valid
 */

const fs = require('fs');
const path = require('path');

const validExpoRouterExports = [
  'useRouter',
  'useLocalSearchParams',
  'useGlobalSearchParams',
  'useSegments',
  'Stack',
  'Tabs',
  'router',
  'Link',
  'Redirect',
];

const appDir = path.join(__dirname, '../app');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]expo-router['"]/);
  
  if (importMatch) {
    const imports = importMatch[1].split(',').map(i => i.trim());
    const invalid = imports.filter(i => !validExpoRouterExports.includes(i));
    
    if (invalid.length > 0) {
      console.error(`❌ ${filePath}`);
      console.error(`   Invalid imports: ${invalid.join(', ')}`);
      return false;
    } else {
      console.log(`✅ ${filePath}`);
      return true;
    }
  }
  return true;
}

function walkDir(dir) {
  let allValid = true;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!walkDir(fullPath)) allValid = false;
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      if (!checkFile(fullPath)) allValid = false;
    }
  }
  
  return allValid;
}

console.log('🔍 Checking expo-router imports...\n');
const valid = walkDir(appDir);

if (valid) {
  console.log('\n✨ All imports are valid!');
  process.exit(0);
} else {
  console.log('\n❌ Some imports are invalid');
  process.exit(1);
}
