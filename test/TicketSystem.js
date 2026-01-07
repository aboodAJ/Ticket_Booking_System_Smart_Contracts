const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("TicketSystem", function () {
    // Updated fixture to account for Factory Co-Owner
    async function deployFactoryFixture() {
        const [owner, coOwner, buyer1, buyer2, other] = await ethers.getSigners();

        const TicketFactory = await ethers.getContractFactory("TicketFactory");
        // Deploy with coOwner address as argument
        const factory = await TicketFactory.deploy(coOwner.address);

        return { factory, owner, coOwner, buyer1, buyer2, other };
    }

    describe("Deployment", function () {
        it("Should deploy the factory with correct owners", async function () {
            const { factory, owner, coOwner } = await loadFixture(deployFactoryFixture);
            expect(await factory.getAddress()).to.be.properAddress;
            expect(await factory.factoryOwner()).to.equal(owner.address);
            expect(await factory.factoryCoOwner()).to.equal(coOwner.address);
        });
    });

    describe("Match Creation", function () {
        it("Should allow Factory Owner to create a match", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");

            await expect(factory.connect(owner).createMatch("Match 1", ethers.parseEther("0.1"), 100, futureDate, { value: collateral }))
                .to.emit(factory, "MatchCreated");
        });

        it("Should allow Factory Co-Owner to create a match", async function () {
            const { factory, coOwner } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");

            await expect(factory.connect(coOwner).createMatch("Match 2", ethers.parseEther("0.1"), 100, futureDate, { value: collateral }))
                .to.emit(factory, "MatchCreated");
        });

        it("Should FAIL if a random user tries to create a match", async function () {
            const { factory, buyer1 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");

            await expect(factory.connect(buyer1).createMatch("Scam Match", ethers.parseEther("0.1"), 100, futureDate, { value: collateral }))
                .to.be.revertedWith("Only Factory Owner or Co-Owner can create matches");
        });
    });

    describe("Buying Tickets", function () {
        async function deployMatchFixture() {
            const { factory, owner, coOwner, buyer1, buyer2 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const ticketPrice = ethers.parseEther("0.1");
            const collateral = ethers.parseEther("1.0");

            // Owner creates match
            await factory.createMatch("Test Match", ticketPrice, 10, futureDate, { value: collateral });

            const matches = await factory.getActiveMatches();
            const matchTicket = await ethers.getContractAt("MatchTicket", matches[0]);

            return { matchTicket, owner, coOwner, buyer1, buyer2, ticketPrice, collateral, futureDate, factory };
        }

        it("Should allow buying tickets", async function () {
            const { matchTicket, buyer1, ticketPrice } = await loadFixture(deployMatchFixture);

            await expect(matchTicket.connect(buyer1).buyTickets(2, { value: ticketPrice * 2n }))
                .to.emit(matchTicket, "TicketPurchased")
                .withArgs(buyer1.address, 2);

            expect(await matchTicket.ticketsSold()).to.equal(2);
            expect(await matchTicket.ticketsOwned(buyer1.address)).to.equal(2);
        });

        it("Should prevent buying more than 4 tickets", async function () {
            const { matchTicket, buyer1, ticketPrice } = await loadFixture(deployMatchFixture);

            await expect(matchTicket.connect(buyer1).buyTickets(5, { value: ticketPrice * 5n }))
                .to.be.revertedWith("Max 4 tickets per user");
        });
    });

    describe("Cancellation and Refunds", function () {
        async function deployMatchWithSalesFixture() {
            const { factory, owner, coOwner, buyer1 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const ticketPrice = ethers.parseEther("1.0");
            const collateral = ethers.parseEther("10.0");

            await factory.createMatch("Test Match", ticketPrice, 10, futureDate, { value: collateral });
            const matches = await factory.getActiveMatches();
            const matchTicket = await ethers.getContractAt("MatchTicket", matches[0]);

            await matchTicket.connect(buyer1).buyTickets(2, { value: ticketPrice * 2n });

            return { matchTicket, owner, coOwner, factory, buyer1, ticketPrice, collateral };
        }

        it("Should allow Owner 1 to cancel", async function () {
            const { matchTicket, owner } = await loadFixture(deployMatchWithSalesFixture);

            await expect(matchTicket.connect(owner).cancelMatch())
                .to.emit(matchTicket, "MatchCancelled");
            expect(await matchTicket.isCancelled()).to.be.true;
        });

        it("Should allow Owner 2 (Co-Owner) to cancel", async function () {
            const { matchTicket, coOwner } = await loadFixture(deployMatchWithSalesFixture);

            await expect(matchTicket.connect(coOwner).cancelMatch())
                .to.emit(matchTicket, "MatchCancelled");
            expect(await matchTicket.isCancelled()).to.be.true;
        });

        it("Should calculate refund correctly with penalty", async function () {
            const { matchTicket, owner, buyer1 } = await loadFixture(deployMatchWithSalesFixture);

            await matchTicket.connect(owner).cancelMatch();

            // Exp Refund: (Price 1.0 * Qty 2) + ((Collateral 10 * Qty 2) / Sold 2) = 2 + 10 = 12
            await expect(matchTicket.connect(buyer1).claimRefund())
                .to.changeEtherBalance(buyer1, ethers.parseEther("12.0"));
        });
    });

    describe("Withdrawal (Dual Ownership)", function () {
        it("Should allow Owner 1 to withdraw", async function () {
            const { factory, owner, coOwner, buyer1 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");
            const ticketPrice = ethers.parseEther("0.1");

            await factory.createMatch("Test", ticketPrice, 100, futureDate, { value: collateral });
            const matches = await factory.getActiveMatches();
            const ticket = await ethers.getContractAt("MatchTicket", matches[0]);

            await ticket.connect(buyer1).buyTickets(1, { value: ticketPrice });

            await time.increaseTo(futureDate + 1);

            // withdraw sends balance to msg.sender
            // Balance = 1.0 collateral + 0.1 sales = 1.1 ETH
            await expect(ticket.connect(owner).withdraw())
                .to.changeEtherBalance(owner, ethers.parseEther("1.1"));
        });

        it("Should allow Owner 2 to withdraw", async function () {
            const { factory, owner, coOwner, buyer1 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");
            const ticketPrice = ethers.parseEther("0.1");

            await factory.createMatch("Test", ticketPrice, 100, futureDate, { value: collateral });
            const matches = await factory.getActiveMatches();
            const ticket = await ethers.getContractAt("MatchTicket", matches[0]);

            await ticket.connect(buyer1).buyTickets(1, { value: ticketPrice });

            await time.increaseTo(futureDate + 1);

            // withdraw sends balance to msg.sender
            await expect(ticket.connect(coOwner).withdraw())
                .to.changeEtherBalance(coOwner, ethers.parseEther("1.1"));
        });
    });
});
