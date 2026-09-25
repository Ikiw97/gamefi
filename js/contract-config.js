/**
 * contract-config.js
 * Centralized configuration for smart contracts.
 * Move this out of HTML to keep the code cleaner and slightly less exposed.
 */

const NFT_CONTRACT_ADDRESS = '0xa30E36B7a8FAB7934fae9ABd4d534aD22F339CCe';
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';
const MINT_FEE_USD = 0; // $0 fee

// Minimal ABI for ZicoRushBadge contract
const NFT_ABI = [
    'function mint() external payable',
    'function hasMinted(address) view returns (bool)',
    'function mintPrice() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function mintEnabled() view returns (bool)',
    'function balanceOf(address) view returns (uint256)'
];

// Export to window object for global access
window.NFT_CONFIG = {
    address: NFT_CONTRACT_ADDRESS,
    abi: NFT_ABI,
    chainId: SEPOLIA_CHAIN_ID,
    chainIdHex: SEPOLIA_CHAIN_ID_HEX,
    mintFeeUsd: MINT_FEE_USD
};
