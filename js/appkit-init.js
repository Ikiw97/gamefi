// js/appkit-init.js
// Specialized for Vanilla JS using the official AppKit CDN bundle

async function initAppKit() {
    console.log("[AppKit] Initializing via official CDN bundle...");
    try {
        // Import from the official bundled CDN
        const { createAppKit, EthersAdapter } = await import('https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.1.0/dist/appkit.js');

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
        console.log("[AppKit] Modal initialized successfully via bundle!");
        window.appKitReady = true;

    } catch (error) {
        console.error("[AppKit] Bundle Loading Error:", error);
        window.appKitInitError = error.message;

        // Final fallback if the bundle URL is wrong/offline
        let errorHint = "Please check your internet connection or try again.";
        if (error.message.includes("AccountController")) {
            errorHint = "System version mismatch. Please clear browser cache and refresh.";
        }

        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(255,0,0,0.9);color:white;padding:12px;z-index:9999;font-size:12px;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);border:1px solid white;';
        div.innerHTML = `<b>AppKit Error:</b><br>${error.message}<br><small>${errorHint}</small>`;
        document.body.appendChild(div);
    }
}

// Start initialization
initAppKit();
