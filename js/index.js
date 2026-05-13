// ── FLOATING GEMS ──
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 0; i < 15; i++) {
        const g = document.createElement('div');
        g.className = 'floating-gem';
        g.style.left = Math.random() * 100 + 'vw';
        g.style.top = Math.random() * 100 + 'vh';
        g.style.animationDelay = (Math.random() * 5) + 's';
        g.style.animationDuration = (4 + Math.random() * 4) + 's';
        const colors = ['#4fc3f7', '#a855f7', '#f59e0b', '#22c55e'];
        g.style.background = `radial-gradient(circle at 30% 30%, #fff, ${colors[Math.floor(Math.random() * colors.length)]})`;
        document.body.appendChild(g);
    }
});

// ── LOGIC ──

// Supabase client is available as window.supabaseClient

// ── State ──
window.walletState = {
    connected: false,
    wallet: null,
    username: localStorage.getItem('dr_username') || null
};
const playerState = window.walletState; // For backward compatibility in this file

// ── Captcha state ──
let _isCaptchaValid = false;
let _turnstileToken = "";

window.onTurnstileSuccess = function(token) {
    _isCaptchaValid = true;
    _turnstileToken = token;
    document.getElementById('turnstileStatus').textContent = '(Verified)';
    document.getElementById('turnstileStatus').style.color = '#22c55e';
    validateRegForm();
}

window.onTurnstileError = function() {
    _isCaptchaValid = false;
    document.getElementById('turnstileStatus').textContent = '(Error)';
    document.getElementById('turnstileStatus').style.color = '#ef4444';
    validateRegForm();
}

window.onTurnstileExpired = function() {
    _isCaptchaValid = false;
    document.getElementById('turnstileStatus').textContent = '(Expired)';
    document.getElementById('turnstileStatus').style.color = '#f59e0b';
    validateRegForm();
}

// ── Update nav wallet badge ──
window.updateNavBadge = function(wallet) {
    const navBtn = document.getElementById('navWalletBtn');
    const navText = document.getElementById('navWalletText');
    if (!navBtn) return;
    if (wallet) {
        navBtn.style.background = 'rgba(34,197,94,0.1)';
        navBtn.style.borderColor = 'rgba(34,197,94,0.4)';
        navBtn.style.color = '#22c55e';
        const dot = navBtn.querySelector('.dot');
        if (dot) { dot.style.background = '#22c55e'; dot.style.boxShadow = '0 0 8px #22c55e'; }
        if (navText) navText.textContent = wallet.slice(0, 6) + '...' + wallet.slice(-4);
        const disconnectIcon = document.getElementById('navDisconnectIcon');
        if (disconnectIcon) disconnectIcon.style.display = 'inline-block';
    } else {
        navBtn.style.background = 'rgba(239,68,68,0.1)';
        navBtn.style.borderColor = 'rgba(239,68,68,0.4)';
        navBtn.style.color = '#ef4444';
        const dot = navBtn.querySelector('.dot');
        if (dot) { dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 8px #ef4444'; }
        if (navText) navText.textContent = 'Connect';
        const disconnectIcon = document.getElementById('navDisconnectIcon');
        if (disconnectIcon) disconnectIcon.style.display = 'none';
    }
}

// ── Load Global Stats ──
window.loadGlobalStats = async function() {
    try {
        // Fetch stats from Supabase directly
        const { data, error, count } = await supabaseClient
            .from('profiles')
            .select('points, diamonds_collected', { count: 'exact' });

        if (error) throw error;

        let totalPoints = 0;
        let totalDiamonds = 0;

        data.forEach(p => {
            totalPoints += (p.points || 0);
            totalDiamonds += (p.diamonds_collected || 0);
        });

        // Format numbers helper (1234 -> 1.2K)
        const fmt = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        };

        document.getElementById('stat-players').textContent = (count || 0).toLocaleString();
        document.getElementById('stat-coins').textContent = fmt(totalDiamonds); // Diamonds are mined
        document.getElementById('stat-points').textContent = fmt(totalPoints);
        document.getElementById('stat-season').textContent = 'S1';

    } catch (err) {
        console.warn('Failed to load global stats:', err);
    }
}

