// frontend/src/utils/blockchain.ts
import { apiFetch } from './api';

export interface BlockchainStatus {
  enabled: boolean;
  hasProvider: boolean;
  hasWallet: boolean;
  hasContract: boolean;
  walletAddress?: string;
  network?: string;
  contractAddress?: string;
}

export interface TournamentRanking {
  player: string;
  position: string;
}

export interface BlockchainTournament {
  players: string[];
  winner: string;
  tournamentSize: number;
  timestamp: number;
  exists: boolean;
}

export interface BlockchainResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Get blockchain service status
 */
export async function getBlockchainStatus(): Promise<BlockchainStatus> {
  try {
    const response = await apiFetch('/api/blockchain/status');
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch blockchain status');
  } catch (error) {
    console.error('Error fetching blockchain status:', error);
    return {
      enabled: false,
      hasProvider: false,
      hasWallet: false,
      hasContract: false
    };
  }
}

/**
 * Complete tournament and store on blockchain
 */
export async function completeTournament(
  finalRankings: string[], 
  winner: string
): Promise<{
  success: boolean;
  tournamentId?: string;
  blockchain?: BlockchainResult;
  error?: string;
}> {
  try {
    const response = await apiFetch('/api/tournament/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        finalRankings,
        winner
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        tournamentId: data.tournamentId,
        blockchain: data.blockchain
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to complete tournament'
      };
    }
    
  } catch (error) {
    console.error('Error completing tournament:', error);
    return {
      success: false,
      error: 'Network error'
    };
  }
}

/**
 * Get tournament from blockchain
 */
export async function getTournamentFromBlockchain(tournamentId: string): Promise<{
  success: boolean;
  tournament?: BlockchainTournament;
  rankings?: TournamentRanking[];
  explorerUrl?: string;
  error?: string;
}> {
  try {
    const response = await apiFetch(`/api/tournament/blockchain/${tournamentId}`);
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        tournament: data.tournament,
        rankings: data.rankings,
        explorerUrl: data.explorerUrl
      };
    } else {
      return {
        success: false,
        error: data.error || 'Tournament not found'
      };
    }
    
  } catch (error) {
    console.error('Error fetching tournament from blockchain:', error);
    return {
      success: false,
      error: 'Network error'
    };
  }
}

/**
 * Format blockchain explorer URL for transaction
 */
export function getExplorerUrl(txHash: string): string {
  return `https://testnet.snowtrace.io/tx/${txHash}`;
}

/**
 * Format blockchain explorer URL for contract
 */
export function getContractExplorerUrl(contractAddress: string): string {
  return `https://testnet.snowtrace.io/address/${contractAddress}`;
}

/**
 * Format timestamp for display
 */
export function formatBlockchainTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}