/**
 * ==========================================================================
 * ACHIEVEMENTS SYSTEM - Gamification for News Engagement
 * Noteworthy News - Beast Mode
 * ==========================================================================
 * 
 * Tracks user achievements and displays unlockable badges.
 * Stores progress in localStorage and syncs with server when possible.
 * 
 * ==========================================================================
 */

class AchievementsSystem {
  constructor() {
    this.achievements = [
      // Visitor Achievements
      { id: 'first_visit', name: 'First Steps', description: 'Visit Noteworthy News for the first time', icon: '👋', category: 'visitor', points: 10 },
      { id: 'return_visitor', name: 'Welcome Back', description: 'Return to the site after your first visit', icon: '🔄', category: 'visitor', points: 15 },
      { id: 'night_owl', name: 'Night Owl', description: 'Read news between midnight and 5 AM', icon: '🦉', category: 'visitor', points: 25 },
      { id: 'early_bird', name: 'Early Bird', description: 'Read news between 5 AM and 7 AM', icon: '🐦', category: 'visitor', points: 25 },
      
      // Streak Achievements
      { id: 'streak_3', name: 'Getting Started', description: 'Maintain a 3-day reading streak', icon: '🔥', category: 'streak', points: 30 },
      { id: 'streak_7', name: 'Weekly Reader', description: 'Maintain a 7-day reading streak', icon: '📅', category: 'streak', points: 50 },
      { id: 'streak_30', name: 'Dedicated', description: 'Maintain a 30-day reading streak', icon: '💪', category: 'streak', points: 100 },
      { id: 'streak_100', name: 'News Veteran', description: 'Maintain a 100-day reading streak', icon: '🏆', category: 'streak', points: 500 },
      
      // Reading Achievements
      { id: 'articles_5', name: 'Curious Mind', description: 'Read 5 articles', icon: '📰', category: 'reading', points: 20 },
      { id: 'articles_25', name: 'Informed Citizen', description: 'Read 25 articles', icon: '📚', category: 'reading', points: 50 },
      { id: 'articles_100', name: 'News Junkie', description: 'Read 100 articles', icon: '🎓', category: 'reading', points: 150 },
      { id: 'articles_500', name: 'Encyclopedia', description: 'Read 500 articles', icon: '📖', category: 'reading', points: 500 },
      
      // Category Achievements
      { id: 'category_all', name: 'Well-Rounded', description: 'Read articles from 5 different categories', icon: '🌐', category: 'variety', points: 75 },
      { id: 'breaking_10', name: 'Breaking News Buff', description: 'Read 10 breaking news stories', icon: '⚡', category: 'variety', points: 50 },
      
      // Game Achievements
      { id: 'game_first', name: 'Fact Checker', description: 'Play the Fact Checker game for the first time', icon: '🎮', category: 'game', points: 20 },
      { id: 'game_perfect', name: 'Perfect Score', description: 'Get a perfect score in Fact Checker', icon: '💯', category: 'game', points: 100 },
      { id: 'game_streak_5', name: 'Sharp Mind', description: 'Get 5 correct answers in a row', icon: '🧠', category: 'game', points: 40 },
      { id: 'leaderboard_top10', name: 'Top 10', description: 'Reach the top 10 on the leaderboard', icon: '🥇', category: 'game', points: 200 },
      
      // Command Center Achievements
      { id: 'command_center', name: 'Mission Control', description: 'Enter the Command Center for the first time', icon: '🚀', category: 'special', points: 30 },
      { id: 'voice_command', name: 'Voice Activated', description: 'Use a voice command', icon: '🎤', category: 'special', points: 25 },
      { id: 'daily_briefing', name: 'Briefed', description: 'Listen to your first daily briefing', icon: '📋', category: 'special', points: 35 },
      { id: 'globe_explorer', name: 'Globe Trotter', description: 'Click on 5 different locations on the news globe', icon: '🌍', category: 'special', points: 40 },
      
      // Social Achievements
      { id: 'share_first', name: 'Spreader of Truth', description: 'Share your first article', icon: '📤', category: 'social', points: 20 },
      { id: 'share_10', name: 'News Ambassador', description: 'Share 10 articles', icon: '📣', category: 'social', points: 75 },
    ];
    
    this.unlockedAchievements = new Set();
    this.stats = {
      articlesRead: 0,
      categoriesRead: new Set(),
      breakingRead: 0,
      gamesPlayed: 0,
      perfectScores: 0,
      currentGameStreak: 0,
      globeLocationsClicked: 0,
      articlesShared: 0,
      commandCenterOpened: false,
      voiceUsed: false,
      briefingPlayed: false,
      firstVisit: null,
      lastVisit: null,
      currentStreak: 0
    };
    
    this.load();
    this.checkTimeBasedAchievements();
  }
  