// ── Update progress steps UI ──
window.updateProgressSteps = function() {
    const hasWallet = !!playerState.wallet;
    const hasUser = !!localStorage.getItem('dr_username');

    // 1. Wallet
    const s1 = document.getElementById('step-wallet');
    if (s1) {
        if (hasWallet) {
            s1.classList.add('done');
            s1.querySelector('.step-box').textContent = '✓';
        } else {
            s1.classList.remove('done');
            s1.querySelector('.step-box').textContent = '1';
        }
    }

    // 2. Profile
    const s2 = document.getElementById('step-profile');
    if (s2) {
        if (hasUser) {
            s2.classList.add('done');
            s2.querySelector('.step-box').textContent = '✓';
        } else {
            s2.classList.remove('done');
            s2.querySelector('.step-box').textContent = '2';
        }
    }

    // 3. Verify (Auto-done if profile exists for now)
    const s3 = document.getElementById('step-verify');
    if (s3) {
        if (hasUser) {
            s3.classList.add('done');
            s3.querySelector('.step-box').textContent = '✓';
        } else {
            s3.classList.remove('done');
            s3.querySelector('.step-box').textContent = '3';
        }
    }

    // 4. Play (Shows check if ready)
    const s4 = document.getElementById('step-play');
    if (s4) {
        if (hasUser) {
            s4.classList.add('done');
            s4.querySelector('.step-box').textContent = '✓';
            s4.querySelector('.step-box').style.color = '';
        } else {
            s4.classList.remove('done');
            s4.querySelector('.step-box').textContent = '4';
        }
    }
}

// ── Update connect button UI ──
window.setConnectBtnConnected = function(wallet) {
    const shortW = wallet.slice(0, 6) + '...' + wallet.slice(-4);
    const btn = document.getElementById('mainConnectBtn');
    const btnText = document.getElementById('connectBtnText');
    const disp = document.getElementById('mainWalletDisplay');

    if (btn) btn.style.display = 'flex';
    if (btnText) btnText.textContent = shortW || 'Wallet Connected';

    // Use connect.png image instead of green background
    if (btn) {
        btn.style.background = "url('assets/sprites/connect.png') no-repeat center center";
        btn.style.backgroundSize = "100% 100%";
    }

    // Hide the separate display element to avoid redundancy
    if (disp) disp.style.display = 'none';

    // Show referral code
    const refCode = localStorage.getItem('dr_referralCode');
    const refEl = document.getElementById('displayReferral');
    if (refEl) {
        refEl.value = refCode ? refCode : 'NO CODE';
    }
}

window.openRegModal = function(wallet) {
    document.getElementById('regWalletSub').textContent =
        wallet.slice(0, 6) + '...' + wallet.slice(-4) + ' – Fill in details to create your account.';
    
    if (window.turnstile) {
        turnstile.reset();
    }
    _isCaptchaValid = false;
    _turnstileToken = "";
    if (document.getElementById('turnstileStatus')) {
        document.getElementById('turnstileStatus').textContent = '(Pending)';
        document.getElementById('turnstileStatus').style.color = '#334155';
    }

    // Reset form
    document.getElementById('regUsername').value = '';
    document.getElementById('regUsername').className = 'reg-input';

    // Auto-populate referral code if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    const refInput = document.getElementById('regReferral');
    if (refCode) {
        refInput.value = refCode.toUpperCase();
    } else {
        refInput.value = '';
    }

    document.getElementById('regSubmitBtn').disabled = true;
    document.getElementById('regMsg').className = 'reg-msg';
    document.getElementById('regMsg').textContent = '';
    document.getElementById('regModal').classList.add('open');
    _isUnameTaken = false;
    if (_unameCheckTimeout) clearTimeout(_unameCheckTimeout);

    // Wire live validation
    document.getElementById('regUsername').oninput = validateRegForm;
    document.getElementById('regReferral').oninput = function () {
        this.value = this.value.toUpperCase();
    };
}

