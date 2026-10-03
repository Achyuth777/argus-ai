'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useDemo } from '@/contexts/DemoContext';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';

// 🚀 HACKATHON DEMO MODE - Show real devnet wallet tokens
// Connect your wallet and we'll fetch your actual devnet token positions

export interface TokenPosition {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
}

export function useWalletPositions() {
  const { publicKey } = useWallet();
  const { isDemoMode } = useDemo();
  const [positions, setPositions] = useState<TokenPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey && !isDemoMode) {
      setPositions([]);
      return;
    }
    
    if (isDemoMode || publicKey) {
      fetchPositions(publicKey);
    }
    
    // Refresh every 60 seconds to avoid rate limiting on public mainnet RPC
    const interval = setInterval(() => {
      if (isDemoMode || publicKey) {
        fetchPositions(publicKey);
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [publicKey, isDemoMode]);

  const fetchPositions = async (pk: PublicKey | null) => {
    setLoading(true);
    try {
      // Use devnet for demo - fetch real tokens from user's devnet wallet
      const rpcUrl = 'https://api.devnet.solana.com';
      const walletAddress = isDemoMode ? (pk?.toBase58() || 'DEMO_MODE') : pk?.toBase58();
      console.log('🪙 Demo Mode: Fetching your devnet token positions');
      
      // In demo mode, skip the actual fetch or return empty
      if (isDemoMode && !pk) {
        setPositions([]);
        return;
      }
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getTokenAccountsByOwner',
          params: [
             walletAddress,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, // SPL Token
            { encoding: 'jsonParsed' },
          ],
        }),
      });

      const data = await response.json();
      console.log('🪙 RAW TOKEN DATA:', data); // Task 3 ✓

      const tokenAccounts = data.result?.value || [];
      const positions: TokenPosition[] = tokenAccounts
        .filter((acc: any) => acc.account.data.parsed.info.tokenAmount.uiAmount > 0)
        .map((acc: any) => ({
          mint: acc.account.data.parsed.info.mint,
          balance: acc.account.data.parsed.info.tokenAmount.uiAmount || 0,
          decimals: acc.account.data.parsed.info.tokenAmount.decimals,
          symbol: acc.account.data.parsed.info.tokenList?.symbol || 'SPL-Token',
        }));

      console.log('📊 PROCESSED POSITIONS:', positions); // Task 4 ✓
      setPositions(positions);
    } catch (error) {
      console.error('❌ Fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return { positions, loading, refetch: () => (isDemoMode || publicKey) && fetchPositions(publicKey) };
}