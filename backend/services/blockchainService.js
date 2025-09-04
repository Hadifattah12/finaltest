// backend/services/blockchainService.js
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

// Tournament Registry Contract ABI (minimal for our new contract)
const TOURNAMENT_REGISTRY_ABI = [
  "constructor()",
  "function owner() view returns (address)",
  "function getTournamentCount() view returns (uint256)",
  "function getAllTournamentIds() view returns (string[])",
  "function recordTournament(string tournamentId, string[] playersRanked, string winner, uint256[] playerScores, uint256 tournamentSize)",
  "function getTournamentPlayers(string tournamentId) view returns (string[])",
  "function getTournamentWinner(string tournamentId) view returns (string)",
  "function getTournamentScores(string tournamentId) view returns (uint256[])",
  "function getTournamentRankings(string tournamentId) view returns (string[] players, string[] positions)",
  "function getUserTournaments(string playerName) view returns (string[])",
  "function getPlayerTournamentCount(string playerName) view returns (uint256)",
  "function getPlayerWins(string playerName) view returns (uint256)",
  "function getPlayerWinRate(string playerName) view returns (uint256)",
  "function getPlayerRankings(string playerName) view returns (string[])",
  "function isTournament4Players(string tournamentId) view returns (bool)",
  "function isTournament8Players(string tournamentId) view returns (bool)",
  "function getBiggestTournaments() view returns (string[])",
  "function getSmallestTournaments() view returns (string[])",
  "function transferOwnership(address newOwner)",
  "event TournamentRecorded(string indexed tournamentId, string indexed winner, uint256 tournamentSize, uint256 timestamp)"
];

class BlockchainService {
  constructor() {
    this.isEnabled = process.env.BLOCKCHAIN_ENABLED === 'true';
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    
    if (this.isEnabled) {
      this.initialize();
    }
  }
  
  /**
   * Initialize blockchain connection
   */
  async initialize() {
    try {
      console.log('🔗 Initializing blockchain service...');
      
      // Setup provider (Avalanche Fuji testnet)
      this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
      
      // Setup wallet
      if (!process.env.BLOCKCHAIN_PRIVATE_KEY) {
        throw new Error('BLOCKCHAIN_PRIVATE_KEY not found in environment');
      }
      
      this.wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, this.provider);
      console.log(`💰 Wallet connected: ${this.wallet.address}`);
      
      // Check network
      const network = await this.provider.getNetwork();
      console.log(`🌐 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
      
      // Setup contract (will be set after deployment)
      if (process.env.TOURNAMENT_CONTRACT_ADDRESS) {
        this.contract = new ethers.Contract(
          process.env.TOURNAMENT_CONTRACT_ADDRESS,
          TOURNAMENT_REGISTRY_ABI,
          this.wallet
        );
        console.log(`📄 Contract connected: ${process.env.TOURNAMENT_CONTRACT_ADDRESS}`);
      } else {
        console.log('⚠️  Contract address not set. Deploy contract first.');
      }
      
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💎 Wallet balance: ${ethers.formatEther(balance)} AVAX`);
      
    } catch (error) {
      console.error('❌ Blockchain initialization failed:', error.message);
      this.isEnabled = false;
    }
  }
  
  /**
   * Set contract address after deployment
   */
  setContractAddress(address) {
    if (!this.isEnabled) return false;
    
    this.contract = new ethers.Contract(address, TOURNAMENT_REGISTRY_ABI, this.wallet);
    console.log(`📄 Contract address updated: ${address}`);
    return true;
  }
  
  /**
   * Record tournament result on blockchain
   */
  async recordTournament(tournamentId, playersRanked, winner, playerScores, tournamentSize) {
    if (!this.isEnabled || !this.contract) {
      console.log('⚠️  Blockchain not enabled or contract not set');
      return { success: false, error: 'Blockchain not available' };
    }
    
    try {
      console.log(`🏆 Recording tournament ${tournamentId} on blockchain...`);
      console.log(`📋 Players: ${playersRanked.join(', ')}`);
      console.log(`👑 Winner: ${winner}`);
      console.log(`👥 Size: ${tournamentSize}`);
      
      // Estimate gas
      const gasEstimate = await this.contract.recordTournament.estimateGas(
        tournamentId, playersRanked, winner, playerScores, tournamentSize
      );
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      
      // Send transaction
      const tx = await this.contract.recordTournament(
        tournamentId, playersRanked, winner, playerScores, tournamentSize,
        { gasLimit: gasEstimate * 120n / 100n } // 20% buffer
      );
      
      console.log(`🚀 Transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`✅ Tournament recorded! Block: ${receipt.blockNumber}`);
      
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: `https://testnet.snowtrace.io/tx/${tx.hash}`
      };
      
    } catch (error) {
      console.error('❌ Failed to record tournament:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
  
  /**
   * Get tournament from blockchain
   */
  async getTournament(tournamentId) {
    if (!this.isEnabled || !this.contract) {
      return { success: false, error: 'Blockchain not available' };
    }
    
    try {
      const tournament = await this.contract.getTournament(tournamentId);
      
      if (!tournament.exists) {
        return { success: false, error: 'Tournament not found' };
      }
      
      return {
        success: true,
        tournament: {
          players: tournament.players,
          winner: tournament.winner,
          tournamentSize: Number(tournament.tournamentSize),
          timestamp: Number(tournament.timestamp),
          exists: tournament.exists
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to get tournament:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get tournament rankings with position labels
   */
  async getTournamentRankings(tournamentId) {
    if (!this.isEnabled || !this.contract) {
      return { success: false, error: 'Blockchain not available' };
    }
    
    try {
      const [players, positions] = await this.contract.getTournamentRankings(tournamentId);
      
      return {
        success: true,
        rankings: players.map((player, index) => ({
          player,
          position: positions[index]
        }))
      };
      
    } catch (error) {
      console.error('❌ Failed to get rankings:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all tournaments for a player
   */
  async getPlayerTournaments(playerName) {
    if (!this.isEnabled || !this.contract) {
      return { success: false, error: 'Blockchain not available' };
    }
    
    try {
      const tournamentIds = await this.contract.getPlayerTournaments(playerName);
      
      return {
        success: true,
        tournaments: tournamentIds
      };
      
    } catch (error) {
      console.error('❌ Failed to get player tournaments:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get total tournament count
   */
  async getTournamentCount() {
    if (!this.isEnabled || !this.contract) {
      return { success: false, error: 'Blockchain not available' };
    }
    
    try {
      const count = await this.contract.getTournamentCount();
      return { success: true, count: Number(count) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if service is ready
   */
  isReady() {
    return this.isEnabled && this.contract !== null;
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      hasProvider: this.provider !== null,
      hasWallet: this.wallet !== null,
      hasContract: this.contract !== null,
      walletAddress: this.wallet?.address,
      network: process.env.BLOCKCHAIN_NETWORK,
      contractAddress: process.env.TOURNAMENT_CONTRACT_ADDRESS
    };
  }
  
  /**
   * Generate unique tournament ID
   */
  generateTournamentId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TOURNEY_${timestamp}_${random}`;
  }
}

// Export singleton instance
module.exports = new BlockchainService();