let _unameCheckTimeout = null;
let _isUnameTaken = false;

window.validateRegForm = function() {
    const uname = document.getElementById('regUsername').value.trim();
    const unameOk = /^[a-zA-Z0-9_]{3,20}$/.test(uname);
    const capOk = _isCaptchaValid;

    const unameEl = document.getElementById('regUsername');
    const msgEl = document.getElementById('regMsg');

    unameEl.className = 'reg-input' + (uname.length > 0 ? (unameOk ? ' ok' : ' err') : '');

    document.getElementById('regSubmitBtn').disabled = !(unameOk && capOk && !_isUnameTaken);

    // Hide the error message if the username is cleared or doesn't meet the format
    if (!unameOk) {
        _isUnameTaken = false;
        if (msgEl.textContent.includes('terpakai')) {
            msgEl.textContent = '';
            msgEl.className = 'reg-msg';
        }
        return;
    }

    // Debounced DB check
    if (_unameCheckTimeout) clearTimeout(_unameCheckTimeout);

    _unameCheckTimeout = setTimeout(async () => {
        try {
            // Check if another user has this name
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('username')
                .ilike('username', uname)
                .limit(1);

            if (data && data.length > 0) {
                _isUnameTaken = true;
                unameEl.className = 'reg-input err';
                msgEl.textContent = '❌ Username sudah terpakai!';
                msgEl.className = 'reg-msg err';
                document.getElementById('regSubmitBtn').disabled = true;
            } else {
                _isUnameTaken = false;
                if (msgEl.textContent.includes('terpakai')) {
                    msgEl.textContent = '';
                    msgEl.className = 'reg-msg';
                }
                // Re-evaluate button state
                document.getElementById('regSubmitBtn').disabled = !capOk;
            }
        } catch (e) {
            console.error('Username check error:', e);
        }
    }, 600); // 600ms delay after typing
}

// ── Submit registration ──
window.submitRegistration = async function() {
    const wallet = playerState.wallet;
    const username = document.getElementById('regUsername').value.trim();
    const referral = document.getElementById('regReferral').value.trim();
    const msgEl = document.getElementById('regMsg');
    const btn = document.getElementById('regSubmitBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Preparing...';
    msgEl.className = 'reg-msg';

    try {
        // ── Get Anti-Bot Signature ──
        const timestamp = Date.now().toString();
        const messageToSign = `Register Zico Rush\nWallet: ${wallet.toLowerCase()}\nUsername: ${username}\nTimestamp: ${timestamp}`;
        let signature;

        try {
            btn.textContent = '✍️ Please Sign in Wallet...';

            let eip1193Provider = null;
            if (_activeProvider === 'injected' && window.ethereum) {
                eip1193Provider = window.ethereum;
            } else if (_activeProvider === 'appkit' && window.appKitModal) {
                if (typeof window.appKitModal.getWalletProvider === 'function') {
                    eip1193Provider = window.appKitModal.getWalletProvider();
                } else if (window.ethereum) {
                    eip1193Provider = window.ethereum;
                }
            } else if (window.ethereum) {
                eip1193Provider = window.ethereum;
            }

            if (!eip1193Provider) {
                throw new Error("Could not find wallet provider for signing.");
            }

            const provider = new ethers.BrowserProvider(eip1193Provider);
            const signer = await provider.getSigner();
            signature = await signer.signMessage(messageToSign);

        } catch (signErr) {
            console.error("Signature error:", signErr);
            throw new Error("Registration cancelled: User denied signature or provider error.");
        }

        btn.textContent = '⏳ Creating Account...';

        // Use server-side Edge Function for registration
        const { data, error } = await window.supabaseClient.functions.invoke('register-player', {
            body: {
                wallet: wallet.toLowerCase(),
                username: username,
                referral_code_input: referral || null,
                signature: signature,
                timestamp: timestamp,
                cf_turnstile_response: _turnstileToken
            }
        });

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(data?.error || 'Registration failed');
        }

        const profile = data.profile;

        // Save player data locally
        localStorage.setItem('dr_wallet', profile.wallet);
        localStorage.setItem('dr_username', profile.username);
        localStorage.setItem('dr_referralCode', profile.referral_code || '');
        localStorage.setItem('dr_points', profile.points || 0);
        const bestLevel = Math.max(profile.level || 1, 1);
        localStorage.setItem('dr_currentLevel', bestLevel);
        localStorage.setItem('dr_maxLevel', bestLevel);

        msgEl.textContent = '✅ Account created! Redirecting to game...';
        msgEl.className = 'reg-msg ok';

        setTimeout(() => {
            window.location.href = 'game.html?v=' + Date.now();
        }, 1200);

    } catch (err) {
        msgEl.textContent = '❌ ' + (err.message || 'Registration failed. Try again.');
        msgEl.className = 'reg-msg err';
        btn.disabled = false;
        btn.textContent = '🎮 START PLAYING';
    }
}

