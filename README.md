# Ticket Booking System Smart Contracts

This project is a decentralized **event ticket selling system** powered by blockchain smart contracts. The goal is to build **trust** by **decentralizing** the process and ensuring **transparency** for both organizers and attendees.

![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3c3c3d?logo=ethereum&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-0.8.0-363636?logo=solidity&logoColor=white)
![Hardhat](https://img.shields.io/badge/Hardhat-2.28-FFF100?logo=hardhat&logoColor=black)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black)
![ethers.js](https://img.shields.io/badge/ethers.js-v6-2535a0?logo=ethers&logoColor=white)

## 📱 Frontend Application
This project consists of two parts. The smart contracts live here, but the user interface is in a separate repository.

👉 **[Click here to view the Next.js Frontend repository](https://github.com/othmanemrdev/chre-ticket-dialak)**

## Features

### Match Creation
Owners can create matches by specifying their parameters, such as ticket price, capacity, and date. To ensure commitment, owners must play with an initial collateral.

### Ticket Purchase
Users can check all available matches and buy tickets directly from the smart contract. Each user is limited to a maximum of **4 tickets** to ensure fair distribution.

### Emergency Cancellations
If a match is cancelled for emergency reasons, users are **automatically paid back**. The refund includes the ticket price **plus additional collateral** that the owners put up. This ensures users are compensated for the cancellation.

### Fund Withdrawal
When a match is played and finished successfully, the owners can claim the revenue securely from the contract.

## Technical Architecture & Design

### Factory Pattern Implementation
To ensure scalability and efficient management, the system uses a **Factory Pattern** (`TicketFactory.sol`). This works as a central registry and deployer for all match events.

1.  **Deployment**:
    *   The `TicketFactory` contract is the only entity authorized to deploy new `MatchTicketAuto` instances.
    *   When an owner calls `createMatch`, the factory instantiates a new contract and calculates the gas/collateral required.
    *   This ensures all Match contracts share the exact same verified bytecode structure.

2.  **Storage & Tracking**:
    *   **Registry**: The factory maintains an array `MatchTicketAuto[] public matches` containing the addresses of all deployed match contracts.
    *   **Indexing**: Users or frontends can access specific match contracts by their index using the public getter `matches(index)`.

3.  **Data Retrieval**:
    The factory provides a specialized `getActiveMatches()` function:
    *   It iterates through the stored contract addresses.
    *   It performs an on-chain reading of each contract's state (`isCancelled` and `matchDate`).
    *   It returns a filtered list of only valid, upcoming matches.
    *   *Benefit*: This reduces the burden on the frontend to filter out old or invalid events.

### Match Interaction Flow
Once the frontend or user retrieves a match address from the Factory:
1.  **Direct Interaction**: Users interact directly with the specific `MatchTicketAuto` contract address to buy tickets.
2.  **Isolation**: Each match has its own state (collateral balance, buyers list), so an issue in one match does not affect others.

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
