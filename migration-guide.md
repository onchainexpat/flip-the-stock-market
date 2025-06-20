# DCA Feature Migration Guide

## Step 1: Create Required Directories

```bash
mkdir -p src/components/DCA
mkdir -p src/app/dca
mkdir -p src/app/api/dca/create
mkdir -p src/app/api/dca/history
mkdir -p src/app/api/dca/orders
mkdir -p src/app/api/dca/orders/[id]
```

## Step 2: Copy New Files

Copy all the new files to your local repository. The complete file contents are provided below.

## Step 3: Update Existing Files

Two files need to be updated:
1. src/app/page.tsx - Add DCA side-by-side layout
2. src/components/Auth/ProfileDropdown.tsx - Add DCA Dashboard link

## Step 4: Install/Verify Dependencies

All required dependencies should already be installed:
- @privy-io/react-auth
- lucide-react  
- wagmi
- viem
- @vercel/kv

## Step 5: Run and Test

```bash
bun run dev
```

Then:
1. Login with Privy authentication
2. See the side-by-side trading layout
3. Access DCA Dashboard from profile dropdown
4. Test creating DCA orders
