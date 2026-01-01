// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MatchTicket {
    address public owner;
    string public matchName;
    uint256 public ticketPrice;
    uint256 public capacity;
    uint256 public matchDate;
    
    uint256 public ticketsSold;
    bool public isCancelled;
    uint256 public collateral;
    
    mapping(address => uint256) public ticketsOwned;

    event TicketPurchased(address indexed buyer, uint256 quantity);
    event MatchCancelled();
    event RefundClaimed(address indexed user, uint256 amount);
    event fundsWithdrawn(address indexed owner, uint256 amount);

    constructor(
        string memory _name, 
        uint256 _price, 
        uint256 _capacity, 
        uint256 _date, 
        address _creator
    ) payable {
        require(msg.value > 0, "Collateral required");
        owner = _creator;
        matchName = _name;
        ticketPrice = _price;
        capacity = _capacity;
        matchDate = _date;
        collateral = msg.value;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function buyTickets(uint256 _quantity) external payable {
        require(!isCancelled, "Match is cancelled");
        require(block.timestamp < matchDate, "Match has started");
        require(ticketsSold + _quantity <= capacity, "Not enough capacity");
        require(ticketsOwned[msg.sender] + _quantity <= 4, "Max 4 tickets per user");
        require(msg.value == ticketPrice * _quantity, "Incorrect ether sent");

        ticketsOwned[msg.sender] += _quantity;
        ticketsSold += _quantity;

        emit TicketPurchased(msg.sender, _quantity);
    }

    function cancelMatch() external onlyOwner {
        require(block.timestamp < matchDate, "Too late to cancel");
        require(!isCancelled, "Already cancelled");
        
        isCancelled = true;
        emit MatchCancelled();
    }

    function claimRefund() external {
        require(isCancelled, "Match not cancelled");
        uint256 quantity = ticketsOwned[msg.sender];
        require(quantity > 0, "No tickets to refund");

        // Calculate refund
        // Math: UserRefund = (Price * Quantity) + ((Collateral / TotalSold) * Quantity)
        // Using (Collateral * Quantity) / TotalSold for better precision
        uint256 penaltyShare = (collateral * quantity) / ticketsSold;
        uint256 totalRefund = (ticketPrice * quantity) + penaltyShare;

        ticketsOwned[msg.sender] = 0; // Prevent re-entrancy impact
        
        payable(msg.sender).transfer(totalRefund);
        
        emit RefundClaimed(msg.sender, totalRefund);
    }

    function withdraw() external onlyOwner {
        require(!isCancelled, "Match was cancelled");
        require(block.timestamp >= matchDate, "Match not finished");
        
        uint256 balance = address(this).balance;
        payable(owner).transfer(balance);
        
        emit fundsWithdrawn(owner, balance);
    }
}
