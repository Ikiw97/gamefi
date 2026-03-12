// js/appkit-init.js
// Optimized for Vanilla JS with esm.sh for dependency resolution

async function initAppKit() {
    console.log("[AppKit] Initializing...");
    try {
        // Use esm.sh for better dependency management in the browser
        const { createAppKit } = await import('https://esm.sh/@reown/appkit@1.1.0');
        const { EthersAdapter } = await import('https://esm.sh/@reown/appkit-adapter-ethers@1.1.0');

        const projectId = '341d7237e29683794770289a8cf6164d'; // Reown Demo Project ID

        const base = {
            chainId: 8453,
            name: 'Base',
            currency: 'ETH',
            explorerUrl: 'https://basescan.org',
            rpcUrl: 'https://mainnet.base.org'
        };

        const metadata = {
            name: 'Zico Rush',
            description: 'Diamond Rush GameFi',
            url: window.location.origin,
            icons: ['https://avatars.githubusercontent.com/u/37784886']
        };

        const modal = createAppKit({
            adapters: [new EthersAdapter()],
            networks: [base],
            metadata,
            projectId,
            features: {
                analytics: true
            }
        });

        window.appKitModal = modal;
        console.log("[AppKit] Modal initialized successfully!");

        // Add a helper to check if it's ready
        window.appKitReady = true;

    } catch (error) {
        console.error("[AppKit] Initialization Error:", error);
        window.appKitInitError = error.message;

        // Visual feedback on total failure
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(255,0,0,0.8);color:white;padding:10px;z-index:9999;font-size:12px;border-radius:5px;';
        div.textContent = 'AppKit Error: ' + error.message;
        document.body.appendChild(div);
    }
}

// Start initialization
initAppKit();
