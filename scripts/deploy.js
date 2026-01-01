const hre = require("hardhat");

async function main() {
    console.log("Starting deployment...");

    // 1. Get the deployer wallet (your account)
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Optional: Check balance to ensure you have enough ETH
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance));

    // 2. Get the Contract Factory
    const TicketFactory = await hre.ethers.getContractFactory("TicketFactory");

    // 3. Deploy the contract
    // No arguments needed for the constructor
    console.log("Deploying TicketFactory...");
    const factory = await TicketFactory.deploy();

    // 4. Wait for the transaction to be mined
    await factory.waitForDeployment();

    // 5. Success! Print the address
    const factoryAddress = await factory.getAddress();
    console.log("Success! TicketFactory deployed to:", factoryAddress);

    console.log("\nIMPORTANT: Save this address! You will need it for your Frontend.");
    console.log("Verify with: npx hardhat verify --network sepolia", factoryAddress);
}

// Standard async error handling
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
