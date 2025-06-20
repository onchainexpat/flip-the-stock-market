# Feature Request: Integrate Daimo/zkp2p for Easy Fiat-to-USDC Onramp

## Overview
Integrate Daimo and zkp2p protocol to enable users to quickly purchase USDC using traditional payment methods (Venmo, Zelle, etc.) with zero-knowledge proofs for trustless transactions. This integration will migrate from RainbowKit to **ZeroDev + Privy** for account abstraction and better user onboarding, implementing a clean UI pattern inspired by zkp2p's successful design.

## Updated Architecture Decision
After research, we're implementing **ZeroDev + Privy** instead of Privy alone:
- **Privy**: Handles authentication (email, SMS, social, passkey)
- **ZeroDev**: Provides account abstraction (smart accounts, gas sponsorship, transaction batching)
- **Benefits**: Better UX, no gas complexity, automated transactions, future-proof AA standard

## Problem Statement
Currently, users need existing crypto wallets and USDC to interact with our SPX6900 trading platform. This creates barriers for mainstream adoption, especially for non-crypto users who want to use traditional payment methods like Venmo or Zelle to enter the crypto ecosystem.

## UI/UX Design Specifications

### Authentication Flow (Inspired by zkp2p)

#### Top-Right Authentication Button
```typescript
// Replace current "Connect Wallet" button in header
// When logged out:
<button className="px-4 py-2 bg-[#1B2236] hover:bg-[#1B2236]/80 text-white rounded-lg transition-colors">
  Log in or sign up
</button>

// When logged in:
<button className="flex items-center gap-2 px-3 py-2 bg-[#1B2236] hover:bg-[#1B2236]/80 rounded-lg transition-colors">
  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
    <div className="w-2 h-2 bg-white rounded-full"></div>
  </div>
  <span className="text-white text-sm">onchainexpat@pm.me</span>
</button>
```

#### Login Modal (Matches zkp2p Pattern)
```typescript
// Modal triggered by login button
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
  <div className="bg-[#1B2236] rounded-xl p-6 w-full max-w-sm mx-4">
    {/* Header */}
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-semibold text-white">Log in or sign up</h2>
      <button className="text-gray-400 hover:text-white">✕</button>
    </div>

    {/* Privy Logo */}
    <div className="flex justify-center mb-8">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-orange-500 rounded-2xl flex items-center justify-center">
        <span className="text-white text-2xl font-bold">P</span>
      </div>
    </div>

    {/* Authentication Options */}
    <div className="space-y-3">
      {/* Email (Primary Option) */}
      <button className="w-full bg-[#2A3441] hover:bg-[#34404F] text-white p-4 rounded-lg flex items-center gap-3 transition-colors">
        <Mail className="w-5 h-5" />
        <span>your@email.com</span>
        <span className="ml-auto text-sm text-blue-400">Recent</span>
      </button>

      {/* Google */}
      <button className="w-full bg-[#2A3441] hover:bg-[#34404F] text-white p-4 rounded-lg flex items-center gap-3 transition-colors">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Google</span>
      </button>

      {/* Twitter */}
      <button className="w-full bg-[#2A3441] hover:bg-[#34404F] text-white p-4 rounded-lg flex items-center gap-3 transition-colors">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        <span>Twitter</span>
      </button>

      {/* Coinbase Smart Wallet */}
      <button className="w-full bg-[#2A3441] hover:bg-[#34404F] text-white p-4 rounded-lg flex items-center gap-3 transition-colors">
        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">C</span>
        </div>
        <span>Coinbase Smart Wallet</span>
      </button>

      {/* More options */}
      <button className="w-full bg-[#2A3441] hover:bg-[#34404F] text-white p-4 rounded-lg flex items-center gap-3 transition-colors">
        <User className="w-5 h-5" />
        <span>More options</span>
        <ChevronRight className="w-4 h-4 ml-auto" />
      </button>
    </div>

    {/* Footer */}
    <div className="mt-6 text-center">
      <p className="text-sm text-gray-400">
        By logging in I agree to the <span className="text-blue-400">Terms</span> & <span className="text-blue-400">Privacy Policy</span>
      </p>
      <div className="flex items-center justify-center gap-2 mt-3">
        <span className="text-sm text-gray-400">Protected by</span>
        <div className="w-4 h-4 bg-white rounded-full"></div>
        <span className="text-sm font-semibold text-white">privy</span>
      </div>
    </div>
  </div>
</div>
```

