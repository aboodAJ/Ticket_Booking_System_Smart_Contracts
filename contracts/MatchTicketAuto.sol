// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MatchTicketAuto {
    address public owner1;
    address public owner2;
    string public matchName;
    uint256 public ticketPrice;
    uint256 public capacity;
    uint256 public matchDate;

    uint256 public ticketsSold;
    bool public isCancelled;
    uint256 public collateral;
    mapping(address => uint256) public ticketsOwned;

    // NEW: Data structures for Automatic Refunds
    address[] public buyers;
    mapping(address => bool) public hasBought;

    event TicketPurchased(address indexed buyer, uint256 quantity);
    event MatchCancelled();
    event RefundSent(address indexed user, uint256 amount); // Renamed event
    event fundsWithdrawn(address indexed owner, uint256 amount);

    constructor(
        string memory _name,
        uint256 _price,
        uint256 _capacity,
        uint256 _date,
        address _admin1,
        address _admin2
    ) payable {
        require(msg.value > 0, "Collateral required");
        owner1 = _admin1;
        owner2 = _admin2;
        matchName = _name;
        ticketPrice = _price;
        capacity = _capacity;
        matchDate = _date;
        collateral = msg.value;
    }

    modifier onlyOwner() {
        require(
            msg.sender == owner1 || msg.sender == owner2,
            "Only an owner can perform this action"
        );
        _;
    }

    function buyTickets(uint256 _quantity) external payable {
        require(!isCancelled, "Match is cancelled");
        require(block.timestamp < matchDate, "Match has started");
        require(ticketsSold + _quantity <= capacity, "Not enough capacity");
        require(
            ticketsOwned[msg.sender] + _quantity <= 4,
            "Max 4 tickets per user"
        );
        require(msg.value == ticketPrice * _quantity, "Incorrect ether sent");

        // NEW: Add them to the list if they are new
        if (!hasBought[msg.sender]) {
            buyers.push(msg.sender);
            hasBought[msg.sender] = true;
        }

        ticketsOwned[msg.sender] += _quantity;
        ticketsSold += _quantity;

        emit TicketPurchased(msg.sender, _quantity);
    }

    // --- THE AUTOMATIC REFUND LOGIC ---
    function cancelMatch() external onlyOwner {
        require(block.timestamp < matchDate, "Too late to cancel");
        require(!isCancelled, "Already cancelled");

        isCancelled = true;

        if (ticketsSold == 0) {
            // Just send the entire contract balance (which is only the collateral) back to the caller
            uint256 balance = address(this).balance;
            payable(msg.sender).transfer(balance);

            emit MatchCancelled();
            emit fundsWithdrawn(msg.sender, balance); // Reusing event to track it
            return; // EXIT FUNCTION HERE. Do not run the loop below.
        }

        // Loop through all buyers
        for (uint256 i = 0; i < buyers.length; i++) {
            address buyer = buyers[i];
            uint256 quantity = ticketsOwned[buyer];

            if (quantity > 0) {
                // Calculate their share
                uint256 penaltyShare = (collateral * quantity) / ticketsSold;
                uint256 totalRefund = (ticketPrice * quantity) + penaltyShare;

                // Reset their tickets to 0
                ticketsOwned[buyer] = 0;

                // Send the money automatically
                payable(buyer).transfer(totalRefund);

                emit RefundSent(buyer, totalRefund);
            }
        }

        emit MatchCancelled();
    }

    function withdraw() external onlyOwner {
        require(!isCancelled, "Match was cancelled");
        require(block.timestamp >= matchDate, "Match not finished");

        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);

        emit fundsWithdrawn(msg.sender, balance);
    }
}
