// mm-init.js - MetaMask SDK Initialization
window.mmsdk = null;
window.mmProvider = null;

function initMMSDK() {
    if (typeof window.MetaMaskSDK === 'undefined') {
        console.warn("MetaMask SDK not loaded.");
        return;
    }

    try {
        const MMSDK = new window.MetaMaskSDK.MetaMaskSDK({
            dappMetadata: {
                name: "Zico Rush",
                url: window.location.origin,
                icons: [window.location.origin + "/assets/icons/icon-192.png"]
            },
            logging: {
                developerMode: false,
            },
            storage: {
                enabled: true,
            }
        });

        window.mmsdk = MMSDK;

        // The provider from MetaMask SDK
        // Before connect is called, getting the provider readies the proxy but doesn't force a popup
        setTimeout(() => {
            window.mmProvider = MMSDK.getProvider();
            console.log("MetaMask SDK Provider initialized.");
        }, 500);

    } catch (e) {
        console.error("MetaMask SDK Init error:", e);
    }
}

window.addEventListener('load', initMMSDK);
