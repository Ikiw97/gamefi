// =============================================
// onboarding.js – Form Logic, Captcha, Register
// =============================================
// API URL is initialized in wallet.js as window.APP_API_URL
// CAPTCHA state
let captchaA, captchaB, captchaResult;

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    generateStars();
    loadLiveStats();
    setupCaptcha();
    setupFormEvents();

    // Wire wallet button
    document.getElementById('btnConnectWallet').addEventListener('click', connectWallet);

    // Check if already connected
    const savedWallet = localStorage.getItem('dr_wallet');
    if (savedWallet) {
        const isDemo = localStorage.getItem('dr_demo') === '1';
        handleWalletConnected(savedWallet, isDemo);
    }

    // Update navbar wallet badge
    updateNavWallet();
});

function updateNavWallet() {
    const w = localStorage.getItem('dr_wallet');
    const badge = document.getElementById('navWalletBadge');
    const addr = document.getElementById('navWalletAddr');
    if (!badge || !addr) return;
    if (w) {
        badge.classList.add('connected');
        badge.classList.remove('disconnected');
        addr.textContent = w.slice(0, 6) + '...' + w.slice(-4);
    }
}

// ── Live Stats ────────────────────────────────
async function loadLiveStats() {
    try {
        const { data, error, count } = await window.supabaseClient
            .from('profiles')
            .select('points, diamonds_collected', { count: 'exact' });

        if (error) throw error;

        let totalPoints = 0;
        let totalDiamonds = 0;

        data.forEach(p => {
            totalPoints += (p.points || 0);
            totalDiamonds += (p.diamonds_collected || 0);
        });

        document.getElementById('statPlayers').textContent = fmtNum(count || 0);
        document.getElementById('statDiamonds').textContent = fmtNum(totalDiamonds);
        document.getElementById('statPoints').textContent = fmtNum(totalPoints);
    } catch (e) {
        console.warn('Live stats error:', e);
        document.getElementById('statPlayers').textContent = '—';
        document.getElementById('statDiamonds').textContent = '—';
        document.getElementById('statPoints').textContent = '—';
    }
}

function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

// ── Star generation ───────────────────────────
function generateStars() {
    const container = document.getElementById('starsContainer');
    for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.cssText = `
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      --d:${(Math.random() * 3 + 1).toFixed(1)}s;
      opacity:${Math.random() * 0.5 + 0.1};
      width:${Math.random() < 0.3 ? 3 : 2}px;
      height:${Math.random() < 0.3 ? 3 : 2}px;
    `;
        container.appendChild(star);
    }
}

// ── CAPTCHA ───────────────────────────────────
function setupCaptcha() {
    captchaA = Math.floor(Math.random() * 15) + 1;
    captchaB = Math.floor(Math.random() * 15) + 1;
    captchaResult = captchaA + captchaB;
    document.getElementById('captchaQuestion').textContent = `${captchaA} + ${captchaB} = ?`;
}

// ── Form Events ───────────────────────────────
function setupFormEvents() {
    const usernameInput = document.getElementById('inputUsername');
    const referralInput = document.getElementById('inputReferral');
    const captchaInput = document.getElementById('captchaAnswer');
    const btnStart = document.getElementById('btnStartGame');

    // Username: unlock captcha when valid
    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value.trim();
        const valid = /^[a-zA-Z0-9_]{3,20}$/.test(val);
        usernameInput.classList.toggle('success', valid);
        usernameInput.classList.toggle('error', !valid && val.length > 0);
        if (valid) {
            markStepDone(2);
            unlockCard('cardCaptcha');
            setStepActive(3);
        }
    });

    // Referral: uppercase auto-format
    referralInput.addEventListener('input', () => {
        referralInput.value = referralInput.value.toUpperCase();
    });

    // Captcha: unlock start when solved
    captchaInput.addEventListener('input', () => {
        const answer = parseInt(captchaInput.value);
        if (answer === captchaResult) {
            captchaInput.classList.add('success');
            captchaInput.classList.remove('error');
            markStepDone(3);
            unlockCard('cardStart');
            setStepActive(4);
            btnStart.disabled = false;
            showAlert(document.getElementById('alertCaptcha'), 'success', '✅ Verified! You are human.');
        } else if (captchaInput.value.length > 0) {
            captchaInput.classList.add('error');
            captchaInput.classList.remove('success');
        }
    });

    // Start Game Button
    btnStart.addEventListener('click', registerAndPlay);
}

// ── Register & Redirect ───────────────────────
async function registerAndPlay() {
    if (window.walletState.isReturning) {
        showLoading('LOADING GAME...');
        setTimeout(() => {
            hideLoading();
            window.location.href = 'game.html?v=' + Date.now();
        }, 800);
        return;
    }

    const wallet = window.walletState.address;
    const username = document.getElementById('inputUsername').value.trim();
    const referral = document.getElementById('inputReferral').value.trim();
    const alertEl = document.getElementById('alertStart');

    if (!wallet) {
        showAlert(alertEl, 'error', '❌ Please connect your wallet first!');
        return;
    }
    if (!username) {
        showAlert(alertEl, 'error', '❌ Please enter a username!');
        return;
    }

    showLoading('REGISTERING PLAYER...');
    document.getElementById('btnStartGame').disabled = true;

    try {
        // 1. Check if username taken
        const { data: existingUser } = await window.supabaseClient
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();

        if (existingUser) {
            throw new Error('Username already taken. Choose another!');
        }

        // 2. Generate Referral Code
        const referralCode = 'ZR-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        // 3. Create Profile
        const newProfile = {
            wallet: wallet.toLowerCase(),
            username: username,
            points: 0,
            diamonds_collected: 0,
            level: 1,
            max_level: 1,
            referral_code: referralCode,
            referred_by: referral || null
        };

        const { error: insertError } = await window.supabaseClient
            .from('profiles')
            .insert([newProfile]);

        if (insertError) throw insertError;

        localStorage.setItem('dr_username', username);
        localStorage.setItem('dr_referralCode', referralCode);
        localStorage.setItem('dr_points', 0);
        localStorage.setItem('dr_currentLevel', 1);

        // Show referral code
        document.getElementById('myReferralCode').textContent = referralCode;
        document.getElementById('myReferralSection').style.display = 'block';

        showAlert(alertEl, 'success', `🎉 Welcome, ${username}! Registration successful.`);

        // Redirect to game after short delay
        setTimeout(() => {
            hideLoading();
            window.location.href = 'game.html?v=' + Date.now();
        }, 1500);

    } catch (err) {
        hideLoading();
        document.getElementById('btnStartGame').disabled = false;
        showAlert(alertEl, 'error', '❌ ' + (err.message || 'Failed to register. Try again.'));
    }
}
