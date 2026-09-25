// =============================================
// MenuScene.js – Delegates to HTML Menu
// =============================================
// The menu UI is now rendered in HTML/CSS inside game.html
// for a sharp, web3 look. This scene simply shows the HTML
// overlay and pauses the Phaser lifecycle.

class MenuScene extends Phaser.Scene {
    constructor() { super({ key: 'MenuScene' }); }

    create() {
        // Show the HTML menu overlay
        if (window.showHTMLMenuFromPhaser) {
            window.showHTMLMenuFromPhaser();
        }

        // Hide the canvas container so the clean HTML menu shows
        const gc = document.getElementById('gameContainer');
        if (gc) gc.style.display = 'none';

        const hud = document.getElementById('hud');
        if (hud) hud.classList.remove('visible');
    }
}
