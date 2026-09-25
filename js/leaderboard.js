const myWallet = localStorage.getItem('dr_wallet') || '';
window.walletState = {
    connected: !!myWallet,
    wallet: myWallet,
    username: localStorage.getItem('dr_username') || null
};

// Stars
const sc = document.getElementById('starsContainer');
for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--d:${(Math.random() * 3 + 1).toFixed(1)}s;opacity:${Math.random() * 0.4 + 0.1}`;
    sc.appendChild(s);
}

function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

async function loadStats() {
    try {
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

        document.getElementById('gs_players').textContent = fmtNum(count || 0);
        document.getElementById('gs_diamonds').textContent = fmtNum(totalDiamonds);
        document.getElementById('gs_points').textContent = fmtNum(totalPoints);
    } catch (e) {
        console.warn('Stats error:', e);
    }
}

async function loadLeaderboard() {
    document.getElementById('lbBody').innerHTML = '<div class="loading-lb">⟳ Loading...</div>';
    try {
        const { data: players, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('points', { ascending: false })
            .limit(50);

        if (error) throw error;

        players.forEach((p, idx) => p.rank = idx + 1);

        // Podium
        if (players.length >= 3) {
            document.getElementById('top3Bar').style.display = 'flex';
            document.getElementById('t1name').textContent = players[0]?.username || '—';
            document.getElementById('t1pts').textContent = fmtNum(players[0]?.points || 0);
            document.getElementById('t2name').textContent = players[1]?.username || '—';
            document.getElementById('t2pts').textContent = fmtNum(players[1]?.points || 0);
            document.getElementById('t3name').textContent = players[2]?.username || '—';
            document.getElementById('t3pts').textContent = fmtNum(players[2]?.points || 0);
        }

        if (players.length === 0) {
            document.getElementById('lbBody').innerHTML = '<div class="loading-lb">No players yet. Be the first! 🚀</div>';
            return;
        }

        let html = '';
        players.forEach((p, i) => {
            const isMe = myWallet && p.wallet && p.wallet.startsWith(myWallet.slice(0, 6).toLowerCase());
            const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
            const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${p.rank}`;

            if (isMe) {
                const banner = document.getElementById('myRankBanner');
                banner.textContent = `🎯 You are ranked #${p.rank} with ${fmtNum(p.points)} points`;
                banner.style.display = 'block';
            }

            html += `<div class="lb-row ${isMe ? 'me' : ''}">
          <div class="rank-badge ${rankClass}">${rankIcon}</div>
          <div class="player-col">
            <div class="uname">${escHtml(p.username)} ${isMe ? '⭐' : ''}</div>
            <div class="waddr">${p.wallet ? escHtml(p.wallet.slice(0, 6) + '...' + p.wallet.slice(-4)) : '—'}</div>
          </div>
          <div class="pts-col">${fmtNum(p.points)}</div>
          <div class="level-col">Lv.${p.level || 1}</div>
        </div>`;
        });
        document.getElementById('lbBody').innerHTML = html;
    } catch (e) {
        document.getElementById('lbBody').innerHTML = '<div class="loading-lb">⚠️ Could not load data. Is the server running?</div>';
    }
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '—';
    return d.innerHTML;
}

loadStats();
loadLeaderboard();
// Auto refresh every 30 seconds
setInterval(() => { loadStats(); loadLeaderboard(); }, 30000);

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