// ── Custom Alert Logic ──
window.showCustomAlert = function(msg) {
    const modal = document.getElementById('customAlert');
    const msgEl = document.getElementById('alertMessage');
    if (modal && msgEl) {
        msgEl.textContent = msg;
        modal.classList.add('open');
    } else {
        alert(msg);
    }
}

window.closeCustomAlert = function() {
    const modal = document.getElementById('customAlert');
    if (modal) modal.classList.remove('open');
}

// ── Play Validation ──
window.checkWalletAndPlay = function(e) {
    if (e) {
        // Only prevent default if it's a link click
        if (e.target && e.target.tagName === 'A' || e.currentTarget && e.currentTarget.tagName === 'A') {
            e.preventDefault();
        }
    }
    
    const wallet = localStorage.getItem('dr_wallet');
    const username = localStorage.getItem('dr_username');

    if (!wallet) {
        showCustomAlert('Please connect your wallet first to play!');
        const connectBtn = document.getElementById('mainConnectBtn');
        if (connectBtn) connectBtn.scrollIntoView({ behavior: 'smooth' });
        return false;
    }

    if (!username) {
        showCustomAlert('Please complete your profile registration first!');
        if (window.openRegModal) window.openRegModal(wallet);
        return false;
    }

    window.location.href = 'game.html';
    return true;
}

// ── Mobile Debug Console ──
window.logDebug = function(msg) {
    console.log("[DEBUG]", msg);
}

// Track which provider was used for connection
let _activeProvider = null; // 'injected' or 'appkit'

