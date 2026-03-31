// js/wallet.js – Multi-Wallet Connection via Reown AppKit
// =============================================

// Global Error Logger for debugging
window.addEventListener('error', function (e) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:10px;left:10%;width:80%;background:red;color:white;z-index:9999;padding:15px;font-family:monospace;word-break:break-all;border-radius:8px;border:2px solid white;';
    div.innerHTML = '<b>JS ERROR:</b> ' + e.message + '<br>File: ' + e.filename + '<br>Line: ' + e.lineno;
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

const savedWallet = localStorage.getItem('dr_wallet');
window.walletState = {
    connected: !!savedWallet,
    address: savedWallet || null,
    provider: null
};

// ── Step 1: Connect Wallet (Open AppKit Modal) ──
async function connectWallet() {
    logDebug("connectWallet() triggered (AppKit)");
    const btn = document.getElementById('btnConnectWallet');
    const alertEl = document.getElementById('alertWallet');

    if (!window.appKitModal) {
        logDebug("AppKit Modal not initialized!");
        alert("Wallet system starting... Please try again in a second.");
        return;
    }

    // Already connected
    if (window.appKitModal.getIsConnected()) {
        if (confirm("Disconnect wallet?")) {
            clearWalletData();
        }
        return;
    }

    try {
        logDebug("Opening AppKit Modal...");
        await window.appKitModal.open();

        // Wait for connection state change
        showLoading('AWAITING CONNECTION...');

        const checkConnection = setInterval(() => {
            if (window.appKitModal.getIsConnected()) {
                clearInterval(checkConnection);
                hideLoading();
                const address = window.appKitModal.getAddress();
                logDebug("Connected: " + address);

                // Update UI for signature step
                if (btn) {
                    const btnTextNode = document.getElementById('walletBtnText');
                    if (btnTextNode) btnTextNode.textContent = 'VERIFY WALLET';
                    btn.onclick = verifyWallet;
                }
                showAlert(alertEl, 'info', 'Step 1 Complete! Click VERIFY WALLET to sign.');
            }
        }, 1000);

        // Timeout after 60s
        setTimeout(() => {
            clearInterval(checkConnection);
            hideLoading();
        }, 60000);

    } catch (e) {
        logDebug("Connect Error: " + e.message);
        hideLoading();
    }
}

// ── Step 2: Verify Wallet (Signature via AppKit Provider) ──
async function verifyWallet() {
    logDebug("verifyWallet() triggered");
    const btn = document.getElementById('btnConnectWallet');
    const alertEl = document.getElementById('alertWallet');

    if (!window.appKitModal || !window.appKitModal.getIsConnected()) {
        logDebug("Wallet not connected");
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
        const address = window.appKitModal.getAddress();
        const provider = window.appKitModal.getWalletProvider();

        if (!provider) throw new Error("Wallet provider not found");

        logDebug("Preparing signature for: " + address);
        const message = `Zico Rush GameFi\nVerify: ${address}\nTime: ${Date.now()}`;
        const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        logDebug("Requesting signature...");
        const signature = await provider.request({
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
        }
    } finally {
        hideLoading();
    }
}

function handleWalletConnected(address, isDemo) {
    window.walletState.connected = true;
    window.walletState.address = address;

    localStorage.setItem('dr_wallet', address);
    localStorage.setItem('dr_demo', isDemo ? '1' : '0');

    const btn = document.getElementById('btnConnectWallet');
    const addressDisplay = document.getElementById('walletAddressDisplay');

    if (btn) {
        btn.classList.add('connected');
        const btnTextNode = document.getElementById('walletBtnText');
        if (btnTextNode) btnTextNode.textContent = isDemo ? '🔵 Demo Wallet' : '✅ Wallet Connected';
        btn.onclick = () => { if (confirm("Disconnect?")) clearWalletData(); };
    }

    if (addressDisplay) {
        addressDisplay.textContent = maskAddress(address);
        addressDisplay.style.display = 'block';
    }

    markStepDone(1);
    unlockCard('cardProfile');
    setStepActive(2);

    checkReturningPlayer(address);
    if (typeof updateNavWallet === 'function') updateNavWallet();
}

async function checkReturningPlayer(wallet) {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('wallet', wallet.toLowerCase())
            .single();

        if (error) throw error;
        if (data) {
            localStorage.setItem('dr_username', data.username);
            localStorage.setItem('dr_referralCode', data.referral_code || '');
            localStorage.setItem('dr_points', data.points || 0);
            const playerLevel = Math.max(
                data.level || 1,
                parseInt(localStorage.getItem('dr_currentLevel') || '1'),
                parseInt(localStorage.getItem('dr_maxLevel') || '1')
            );
            localStorage.setItem('dr_currentLevel', playerLevel);
            localStorage.setItem('dr_maxLevel', playerLevel);

            window.walletState.isReturning = true;

            const cardProfile = document.getElementById('cardProfile');
            const cardCaptcha = document.getElementById('cardCaptcha');
            if (cardProfile) cardProfile.style.display = 'none';
            if (cardCaptcha) cardCaptcha.style.display = 'none';

            markStepDone(2);
            markStepDone(3);

            if (data.referral_code) {
                const refCodeEl = document.getElementById('myReferralCode');
                const refSection = document.getElementById('myReferralSection');
                if (refCodeEl) refCodeEl.textContent = data.referral_code;
                if (refSection) refSection.style.display = 'block';
            }

            const btnStart = document.getElementById('btnStartGame');
            if (btnStart) {
                btnStart.textContent = '⚡ PLAY NOW';
                btnStart.disabled = false;
            }
            unlockCard('cardStart');
            setStepActive(4);

            showAlert(document.getElementById('alertStart'), 'success',
                `👋 Welcome back, ${data.username}! Level: ${playerLevel} | ${data.points} pts`);
        }
    } catch (e) { }
}

function maskAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function clearWalletData() {
    localStorage.removeItem('dr_wallet');
    localStorage.removeItem('dr_demo');
    localStorage.removeItem('dr_username');
    localStorage.removeItem('dr_referralCode');
    localStorage.removeItem('dr_points');

    if (window.appKitModal) {
        try { window.appKitModal.disconnect(); } catch(e) {}
    }

    // Force clear wagmi/appkit cache so it doesn't auto-reconnect
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('@w3m') || key.toLowerCase().startsWith('wagmi') || key.startsWith('@appkit')) {
            localStorage.removeItem(key);
        }
    });

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
