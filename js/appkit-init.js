// js/appkit-init.js
import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit/dist/index.js'
import { EthersAdapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers/dist/index.js'

// 1. Get projectId at https://cloud.reown.com
const projectId = '341d7237e29683794770289a8cf6164d' // Public demo ID, user should replace with their own.

// 2. Set chains
const base = {
    chainId: 8453,
    name: 'Base',
    currency: 'ETH',
    explorerUrl: 'https://basescan.org',
    rpcUrl: 'https://mainnet.base.org'
}

// 3. Create a metadata object
const metadata = {
    name: 'Diamond Rush',
    description: 'Diamond Rush GameFi',
    url: window.location.origin,
    icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// 4. Create AppKit instance
const modal = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [base],
    metadata,
    projectId,
    features: {
        analytics: true
    }
})

// Export for use in wallet.js
window.appKitModal = modal;
window.appKitProvider = null; // Will be set on connection

// Subscribe to state changes
modal.subscribeState(state => {
    console.log('AppKit State:', state)
})

// Listen for connection
modal.subscribeEvents(event => {
    if (event.data.event === 'CONNECT_SUCCESS') {
        console.log('Connected successfully via AppKit');
    }
});