// ── Connect Wallet (Dual Strategy) ──
// Strategy 1: Try window.ethereum (MetaMask, OKX, Bitget injected)
// Strategy 2: Fallback to AppKit modal (WalletConnect)
window.connectWallet = async function() {
    logDebug("connectWallet() triggered");
    const btnText = document.getElementById('connectBtnText');
    const btn = document.getElementById('mainConnectBtn');

    // If already connected, offer disconnect
    if (playerState.connected && playerState.wallet) {
        if (confirm("Disconnect wallet?")) {
            onWalletDisconnectUI();
        }
        return;
    }

    // ── Strategy 1: Injected Provider (window.ethereum) ──
    if (window.ethereum) {
        logDebug("Found window.ethereum – using injected wallet");
        if (btnText) btnText.textContent = 'Connecting...';
        if (btn) btn.disabled = true;

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                const address = accounts[0];
                logDebug("Injected wallet connected: " + address);
                _activeProvider = 'injected';

                // Skip signature, trust the injected provider
                onWalletConnectUI(address);
                return;
            } else {
                throw new Error("No accounts returned");
            }
        } catch (injectedErr) {
            logDebug("Injected wallet error: " + injectedErr.message);
            // User rejected or error – don't fallback, show error
            if (injectedErr.code === 4001) {
                // User rejected the request
                if (btnText) btnText.textContent = 'Connect Wallet';
                if (btn) btn.disabled = false;
                return;
            }
            // Other error – try AppKit fallback
            logDebug("Falling back to AppKit...");
        }
    }

    // ── Strategy 2: AppKit Modal (WalletConnect) ──
    if (btnText) btnText.textContent = 'Preparing...';
    if (btn) btn.disabled = true;

    // Wait for AppKit to initialize (max 5 seconds)
    if (!window.appKitModal) {
        logDebug("Waiting for AppKit to initialize...");
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (window.appKitModal) break;
        }
    }

    if (!window.appKitModal) {
        logDebug("AppKit not available");
        const errorMsg = window.appKitInitError || "Could not start wallet system.";
        showCustomAlert("❌ Wallet connection failed.\n\n" + errorMsg + "\n\nPlease install MetaMask or try refreshing the page.");
        if (btnText) btnText.textContent = 'Connect Wallet';
        if (btn) btn.disabled = false;
        return;
    }

    // Already connected via AppKit?
    let isAppKitConnected = false;
    let appKitAddress = null;

    if (window.appKitModal.getAccount) {
        const acc = window.appKitModal.getAccount();
        if (acc && acc.isConnected) {
            isAppKitConnected = true;
            appKitAddress = acc.address;
        }
    } else if (window.appKitModal.getIsConnectedState) {
        isAppKitConnected = window.appKitModal.getIsConnectedState();
        appKitAddress = window.appKitModal.getAddress();
    } else if (window.appKitModal.getIsConnected) {
        isAppKitConnected = window.appKitModal.getIsConnected();
        appKitAddress = window.appKitModal.getAddress();
    }

    if (isAppKitConnected && appKitAddress) {
        logDebug("AppKit already connected!");
        _activeProvider = 'appkit';
        onWalletConnectUI(appKitAddress);
        return;
    }

    try {
        logDebug("Opening AppKit modal...");

        // Set up callback for when AppKit connects
        window._onAppKitConnect = async function (address) {
            logDebug("AppKit connected: " + address);
            _activeProvider = 'appkit';
            onWalletConnectUI(address);
        };

        await window.appKitModal.open();
        if (btnText) btnText.textContent = 'Awaiting...';

        // Also poll as backup (some AppKit versions don't fire state events reliably after OS suspend)
        let pollCount = 0;
        const pollCheck = setInterval(() => {
            pollCount++;
            const isConn = window.appKitModal.getIsConnectedState ? window.appKitModal.getIsConnectedState() :
                (window.appKitModal.getIsConnected ? window.appKitModal.getIsConnected() : false);

            if (isConn) {
                clearInterval(pollCheck);
                const addr = window.appKitModal.getAddress ? window.appKitModal.getAddress() : null;
                if (addr && window._onAppKitConnect) {
                    window._onAppKitConnect(addr);
                    window._onAppKitConnect = null;
                }
            }
            if (pollCount > 120) { // 2 minutes max
                clearInterval(pollCheck);
                if (btnText && btnText.textContent === 'Awaiting...') {
                    btnText.textContent = 'Connect Wallet';
                    if (btn) btn.disabled = false;
                }
            }
        }, 1000);

    } catch (e) {
        logDebug("AppKit error: " + e.message);
        showCustomAlert("❌ Connection failed: " + e.message);
        if (btnText) btnText.textContent = 'Connect Wallet';
        if (btn) btn.disabled = false;
    }
}

