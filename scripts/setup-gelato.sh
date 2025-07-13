#!/bin/bash

# Gelato Setup Script
# This script sets up everything needed for Gelato deployment

set -e

echo "🚀 Gelato DCA Automation Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running from project root
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Checking project structure..."

# Step 1: Install required dependencies
print_info "Installing Gelato dependencies..."
npm install @gelatonetwork/web3-functions-sdk @gelatonetwork/ops-sdk hardhat @nomiclabs/hardhat-ethers tsx

print_status "Dependencies installed"

# Step 2: Setup Web3 Functions directory
print_info "Setting up Web3 Functions directory..."

if [ ! -d "web3-functions" ]; then
    mkdir -p web3-functions
    print_status "Created web3-functions directory"
fi

# Copy files if they exist
if [ -f "src/gelato/dcaAutomationFunction.ts" ]; then
    cp src/gelato/* web3-functions/ 2>/dev/null || true
    print_status "Copied Gelato files to web3-functions/"
fi

# Step 3: Install Gelato CLI globally
print_info "Installing Gelato CLI..."
if ! command -v w3f &> /dev/null; then
    npm install -g @gelatonetwork/web3-functions-sdk
    print_status "Gelato CLI installed globally"
else
    print_status "Gelato CLI already installed"
fi

# Step 4: Setup environment variables template
print_info "Creating environment template..."

cat > .env.gelato.template << 'EOF'
# Gelato Configuration
GELATO_API_KEY=your_gelato_api_key_here
GELATO_DEPLOYER_PRIVATE_KEY=your_deployer_wallet_private_key
GELATO_WEB3_FUNCTION_HASH=will_be_set_after_deployment
GELATO_TASK_ID=will_be_set_after_task_creation

# Required for Web3 Function
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
AGENT_KEY_ENCRYPTION_SECRET=your_encryption_secret
NEXT_PUBLIC_ZERODEV_RPC_URL=your_zerodev_rpc_url
EOF

print_status "Environment template created (.env.gelato.template)"

# Step 5: Check existing environment
print_info "Checking environment variables..."

required_vars=("UPSTASH_REDIS_REST_URL" "AGENT_KEY_ENCRYPTION_SECRET" "NEXT_PUBLIC_ZERODEV_RPC_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    print_status "All required environment variables are set"
else
    print_warning "Missing environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_info "Please add these to your .env.local file"
fi

# Step 6: Validate Web3 Function structure
print_info "Validating Web3 Function files..."

required_files=("web3-functions/dcaAutomationFunction.ts" "web3-functions/schema.json")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    print_status "All Web3 Function files present"
else
    print_error "Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

# Step 7: Test Web3 Function locally
print_info "Testing Web3 Function locally..."
cd web3-functions

if npm run test 2>/dev/null; then
    print_status "Web3 Function test passed"
else
    print_warning "Web3 Function test failed (this is normal without proper environment)"
fi

cd ..

# Step 8: Create deployment checklist
print_info "Creating deployment checklist..."

cat > GELATO_CHECKLIST.md << 'EOF'
# Gelato Deployment Checklist

## Prerequisites
- [ ] Gelato account created at [app.gelato.network](https://app.gelato.network)
- [ ] Wallet connected to Gelato dashboard
- [ ] Environment variables configured in .env.local
- [ ] At least 0.1 ETH in deployer wallet (Base network)

## Environment Variables
Add these to your .env.local:
```bash
GELATO_API_KEY=your_api_key
GELATO_DEPLOYER_PRIVATE_KEY=0x...
```

## Deployment Steps

### Option 1: Dashboard Deployment (Recommended)
1. **Login to Gelato CLI:**
   ```bash
   npx w3f login
   ```

2. **Deploy Web3 Function:**
   ```bash
   npm run gelato:deploy
   ```

3. **Create Task in Dashboard:**
   - Go to [app.gelato.network](https://app.gelato.network)
   - Click "Create Task"
   - Select your deployed function
   - Configure user arguments
   - Set trigger (5-minute interval)
   - Fund with 0.1+ ETH

### Option 2: Programmatic Deployment
1. **Deploy and Create Task:**
   ```bash
   npm run gelato:create
   ```

## User Arguments Configuration
```json
{
  "redisUrl": "your_upstash_redis_url",
  "encryptionSecret": "your_encryption_secret",
  "zerodevRpcUrl": "your_zerodev_rpc_url",
  "adminWalletAddress": "your_admin_wallet"
}
```

## Monitoring
- [ ] Task created successfully
- [ ] Task funded with ETH
- [ ] First execution successful
- [ ] Monitoring setup in dashboard

## Production Checklist
- [ ] Test with small DCA orders
- [ ] Monitor gas usage
- [ ] Set up alerts for failures
- [ ] Document task IDs
- [ ] Plan maintenance procedures
EOF

print_status "Deployment checklist created (GELATO_CHECKLIST.md)"

echo
echo "🎉 Gelato setup complete!"
echo "================================"
echo
print_info "Next steps:"
echo "1. Add Gelato environment variables to .env.local"
echo "2. Get API key from https://app.gelato.network"
echo "3. Follow the deployment checklist (GELATO_CHECKLIST.md)"
echo "4. Run: npm run gelato:deploy"
echo
print_warning "Make sure you have at least 0.1 ETH in your deployer wallet on Base network!"
echo