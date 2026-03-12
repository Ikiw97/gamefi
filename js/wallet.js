// wallet.js – MetaMask Wallet Connection
// =============================================

window.addEventListener('load', () => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn("MetaMask Mobile requires HTTPS for many features.");
        // alert("Warning: MetaMask Mobile features may not work reliably on HTTP. Please use HTTPS.");
    }
});

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

// ── Mobile Debug Console ──
function logDebug(msg) {
    console.log("[DEBUG]", msg);
    let consoleEl = document.getElementById('debug-console');
    if (!consoleEl) {
        consoleEl = document.createElement('div');
        consoleEl.id = 'debug-console';
        consoleEl.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; height:120px; background:rgba(0,0,0,0.85); color:#0f0; font-family:monospace; font-size:10px; overflow-y:auto; z-index:10000; padding:10px; border-top:1px solid #0f0; display:block; pointer-events:none;';
        consoleEl.innerHTML = '<div style="font-weight:bold; border-bottom:1px solid #0f0; margin-bottom:5px;">DEBUG CONSOLE (GLOBAL)</div>';
        document.body.appendChild(consoleEl);
    }
    const entry = document.createElement('div');
    entry.style.borderBottom = '1px solid #333';
    entry.style.padding = '4px 0';
    entry.style.fontSize = '10px';
    entry.textContent = `> ${new Date().toLocaleTimeString()}: ${msg}`;
    consoleEl.prepend(entry);
    while (consoleEl.children.length > 20) {
        consoleEl.removeChild(consoleEl.lastChild);
    }
}

// Global state for 2-step verification
let tempProviderDetails = null;
let tempAddress = null;

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
            logDebug("Switching to Base chain...");
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
        logDebug("Chain mgmt error: " + err.message);
        return false;
    }
}

// ── Step 1: Connect Wallet ──
async function connectWallet() {
    logDebug("connectWallet() triggered");
    const btn = document.getElementById('btnConnectWallet');
    const alertEl = document.getElementById('alertWallet');

    // Already connected
    if (window.walletState && window.walletState.connected) {
        if (confirm("Are you sure you want to disconnect?")) {
            clearWalletData();
        }
        return;
    }

    showLoading('CONNECTING...');
    if (btn) btn.disabled = true;

    try {
        let providerDetails = null;
        logDebug("Detecting provider...");
        if (typeof window.ethereum !== 'undefined') {
            logDebug("Injected provider found");
            providerDetails = window.ethereum;
        } else if (window.mmsdk) {
            logDebug("MetaMask SDK found, connecting...");
            await window.mmsdk.connect();
            providerDetails = window.mmProvider;
            logDebug("SDK Provider ready");
        }

        if (providerDetails) {
            try {
                logDebug("Requesting accounts...");
                const accounts = await providerDetails.request({ method: 'eth_requestAccounts' });
                if (!accounts || accounts.length === 0) throw new Error('No accounts found');

                const address = accounts[0];
                logDebug("Account: " + address);

                const chainOk = await ensureBaseChain(providerDetails);
                if (!chainOk) throw new Error("Please switch to Base Chain to continue.");
                logDebug("Chain Check Passed");

                // Store for Step 2
                tempProviderDetails = providerDetails;
                tempAddress = address;

                // Update UI
                hideLoading();
                if (btn) {
                    btn.disabled = false;
                    logDebug("Updating button to VERIFY");
                    const btnTextNode = document.getElementById('walletBtnText');
                    if (btnTextNode) btnTextNode.textContent = 'VERIFY WALLET';
                    btn.onclick = verifyWallet;
                }
                showAlert(alertEl, 'info', 'Step 1 Complete! Click VERIFY WALLET to sign.');
                return;
            } catch (err) {
                logDebug("Connection Error: " + err.message);
                showAlert(alertEl, 'error', `❌ ${err.message}`);
                if (btn) btn.disabled = false;
                hideLoading();
                return;
            }
        }

        logDebug("No wallet provider, falling back to demo");
        const mockAddress = '0x' + Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16)).join('');
        handleWalletConnected(mockAddress, true);
        hideLoading();
    } catch (e) {
        logDebug("Fatal Connect Error: " + e.message);
        hideLoading();
        if (btn) btn.disabled = false;
    }
}

// ── Step 2: Verify Wallet (Signature) ──
async function verifyWallet() {
    logDebug("verifyWallet() triggered");
    const btn = document.getElementById('btnConnectWallet');
    const alertEl = document.getElementById('alertWallet');

    if (!tempProviderDetails || !tempAddress) {
        logDebug("Missing session data for verification");
        if (btn) {
            const btnTextNode = document.getElementById('walletBtnText');
            if (btnTextNode) btnTextNode.textContent = 'CONNECT WALLET';
            btn.onclick = connectWallet;
        }
        return;
    }

    showLoading('VERIFYING...');
    if (btn) btn.disabled = true;

    try {
        const address = tempAddress;
        logDebug("Preparing signature for: " + address);
        const message = `Zico Rush GameFi\nVerify: ${address}\nTime: ${Date.now()}`;
        const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        logDebug("Requesting personal_sign...");
        const signature = await tempProviderDetails.request({
            method: 'personal_sign',
            params: [hexMsg, address]
        });

        logDebug("Signature successful!");
        handleWalletConnected(address, false);
        showAlert(alertEl, 'success', '✅ Verified!');
    } catch (err) {
        logDebug("Signature Error: " + err.message);
        showAlert(alertEl, 'error', `❌ ${err.message}`);
        if (btn) {
            btn.disabled = false;
            const btnTextNode = document.getElementById('walletBtnText');
            if (btnTextNode) btnTextNode.textContent = 'VERIFY WALLET';
        }
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

    if (btn) {
        btn.classList.add('connected');
        const btnTextNode = document.getElementById('walletBtnText');
        if (btnTextNode) btnTextNode.textContent = isDemo ? '🔵 Demo Wallet' : '✅ Wallet Connected';
    }

    if (addressDisplay) {
        addressDisplay.textContent = maskAddress(address);
        addressDisplay.style.display = 'block';
    }

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
            const cardProfile = document.getElementById('cardProfile');
            const cardCaptcha = document.getElementById('cardCaptcha');
            if (cardProfile) cardProfile.style.display = 'none';
            if (cardCaptcha) cardCaptcha.style.display = 'none';

            // Mark steps 2 and 3 as done
            markStepDone(2);
            markStepDone(3);

            // Show referral code if exists
            if (data.referral_code) {
                const refCodeEl = document.getElementById('myReferralCode');
                const refSection = document.getElementById('myReferralSection');
                if (refCodeEl) refCodeEl.textContent = data.referral_code;
                if (refSection) refSection.style.display = 'block';
            }

            // Unlock Start Game card directly
            const btnStart = document.getElementById('btnStartGame');
            if (btnStart) {
                btnStart.textContent = '⚡ PLAY NOW';
                btnStart.disabled = false;
            }
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
    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.textContent = text;
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
    const codeEl = document.getElementById('myReferralCode');
    if (!codeEl) return;
    const code = codeEl.textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.btn-copy');
        if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        }
    });
}
