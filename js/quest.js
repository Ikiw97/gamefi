/**
 * quest.js
 * Main logic for the Quest page (Profile, Social Tasks, NFT Minting).
 * Separated from HTML for better organization and security.
 */

// -- State & Config --
const wallet = localStorage.getItem('dr_wallet') || '';
const isDemo = localStorage.getItem('dr_demo') === '1';

window.walletState = {
    connected: !!wallet,
    address: wallet,
    isDemo: isDemo
};

// -- Helpers --
function fmtNum(n) {
    if (!n) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

function maskAddr(addr) {
    if (!addr) return 'â€”';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || 'â€”';
    return d.innerHTML;
}

function fmtDate(dateStr) {
    if (!dateStr) return 'â€”';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// -- Stars Background --
function initStars() {
    const sc = document.getElementById('starsContainer');
    if (!sc) return;
    for (let i = 0; i < 70; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--d:${(Math.random() * 3 + 1).toFixed(1)}s;opacity:${Math.random() * 0.4 + 0.1};width:${Math.random() < 0.3 ? 3 : 2}px;height:${Math.random() < 0.3 ? 3 : 2}px`;
        sc.appendChild(s);
    }
}

// -- Initialization --
document.addEventListener('DOMContentLoaded', () => {
    initStars();

    if (!wallet) {
        const notConnected = document.getElementById('notConnected');
        if (notConnected) notConnected.style.display = 'block';
        return;
    }

    const profileContent = document.getElementById('profileContent');
    if (profileContent) profileContent.style.display = 'block';

    // Navbar wallet
    const navBadge = document.getElementById('navWalletBadge');
    if (navBadge) {
        navBadge.classList.remove('disconnected');
        document.getElementById('navWalletAddr').textContent = maskAddr(wallet);
        document.getElementById('navDisconnectIcon').style.display = 'inline-block';
    }

    // Load from localStorage first (instant)
    const username = localStorage.getItem('dr_username') || 'Player';
    const level = Math.max(parseInt(localStorage.getItem('dr_currentLevel') || '1'), parseInt(localStorage.getItem('dr_maxLevel') || '1'));
    const points = parseInt(localStorage.getItem('dr_points') || '0');
    const refCode = localStorage.getItem('dr_referralCode') || '';

    const elUser = document.getElementById('profileUsername');
    if (elUser) elUser.textContent = username;
    const elWallet = document.getElementById('profileWallet');
    if (elWallet) elWallet.textContent = maskAddr(wallet);
    const elLvl = document.getElementById('avatarLevel');
    if (elLvl) elLvl.textContent = level;
    const elLvlB = document.getElementById('levelBadge');
    if (elLvlB) elLvlB.textContent = `⚡ LVL ${level}`;
    const elPts = document.getElementById('statPoints');
    if (elPts) elPts.textContent = fmtNum(points);

    if (refCode) {
        const elRef = document.getElementById('refCode');
        if (elRef) elRef.textContent = refCode;
        const elRefL = document.getElementById('refLinkBox');
        if (elRefL) elRefL.textContent = `${window.location.origin}?ref=${refCode}`;
    }

    if (isDemo) {
        const elDemo = document.getElementById('demoBadge');
        if (elDemo) elDemo.style.display = 'inline-flex';
    }

    // Avatar image
    const savedChar = localStorage.getItem('dr_character') || 'player1';
    updateAvatarDisplay(savedChar);

    // Initial achievements
    updateAchievements(level, points, 0, 0);

    // Fetch API data
    loadPlayerData();
    loadPlayerRank();
    loadGameHistory();
    loadSocialTasks();
    
    // Start polling for mint status
    let checkCount = 0;
    const mintCheckInterval = setInterval(() => {
        const addr = window.walletState.address || localStorage.getItem('dr_wallet');
        if (addr) {
            checkMintBadgeStatus();
            if (++checkCount >= 5) clearInterval(mintCheckInterval);
        }
    }, 3000);
    setTimeout(() => clearInterval(mintCheckInterval), 30000);

    handleTwitterOAuthCallback();
});

// -- Character Selection --
function updateAvatarDisplay(charName) {
    const avatarEl = document.getElementById('profileAvatar');
    if (!avatarEl) return;
    avatarEl.innerHTML = `<img src="assets/sprites/${charName}.png" alt="Character" style="width: 100%; height: 100%; object-fit: contain; transform: scale(1.6); transform-origin: top center; image-rendering: pixelated; margin-top: 5px;">`;
}

function openCharSelect() {
    const modal = document.getElementById('charSelModal');
    if (!modal) return;
    modal.style.display = 'flex';
    const savedChar = localStorage.getItem('dr_character') || 'player1';
    const opt1 = document.getElementById('opt-player1');
    const opt2 = document.getElementById('opt-player2');
    if (opt1) opt1.className = 'char-modal-opt' + (savedChar === 'player1' ? ' active' : '');
    if (opt2) opt2.className = 'char-modal-opt' + (savedChar === 'player2' ? ' active' : '');
}

function closeCharSelect() {
    const modal = document.getElementById('charSelModal');
    if (modal) modal.style.display = 'none';
}

function saveCharProfile(charName) {
    localStorage.setItem('dr_character', charName);
    if (charName === 'player1') localStorage.setItem('dr_character_legacy', 'char1');
    if (charName === 'player2') localStorage.setItem('dr_character_legacy', 'char2');
    updateAvatarDisplay(charName);
    closeCharSelect();
}

// -- Player Data --
async function loadPlayerData() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('wallet', wallet.toLowerCase())
            .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const level = Math.max(
            data.level || 1,
            parseInt(localStorage.getItem('dr_currentLevel') || '1'),
            parseInt(localStorage.getItem('dr_maxLevel') || '1')
        );
        const points = data.points || 0;
        const diamonds = data.diamonds_collected || 0;
        const games = data.games_played || 0;
        const refs = data.referral_count || 0;

        const elUser = document.getElementById('profileUsername');
        if (elUser) elUser.textContent = data.username || 'Player';
        const elPts = document.getElementById('statPoints');
        if (elPts) elPts.textContent = fmtNum(points);
        const elCoins = document.getElementById('statCoins');
        if (elCoins) elCoins.textContent = fmtNum(diamonds);
        const elLvl = document.getElementById('avatarLevel');
        if (elLvl) elLvl.textContent = level;
        const elLvlB = document.getElementById('levelBadge');
        if (elLvlB) elLvlB.textContent = `⚡ LVL ${level}`;
        const elGames = document.getElementById('statGames');
        if (elGames) elGames.textContent = fmtNum(games);
        const elRefs = document.getElementById('refCount');
        if (elRefs) elRefs.textContent = refs;
        const elRefB = document.getElementById('refCountBadge');
        if (elRefB) elRefB.textContent = `${refs} Referred`;
        const elRefBonus = document.getElementById('refBonus');
        if (elRefBonus) elRefBonus.textContent = fmtNum(refs * 25);

        if (data.referral_code) {
            const elRefC = document.getElementById('refCode');
            if (elRefC) elRefC.textContent = data.referral_code;
            const elRefL = document.getElementById('refLinkBox');
            if (elRefL) elRefL.textContent = `${window.location.origin}?ref=${data.referral_code}`;
            localStorage.setItem('dr_referralCode', data.referral_code);
        }

        localStorage.setItem('dr_username', data.username || 'Player');
        localStorage.setItem('dr_points', points);
        localStorage.setItem('dr_currentLevel', level);
        localStorage.setItem('dr_maxLevel', level);

        updateAchievements(level, points, diamonds, refs);
    } catch (e) {
        console.log('Could not load player data:', e);
    }
}

async function loadPlayerRank() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('wallet, points')
            .order('points', { ascending: false });

        if (error) throw error;

        const meIndex = (data || []).findIndex(p =>
            p.wallet && wallet && p.wallet.toLowerCase() === wallet.toLowerCase()
        );

        const elRank = document.getElementById('statRank');
        if (elRank) elRank.textContent = meIndex !== -1 ? `#${meIndex + 1}` : 'â€”';
    } catch (e) {
        console.log('Rank error:', e);
    }
}

async function loadGameHistory() {
    document.getElementById('historyContent').innerHTML = `
        <div class="empty-state">
            <div class="es-icon">ðŸŽ®</div>
            <div class="es-text">No games played yet. Start playing!</div>
        </div>`;
}

// -- Achievements --
function updateAchievements(level, points, diamonds, refs) {
    toggle('ach2', points >= 100000);
    toggle('ach3', level >= 50);
    toggle('ach4', level >= 25);
    toggle('ach5', refs >= 20);
}

function toggle(id, unlocked) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('unlocked', unlocked);
    el.classList.toggle('locked', !unlocked);
}

// -- Social Tasks --
const SOCIAL_TASK_CONFIG = {
    twitter_connect: { url: 'https://twitter.com/zicorush_', points: 1500 },
    twitter_follow: { url: 'https://twitter.com/intent/follow?screen_name=zicorush_', points: 1000 },
    twitter_retweet: { url: 'https://twitter.com/intent/retweet?tweet_id=TWEET_ID_HERE', points: 800 },
    twitter_like: { url: 'https://twitter.com/intent/like?tweet_id=TWEET_ID_HERE', points: 800 }
};

const socialTaskActioned = {};
const socialTaskCompleted = {};
let twitterConnected = false;
let twitterUsername = localStorage.getItem('dr_twitter_username') || '';

async function loadSocialTasks() {
    try {
        const { data, error } = await window.supabaseClient
            .from('social_tasks')
            .select('task_type, points_awarded, completed_at')
            .eq('wallet', wallet.toLowerCase());

        if (error) return;

        let completedCount = 0;
        (data || []).forEach(task => {
            socialTaskCompleted[task.task_type] = true;
            completedCount++;
            const el = document.getElementById(`task-${task.task_type}`);
            if (el) {
                el.classList.add('completed');
                const btn = el.querySelector('.btn-task');
                if (btn) {
                    btn.className = 'btn-task done';
                    btn.textContent = 'Completed âœ“';
                    btn.onclick = null;
                }
            }
        });

        updateSocialProgress(completedCount);
    } catch (e) {
        console.log('Could not load social tasks:', e);
    }
}

function updateSocialProgress(count) {
    const total = 4;
    const pct = Math.round((count / total) * 100);
    const elFill = document.getElementById('socialProgressFill');
    if (elFill) elFill.style.width = pct + '%';
    const elText = document.getElementById('socialProgressText');
    if (elText) elText.textContent = `${count}/${total} tasks completed`;
    const elBadge = document.getElementById('socialTasksBadge');
    if (elBadge) elBadge.textContent = `${count}/${total} Done`;
}

const VERIFY_TIMER_SECONDS = 30;

async function doSocialTask(taskType) {
    if (socialTaskCompleted[taskType]) return;

    if (taskType === 'twitter_connect') {
        await connectTwitterOAuth();
        return;
    }

    if (['twitter_follow', 'twitter_retweet', 'twitter_like'].includes(taskType)) {
        if (!twitterConnected && !socialTaskCompleted['twitter_connect']) {
            showTaskToast('Connect Twitter first!', true);
            return;
        }
    }

    const config = SOCIAL_TASK_CONFIG[taskType];
    if (!config) return;

    window.open(config.url, '_blank');
    socialTaskActioned[taskType] = true;
    startVerifyCountdown(taskType);
}

function startVerifyCountdown(taskType) {
    const el = document.getElementById(`task-${taskType}`);
    if (!el) return;
    const btn = el.querySelector('.btn-task');
    if (!btn) return;

    let remaining = VERIFY_TIMER_SECONDS;
    btn.className = 'btn-task loading';
    btn.textContent = `â³ Verifying... ${remaining}s`;
    btn.onclick = null;
    btn.disabled = true;

    const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            btn.textContent = `â³ Verifying... ${remaining}s`;
        } else {
            clearInterval(interval);
            btn.disabled = false;
            btn.className = 'btn-task claim';
            btn.textContent = 'âœ… Verify & Claim';
            btn.onclick = () => claimSocialTask(taskType);
        }
    }, 1000);
}

