const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("TicketSystem", function () {
    async function deployFactoryFixture() {
        const [owner, otherAccount, buyer1, buyer2] = await ethers.getSigners();

        const TicketFactory = await ethers.getContractFactory("TicketFactory");
        const factory = await TicketFactory.deploy();

        return { factory, owner, otherAccount, buyer1, buyer2 };
    }

    describe("Deployment", function () {
        it("Should deploy the factory", async function () {
            const { factory } = await loadFixture(deployFactoryFixture);
            expect(await factory.getAddress()).to.be.properAddress;
        });
    });

    describe("Match Creation", function () {
        it("Should create a match with collateral", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);

            const futureDate = (await time.latest()) + 86400; // 1 day later
            const collateral = ethers.parseEther("1.0");

            await expect(factory.createMatch("Test Match", ethers.parseEther("0.1"), 100, futureDate, { value: collateral }))
                .to.emit(factory, "MatchCreated");

            const matches = await factory.getActiveMatches();
            expect(matches.length).to.equal(1);
        });

        it("Should fail if collateral is too low", async function () {
            const { factory } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;

            await expect(factory.createMatch("Test Match", ethers.parseEther("0.1"), 100, futureDate, { value: ethers.parseEther("0.01") }))
                .to.be.revertedWith("Min 0.1 ETH collateral required");
        });
    });

    describe("Buying Tickets", function () {
        async function deployMatchFixture() {
            const { factory, owner, buyer1, buyer2 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const ticketPrice = ethers.parseEther("0.1");
            const collateral = ethers.parseEther("1.0");

            const tx = await factory.createMatch("Test Match", ticketPrice, 10, futureDate, { value: collateral });
            const receipt = await tx.wait();

            const matches = await factory.getActiveMatches();
            const matchAddress = matches[0];
            const matchTicket = await ethers.getContractAt("MatchTicket", matchAddress);

            return { matchTicket, owner, buyer1, buyer2, ticketPrice, collateral, futureDate };
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
            const { factory, owner, buyer1, buyer2 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const ticketPrice = ethers.parseEther("1.0"); // 1 ETH ticket
            const collateral = ethers.parseEther("10.0"); // 10 ETH collateral

            await factory.createMatch("Test Match", ticketPrice, 10, futureDate, { value: collateral });
            const matches = await factory.getActiveMatches();
            const matchTicket = await ethers.getContractAt("MatchTicket", matches[0]);

            await matchTicket.connect(buyer1).buyTickets(2, { value: ticketPrice * 2n });

            return { matchTicket, owner, factory, buyer1, ticketPrice, collateral };
        }

        it("Should allow owner to cancel", async function () {
            const { matchTicket, owner } = await loadFixture(deployMatchWithSalesFixture);

            await expect(matchTicket.connect(owner).cancelMatch())
                .to.emit(matchTicket, "MatchCancelled");

            expect(await matchTicket.isCancelled()).to.be.true;
        });

        it("Should calculate refund correctly with penalty", async function () {
            const { matchTicket, owner, buyer1, ticketPrice, collateral } = await loadFixture(deployMatchWithSalesFixture);

            await matchTicket.connect(owner).cancelMatch();

            // Exp Refund: (Price 1.0 * Qty 2) + ((Collateral 10 * Qty 2) / Sold 2) = 2 + 10 = 12
            await expect(matchTicket.connect(buyer1).claimRefund())
                .to.changeEtherBalance(buyer1, ethers.parseEther("12.0"));
        });

        it("Should clean up active matches list", async function () {
            const { matchTicket, owner, factory } = await loadFixture(deployMatchWithSalesFixture);

            let active = await factory.getActiveMatches();
            expect(active.length).to.equal(1);

            await matchTicket.connect(owner).cancelMatch();

            active = await factory.getActiveMatches();
            expect(active.length).to.equal(0);
        });
    });

    describe("Withdrawal (Happy Path)", function () {
        it("Should allow owner to withdraw after match date", async function () {
            const { factory, owner, buyer1 } = await loadFixture(deployFactoryFixture);
            const futureDate = (await time.latest()) + 86400;
            const collateral = ethers.parseEther("1.0");
            const ticketPrice = ethers.parseEther("0.1");

            await factory.createMatch("Test", ticketPrice, 100, futureDate, { value: collateral });
            const matches = await factory.getActiveMatches();
            const ticket = await ethers.getContractAt("MatchTicket", matches[0]);

            await ticket.connect(buyer1).buyTickets(1, { value: ticketPrice });

            await expect(ticket.connect(owner).withdraw()).to.be.revertedWith("Match not finished");

            await time.increaseTo(futureDate + 1);

            await expect(ticket.connect(owner).withdraw())
                .to.changeEtherBalance(owner, ethers.parseEther("1.1"));
        });
    });
});
