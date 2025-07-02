# Gemini Project Briefing

This document provides a summary of the project's technical stack, conventions, and common commands to guide development and ensure consistency.

## Core Technologies

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Package Manager**: [Bun](https://bun.sh/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Linting & Formatting**: [Biome](https://biomejs.dev/)
- **Testing**: [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Web3 Stack

- **Wallet Connection & Hooks**: [Wagmi](https://wagmi.sh/) & [RainbowKit](https://www.rainbowkit.com/)
- **Authentication**: [Privy](https://www.privy.io/)
- **Smart Contract Wallets (Account Abstraction)**: [ZeroDev](https://zerodev.app/) and [Account Kit](https://accountkit.com/)
- **Ethereum Interface**: [Viem](https://viem.sh/)

## Project Scripts

The following scripts are defined in `package.json` and should be run with `bun run <script_name>`.

### Development

- `dev`: Starts the Next.js development server with debugging enabled.
  ```bash
  bun run dev
  ```

### Building & Production

- `build`: Creates a production-ready build of the application.
  ```bash
  bun run build
  ```
- `start`: Starts the production server.
  ```bash
  bun run start
  ```

### Code Quality & Formatting

- `check`: Runs all Biome checks (linter, formatter).
  ```bash
  bun run check
  ```
- `lint`: Lints the codebase using Biome and applies automatic fixes.
  ```bash
  bun run lint
  ```
- `format`: Formats the codebase using Biome and applies automatic fixes.
  ```bash
  bun run format
  ```

### Testing

- `test`: Runs the unit and integration tests using Vitest.
  ```bash
  bun run test
  ```
- `test:coverage`: Runs the tests and generates a coverage report.
  ```bash
  bun run test:coverage
  ```

## CI/CD Pipeline

The CI pipeline is defined in `.github/workflows/ci.yml` and is triggered on pushes and pull requests to the `main` branch. It executes the following jobs to ensure code quality and stability:

1.  **Install Dependencies**: `bun install`
2.  **Type Check**: `bun run ci:check`
3.  **Lint**: `bun run ci:lint`
4.  **Format Check**: `bun run ci:format`
5.  **Test**: `bun run test:coverage`
6.  **Build**: `bun run build`

All checks must pass before code can be merged into the `main` branch.
