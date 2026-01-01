# Ticket Booking System Smart Contracts

A decentralized ticket booking system using the **Factory Pattern** on Ethereum.
- **TicketFactory**: Deploys individual match contracts.
- **MatchTicket**: Handles ticket sales, cancellations, and refunds with penalty logic.

## Prerequisites
- Node.js
- Hardhat

## Installation
```bash
npm install
```

## Running Tests
Run the Hardhat test suite (includes verification of refund math and security checks):
```bash
npx hardhat test
```

## Deployment
1. Set up your `.env` file (see `.env` template in code or `hardhat.config.js` for keys needed).
2. Deploy to Sepolia testnet:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Features
- **Factory Pattern**: Scalable match creation.
- **Circuit Breaker**: Owners can cancel matches before they start.
- **Penalty/Insurance**: If a match is cancelled, users get a refund + a share of the owner's collateral.
