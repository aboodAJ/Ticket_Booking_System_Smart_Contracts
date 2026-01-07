// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MatchTicketAuto.sol";

contract TicketFactory {
    MatchTicketAuto[] public matches;
    address public factoryOwner;
    address public factoryCoOwner;

    event MatchCreated(
        address indexed matchAddress,
        string name,
        address indexed owner
    );

    // 2. Set the deployer (YOU) as the owner when deploying
    constructor(address _coOwner) {
        factoryOwner = msg.sender; // You
        factoryCoOwner = _coOwner; // Your Partner (from .env)
    }

    // 3. Security Check
    modifier onlyFactoryOwner() {
        require(
            msg.sender == factoryOwner || msg.sender == factoryCoOwner,
            "Only Factory Owner or Co-Owner can create matches"
        );
        _;
    }

    // 4. Apply the lock here
    function createMatch(
        string memory _name,
        uint256 _price,
        uint256 _capacity,
        uint256 _date
    ) external payable onlyFactoryOwner {
        // _date is unix timestamp
        require(msg.value >= 0.1 ether, "Min 0.1 ETH collateral required");

        MatchTicketAuto newMatch = new MatchTicketAuto{value: msg.value}(
            _name,
            _price,
            _capacity,
            _date,
            factoryOwner,
            factoryCoOwner
        );

        matches.push(newMatch);
        emit MatchCreated(address(newMatch), _name, msg.sender);
    }

    function getActiveMatches()
        external
        view
        returns (MatchTicketAuto[] memory)
    {
        // First count active matches to allocate memory
        uint256 activeCount = 0;
        for (uint256 i = 0; i < matches.length; i++) {
            MatchTicketAuto m = matches[i];
            // Check calling purely public getters
            // Note: This assumes the MatchTicket adheres to the interface
            if (!m.isCancelled() && block.timestamp < m.matchDate()) {
                activeCount++;
            }
        }

        // Populate array
        MatchTicketAuto[] memory activeMatches = new MatchTicketAuto[](
            activeCount
        );
        uint256 index = 0;
        for (uint256 i = 0; i < matches.length; i++) {
            MatchTicketAuto m = matches[i];
            if (!m.isCancelled() && block.timestamp < m.matchDate()) {
                activeMatches[index] = m;
                index++;
            }
        }

        return activeMatches;
    }
}