#### User Profile Dropdown (Once Logged In)
```typescript
// Dropdown menu activated by profile button
<div className="absolute top-full right-0 mt-2 w-80 bg-[#1B2236] rounded-xl border border-white/10 shadow-xl z-50">
  {/* User Info Header */}
  <div className="p-4 border-b border-white/10">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
        <div className="w-3 h-3 bg-white rounded-full"></div>
      </div>
      <div className="flex-1">
        <div className="text-white font-medium text-sm">onchainexpat@pm.me</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-blue-400 text-sm font-mono">0xc9cA...3d88</span>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>

  {/* Balances Section */}
  <div className="p-4 border-b border-white/10">
    <div className="space-y-4">
      {/* USDC Balance (Primary) */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-lg">$</span>
        </div>
        <div className="flex-1">
          <div className="text-white font-medium">USDC</div>
          <div className="text-2xl font-bold text-white">247.50</div>
        </div>
      </div>

      {/* SPX6900 Balance */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
          <span className="text-white text-lg">📈</span>
        </div>
        <div className="flex-1">
          <div className="text-white font-medium">SPX6900</div>
          <div className="text-2xl font-bold text-white">1,250.75</div>
          <div className="text-green-400 text-sm">+12.5% vs avg buy</div>
        </div>
      </div>
    </div>
  </div>

  {/* Action Buttons */}
  <div className="p-3 space-y-1">
    {/* Receive */}
    <button className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors">
      <QrCode className="w-5 h-5" />
      <span>Receive</span>
    </button>

    {/* Send */}
    <button className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors">
      <Send className="w-5 h-5" />
      <span>Send</span>
    </button>

    {/* Export Wallet */}
    <button className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors">
      <Download className="w-5 h-5" />
      <span>Export Wallet</span>
    </button>

    {/* Buy USDC with zkp2p */}
    <button className="w-full flex items-center gap-3 p-3 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
      <CreditCard className="w-5 h-5" />
      <span>Buy USDC with Venmo</span>
    </button>

    {/* Logout */}
    <button className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
      <LogOut className="w-5 h-5" />
      <span>Logout</span>
    </button>
  </div>
</div>
```

### zkp2p Integration UI

#### USDC Purchase Flow
```typescript
// Modal/page for zkp2p USDC purchase
<div className="bg-[#1B2236] rounded-xl p-6 max-w-md mx-auto">
  <h3 className="text-xl font-bold text-white mb-6">Buy USDC with Venmo</h3>
  
  <div className="space-y-4">
    {/* Amount Input */}
    <div>
      <label className="text-white text-sm mb-2 block">Amount to buy</label>
      <div className="relative">
        <input 
          type="number" 
          placeholder="100"
          className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white pr-12"
        />
        <span className="absolute right-3 top-3 text-gray-400">USDC</span>
      </div>
    </div>

    {/* Available Offers */}
    <div>
      <label className="text-white text-sm mb-2 block">Available offers</label>
      <div className="space-y-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-white font-medium">@venmo_user_123</div>
              <div className="text-gray-400 text-sm">Rate: 1.00 USDC per $1</div>
            </div>
            <div className="text-green-400 text-sm">Available: $500</div>
          </div>
        </div>
      </div>
    </div>

    {/* Instructions */}
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
      <h4 className="text-blue-400 font-medium mb-2">How it works:</h4>
      <ol className="text-sm text-gray-300 space-y-1">
        <li>1. Send $100 to @venmo_user_123 on Venmo</li>
        <li>2. Use memo: "zkp2p-abc123"</li>
        <li>3. Your USDC will arrive automatically (2-5 minutes)</li>
      </ol>
    </div>

    {/* Action Button */}
    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors">
      Start Purchase
    </button>

    {/* Fee Disclosure */}
    <p className="text-xs text-gray-400 text-center">
      No platform fees • Gas sponsored • Powered by zkp2p
    </p>
  </div>
</div>
```

## Proposed Solution