async function connectTwitterOAuth() {
    const el = document.getElementById('task-twitter_connect');
    const btn = el ? el.querySelector('.btn-task') : null;

    if (btn) {
        btn.className = 'btn-task loading';
        btn.textContent = 'Connecting...';
    }

    try {
        const { error } = await window.supabaseClient.auth.signInWithOAuth({
            provider: 'twitter',
            options: { redirectTo: window.location.origin + '/quest.html' }
        });
        if (error) throw error;
    } catch (e) {
        console.error('Twitter OAuth error:', e);
        showTaskToast('Failed to connect Twitter.', true);
        if (btn) {
            btn.className = 'btn-task action';
            btn.textContent = 'Connect';
            btn.onclick = () => doSocialTask('twitter_connect');
        }
    }
}

async function handleTwitterOAuthCallback() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) return;

        if (session && session.user) {
            const user = session.user;
            const twitterMeta = user.user_metadata || {};

            if (user.app_metadata?.provider === 'twitter' || twitterMeta.provider_id) {
                twitterConnected = true;
                twitterUsername = twitterMeta.preferred_username || twitterMeta.user_name || twitterMeta.full_name || '';
                const twitterUserId = twitterMeta.provider_id || user.id || '';
                localStorage.setItem('dr_twitter_username', twitterUsername);
                localStorage.setItem('dr_twitter_user_id', twitterUserId);

                const el = document.getElementById('task-twitter_connect');
                if (el) {
                    const desc = el.querySelector('.task-desc');
                    if (desc && twitterUsername) desc.textContent = `Connected as @${twitterUsername}`;
                }

                if (!socialTaskCompleted['twitter_connect']) {
                    socialTaskActioned['twitter_connect'] = true;
                    await claimSocialTask('twitter_connect');
                }
            }
        }
    } catch (e) {
        console.log('OAuth callback error:', e);
    }

    if (!twitterConnected && localStorage.getItem('dr_twitter_username')) {
        twitterConnected = true;
        const el = document.getElementById('task-twitter_connect');
        if (el && !socialTaskCompleted['twitter_connect']) {
            const desc = el.querySelector('.task-desc');
            if (desc) desc.textContent = `Connected as @${localStorage.getItem('dr_twitter_username')}`;
        }
    }
}

