const hre = require("hardhat");
require("dotenv").config(); // Load the .env file

async function main() {
    // 1. Get the Co-Owner address from your .env file
    const coOwnerAddress = process.env.CO_OWNER_ADDRESS;

    // Safety Check: Stop if the address is missing
    if (!coOwnerAddress) {
        console.error("❌ Error: CO_OWNER_ADDRESS is missing in your .env file!");
        console.log("👉 Please add: CO_OWNER_ADDRESS='0x...' to your .env file.");
        process.exit(1);
    }

    console.log("🚀 Starting deployment...");
    console.log("Deploying TicketFactory with Co-Owner:", coOwnerAddress);

    // 2. Get the Contract Factory
    const TicketFactory = await hre.ethers.getContractFactory("TicketFactory");

    // 3. Deploy passing the argument
    const factory = await TicketFactory.deploy(coOwnerAddress);

    // 4. Wait for it to finish
    await factory.waitForDeployment();

    const address = await factory.getAddress();
    console.log("✅ Success! TicketFactory deployed to:", address);

    console.log("\n👇 Verify command for Etherscan:");
    console.log(`npx hardhat verify --network sepolia ${address} "${coOwnerAddress}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
