// js/appkit-init.js
// Optimized for Vanilla JS with confirmed CDN exports

async function initAppKit() {
    console.log("[AppKit] Starting initialization...");
    try {
        // Use esm.sh with bundle flag to ensure all dependencies are included and correctly resolved
        const moduleUrl = 'https://esm.sh/@reown/appkit-cdn@1.1.9?bundle';
        console.log("[AppKit] Importing from:", moduleUrl);

        const AppKitModule = await import(moduleUrl);

        // Defensive check for exports (some versions might have different structures)
        const createAppKit = AppKitModule.createAppKit || AppKitModule.default?.createAppKit;
        const EthersAdapter = AppKitModule.EthersAdapter || AppKitModule.default?.EthersAdapter;

        if (!createAppKit || !EthersAdapter) {
            console.error("[AppKit] Module exports missing:", AppKitModule);
            throw new Error("createAppKit or EthersAdapter not found in module");
        }

        const projectId = '341d7237e29683794770289a8cf6164d'; // Reown Demo ID

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
        window.appKitReady = true;
        console.log("[AppKit] Successfully initialized!");

    } catch (error) {
        console.error("[AppKit] Initialization failed:", error);
        window.appKitInitError = error.message;

        let errorMsg = error.message;
        if (errorMsg.includes("AccountController")) {
            errorMsg = "System version mismatch. Please clear cache and refresh.";
        }

        const debugDiv = document.createElement('div');
        debugDiv.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:rgba(220,38,38,0.95);color:white;padding:15px;z-index:99999;font-size:12px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.5);font-family:monospace;';
        debugDiv.innerHTML = `<strong>AppKit Init Error:</strong><br>${errorMsg}<br><br><small>Details: ${error.stack?.split('\n')[0]}</small>`;
        document.body.appendChild(debugDiv);
    }
}

// Kick off
initAppKit();