async function claimSocialTask(taskType) {
    if (socialTaskCompleted[taskType]) return;

    const el = document.getElementById(`task-${taskType}`);
    const btn = el ? el.querySelector('.btn-task') : null;

    if (btn) {
        btn.className = 'btn-task loading';
        btn.textContent = 'Claiming...';
    }

    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/complete-social-task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                wallet: wallet.toLowerCase(),
                task_type: taskType,
                twitter_user_id: localStorage.getItem('dr_twitter_user_id') || '',
                twitter_username: localStorage.getItem('dr_twitter_username') || ''
            })
        });

        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Failed to claim');

        socialTaskCompleted[taskType] = true;
        if (el) {
            el.classList.add('completed');
            if (btn) {
                btn.className = 'btn-task done';
                btn.textContent = 'Completed âœ“';
                btn.onclick = null;
            }
        }

        if (result.new_points !== undefined) {
            const elPts = document.getElementById('statPoints');
            if (elPts) elPts.textContent = fmtNum(result.new_points);
            localStorage.setItem('dr_points', result.new_points);
        }

        updateSocialProgress(Object.keys(socialTaskCompleted).length);
        showTaskToast(`+${SOCIAL_TASK_CONFIG[taskType].points} Points earned! ðŸŽ‰`);

    } catch (e) {
        console.error('Claim social task error:', e);
        if (e.message && e.message.toLowerCase().includes('already completed')) {
            socialTaskCompleted[taskType] = true;
            if (el) el.classList.add('completed');
            if (btn) {
                btn.className = 'btn-task done';
                btn.textContent = 'Completed âœ“';
                btn.onclick = null;
            }
            showTaskToast('Task already completed!', false);
            return;
        }

        if (btn) {
            if (taskType === 'twitter_connect' && !twitterConnected) {
                btn.className = 'btn-task action';
                btn.textContent = 'Connect';
                btn.onclick = () => doSocialTask(taskType);
            } else {
                btn.className = 'btn-task claim';
                btn.textContent = 'âœ… Verify & Claim';
                btn.onclick = () => claimSocialTask(taskType);
            }
        }
        showTaskToast('Failed to claim. Try again.', true);
    }
}

