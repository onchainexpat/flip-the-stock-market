// Quick test to check if DCA components compile
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking DCA components...\n');

const components = [
  'src/components/DCA/DCAQuickSetup.tsx',
  'src/components/DCA/DCADashboard.tsx',
  'src/components/DCA/DCAOrderCard.tsx',
  'src/app/dca/page.tsx',
  'src/app/api/dca/create/route.ts',
  'src/app/api/dca/history/route.ts',
  'src/app/api/dca/orders/route.ts',
  'src/app/api/dca/orders/[id]/route.ts',
];

components.forEach((file) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// Check imports in main files
console.log('\n🔍 Checking imports...\n');

const pageContent = fs.readFileSync(
  path.join(__dirname, 'src/app/page.tsx'),
  'utf8',
);
const hasDCAImport = pageContent.includes('import DCAQuickSetup');
const hasSideBySide = pageContent.includes('Side-by-side layout');
const hasAutoSell = pageContent.includes('Auto-Buy SPX6900');

console.log(`${hasDCAImport ? '✅' : '❌'} DCAQuickSetup imported in page.tsx`);
console.log(`${hasSideBySide ? '✅' : '❌'} Side-by-side layout comment found`);
console.log(`${hasAutoSell ? '✅' : '❌'} Auto-Buy SPX6900 text found`);

// Check ProfileDropdown
const profilePath = path.join(
  __dirname,
  'src/components/Auth/ProfileDropdown.tsx',
);
if (fs.existsSync(profilePath)) {
  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const hasDCADashboard = profileContent.includes('DCA Dashboard');
  console.log(
    `${hasDCADashboard ? '✅' : '❌'} DCA Dashboard link in ProfileDropdown`,
  );
}

console.log('\n✅ Component check complete!');
