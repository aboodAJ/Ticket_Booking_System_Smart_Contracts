// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MatchTicket.sol";

contract TicketFactory {
    MatchTicket[] public matches;

    event MatchCreated(
        address indexed matchAddress,
        string name,
        address indexed owner
    );

    function createMatch(
        string memory _name,
        uint256 _price,
        uint256 _capacity,
        uint256 _date
    ) external payable {
        // _date is unix timestamp
        require(msg.value >= 0.1 ether, "Min 0.1 ETH collateral required");

        MatchTicket newMatch = new MatchTicket{value: msg.value}(
            _name,
            _price,
            _capacity,
            _date,
            msg.sender
        );

        matches.push(newMatch);
        emit MatchCreated(address(newMatch), _name, msg.sender);
    }

    function getActiveMatches() external view returns (MatchTicket[] memory) {
        // First count active matches to allocate memory
        uint256 activeCount = 0;
        for (uint256 i = 0; i < matches.length; i++) {
            MatchTicket m = matches[i];
            // Check calling purely public getters
            // Note: This assumes the MatchTicket adheres to the interface
            if (!m.isCancelled() && block.timestamp < m.matchDate()) {
                activeCount++;
            }
        }

        // Populate array
        MatchTicket[] memory activeMatches = new MatchTicket[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < matches.length; i++) {
            MatchTicket m = matches[i];
            if (!m.isCancelled() && block.timestamp < m.matchDate()) {
                activeMatches[index] = m;
                index++;
            }
        }

        return activeMatches;
    }
}