// -- NFT Minting Logic --
async function getEthPrice() {
    if (cachedEthPrice && Date.now() - cachedEthPriceTime < 60000) return cachedEthPrice;
    try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await resp.json();
        cachedEthPrice = data.ethereum.usd;
        cachedEthPriceTime = Date.now();
        return cachedEthPrice;
    } catch (e) {
        return 2000;
    }
}
let cachedEthPrice = null;
let cachedEthPriceTime = 0;

async function updateMintFeeDisplay() {
    try {
        const ethPrice = await getEthPrice();
        const ethAmount = (window.NFT_CONFIG.mintFeeUsd / ethPrice).toFixed(6);
        const feeEl = document.getElementById('mintFeeEth');
        if (feeEl) feeEl.textContent = ethAmount;
    } catch (e) {
        const feeEl = document.getElementById('mintFeeEth');
        if (feeEl) feeEl.textContent = '~0.001';
    }
}

async function switchToSepolia(provider) {
    try {
        const currentChainId = parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16);
        if (currentChainId !== window.NFT_CONFIG.chainId) {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: window.NFT_CONFIG.chainIdHex }]
            });
        }
    } catch (switchError) {
        if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: window.NFT_CONFIG.chainIdHex,
                    chainName: 'Sepolia Testnet',
                    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://rpc.sepolia.org'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
            });
        } else {
            throw switchError;
        }
    }
}

