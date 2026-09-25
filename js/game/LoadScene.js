// =============================================
// LoadScene.js – Asset Preloading
// =============================================

class LoadScene extends Phaser.Scene {
    constructor() { super({ key: 'LoadScene' }); }

    preload() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ── Loading bar background ──
        const barBg = this.add.graphics();
        barBg.fillStyle(0x0f172a, 1);
        barBg.fillRoundedRect(W / 2 - 160, H / 2 - 12, 320, 24, 8);

        const bar = this.add.graphics();

        // Diamond icon text
        this.add.text(W / 2, H / 2 - 60, '💎', { fontSize: '48px' })
            .setOrigin(0.5)
            .setAlpha(0);

        this.tweens.add({
            targets: this.children.list[this.children.list.length - 1],
            alpha: 1,
            y: H / 2 - 70,
            duration: 600,
            ease: 'Back.Out'
        });

        const titleText = this.add.text(W / 2, H / 2 - 20, 'LOADING...', {
            fontFamily: 'Orbitron, monospace',
            fontSize: '12px',
            fill: '#a855f7',
            letterSpacing: 4
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            bar.clear();
            bar.fillStyle(0xa855f7, 1);
            const barW = Math.floor(316 * value);
            bar.fillRoundedRect(W / 2 - 158, H / 2 - 10, barW, 20, 6);
            titleText.setText(`LOADING... ${Math.floor(value * 100)}%`);
        });

        // ── Preload User Files ──
        // ── Preload User Files ──
        this.load.image('p1', 'assets/sprites/1.png');
        this.load.image('p2', 'assets/sprites/2.png');
        this.load.image('p3', 'assets/sprites/3.png');
        this.load.image('play1', 'assets/sprites/play1.png');
        this.load.image('play2', 'assets/sprites/play2.png');
        this.load.image('play3', 'assets/sprites/play3.png');
        this.load.image('play4', 'assets/sprites/play4.png');
        this.load.image('wall', 'assets/sprites/wall.png');
        this.load.image('tree', 'assets/sprites/tree.png');
        this.load.image('coin', 'assets/sprites/coin.png');
        this.load.image('fire1', 'assets/sprites/fire1.png');
        this.load.image('fire2', 'assets/sprites/fire2.png');
        this.load.image('key1', 'assets/sprites/key1.png');
        this.load.image('key2', 'assets/sprites/key2.png');
        this.load.image('key3', 'assets/sprites/key3.png');
        this.load.image('key4', 'assets/sprites/key4.png');
        this.load.image('key5', 'assets/sprites/key5.png');
        this.load.image('gob1', 'assets/sprites/gob1.png');
        this.load.image('gob2', 'assets/sprites/gob2.png');
        this.load.image('gob3', 'assets/sprites/gob3.png');
        this.load.image('gob4', 'assets/sprites/gob4.png');
        this.load.image('gob5', 'assets/sprites/gob5.png');
        this.load.image('door_locked', 'assets/sprites/door1.png');
        this.load.image('door_open', 'assets/sprites/door2.png');

        // ── Generate remaining sprites via canvas ──
        this.generateSprites();
    }

    generateSprites() {
        const tileSize = 32;
        const gen = (key, drawFn) => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = tileSize;
            const ctx = canvas.getContext('2d');
            drawFn(ctx, tileSize);
            this.textures.addCanvas(key, canvas);
        };

        // FLOOR (Slate tiles)
        gen('floor', (ctx, s) => {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, s, s);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
        });

        // TRAP
        gen('trap', (ctx, s) => {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, s, s);
            // Spike
            ctx.fillStyle = '#ef4444';
            const spike = (x, h) => {
                ctx.beginPath();
                ctx.moveTo(x, s);
                ctx.lineTo(x + 6, s - h);
                ctx.lineTo(x + 12, s);
                ctx.closePath();
                ctx.fill();
            };
            spike(2, 20); spike(14, 24); spike(18, 20);
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#b91c1c';
            spike(2, 20); spike(14, 24); spike(18, 20);
        });

        // KEY
        gen('key', (ctx, s) => {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, s, s);
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 8;
            // Key circle
            ctx.beginPath();
            ctx.arc(s / 2, s / 2 - 4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#030712';
            ctx.beginPath();
            ctx.arc(s / 2, s / 2 - 4, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Key handle
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(s / 2 - 2, s / 2 + 2, 4, 10);
            ctx.fillRect(s / 2 + 2, s / 2 + 5, 4, 3);
            ctx.fillRect(s / 2 + 2, s / 2 + 9, 3, 3);
        });



    }

    create() {
        this.time.delayedCall(400, () => {
            // Assets loaded — show the HTML menu (not a Phaser MenuScene)
            if (window.showHTMLMenuFromPhaser) {
                window.showHTMLMenuFromPhaser();
                // Also init the MenuScene in Phaser so it's ready when needed
                this.scene.start('MenuScene');
            } else {
                this.scene.start('MenuScene');
            }
        });
    }
}
