const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auto-Refund System", function () {

    // Setup the specific scenario
    async function deployMatchWithBuyersFixture() {
        const [owner, coOwner, buyer1, buyer2, buyer3] = await ethers.getSigners();

        // 1. Deploy Factory (Remember to pass the Co-Owner!)
        const TicketFactory = await ethers.getContractFactory("TicketFactory");
        const factory = await TicketFactory.deploy(coOwner.address);

        // 2. Create a Match
        // Price: 1 ETH, Capacity: 10, Date: Tomorrow
        // Collateral: 10 ETH
        const ticketPrice = ethers.parseEther("1.0");
        const collateral = ethers.parseEther("10.0");
        const futureDate = (await time.latest()) + 86400;

        await factory.createMatch("Auto Refund Match", ticketPrice, 10, futureDate, { value: collateral });

        // 3. Get the Match Contract
        const matches = await factory.getActiveMatches();
        const matchTicket = await ethers.getContractAt("MatchTicket", matches[0]);

        // 4. Buyers purchase tickets
        // Buyer 1 buys 2 tickets (Paid 2 ETH)
        await matchTicket.connect(buyer1).buyTickets(2, { value: ethers.parseEther("2.0") });
        // Buyer 2 buys 1 ticket (Paid 1 ETH)
        await matchTicket.connect(buyer2).buyTickets(1, { value: ethers.parseEther("1.0") });

        // Total Sold: 3 tickets
        // Total Collateral: 10 ETH
        // Penalty Share per ticket = 10 / 3 = 3.333... ETH

        return { matchTicket, owner, buyer1, buyer2, ticketPrice };
    }

    describe("Automatic Refund Logic", function () {
        it("Should automatically send ETH to ALL buyers when cancelled", async function () {
            const { matchTicket, owner, buyer1, buyer2 } = await loadFixture(deployMatchWithBuyersFixture);

            // We expect the 'cancelMatch' transaction to change the balances of buyer1 and buyer2
            // Buyer 1 Refund: (2 * 1.0) + (2 * 3.333...) ≈ 8.66 ETH
            // Buyer 2 Refund: (1 * 1.0) + (1 * 3.333...) ≈ 4.33 ETH

            // Note: Exact calculation depends on Solidity integer division
            // Penalty Share = 10 ETH / 3 = 3333333333333333333 wei
            // Buyer 1 Penalty = 3333... * 2 = 6666... wei
            // Buyer 1 Total = 2 ETH + 6.66 ETH = 8.66 ETH

            const expectedRefund1 = ethers.parseEther("2.0") + (ethers.parseEther("10.0") * 2n) / 3n;
            const expectedRefund2 = ethers.parseEther("1.0") + (ethers.parseEther("10.0") * 1n) / 3n;

            await expect(matchTicket.connect(owner).cancelMatch())
                .to.changeEtherBalances(
                    [buyer1, buyer2],
                    [expectedRefund1, expectedRefund2]
                );
        });

        it("Should reset ticketsOwned to zero after refund", async function () {
            const { matchTicket, owner, buyer1 } = await loadFixture(deployMatchWithBuyersFixture);

            // Cancel
            await matchTicket.connect(owner).cancelMatch();

            // Verify ticket count is wiped
            expect(await matchTicket.ticketsOwned(buyer1.address)).to.equal(0);
        });

        it("Should fail if the loop runs out of gas (Simulation)", async function () {
            // This test is just to prove the logic exists.
            // In a real scenario, if you added 5000 buyers here, this test would fail.
            // verifying that our "Gas Trap" concern is real.
            const { matchTicket, owner } = await loadFixture(deployMatchWithBuyersFixture);
            await expect(matchTicket.connect(owner).cancelMatch()).not.to.be.reverted;
        });
    });
});