function markMintedUI() {
    const btn = document.getElementById('btnMintBadge');
    const badge = document.getElementById('mintStatusBadge');
    
    if (btn) {
        btn.textContent = '✅ MINTED';
        btn.className = 'btn-mint-done';
        btn.style.cssText = 'background: rgba(59, 130, 246, 0.15); border: 2px solid rgba(59, 130, 246, 0.4); color: #3b82f6; pointer-events: none; opacity: 1; padding: 0.85rem 2rem; font-size: 0.85rem; font-weight: 900; border-radius: 12px; font-family: "Space Grotesk", monospace; letter-spacing: 0.08em;';
    }
    if (badge) {
        badge.textContent = 'Owned';
        badge.style.cssText = 'background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3); color: #3b82f6;';
    }
    toggle('ach1', true);
}

async function mintBadge() {
    if (!walletState.connected || !walletState.address) {
        alert('Please connect your wallet first.');
        return;
    }

    if (window.NFT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
        alert('NFT contract belum di-deploy.');
        return;
    }

    const btn = document.getElementById('btnMintBadge');
    const errorText = document.getElementById('mintErrorText');
    const txInfo = document.getElementById('mintTxInfo');

    errorText.style.display = 'none';
    txInfo.style.display = 'none';
    btn.textContent = '⏳ PREPARING...';
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        let provider;
        if (window.appKitModal?.getWalletProvider) provider = window.appKitModal.getWalletProvider();
        if (!provider && window.ethereum) provider = window.ethereum;
        if (!provider) throw new Error('Wallet provider not found.');

        btn.textContent = '⛓️ SWITCHING...';
        await switchToSepolia(provider);

        const ethersProvider = new ethers.BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const signerAddress = await signer.getAddress();

        const nftContract = new ethers.Contract(window.NFT_CONFIG.address, window.NFT_CONFIG.abi, signer);

        btn.textContent = '🔍 CHECKING...';
        const alreadyMinted = await nftContract.hasMinted(signerAddress);
        if (alreadyMinted) {
            btn.textContent = '🎯 SYNCING...';
            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/mint-badge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ wallet: signerAddress.toLowerCase(), txHash: null })
                });
                const data = await response.json();
                if (data.points_awarded) {
                    let pts = parseInt(localStorage.getItem('dr_points') || '0') + data.points_awarded;
                    document.getElementById('statPoints').textContent = fmtNum(pts);
                    localStorage.setItem('dr_points', pts.toString());
                }
            } catch (e) {}
            markMintedUI();
            btn.textContent = '✅ ALREADY MINTED';
            return;
        }

        const mintPrice = await nftContract.mintPrice();
        btn.textContent = `💎 MINTING (${ethers.formatEther(mintPrice)} ETH)...`;

        const tx = await nftContract.mint({ value: mintPrice });
        btn.textContent = '⏳ CONFIRMING...';
        const txLink = document.getElementById('mintTxLink');
        txLink.href = `https://sepolia.etherscan.io/tx/${tx.hash}`;
        txLink.textContent = tx.hash.slice(0, 10) + '...';
        txInfo.style.display = 'block';

        await tx.wait();
        btn.textContent = '🎯 AWARDING...';
        const response = await fetch(`${SUPABASE_URL}/functions/v1/mint-badge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ wallet: signerAddress.toLowerCase(), txHash: tx.hash })
        });
        const data = await response.json();
        if (data.points_awarded) {
            let pts = parseInt(localStorage.getItem('dr_points') || '0') + data.points_awarded;
            document.getElementById('statPoints').textContent = fmtNum(pts);
            localStorage.setItem('dr_points', pts.toString());
        }
        markMintedUI();
        btn.textContent = '✅ MINTED';
        showTaskToast('🎉 NFT Badge minted! +100K Points');

    } catch (err) {
        console.error('Mint error:', err);
        const msg = err.message || 'Minting failed';
        errorText.textContent = msg.includes('user rejected') ? 'Transaction cancelled.' : msg.slice(0, 60);
        errorText.style.display = 'block';
        btn.textContent = '💎 MINT BADGE NOW';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}

async function checkMintBadgeStatus() {
    const addr = window.walletState.address || localStorage.getItem('dr_wallet');
    if (!addr) return;
    updateMintFeeDisplay();

    try {
        const { data } = await window.supabaseClient.from('social_tasks').select('task_type').eq('wallet', addr.toLowerCase()).eq('task_type', 'mint_badge').maybeSingle();
        if (data) { markMintedUI(); return; }
    } catch (e) {}

    if (window.NFT_CONFIG.address !== '0x0000000000000000000000000000000000000000') {
        try {
            const rpcProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
            const nftContract = new ethers.Contract(window.NFT_CONFIG.address, window.NFT_CONFIG.abi, rpcProvider);
            if (await nftContract.hasMinted(addr)) {
                await fetch(`${SUPABASE_URL}/functions/v1/mint-badge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                    body: JSON.stringify({ wallet: addr.toLowerCase() })
                });
                markMintedUI();
            }
        } catch (e) {}
    }
}

