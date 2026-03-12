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
window.gameState = {
    currentLevel: Math.max(
        parseInt(localStorage.getItem('dr_currentLevel') || '1'),
        parseInt(localStorage.getItem('dr_maxLevel') || '1')
    ),
    totalPoints: playerSession.points,
    sessionPoints: 0,
    lives: 3,
    diamondsThisLevel: 0,
    totalDiamonds: 0,
};

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

// ── Submit Score to Backend ───────────────────────────
window.submitScore = async function (points, level, diamonds) {
    try {
        if (!playerSession.wallet || playerSession.wallet === 'guest') return;

        // Memanggil Supabase Edge Function untuk submit score
        // Ini lebih aman karena validasi poin bisa dilakukan di server sebelum masuk database.
        const { data, error } = await window.supabaseClient.functions.invoke('submit-score', {
            body: { 
                wallet: playerSession.wallet,
                points: points,
                level: level,
                diamonds: diamonds,
                // signature: "secret-hash-here" // (Opsional) bisa ditambahkan nanti untuk keamanan ekstra
            }
        });

        if (error) {
            console.error('Edge Function Error:', error);
            throw error;
        }

        if (data && data.success) {
            // Update local storage dengan data yang divalidasi server
            localStorage.setItem('dr_points', data.totalPoints);
            localStorage.setItem('dr_maxLevel', data.level);
            localStorage.setItem('dr_currentLevel', data.level); // Sync next level for session

            // Update global state
            window.gameState.totalPoints = data.totalPoints;
            window.gameState.currentLevel = data.level;
            
            window.showToast(`Score saved! +${points} pts`, '#22c55e', 3000);
        } else {
            console.warn('Score submission rejected by server:', data);
        }

    } catch (e) {
        console.warn('Score submit failed:', e.message);
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
