// =============================================
// main.js – Phaser 3 Game Configuration
// =============================================


// Player session from localStorage
const playerSession = {
    wallet: localStorage.getItem('dr_wallet') || 'guest',
    username: localStorage.getItem('dr_username') || 'Player',
    points: parseInt(localStorage.getItem('dr_points') || '0'),
};

// Global game state (shared across scenes)
let _rawState = {
    currentLevel: Math.min(80, Math.max(
        parseInt(localStorage.getItem('dr_currentLevel') || '1'),
        parseInt(localStorage.getItem('dr_maxLevel') || '1')
    )),
    totalPoints: playerSession.points,
    sessionPoints: 0,
    lives: 3,
    diamondsThisLevel: 0,
    totalDiamonds: 0,
};

// Protect game state using a Proxy
window.gameState = new Proxy(_rawState, {
    set(target, prop, value) {
        // Anti-cheat strict typing and bounds checking
        if (prop === 'lives') {
            if (typeof value !== 'number' || value > 20 || value < 0) {
                console.warn('Invalid state detected!');
                return true; // Ignore invalid values
            }
        }
        if (prop === 'diamondsThisLevel') {
            if (value > 50 || value < 0) return true;
        }
        target[prop] = value;
        return true;
    }
});

const config = {
    type: Phaser.AUTO,
    width: 480,
    height: 480,
    parent: 'gameContainer',
    backgroundColor: '#030712',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [LoadScene, MenuScene, GameScene, ResultScene],
    pixelArt: true,
    antialias: false,
    resolution: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: { width: 320, height: 320 }
    }
};

window.game = new Phaser.Game(config);

// ── HUD Update Helper ──────────────────────────────────
window.updateHUD = function () {
    const gs = window.gameState;
    const el = (id) => document.getElementById(id);
    if (el('hudLevel')) el('hudLevel').textContent = gs.currentLevel;
    if (el('hudLevelName') && window.currentLevelName) {
        el('hudLevelName').textContent = `LEVEL ${gs.currentLevel} - ${window.currentLevelName}`;
    }
    if (el('hudDiamonds')) el('hudDiamonds').textContent = gs.totalDiamonds;
    if (el('hudPoints')) el('hudPoints').textContent = gs.totalPoints;
    if (el('hudLives')) el('hudLives').textContent = gs.lives;
};

// ── Toast Helper ──────────────────────────────────────
window.showToast = function (msg, color = '#a855f7', duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.style.color = color;
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, duration);
};

// ── HMAC key TIDAK ada di client ──
// Signature di-generate server-side via get-game-token endpoint.
// Client hanya menyimpan token sementara yang diberikan server saat mulai game.

async function generateHMAC(message) {
    // Ambil session token yang sudah di-generate server (disimpan saat game start)
    const sessionToken = window._gameSessionToken;
    if (!sessionToken) throw new Error('No game session token. Please restart game.');

    const encoder = new TextEncoder();
    const keyData = encoder.encode(sessionToken);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    return Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Submit Score to Backend (secured with HMAC) ───────────────────────────
window.submitScore = async function (points, level, diamonds) {
    try {
        if (!playerSession.wallet || playerSession.wallet === 'guest') {
            // Guest mode: update locally
            let maxLvl = Math.min(80, Math.max(parseInt(localStorage.getItem('dr_maxLevel') || '1'), level));
            localStorage.setItem('dr_maxLevel', maxLvl);
            localStorage.setItem('dr_currentLevel', level);
            localStorage.setItem('dr_points', window.gameState.totalPoints);
            window.gameState.currentLevel = level;
            return;
        }

        if (!window.supabaseClient) {
            console.error('Supabase client not loaded!');
            window.showToast('⚠️ Score not saved (offline mode)', '#f59e0b', 3000);
            return;
        }

        // Generate HMAC signature for anti-cheat
        const timestamp = Date.now();
        const walletLower = playerSession.wallet.toLowerCase();
        const message = `${walletLower}:${points}:${level}:${diamonds}:${timestamp}`;
        const signature = await generateHMAC(message);

        const { data, error } = await window.supabaseClient.functions.invoke('submit-score', {
            body: { 
                wallet: playerSession.wallet,
                points: points,
                level: level,
                diamonds: diamonds,
                signature: signature,
                timestamp: timestamp,
            }
        });

        if (error) throw error;

        if (data && data.success) {
            localStorage.setItem('dr_points', data.totalPoints);
            
            // Server dictates the true level
            let maxLvl = Math.min(80, Math.max(parseInt(localStorage.getItem('dr_maxLevel') || '1'), data.level));
            localStorage.setItem('dr_maxLevel', maxLvl);
            localStorage.setItem('dr_currentLevel', maxLvl);
            window.gameState.totalPoints = data.totalPoints;
            window.gameState.currentLevel = maxLvl;
            window.showToast(`Score saved! +${points} pts`, '#22c55e', 3000);
        } else {
            console.warn('Score rejected by server:', data?.error || 'unknown reason');
            window.showToast('⚠️ Score rejected by server', '#ef4444', 3000);
        }

    } catch (e) {
        console.warn('Score submit failed:', e.message);
        window.showToast('⚠️ Could not save score', '#ef4444', 3000);
    }
};

// ── Mobile D-Pad ──────────────────────────────────────
window.mobileInput = { up: false, down: false, left: false, right: false };

function bindDpadBtn(id, dir) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', () => { window.mobileInput[dir] = true; });
    btn.addEventListener('pointerup', () => { window.mobileInput[dir] = false; });
    btn.addEventListener('pointerout', () => { window.mobileInput[dir] = false; });
}

bindDpadBtn('btnUp', 'up');
bindDpadBtn('btnDown', 'down');
bindDpadBtn('btnLeft', 'left');
bindDpadBtn('btnRight', 'right');
