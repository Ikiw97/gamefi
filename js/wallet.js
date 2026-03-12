// =============================================
// wallet.js – MetaMask Wallet Connection
// =============================================

// Global Error Logger for debugging
window.addEventListener('error', function (e) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:10px;left:10%;width:80%;background:red;color:white;z-index:9999;padding:15px;font-family:monospace;word-break:break-all;border-radius:8px;border:2px solid white;';
    div.innerHTML = '<b>JS ERROR:</b> ' + e.message + '<br>File: ' + e.filename + '<br>Line: ' + e.lineno;
    document.body.appendChild(div);
});

window.addEventListener('unhandledrejection', function (e) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:90px;left:10%;width:80%;background:#8B0000;color:white;z-index:9999;padding:15px;font-family:monospace;word-break:break-all;border-radius:8px;border:2px solid white;';

    let msg = 'Unknown Promise Error';
    if (e.reason) {
        msg = e.reason.message || JSON.stringify(e.reason);
    }
    div.innerHTML = '<b>ASYNC ERROR:</b> ' + msg;
    document.body.appendChild(div);
});

// window.APP_API_URL is no longer needed since we use Supabase directly

window.walletState = {
    connected: false,
    address: null,
    provider: null
};

// ── Chain Management ──
async function ensureBaseChain(providerDetails) {
    const BASE_CHAIN_ID = '0x2105'; // 8453
    try {
        const currentChainId = await providerDetails.request({ method: 'eth_chainId' });
        if (currentChainId !== BASE_CHAIN_ID) {
            console.log("Switching to Base chain...");
            try {
                await providerDetails.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await providerDetails.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: BASE_CHAIN_ID,
                            chainName: 'Base',
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org']
                        }],
                    });
                } else {
                    throw switchError;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return true;
    } catch (err) {
        console.error("Chain management error:", err);
        return false;
    }
}


async function connectWallet() {
    const btn = document.getElementById('btnConnectWallet');
    const alertEl = document.getElementById('alertWallet');
    const addressDisplay = document.getElementById('walletAddressDisplay');

    // Already connected
    if (window.walletState && window.walletState.connected) {
        if (confirm("Are you sure you want to disconnect your wallet?")) {
            clearWalletData();
        }
        return;
    }

    showLoading('CONNECTING WALLET...');
    if (btn) btn.disabled = true;

    try {
        let providerDetails = null;

        // 1. Injected Provider
        if (typeof window.ethereum !== 'undefined') {
            providerDetails = window.ethereum;
        }
        // 2. Fallback to MetaMask SDK (Mobile Chrome/Safari)
        else if (window.mmsdk) {
            console.log('Using MetaMask SDK for fallback');
            await window.mmsdk.connect();
            providerDetails = window.mmProvider;
        }

        if (providerDetails) {
            try {
                // Request accounts
                let accounts;
                if (providerDetails === window.ethereum) {
                    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                } else {
                    accounts = await providerDetails.request({ method: 'eth_requestAccounts' });
                }

                if (!accounts || accounts.length === 0) throw new Error('No accounts found');

                const address = accounts[0];
                console.log('Got address:', address);

                // Enforce Base Chain (AFTER connection)
                const chainOk = await ensureBaseChain(providerDetails);
                if (!chainOk) throw new Error("Please switch to Base Chain to continue.");

                // Sign a message to verify ownership
                const message = `Zico Rush GameFi\nConnect wallet: ${address}\nTimestamp: ${Date.now()}`;

                try {
                    let signature;
                    if (providerDetails === window.ethereum) {
                        signature = await window.ethereum.request({
                            method: 'personal_sign',
                            params: [message, address]
                        });
                    } else {
                        signature = await providerDetails.request({
                            method: 'personal_sign',
                            params: [message, address]
                        });
                    }
                    console.log('Wallet signed successfully:', signature);
                } catch (signErr) {
                    console.warn('Sign message rejected or failed:', signErr);
                    throw new Error('Signature request was rejected. Connection canceled.');
                }

                // Success!
                handleWalletConnected(address, false);
                showAlert(alertEl, 'success', '✅ Wallet connected successfully!');
                return;
            } catch (err) {
                console.error('Provider connection error:', err);
                const msg = err.message || 'Failed to connect wallet';
                showAlert(alertEl, 'error', `❌ ${msg}`);
                if (btn) btn.disabled = false;
                return;
            }
        }

        // 3. Demo Mode Fallback
        console.warn('No wallet detected - using demo mode');
        const mockAddress = '0x' + Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16)).join('');
        handleWalletConnected(mockAddress, true);
        showAlert(alertEl, 'info', '⚠️ No wallet detected. Running in DEMO mode.');

    } catch (err) {
        console.error('Wallet connect error:', err);
        showAlert(alertEl, 'error', '❌ ' + (err.message || 'Connection failed'));
        if (btn) btn.disabled = false;
    } finally {
        hideLoading();
    }
}

