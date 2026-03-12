// js/appkit-init.js
// Reown AppKit initialization for vanilla JS (CDN version)
// Uses @reown/appkit-cdn which exports: createAppKit, networks, WagmiAdapter

async function initAppKit() {
    console.log("[AppKit] Starting initialization...");
    try {
        // Use UNPKG CDN for the AppKit CDN bundle
        const cdnUrl = 'https://unpkg.com/@reown/appkit-cdn@1.8.17/dist/appkit.js';
        console.log("[AppKit] Importing from CDN...");

        const AppKitModule = await import(cdnUrl);

        const createAppKit = AppKitModule.createAppKit || AppKitModule.default?.createAppKit;
        const networks = AppKitModule.networks || AppKitModule.default?.networks;

        if (!createAppKit) {
            console.error("[AppKit] createAppKit not found in module. Available exports:", Object.keys(AppKitModule));
            throw new Error("createAppKit not found in CDN module");
        }

        const projectId = '20f947d147b6150ebcb5510766f823dd';

        // Define Base network (custom definition since networks export may vary)
        const base = {
            id: 8453,
            name: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
                default: { http: ['https://mainnet.base.org'] }
            },
            blockExplorers: {
                default: { name: 'BaseScan', url: 'https://basescan.org' }
            }
        };

        // Try to get Base from networks export, fallback to custom
        let networkBase = base;
        if (networks) {
            // networks might export chain definitions
            if (networks.base) networkBase = networks.base;
        }

        const metadata = {
            name: 'Zico Rush',
            description: 'Diamond Rush GameFi – Play, Mine, Earn',
            url: window.location.origin,
            icons: ['https://avatars.githubusercontent.com/u/37784886']
        };

        // Create AppKit with available adapters
        const appKitConfig = {
            projectId,
            networks: [networkBase],
            metadata,
            features: {
                analytics: true
            }
        };

        // Check if WagmiAdapter is available (it's exported by appkit-cdn)
        const WagmiAdapter = AppKitModule.WagmiAdapter || AppKitModule.default?.WagmiAdapter;
        if (WagmiAdapter) {
            try {
                const wagmiAdapter = new WagmiAdapter({
                    projectId,
                    networks: [networkBase]
                });
                appKitConfig.adapters = [wagmiAdapter];
                console.log("[AppKit] Using WagmiAdapter");
            } catch (adapterErr) {
                console.warn("[AppKit] WagmiAdapter init failed, proceeding without adapter:", adapterErr.message);
            }
        }

        const modal = createAppKit(appKitConfig);

        window.appKitModal = modal;
        window.appKitReady = true;
        console.log("[AppKit] Successfully initialized!");

        // Subscribe to connection state changes
        if (modal.subscribeAccount) {
            modal.subscribeAccount(account => {
                console.log("[AppKit] Account changed:", JSON.stringify(account));
                // Only fire if we have an active address
                if (account.isConnected && account.address) {
                    if (window._onAppKitConnect) {
                        window._onAppKitConnect(account.address);
                        // We do NOT null it out here in case it fires multiple times before verify completes
                    }
                }
            });
        } else if (modal.subscribeState) {
            // Fallback for older interface
            modal.subscribeState(state => {
                console.log("[AppKit] State changed:", JSON.stringify(state));
                const isConn = modal.getIsConnectedState ? modal.getIsConnectedState() : (modal.getIsConnected ? modal.getIsConnected() : false);
                if (state.open === false && isConn) {
                    const addr = modal.getAddress ? modal.getAddress() : null;
                    if (addr && window._onAppKitConnect) {
                        window._onAppKitConnect(addr);
                    }
                }
            });
        }

    } catch (error) {
        console.error("[AppKit] Initialization failed:", error);
        window.appKitInitError = error.message;
        window.appKitReady = false;

        // Don't show intrusive error UI - the connectWallet function
        // will fallback to window.ethereum if AppKit is unavailable
        console.warn("[AppKit] Will rely on injected wallet (window.ethereum) as fallback");
    }
}

// Start initialization
initAppKit();
