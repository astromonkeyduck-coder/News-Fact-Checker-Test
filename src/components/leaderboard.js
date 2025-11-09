class Leaderboard {
    constructor(gameType = 'fact-checker') {
        this.gameType = gameType;
        this.scores = [];
        this.isOpen = false;
    }

    async init() {
        await this.loadScores();
        this.render();
    }

    async loadScores(limit = 10) {
        try {
            console.log(`[Leaderboard] Loading scores for ${this.gameType}, limit: ${limit}`);
            const response = await fetch(`/.netlify/functions/leaderboard?gameType=${this.gameType}&limit=${limit}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Leaderboard] Failed to load scores: ${response.status} ${response.statusText}`, errorText);
                this.scores = [];
                return;
            }
            
            const data = await response.json();
            console.log(`[Leaderboard] Loaded ${data.scores?.length || 0} scores`, data);
            this.scores = data.scores || [];
        } catch (error) {
            console.error('[Leaderboard] Failed to load scores:', error);
            this.scores = [];
        }
    }

    async submitScore(scoreData) {
        try {
            console.log('[Leaderboard] Submitting score:', scoreData);
            const response = await fetch('/.netlify/functions/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...scoreData,
                    gameType: this.gameType,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Leaderboard] Failed to submit score: ${response.status} ${response.statusText}`, errorText);
                return false;
            }

            const result = await response.json();
            console.log('[Leaderboard] Score submitted successfully:', result);
            await this.loadScores();
            this.render();
            return true;
        } catch (error) {
            console.error('[Leaderboard] Failed to submit score:', error);
            return false;
        }
    }

    render() {
        let container = document.getElementById('leaderboard-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'leaderboard-container';
            container.className = 'leaderboard-container';
            document.body.appendChild(container);
        }

        const gameName = this.gameType === 'fact-checker' 
            ? 'Fact Checker' 
            : 'Geography';

        container.innerHTML = `
            <div class="leaderboard-modal" id="leaderboardModal">
                <div class="leaderboard-content">
                    <div class="leaderboard-header">
                        <h2>🏆 ${gameName} Leaderboard</h2>
                        <button class="leaderboard-close" id="leaderboardClose">×</button>
                    </div>
                    <div class="leaderboard-list" id="leaderboardList">
                        ${this.renderScores()}
                    </div>
                    ${this.renderSignInPrompt()}
                </div>
            </div>
        `;

        // Bind close button
        const closeBtn = document.getElementById('leaderboardClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Close on outside click
        const modal = document.getElementById('leaderboardModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide();
                }
            });
        }
        
        // Update sign-in prompt visibility
        this.updateSignInPrompt();
    }

    renderScores() {
        if (this.scores.length === 0) {
            return '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
        }

        return this.scores.map((score, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            return `
                <div class="leaderboard-item ${rank <= 3 ? 'top-three' : ''}">
                    <div class="leaderboard-rank">${medal}</div>
                    <div class="leaderboard-user">
                        <div class="leaderboard-name">${this.escapeHtml(score.userName)}</div>
                        <div class="leaderboard-meta">
                            ${score.difficulty ? `Difficulty: ${score.difficulty}` : ''}
                            ${score.level ? ` | Level: ${score.level}` : ''}
                            ${score.streak ? ` | Streak: ${score.streak}` : ''}
                        </div>
                    </div>
                    <div class="leaderboard-score">${score.score.toLocaleString()}</div>
                </div>
            `;
        }).join('');
    }

    renderSignInPrompt() {
        // No sign-in prompt needed - leaderboard is open to everyone
        return '';
    }
    
    async updateSignInPrompt() {
        // No sign-in prompt to update
    }

    show() {
        this.isOpen = true;
        
        // Ensure container exists - if not, render it first
        let container = document.getElementById('leaderboard-container');
        if (!container) {
            console.log('[Leaderboard] Container not found, rendering first...');
            this.render();
            container = document.getElementById('leaderboard-container');
        }
        
        if (container) {
            console.log('[Leaderboard] Showing leaderboard, scores:', this.scores.length);
            container.style.display = 'flex';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            
            // Ensure modal is visible
            const modal = document.getElementById('leaderboardModal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
            } else {
                console.warn('[Leaderboard] Modal not found, re-rendering...');
                this.render();
            }
        } else {
            console.error('[Leaderboard] Container still not found after render!');
        }
    }

    hide() {
        this.isOpen = false;
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make it globally available
window.Leaderboard = Leaderboard;

