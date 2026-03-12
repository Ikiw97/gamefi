// =============================================
// GameScene.js – Core Gameplay (Zico Rush)
// =============================================

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init(data) {
        this.targetLevel = (data && data.targetLevel) ? data.targetLevel : window.gameState.currentLevel;
        console.log(`[GameScene Init] targetLevel: ${this.targetLevel}, gs.currentLevel: ${window.gameState.currentLevel}`);
    }

    // ─────────────────────────────────────────────
    // PRNG based on Mulberry32 for seeded level generation
    mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    // LEVEL DATA  (0=floor, 1=wall, 2=diamond,
    //              3=trap, 4=key, 5=door_locked, P=player)
    // ─────────────────────────────────────────────
    getLevelData(level) {
        // Create PRNG seeded with the level number
        const rng = this.mulberry32(level * 1024 + 1999);

        // Array shuffler using our seeded PRNG
        const shuffleArray = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // Base config by level
        const sizeBase = 9; // Minimum size must be odd
        const sizeScale = Math.floor(level / 5) * 2; // increases by 2 every 5 levels
        let cols = sizeBase + sizeScale;
        let rows = sizeBase + sizeScale;

        // Cap max size so it fits on screen nicely (max around 15x15)
        cols = Math.min(cols, 15);
        rows = Math.min(rows, 15);

        // Difficulty scaling
        const totalDiamonds = 5 + Math.floor(level * 1.5);
        const totalTraps = Math.floor(level * 1.2);
        const pointsPerDiamond = 10 + (level * 2);
        const levelCompleteBonus = 100 + (level * 20);

        // 1. Initialize grid with walls (1)
        const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

        // 2. Recursive Backtracker Maze Generation
        // Start carving from (1, 1)
        const startRow = 1;
        const startCol = 1;
        grid[startRow][startCol] = 0; // 0 = floor

        const wallsList = [];
        this.addWallsToMaze(startCol, startRow, grid, wallsList, cols, rows);

        while (wallsList.length > 0) {
            // Pick random wall using rng
            const randomIndex = Math.floor(rng() * wallsList.length);
            const wall = wallsList.splice(randomIndex, 1)[0];

            // Check if wall separates visited and unvisited cell
            const unvisited = this.getUnvisitedNeighbour(wall.c, wall.r, grid, cols, rows);

            if (unvisited) {
                // Break wall
                grid[wall.r][wall.c] = 0;
                // Mark cell as visited
                grid[unvisited.r][unvisited.c] = 0;
                // Add neighbour walls
                this.addWallsToMaze(unvisited.c, unvisited.r, grid, wallsList, cols, rows);
            }
        }

        // 2.5 Knock down random walls to create loops (so player can dodge monsters)
        // Without loops, a perfectly 1-tile wide maze makes monsters impassable
        const extraWallsToBreak = Math.floor((cols * rows) * 0.15);
        for (let i = 0; i < extraWallsToBreak; i++) {
            const r = 1 + Math.floor(rng() * (rows - 2));
            const c = 1 + Math.floor(rng() * (cols - 2));
            if (grid[r][c] === 1) {
                grid[r][c] = 0; // Break wall
            }
        }

        // Find all empty floors after carving
        const emptyFloors = [];
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                // Avoid spawning right on the player start position
                if (grid[r][c] === 0 && !(r === startRow && c === startCol)) {
                    emptyFloors.push({ r, c });
                }
            }
        }

        // Shuffle empty floors semi-randomly (seeded)
        shuffleArray(emptyFloors);

        // 3. Place Door (End point)
        // Pick the furthest empty floor from start by simple Manhattan distance
        emptyFloors.sort((a, b) => {
            const distA = Math.abs(a.c - startCol) + Math.abs(a.r - startRow);
            const distB = Math.abs(b.c - startCol) + Math.abs(b.r - startRow);
            return distB - distA; // Descending
        });

        const doorPos = emptyFloors.shift();
        grid[doorPos.r][doorPos.c] = 5; // 5 = Door

        // 4. Place Key
        // Reshuffle to pick a random open spot relying on rng
        shuffleArray(emptyFloors);
        const keyPos = emptyFloors.shift();
        grid[keyPos.r][keyPos.c] = 4; // 4 = Key

        // 5. Place Diamonds
        const maxDiamonds = Math.floor(emptyFloors.length * 0.4);
        const actualDiamonds = Math.min(totalDiamonds, maxDiamonds);
        for (let i = 0; i < actualDiamonds; i++) {
            if (emptyFloors.length === 0) break;
            const pos = emptyFloors.shift();
            grid[pos.r][pos.c] = 2; // 2 = Diamond
        }

        // 6. Place Traps
        // Reserve at least some floor space for movement
        const maxTraps = Math.floor(emptyFloors.length * 0.6);
        const actualTraps = Math.min(totalTraps, maxTraps);
        for (let i = 0; i < actualTraps; i++) {
            if (emptyFloors.length === 0) break;
            const pos = emptyFloors.shift();
            grid[pos.r][pos.c] = 3; // 3 = Trap
        }

        // 7. Place Goblins (level >= 8)
        const goblinPositions = [];
        if (level >= 8) {
            const totalGoblins = (level - 7); // Level 8: 1 goblin, Level 9: 2, Level 10: 3, etc.
            
            // Filter empty floors to keep goblins away from the START position
            const safeGoblinFloors = emptyFloors.filter(pos => {
                const distToStart = Math.abs(pos.c - startCol) + Math.abs(pos.r - startRow);
                return distToStart > 4; // Keep at least 4 tiles away from start
            });

            // Allow up to 25% of the safe floor space to be goblins (so it doesn't get utterly unplayable)
            const maxGoblins = Math.min(totalGoblins, Math.floor(safeGoblinFloors.length * 0.25));
            for (let i = 0; i < maxGoblins; i++) {
                if (safeGoblinFloors.length === 0) break;
                // We pick from the start of safe floors and ALSO remove from emptyFloors to prevent overlap
                const pos = safeGoblinFloors.shift();
                const indexInEmpty = emptyFloors.findIndex(e => e.r === pos.r && e.c === pos.c);
                if (indexInEmpty !== -1) emptyFloors.splice(indexInEmpty, 1);

                // Determine patrol direction: horizontal or vertical based on rng
                const dir = rng() < 0.5 ? 'h' : 'v';
                goblinPositions.push({ r: pos.r, c: pos.c, dir: dir });
            }
        }

        return {
            grid: grid,
            playerStart: { col: startCol, row: startRow },
            totalDiamonds: actualDiamonds,
            pointsPerDiamond: pointsPerDiamond,
            levelCompleteBonus: levelCompleteBonus,
            goblinPositions: goblinPositions,
            name: `Depth ${level}`,
            themeColor: this.getThemeColor(level)
        };
    }

    getThemeColor(level) {
        // Change color scheme every 10 levels
        const themes = [
            0xffffff, // 1-10: Default
            0x99ff99, // 11-20: Greenish Forest
            0x99ccff, // 21-30: Blueish Ice/Cave
            0xffcc99, // 31-40: Orangeish Desert/Cavern
            0xff9999, // 41-50: Redish Hell/Core
        ];
        return themes[Math.min(Math.floor((level - 1) / 10), themes.length - 1)];
    }

    // Maze Helper: Add valid inner walls of a visited cell
    addWallsToMaze(c, r, grid, list, cols, rows) {
        if (r - 1 > 0 && grid[r - 1][c] === 1) list.push({ c: c, r: r - 1 });
        if (r + 1 < rows - 1 && grid[r + 1][c] === 1) list.push({ c: c, r: r + 1 });
        if (c - 1 > 0 && grid[r][c - 1] === 1) list.push({ c: c - 1, r: r });
        if (c + 1 < cols - 1 && grid[r][c + 1] === 1) list.push({ c: c + 1, r: r });
    }

    // Maze Helper: Return the single unvisited neighbour opposite to a carved cell
    getUnvisitedNeighbour(c, r, grid, cols, rows) {
        // Vertical wall
        if (grid[r - 1][c] === 0 && grid[r + 1][c] === 1 && this.isValidMazeCell(c, r + 1, cols, rows)) return { c: c, r: r + 1 };
        if (grid[r + 1][c] === 0 && grid[r - 1][c] === 1 && this.isValidMazeCell(c, r - 1, cols, rows)) return { c: c, r: r - 1 };
        // Horizontal wall
        if (grid[r][c - 1] === 0 && grid[r][c + 1] === 1 && this.isValidMazeCell(c + 1, r, cols, rows)) return { c: c + 1, r: r };
        if (grid[r][c + 1] === 0 && grid[r][c - 1] === 1 && this.isValidMazeCell(c - 1, r, cols, rows)) return { c: c - 1, r: r };

        return null;
    }

    isValidMazeCell(c, r, cols, rows) {
        return c > 0 && c < cols - 1 && r > 0 && r < rows - 1;
    }

    // ─────────────────────────────────────────────
    create() {
        const gs = window.gameState;
        // Override gs state strictly with the target level we were told to play
        gs.currentLevel = this.targetLevel;
        localStorage.setItem('dr_currentLevel', this.targetLevel); // force sync to storage just in case

        const lvl = this.getLevelData(this.targetLevel);

        this.TILE = 32; // tile size
        this.tileData = lvl;
        this.hasKey = false;
        this.levelComplete = false;
        this.diamondsThisLevel = 0;
        this.sessionStartPoints = gs.totalPoints;

        this.cameras.main.setBackgroundColor('#030712');

        // Grid dimensions
        this.COLS = lvl.grid[0].length;
        this.ROWS = lvl.grid.length;

        // Center the map
        const mapW = this.COLS * this.TILE;
        const mapH = this.ROWS * this.TILE;
        this.offsetX = (this.scale.width - mapW) / 2;
        this.offsetY = (this.scale.height - mapH) / 2;

        // Auto-zoom camera to make smaller maps fill more of the screen
        const padding = 64; // empty space around the grid
        const zoomX = this.scale.width / (mapW + padding);
        const zoomY = this.scale.height / (mapH + padding);
        // Zoom in to fit, but don't zoom out (keep min zoom at 1 so large maps can scroll later if needed)
        const targetZoom = Math.max(1, Math.min(zoomX, zoomY));
        this.cameras.main.setZoom(targetZoom);

        // ── Build tile groups ──
        this.wallGroup = this.add.group();
        this.diamondGroup = this.add.group();
        this.trapGroup = this.add.group();
        this.monsterGroup = this.add.group();
        this.keyItem = null;
        this.doorItem = null;

        // ── Create ALL animations BEFORE buildMap ──
        // (buildMap calls .play() on sprites, so anims must exist first)

        // Player walk animation
        if (!this.anims.exists('player_walk')) {
            this.anims.create({
                key: 'player_walk',
                frames: [
                    { key: 'p1' },
                    { key: 'p2' },
                    { key: 'p3' },
                    { key: 'p2' }
                ],
                frameRate: 8,
                repeat: -1
            });
        }

        // Fire (Trap) animation
        if (!this.anims.exists('fire_anim')) {
            this.anims.create({
                key: 'fire_anim',
                frames: [
                    { key: 'fire1' },
                    { key: 'fire2' }
                ],
                frameRate: 6,
                repeat: -1
            });
        }

        // Key animation
        if (!this.anims.exists('key_anim')) {
            this.anims.create({
                key: 'key_anim',
                frames: [
                    { key: 'key1' },
                    { key: 'key2' },
                    { key: 'key3' },
                    { key: 'key4' },
                    { key: 'key5' }
                ],
                frameRate: 8,
                repeat: -1
            });
        }

        // Goblin animation
        if (!this.anims.exists('goblin_anim')) {
            this.anims.create({
                key: 'goblin_anim',
                frames: [
                    { key: 'gob1' },
                    { key: 'gob2' },
                    { key: 'gob3' },
                    { key: 'gob4' },
                    { key: 'gob5' }
                ],
                frameRate: 8,
                repeat: -1
            });
        }

        this.buildMap(lvl.grid, this.targetLevel);

        // ── Spawn Goblins ──
        if (lvl.goblinPositions && lvl.goblinPositions.length > 0) {
            lvl.goblinPositions.forEach(gob => {
                const gx = this.tileX(gob.c);
                const gy = this.tileY(gob.r);
                const gobSprite = this.add.sprite(gx, gy + 8, 'gob1');
                gobSprite.setDisplaySize(this.TILE * 2, this.TILE * 2);
                gobSprite.setDepth(6);
                gobSprite.play('goblin_anim');
                gobSprite.setData({
                    col: gob.c,
                    row: gob.r,
                    dir: gob.dir,       // 'h' = horizontal, 'v' = vertical
                    moveDir: 1          // 1 = forward, -1 = backward
                });
                this.monsterGroup.add(gobSprite);
            });
        }

        // ── Player ──
        const px = this.tileX(lvl.playerStart.col);
        const py = this.tileY(lvl.playerStart.row);
        this.player = this.add.sprite(px, py, 'p1');
        // Fit player exactly to tile size (1.0x) as requested
        this.player.setDisplaySize(this.TILE, this.TILE);
        this.player.setDepth(5); // Player renders below trees (depth 10)
        this.playerCol = lvl.playerStart.col;
        this.playerRow = lvl.playerStart.row;

        // Start idle (static 1.png) — animation plays only when moving
        this.playerMoving = false;

        // ── Level name (Moved to HTML HUD) ──
        window.currentLevelName = `${lvl.name}`;

        // ── Keyboard input ──
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Debounce movement
        this.moveDelay = 180;
        this.lastMove = 0;

        // ── Trap Blinking Logic ──
        this.time.addEvent({
            delay: 1500, // Toggle every 1.5 seconds
            loop: true,
            callback: () => {
                if (this.levelComplete) return;
                this.trapGroup.getChildren().forEach(t => {
                    const active = !t.getData('active');
                    t.setData('active', active);
                    t.setVisible(active);

                    if (active && this.playerCol === t.getData('col') && this.playerRow === t.getData('row')) {
                        this.hitTrap();
                    }
                });
            }
        });

        // ── Monster Patrol Logic ──
        this.time.addEvent({
            delay: 800, // Monsters move every 800ms
            loop: true,
            callback: () => {
                if (this.levelComplete) return;
                this.monsterGroup.getChildren().forEach(m => {
                    const col = m.getData('col');
                    const row = m.getData('row');
                    const dir = m.getData('dir');
                    let moveDir = m.getData('moveDir');

                    let newCol = col, newRow = row;
                    if (dir === 'h') {
                        newCol = col + moveDir;
                    } else {
                        newRow = row + moveDir;
                    }

                    // Check if new position is walkable (floor)
                    if (newRow > 0 && newRow < this.ROWS - 1 &&
                        newCol > 0 && newCol < this.COLS - 1 &&
                        this.mapGrid[newRow][newCol] !== 1 &&
                        this.mapGrid[newRow][newCol] !== 5) {
                        // Move goblin
                        m.setData('col', newCol);
                        m.setData('row', newRow);

                        // Flip sprite based on horizontal direction
                        if (dir === 'h') {
                            m.setFlipX(moveDir < 0);
                        }

                        // Animate movement
                        this.tweens.add({
                            targets: m,
                            x: this.tileX(newCol),
                            y: this.tileY(newRow),
                            duration: 400,
                            ease: 'Quad.InOut'
                        });

                        // Check if goblin landed on player
                        if (newCol === this.playerCol && newRow === this.playerRow) {
                            this.hitMonster();
                        }
                    } else {
                        // Reverse direction
                        m.setData('moveDir', moveDir * -1);
                    }
                });
            }
        });

        // ── Update HUD ──
        window.updateHUD();
    }

    // ─────────────────────────────────────────────
    buildMap(grid, level) {
        this.mapGrid = grid.map(row => [...row]); // mutable copy

        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const cell = grid[r][c];
                const x = this.tileX(c);
                const y = this.tileY(r);
                // Floor always underneath (original slate floor)
                const floorTile = this.add.image(x, y, 'floor');
                floorTile.setDisplaySize(this.TILE, this.TILE);
                if (this.tileData.themeColor !== 0xffffff) {
                    floorTile.setTint(this.tileData.themeColor);
                }

                // Randomly add a decorative tree on some floor tiles
                // We use a seeded check so it's consistent for the level
                const rng = this.mulberry32(level * 555 + r * 77 + c * 33);
                if (cell === 0 && rng() < 0.25) { // 25% chance of a tree decoration
                    const tree = this.add.image(x, y, 'tree');
                    tree.setDisplaySize(this.TILE, this.TILE);
                    tree.setDepth(10); // Trees render on top of player
                    if (this.tileData.themeColor !== 0xffffff) {
                        tree.setTint(this.tileData.themeColor);
                    }
                }

                if (cell === 1) {
                    // Wall
                    const wall = this.add.image(x, y, 'wall');
                    wall.setDisplaySize(this.TILE, this.TILE);
                    if (this.tileData.themeColor !== 0xffffff) {
                        wall.setTint(this.tileData.themeColor);
                    }
                    this.wallGroup.add(wall);
                    wall.setData({ col: c, row: r });

                } else if (cell === 2) {
                    // Coin – animate scale pulsing
                    const coinImg = this.add.image(x, y, 'coin');
                    coinImg.setDisplaySize(this.TILE * 0.8, this.TILE * 0.8);
                    this.diamondGroup.add(coinImg);
                    coinImg.setData({ col: c, row: r });

                } else if (cell === 3) {
                    // Trap – animated fire
                    const t = this.add.sprite(x, y, 'fire1');
                    t.setDisplaySize(this.TILE, this.TILE);
                    t.setData({ col: c, row: r, active: true });
                    t.play('fire_anim');
                    this.trapGroup.add(t);

                } else if (cell === 4) {
                    // Key – animated
                    this.keyItem = this.add.sprite(x, y, 'key1');
                    this.keyItem.setDisplaySize(this.TILE * 0.75, this.TILE * 0.75);
                    this.keyItem.play('key_anim');
                    this.tweens.add({ targets: this.keyItem, y: y - 4, duration: 700, yoyo: true, repeat: -1 });
                    this.keyItem.setData({ col: c, row: r });

                } else if (cell === 5) {
                    // Door (locked)
                    this.doorItem = this.add.image(x, y, 'door_locked');
                    this.doorItem.setDisplaySize(this.TILE, this.TILE); // scale to match tile
                    this.doorItem.setDepth(2);
                    this.doorItem.setData({ col: c, row: r });
                    this.doorCol = c;
                    this.doorRow = r;
                }
            }
        }
    }

    // ─────────────────────────────────────────────
    tileX(col) { return this.offsetX + col * this.TILE + this.TILE / 2; }
    tileY(row) { return this.offsetY + row * this.TILE + this.TILE / 2; }

    // ─────────────────────────────────────────────
    update(time) {
        if (this.levelComplete) return;

        const now = time;
        if (now - this.lastMove < this.moveDelay) return;

        const mi = window.mobileInput;
        let dx = 0, dy = 0;

        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || this.wasd.left.isDown || mi.left) dx = -1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || this.wasd.right.isDown || mi.right) dx = 1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || this.wasd.up.isDown || mi.up) dy = -1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || this.wasd.down.isDown || mi.down) dy = 1;

        // Mobile: use continuous press
        if (mi.left) dx = -1;
        if (mi.right) dx = 1;
        if (mi.up) dy = -1;
        if (mi.down) dy = 1;

        if (dx === 0 && dy === 0) {
            // No input — stop walking animation, show idle frame (1.png)
            if (this.playerMoving) {
                this.playerMoving = false;
                this.player.stop();
                this.player.setTexture('p1');
            }
            return;
        }

        // Start walking animation if not already playing
        if (!this.playerMoving) {
            this.playerMoving = true;
            this.player.play('player_walk');
        }

        // Flip character based on direction
        if (dx < 0) this.player.setFlipX(true);
        else if (dx > 0) this.player.setFlipX(false);

        const newCol = this.playerCol + dx;
        const newRow = this.playerRow + dy;

        this.lastMove = now;
        this.tryMove(newCol, newRow);
    }

    // ─────────────────────────────────────────────
    tryMove(newCol, newRow) {
        const gs = window.gameState;

        // Bounds check
        if (newRow < 0 || newRow >= this.ROWS || newCol < 0 || newCol >= this.COLS) return;

        const cell = this.mapGrid[newRow][newCol];

        // Wall blocked
        if (cell === 1) {
            this.cameras.main.shake(80, 0.003);
            return;
        }

        // Door locked
        if (newCol === this.doorCol && newRow === this.doorRow && !this.hasKey) {
            window.showToast('🔑 Find the KEY first!', '#f59e0b', 1500);
            this.cameras.main.shake(80, 0.003);
            return;
        }

        // Move player
        this.playerCol = newCol;
        this.playerRow = newRow;
        const nx = this.tileX(newCol);
        const ny = this.tileY(newRow);

        this.tweens.add({
            targets: this.player,
            x: nx, y: ny,
            duration: this.moveDelay - 20,
            ease: 'Quad.Out'
        });

        // ── Check what's at target ──

        // DIAMOND
        if (cell === 2) {
            this.mapGrid[newRow][newCol] = 0;
            this.collectDiamond(newCol, newRow);
        }

        // TRAP
        if (cell === 3) {
            const trap = this.trapGroup.getChildren().find(t => t.getData('col') === newCol && t.getData('row') === newRow);
            if (trap && trap.getData('active')) {
                this.hitTrap();
            }
        }

        // KEY
        if (this.keyItem && newCol === this.keyItem.getData('col') && newRow === this.keyItem.getData('row')) {
            this.collectKey();
        }

        // DOOR (with key)
        if (newCol === this.doorCol && newRow === this.doorRow && this.hasKey) {
            this.completeLevel();
        }

        // MONSTER collision check
        this.monsterGroup.getChildren().forEach(m => {
            if (m.getData('col') === newCol && m.getData('row') === newRow) {
                this.hitMonster();
            }
        });
    }

    // ─────────────────────────────────────────────
    collectDiamond(col, row) {
        const gs = window.gameState;

        // Remove coin image
        this.diamondGroup.getChildren().forEach(d => {
            if (d.getData('col') === col && d.getData('row') === row) {
                // Burst particles
                this.spawnParticles(d.x, d.y, 0xf59e0b); // Gold color for coin
                d.destroy();
            }
        });

        this.diamondsThisLevel++;
        gs.totalDiamonds++;
        gs.totalPoints += this.tileData.pointsPerDiamond;
        window.updateHUD();
        window.showToast(`+${this.tileData.pointsPerDiamond} pts 🪙`, '#f59e0b', 800);
    }

    collectKey() {
        this.hasKey = true;
        this.spawnParticles(this.keyItem.x, this.keyItem.y, 0xf59e0b);
        this.keyItem.destroy();
        this.keyItem = null;
        // Unlock door visually
        if (this.doorItem) {
            this.doorItem.setTexture('door_open');
            this.tweens.add({ targets: this.doorItem, scaleX: 1.1, scaleY: 1.1, duration: 200, yoyo: true });
        }
        window.showToast('🔑 KEY collected! Door unlocked!', '#f59e0b', 2000);
        this.cameras.main.flash(200, 245, 158, 11, false);
    }

    hitTrap() {
        if (this.levelComplete) return;
        const gs = window.gameState;
        gs.lives--;
        window.updateHUD();
        this.cameras.main.shake(300, 0.01);
        this.cameras.main.flash(300, 239, 68, 68, false);
        window.showToast('⚡ TRAP! -1 Life', '#ef4444', 1500);

        // Flash player red
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: () => { this.player.setAlpha(1); }
        });

        if (gs.lives <= 0) {
            this.levelComplete = true; // prevent multiple triggers
            this.time.delayedCall(600, () => this.gameOver());
        }
    }

    hitMonster() {
        if (this.levelComplete) return;
        const gs = window.gameState;
        gs.lives--;
        window.updateHUD();
        this.cameras.main.shake(300, 0.012);
        this.cameras.main.flash(300, 168, 85, 247, false);
        window.showToast('👹 MONSTER! -1 Life', '#a855f7', 1500);

        // Flash player
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: () => { this.player.setAlpha(1); }
        });

        if (gs.lives <= 0) {
            this.levelComplete = true;
            this.time.delayedCall(600, () => this.gameOver());
        }
    }

    completeLevel() {
        if (this.levelComplete) return;
        this.levelComplete = true;

        const gs = window.gameState;
        const playedLevel = gs.currentLevel; // store exact level played
        const bonus = this.tileData.levelCompleteBonus;
        gs.totalPoints += bonus;
        gs.sessionPoints = gs.totalPoints - this.sessionStartPoints;
        window.updateHUD();

        // Flash screen green
        this.cameras.main.flash(500, 34, 197, 94, false);
        window.showToast(`🏆 LEVEL COMPLETE! +${bonus} pts`, '#22c55e', 2000);

        // Submit score to backend
        window.submitScore(
            gs.totalPoints - this.sessionStartPoints,
            playedLevel + 1, // Report next level reached
            this.diamondsThisLevel
        );

        this.time.delayedCall(2000, () => {
            this.scene.start('ResultScene', {
                diamonds: this.diamondsThisLevel,
                totalDiamonds: this.tileData.totalDiamonds,
                pointsEarned: bonus + this.diamondsThisLevel * this.tileData.pointsPerDiamond,
                totalPoints: gs.totalPoints,
                level: playedLevel,
                won: true
            });
        });
    }

    gameOver() {
        const gs = window.gameState;
        gs.lives = 0;
        const playedLevel = gs.currentLevel; // store exact level played

        window.showToast('💀 GAME OVER', '#ef4444', 2000);
        this.cameras.main.flash(500, 239, 68, 68, false);

        this.time.delayedCall(2000, () => {
            this.scene.start('ResultScene', {
                diamonds: this.diamondsThisLevel,
                totalDiamonds: this.tileData.totalDiamonds,
                pointsEarned: this.diamondsThisLevel * this.tileData.pointsPerDiamond,
                totalPoints: gs.totalPoints,
                level: playedLevel,
                won: false
            });
        });
    }

    // ─────────────────────────────────────────────
    spawnParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const p = this.add.circle(x, y, 3, color, 1);
            const angle = (i / 8) * Math.PI * 2;
            const dist = Phaser.Math.Between(20, 40);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scale: 0,
                duration: 400,
                ease: 'Quad.Out',
                onComplete: () => p.destroy()
            });
        }
    }
}
