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
        // OPTIMISTIC LOCAL UPDATE (berlaku untuk guest dan player offline)
        let maxLvl = Math.max(parseInt(localStorage.getItem('dr_maxLevel') || '1'), level);
        localStorage.setItem('dr_maxLevel', maxLvl);
        localStorage.setItem('dr_currentLevel', level);
        localStorage.setItem('dr_points', window.gameState.totalPoints);
        window.gameState.currentLevel = level;

        if (!playerSession.wallet || playerSession.wallet === 'guest') return;

        if (!window.supabaseClient) {
            console.error('Supabase client not loaded! Score will not be saved to database.');
            window.showToast('⚠️ Score not saved (offline mode)', '#f59e0b', 3000);
            return;
        }

        // Try Edge Function first, fallback to direct DB update
        let saved = false;

        try {
            const { data, error } = await window.supabaseClient.functions.invoke('submit-score', {
                body: { 
                    wallet: playerSession.wallet,
                    points: points,
                    level: level,
                    diamonds: diamonds,
                }
            });

            if (error) throw error;

            if (data && data.success) {
                localStorage.setItem('dr_points', data.totalPoints);
                maxLvl = Math.max(maxLvl, data.level);
                localStorage.setItem('dr_maxLevel', maxLvl);
                localStorage.setItem('dr_currentLevel', maxLvl);
                window.gameState.totalPoints = data.totalPoints;
                window.gameState.currentLevel = maxLvl;
                window.showToast(`Score saved! +${points} pts`, '#22c55e', 3000);
                saved = true;
            }
        } catch (edgeFnErr) {
            console.warn('Edge function failed, trying direct DB update:', edgeFnErr.message);
        }

        // FALLBACK: Direct Supabase update if edge function failed
        if (!saved) {
            try {
                const walletLower = playerSession.wallet.toLowerCase();
                
                // Get current profile data
                const { data: profile } = await window.supabaseClient
                    .from('profiles')
                    .select('points, diamonds_collected, max_level, level')
                    .eq('wallet', walletLower)
                    .single();

                if (profile) {
                    const newTotalPoints = (profile.points || 0) + points;
                    const newTotalDiamonds = (profile.diamonds_collected || 0) + diamonds;
                    const newMaxLevel = Math.max(profile.max_level || 1, profile.level || 1, level);

                    const { error: updateErr } = await window.supabaseClient
                        .from('profiles')
                        .update({
                            points: newTotalPoints,
                            diamonds_collected: newTotalDiamonds,
                            max_level: newMaxLevel,
                            level: newMaxLevel
                        })
                        .eq('wallet', walletLower);

                    if (updateErr) throw updateErr;

                    // Sync local state
                    localStorage.setItem('dr_points', newTotalPoints);
                    maxLvl = Math.max(maxLvl, newMaxLevel);
                    localStorage.setItem('dr_maxLevel', maxLvl);
                    localStorage.setItem('dr_currentLevel', maxLvl);
                    window.gameState.totalPoints = newTotalPoints;
                    window.gameState.currentLevel = maxLvl;

                    window.showToast(`Score saved! +${points} pts`, '#22c55e', 3000);
                    saved = true;
                }
            } catch (directErr) {
                console.error('Direct DB update also failed:', directErr.message);
                window.showToast('⚠️ Could not save score', '#ef4444', 3000);
            }
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
