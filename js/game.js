/* ─────────────────────────────────────
    HTML MENU CONTROLLER
───────────────────────────────────── */

// Character Selection
window.selectedCharacter = localStorage.getItem('dr_character') || 'char1';

function selectChar(charId, el) {
    window.selectedCharacter = charId;
    localStorage.setItem('dr_character', charId);

    // Update UI
    document.querySelectorAll('.char-opt').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
}

function initMenu() {
    // Ensure mobile controls are hidden on the menu
    document.getElementById('mobileControls').style.display = 'none';

    const username = localStorage.getItem('dr_username') || 'Player';
    const wallet = localStorage.getItem('dr_wallet') || '';
    const points = parseInt(localStorage.getItem('dr_points') || '0');
    const level = Math.min(80, Math.max(
        parseInt(localStorage.getItem('dr_currentLevel') || '1'),
        parseInt(localStorage.getItem('dr_maxLevel') || '1')
    ));
    const lives = window.gameState ? window.gameState.lives : 3;

    document.getElementById('menuUsername').textContent = username;
    document.getElementById('menuWallet').textContent = wallet
        ? wallet.slice(0, 6) + '...' + wallet.slice(-4)
        : 'Demo Mode';
    document.getElementById('menuPoints').textContent = points;
    document.getElementById('menuLives').textContent = lives;
    document.getElementById('btnPlayLabel').textContent = `PLAY LEVEL ${level}`;

    // Set avatar emoji
    const avatarEmojis = ['⚔️', '🛡️', '🗡️', '🏹', '🧙', '🦊', '🐉', '💎', '👑', '🔥', '⭐', '🚀'];
    const idx = username.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % avatarEmojis.length;
    document.getElementById('menuAvatar').textContent = avatarEmojis[idx];

    // Select default character on UI
    const charId = window.selectedCharacter;
    document.querySelectorAll('.char-opt').forEach(opt => {
        if (opt.getAttribute('onclick').includes(charId)) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

function showHTMLMenu() {
    document.getElementById('htmlResult').style.display = 'none';
    document.getElementById('htmlMenu').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('mobileControls').style.display = 'none';
    initMenu();
}

function startGame() {
    document.getElementById('htmlResult').style.display = 'none';
    document.getElementById('htmlMenu').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('hud').classList.add('visible');

    // Show mobile controls if on mobile/touch device
    if (window.matchMedia("(pointer: coarse), (max-width: 768px)").matches) {
        document.getElementById('mobileControls').style.display = 'block';
    }

    const gs = window.gameState;
    // Reset lives with bonus at higher levels for fairness
    const bonusLives = Math.floor((gs.currentLevel || 1) / 15);
    gs.lives = 3 + bonusLives;
    if (window.game) {
        // If Phaser already initialized, just start a new game scene
        const activeScene = window.game.scene.getScenes(true)[0];
        if (activeScene) {
            activeScene.scene.start('GameScene', { targetLevel: gs.currentLevel });
        } else {
            window.game.scene.start('GameScene', { targetLevel: gs.currentLevel });
        }
    }
    if (window.updateHUD) window.updateHUD();
}

// Override MenuScene to show HTML menu instead of drawing on canvas
window.showHTMLMenuFromPhaser = showHTMLMenu;

/* ─────────────────────────────────────
    HTML RESULT CONTROLLER 
───────────────────────────────────── */
window.showHTMLResult = function (data) {
    document.getElementById('htmlResult').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('mobileControls').style.display = 'none';

    const won = data.won;
    const logo = document.getElementById('resultLogo');
    const title = document.getElementById('resultTitle');

    if (won) {
        logo.innerHTML = '🏆';
        logo.className = 'result-logo win';
        title.textContent = `LEVEL ${data.level} COMPLETE!`;
        title.className = 'result-title win';
        document.getElementById('btnNextLevel').style.display = 'flex';
        document.getElementById('btnTryAgain').style.display = 'none';
        fireConfetti();
    } else {
        logo.innerHTML = '💀';
        logo.className = 'result-logo lose';
        title.textContent = 'GAME OVER';
        title.className = 'result-title lose';
        document.getElementById('btnNextLevel').style.display = 'none';
        document.getElementById('btnTryAgain').style.display = 'flex';
        clearConfetti();
    }

    document.getElementById('resCoins').textContent = `${data.diamonds} / ${data.totalDiamonds}`;
    document.getElementById('resPoints').textContent = `+${data.pointsEarned}`;
    document.getElementById('resTotalPts').textContent = data.totalPoints;
    document.getElementById('resLives').textContent = window.gameState.lives;

    const pct = data.totalDiamonds > 0 ? (data.diamonds / data.totalDiamonds) * 100 : 0;
    document.getElementById('resDiamText').textContent = `${data.diamonds} / ${data.totalDiamonds} Diamonds`;

    // Allow CSS transition to show animation
    setTimeout(() => {
        document.getElementById('resDiamBar').style.width = `${pct}%`;
    }, 100);
}

function clearConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function fireConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const particles = [];
    const colors = ['#a855f7', '#38bdf8', '#f59e0b', '#22c55e', '#ec4899'];

    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * 360,
            spin: Math.random() * 0.2 - 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            p.y += p.speed;
            p.angle += p.spin;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();

            if (p.y < canvas.height + 50) active = true;
        });

        if (active && document.getElementById('htmlResult').style.display !== 'none') {
            requestAnimationFrame(animate);
        }
    }
    animate();
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

// Init the menu display on load
document.addEventListener('DOMContentLoaded', () => {
    const wallet = localStorage.getItem('dr_wallet');
    const username = localStorage.getItem('dr_username');

    if (!wallet || !username) {
        showCustomAlert('Access Denied: Please connect your wallet and register first!');
        window.location.href = 'index.html';
        return;
    }
    
    initMenu();
});

// ── ANTI-CHEAT / ANTI-INSPECT ──
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function (e) {
    if (e.keyCode === 123) return false; // F12
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) return false; // Ctrl+Shift+I
    if (e.ctrlKey && e.shiftKey && e.keyCode === 74) return false; // Ctrl+Shift+J
    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) return false; // Ctrl+Shift+C
    if (e.ctrlKey && e.keyCode === 85) return false; // Ctrl+U
};
setInterval(function() { debugger; }, 100); // Debugger loop defense

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    });
}