// onWalletDisconnectUI helper
window.onWalletDisconnectUI = function () {
    localStorage.removeItem('dr_wallet');
    localStorage.removeItem('dr_demo');
    localStorage.removeItem('dr_username');
    localStorage.removeItem('dr_referralCode');
    localStorage.removeItem('dr_points');
    localStorage.removeItem('dr_currentLevel');
    _activeProvider = null;
    try { if (window.appKitModal && window.appKitModal.disconnect) window.appKitModal.disconnect(); } catch (e) { }

    // Force clear wagmi/appkit cache so it doesn't auto-reconnect
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('@w3m') || key.toLowerCase().startsWith('wagmi') || key.startsWith('@appkit')) {
            localStorage.removeItem(key);
        }
    });

    location.reload();
}

// Shared callback after wallet is connected (Either via AppKit or Injected)
window.onWalletConnectUI = async function (address) {
    try {
        playerState.wallet = address;
        playerState.connected = true;

        setConnectBtnConnected(address);
        updateNavBadge(address);

        // Check if returning player via Supabase
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('wallet', address.toLowerCase())
            .single();

        let isReturning = false;
        if (!error && data) {
            localStorage.setItem('dr_wallet', data.wallet);
            localStorage.setItem('dr_username', data.username);
            localStorage.setItem('dr_referralCode', data.referral_code || '');
            localStorage.setItem('dr_points', data.points || 0);
            const dbLevel2 = data.level || 1;
            const localLevel2 = parseInt(localStorage.getItem('dr_currentLevel') || '1');
            const localMaxLevel2 = parseInt(localStorage.getItem('dr_maxLevel') || '1');
            const bestLevel2 = Math.max(dbLevel2, localLevel2, localMaxLevel2);
            localStorage.setItem('dr_currentLevel', bestLevel2);
            localStorage.setItem('dr_maxLevel', bestLevel2);
            isReturning = true;
        }

        if (isReturning) {
            // Returning player → replace "Connect" button with success UI, but stay on index.html
            setConnectBtnConnected(address);
            updateProgressSteps();
        } else {
            // New player → show registration form
            openRegModal(address);
        }

    } catch (err) {
        showCustomAlert('Wallet connection failed: ' + err.message);
    }
}

// ── DOM Initialization ──
document.addEventListener('DOMContentLoaded', () => {
    // Restore session from localStorage safely
    const savedWallet = localStorage.getItem('dr_wallet');
    if (savedWallet) {
        playerState.wallet = savedWallet;
        playerState.connected = true; // Mark as connected for UI
        setConnectBtnConnected(savedWallet);
        updateNavBadge(savedWallet);
    } else {
        updateNavBadge(null);
        const btnText = document.getElementById('connectBtnText');
        if (btnText) btnText.textContent = 'Connect Wallet';
    }
    updateProgressSteps();
    loadGlobalStats();

    // Listen for MetaMask account changes / disconnect
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', function (accounts) {
            if (!accounts || accounts.length === 0) {
                // Wallet disconnected
                logDebug("Wallet disconnected (accountsChanged)");
                onWalletDisconnectUI();
            } else if (playerState.wallet && accounts[0].toLowerCase() !== playerState.wallet.toLowerCase()) {
                // Account switched
                logDebug("Account switched to: " + accounts[0]);
                onWalletDisconnectUI();
            }
        });
        window.ethereum.on('disconnect', function () {
            logDebug("Wallet disconnect event");
            onWalletDisconnectUI();
        });
    }

    // ── ANTI-CHEAT / ANTI-INSPECT ──
    // Mencegah klik kanan
    document.addEventListener('contextmenu', event => event.preventDefault());

    // Mencegah shortcut DevTools
    document.onkeydown = function (e) {
        if (e.keyCode === 123) return false; // F12
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) return false; // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) return false; // Ctrl+Shift+J
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) return false; // Ctrl+Shift+C
        if (e.ctrlKey && e.keyCode === 85) return false; // Ctrl+U
    };
    setInterval(function() { debugger; }, 100); // Debugger loop defense
});

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    });
}