### Phase 1: Research & Architecture Planning (Week 1-2)
- [ ] **Deep dive into zkp2p V2 Protocol**
  - Study the [zkp2p documentation](https://docs.zkp2p.xyz/developer/the-zkp2p-v2-protocol)
  - Understand PeerAuth Extension and zkTLS technology
  - Review smart contract interfaces (IPaymentVerifier, Escrow contracts)
  - Test zkp2p on [their live platform](https://www.zkp2p.xyz/swap)

- [ ] **ZeroDev + Privy vs RainbowKit Analysis**
  - Compare current RainbowKit implementation with ZeroDev account abstraction
  - Evaluate Privy's authentication methods (email, SMS, passkey) + ZeroDev smart accounts
  - Test ZeroDev's gas sponsorship and transaction batching vs OnchainKit paymaster
  - Assess migration complexity and integration benefits of AA infrastructure

- [ ] **Current Integration Points Audit**
  - Review existing `OnchainProviders.tsx` and wallet connection flow
  - Analyze current gas sponsorship implementation with Coinbase OnchainKit
  - Identify components that would need updates for Privy integration

### Phase 2: Testing Infrastructure Setup (Week 2)
- [ ] **Baseline Test Suite Creation**
  - Create comprehensive test suite for existing functionality
  - Implement regression tests for current wallet connection flow
  - Set up API integration tests for existing endpoints
  - Establish performance baselines for migration comparison

- [ ] **Test Environment Configuration**
  - Set up staging environment with test tokens
  - Configure CI/CD pipeline for continuous testing
  - Implement feature flags for gradual rollout
  - Create test data sets for various user scenarios

### Phase 3: Technical Integration Planning (Week 3)
- [ ] **zkp2p Integration Strategy**
  - Determine integration approach: SDK vs API vs smart contract interaction
  - Plan user flow: email/phone → embedded wallet → zkp2p onramp → SPX6900 trading
  - Design fallback mechanisms for when zkp2p is unavailable
  - Research zkp2p fee structures and how to handle/pass them to users

- [ ] **ZeroDev + Privy Migration Plan**
  - Create migration strategy from RainbowKit to ZeroDev + Privy
  - Plan authentication flow: email → smart account creation → Base chain connection
  - Design user onboarding flow leveraging account abstraction benefits
  - Implement ZeroDev gas sponsorship and transaction batching capabilities

### Phase 4: UI Component Implementation (Week 4-5)
- [ ] **Authentication Components**
  - Build `LoginButton.tsx` component replacing current Connect Wallet
  - Create `LoginModal.tsx` with Privy integration matching zkp2p design
  - Implement `ProfileButton.tsx` showing user email and status
  - Build `ProfileDropdown.tsx` with balances and actions

- [ ] **zkp2p Integration Components**
  - Create `BuyUSDCModal.tsx` for zkp2p purchase flow
  - Build `TransactionStatus.tsx` for tracking Venmo payments
  - Implement `USDCOnramp.tsx` wrapper component
  - Add zkp2p option to profile dropdown menu

- [ ] **Enhanced User Onboarding**
  - Create progressive onboarding flow for non-crypto users
  - Implement email-first authentication
  - Build guided tutorial for first-time users
  - Add help/support for traditional payment method users

### Phase 5: Backend Integration (Week 6)
- [ ] **ZeroDev + Privy Integration**
  - Install and configure ZeroDev SDK and Privy authentication
  - Replace RainbowKit with ZeroDev smart account infrastructure
  - Implement email/SMS/social login with automatic smart account creation
  - Set up ZeroDev gas sponsorship and transaction batching on Base chain
  - Integrate account abstraction features (recovery, session keys, etc.)

- [ ] **zkp2p Protocol Integration**
  - Integrate zkp2p V2 protocol for USDC onramp
  - Implement Venmo payment verification (currently supported)
  - Build API endpoints for zkp2p transaction tracking
  - Add transaction status tracking and confirmations
  - Handle zkp2p error cases and user guidance

### Phase 6: Comprehensive Testing & Quality Assurance (Week 7-8)
- [ ] **Regression Testing**
  - Run complete baseline test suite to ensure no existing functionality broken
  - Test existing user wallet connections continue working
  - Verify all API endpoints remain functional
  - Confirm gas sponsorship still works with new auth system

- [ ] **Feature-Specific Testing**
  - Test Privy authentication flow (email, SMS, social login)
  - Verify embedded wallet creation and management
  - Test zkp2p integration with mock and real Venmo transactions
  - Validate transaction status tracking and error handling

- [ ] **UI/UX Testing**
  - Test login modal across different devices and browsers
  - Verify profile dropdown functionality and responsiveness
  - Test zkp2p purchase flow end-to-end
  - Validate mobile experience for all new components

- [ ] **Integration Testing**
  - Test complete user journey: email signup → zkp2p USDC purchase → SPX6900 trading
  - Verify gas sponsorship works with new wallet setup
  - Test edge cases: failed payments, network issues, wallet recovery
  - Performance testing for embedded wallet creation

## Technical Requirements

### New Components to Create
```typescript
src/components/Auth/
├── LoginButton.tsx           // Top-right login button
├── LoginModal.tsx            // Privy authentication modal  
├── ProfileButton.tsx         // User profile button with email
└── ProfileDropdown.tsx       // User menu with balances and actions

src/components/zkp2p/
├── BuyUSDCModal.tsx          // zkp2p purchase interface
├── TransactionStatus.tsx     // Venmo payment tracking
├── USDCOnramp.tsx           // Main zkp2p integration component
└── OfferCard.tsx            // Available zkp2p offers display

src/components/Wallet/
├── BalanceDisplay.tsx        // USDC/SPX balance component
├── ReceiveModal.tsx          // QR code for receiving tokens
├── SendModal.tsx             // Send tokens interface
└── ExportWallet.tsx          // Wallet export functionality
```

### Dependencies to Add
```json
{
  "@privy-io/react-auth": "^2.15.1",
  "@privy-io/wagmi": "^1.0.4",
  "@zerodev/sdk": "^5.x.x",
  "@zerodev/wagmi": "^5.x.x",
  "lucide-react": "^0.518.0"
}
```

### Dependencies to Remove/Replace
```json
{
  "@rainbow-me/rainbowkit": "^2.2.4"  // Replace with ZeroDev + Privy
}
```

### Environment Variables to Add
```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id
ZERODEV_BUNDLER_RPC=your_zerodev_bundler_rpc
ZERODEV_PAYMASTER_RPC=your_zerodev_paymaster_rpc
NEXT_PUBLIC_ZKP2P_API_ENDPOINT=https://api.zkp2p.xyz/v2

# Feature flags for gradual rollout
ENABLE_ZERODEV_AUTH=false
ENABLE_ZKP2P=false
ZERODEV_ROLLOUT_PERCENTAGE=0
```

### Files to Modify
- `src/components/OnchainProviders.tsx` - Replace RainbowKit with ZeroDev + Privy
- `src/wagmi.ts` - Update to use ZeroDev smart account configuration
- `src/components/WalletWrapper.tsx` - Replace with new LoginButton component
- Update header layout to accommodate new profile dropdown
- Add ZeroDev account abstraction provider and smart account setup

## Testing Strategy & Regression Prevention

### Critical Regression Tests
```typescript
// tests/regression/existing-features.test.tsx
- Current wallet connection flow (RainbowKit)
- Gas sponsorship with OnchainKit
- Price comparison functionality
- Trading interface interactions
- Social sharing features
- Mobile responsive design
- API endpoint functionality
```

### UI Component Tests
```typescript
// tests/components/auth/
- LoginButton component rendering and interactions
- LoginModal Privy integration and auth flows
- ProfileButton state management (logged in/out)
- ProfileDropdown balance display and actions
- Mobile responsive behavior for all components
```

### zkp2p Integration Tests
```typescript
// tests/zkp2p/
- API connectivity and responses
- Mock Venmo payment flow
- USDC onramp completion
- Transaction status tracking
- Error handling and fallbacks
- Integration with existing trading
```

## Quality Gates & Success Criteria
- [ ] **100% baseline regression tests pass**
- [ ] **Zero downtime during migration**
- [ ] **<2% user drop-off during auth migration**
- [ ] **>95% zkp2p transaction success rate**
- [ ] **<500ms additional load time from new features**
- [ ] **Mobile experience remains fully functional**
- [ ] **UI matches zkp2p design patterns and quality**

## Success Metrics
- [ ] Non-crypto users can complete full flow: email → USDC purchase → SPX6900 trading in under 5 minutes
- [ ] zkp2p transactions have >95% success rate
- [ ] Gas sponsorship continues to work seamlessly
- [ ] User abandonment rate decreases by 60% compared to current crypto-wallet-required flow
- [ ] Support for Venmo payments initially, with plan for Zelle expansion
- [ ] Zero regressions in existing functionality
- [ ] Profile dropdown usage >80% for balance checking

## Risks & Considerations
1. **Migration Risk**: Existing users could lose access during transition
2. **zkp2p Limitations**: Currently only supports Venmo, limited to USDC
3. **UI Complexity**: Profile dropdown adds interface complexity
4. **Privy Dependency**: New external dependency for critical auth functionality
5. **User Experience**: Balancing simplicity with crypto functionality

## Documentation & Resources
- [zkp2p Protocol Docs](https://docs.zkp2p.xyz/)
- [Privy Documentation](https://docs.privy.io/)
- [zkp2p GitHub](https://github.com/zkp2p/zkp2p-v1-monorepo)
- [zkp2p Live Platform](https://www.zkp2p.xyz/swap)
- [Lucide React Icons](https://lucide.dev/)

## Future Enhancements
- Support for additional payment methods (Zelle, PayPal) as zkp2p expands
- Integration with Apple Pay/Google Pay through Privy
- Support for other tokens beyond USDC
- Cross-chain onramp capabilities
- Enhanced profile customization options

---

**Priority**: High
**Complexity**: High  
**Impact**: High (Major user experience improvement for mainstream adoption)
**Timeline**: 8 weeks
**Risk Level**: Medium (migration risk mitigated by comprehensive testing and feature flags)