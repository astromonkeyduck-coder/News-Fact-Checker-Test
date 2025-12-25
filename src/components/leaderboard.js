// Use global logger (exposed by logger.js)
// If logger is not available, fall back to console with a guard
// Use window.logger if available, otherwise create a fallback
if (typeof window.logger !== 'undefined') {
    // Use existing global logger
    var logger = window.logger;
} else {
    // Create fallback logger
    var logger = {
        debug: (...args) => console.log('[Leaderboard]', ...args),
        error: (...args) => console.error('[Leaderboard]', ...args),
        warn: (...args) => console.warn('[Leaderboard]', ...args),
        log: (...args) => console.log('[Leaderboard]', ...args)
    };
}

class Leaderboard {
    constructor(gameType = 'fact-checker') {
        this.gameType = gameType;
        this.scores = [];
        this.isOpen = false;
        this.realtimeComponent = null;
        this.userId = null;
        this.enableRealtime = true; // Can be disabled if WebSocket not available
        this.lastLoadTime = 0;
        this.loadThrottleMs = 1000; // Minimum 1 second between loads to prevent request storms
        this.isLoading = false;
    }

    async init() {
        await this.loadScores();
        this.render();
        
        // Initialize real-time updates if available (after render so container exists)
        if (this.enableRealtime) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                this.initRealtime();
            }, 100);
        }
    }
    
    /**
     * Initialize real-time leaderboard component
     */
    async initRealtime() {
        try {
            // Try to get userId from localStorage or generate one
            this.userId = this.getUserId();
            
            // Dynamically import real-time component
            const { default: RealtimeLeaderboardComponent } = await import('./leaderboard-realtime.js');
            
            // Find container for real-time updates (wait for render if needed)
            // We'll initialize after the first render
            // The realtime component will enhance the existing leaderboard display
            const listContainer = document.getElementById('leaderboardList');
            if (listContainer) {
                this.realtimeComponent = new RealtimeLeaderboardComponent(
                    listContainer,
                    this.userId,
                    this.gameType,
                    {
                        showPresence: true,
                        showMetrics: true,
                        limit: 10
                    }
                );
                
                // Update real-time component when scores load
                this.realtimeComponent.updateLeaderboard(this.scores);
            } else {
                // Container doesn't exist yet, will be created on render
                // We'll initialize after render is called
                logger.debug('[Leaderboard] Container not found yet, will initialize after render');
            }
        } catch (error) {
            logger.debug('Real-time updates not available:', error.message);
            this.enableRealtime = false;
        }
    }
    
    /**
     * Get or generate user ID
     */
    getUserId() {
        try {
            let userId = localStorage.getItem('noteworthy_user_id');
            if (!userId) {
                userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                localStorage.setItem('noteworthy_user_id', userId);
            }
            return userId;
        } catch (error) {
            // Fallback if localStorage not available
            return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
    }

    async loadScores(limit = 10) {
        // Throttle rapid requests to prevent triggering bot protection
        const now = Date.now();
        if (this.isLoading) {
            logger.debug('[Leaderboard] Load already in progress, skipping');
            return;
        }
        if (now - this.lastLoadTime < this.loadThrottleMs) {
            logger.debug('[Leaderboard] Request throttled, too soon since last load');
            return;
        }
        
        this.isLoading = true;
        this.lastLoadTime = now;
        
        try {
            logger.debug(`[Leaderboard] Loading scores for ${this.gameType}, limit: ${limit}`);
            const response = await fetch(`/.netlify/functions/leaderboard?gameType=${this.gameType}&limit=${limit}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`[Leaderboard] Failed to load scores: ${response.status} ${response.statusText}`, errorText);
                this.scores = [];
                return;
            }
            
                const data = await response.json();
            logger.debug(`[Leaderboard] Loaded ${data.scores?.length || 0} scores`, data);
                this.scores = data.scores || [];
                
                // Update real-time component if available
                if (this.realtimeComponent) {
                    this.realtimeComponent.updateLeaderboard(this.scores);
                }
        } catch (error) {
            logger.error('Failed to load scores:', error);
            this.scores = [];
        } finally {
            this.isLoading = false;
        }
    }

    async submitScore(scoreData) {
        try {
            logger.debug('[Leaderboard] Submitting score:', scoreData);
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
                logger.error(`[Leaderboard] Failed to submit score: ${response.status} ${response.statusText}`, errorText);
                return false;
            }

            const result = await response.json();
            logger.debug('[Leaderboard] Score submitted successfully:', result);
                await this.loadScores();
                this.render();
                
                // Update real-time component if available
                if (this.realtimeComponent) {
                    this.realtimeComponent.updateLeaderboard(this.scores);
                }
                
                return true;
        } catch (error) {
            logger.error('Failed to submit score:', error);
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

        // Determine game name based on gameType
        let gameName = 'Game';
        if (this.gameType === 'fact-checker') {
            gameName = 'Fact Checker';
        } else if (this.gameType.startsWith('geography-')) {
            const mode = this.gameType.replace('geography-', '');
            const modeNames = {
                'classic': 'Classic',
                'hard': 'Hard',
                'typing': 'Typing'
            };
            gameName = `Geography - ${modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1)}`;
        } else if (this.gameType === 'geography') {
            gameName = 'Geography';
        }

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
            
            // Format time for geography game
            let timeDisplay = '';
            if (this.gameType === 'geography' && score.time) {
                const minutes = Math.floor(score.time / 60000);
                const seconds = Math.floor((score.time % 60000) / 1000);
                timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else if (this.gameType === 'geography' && score.timeString) {
                timeDisplay = score.timeString;
            }
            
            // Format accuracy for geography game
            let accuracyDisplay = '';
            if (this.gameType === 'geography' && score.accuracy !== undefined) {
                accuracyDisplay = `${score.accuracy}%`;
            } else if (this.gameType === 'geography' && score.correct !== undefined && score.wrong !== undefined) {
                const total = score.correct + score.wrong;
                const accuracy = total > 0 ? Math.round((score.correct / total) * 100) : 0;
                accuracyDisplay = `${accuracy}%`;
            }
            
            // Perfect game badge
            const perfectBadge = (this.gameType === 'geography' && score.isPerfectGame) 
                ? '<span class="perfect-game-badge" title="Perfect Game - All 50 countries correct on first attempt!">Perfect</span>' 
                : '';
            
            return `
                <div class="leaderboard-item ${rank <= 3 ? 'top-three' : ''} ${score.isPerfectGame ? 'perfect-game' : ''}">
                    <div class="leaderboard-rank">${medal}</div>
                    <div class="leaderboard-user">
                        <div class="leaderboard-name">
                            ${this.escapeHtml(score.userName)}
                            ${perfectBadge}
                        </div>
                        <div class="leaderboard-meta">
                            ${this.gameType === 'geography' ? (
                                `${timeDisplay ? `⏱️ ${timeDisplay}` : ''}${timeDisplay && accuracyDisplay ? ' | ' : ''}${accuracyDisplay ? `🎯 ${accuracyDisplay}` : ''}`
                            ) : (
                                `${score.difficulty ? `Difficulty: ${score.difficulty}` : ''}${score.difficulty && score.level ? ' | ' : ''}${score.level ? `Level: ${score.level}` : ''}${(score.difficulty || score.level) && score.streak ? ' | ' : ''}${score.streak ? `Streak: ${score.streak}` : ''}`
                            )}
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
            logger.debug('[Leaderboard] Container not found, rendering first...');
            this.render();
            container = document.getElementById('leaderboard-container');
        }
        
        if (container) {
            logger.debug('[Leaderboard] Showing leaderboard, scores:', this.scores.length);
            container.style.display = 'flex';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            
            // Ensure modal is visible
            const modal = document.getElementById('leaderboardModal');
            if (modal) {
                modal.style.display = 'block';
                modal.style.visibility = 'visible';
            } else {
                logger.warn('[Leaderboard] Modal not found, re-rendering...');
                this.render();
            }
        } else {
            logger.error('[Leaderboard] Container still not found after render!');
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

