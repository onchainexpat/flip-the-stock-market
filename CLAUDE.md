# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flip The Stock Market (SPX6900) is a DeFi application built with Next.js 14 that enables trading of the SPX6900 token. It features gas-free transactions via Coinbase paymaster, smart wallet integration, and comparisons with traditional S&P 500 performance.

## Development Commands

```bash
# Install dependencies (using Bun)
bun install

# Development server with Node.js debugging
bun run dev

# Build for production
bun run build

# Run tests
bun run test

# Run tests with coverage (70% threshold required)
bun run test:coverage

# Code formatting and linting (using Biome)
bun run check        # Check and auto-fix all issues
bun run format       # Format code only
bun run lint         # Lint code only
bun run lint:unsafe  # Lint with unsafe fixes

# CI-specific commands (no auto-fixes)
bun run ci:check
bun run ci:format
bun run ci:lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Blockchain**: Coinbase OnchainKit, RainbowKit, Wagmi
- **Testing**: Vitest with jsdom
- **Linting/Formatting**: Biome (replaces ESLint/Prettier)
- **Package Manager**: Bun (with npm/yarn fallback)

### Provider Hierarchy
Components requiring blockchain functionality must be wrapped in:
```
WagmiProvider → QueryClientProvider → OnchainKitProvider → RainbowKitProvider
```

### Key Directories
- `src/app/api/`: Edge API routes with Redis caching
- `src/components/`: Client-side React components
- `src/utils/`: Shared utilities and API clients
- `src/scripts/`: Utility scripts for data processing

## Coding Patterns

### Component Patterns
- All components use `'use client'` directive
- Functional components with TypeScript interfaces for props
- Local state management with useState/useRef
- Wagmi hooks for blockchain state

### API Route Patterns
- Use `export const runtime = 'edge'` for performance
- Implement Redis caching with TTL
- Return cached data on errors (graceful degradation)
- Validate responses before caching

### Error Handling
- Always wrap API calls in try-catch blocks
- Log errors with context for debugging
- Return structured error responses with appropriate status codes
- Provide fallback data when possible

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_COINBASE_API_KEY
NEXT_PUBLIC_COINBASE_PAYMASTER_AND_BUILDER_ENDPOINT
NEXT_PUBLIC_CDP_PROJECT_ID
NEXT_PUBLIC_WC_PROJECT_ID
```

Additional services configured in production:
- Upstash Redis
- Vercel KV/Blob storage
- Dune Analytics API
- CoinGecko API

## Code Style

Biome enforces:
- 2-space indentation
- Single quotes for JS, double quotes for JSX
- Semicolons required
- Trailing commas
- 80-character line width
- No unused imports/variables
- Sorted Tailwind classes
- No namespace imports

## Testing

- Minimum 70% coverage required for all metrics
- Test files alongside source files
- Use Vitest globals (no imports needed)
- Setup file at `vitest.setup.ts`

## Key Features

1. **SPX6900 Token Trading**: Swap functionality via OnchainKit
2. **Gas-Free Transactions**: Coinbase paymaster sponsors all gas fees
3. **Multi-Wallet Support**: Coinbase Smart Wallet, MetaMask, WalletConnect
4. **Data Integration**: S&P 500 comparisons, holder tracking, price charts
5. **Social Features**: Profile sharing, leaderboards, image generation