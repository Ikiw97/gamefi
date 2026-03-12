const WC_PROJECT_ID = '8a32a4e9b7b9f56477eacbd173b98ea5'; // Fallback public Project ID
window.wcProvider = null;
window.appKitInitError = null;

async function initWC() {
    try {
        const UProvider = window.UniversalProvider.UniversalProvider || window.UniversalProvider;
        if (UProvider) {
            window.wcProvider = await UProvider.init({
                logger: 'info',
                relayUrl: 'wss://relay.walletconnect.com',
                projectId: WC_PROJECT_ID,
                metadata: {
                    name: "Zico Rush",
                    description: "Zico Rush GameFi",
                    url: window.location.origin,
                    icons: [window.location.origin + "/assets/icons/icon-192.png"]
                }
            });

            window.wcProvider.on("display_uri", (uri) => {
                console.log("WC URI ready:", uri);
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    // Deep link to MetaMask app
                    window.location.href = `metamask://wc?uri=${encodeURIComponent(uri)}`;
                } else {
                    console.warn("Please install MetaMask extension.");
                }
            });

            console.log("WalletConnect Provider initialized successfully.");
        } else {
            window.appKitInitError = "UniversalProvider not found.";
        }
    } catch (e) {
        console.error("WC Init error:", e);
        window.appKitInitError = e.message;
    }
}

window.addEventListener('load', initWC);