function handleWalletConnected(address, isDemo) {
    window.walletState.connected = true;
    window.walletState.address = address;

    // Save to localStorage
    localStorage.setItem('dr_wallet', address);
    localStorage.setItem('dr_demo', isDemo ? '1' : '0');

    // Update UI
    const btn = document.getElementById('btnConnectWallet');
    const addressDisplay = document.getElementById('walletAddressDisplay');

    btn.classList.add('connected');
    document.getElementById('walletBtnText').textContent = isDemo ? '🔵 Demo Wallet' : '✅ Wallet Connected';
    addressDisplay.textContent = maskAddress(address);
    addressDisplay.style.display = 'block';

    // Mark step 1 done, unlock step 2
    markStepDone(1);
    unlockCard('cardProfile');
    setStepActive(2);

    // Prefill if returning player
    checkReturningPlayer(address);

    // Update navbar wallet badge
    if (typeof updateNavWallet === 'function') updateNavWallet();
}

async function checkReturningPlayer(wallet) {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('wallet', wallet.toLowerCase())
            .single();

        if (error) throw error; // will jump to catch block if new player

        if (data) {
            // Save to localStorage
            localStorage.setItem('dr_username', data.username);
            localStorage.setItem('dr_referralCode', data.referral_code || '');
            localStorage.setItem('dr_points', data.points || 0);
            if (data.level) {
                localStorage.setItem('dr_currentLevel', data.level);
            }

            // Flag as returning player
            window.walletState.isReturning = true;

            // Hide step 2 and 3 cards to simplify UI for returning players
            document.getElementById('cardProfile').style.display = 'none';
            document.getElementById('cardCaptcha').style.display = 'none';

            // Mark steps 2 and 3 as done
            markStepDone(2);
            markStepDone(3);

            // Show referral code if exists
            if (data.referralCode) {
                document.getElementById('myReferralCode').textContent = data.referralCode;
                document.getElementById('myReferralSection').style.display = 'block';
            }

            // Unlock Start Game card directly
            const btnStart = document.getElementById('btnStartGame');
            btnStart.textContent = '⚡ PLAY NOW';
            btnStart.disabled = false;
            unlockCard('cardStart');
            setStepActive(4);

            // Show welcome message in the Start card
            showAlert(document.getElementById('alertStart'), 'success',
                `👋 Welcome back, ${data.username}! Level: ${data.level || 1} | ${data.points} pts`);
        }
    } catch (e) {
        // New player, no problem
    }
}

function maskAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Listen for account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            // User disconnected the wallet
            clearWalletData();
        } else {
            // Switch account
            handleWalletConnected(accounts[0], false);
        }
    });

    window.ethereum.on('disconnect', () => {
        clearWalletData();
    });
}

// ── Logout / Clear Data ──
function clearWalletData() {
    localStorage.removeItem('dr_wallet');
    localStorage.removeItem('dr_demo');
    localStorage.removeItem('dr_username');
    localStorage.removeItem('dr_referralCode');
    localStorage.removeItem('dr_points');

    if (window.mmsdk) {
        window.mmsdk.disconnect();
    }

    window.walletState.connected = false;
    window.walletState.address = null;

    location.reload();
}

// ── Utility helpers ──
function showLoading(text = 'LOADING...') {
    const el = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    if (el) el.style.display = 'flex';
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'none';
}

function showAlert(el, type, msg) {
    if (!el) return;
    el.className = `alert ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    // Auto-hide success alerts
    if (type === 'success') {
        setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
}

function markStepDone(n) {
    const dot = document.getElementById(`s${n}`);
    const line = document.getElementById(`l${n}`);
    if (dot) { dot.classList.remove('active'); dot.classList.add('done'); dot.querySelector('.step-dot').textContent = '✓'; }
    if (line) line.classList.add('done');
}

function setStepActive(n) {
    const el = document.getElementById(`s${n}`);
    if (el) el.classList.add('active');
}

function unlockCard(cardId) {
    const el = document.getElementById(cardId);
    if (el) {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transition = 'opacity 0.4s ease';
    }
}

function copyReferral() {
    const code = document.getElementById('myReferralCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.btn-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
}
