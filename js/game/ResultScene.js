// =============================================
// ResultScene.js – Delegates to HTML Result Screen
// =============================================

class ResultScene extends Phaser.Scene {
    constructor() { super({ key: 'ResultScene' }); }

    init(data) {
        this.resultData = data;
    }

    create() {
        // Show the HTML Result overlay
        if (window.showHTMLResult) {
            window.showHTMLResult(this.resultData);
        }

        // Hide the canvas container so the clean HTML menu shows
        const gc = document.getElementById('gameContainer');
        if (gc) gc.style.display = 'none';

        const hud = document.getElementById('hud');
        if (hud) hud.classList.remove('visible');
    }
}
