# Flip The Stock Market (SPX6900)

<p align="center">
  <picture>
    <img src="/public/spinLogo.gif" alt="Spinning Logo" className="rounded-gif" />
  </picture>
</p>

## Overview

This project leverages cutting-edge blockchain technologies to provide a seamless and user-friendly experience for [brief description of your project's purpose].

## Key Features

- **Coinbase onchainkit**: Utilizes Coinbase's onchainkit for robust blockchain interactions.
- **Coinbase Smart Wallet Integration**: Enables easy onboarding for users with a familiar and secure wallet solution.
- **Gas-Free Transactions**: Implements a paymaster to sponsor user transactions, covering all gas fees.

## Getting Started

### Prerequisites

- Bun
- Node.js
- Cursor.ai (IDE)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

2. Install dependencies:
   ```
   bun i
   ```

3. Run the project:
   ```
   bun run dev
   ```
4. Open the project in your browser:
   ```
   http://localhost:3000
   ```
5. Deploy to production on Vercel.

## Usage

Set these variables in your .env file:

- NEXT_PUBLIC_COINBASE_API_KEY (from Coinbase)
- NEXT_PUBLIC_COINBASE_PAYMASTER_AND_BUILDER_ENDPOINT (URL from Coinbase CDP portal)
- NEXT_PUBLIC_CDP_PROJECT_ID (from Coinbase CDP portal)
- NEXT_PUBLIC_WC_PROJECT_ID (from WalletConnect)

## Technologies Used

- Coinbase onchainkit
- Coinbase Smart Wallet

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgements

- Coinbase for their onchainkit and Smart Wallet
- Coinbase Dev Discord: https://discord.gg/cdp
