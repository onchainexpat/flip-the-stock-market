#\!/bin/bash

echo "🚀 Starting DCA Feature Migration..."

# Create directories
echo "📁 Creating directories..."
mkdir -p src/components/DCA
mkdir -p src/app/dca
mkdir -p src/app/api/dca/create
mkdir -p src/app/api/dca/history
mkdir -p src/app/api/dca/orders
mkdir -p "src/app/api/dca/orders/[id]"

echo "✅ Directories created\!"
echo ""
echo "📄 Now copy the following files:"
echo ""
echo "1. src/components/DCA/DCAQuickSetup.tsx"
echo "2. src/components/DCA/DCADashboard.tsx"
echo "3. src/components/DCA/DCAOrderCard.tsx"
echo "4. src/app/dca/page.tsx"
echo "5. src/app/api/dca/create/route.ts"
echo "6. src/app/api/dca/history/route.ts"
echo "7. src/app/api/dca/orders/route.ts"
echo "8. src/app/api/dca/orders/[id]/route.ts"
echo ""
echo "📝 And update these files:"
echo "1. src/app/page.tsx (add DCA import and side-by-side layout)"
echo "2. src/components/Auth/ProfileDropdown.tsx (add DCA Dashboard link)"
echo ""
echo "Then run: bun run dev"
