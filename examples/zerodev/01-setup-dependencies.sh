#!/bin/bash
# EIP-7702 ZeroDev Setup - Dependencies Installation
# This script installs all required dependencies for 7702 account integration

echo "Installing ZeroDev 7702 dependencies..."
npm i @tanstack/react-query wagmi viem @zerodev/ecdsa-validator @zerodev/sdk

echo "Dependencies installed successfully!"