// -- Common Actions --
function showTaskToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.style.cssText = `position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); padding: 0.75rem 1.5rem; border-radius: 12px; z-index: 999; font-family: 'Space Grotesk', monospace; font-size: 0.75rem; font-weight: 700; backdrop-filter: blur(16px); animation: toastSlide 0.3s ease-out; ${isError ? 'background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444;' : 'background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #22c55e;'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function copyRefCode() {
    const code = document.getElementById('refCode').textContent;
    if (!code || code === '—') return;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.referral-code-box .btn-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
}

function copyRefLink() {
    const link = document.getElementById('refLinkBox').textContent;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.querySelector('.ref-link .btn-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
    });
}

function copyWallet() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet).then(() => {
        const el = document.querySelector('.copy-icon');
        el.textContent = '✅';
        el.textContent = '📋';
    });
}

function disconnectWallet() {
    if (confirm('Are you sure you want to disconnect?')) {
        try { if (window.appKitModal?.disconnect) window.appKitModal.disconnect(); } catch (e) {}
        ['dr_wallet', 'dr_demo', 'dr_username', 'dr_referralCode', 'dr_points', 'dr_currentLevel'].forEach(k => localStorage.removeItem(k));
        Object.keys(localStorage).forEach(k => { if (k.startsWith('@w3m') || k.toLowerCase().startsWith('wagmi') || k.startsWith('@appkit')) localStorage.removeItem(k); });
        window.location.href = 'index.html';
    }
}

// Global exposure for HTML onclicks
window.openCharSelect = openCharSelect;
window.closeCharSelect = closeCharSelect;
window.saveCharProfile = saveCharProfile;
window.doSocialTask = doSocialTask;
window.claimSocialTask = claimSocialTask;
window.mintBadge = mintBadge;
window.copyRefCode = copyRefCode;
window.copyRefLink = copyRefLink;
window.copyWallet = copyWallet;
window.disconnectWallet = disconnectWallet;
