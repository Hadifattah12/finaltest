const blockchainService = require('../services/blockchainService');

let currentMatches = [];
let winners = {};
let currentTournamentId = null;
let currentTournamentPlayers = [];

const startTournament = async (request, reply) => {
  const { aliases } = request.body;
  if (!Array.isArray(aliases) || aliases.length < 2 || aliases.length % 2 !== 0)
    return reply.status(400).send({ error: 'Even number of players required' });

  const shuffled = aliases.sort(() => Math.random() - 0.5);
  currentMatches = [];
  winners = {};

    // Initialize tournament for blockchain tracking
  currentTournamentId = blockchainService.generateTournamentId();
  currentTournamentPlayers = [...shuffled];

  console.log(`🏆 Starting tournament ${currentTournamentId} with ${shuffled.length} players`);

  for (let i = 0; i < shuffled.length; i += 2) {
    currentMatches.push({
      id: i / 2 + 1,
      player1: shuffled[i],
      player2: shuffled[i + 1],
      round: 1,
      winner: null
    });
  }

    return reply.send({ 
    matches: currentMatches,
    tournamentId: currentTournamentId
  });
};

const recordWinner = (request, reply) => {
  const { matchId, winner, round } = request.body;
  const match = currentMatches.find(m => m.id === matchId && m.round === round);
  if (!match) return reply.status(404).send({ error: 'Match not found' });

  match.winner = winner;
  if (!winners[round]) winners[round] = [];
  winners[round].push(winner);

  return reply.send({ message: 'Winner recorded' });
};

const nextRound = (request, reply) => {
  const round = request.body.round;
  const currentWinners = winners[round];
  if (!currentWinners || currentWinners.length < 2)
    return reply.status(400).send({ error: 'Not enough winners' });

  const nextMatches = [];
  for (let i = 0; i < currentWinners.length; i += 2) {
    nextMatches.push({
      id: i / 2 + 1,
      player1: currentWinners[i],
      player2: currentWinners[i + 1],
      round: round + 1,
      winner: null
    });
  }

  currentMatches = nextMatches;
  return reply.send({ matches: nextMatches });
};

const getMatches = (request, reply) => {
  return reply.send({ 
    matches: currentMatches,
    tournamentId: currentTournamentId,
    players: currentTournamentPlayers
  });
};

/**
 * Complete tournament and store results on blockchain
 */
const completeTournament = async (request, reply) => {
  try {
    const { finalRankings, winner } = request.body;
    
    if (!currentTournamentId) {
      return reply.status(400).send({ error: 'No active tournament' });
    }
    
    if (!finalRankings || !Array.isArray(finalRankings)) {
      return reply.status(400).send({ error: 'Final rankings required' });
    }
    
    if (!winner || typeof winner !== 'string') {
      return reply.status(400).send({ error: 'Winner required' });
    }
    
    console.log(`🏁 Completing tournament ${currentTournamentId}`);
    console.log(`📊 Final rankings: ${finalRankings.join(' > ')}`);
    console.log(`👑 Winner: ${winner}`);
    
    // Generate scores based on ranking (1st gets highest score)
    const playerScores = finalRankings.map((_, index) => {
      // Reverse scoring: 1st place gets highest score
      return finalRankings.length - index;
    });

    // Store on blockchain
    const blockchainResult = await blockchainService.recordTournament(
      currentTournamentId,
      finalRankings, // Players sorted by ranking
      winner,
      playerScores, // Scores for each player
      currentTournamentPlayers.length
    );
    
    // Reset tournament state
    const completedTournamentId = currentTournamentId;
    currentTournamentId = null;
    currentTournamentPlayers = [];
    currentMatches = [];
    winners = {};
    
    if (blockchainResult.success) {
      console.log(`✅ Tournament stored on blockchain: ${blockchainResult.transactionHash}`);
      
      return reply.send({
        message: 'Tournament completed successfully',
        tournamentId: completedTournamentId,
        blockchain: {
          success: true,
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          explorerUrl: blockchainResult.explorerUrl
        },
        rankings: finalRankings,
        winner: winner
      });
    } else {
      console.error(`❌ Failed to store tournament on blockchain: ${blockchainResult.error}`);
      
      return reply.status(500).send({
        error: 'Tournament completed but blockchain storage failed',
        tournamentId: completedTournamentId,
        blockchain: {
          success: false,
          error: blockchainResult.error
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Tournament completion error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
};

/**
 * Get tournament from blockchain
 */
const getTournamentFromBlockchain = async (request, reply) => {
  try {
    const { tournamentId } = request.params;
    
    if (!tournamentId) {
      return reply.status(400).send({ error: 'Tournament ID required' });
    }
    
    const result = await blockchainService.getTournament(tournamentId);
    
    if (result.success) {
      const rankings = await blockchainService.getTournamentRankings(tournamentId);
      
      return reply.send({
        tournament: result.tournament,
        rankings: rankings.success ? rankings.rankings : null,
        explorerUrl: `https://testnet.snowtrace.io/address/${process.env.TOURNAMENT_CONTRACT_ADDRESS}`
      });
    } else {
      return reply.status(404).send({ error: result.error });
    }
    
  } catch (error) {
    console.error('❌ Error fetching tournament:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
};

/**
 * Get blockchain service status
 */
const getBlockchainStatus = (_, reply) => {
  const status = blockchainService.getStatus();
  return reply.send(status);
};

module.exports = { 
  startTournament, 
  recordWinner, 
  nextRound, 
  getMatches,
  completeTournament,
  getTournamentFromBlockchain,
  getBlockchainStatus
};