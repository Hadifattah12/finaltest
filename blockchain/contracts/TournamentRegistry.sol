// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TournamentRegistry
 */
contract TournamentRegistry {
    
    // Tournament structure
    struct Tournament {
        string[] players;     
        string winner;   
        uint256[] scores;    
        uint256 tournamentSize; 
        uint256 timestamp;   
        bool exists;       
    }
    
    // Storage
    mapping(string => Tournament) private tournaments;
    mapping(string => string[]) private playerTournaments; 
    string[] private allTournamentIds;
    
    // Contract owner
    address public owner;
    
    // Event
    event TournamentRecorded(
        string indexed tournamentId,
        string indexed winner,
        uint256 tournamentSize,
        uint256 timestamp
    );
    
    // Modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier tournamentExists(string memory tournamentId) {
        require(tournaments[tournamentId].exists, "Tournament does not exist");
        _;
    }
    
    // Constructor
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Record a tournament result on the blockchain
     */
    function recordTournament(
        string memory tournamentId,
        string[] memory playersRanked,
        string memory winner,
        uint256[] memory playerScores,
        uint256 tournamentSize
    ) external onlyOwner {
        require(!tournaments[tournamentId].exists, "Tournament already exists");
        require(playersRanked.length == tournamentSize, "Player count mismatch");
        require(playerScores.length == tournamentSize, "Score count mismatch");
        require(tournamentSize == 4 || tournamentSize == 8, "Invalid tournament size");
        require(bytes(winner).length > 0, "Winner cannot be empty");
        
        // Verify winner is in players list
        bool winnerFound = false;
        for (uint i = 0; i < playersRanked.length; i++) {
            require(bytes(playersRanked[i]).length > 0, "Player name cannot be empty");
            if (keccak256(bytes(playersRanked[i])) == keccak256(bytes(winner))) {
                winnerFound = true;
            }
        }
        require(winnerFound, "Winner must be in players list");
        
        // Store tournament
        tournaments[tournamentId] = Tournament({
            players: playersRanked,
            winner: winner,
            scores: playerScores,
            tournamentSize: tournamentSize,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Add to tournament list
        allTournamentIds.push(tournamentId);
        
        // Add tournament to each player's list
        for (uint i = 0; i < playersRanked.length; i++) {
            playerTournaments[playersRanked[i]].push(tournamentId);
        }
        
        emit TournamentRecorded(tournamentId, winner, tournamentSize, block.timestamp);
    }
    
    /**
     * @dev Get all players in a tournament (sorted by ranking)
     */
    function getTournamentPlayers(string memory tournamentId) 
        external 
        view 
        tournamentExists(tournamentId)
        returns (string[] memory) 
    {
        return tournaments[tournamentId].players;
    }
    
    /**
     * @dev Get the winner of a tournament
     * @return Winner's name
     */
    function getTournamentWinner(string memory tournamentId) 
        external 
        view 
        tournamentExists(tournamentId)
        returns (string memory) 
    {
        return tournaments[tournamentId].winner;
    }
    
    /**
     * @dev Get all scores in a tournament
     * @return Array of scores for each player
     */
    function getTournamentScores(string memory tournamentId) 
        external 
        view 
        tournamentExists(tournamentId)
        returns (uint256[] memory) 
    {
        return tournaments[tournamentId].scores;
    }
    
    /**
     * @dev Get tournament rankings with position labels
     */
    function getTournamentRankings(string memory tournamentId)
        external
        view
        tournamentExists(tournamentId)
        returns (string[] memory players, string[] memory positions)
    {
        Tournament memory tournament = tournaments[tournamentId];
        players = tournament.players;
        
        positions = new string[](players.length);
        for (uint i = 0; i < players.length; i++) {
            if (i == 0) positions[i] = "1st";
            else if (i == 1) positions[i] = "2nd";
            else if (i == 2) positions[i] = "3rd";
            else positions[i] = string(abi.encodePacked(uintToString(i + 1), "th"));
        }
        
        return (players, positions);
    }
    
    /**
     * @dev Check if tournament has 4 players
     */
    function isTournament4Players(string memory tournamentId) 
        external 
        view 
        tournamentExists(tournamentId)
        returns (bool) 
    {
        return tournaments[tournamentId].tournamentSize == 4;
    }
    
    /**
     * @dev Check if tournament has 8 players
     */
    function isTournament8Players(string memory tournamentId) 
        external 
        view 
        tournamentExists(tournamentId)
        returns (bool) 
    {
        return tournaments[tournamentId].tournamentSize == 8;
    }

    /**
     * @dev Get all tournaments for a specific player
     * @return Array of tournament IDs the player participated in
     */
    function getUserTournaments(string memory playerName) 
        external 
        view 
        returns (string[] memory) 
    {
        return playerTournaments[playerName];
    }
    
    /**
     * @dev Get how many tournaments a player participated in
     */
    function getPlayerTournamentCount(string memory playerName) 
        external 
        view 
        returns (uint256) 
    {
        return playerTournaments[playerName].length;
    }
    
    /**
     * @dev Get how many tournaments a player won
     * @return Number of tournaments the player won
     */
    function getPlayerWins(string memory playerName) 
        external 
        view 
        returns (uint256) 
    {
        uint256 wins = 0;
        string[] memory playerTournamentIds = playerTournaments[playerName];
        
        for (uint i = 0; i < playerTournamentIds.length; i++) {
            if (keccak256(bytes(tournaments[playerTournamentIds[i]].winner)) == keccak256(bytes(playerName))) {
                wins++;
            }
        }
        
        return wins;
    }
    
    /**
     * @dev Get player's win rate as percentage (0-100)
     * @return Win rate percentage (0-100)
     */
    function getPlayerWinRate(string memory playerName) 
        external 
        view 
        returns (uint256) 
    {
        uint256 totalTournaments = playerTournaments[playerName].length;
        if (totalTournaments == 0) return 0;
        
        uint256 wins = 0;
        string[] memory playerTournamentIds = playerTournaments[playerName];
        
        for (uint i = 0; i < playerTournamentIds.length; i++) {
            if (keccak256(bytes(tournaments[playerTournamentIds[i]].winner)) == keccak256(bytes(playerName))) {
                wins++;
            }
        }
        
        return (wins * 100) / totalTournaments;
    }
    
    /**
     * @dev Get all rankings/positions for a player across all tournaments
     */
    function getPlayerRankings(string memory playerName) 
        external 
        view 
        returns (string[] memory) 
    {
        string[] memory playerTournamentIds = playerTournaments[playerName];
        string[] memory rankings = new string[](playerTournamentIds.length);
        
        for (uint i = 0; i < playerTournamentIds.length; i++) {
            Tournament memory tournament = tournaments[playerTournamentIds[i]];
            
            // Find player's position in this tournament
            for (uint j = 0; j < tournament.players.length; j++) {
                if (keccak256(bytes(tournament.players[j])) == keccak256(bytes(playerName))) {
                    if (j == 0) rankings[i] = "1st";
                    else if (j == 1) rankings[i] = "2nd";
                    else if (j == 2) rankings[i] = "3rd";
                    else rankings[i] = string(abi.encodePacked(uintToString(j + 1), "th"));
                    break;
                }
            }
        }
        
        return rankings;
    }
    
    /**
     * @dev Get all tournament IDs
     */
    function getAllTournamentIds() external view returns (string[] memory) {
        return allTournamentIds;
    }
    
    /**
     * @dev Get total number of tournaments recorded
     */
    function getTournamentCount() external view returns (uint256) {
        return allTournamentIds.length;
    }
    
    /**
     * @dev Get all 8-player tournament IDs
     */
    function getBiggestTournaments() 
        external 
        view 
        returns (string[] memory) 
    {
        // Count 8-player tournaments first
        uint256 count = 0;
        for (uint i = 0; i < allTournamentIds.length; i++) {
            if (tournaments[allTournamentIds[i]].tournamentSize == 8) {
                count++;
            }
        }
        
        // Create array with exact size
        string[] memory bigTournaments = new string[](count);
        uint256 index = 0;
        
        for (uint i = 0; i < allTournamentIds.length; i++) {
            if (tournaments[allTournamentIds[i]].tournamentSize == 8) {
                bigTournaments[index] = allTournamentIds[i];
                index++;
            }
        }
        
        return bigTournaments;
    }
    
    /**
     * @dev Get all 4-player tournament IDs  
     */
    function getSmallestTournaments() 
        external 
        view 
        returns (string[] memory) 
    {
        // Count 4-player tournaments first
        uint256 count = 0;
        for (uint i = 0; i < allTournamentIds.length; i++) {
            if (tournaments[allTournamentIds[i]].tournamentSize == 4) {
                count++;
            }
        }
        
        // Create array with exact size
        string[] memory smallTournaments = new string[](count);
        uint256 index = 0;
        
        for (uint i = 0; i < allTournamentIds.length; i++) {
            if (tournaments[allTournamentIds[i]].tournamentSize == 4) {
                smallTournaments[index] = allTournamentIds[i];
                index++;
            }
        }
        
        return smallTournaments;
    }
    
    /**
     * @dev Transfer ownership of the contract
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    // Helper function to convert uint to string
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}