  /**
   * Load progress from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem('nw_achievements');
      if (saved) {
        const data = JSON.parse(saved);
        this.unlockedAchievements = new Set(data.unlocked || []);
        this.stats = { ...this.stats, ...data.stats };
        
        // Convert Set from array
        if (data.stats?.categoriesRead) {
          this.stats.categoriesRead = new Set(data.stats.categoriesRead);
        }
      }
    } catch (e) {
      console.error('[Achievements] Failed to load:', e);
    }
  }
  
  /**
   * Save progress to localStorage
   */
  save() {
    try {
      const data = {
        unlocked: Array.from(this.unlockedAchievements),
        stats: {
          ...this.stats,
          categoriesRead: Array.from(this.stats.categoriesRead)
        }
      };
      localStorage.setItem('nw_achievements', JSON.stringify(data));
    } catch (e) {
      console.error('[Achievements] Failed to save:', e);
    }
  }
  
  /**
   * Check and unlock an achievement
   */
  unlock(achievementId) {
    if (this.unlockedAchievements.has(achievementId)) {
      return false; // Already unlocked
    }
    
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement) return false;
    
    this.unlockedAchievements.add(achievementId);
    this.save();
    this.showUnlockNotification(achievement);
    
    console.log(`[Achievement] Unlocked: ${achievement.name}`);
    return true;
  }
  
  /**
   * Show achievement unlock notification
   */
  showUnlockNotification(achievement) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-notification-icon">${achievement.icon}</div>
      <div class="achievement-notification-content">
        <div class="achievement-notification-title">Achievement Unlocked!</div>
        <div class="achievement-notification-name">${achievement.name}</div>
        <div class="achievement-notification-desc">${achievement.description}</div>
        <div class="achievement-notification-points">+${achievement.points} XP</div>
      </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('achievement-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'achievement-notification-styles';
      styles.textContent = `
        .achievement-notification {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.95), rgba(59, 130, 246, 0.95));
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(6, 182, 212, 0.4), 0 0 80px rgba(6, 182, 212, 0.2);
          z-index: 100000;
          opacity: 0;
          animation: achievementSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     achievementSlideOut 0.5s ease-in 4s forwards;
        }
        
        @keyframes achievementSlideIn {
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        @keyframes achievementSlideOut {
          to { transform: translateX(-50%) translateY(100px); opacity: 0; }
        }
        
        .achievement-notification-icon {
          font-size: 2.5rem;
          animation: achievementBounce 0.6s ease-out 0.3s;
        }
        
        @keyframes achievementBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
        
        .achievement-notification-content {
          color: white;
        }
        
        .achievement-notification-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.9;
          margin-bottom: 0.25rem;
        }
        
        .achievement-notification-name {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }
        
        .achievement-notification-desc {
          font-size: 0.875rem;
          opacity: 0.9;
        }
        
        .achievement-notification-points {
          font-size: 0.875rem;
          font-weight: 600;
          margin-top: 0.5rem;
          color: #fef08a;
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Play sound effect
    this.playUnlockSound();
    
    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
  
  /**
   * Play unlock sound
   */
  playUnlockSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a pleasant chime sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
      oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.2); // E6
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not supported
    }
  }
  
  /**
   * Check time-based achievements
   */
  checkTimeBasedAchievements() {
    const hour = new Date().getHours();
    
    // Night owl (midnight - 5 AM)
    if (hour >= 0 && hour < 5) {
      this.unlock('night_owl');
    }
    
    // Early bird (5 AM - 7 AM)
    if (hour >= 5 && hour < 7) {
      this.unlock('early_bird');
    }
    
    // First visit check
    if (!this.stats.firstVisit) {
      this.stats.firstVisit = Date.now();
      this.unlock('first_visit');
      this.save();
    } else if (!this.unlockedAchievements.has('return_visitor')) {
      // Return visitor (came back after first visit)
      const hoursSinceFirst = (Date.now() - this.stats.firstVisit) / (1000 * 60 * 60);
      if (hoursSinceFirst > 1) {
        this.unlock('return_visitor');
      }
    }
    
    this.stats.lastVisit = Date.now();
    this.save();
  }
  
  /**
   * Track article read
   */
  trackArticleRead(article) {
    this.stats.articlesRead++;
    
    // Track category
    if (article.category) {
      this.stats.categoriesRead.add(article.category);
    }
    
    // Track breaking news
    if (article.isBreaking) {
      this.stats.breakingRead++;
    }
    
    // Check reading achievements
    if (this.stats.articlesRead >= 5) this.unlock('articles_5');
    if (this.stats.articlesRead >= 25) this.unlock('articles_25');
    if (this.stats.articlesRead >= 100) this.unlock('articles_100');
    if (this.stats.articlesRead >= 500) this.unlock('articles_500');
    
    // Category variety
    if (this.stats.categoriesRead.size >= 5) this.unlock('category_all');
    
    // Breaking news
    if (this.stats.breakingRead >= 10) this.unlock('breaking_10');
    
    this.save();
  }
  
  /**
   * Track streak
   */
  trackStreak(currentStreak) {
    this.stats.currentStreak = currentStreak;
    
    if (currentStreak >= 3) this.unlock('streak_3');
    if (currentStreak >= 7) this.unlock('streak_7');
    if (currentStreak >= 30) this.unlock('streak_30');
    if (currentStreak >= 100) this.unlock('streak_100');
    
    this.save();
  }
  
  /**
   * Track game played
   */
  trackGamePlayed(score, maxScore, correctStreak) {
    this.stats.gamesPlayed++;
    
    this.unlock('game_first');
    
    if (score === maxScore) {
      this.stats.perfectScores++;
      this.unlock('game_perfect');
    }
    
    if (correctStreak >= 5) {
      this.unlock('game_streak_5');
    }
    
    this.save();
  }
  
  /**
   * Track leaderboard position
   */
  trackLeaderboardPosition(position) {
    if (position <= 10) {
      this.unlock('leaderboard_top10');
    }
  }
  
  /**
   * Track Command Center actions
   */
  trackCommandCenterOpened() {
    if (!this.stats.commandCenterOpened) {
      this.stats.commandCenterOpened = true;
      this.unlock('command_center');
      this.save();
    }
  }
  
  trackVoiceUsed() {
    if (!this.stats.voiceUsed) {
      this.stats.voiceUsed = true;
      this.unlock('voice_command');
      this.save();
    }
  }
  
  trackBriefingPlayed() {
    if (!this.stats.briefingPlayed) {
      this.stats.briefingPlayed = true;
      this.unlock('daily_briefing');
      this.save();
    }
  }
  
  trackGlobeClick() {
    this.stats.globeLocationsClicked++;
    if (this.stats.globeLocationsClicked >= 5) {
      this.unlock('globe_explorer');
    }
    this.save();
  }
  
  /**
   * Track sharing
   */
  trackShare() {
    this.stats.articlesShared++;
    
    this.unlock('share_first');
    if (this.stats.articlesShared >= 10) {
      this.unlock('share_10');
    }
    
    this.save();
  }
  
  /**
   * Get all achievements with unlock status
   */
  getAllAchievements() {
    return this.achievements.map(a => ({
      ...a,
      unlocked: this.unlockedAchievements.has(a.id)
    }));
  }
  
  /**
   * Get total XP
   */
  getTotalXP() {
    let xp = 0;
    for (const id of this.unlockedAchievements) {
      const achievement = this.achievements.find(a => a.id === id);
      if (achievement) xp += achievement.points;
    }
    return xp;
  }
  
  /**
   * Get completion percentage
   */
  getCompletionPercentage() {
    return Math.round((this.unlockedAchievements.size / this.achievements.length) * 100);
  }
  
  /**
   * Render achievements grid for Command Center
   */
  renderAchievementsGrid() {
    const achievements = this.getAllAchievements();
    
    return achievements.map(a => `
      <div class="cc-achievement ${a.unlocked ? 'unlocked' : 'locked'}" 
           title="${a.name}: ${a.description}${a.unlocked ? ' (Unlocked!)' : ''}">
        <span class="cc-achievement-icon">${a.icon}</span>
      </div>
    `).join('');
  }
}

// Create global instance
window.Achievements = new AchievementsSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AchievementsSystem;
}
