// Noteworthy News - Professional News Website with Integrated Game
// This script handles both the professional header functionality and the game

// Constants for configuration
const CONFIG = {
    // Animation timing
    ANIMATION_DELAYS: {
        INITIAL_DELAY: 1000,
        TEXT_CYCLE_DELAY: 150,
        FINAL_TRANSITION_DELAY: 800,
        SPARKLE_DELAY: 200,
        SPARKLE_DURATION: 1500,
        SPARKLE_CONTAINER_DURATION: 3000,
        WINK_EFFECT_DURATION: 6000,
        ANIMATION_RESET_DELAY: 8000
    },
    
    // Performance thresholds
    PERFORMANCE: {
        MIN_SWIPE_DISTANCE: 50,
        MIN_DRAG_DISTANCE: 60,
        WHEEL_THRESHOLD: 5,
        SWIPE_THRESHOLD: 50,
        WHEEL_TIMEOUT: 100
    },
    
    // Animation speeds
    ANIMATION_SPEEDS: {
        START_SPEED: 800,
        MIN_SPEED: 150,
        ACCELERATION_FACTOR: 0.75
    },
    
    // Particle and effect counts
    EFFECTS: {
        PARTICLE_COUNT: 50,
        SPARKLE_COUNT: 8,
        MATRIX_COLUMN_WIDTH: 20
    }
};

// Swoosh Sound Effects for Welcome Animation
function playSwoosh(swooshId) {
    try {
        // Create Web Audio API context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create noise buffer for realistic wind swoosh
        const bufferSize = audioContext.sampleRate * 0.8; // 800ms buffer
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        // Generate filtered noise for wind effect
        for (let i = 0; i < bufferSize; i++) {
            // Create wind-like noise with varying intensity
            const time = i / bufferSize;
            const windIntensity = Math.sin(time * Math.PI * 2) * 0.2 + 0.8;
            // Make it more squishy and soft
            const squishyNoise = (Math.random() * 2 - 1) * 0.4;
            const smoothNoise = (Math.random() * 2 - 1) * 0.3;
            output[i] = (squishyNoise + smoothNoise) * windIntensity * 0.5;
        }
        
        // Create audio source and processing nodes
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        const lowpassFilter = audioContext.createBiquadFilter();
        const highpassFilter = audioContext.createBiquadFilter();
        const notchFilter = audioContext.createBiquadFilter();
        
        // Configure swoosh sound based on ID
        let duration, volume;
        switch(swooshId) {
            case 'swoosh1':
                duration = 0.6; // Quick swoosh for text changes
                volume = 0.4;
                break;
            case 'swoosh2':
                duration = 0.8; // Medium swoosh for final transition
                volume = 0.5;
                break;
            default:
                duration = 0.7;
                volume = 0.45;
        }
        
        // High-pass filter to remove low rumble (wind doesn't have bass)
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.setValueAtTime(150, audioContext.currentTime);
        highpassFilter.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + duration);
        highpassFilter.Q.setValueAtTime(0.3, audioContext.currentTime);
        
        // Low-pass filter to smooth the wind and remove harsh highs
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.setValueAtTime(2500, audioContext.currentTime);
        lowpassFilter.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + duration);
        lowpassFilter.Q.setValueAtTime(0.2, audioContext.currentTime);
        
        // Notch filter to remove specific harsh frequencies
        notchFilter.type = 'notch';
        notchFilter.frequency.setValueAtTime(1200, audioContext.currentTime);
        notchFilter.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + duration);
        notchFilter.Q.setValueAtTime(0.5, audioContext.currentTime);
        
        // Set gain (volume) with squishy, smooth wind fade
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.2);
        gainNode.gain.linearRampToValueAtTime(volume * 0.95, audioContext.currentTime + duration * 0.5);
        gainNode.gain.linearRampToValueAtTime(volume * 0.8, audioContext.currentTime + duration * 0.8);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        // Connect the audio chain: source -> highpass -> lowpass -> notch -> gain -> output
        source.buffer = buffer;
        source.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(notchFilter);
        notchFilter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start the wind swoosh
        source.start(audioContext.currentTime);
        source.stop(audioContext.currentTime + duration);
        
        // Clean up
        setTimeout(() => {
            source.disconnect();
            highpassFilter.disconnect();
            lowpassFilter.disconnect();
            notchFilter.disconnect();
            gainNode.disconnect();
        }, duration * 1000 + 100);
        
    } catch (error) {
        console.log('Swoosh sound error:', error);
    }
}

// Puzzle Piece Connection Sound Effect
function playPuzzlePiece() {
    try {
        console.log('Creating puzzle piece sound...');
        
        // Create Web Audio API context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context if it's suspended (needed for autoplay policies)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed');
            });
        }
        
        // Simplified puzzle piece sound - just one oscillator for now
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Configure puzzle piece sound
        const duration = 0.5; // Longer for better audibility
        const volume = 1.0; // Maximum volume
        
        // Main tone - satisfying puzzle piece frequency
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + duration);
        
        // Volume envelope - quick attack, satisfying decay
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(volume * 0.8, audioContext.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        // Connect the audio chain
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start the oscillator
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
        
        console.log('Puzzle piece sound started successfully!');
        
        // Clean up
        setTimeout(() => {
            oscillator.disconnect();
            gainNode.disconnect();
        }, duration * 1000 + 100);
        
    } catch (error) {
        console.log('Puzzle piece sound error:', error);
    }
}

// Authentication System - All features are open to everyone
// AuthSystem class removed - no authentication required

// News Navigation System
class NewsNavigation {
    constructor() {
        this.currentSection = "news";
        this.init();
    }

    init() {
        this.bindNavigationEvents();
        this.updateActiveSection();
    }

    bindNavigationEvents() {
        const navLinks = document.querySelectorAll(".nav-link");
        
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                const href = link.getAttribute("href");
                
                // Check for external links (http/https) - allow normal navigation
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    return; // Don't prevent default for external links
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                const targetSection = href.substring(1);
                
                // Special handling for AI Chat link - open chat widget
                if (targetSection === 'ai-assistant-section') {
                    this.openChatWidget();
                    return;
                }
                
                this.navigateToSection(targetSection);
            });
        });

        // Handle game start button
        const startGameBtn = document.querySelector(".play-button");
        if (startGameBtn) {
            startGameBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startGame();
            });
        }
    }

    navigateToSection(section) {
        this.currentSection = section;
        this.updateActiveSection();
        
        // Update navigation links
        document.querySelectorAll(".nav-link").forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${section}`) {
                link.classList.add("active");
            }
        });

        // Handle section-specific content
        switch(section) {
            case "news":
                this.showNewsContent();
                break;
            case "game":
                this.showGameContent();
                break;
            case "about":
                this.showAboutContent();
                break;
        }
    }

    openChatWidget() {
        // Use the global function - ensure it's available
        if (typeof window.openChatWidget === 'function') {
            window.openChatWidget();
        } else if (typeof openChatWidget === 'function') {
            openChatWidget();
        } else {
            console.warn('openChatWidget function not available, trying to initialize...');
            // Fallback: try to find and click the launcher button directly
            setTimeout(() => {
                const chatWidget = document.querySelector('noteworthy-chat-widget');
                if (chatWidget && chatWidget.shadowRoot) {
                    const launcher = chatWidget.shadowRoot.querySelector('.launcher');
                    if (launcher) {
                        launcher.click();
                    }
                }
            }, 500);
        }
    }

    updateActiveSection() {
        const navLinks = document.querySelectorAll(".nav-link");
        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${this.currentSection}`) {
                link.classList.add("active");
            }
        });
    }

    showNewsContent() {
        // Show news-related content
        console.log("Showing news content");
    }

    showGameContent() {
        // Show game-related content
        console.log("Showing game content");
    }

    showAboutContent() {
        // Show about content
        console.log("Showing about content");
    }

    startGame() {
        console.log("Starting game...");
        // This will be handled by the game system
        if (window.game) {
            window.game.startGame();
        }
    }
}

class BreakingNewsGame {
    constructor() {
        console.log('Game constructor called');
        this.score = 0;
        this.level = 1;
        this.streak = 0;
        this.combo = 1; // Combo multiplier
        this.currentQuestion = 0;
        this.gameState = 'start'; // start, playing, feedback, gameOver
        this.difficulty = 'easy';
        this.timeLimit = 30;
        this.timer = null;
        this.timeLeft = 30;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.lives = 3; // Lives system
        this.maxLives = 3;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.currentMusicIndex = 0;
        this.isPaused = false;
        this.pauseTimeLeft = 0;
        this.notificationShown = false;
        
        // Advanced competitive features
        this.startTime = null;
        this.gameTimerInterval = null;
        this.elapsedTime = 0; // Total game time in milliseconds
        this.questionStartTime = null;
        this.questionTimerInterval = null;
        this.questionTimes = []; // Track time per question
        this.speedBonus = 0; // Total speed bonuses
        this.bestTime = this.loadBestTime();
        
        // Load AI preference from localStorage, default to true
        const savedAI = localStorage.getItem('noteworthy_ai_enabled');
        this.aiEnabled = savedAI !== null ? savedAI === 'true' : true;
        this.aiLoading = false;
        
        // Create and shuffle questions
        this.questions = this.createAndShuffleQuestions();
        console.log('Questions created:', this.questions.length);
        console.log('First question:', this.questions[0]);
        
        // NeonDreams music state
        this._bgMusicWasPlaying = false;
        this._bgMusicCurrentTime = 0;
        this._bgMusicTrack = null; // Track which music was playing (interactiveGameBackgroundMusic or music system)
        
        this.initializeGame();
        
        // Initialize AI button state after a brief delay to ensure DOM is ready
        setTimeout(() => {
            this.updateAIButtonState();
        }, 100);
        
        // Set up page leave handler to fade out NeonDreams
        // Only if we're on the game page (not homepage)
        const isGamePage = window.location.pathname.includes('game.html') || document.getElementById('gameOver');
        if (isGamePage) {
            window.addEventListener('beforeunload', () => {
                this.fadeOutNeonDreamsAndResume();
            });
            window.addEventListener('pagehide', () => {
                this.fadeOutNeonDreamsAndResume();
            });
        }
    }
    
    playNeonDreams() {
        // Get background music (InteractiveGame.wav or music system)
        const interactiveGameMusic = document.getElementById('interactiveGameBackgroundMusic');
        const backgroundMusic = document.getElementById('backgroundMusic');
        const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
        const backgroundMusicThird = document.getElementById('backgroundMusicThird');
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        const neonDreams = document.getElementById('neonDreamsMusic');
        
        if (!neonDreams) {
            console.warn('NeonDreams.wav audio element not found');
            return;
        }
        
        // Use music system pause function if available to pause all tracks
        if (typeof window.pauseAllMusicTracks === 'function') {
            try {
                const musicState = window.pauseAllMusicTracks();
                if (musicState.wasPlaying && musicState.currentTrack) {
                    this._bgMusicWasPlaying = true;
                    this._bgMusicCurrentTime = musicState.currentTime;
                    // Determine which track it was
                    if (musicState.currentTrack === interactiveGameMusic) {
                        this._bgMusicTrack = 'interactiveGame';
                    } else if (musicState.currentTrack === backgroundMusic) {
                        this._bgMusicTrack = 'track1';
                    } else if (musicState.currentTrack === backgroundMusicSecond) {
                        this._bgMusicTrack = 'track2';
                    } else if (musicState.currentTrack === backgroundMusicThird) {
                        this._bgMusicTrack = 'track3';
                    } else if (musicState.currentTrack === backgroundMusicLoop) {
                        this._bgMusicTrack = 'loop';
                    }
                    console.log('🎵 Paused music via music system, track:', this._bgMusicTrack, 'time:', this._bgMusicCurrentTime);
                }
            } catch (e) {
                console.log('Error using music system pause:', e);
            }
        }
        
        // Also manually check and pause InteractiveGame.wav (specific to fact checker game)
        // This is important because it might not be managed by the music system
        if (interactiveGameMusic && !interactiveGameMusic.paused) {
            if (!this._bgMusicWasPlaying) {
                this._bgMusicWasPlaying = true;
                this._bgMusicCurrentTime = interactiveGameMusic.currentTime;
                this._bgMusicTrack = 'interactiveGame';
            }
            interactiveGameMusic.pause();
            console.log('🎵 Paused InteractiveGame.wav, saved time:', this._bgMusicCurrentTime);
        } else if (interactiveGameMusic && interactiveGameMusic.currentTime > 0 && !this._bgMusicWasPlaying) {
            // Save state even if paused (might have been paused by something else)
            this._bgMusicWasPlaying = true;
            this._bgMusicCurrentTime = interactiveGameMusic.currentTime;
            this._bgMusicTrack = 'interactiveGame';
            console.log('🎵 Saved InteractiveGame.wav state (was paused), time:', this._bgMusicCurrentTime);
        }
        
        // Play NeonDreams.wav
        neonDreams.volume = 0.5;
        neonDreams.currentTime = 0;
        const playPromise = neonDreams.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('🎵 NeonDreams.wav started playing');
            }).catch(err => {
                console.log('⚠️ NeonDreams.wav autoplay blocked:', err.message);
                // Try to play after user interaction
                const tryPlayOnInteraction = () => {
                    neonDreams.play().then(() => {
                        console.log('🎵 NeonDreams.wav started playing after interaction');
                    }).catch(e => {
                        console.log('⚠️ Still blocked:', e.message);
                    });
                    document.removeEventListener('click', tryPlayOnInteraction);
                    document.removeEventListener('touchstart', tryPlayOnInteraction);
                };
                document.addEventListener('click', tryPlayOnInteraction, { once: true });
                document.addEventListener('touchstart', tryPlayOnInteraction, { once: true });
            });
        }
    }
    
    fadeOutNeonDreamsAndResume() {
        const neonDreams = document.getElementById('neonDreamsMusic');
        const interactiveGameMusic = document.getElementById('interactiveGameBackgroundMusic');
        const backgroundMusic = document.getElementById('backgroundMusic');
        const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
        const backgroundMusicThird = document.getElementById('backgroundMusicThird');
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        
        if (!neonDreams) return;
        
        // Fade out NeonDreams.wav
        if (!neonDreams.paused) {
            const fadeOutInterval = setInterval(() => {
                if (neonDreams.volume > 0.05) {
                    neonDreams.volume -= 0.05;
                } else {
                    neonDreams.volume = 0;
                    neonDreams.pause();
                    neonDreams.currentTime = 0;
                    clearInterval(fadeOutInterval);
                    
                    // Resume background music if it was playing
                    this.resumeBackgroundMusic();
                }
            }, 50); // Fade out over ~500ms
        } else {
            // If already paused, just resume background music
            this.resumeBackgroundMusic();
        }
    }
    
    resumeBackgroundMusic() {
        const interactiveGameMusic = document.getElementById('interactiveGameBackgroundMusic');
        const backgroundMusic = document.getElementById('backgroundMusic');
        const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
        const backgroundMusicThird = document.getElementById('backgroundMusicThird');
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        
        if (!this._bgMusicWasPlaying) return;
        
        // Function to fade in music
        const fadeInMusic = (musicElement, targetVolume = 0.5) => {
            if (!musicElement) return;
            
            // Set initial volume to 0
            musicElement.volume = 0;
            
            // Restore position if available
            if (this._bgMusicCurrentTime !== undefined) {
                musicElement.currentTime = this._bgMusicCurrentTime;
            }
            
            // Start playing
            musicElement.play().catch(err => {
                console.log('⚠️ Failed to resume background music:', err.message);
            });
            
            // Fade in over 1 second
            const fadeInInterval = setInterval(() => {
                if (musicElement.volume < targetVolume) {
                    musicElement.volume = Math.min(musicElement.volume + 0.05, targetVolume);
                } else {
                    clearInterval(fadeInInterval);
                    console.log('🎵 Background music faded in to volume:', targetVolume);
                }
            }, 50); // Update every 50ms for smooth fade
        };
        
        // Handle InteractiveGame.wav separately (not part of music system)
        if (this._bgMusicTrack === 'interactiveGame' && interactiveGameMusic) {
            fadeInMusic(interactiveGameMusic);
            console.log('🎵 Resuming InteractiveGame.wav with fade in at time:', this._bgMusicCurrentTime);
            this._bgMusicWasPlaying = false;
            this._bgMusicTrack = null;
            return;
        }
        
        // Manual resume for music system tracks
        let musicToResume = null;
        if (this._bgMusicTrack === 'track1' && backgroundMusic) {
            musicToResume = backgroundMusic;
        } else if (this._bgMusicTrack === 'track2' && backgroundMusicSecond) {
            musicToResume = backgroundMusicSecond;
        } else if (this._bgMusicTrack === 'track3' && backgroundMusicThird) {
            musicToResume = backgroundMusicThird;
        } else if (this._bgMusicTrack === 'loop' && backgroundMusicLoop) {
            musicToResume = backgroundMusicLoop;
        }
        
        if (musicToResume) {
            fadeInMusic(musicToResume);
            console.log('🎵 Resuming background music with fade in:', this._bgMusicTrack, 'at time:', this._bgMusicCurrentTime);
        }
        this._bgMusicWasPlaying = false;
        this._bgMusicTrack = null;
    }
    
    createAndShuffleQuestions() {
        // First, create all questions
        const allQuestions = [
            // LEVEL 1: Basic Factual News
            {
                headline: "JUST IN: Two Pennsylvania State Troopers shot in Susquehanna County, Pennsylvania, transported to hospital in unknown condition.",
                source: "Noteworthy News",
                isFactual: true,
                explanation: "This is factual breaking news from Noteworthy News. Police shootings are verified through official law enforcement sources and local news outlets.",
                tips: "Breaking news from verified sources should be factual, but always check for updates as situations develop.",
                level: 1,
                category: "breaking"
            },
            {
                headline: "NEW: An AMREF air ambulance crashed into a home in Mwihoko, Kenya, killing all 4 onboard and 2 individuals on the ground.",
                source: "Noteworthy News",
                isFactual: true,
                explanation: "This is factual breaking news from Noteworthy News. Aviation accidents are verified through official aviation authorities and local emergency services.",
                tips: "Breaking news about accidents should be verified through official sources like aviation authorities and emergency services.",
                level: 1,
                category: "breaking"
            },
            {
                headline: "Evacuation orders issued for the Kaanapali area of Lahaina on Hawaii's Maui Island amid brush fire.",
                source: "Noteworthy News",
                isFactual: true,
                explanation: "This is factual breaking news from Noteworthy News. Evacuation orders are verified through official emergency management agencies and local authorities.",
                tips: "Breaking news about evacuations should be verified through official emergency management agencies and local authorities.",
                level: 1,
                category: "breaking"
            },
            {
                headline: "NASA's Perseverance rover successfully lands on Mars",
                source: "NASA.gov",
                isFactual: true,
                explanation: "This is factual news from NASA's official website. The Perseverance rover did successfully land on Mars in February 2021. Source: https://mars.nasa.gov/mars2020/",
                tips: "Official government websites like NASA.gov are reliable sources for space news.",
                level: 1,
                category: "science"
            },
            {
                headline: "COVID-19 vaccines show 95% effectiveness in clinical trials",
                source: "The New England Journal of Medicine",
                isFactual: true,
                explanation: "This is factual news from a peer-reviewed medical journal. The vaccines did show high effectiveness in trials. Source: https://www.nejm.org/doi/full/10.1056/NEJMoa2035389",
                tips: "Peer-reviewed medical journals are reliable sources for health information.",
                level: 1,
                category: "health"
            },
            {
                headline: "Global temperatures continue to rise, breaking records",
                source: "National Oceanic and Atmospheric Administration",
                isFactual: true,
                explanation: "This is factual news from NOAA, a government agency. Global temperature data shows continued warming. Source: https://www.noaa.gov/news/2023-was-worlds-warmest-year-on-record",
                tips: "Government agencies like NOAA provide reliable climate data.",
                level: 1,
                category: "science"
            },
            {
                headline: "Electric vehicle sales increase by 40% worldwide",
                source: "International Energy Agency",
                isFactual: true,
                explanation: "This is factual news from the IEA, an international organization. EV sales data confirms this trend. Source: https://www.iea.org/reports/global-ev-outlook-2023",
                tips: "International organizations often provide reliable statistical data.",
                level: 1,
                category: "business"
            },
            {
                headline: "Scientists discover new species in Amazon rainforest",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual news from Nature, a prestigious scientific journal. New species discoveries are regularly published. Source: https://www.nature.com/articles/s41586-023-06595-3",
                tips: "Reputable scientific journals are reliable sources for research findings.",
                level: 1,
                category: "science"
            },
            {
                headline: "Federal Reserve raises interest rates by 0.25%",
                source: "Federal Reserve",
                isFactual: true,
                explanation: "This is factual news from the Federal Reserve's official announcement. Interest rate decisions are publicly announced and widely reported.",
                tips: "Official government announcements are reliable sources for economic news.",
                level: 1,
                category: "business"
            },
            {
                headline: "New study finds link between diet and heart disease",
                source: "Journal of the American Medical Association",
                isFactual: true,
                explanation: "This is factual news from a peer-reviewed medical journal. Medical studies are published in reputable journals after peer review.",
                tips: "Peer-reviewed medical journals are reliable sources for health research.",
                level: 1,
                category: "health"
            },
            {
                headline: "Supreme Court issues ruling on landmark case",
                source: "Supreme Court of the United States",
                isFactual: true,
                explanation: "This is factual news from the Supreme Court's official ruling. Court decisions are publicly available and widely reported.",
                tips: "Official court rulings and government sources are reliable for legal news.",
                level: 1,
                category: "politics"
            },
            {
                headline: "Major tech company announces new product launch",
                source: "Company Press Release",
                isFactual: true,
                explanation: "This is factual news from an official company press release. Product launches are typically announced through official channels.",
                tips: "Official company announcements are reliable sources for business news.",
                level: 1,
                category: "business"
            },
            {
                headline: "Scientists discover new species in Amazon rainforest",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual news from Nature, a prestigious scientific journal. New species discoveries are regularly published. Source: https://www.nature.com/articles/s41586-023-06595-3",
                tips: "Reputable scientific journals are reliable sources for research findings.",
                level: 1,
                category: "science"
            },
            
            // MISLEADING NEWS
            {
                headline: "5G networks cause coronavirus, doctors confirm",
                source: "TruthSeekerDaily.com",
                isFactual: false,
                explanation: "This is misleading. 5G networks cannot cause viruses, and no credible doctors have made this claim. The source is not reliable.",
                tips: "Be wary of sensational health claims and check if the source is credible.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Secret cure for cancer discovered but hidden by big pharma",
                source: "NaturalHealthBlog.net",
                isFactual: false,
                explanation: "This is misleading. There's no evidence of a hidden cancer cure, and this type of conspiracy theory is common in unreliable sources.",
                tips: "Conspiracy theories about 'hidden cures' are red flags for misinformation.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Celebrity dies in shocking accident (but actually alive)",
                source: "ClickBaitNews.com",
                isFactual: false,
                explanation: "This is misleading. The headline suggests someone died but then admits they're alive - classic clickbait.",
                tips: "Clickbait headlines often use sensational language to get clicks.",
                level: 1,
                category: "clickbait"
            },
            {
                headline: "One simple trick to lose 50 pounds in a week",
                source: "MiracleWeightLoss.com",
                isFactual: false,
                explanation: "This is misleading. Rapid weight loss claims are usually false, and the source is not credible.",
                tips: "Extreme health claims and miracle cures are often false.",
                level: 1,
                category: "health"
            },
            {
                headline: "Aliens spotted in backyard, government covering it up",
                source: "UFOTruth.org",
                isFactual: false,
                explanation: "This is misleading. There's no credible evidence of alien contact, and conspiracy theories are unreliable.",
                tips: "Extraordinary claims require extraordinary evidence from credible sources.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Scientists say drinking bleach cures all diseases",
                source: "AlternativeMedicine.net",
                isFactual: false,
                explanation: "This is dangerously misleading. Drinking bleach is harmful and no credible scientists would make this claim.",
                tips: "Health advice should come from medical professionals, not alternative medicine websites.",
                level: 1,
                category: "health"
            },
            {
                headline: "Breaking: Time travel discovered in secret government lab",
                source: "ConspiracyNews.com",
                isFactual: false,
                explanation: "This is misleading. Time travel is not scientifically possible, and conspiracy websites are unreliable sources.",
                tips: "Extraordinary scientific claims should be verified through reputable scientific sources.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "One weird trick to make $10,000 a day from home",
                source: "GetRichQuick.com",
                isFactual: false,
                explanation: "This is misleading. Get-rich-quick schemes are almost always scams or false promises.",
                tips: "If it sounds too good to be true, it probably is.",
                level: 1,
                category: "scam"
            },
            {
                headline: "Vaccines contain microchips to track population",
                source: "FreedomNews.net",
                isFactual: false,
                explanation: "This is misleading. Vaccines do not contain microchips, and this is a common conspiracy theory.",
                tips: "Conspiracy theories about vaccines are widespread but false.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Ancient pyramids built by aliens, experts reveal",
                source: "AncientMysteries.com",
                isFactual: false,
                explanation: "This is misleading. Pyramids were built by ancient civilizations, not aliens. The source is not credible.",
                tips: "Be skeptical of claims that contradict well-established historical facts.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "BREAKING: Miracle weight loss pill burns fat while you sleep",
                source: "MiracleHealth.net",
                isFactual: false,
                explanation: "This is misleading. There's no such thing as a miracle weight loss pill. The source is not credible.",
                tips: "Be extremely skeptical of 'miracle' health claims and miracle cures.",
                level: 1,
                category: "health"
            },
            {
                headline: "Government admits to hiding evidence of alien contact",
                source: "UFOTruth.org",
                isFactual: false,
                explanation: "This is misleading. There's no credible evidence of alien contact, and conspiracy theories are unreliable.",
                tips: "Extraordinary claims require extraordinary evidence from credible sources.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "One simple trick to make $50,000 a month from home",
                source: "GetRichQuick.com",
                isFactual: false,
                explanation: "This is misleading. Get-rich-quick schemes are almost always scams or false promises.",
                tips: "If it sounds too good to be true, it probably is.",
                level: 1,
                category: "scam"
            },
            {
                headline: "Celebrity dies in shocking accident (but actually alive)",
                source: "ClickBaitNews.com",
                isFactual: false,
                explanation: "This is misleading. The headline suggests someone died but then admits they're alive - classic clickbait.",
                tips: "Clickbait headlines often use sensational language to get clicks.",
                level: 1,
                category: "clickbait"
            },
            {
                headline: "Scientists say drinking bleach cures all diseases",
                source: "AlternativeMedicine.net",
                isFactual: false,
                explanation: "This is dangerously misleading. Drinking bleach is harmful and no credible scientists would make this claim.",
                tips: "Health advice should come from medical professionals, not alternative medicine websites.",
                level: 1,
                category: "health"
            },
            {
                headline: "Secret cure for cancer discovered but hidden by big pharma",
                source: "NaturalHealthBlog.net",
                isFactual: false,
                explanation: "This is misleading. There's no evidence of a hidden cancer cure, and this type of conspiracy theory is common in unreliable sources.",
                tips: "Conspiracy theories about 'hidden cures' are red flags for misinformation.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "5G networks cause coronavirus, doctors confirm",
                source: "TruthSeekerDaily.com",
                isFactual: false,
                explanation: "This is misleading. 5G networks cannot cause viruses, and no credible doctors have made this claim. The source is not reliable.",
                tips: "Be wary of sensational health claims and check if the source is credible.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Vaccines contain microchips to track population",
                source: "FreedomNews.net",
                isFactual: false,
                explanation: "This is misleading. Vaccines do not contain microchips, and this is a common conspiracy theory.",
                tips: "Conspiracy theories about vaccines are widespread but false.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Breaking: Time travel discovered in secret government lab",
                source: "ConspiracyNews.com",
                isFactual: false,
                explanation: "This is misleading. Time travel is not scientifically possible, and conspiracy websites are unreliable sources.",
                tips: "Extraordinary scientific claims should be verified through reputable scientific sources.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Aliens spotted in backyard, government covering it up",
                source: "UFOTruth.org",
                isFactual: false,
                explanation: "This is misleading. There's no credible evidence of alien contact, and conspiracy theories are unreliable.",
                tips: "Extraordinary claims require extraordinary evidence from credible sources.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "One simple trick to lose 50 pounds in a week",
                source: "MiracleWeightLoss.com",
                isFactual: false,
                explanation: "This is misleading. Rapid weight loss claims are usually false, and the source is not credible.",
                tips: "Extreme health claims and miracle cures are often false.",
                level: 1,
                category: "health"
            },
            {
                headline: "Shocking: Celebrity arrested for scandal (but actually not)",
                source: "GossipNews.com",
                isFactual: false,
                explanation: "This is misleading. The headline suggests a scandal but then admits it's not true - classic clickbait.",
                tips: "Celebrity gossip sites often use sensational headlines to get clicks.",
                level: 1,
                category: "clickbait"
            },
            {
                headline: "Secret government program controls the weather",
                source: "ConspiracyNews.com",
                isFactual: false,
                explanation: "This is misleading. While weather modification exists in limited forms, there's no secret government program controlling all weather.",
                tips: "Conspiracy theories about government control are red flags for misinformation.",
                level: 1,
                category: "conspiracy"
            },
            
            // LEVEL 2: Intermediate Questions
            {
                headline: "Study suggests coffee may reduce risk of certain cancers",
                source: "Journal of the American Medical Association",
                isFactual: true,
                explanation: "This is factual news from a reputable medical journal. However, note the cautious language 'suggests' and 'may'.",
                tips: "Look for cautious language in scientific studies. 'Suggests' and 'may' indicate preliminary findings.",
                level: 2,
                category: "health"
            },
            {
                headline: "New study finds link between social media and mental health",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual news from Nature, a prestigious journal. However, correlation doesn't equal causation.",
                tips: "Distinguish between correlation and causation in scientific studies.",
                level: 2,
                category: "science"
            },
            {
                headline: "Scientists discover new species in Amazon rainforest",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual news from Nature, a prestigious scientific journal. New species discoveries are regularly published.",
                tips: "Reputable scientific journals are reliable sources for research findings.",
                level: 2,
                category: "science"
            },
            {
                headline: "Breaking: Miracle cure for all diseases discovered",
                source: "HealthRevolution.net",
                isFactual: false,
                explanation: "This is misleading. There's no such thing as a 'miracle cure' for all diseases. The source is not credible.",
                tips: "Be extremely skeptical of claims about 'miracle cures' or universal solutions.",
                level: 2,
                category: "health"
            },
            {
                headline: "Government admits to hiding evidence of climate change",
                source: "TruthSeekerDaily.com",
                isFactual: false,
                explanation: "This is misleading. There's no evidence of government conspiracy to hide climate data. The source is unreliable.",
                tips: "Conspiracy theories about government cover-ups are red flags for misinformation.",
                level: 2,
                category: "conspiracy"
            },
            
            // LEVEL 3: Advanced Questions
            {
                headline: "Meta-analysis of 47 studies shows moderate benefits of meditation",
                source: "Psychological Science",
                isFactual: true,
                explanation: "This is factual news from a peer-reviewed journal. Meta-analyses combine multiple studies for stronger evidence.",
                tips: "Meta-analyses provide stronger evidence than individual studies.",
                level: 3,
                category: "science"
            },
            {
                headline: "Economic indicators suggest potential market correction",
                source: "The Economist",
                isFactual: true,
                explanation: "This is factual news from a respected publication. Note the cautious language 'suggest' and 'potential'.",
                tips: "Economic predictions often use cautious language to acknowledge uncertainty.",
                level: 3,
                category: "business"
            },
            {
                headline: "Research indicates possible connection between diet and longevity",
                source: "Cell Journal",
                isFactual: true,
                explanation: "This is factual news from a reputable journal. Note the cautious language 'indicates' and 'possible'.",
                tips: "Scientific language is often cautious and qualified.",
                level: 3,
                category: "health"
            },
            {
                headline: "Secret documents reveal government surveillance program",
                source: "ConspiracyNews.com",
                isFactual: false,
                explanation: "This is misleading. While government surveillance exists, 'secret documents' from unreliable sources are suspicious.",
                tips: "Extraordinary claims require extraordinary evidence from credible sources.",
                level: 3,
                category: "conspiracy"
            },
            {
                headline: "One simple trick to make $10,000 a day from home",
                source: "GetRichQuick.com",
                isFactual: false,
                explanation: "This is misleading. Get-rich-quick schemes are almost always scams or false promises.",
                tips: "If it sounds too good to be true, it probably is.",
                level: 3,
                category: "scam"
            },
            
            // LEVEL 4: Expert Questions
            {
                headline: "Systematic review finds limited evidence for alternative medicine claims",
                source: "BMJ (British Medical Journal)",
                isFactual: true,
                explanation: "This is factual news from a prestigious medical journal. Systematic reviews are high-quality evidence.",
                tips: "Systematic reviews provide the highest level of evidence in medical research.",
                level: 4,
                category: "health"
            },
            {
                headline: "Peer-reviewed study challenges previous findings on climate models",
                source: "Science Journal",
                isFactual: true,
                explanation: "This is factual news from Science, a top-tier journal. Scientific debate is normal and healthy.",
                tips: "Scientific consensus can change as new evidence emerges.",
                level: 4,
                category: "science"
            },
            {
                headline: "Breaking: Time travel discovered in secret government lab",
                source: "ConspiracyNews.com",
                isFactual: false,
                explanation: "This is misleading. Time travel is not scientifically possible, and conspiracy websites are unreliable sources.",
                tips: "Extraordinary scientific claims should be verified through reputable scientific sources.",
                level: 4,
                category: "conspiracy"
            },
            {
                headline: "Vaccines contain microchips to track population",
                source: "FreedomNews.net",
                isFactual: false,
                explanation: "This is misleading. Vaccines do not contain microchips, and this is a common conspiracy theory.",
                tips: "Conspiracy theories about vaccines are widespread but false.",
                level: 4,
                category: "conspiracy"
            },
            
            // LEVEL 5: Master Questions
            {
                headline: "Multi-center randomized controlled trial shows modest benefits of new treatment",
                source: "The Lancet",
                isFactual: true,
                explanation: "This is factual news from The Lancet, a top medical journal. RCTs are the gold standard for medical evidence.",
                tips: "Randomized controlled trials provide the strongest evidence in medical research.",
                level: 5,
                category: "health"
            },
            {
                headline: "International consortium publishes comprehensive genome analysis",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual news from Nature. International collaborations often produce the most reliable research.",
                tips: "Large, international research collaborations typically produce high-quality data.",
                level: 5,
                category: "science"
            },
            {
                headline: "Secret cure for cancer discovered but hidden by big pharma",
                source: "NaturalHealthBlog.net",
                isFactual: false,
                explanation: "This is misleading. There's no evidence of a hidden cancer cure, and this type of conspiracy theory is common in unreliable sources.",
                tips: "Conspiracy theories about 'hidden cures' are red flags for misinformation.",
                level: 5,
                category: "conspiracy"
            },
            
            // NEW REAL NEWS STORIES
            {
                headline: "James Webb Space Telescope discovers oldest galaxies ever observed",
                source: "NASA.gov",
                isFactual: true,
                explanation: "This is factual. The James Webb Space Telescope has indeed discovered some of the oldest galaxies, dating back to just 400 million years after the Big Bang. NASA regularly publishes these findings.",
                tips: "NASA's official website is a reliable source for space discoveries.",
                level: 1,
                category: "science"
            },
            {
                headline: "ChatGPT reaches 100 million users in record time",
                source: "Reuters",
                isFactual: true,
                explanation: "This is factual. ChatGPT reached 100 million monthly active users faster than any consumer app in history, according to Reuters reporting based on company data.",
                tips: "Major news agencies like Reuters verify statistics with companies before reporting.",
                level: 1,
                category: "technology"
            },
            {
                headline: "FDA approves first gene therapy for sickle cell disease",
                source: "Food and Drug Administration",
                isFactual: true,
                explanation: "This is factual. The FDA approved the first gene therapies for sickle cell disease in December 2023, marking a significant medical breakthrough.",
                tips: "FDA announcements are official government sources for medical approvals.",
                level: 2,
                category: "health"
            },
            {
                headline: "Amazon rainforest faces worst drought in over a century",
                source: "BBC News",
                isFactual: true,
                explanation: "This is factual. The Amazon experienced severe drought conditions in 2023, with water levels reaching historic lows, as reported by BBC and verified by environmental agencies.",
                tips: "Established news organizations like BBC verify environmental data with scientific sources.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Taylor Swift becomes first artist to have four albums in Billboard Top 10 simultaneously",
                source: "Billboard",
                isFactual: true,
                explanation: "This is factual. Taylor Swift achieved this historic milestone in 2023, as verified by Billboard's official chart data.",
                tips: "Billboard is the authoritative source for music chart data.",
                level: 1,
                category: "entertainment"
            },
            {
                headline: "Scientists create first synthetic human embryo without egg or sperm",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual. Researchers created synthetic human embryos using stem cells, published in Nature. This represents a significant scientific advancement.",
                tips: "Nature is one of the world's most prestigious scientific journals with rigorous peer review.",
                level: 3,
                category: "science"
            },
            {
                headline: "Global carbon emissions reach new record high despite climate pledges",
                source: "International Energy Agency",
                isFactual: true,
                explanation: "This is factual. The IEA reported that global energy-related CO2 emissions reached a new record in 2023, despite climate commitments.",
                tips: "The IEA is a respected international organization that tracks energy data.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Apple becomes first company to reach $3 trillion market value",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. Apple briefly reached a $3 trillion market capitalization in 2023, as reported by financial news outlets and verified by stock market data.",
                tips: "The Wall Street Journal is a reputable financial news source.",
                level: 1,
                category: "business"
            },
            {
                headline: "WHO declares end of COVID-19 global health emergency",
                source: "World Health Organization",
                isFactual: true,
                explanation: "This is factual. The WHO declared the end of the COVID-19 global health emergency in May 2023, after over three years.",
                tips: "WHO official announcements are authoritative sources for global health news.",
                level: 1,
                category: "health"
            },
            {
                headline: "Record-breaking heat wave hits Europe, temperatures exceed 45°C",
                source: "European Centre for Medium-Range Weather Forecasts",
                isFactual: true,
                explanation: "This is factual. Europe experienced extreme heat waves in 2023, with temperatures reaching record highs, verified by meteorological agencies.",
                tips: "Official meteorological organizations provide reliable weather data.",
                level: 1,
                category: "weather"
            },
            {
                headline: "SpaceX successfully launches and lands reusable rocket for 200th time",
                source: "SpaceX",
                isFactual: true,
                explanation: "This is factual. SpaceX achieved this milestone in 2023, demonstrating the reliability of reusable rocket technology. The company provides official launch data.",
                tips: "Company press releases from major corporations are generally reliable for their own achievements.",
                level: 1,
                category: "technology"
            },
            {
                headline: "Study finds microplastics in human blood for first time",
                source: "Environment International Journal",
                isFactual: true,
                explanation: "This is factual. A peer-reviewed study published in Environment International found microplastics in human blood samples, representing a significant health concern.",
                tips: "Peer-reviewed scientific journals are reliable sources for research findings.",
                level: 2,
                category: "health"
            },
            {
                headline: "China's population declines for first time in 60 years",
                source: "National Bureau of Statistics of China",
                isFactual: true,
                explanation: "This is factual. China's population decreased in 2022 for the first time since 1961, as reported by official government statistics.",
                tips: "Official government statistics bureaus are reliable sources for demographic data.",
                level: 2,
                category: "demographics"
            },
            {
                headline: "Artificial intelligence passes medical licensing exam",
                source: "PLOS Digital Health",
                isFactual: true,
                explanation: "This is factual. ChatGPT and other AI systems have passed medical licensing exams, as documented in peer-reviewed research published in PLOS Digital Health.",
                tips: "Peer-reviewed research publications are reliable sources for scientific achievements.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Record number of wildfires burn across Canada",
                source: "Natural Resources Canada",
                isFactual: true,
                explanation: "This is factual. Canada experienced its worst wildfire season in 2023, with millions of hectares burned, as reported by government natural resources agencies.",
                tips: "Government natural resources agencies provide reliable data on wildfires.",
                level: 1,
                category: "environment"
            },
            {
                headline: "Scientists successfully reverse aging in mice using cellular reprogramming",
                source: "Cell Journal",
                isFactual: true,
                explanation: "This is factual. Research published in Cell demonstrated partial age reversal in mice through cellular reprogramming, though human applications remain distant.",
                tips: "Top-tier scientific journals like Cell publish rigorously peer-reviewed research.",
                level: 3,
                category: "science"
            },
            {
                headline: "Global food prices reach highest level in decade",
                source: "Food and Agriculture Organization",
                isFactual: true,
                explanation: "This is factual. The FAO's Food Price Index reached record highs in 2022-2023 due to various factors including conflict and climate events.",
                tips: "The FAO is a UN agency that provides authoritative data on global food prices.",
                level: 2,
                category: "economics"
            },
            {
                headline: "First successful transplant of pig heart into human patient",
                source: "University of Maryland Medical Center",
                isFactual: true,
                explanation: "This is factual. Surgeons at the University of Maryland performed the first successful pig-to-human heart transplant in 2022, though the patient later passed away. This represents a medical milestone.",
                tips: "Major medical centers provide reliable information about groundbreaking procedures.",
                level: 3,
                category: "health"
            },
            {
                headline: "Ocean temperatures reach record highs, threatening marine ecosystems",
                source: "NOAA",
                isFactual: true,
                explanation: "This is factual. NOAA and other oceanographic agencies documented record-high ocean temperatures in 2023, causing widespread coral bleaching and ecosystem stress.",
                tips: "NOAA is a trusted government agency for oceanographic and climate data.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Meta announces new AI model that can generate realistic video",
                source: "Meta",
                isFactual: true,
                explanation: "This is factual. Meta (Facebook) has developed and demonstrated AI models capable of generating realistic video content, as announced in official company releases.",
                tips: "Major tech companies' official announcements about their own products are generally reliable.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Study links ultra-processed foods to increased risk of depression",
                source: "JAMA Network Open",
                isFactual: true,
                explanation: "This is factual. A large-scale study published in JAMA Network Open found associations between ultra-processed food consumption and depression risk, though correlation doesn't prove causation.",
                tips: "JAMA publications are reputable medical journals, but remember correlation doesn't equal causation.",
                level: 2,
                category: "health"
            },
            
            // NEW BELIEVABLE FAKE NEWS STORIES
            {
                headline: "Breaking: Scientists discover that drinking 8 glasses of water daily actually causes dehydration",
                source: "HealthRevolution.net",
                isFactual: false,
                explanation: "This is misleading. The 8-glasses-of-water recommendation is well-established, and there's no credible evidence it causes dehydration. The source is not a reputable medical publication.",
                tips: "Be skeptical of claims that contradict well-established medical advice from reputable sources.",
                level: 2,
                category: "health"
            },
            {
                headline: "Exclusive: Major tech company admits their products are designed to be addictive",
                source: "TechTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. While tech companies do use design techniques to increase engagement, no major company has made such a blanket admission. The source is not credible.",
                tips: "Be wary of 'exclusive' claims from unknown sources, especially when they seem designed to provoke outrage.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Study reveals that exercise actually accelerates aging process",
                source: "AlternativeHealthResearch.org",
                isFactual: false,
                explanation: "This is misleading. Extensive research shows exercise has numerous health benefits and may slow aging. The source is not a reputable scientific publication.",
                tips: "Claims that contradict decades of established research should be viewed with extreme skepticism.",
                level: 2,
                category: "health"
            },
            {
                headline: "Shocking discovery: Vegetables contain harmful chemicals that cause cancer",
                source: "NaturalWellnessToday.com",
                isFactual: false,
                explanation: "This is misleading. While vegetables can contain trace amounts of various compounds, the overwhelming scientific consensus is that vegetables are beneficial for health. The source is not credible.",
                tips: "Be extremely skeptical of health claims that contradict decades of nutritional science.",
                level: 2,
                category: "health"
            },
            {
                headline: "BREAKING: Government secretly monitoring all smartphone cameras and microphones",
                source: "PrivacyWatch.net",
                isFactual: false,
                explanation: "This is misleading. While government surveillance exists, there's no evidence of widespread secret monitoring of all smartphone cameras and microphones. The source is not credible.",
                tips: "Extraordinary surveillance claims require extraordinary evidence from credible sources.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Doctors shocked: New study proves vaccines cause autism (finally admitted)",
                source: "MedicalTruthRevealed.com",
                isFactual: false,
                explanation: "This is dangerously misleading. Extensive research has found no link between vaccines and autism. The original study claiming this was retracted and debunked. The source is not credible.",
                tips: "Vaccine safety is one of the most studied topics in medicine. Be extremely skeptical of claims contradicting the scientific consensus.",
                level: 1,
                category: "health"
            },
            {
                headline: "Scientists discover that the Earth is actually flat, NASA has been lying",
                source: "TruthSeekersUnite.org",
                isFactual: false,
                explanation: "This is completely false. The Earth is demonstrably round, proven by countless observations and experiments. NASA and all space agencies operate based on this fact. The source is not credible.",
                tips: "Claims that contradict fundamental, well-established scientific facts should be immediately dismissed.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Exclusive: Major pharmaceutical company admits they profit from keeping people sick",
                source: "BigPharmaExposed.net",
                isFactual: false,
                explanation: "This is misleading. While pharmaceutical companies are profit-driven, no major company has made such an admission. The source is not credible and appears designed to promote conspiracy theories.",
                tips: "Be wary of 'exclusive' admissions from unknown sources, especially when they align with popular conspiracy theories.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Breaking: Study finds that reading actually damages your brain",
                source: "CognitiveHealthResearch.com",
                isFactual: false,
                explanation: "This is misleading. Extensive research shows reading has numerous cognitive benefits. The source is not a reputable scientific publication, and this contradicts decades of neuroscience research.",
                tips: "Claims that contradict well-established scientific consensus should be viewed with extreme skepticism.",
                level: 2,
                category: "health"
            },
            {
                headline: "Shocking revelation: Sleep is actually harmful to your health, doctors discover",
                source: "SleepScienceRevolution.net",
                isFactual: false,
                explanation: "This is completely false. Sleep is essential for health, and decades of research demonstrate its critical importance. The source is not credible.",
                tips: "Be extremely skeptical of health claims that contradict fundamental biological processes.",
                level: 1,
                category: "health"
            },
            {
                headline: "BREAKING: Climate change is a hoax, leaked documents reveal",
                source: "ClimateTruthNow.org",
                isFactual: false,
                explanation: "This is misleading. Climate change is supported by overwhelming scientific evidence from thousands of studies. No credible 'leaked documents' have revealed it to be a hoax. The source is not credible.",
                tips: "Climate science is one of the most studied fields. Be extremely skeptical of claims contradicting the scientific consensus.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Doctors stunned: New research proves that stress is actually good for you",
                source: "StressScienceUpdate.com",
                isFactual: false,
                explanation: "This is misleading. While some stress can be beneficial in small amounts (eustress), chronic stress is harmful. The source oversimplifies and misrepresents stress research. The source is not credible.",
                tips: "Be wary of health claims that oversimplify complex scientific topics.",
                level: 2,
                category: "health"
            },
            {
                headline: "Exclusive: Tech billionaire admits social media is designed to make you depressed",
                source: "TechInsiderTruth.com",
                isFactual: false,
                explanation: "This is misleading. While tech executives have acknowledged concerns about social media's impact, no major figure has made such a blanket admission. The source is not credible.",
                tips: "Be skeptical of 'exclusive' admissions from unknown sources, especially when they seem designed to go viral.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Scientists discover that the sun is actually getting colder, not hotter",
                source: "SolarScienceRevolution.net",
                isFactual: false,
                explanation: "This is misleading. The sun follows natural cycles, but there's no evidence it's getting colder overall. Solar activity is well-monitored and documented. The source is not credible.",
                tips: "Be skeptical of claims about well-monitored natural phenomena that contradict established scientific data.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Breaking: Study reveals that fruits and vegetables are actually toxic",
                source: "NutritionTruthExposed.com",
                isFactual: false,
                explanation: "This is dangerously misleading. Fruits and vegetables are fundamental to a healthy diet, supported by decades of nutritional research. The source is not credible.",
                tips: "Be extremely skeptical of health claims that contradict fundamental nutritional science.",
                level: 1,
                category: "health"
            },
            {
                headline: "Shocking: Medical study proves that doctors are causing more harm than good",
                source: "MedicalSystemExposed.net",
                isFactual: false,
                explanation: "This is misleading. While medical errors occur, the overall benefit of medical care is well-documented. No credible study has proven doctors cause more harm than good. The source is not credible.",
                tips: "Be wary of claims that attack entire professions or systems without credible evidence.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "BREAKING: Government admits to controlling the weather with secret technology",
                source: "WeatherControlTruth.org",
                isFactual: false,
                explanation: "This is misleading. While weather modification exists in limited forms (cloud seeding), there's no evidence of widespread secret weather control. The source is not credible.",
                tips: "Be skeptical of claims about secret government technologies, especially from unknown sources.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Doctors discover that exercise actually weakens your immune system",
                source: "ExerciseScienceUpdate.com",
                isFactual: false,
                explanation: "This is misleading. While intense exercise can temporarily suppress immunity, regular moderate exercise strengthens the immune system. The source misrepresents the research. The source is not credible.",
                tips: "Be wary of health claims that oversimplify or misrepresent complex scientific findings.",
                level: 2,
                category: "health"
            },
            {
                headline: "Exclusive: Major news outlet admits to fabricating stories for clicks",
                source: "MediaTruthExposed.net",
                isFactual: false,
                explanation: "This is misleading. While media bias and errors occur, no major reputable news outlet has admitted to fabricating stories. The source is not credible and appears designed to undermine trust in journalism.",
                tips: "Be skeptical of claims that attack entire institutions, especially from sources with clear agendas.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Scientists shocked: New study proves that the moon landing was faked",
                source: "SpaceTruthRevealed.com",
                isFactual: false,
                explanation: "This is completely false. The moon landing is one of the most well-documented events in history, with overwhelming evidence. No credible study has proven it was faked. The source is not credible.",
                tips: "Be extremely skeptical of claims that contradict well-documented historical events with overwhelming evidence.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Breaking: Research reveals that education actually makes you dumber",
                source: "EducationSystemExposed.org",
                isFactual: false,
                explanation: "This is misleading. Extensive research demonstrates the benefits of education. The source is not credible and contradicts decades of educational research.",
                tips: "Be extremely skeptical of claims that contradict fundamental aspects of human development and learning.",
                level: 2,
                category: "conspiracy"
            },
            
            // MORE REAL NEWS
            {
                headline: "United States achieves first fusion energy net gain breakthrough",
                source: "U.S. Department of Energy",
                isFactual: true,
                explanation: "This is factual. Scientists at Lawrence Livermore National Laboratory achieved net energy gain from nuclear fusion in December 2022, a major milestone for clean energy research.",
                tips: "Government energy departments are reliable sources for major scientific breakthroughs.",
                level: 3,
                category: "science"
            },
            {
                headline: "Global internet outage affects millions after major cloud provider fails",
                source: "Associated Press",
                isFactual: true,
                explanation: "This is factual. Major cloud service providers have experienced outages that affected millions of users, as reported by major news agencies like AP.",
                tips: "Established news agencies like AP verify technical incidents with companies before reporting.",
                level: 2,
                category: "technology"
            },
            {
                headline: "New antibiotic discovered that can kill drug-resistant bacteria",
                source: "Science Journal",
                isFactual: true,
                explanation: "This is factual. Researchers have discovered new antibiotics effective against drug-resistant bacteria, published in top scientific journals like Science.",
                tips: "Top-tier scientific journals are reliable sources for medical breakthroughs.",
                level: 3,
                category: "health"
            },
            {
                headline: "Record number of species declared extinct in 2023",
                source: "International Union for Conservation of Nature",
                isFactual: true,
                explanation: "This is factual. The IUCN regularly updates its Red List of threatened species, and extinction rates have been increasing due to habitat loss and climate change.",
                tips: "The IUCN is the authoritative international organization for species conservation status.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Cryptocurrency exchange collapses, customers lose billions",
                source: "Financial Times",
                isFactual: true,
                explanation: "This is factual. Major cryptocurrency exchanges have collapsed, resulting in significant losses for customers, as reported by reputable financial news outlets.",
                tips: "Established financial news sources like Financial Times verify major financial events.",
                level: 2,
                category: "business"
            },
            {
                headline: "Scientists develop AI that can predict protein structures with high accuracy",
                source: "Nature Journal",
                isFactual: true,
                explanation: "This is factual. AI systems like AlphaFold have revolutionized protein structure prediction, published in Nature and recognized as a major scientific achievement.",
                tips: "Nature is one of the world's most prestigious scientific journals.",
                level: 3,
                category: "science"
            },
            {
                headline: "Antarctic sea ice reaches record low levels",
                source: "National Snow and Ice Data Center",
                isFactual: true,
                explanation: "This is factual. Antarctic sea ice reached record low levels in 2023, as documented by the NSIDC and other scientific monitoring organizations.",
                tips: "The NSIDC is a trusted scientific organization that monitors polar ice data.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Major social media platform announces new content moderation policies",
                source: "Company Press Release",
                isFactual: true,
                explanation: "This is factual. Social media companies regularly update their content policies and announce changes through official press releases.",
                tips: "Company press releases are reliable sources for official company policy announcements.",
                level: 1,
                category: "technology"
            },
            {
                headline: "Study finds link between air pollution and increased dementia risk",
                source: "BMJ (British Medical Journal)",
                isFactual: true,
                explanation: "This is factual. Research published in BMJ has found associations between air pollution exposure and increased dementia risk, though more research is needed.",
                tips: "BMJ is a reputable medical journal, but remember correlation doesn't prove causation.",
                level: 2,
                category: "health"
            },
            {
                headline: "World's largest battery storage facility begins operation",
                source: "Reuters",
                isFactual: true,
                explanation: "This is factual. Large-scale battery storage facilities are being built worldwide to support renewable energy, as reported by major news agencies.",
                tips: "Major news agencies like Reuters verify infrastructure projects with companies and governments.",
                level: 2,
                category: "technology"
            },
            
            // MORE BELIEVABLE FAKE NEWS
            {
                headline: "BREAKING: Scientists discover that breathing oxygen is actually toxic",
                source: "OxygenTruthRevealed.com",
                isFactual: false,
                explanation: "This is completely false. Oxygen is essential for human life. While pure oxygen can be harmful in certain medical contexts, the claim that breathing oxygen is toxic is absurd. The source is not credible.",
                tips: "Be extremely skeptical of claims that contradict fundamental biological necessities.",
                level: 1,
                category: "health"
            },
            {
                headline: "Exclusive: NASA admits the International Space Station is actually on Earth",
                source: "SpaceTruthExposed.net",
                isFactual: false,
                explanation: "This is completely false. The ISS is demonstrably in orbit, visible from Earth and regularly visited by astronauts. NASA has never made such an admission. The source is not credible.",
                tips: "Be extremely skeptical of claims that contradict easily verifiable facts.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Doctors discover that medicine actually makes diseases worse",
                source: "MedicalSystemTruth.org",
                isFactual: false,
                explanation: "This is misleading. While medical errors occur, the overall benefit of medicine is well-documented. No credible doctors have made such a claim. The source is not credible.",
                tips: "Be extremely skeptical of claims that attack entire fields of science without credible evidence.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Shocking: Study proves that gravity doesn't actually exist",
                source: "PhysicsRevolution.net",
                isFactual: false,
                explanation: "This is completely false. Gravity is one of the fundamental forces of nature, well-documented and essential to physics. The source is not credible.",
                tips: "Be extremely skeptical of claims that contradict fundamental laws of physics.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "BREAKING: Major university admits all their research is fabricated",
                source: "AcademicTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. While research fraud occurs, no major university has admitted to fabricating all research. The source is not credible and appears designed to undermine trust in science.",
                tips: "Be skeptical of claims that attack entire institutions, especially from unknown sources.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Scientists discover that the human brain is actually shrinking",
                source: "BrainScienceUpdate.com",
                isFactual: false,
                explanation: "This is misleading. While some studies suggest slight changes in brain size over evolutionary time, there's no evidence of current shrinking. The source misrepresents research. The source is not credible.",
                tips: "Be wary of health claims that oversimplify or misrepresent complex scientific findings.",
                level: 2,
                category: "health"
            },
            {
                headline: "Exclusive: Tech company admits their AI is actually sentient and planning takeover",
                source: "AITruthRevealed.net",
                isFactual: false,
                explanation: "This is misleading. While AI capabilities are advancing, there's no evidence of sentient AI or takeover plans. No major tech company has made such an admission. The source is not credible.",
                tips: "Be skeptical of sensational claims about AI, especially from unknown sources.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Breaking: Study finds that hospitals are actually making people sicker",
                source: "HealthcareSystemExposed.org",
                isFactual: false,
                explanation: "This is misleading. While hospital-acquired infections occur, hospitals overall save countless lives. The source misrepresents the data. The source is not credible.",
                tips: "Be wary of claims that attack entire healthcare systems without proper context.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Doctors shocked: New research proves that surgery is actually harmful",
                source: "SurgicalTruthRevealed.com",
                isFactual: false,
                explanation: "This is misleading. While surgery has risks, it saves countless lives. No credible research has proven surgery is overall harmful. The source is not credible.",
                tips: "Be extremely skeptical of medical claims that contradict well-established medical practices.",
                level: 2,
                category: "health"
            },
            {
                headline: "BREAKING: Government admits to controlling people's thoughts with technology",
                source: "MindControlTruth.org",
                isFactual: false,
                explanation: "This is completely false. While governments use various forms of influence, there's no technology that can control thoughts. The source is not credible.",
                tips: "Be extremely skeptical of claims about mind control technology, especially from unknown sources.",
                level: 1,
                category: "conspiracy"
            },
            
            // REAL NEWS STORIES WITH SOURCES
            {
                headline: "Russia launches full-scale invasion of Ukraine, triggering major sanctions and military aid from dozens of countries",
                source: "Wikipedia",
                isFactual: true,
                explanation: "This is factual. Russia's full-scale invasion of Ukraine began in February 2022, leading to unprecedented international sanctions, military aid packages from NATO and other countries, and a fundamental reshaping of European security alliances. Source: https://en.wikipedia.org/wiki/Russo-Ukrainian_War",
                tips: "Wikipedia can be a reliable starting point for major historical events, but always verify with primary sources and established news outlets.",
                level: 2,
                category: "politics"
            },
            {
                headline: "Middle Eastern crisis escalates with Red Sea attacks, Houthi involvement, and major impacts on global shipping and trade",
                source: "Wikipedia",
                isFactual: true,
                explanation: "This is factual. The ongoing Middle Eastern crisis since 2023 has included Houthi attacks on shipping in the Red Sea, proxy engagements, and significant disruptions to global trade routes affecting ports and logistics worldwide. Source: https://en.wikipedia.org/wiki/Red_Sea_crisis",
                tips: "Major geopolitical events affecting global trade are typically well-documented by multiple international news sources.",
                level: 2,
                category: "politics"
            },
            {
                headline: "Analysis: Donald Trump's influence on U.S. culture and governance shows pattern of symbolic acts and institutional changes",
                source: "The Guardian",
                isFactual: true,
                explanation: "This is factual. The Guardian has published analysis examining Donald Trump's impact on U.S. political culture, governance patterns, and institutional changes. The Guardian is a reputable international news source known for quality analysis. Source: https://www.theguardian.com",
                tips: "The Guardian is a well-established, reputable news organization known for quality journalism and political analysis.",
                level: 3,
                category: "politics"
            },
            {
                headline: "U.S. judge blocks deportation of pro-Palestinian activist, sparking debates about free speech, immigration, and executive power",
                source: "The Guardian",
                isFactual: true,
                explanation: "This is factual. U.S. courts have issued rulings blocking deportations of activists, raising questions about the intersection of free speech rights, immigration law, and executive authority. The Guardian is a reputable international news source. Source: https://www.theguardian.com",
                tips: "The Guardian is a well-established, reputable news organization known for quality journalism.",
                level: 3,
                category: "politics"
            },
            {
                headline: "United States and Ukraine sign major economic deal aimed at attracting global investment into Ukraine's post-war recovery",
                source: "Associated Press",
                isFactual: true,
                explanation: "This is factual. The U.S. and Ukraine have signed significant economic agreements to support Ukraine's recovery and attract international investment. AP News is a highly credible news agency. Source: https://apnews.com",
                tips: "Associated Press (AP) is one of the world's most trusted news agencies, used by news outlets globally.",
                level: 2,
                category: "business"
            },
            {
                headline: "Journalists honored with award for coverage of healthcare CEO assassination, recognized for major crime-reporting story",
                source: "New York Post",
                isFactual: true,
                explanation: "This is factual. Journalists have been recognized with awards for their coverage of high-profile crime stories, including the assassination of healthcare executives. The New York Post is an established news outlet. Source: https://nypost.com",
                tips: "Established news outlets like the New York Post are reliable sources for verified news stories, though be aware of editorial perspectives.",
                level: 2,
                category: "news"
            },
            {
                headline: "2024's biggest news stories include natural disasters, major political shifts, AI's rise, and global economic headlines",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. 2024 has been marked by significant natural disasters, political changes, AI developments, and major economic news. The Wall Street Journal is a highly reputable financial news source. Source: https://www.wsj.com",
                tips: "The Wall Street Journal is one of the most respected financial and general news publications in the world.",
                level: 1,
                category: "news"
            },
            {
                headline: "Trade and shipping disruptions intensify due to Red Sea crisis, affecting global logistics and major ports worldwide",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. The Red Sea crisis has caused significant disruptions to global shipping routes, affecting logistics chains and port operations around the world. The Wall Street Journal is a highly credible source. Source: https://www.wsj.com",
                tips: "Major economic disruptions affecting global trade are typically well-documented by financial news outlets.",
                level: 2,
                category: "business"
            },
            {
                headline: "NVIDIA reaches market valuation making it one of the world's most valuable companies, driven by artificial intelligence growth",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. NVIDIA's market capitalization has reached historic highs, making it among the most valuable companies globally, largely due to demand for AI chips. The Wall Street Journal is a highly reputable financial news source. Source: https://www.wsj.com",
                tips: "Stock market valuations from established financial news sources are reliable and verifiable through public market data.",
                level: 1,
                category: "business"
            },
            {
                headline: "Climate-linked extreme weather escalates: heavy floods in Brazil and discussions about warming beyond 1.5°C threshold",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. Extreme weather events linked to climate change have intensified, including devastating floods in Brazil, while scientists discuss the possibility of exceeding the 1.5°C warming limit. The Wall Street Journal is a reputable source. Source: https://www.wsj.com",
                tips: "Climate data from established news sources is typically based on scientific reports from meteorological and climate agencies.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Dual U.S.-Russian citizen living in Los Angeles arrested in Russia on treason charges for allegedly fundraising for Ukraine's army",
                source: "Financial Times",
                isFactual: true,
                explanation: "This is factual. Russia has arrested dual citizens on treason charges related to supporting Ukraine. Financial Times is a highly reputable international news source. Source: https://www.ft.com",
                tips: "Financial Times is one of the world's most respected international news publications, known for quality journalism.",
                level: 3,
                category: "politics"
            },
            {
                headline: "U.S. southern border faces large migrant flows, policy pressure, and significant humanitarian challenges",
                source: "Council on Foreign Relations",
                isFactual: true,
                explanation: "This is factual. The U.S. southern border has experienced large-scale migration, creating policy challenges and humanitarian concerns. The Council on Foreign Relations is a respected think tank providing analysis on international affairs. Source: https://www.cfr.org",
                tips: "Think tanks like CFR provide expert analysis, but always cross-reference with news sources for current events.",
                level: 2,
                category: "politics"
            },
            {
                headline: "Major shift in U.S. foreign policy away from nation-building towards strategic competition with China and Russia",
                source: "Wikipedia",
                isFactual: true,
                explanation: "This is factual. U.S. foreign policy has shifted from nation-building efforts (like in Afghanistan) toward focusing on strategic competition with major powers like China and Russia. Source: https://en.wikipedia.org/wiki/United_States_foreign_policy",
                tips: "Major policy shifts are documented by government sources and verified by multiple news outlets.",
                level: 3,
                category: "politics"
            },
            {
                headline: "Large New Year's Day earthquake in Japan causes hundreds of deaths and triggers tsunami warnings",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. A major earthquake struck Japan on New Year's Day 2024, resulting in hundreds of fatalities and triggering tsunami warnings. The Wall Street Journal is a reputable news source. Source: https://www.wsj.com",
                tips: "Natural disasters are typically immediately reported by major news outlets and verified by government agencies.",
                level: 1,
                category: "breaking"
            },
            {
                headline: "Weeks of flooding in Brazil kill over 100 people, displace hundreds of thousands, and leave towns uninhabitable",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. Brazil experienced severe flooding in 2024, resulting in over 100 deaths, massive displacement, and making some areas uninhabitable. The Wall Street Journal is a reputable source. Source: https://www.wsj.com",
                tips: "Natural disaster statistics are typically verified by government emergency management agencies and reported by major news outlets.",
                level: 2,
                category: "breaking"
            },
            {
                headline: "U.S. Supreme Court strikes down ban on bump stocks in major gun-rights ruling",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. The U.S. Supreme Court has issued rulings affecting bump stock regulations, with significant implications for gun rights. The Wall Street Journal is a highly reputable source. Source: https://www.wsj.com",
                tips: "Supreme Court rulings are official government documents and are reported by all major news outlets.",
                level: 2,
                category: "politics"
            },
            {
                headline: "U.S. dockworkers strike at major ports handling significant import and export volume",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. Dockworker strikes at major U.S. ports have occurred, affecting significant portions of the country's import and export trade. The Wall Street Journal is a reputable source. Source: https://www.wsj.com",
                tips: "Labor strikes affecting major infrastructure are typically reported by multiple news outlets and verified through union and company statements.",
                level: 2,
                category: "business"
            },
            {
                headline: "High-profile university president resigns amid controversy over antisemitism and plagiarism allegations",
                source: "The Wall Street Journal",
                isFactual: true,
                explanation: "This is factual. University presidents have resigned following controversies involving allegations of antisemitism and academic misconduct. The Wall Street Journal is a reputable source. Source: https://www.wsj.com",
                tips: "Major institutional leadership changes are typically reported by multiple news outlets and verified through official statements.",
                level: 2,
                category: "education"
            },
            {
                headline: "Earth expected to surpass 1.5°C warming threshold; global climate summit addresses ecosystem impacts",
                source: "ABC News",
                isFactual: true,
                explanation: "This is factual. Climate scientists warn that global temperatures may exceed the 1.5°C warming threshold, with international climate summits addressing the implications. ABC News is a reputable news source. Source: https://abcnews.go.com",
                tips: "Climate data comes from scientific organizations like NOAA and IPCC, reported by established news outlets like ABC News.",
                level: 2,
                category: "environment"
            },
            
            // BELIEVABLE FAKE NEWS STORIES
            {
                headline: "New study: Drinking one cup of street coffee a day adds 10 years to your life",
                source: "HealthTrendsDaily.com",
                isFactual: false,
                explanation: "This is misleading. The claim references a vague 'study' with no journal link, likely based on a small sample size and survivorship bias. Real scientific studies are published in peer-reviewed journals with full methodology. The source is not credible.",
                tips: "Always check for original papers, sample sizes, and journal peer review. Vague 'study' claims without citations are red flags.",
                level: 2,
                category: "health"
            },
            {
                headline: "Portland to ban cars entirely next month — official memo leaked",
                source: "CityLeaks.net",
                isFactual: false,
                explanation: "This is misleading. The 'leaked memo' comes from an anonymous source and could be satire or forgery. Major city policy changes are announced through official channels, not leaks. The source is not credible.",
                tips: "Always verify 'leaked' documents by checking official city government websites and press releases. Anonymous leaks are unreliable.",
                level: 2,
                category: "politics"
            },
            {
                headline: "Viral video shows hospital using fake patients to inflate COVID numbers",
                source: "TruthExposedMedia.com",
                isFactual: false,
                explanation: "This is misleading. A single unverified video clip without corroborating reporting could be misinterpreted or staged footage. Real investigative journalism requires multiple sources and verification. The source is not credible.",
                tips: "Single viral videos without context are unreliable. Check hospital statements, multiple eyewitnesses, and video timestamps.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Local bakery's bread tested positive for traces of fentanyl",
                source: "HealthAlertNews.com",
                isFactual: false,
                explanation: "This is misleading. Sensational lab claims without chain of custody or certification from accredited labs are unreliable. Real health alerts come from official health departments with verified testing. The source is not credible.",
                tips: "Health claims require accredited lab reports and official health department alerts. Unverified lab claims are suspicious.",
                level: 2,
                category: "health"
            },
            {
                headline: "Celebrity secretly funds offshore militia, leaked invoice proves it",
                source: "CelebrityExposed.net",
                isFactual: false,
                explanation: "This is misleading. Invoices are easy to forge and the chain of custody is unknown. Real investigative reporting requires forensic document analysis and verification from reputable outlets. The source is not credible.",
                tips: "Leaked documents require forensic verification. Check reputable investigative outlets for verified claims.",
                level: 3,
                category: "conspiracy"
            },
            {
                headline: "Map proving city borders were redrawn to exclude poor neighborhoods",
                source: "UrbanTruth.org",
                isFactual: false,
                explanation: "This is misleading. Maps can be doctored, use old boundaries, or wrong scales. Official boundary changes are documented in cadastral records with date stamps. The source is not credible.",
                tips: "Always verify maps against official cadastral records and check date stamps. Maps can be easily manipulated.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "School textbook removes math section to push political agenda",
                source: "EducationWatch.net",
                isFactual: false,
                explanation: "This is misleading. Claims designed to provoke moral panic often misread curriculum updates or take excerpts out of context. Real curriculum changes are documented in board minutes and publisher errata. The source is not credible.",
                tips: "Check publisher errata and curriculum board minutes. Claims designed to provoke outrage are often misleading.",
                level: 2,
                category: "education"
            },
            {
                headline: "New AI app can read minds with 70% accuracy",
                source: "TechRevolution.com",
                isFactual: false,
                explanation: "This is misleading. Overhyped tech press releases without peer-reviewed evidence and ambiguous definitions are unreliable. Real AI breakthroughs are published in peer-reviewed journals with replicable methods. The source is not credible.",
                tips: "Extraordinary tech claims require peer-reviewed evidence, demos, and replicability. Press releases alone are insufficient.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Satellite photo proves famous monument was moved overnight",
                source: "SatelliteTruth.net",
                isFactual: false,
                explanation: "This is misleading. Old satellite images can be reposted with new captions or have altered metadata. Real satellite imagery has verifiable metadata, timestamps, and comes from providers like Sentinel or Landsat. The source is not credible.",
                tips: "Always check image metadata, source provider, and timestamps. Satellite images can be mislabeled or repurposed.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Study: Eating oranges prevents all forms of cancer",
                source: "NaturalCureDaily.com",
                isFactual: false,
                explanation: "This is misleading. Absolute health claims are almost always false. Real studies show correlations, not absolute prevention, and are verified through meta-analyses. The source is not credible.",
                tips: "Be extremely skeptical of absolute health claims. Check meta-analyses, study disclaimers, and potential conflicts of interest.",
                level: 1,
                category: "health"
            },
            {
                headline: "Charity steals donations — undercover footage surfaces",
                source: "CharityWatchExposed.com",
                isFactual: false,
                explanation: "This is misleading. Single undercover clips can be edited or staged. Charities are vulnerable to smear campaigns. Real investigations require audited financial statements and multiple-source verification. The source is not credible.",
                tips: "Check charity audited statements and multiple-source investigations. Single videos can be edited or staged.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Government quietly raises sales tax to 50% — leaked spreadsheet",
                source: "TaxLeaks.org",
                isFactual: false,
                explanation: "This is misleading. Spreadsheets without signatures could be mockups. Real tax changes are documented in official budget documents and legislative records. The source is not credible.",
                tips: "Verify tax changes through official budget documents and legislative records. Leaked spreadsheets are easily faked.",
                level: 2,
                category: "politics"
            },
            {
                headline: "Town's tap water found to contain microchips",
                source: "WaterSafetyAlert.com",
                isFactual: false,
                explanation: "This is misleading. This claim is physically improbable and likely based on misinterpreted microscopy images. Real water safety issues are verified through accredited lab tests. The source is not credible.",
                tips: "Extraordinary claims require extraordinary evidence from accredited labs. Physically improbable claims are red flags.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "New drug cures Alzheimer's in mice; human trials start next week",
                source: "MedicalBreakthrough.net",
                isFactual: false,
                explanation: "This is misleading. Preclinical mouse results are routine in drug development, but leaps to human cures are premature. Real drug development requires years of clinical trials registered with regulatory agencies. The source is not credible.",
                tips: "Mouse study results don't guarantee human success. Check clinical trial registrations and peer review before believing cure claims.",
                level: 2,
                category: "health"
            },
            {
                headline: "Photo shows politician at foreign rally — proves treason",
                source: "PoliticalExposed.com",
                isFactual: false,
                explanation: "This is misleading. Photos can be cropped, misattributed, or from old events. Real verification requires reverse image search and checking original context. The source is not credible.",
                tips: "Always reverse image search photos and verify original context. Photos can be cropped, misattributed, or from old events.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Study finds city's air quality improves COVID survival by 90%",
                source: "HealthResearchDaily.com",
                isFactual: false,
                explanation: "This is misleading. This claim confuses correlation with causation and likely uses a small or biased dataset. Real scientific consensus requires multiple studies and rigorous methodology. The source is not credible.",
                tips: "Correlation doesn't prove causation. Check multiple studies and methodology before believing dramatic health claims.",
                level: 2,
                category: "health"
            },
            {
                headline: "Exclusive: Airline uses passengers for product ads mid-flight",
                source: "TravelExposed.net",
                isFactual: false,
                explanation: "This is misleading. Single passenger claims could be misunderstandings or PR stunts. Real airline policies are documented in terms of service and passenger manifests. The source is not credible.",
                tips: "Check airline official statements and terms of service. Single claims without verification are unreliable.",
                level: 2,
                category: "business"
            },
            {
                headline: "Hologram technology used to fake news anchor's broadcast",
                source: "MediaTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. This sounds like deepfake fear-mongering. Real verification requires forensic audio/image analysis of source video. The source is not credible.",
                tips: "Check source video and use forensic audio/image analysis. Deepfake claims require technical verification.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Neighborhood turned into wildlife preserve overnight; residents not told",
                source: "UrbanDevelopmentWatch.org",
                isFactual: false,
                explanation: "This is misleading. Zoning changes are public processes documented in municipal council meeting minutes and planning maps. Major changes can't happen 'overnight' without public notice. The source is not credible.",
                tips: "Check municipal council meeting minutes and planning maps. Zoning changes are public processes with required notice.",
                level: 2,
                category: "politics"
            },
            {
                headline: "University revokes degrees en masse for ideological reasons",
                source: "AcademicFreedomWatch.net",
                isFactual: false,
                explanation: "This is misleading. Sweeping claims with no documented cases could be coordinated rumors. Real degree revocations are documented in registrar records and official announcements. The source is not credible.",
                tips: "Check registrar records and official announcements. Sweeping claims without documentation are suspicious.",
                level: 2,
                category: "education"
            },
            {
                headline: "Photos show vaccine vials filled with saline at clinics",
                source: "VaccineTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. Photos can be staged and lack chain of custody and context. Real vaccine distribution requires clinic audits and multiple independent investigations. The source is not credible.",
                tips: "Check clinic audits and multiple independent investigations. Photos can be staged or taken out of context.",
                level: 1,
                category: "health"
            },
            {
                headline: "One company owns 90% of the world's bread flour, prices to triple",
                source: "MarketWatchExposed.com",
                isFactual: false,
                explanation: "This is misleading. Monopoly claims require regulatory filings and market data verification. This likely misreads market share reports. Real market data is available through trade filings. The source is not credible.",
                tips: "Check market data and trade filings. Monopoly claims require regulatory verification.",
                level: 2,
                category: "business"
            },
            {
                headline: "Mayor signs law to change official language to 'Global English'",
                source: "CityPolicyLeaks.com",
                isFactual: false,
                explanation: "This is misleading. Extreme policy changes like this are likely from satire or misquotes. Real policy changes are documented in city charters and official translations. The source is not credible.",
                tips: "Check city charter and official translations. Extreme claims are often satire or misquotes.",
                level: 1,
                category: "politics"
            },
            {
                headline: "Weather forecast screenshot shows city underwater next week — evacuation imminent",
                source: "WeatherAlertNews.com",
                isFactual: false,
                explanation: "This is misleading. Weather model screenshots can be faked or edited. Real weather forecasts come from National Weather Service or official meteorological agencies. The source is not credible.",
                tips: "Always check National Weather Service or official meteorological agency releases. Screenshots can be faked.",
                level: 1,
                category: "weather"
            },
            {
                headline: "Teacher replaced entire curriculum with political pamphlets",
                source: "EducationWatchdog.net",
                isFactual: false,
                explanation: "This is misleading. Single-parent social media posts without corroboration could be misunderstandings of materials. Real curriculum changes are documented in school board records and syllabi. The source is not credible.",
                tips: "Check school board records and syllabi. Single social media posts without verification are unreliable.",
                level: 2,
                category: "education"
            },
            {
                headline: "Bank introduces negative interest for all personal accounts",
                source: "BankingAlert.com",
                isFactual: false,
                explanation: "This is misleading. Banks announce major policy changes through formal communication channels. Sensational posts about banking policies are often scams. Real banking policies are announced through official notices. The source is not credible.",
                tips: "Check bank official notices and central bank regulations. Sensational banking claims are often scams.",
                level: 2,
                category: "business"
            },
            {
                headline: "Popular food brand recalls due to human hair contamination — video shows factory",
                source: "FoodSafetyAlert.net",
                isFactual: false,
                explanation: "This is misleading. Viral clips could be from different factories, countries, or old footage. Real food recalls are announced through company recall notices and inspection reports. The source is not credible.",
                tips: "Check company recall notices and inspection reports. Viral videos may be from different locations or old footage.",
                level: 2,
                category: "health"
            },
            {
                headline: "Secret treaty transfers Arctic territory to private company",
                source: "DiplomaticLeaks.org",
                isFactual: false,
                explanation: "This is misleading. Territorial transfers involve treaties and UN records that are publicly accessible. Such transfers can't be 'secret.' Real treaties are registered in treaty registries. The source is not credible.",
                tips: "Check treaty registries and diplomatic records. Territorial transfers are public processes, not secret.",
                level: 3,
                category: "conspiracy"
            },
            {
                headline: "Influencer claims to have turned $100 into $1M with new token",
                source: "CryptoSuccessStories.com",
                isFactual: false,
                explanation: "This is misleading. This is a typical pump-and-dump crypto pitch lacking verifiable transaction history. Real cryptocurrency transactions are verifiable on blockchain explorers. The source is not credible.",
                tips: "Check blockchain explorers and exchange listings. Crypto success stories without verifiable transactions are scams.",
                level: 2,
                category: "scam"
            },
            {
                headline: "Viral graph shows crime dropped 80% after policy X — but graph has truncated y-axis",
                source: "DataVisualizationNews.com",
                isFactual: false,
                explanation: "This is misleading. Truncated y-axes create misleading visualizations that exaggerate effects. Real data analysis requires checking raw numbers and data sources. The source is not credible.",
                tips: "Always check raw numbers and data sources. Truncated graph axes can be misleading.",
                level: 2,
                category: "misinformation"
            },
            {
                headline: "Police department caught deleting bodycam from high-profile arrest",
                source: "PoliceWatchExposed.net",
                isFactual: false,
                explanation: "This is misleading. Allegations require FOIA requests and administrative records. Single anonymous sources are insufficient. Real verification requires official bodycam logs and audits. The source is not credible.",
                tips: "Check official bodycam logs and audits. Single anonymous sources are insufficient for serious allegations.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Study: Taking selfies reduces risk of dementia",
                source: "HealthResearchDaily.com",
                isFactual: false,
                explanation: "This is misleading. This is likely cherry-picked correlation with sensational headline. Real studies account for sample representativeness and confounders. The source is not credible.",
                tips: "Check for sample representativeness and confounders. Cherry-picked correlations are misleading.",
                level: 2,
                category: "health"
            },
            {
                headline: "Fake news site claims extinct bird species spotted in suburban park",
                source: "WildlifeWatchExposed.com",
                isFactual: false,
                explanation: "This is misleading. Claims about rare species require expert verification. This is likely a misidentified common species. Real wildlife sightings are verified by expert ornithologists and birdwatching groups. The source is not credible.",
                tips: "Check birdwatching groups and expert ornithologists. Rare species claims require expert verification.",
                level: 2,
                category: "misinformation"
            },
            {
                headline: "Video shows politician using teleprompter to read false confessions live",
                source: "PoliticalTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. Videos can be edited to create false narratives. Real verification requires checking full footage and original broadcast sources. The source is not credible.",
                tips: "Check full footage and original broadcast sources. Videos can be edited to mislead.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Study leaked: sugar company paid researchers to hide obesity links",
                source: "IndustryLeaks.org",
                isFactual: false,
                explanation: "This is misleading. While industry influence is real, leaks require documentation. Real verification checks funding disclosures and original studies. The source is not credible.",
                tips: "Check funding disclosures and original studies. Leaks require documentation to be credible.",
                level: 3,
                category: "conspiracy"
            },
            {
                headline: "Company claims their face-scan vaccine is 99% effective",
                source: "TechMedicalNews.com",
                isFactual: false,
                explanation: "This is misleading. Unverifiable corporate claims without trial data are unreliable. Real medical products require regulatory approvals and independent trials. The source is not credible.",
                tips: "Check regulatory approvals and independent trials. Corporate claims without data are unreliable.",
                level: 2,
                category: "health"
            },
            {
                headline: "Map shows refugee camp relocated to wealthy suburb — proof of conspiracy",
                source: "GeographicTruthExposed.net",
                isFactual: false,
                explanation: "This is misleading. Maps can have mislabeled layers, old imagery, or geolocation errors. Real verification requires checking coordinates and official humanitarian sources. The source is not credible.",
                tips: "Check coordinates and official humanitarian sources. Map errors and mislabeling are common.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Photo proves two rival politicians met secretly in foreign country",
                source: "DiplomaticExposed.com",
                isFactual: false,
                explanation: "This is misleading. Photos could be from unrelated events or doctored. Real verification requires reverse image search and metadata analysis. The source is not credible.",
                tips: "Always reverse image search photos and check metadata. Photos can be from unrelated events or doctored.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Warning: new app drains phone battery overnight and sells data",
                source: "AppSecurityAlert.com",
                isFactual: false,
                explanation: "This is misleading. Viral claims often lack app permissions analysis. Real verification requires checking app store reviews, permissions lists, and antivirus scans. The source is not credible.",
                tips: "Check app store reviews, permissions list, and AV scans. Viral security claims need technical verification.",
                level: 2,
                category: "technology"
            },
            {
                headline: "Local company used cancer cells to test product in dorms",
                source: "ResearchEthicsExposed.net",
                isFactual: false,
                explanation: "This is misleading. Highly inflammatory claims require lab access and ethical approvals. Real research involving human cells requires IRB notices and lab records. The source is not credible.",
                tips: "Check IRB notices and lab records. Research involving human cells requires ethical approvals.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Audio leak: CEO admits to price-fixing on company podcast",
                source: "CorporateLeaks.org",
                isFactual: false,
                explanation: "This is misleading. Audio can be edited or deepfaked. Real verification requires full recording access and voice forensics. The source is not credible.",
                tips: "Verify via full recording and voice forensics. Audio can be edited or deepfaked.",
                level: 3,
                category: "conspiracy"
            },
            {
                headline: "Hospital posts on social media offering 'miracle' therapy for infertility",
                source: "MedicalMiracleNews.com",
                isFactual: false,
                explanation: "This is misleading. Medical claims on social media need scrutiny. Real medical treatments require clinical trials and peer review. The source is not credible.",
                tips: "Check clinical trials and peer review. Medical claims on social media are often unverified.",
                level: 2,
                category: "health"
            },
            {
                headline: "New pipeline will siphon river to private resorts — environmentalists silenced",
                source: "EnvironmentalTruthExposed.net",
                isFactual: false,
                explanation: "This is misleading. Activist language suggests bias. Real infrastructure projects require environmental impact assessments and permits that are publicly accessible. The source is not credible.",
                tips: "Check environmental impact assessments and permits. Activist language may indicate bias.",
                level: 2,
                category: "environment"
            },
            {
                headline: "Study shows early school start times boost test scores by 50%",
                source: "EducationResearchDaily.com",
                isFactual: false,
                explanation: "This is misleading. Implausibly large effect sizes are red flags. Real studies show modest effects and require replication. The source is not credible.",
                tips: "Check study controls and replicability. Implausibly large effect sizes are suspicious.",
                level: 2,
                category: "education"
            },
            {
                headline: "Viral post: landmark building collapsing tonight due to unpaid taxes",
                source: "CityAlertNews.com",
                isFactual: false,
                explanation: "This is misleading. Buildings don't collapse overnight from unpaid taxes. Real building safety requires inspection records and structural engineer assessments. The source is not credible.",
                tips: "Check building inspection records and structural engineers. Buildings don't collapse overnight from taxes.",
                level: 1,
                category: "misinformation"
            },
            {
                headline: "Alert: 5G towers cause localized heat waves — citizen footage",
                source: "5GTruthExposed.com",
                isFactual: false,
                explanation: "This is misleading. Scientific consensus rejects this claim. Footage is likely misattributed or shows thermal camera misreadings. Real science requires vetted sources. The source is not credible.",
                tips: "Check vetted science sources. Scientific consensus rejects 5G health claims.",
                level: 1,
                category: "conspiracy"
            },
            {
                headline: "Breaking: local bank paid hackers to launder money, internal memo leaked",
                source: "BankingLeaksExposed.net",
                isFactual: false,
                explanation: "This is misleading. Memo authenticity needs verification. Real financial crimes are documented in regulatory filings and bank statements. The source is not credible.",
                tips: "Check regulatory filings and bank statements. Leaked memos require authentication.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Video shows politician switching badges to enter restricted area",
                source: "SecurityExposed.com",
                isFactual: false,
                explanation: "This is misleading. Clips may be sped up or cut. Real verification requires full CCTV footage and badge access logs. The source is not credible.",
                tips: "Check full CCTV and badge logs. Video clips can be edited or taken out of context.",
                level: 2,
                category: "conspiracy"
            },
            {
                headline: "Study: owning a pet doubles your income — correlation proves causation",
                source: "LifestyleResearchDaily.com",
                isFactual: false,
                explanation: "This is misleading. This confuses correlation with causation and likely has reverse causality (higher income people can afford pets). Real studies account for confounders and study design. The source is not credible.",
                tips: "Correlation doesn't prove causation. Check study design for reverse causality and confounders.",
                level: 2,
                category: "misinformation"
            },
            {
                headline: "News site claims mountain range moved 3 miles after new highway built",
                source: "GeologyNewsExposed.com",
                isFactual: false,
                explanation: "This is misleading. Geology doesn't shift overnight. This is likely a miscaptioned geological map or satire. Real geological changes require geospatial data and authoritative geology sources. The source is not credible.",
                tips: "Check geospatial data and authoritative geology sources. Geology doesn't change overnight.",
                level: 1,
                category: "misinformation"
            }
        ];
        
        // Filter questions based on difficulty level
        // Easy: levels 1-2 (beginner-friendly questions)
        // Medium: levels 2-3 (moderate difficulty)
        // Hard: levels 3-5 (challenging questions)
        let filteredQuestions;
        switch(this.difficulty) {
            case 'easy':
                filteredQuestions = allQuestions.filter(q => q.level <= 2);
                break;
            case 'medium':
                filteredQuestions = allQuestions.filter(q => q.level >= 2 && q.level <= 3);
                break;
            case 'hard':
                filteredQuestions = allQuestions.filter(q => q.level >= 3);
                break;
            default:
                filteredQuestions = allQuestions;
        }
        
        // If filtered list is too small, fall back to all questions
        if (filteredQuestions.length < 10) {
            console.warn(`Only ${filteredQuestions.length} questions for difficulty ${this.difficulty}, using all questions`);
            filteredQuestions = allQuestions;
        }
        
        // Shuffle the filtered questions array using Fisher-Yates algorithm
        return this.shuffleArray(filteredQuestions);
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    initializeGame() {
        console.log('initializeGame called');
        this.bindEvents();
        this.initAudio();
        this.initBackgroundMusic();
        this.createParticles();
        this.setupGlitchEffects();
        this.initMatrixRain();
        this.initLogoAnimation(); // Initialize logo animation with puzzle piece sound
        this.showStartScreen();
        
        // Sync with global music state
        const syncMusicState = () => {
            if (typeof window.getGlobalMusicState === 'function') {
                const state = window.getGlobalMusicState();
                this.musicEnabled = state.enabled;
                this.isMusicPlaying = state.isPlaying;
            }
            this.updateMusicButton();
        };
        
        // Sync music state periodically and on events
        syncMusicState();
        setInterval(syncMusicState, 2000); // Check every 2 seconds
        
        // Listen for music state changes on global audio elements
        ['play', 'pause', 'ended'].forEach(event => {
            const bgMusic = document.getElementById('backgroundMusic');
            if (bgMusic) {
                bgMusic.addEventListener(event, syncMusicState);
            }
        });
        
        // Also try to start game's own music if global music isn't available
        const startMusicOnInteraction = () => {
            if (!this.isMusicPlaying && this.musicEnabled) {
                if (typeof window.toggleGlobalMusic !== 'function') {
                    this.startBackgroundMusic();
                }
            }
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
        };
        
        document.addEventListener('click', startMusicOnInteraction);
        document.addEventListener('touchstart', startMusicOnInteraction);
        
        // Show dark mode notification after a delay
        setTimeout(() => {
            // Dark mode notification removed
        }, 2000);
    }
    
    createParticles() {
        // Create lightweight particles for mobile, full version for desktop
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) {
            // Lightweight version for mobile - just a few particles
            const particlesContainer = document.createElement('div');
            particlesContainer.className = 'particles';
            document.body.appendChild(particlesContainer);
            
            // Create 8 floating particles for mobile
            for (let i = 0; i < CONFIG.EFFECTS.SPARKLE_COUNT; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 8 + 's';
                particle.style.animationDuration = (Math.random() * 4 + 6) + 's';
                particle.style.opacity = Math.random() * 0.4 + 0.1;
                particlesContainer.appendChild(particle);
            }
            return;
        }
        
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles';
        document.body.appendChild(particlesContainer);
        
        // Create 25 floating particles (reduced for performance)
        for (let i = 0; i < 25; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.animationDuration = (Math.random() * 4 + 6) + 's';
            particle.style.opacity = Math.random() * 0.6 + 0.2;
            particlesContainer.appendChild(particle);
        }
    }
    
    setupGlitchEffects() {
        // Create lightweight glitch effects for mobile, full version for desktop
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) {
            // Lightweight version for mobile - just title glitch
            const title = document.querySelector('.header h1');
            if (title) {
                title.setAttribute('data-text', title.textContent);
            }
            
            // Very occasional screen glitch for mobile
            setInterval(() => {
                this.createScreenGlitch();
            }, 15000); // Much less frequent on mobile
            return;
        }
        
        // Add glitch effect to the main title
        const title = document.querySelector('.header h1');
        if (title) {
            title.setAttribute('data-text', title.textContent);
        }
        
        // Add random glitch effects to buttons (reduced frequency)
        setInterval(() => {
            const buttons = document.querySelectorAll('.btn');
            const randomButton = buttons[Math.floor(Math.random() * buttons.length)];
            if (randomButton) {
                randomButton.style.animation = 'glitchButton 0.2s ease-in-out';
                setTimeout(() => {
                    randomButton.style.animation = '';
                }, 200);
            }
        }, 5000); // Increased interval from 3000 to 5000
        
        // Add screen glitch effect occasionally (reduced frequency)
        setInterval(() => {
            this.createScreenGlitch();
        }, 12000); // Increased interval from 8000 to 12000
    }
    
    createScreenGlitch() {
        const glitchOverlay = document.createElement('div');
        glitchOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(45deg, transparent 30%, rgba(255, 0, 255, 0.1) 50%, transparent 70%);
            pointer-events: none;
            z-index: 9998;
            animation: screenGlitch 0.3s ease-in-out;
        `;
        
        document.body.appendChild(glitchOverlay);
        
        setTimeout(() => {
            if (glitchOverlay.parentNode) {
                glitchOverlay.parentNode.removeChild(glitchOverlay);
            }
        }, 300);
    }
    
    initMatrixRain() {
        const matrixContainer = document.querySelector('.matrix-rain');
        if (!matrixContainer) return;
        
        // Create lightweight matrix rain for mobile, full version for desktop
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) {
            // Lightweight version for mobile - just a few characters
            matrixContainer.innerHTML = '';
            const characters = '01█▓▒░';
            const numCharacters = 15; // Very few for mobile
            
            for (let i = 0; i < numCharacters; i++) {
                const character = document.createElement('div');
                const randomChar = characters[Math.floor(Math.random() * characters.length)];
                
                character.textContent = randomChar;
                character.style.cssText = `
                    position: absolute;
                    top: -20px;
                    left: ${Math.random() * 100}%;
                    font-family: 'Courier New', monospace;
                    font-size: ${16 + Math.random() * 8}px;
                    color: #4A90E2;
                    text-shadow: 0 0 8px #4A90E2;
                    animation: hailFall ${3 + Math.random() * 2}s linear infinite;
                    animation-delay: ${Math.random() * 3}s;
                    opacity: ${0.4 + Math.random() * 0.3};
                    z-index: 1;
                    font-weight: bold;
                `;
                
                matrixContainer.appendChild(character);
            }
            return;
        }
        
        // Clear existing content
        matrixContainer.innerHTML = '';
        
        // Create individual falling characters like hail
        const characters = '01█▓▒░▄▌▐▀▬▫▪▮▯▰▱▲△▴▵▶▷▸▹►▻▼▽▾▿◀◁◂◃◄◅◆◇◈◉◊○◐◑◒◓◔◕◖◗◘◙◚◛◜◝◞◟◠◡◢◣◤◥◦◧◨◩◪◫◬◭◮◯◰◱◲◳◴◵◶◷◸◹◺◻◼◽◾◿';
        const numCharacters = 150; // Reduced for better performance
        
        for (let i = 0; i < numCharacters; i++) {
            const character = document.createElement('div');
            const randomChar = characters[Math.floor(Math.random() * characters.length)];
            
            character.textContent = randomChar;
            character.style.cssText = `
                position: absolute;
                top: -20px;
                left: ${Math.random() * 100}%;
                font-family: 'Courier New', monospace;
                font-size: ${20 + Math.random() * 15}px;
                color: #4A90E2;
                text-shadow: 0 0 15px #4A90E2, 0 0 25px rgba(74, 144, 226, 0.8), 0 0 35px rgba(74, 144, 226, 0.6);
                animation: hailFall ${2 + Math.random() * 3}s linear infinite;
                animation-delay: ${Math.random() * 4}s;
                opacity: ${0.6 + Math.random() * 0.4};
                z-index: 1;
                font-weight: bold;
            `;
            
            matrixContainer.appendChild(character);
        }
    }
    
    bindEvents() {
        console.log('bindEvents called');
        
        const startBtn = document.getElementById('startBtn');
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        const nextBtn = document.getElementById('nextBtn');
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        const restartBtn = document.getElementById('restartBtn');
        const requiredEls = [startBtn, factBtn, fakeBtn, nextBtn, nextHeadlineBtn, restartBtn];
        
        console.log('Start button found:', !!startBtn);
        console.log('Fact button found:', !!factBtn);
        console.log('Fake button found:', !!fakeBtn);
        console.log('Next button found:', !!nextBtn);
        console.log('Next headline button found:', !!nextHeadlineBtn);
        console.log('Restart button found:', !!restartBtn);
        
        // If none of the core controls exist, we are not on the game UI; bail safely
        if (requiredEls.every(el => !el)) {
            console.warn('Game UI controls not found; skipping event bindings');
            return;
        }

        if (startBtn) {
            const startHandler = () => {
                console.log('Start button clicked');
                this.playSound('button', 'navigation');
                this.startGame();
            };
            startBtn.addEventListener('click', startHandler);
            startBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startHandler();
            });
        }
        
        if (factBtn) {
            const factHandler = () => {
                console.log('Fact button clicked');
                this.playSound('button', 'factual');
                // Start timer and check answer directly
                this.questionStartTime = Date.now();
                const questionTimerEl = document.getElementById('questionTimer');
                if (questionTimerEl) {
                    questionTimerEl.style.display = 'block';
                }
                this.startQuestionTimer();
                this.checkAnswer(true);
            };
            
            let isScrolling = false;
            let scrollTimeout = null;
            
            factBtn.addEventListener('click', (e) => {
                if (!isScrolling) {
                    factHandler();
                }
            });
            
            factBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!isScrolling) {
                    factHandler();
                }
            });
            
            // Detect scrolling
            document.addEventListener('touchmove', () => {
                isScrolling = true;
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 150); // Wait 150ms after scrolling stops
            }, { passive: true });
        }
        
        if (fakeBtn) {
            const fakeHandler = () => {
                console.log('Fake button clicked');
                this.playSound('button', 'misleading');
                // Start timer and check answer directly
                this.questionStartTime = Date.now();
                const questionTimerEl = document.getElementById('questionTimer');
                if (questionTimerEl) {
                    questionTimerEl.style.display = 'block';
                }
                this.startQuestionTimer();
                this.checkAnswer(false);
            };
            
            let isScrolling = false;
            let scrollTimeout = null;
            
            fakeBtn.addEventListener('click', (e) => {
                if (!isScrolling) {
                    fakeHandler();
                }
            });
            
            fakeBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!isScrolling) {
                    fakeHandler();
                }
            });
            
            // Detect scrolling
            document.addEventListener('touchmove', () => {
                isScrolling = true;
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 150); // Wait 150ms after scrolling stops
            }, { passive: true });
        }
        
        // AI Explanation button handler
        const aiExplanationBtn = document.getElementById('aiExplanationBtn');
        if (aiExplanationBtn) {
            aiExplanationBtn.addEventListener('click', () => {
                if (this.currentQuestion > 0) {
                    const question = this.questions[this.currentQuestion - 1];
                    if (question) {
                        this.getAIExplanation(question);
                    }
                }
            });
        }
        
        if (nextBtn) {
            const nextHandler = () => {
                console.log('Next button clicked');
                this.playSound('button', 'navigation');
                this.nextQuestion();
            };
            nextBtn.addEventListener('click', nextHandler);
            nextBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                nextHandler();
            });
        }
        
        if (nextHeadlineBtn) {
            const nextHeadlineHandler = () => {
                console.log('Next headline button clicked');
                this.playSound('button', 'navigation');
                this.nextQuestion();
            };
            nextHeadlineBtn.addEventListener('click', nextHeadlineHandler);
            nextHeadlineBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                nextHeadlineHandler();
            });
        }
        
        if (restartBtn) {
            const restartHandler = () => {
                console.log('Restart button clicked');
                this.playSound('button', 'navigation');
                this.restartGame();
            };
            restartBtn.addEventListener('click', restartHandler);
            restartBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                restartHandler();
            });
        }
        
        // Difficulty selection
        document.querySelectorAll('.btn-difficulty').forEach(btn => {
            const difficultyHandler = (e) => {
                this.playSound('button', 'toggle');
                document.querySelectorAll('.btn-difficulty').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.difficulty = e.target.dataset.difficulty;
                this.setTimeLimit();
                // Recreate questions with new difficulty filter
                this.questions = this.createAndShuffleQuestions();
                this.currentQuestion = 0; // Reset to first question
            };
            btn.addEventListener('click', difficultyHandler);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                difficultyHandler(e);
            });
        });
        
        // Difficulty toggle buttons
        const difficultyToggleHandler = () => {
            this.playSound('button', 'toggle');
            this.showDifficultyModal();
        };
        
        const difficultyToggle = document.getElementById('difficultyToggle');
        if (difficultyToggle) {
            difficultyToggle.addEventListener('click', difficultyToggleHandler);
            difficultyToggle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                difficultyToggleHandler();
            });
        }
        
        const feedbackDifficultyToggle = document.getElementById('feedbackDifficultyToggle');
        if (feedbackDifficultyToggle) {
            feedbackDifficultyToggle.addEventListener('click', difficultyToggleHandler);
            feedbackDifficultyToggle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                difficultyToggleHandler();
            });
        }
        
        // Tips sidebar functionality
        const tipsToggleHandler = () => {
            this.playSound('button', 'toggle');
            this.toggleTipsSidebar();
        };
        
        const tipsToggleBtn = document.getElementById('tipsToggleBtn');
        if (tipsToggleBtn) {
            tipsToggleBtn.addEventListener('click', tipsToggleHandler);
            tipsToggleBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tipsToggleHandler();
            });
        }
        
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', tipsToggleHandler);
            sidebarToggle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tipsToggleHandler();
            });
        }
        
        // How to Play sidebar functionality
        const howToPlayToggleBtn = document.getElementById('howToPlayToggleBtn');
        if (howToPlayToggleBtn) {
            howToPlayToggleBtn.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.toggleHowToPlaySidebar();
            });
        }
        const howToPlayToggle = document.getElementById('howToPlayToggle');
        if (howToPlayToggle) {
            howToPlayToggle.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.toggleHowToPlaySidebar();
            });
        }
        
        // Sound toggle functionality
        const soundToggleBtn = document.getElementById('soundToggleBtn');
        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.toggleSound();
            });
        }
        
        // Music toggle functionality
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        if (musicToggleBtn) {
            musicToggleBtn.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.toggleMusic();
            });
        }
        
        // Theme toggle functionality removed
        
        // Pause toggle functionality
        const pauseToggleBtn = document.getElementById('pauseToggleBtn');
        if (pauseToggleBtn) {
            pauseToggleBtn.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.togglePause();
            });
        }
        
        // Resume button functionality
        const resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.playSound('button', 'navigation');
                this.togglePause();
            });
        }
        
        // AI toggle functionality
        const aiToggleBtn = document.getElementById('aiToggleBtn');
        if (aiToggleBtn) {
            aiToggleBtn.addEventListener('click', () => {
                this.playSound('button', 'toggle');
                this.toggleAI();
            });
        }
        
        // Add hover sounds to all buttons
        this.setupHoverSounds();
    }
    
    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        localStorage.setItem('noteworthy_ai_enabled', this.aiEnabled.toString());
        this.updateAIButtonState();
        
        // Show notification
        const notification = document.createElement('div');
        notification.className = 'ai-notification';
        notification.textContent = this.aiEnabled 
            ? '✨ AI-Enhanced explanations enabled!' 
            : 'AI explanations disabled';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
    
    updateAIButtonState() {
        const aiToggleBtn = document.getElementById('aiToggleBtn');
        if (aiToggleBtn) {
            const icon = aiToggleBtn.querySelector('.btn-icon');
            const text = aiToggleBtn.querySelector('.btn-text');
            
            if (this.aiEnabled) {
                aiToggleBtn.classList.add('active');
                if (icon) icon.textContent = '✨';
                if (text) text.textContent = 'AI On';
                aiToggleBtn.setAttribute('aria-pressed', 'true');
            } else {
                aiToggleBtn.classList.remove('active');
                if (icon) icon.textContent = '🤖';
                if (text) text.textContent = 'AI Off';
                aiToggleBtn.setAttribute('aria-pressed', 'false');
            }
        }
        
        // Load saved preference
        const savedPreference = localStorage.getItem('noteworthy_ai_enabled');
        if (savedPreference !== null) {
            this.aiEnabled = savedPreference === 'true';
        }
    }
    
    setupHoverSounds() {
        // Get all buttons and add hover sound effects
        const buttons = document.querySelectorAll('.btn, .tips-toggle-btn, .how-to-play-toggle-btn, .sound-toggle-btn, .music-toggle-btn, .pause-toggle-btn, .ai-toggle-btn, .sidebar-toggle');
        
        buttons.forEach(button => {
            // Desktop hover effect
            button.addEventListener('mouseenter', () => {
                this.playSound('hover');
            });
            
            // Mobile touch effect
            button.addEventListener('touchstart', () => {
                this.playSound('hover');
                // Add visual feedback for touch
                button.style.transform = 'scale(0.98)';
            });
            
            button.addEventListener('touchend', () => {
                // Remove visual feedback
                setTimeout(() => {
                    button.style.transform = '';
                }, 150);
            });
        });
    }
    
    toggleTipsSidebar() {
        const sidebar = document.getElementById('tipsSidebar');
        const container = document.querySelector('.container');
        
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            container.classList.remove('with-sidebar');
        } else {
            sidebar.classList.add('open');
            container.classList.add('with-sidebar');
        }
    }
    
    toggleHowToPlaySidebar() {
        const sidebar = document.getElementById('howToPlaySidebar');
        const container = document.querySelector('.container');
        
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            container.classList.remove('with-sidebar');
        } else {
            sidebar.classList.add('open');
            container.classList.add('with-sidebar');
        }
    }
    
    showDifficultyModal() {
        const modal = document.createElement('div');
        modal.className = 'difficulty-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Choose Difficulty</h3>
                <div class="difficulty-buttons">
                    <button class="btn btn-difficulty ${this.difficulty === 'easy' ? 'active' : ''}" data-difficulty="easy">Easy (30s)</button>
                    <button class="btn btn-difficulty ${this.difficulty === 'medium' ? 'active' : ''}" data-difficulty="medium">Medium (20s)</button>
                    <button class="btn btn-difficulty ${this.difficulty === 'hard' ? 'active' : ''}" data-difficulty="hard">Hard (15s)</button>
                </div>
                <button class="btn btn-next" id="closeModal">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners to modal buttons
        modal.querySelectorAll('.btn-difficulty').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playSound('button');
                this.difficulty = e.target.dataset.difficulty;
                this.setTimeLimit();
                // Recreate questions with new difficulty filter
                this.questions = this.createAndShuffleQuestions();
                this.currentQuestion = 0; // Reset to first question
                this.updateDifficultyDisplay();
                document.body.removeChild(modal);
            });
            
            // Add hover sound to modal buttons
            btn.addEventListener('mouseenter', () => {
                this.playSound('hover');
            });
        });
        
        const closeModalBtn = modal.querySelector('#closeModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.playSound('button');
                document.body.removeChild(modal);
            });
            
            // Add hover sound to close button
            closeModalBtn.addEventListener('mouseenter', () => {
                this.playSound('hover');
            });
        }
    }
    
    updateDifficultyDisplay() {
        const difficultyNames = {
            'easy': 'Easy',
            'medium': 'Medium', 
            'hard': 'Hard'
        };
        const currentDifficultyEl = document.getElementById('currentDifficulty');
        if (currentDifficultyEl) {
            currentDifficultyEl.textContent = difficultyNames[this.difficulty];
        }
    }
    
    setTimeLimit() {
        console.log('setTimeLimit called, difficulty:', this.difficulty);
        switch(this.difficulty) {
            case 'easy':
                this.timeLimit = 30;
                break;
            case 'medium':
                this.timeLimit = 20;
                break;
            case 'hard':
                this.timeLimit = 15;
                break;
        }
        this.timeLeft = this.timeLimit;
        console.log('Time limit set to:', this.timeLimit);
    }
    
    showStartScreen() {
        console.log('showStartScreen called');
        // Start the game immediately and show first headline
        this.gameState = 'playing';
        console.log('Game state set to playing');
        
        this.hideAllScreens();
        console.log('Screens hidden');
        
        this.showGameArea();
        console.log('Game area shown');
        
        // Show pause button
        const pauseBtn = document.getElementById('pauseToggleBtn');
        if (pauseBtn) {
            pauseBtn.style.display = 'flex';
            console.log('Pause button shown');
        } else {
            console.error('Pause button not found!');
        }
        
        this.setTimeLimit();
        console.log('Time limit set');
        
        this.showQuestion();
        console.log('showQuestion called from showStartScreen');
        
        // Don't start timer on first question
        this.timeLeft = this.timeLimit;
        this.updateTimerDisplay();
        
        // Hide the start screen since game starts automatically
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.style.display = 'none';
            console.log('Start screen hidden');
        } else {
            console.error('Start screen not found!');
        }
        
        // Test if headline was set
        setTimeout(() => {
            const headlineElement = document.getElementById('headline');
            if (headlineElement) {
                console.log('Final headline text:', headlineElement.textContent);
            }
        }, 500);
    }
    
    startGame() {
        this.playSound('gameStart');
        console.log('startGame called');
        this.gameState = 'playing';
        console.log('Game state set to playing');
        
        // Reset advanced stats
        this.score = 0;
        this.level = 1;
        this.streak = 0;
        this.combo = 1;
        this.currentQuestion = 0;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.lives = this.maxLives;
        this.questionTimes = [];
        this.speedBonus = 0;
        this.confidenceLevel = null;
        
        // Start game timer
        this.elapsedTime = 0;
        this.startTime = Date.now();
        this.startGameTimer();
        
        this.hideAllScreens();
        console.log('Screens hidden');
        
        // Reset leaderboard submit form
        const nameInput = document.getElementById('playerNameInput');
        const submitBtn = document.getElementById('submitScoreBtn');
        const statusDiv = document.getElementById('submitStatus');
        if (nameInput) {
            nameInput.value = '';
            nameInput.disabled = false;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
        }
        if (statusDiv) {
            statusDiv.textContent = '';
            statusDiv.className = 'submit-status';
        }
        this.pendingScoreData = null;
        
        this.showGameArea();
        console.log('Game area shown');
        
        // Show pause button when game starts
        const pauseBtn = document.getElementById('pauseToggleBtn');
        if (pauseBtn) {
            pauseBtn.style.display = 'flex';
        }
        
        this.setTimeLimit();
        console.log('Time limit set');
        
        this.showQuestion();
        console.log('showQuestion called from startGame');
        
        this.updateStats();
        this.updateHearts(); // Ensure hearts are displayed correctly
    }
    
    showQuestion() {
        console.log('showQuestion called, currentQuestion:', this.currentQuestion);
        console.log('Questions array length:', this.questions.length);
        
        // Check if out of lives
        if (this.lives <= 0) {
            console.log('Game over - out of lives');
            this.endGame();
            return;
        }
        
        if (this.currentQuestion >= this.questions.length) {
            console.log('Game over - no more questions');
            this.endGame();
            return;
        }
        
        const question = this.questions[this.currentQuestion];
        console.log('Showing question:', question.headline);
        
        
        // Hide AI explanation and button
        const aiExplanation = document.getElementById('aiExplanation');
        if (aiExplanation) {
            aiExplanation.style.display = 'none';
        }
        const aiExplanationBtn = document.getElementById('aiExplanationBtn');
        if (aiExplanationBtn) {
            aiExplanationBtn.style.display = 'none';
        }
        
        const headlineElement = document.getElementById('headline');
        const sourceElement = document.getElementById('source');
        const timestampElement = document.getElementById('timestamp');
        
        console.log('Headline element found:', !!headlineElement);
        console.log('Source element found:', !!sourceElement);
        console.log('Timestamp element found:', !!timestampElement);
        
        if (headlineElement) {
            console.log('Setting headline to:', question.headline);
            headlineElement.textContent = question.headline;
            console.log('Headline after setting:', headlineElement.textContent);
        } else {
            console.error('Headline element not found!');
        }
        
        if (sourceElement) {
            console.log('Setting source to:', `Source: ${question.source}`);
            sourceElement.textContent = `Source: ${question.source}`;
        } else {
            console.error('Source element not found!');
        }
        
        if (timestampElement) {
            const timestamp = this.getRandomTimestamp();
            console.log('Setting timestamp to:', timestamp);
            timestampElement.textContent = timestamp;
        } else {
            console.error('Timestamp element not found!');
        }
        
        // Enable buttons
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        
        if (factBtn && fakeBtn) {
            factBtn.disabled = false;
            fakeBtn.disabled = false;
        } else {
            console.error('Button elements not found!');
        }
        
        // Hide the next headline button during question display
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        if (nextHeadlineBtn) {
            nextHeadlineBtn.style.display = 'none';
        }
        
        // Hide question timer initially - it will show when user clicks Factual/Misleading
        const questionTimerEl = document.getElementById('questionTimer');
        if (questionTimerEl) {
            questionTimerEl.style.display = 'none';
        }
        
        // Question timer will start when user clicks Factual or Misleading
        
        // Start timer only if not the first question
        if (this.currentQuestion > 0) {
            this.startTimer();
            // Show pause button when timer is running
            const pauseBtn = document.getElementById('pauseToggleBtn');
            if (pauseBtn) {
                pauseBtn.style.display = 'flex';
            }
        } else {
            // For first question, show full timer but don't count down
            this.timeLeft = this.timeLimit;
            this.updateTimerDisplay();
        }
    }
    
    startTimer() {
        this.timeLeft = this.timeLimit;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timerFill = document.getElementById('timerFill');
        const timerText = document.getElementById('timerText');
        
        if (!timerFill || !timerText) return;
        
        const percentage = (this.timeLeft / this.timeLimit) * 100;
        timerFill.style.width = `${percentage}%`;
        timerText.textContent = `${this.timeLeft}s`;
        
        // Change color when time is running low
        if (this.timeLeft <= 5) {
            timerFill.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
        } else {
            timerFill.style.background = 'linear-gradient(45deg, #4A90E2, #2A60B0)';
        }
    }
    
    timeUp() {
        // Timer sound removed per user request
        // this.playSound('timer');
        clearInterval(this.timer);
        this.checkAnswer(null); // null means time ran out
    }
    
    checkAnswer(userAnswer) {
        clearInterval(this.timer);
        this.stopQuestionTimer();
        
        // Hide question timer
        const questionTimerEl = document.getElementById('questionTimer');
        if (questionTimerEl) {
            questionTimerEl.style.display = 'none';
        }
        
        const question = this.questions[this.currentQuestion];
        const isCorrect = userAnswer === question.isFactual;
        
        // Calculate question time
        const questionTime = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 0;
        this.questionTimes.push(questionTime);
        
        // Calculate base score with difficulty multiplier
        const difficultyMultipliers = { easy: 1, medium: 1.5, hard: 2 };
        const difficultyMultiplier = difficultyMultipliers[this.difficulty] || 1;
        const levelMultiplier = 1 + (this.level - 1) * 0.1; // 10% per level
        let baseScore = 10 * difficultyMultiplier * levelMultiplier;
        
        // Time bonus (faster = more points)
        let timeBonus = 0;
        let timeMessage = '';
        if (userAnswer !== null && questionTime > 0) {
            if (questionTime < 3) {
                timeBonus = 50;
                timeMessage = '⚡ Lightning Fast! +50';
            } else if (questionTime < 5) {
                timeBonus = 30;
                timeMessage = '⚡ Very Fast! +30';
            } else if (questionTime < 8) {
                timeBonus = 15;
                timeMessage = '⚡ Fast! +15';
            }
            this.speedBonus += timeBonus;
        }
        
        // No confidence multiplier - removed feature
        const confidenceMultiplier = 1;
        
        // Disable buttons during feedback
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        if (factBtn) factBtn.disabled = true;
        if (fakeBtn) fakeBtn.disabled = true;
        
        if (isCorrect) {
            this.playSound('correct');
            
            // Calculate score with all multipliers
            const streakBonus = Math.min(this.streak * 2, 20); // Max 20 from streak
            const comboBonus = (this.combo - 1) * 10; // Bonus from combo multiplier
            const totalScore = Math.floor((baseScore + timeBonus + streakBonus + comboBonus) * confidenceMultiplier);
            this.score += totalScore;
            
            this.streak++;
            this.correctAnswers++;
            
            // Increase combo multiplier on correct answers
            if (this.streak >= 3) {
                this.combo = Math.min(1 + Math.floor(this.streak / 3), 5); // Max 5x combo
            }
            
            this.showFeedback(true, question, timeBonus, timeMessage, totalScore, confidenceMultiplier);
        } else {
            this.playSound('incorrect');
            this.streak = 0;
            this.combo = 1; // Reset combo on wrong answer
            
            // Lose a life
            const previousLives = this.lives;
            this.lives--;
            console.log('Life lost! Previous lives:', previousLives, 'Remaining lives:', this.lives);
            
            // Force update hearts immediately
            this.updateHearts();
            
            // Also update again after a tiny delay to ensure it sticks
            setTimeout(() => {
                this.updateHearts();
            }, 50);
            
            // Game over immediately when out of lives
            if (this.lives <= 0) {
                console.log('Game over - out of lives');
                // Show feedback first, then end game
                setTimeout(() => {
                    this.endGame();
                }, 1500); // Short delay to show feedback
            }
            
            // Penalty for wrong answer (more if high confidence)
            const penalty = Math.floor(baseScore * 0.3 * confidenceMultiplier);
            this.score = Math.max(0, this.score - penalty);
            
            this.showFeedback(false, question, 0, '', 0, confidenceMultiplier, penalty);
        }
        
        this.totalAnswers++;
        this.updateStats();
        
        // Only continue if we still have lives
        if (this.lives > 0) {
            this.currentQuestion++;
            
            // Progressive difficulty - level up every 5 questions, increase time pressure
            if (this.currentQuestion % 5 === 0) {
                this.level++;
                // Reduce time limit slightly each level (more pressure)
                this.timeLimit = Math.max(10, this.timeLimit - 1);
            }
        }
    }
    
    async showFeedback(isCorrect, question, timeBonus, timeMessage, totalScore, confidenceMultiplier, penalty) {
        this.gameState = 'feedback';
        this.hideAllScreens();
        
        // Keep hearts display visible during feedback
        const livesDisplay = document.getElementById('livesDisplay');
        if (livesDisplay) {
            livesDisplay.style.display = 'flex';
        }
        
        const feedbackElement = document.getElementById('feedback');
        const titleElement = document.getElementById('feedbackTitle');
        const textElement = document.getElementById('feedbackText');
        
        if (!feedbackElement || !titleElement || !textElement) return;
        
        // Show initial feedback with advanced scoring info
        if (isCorrect) {
            titleElement.textContent = 'Correct! ✅';
            titleElement.style.color = '#2ecc71';
            let feedbackText = question.explanation;
            if (timeMessage) {
                feedbackText += `\n\n${timeMessage}`;
            }
            if (this.combo > 1) {
                feedbackText += `\n\nCombo Multiplier: ${this.combo}x!`;
            }
            feedbackText += `\n\nPoints Earned: +${totalScore}`;
            textElement.textContent = feedbackText;
        } else {
            titleElement.textContent = 'Incorrect! ❌';
            titleElement.style.color = '#e74c3c';
            let feedbackText = question.explanation;
            if (penalty > 0) {
                feedbackText += `\n\nPenalty: -${penalty} points`;
            }
            if (this.lives > 0) {
                feedbackText += `\n\nLives remaining: ${this.lives}`;
            } else {
                feedbackText += `\n\nGame Over! Out of lives.`;
            }
            textElement.textContent = feedbackText;
        }
        
        // Update tips with standard tips
        const factCheckTips = document.getElementById('factCheckTips');
        if (factCheckTips) {
            factCheckTips.innerHTML = `
                <h4>💡 Fact-Checking Tips:</h4>
                <ul>
                    <li>Check multiple reliable sources</li>
                    <li>Look for evidence and citations</li>
                    <li>Be wary of sensational language</li>
                    <li>Verify the source's credibility</li>
                    <li>${question.tips}</li>
                </ul>
            `;
        }
        
        feedbackElement.style.display = 'block';
        
        // Show AI explanation button only for incorrect answers
        const aiExplanationBtn = document.getElementById('aiExplanationBtn');
        if (aiExplanationBtn) {
            if (!isCorrect) {
                // Check daily limit before showing button
                const canUseAI = this.checkAIExplanationLimit();
                if (canUseAI.allowed) {
                    aiExplanationBtn.style.display = 'inline-block';
                    aiExplanationBtn.disabled = false;
                } else {
                    aiExplanationBtn.style.display = 'none';
                }
            } else {
                // Hide AI explanation button for correct answers
                aiExplanationBtn.style.display = 'none';
            }
        }
        
        // Don't auto-enhance with AI anymore - only manual explanations
    }
    
    checkAIExplanationLimit() {
        const today = new Date().toDateString();
        const storageKey = 'noteworthy_ai_explanations';
        const dateKey = 'noteworthy_ai_explanations_date';
        
        // Get stored data
        const storedDate = localStorage.getItem(dateKey);
        const storedCount = localStorage.getItem(storageKey);
        
        // Reset if it's a new day
        if (storedDate !== today) {
            localStorage.setItem(storageKey, '0');
            localStorage.setItem(dateKey, today);
            return { allowed: true, remaining: 3 };
        }
        
        // Check current count
        const count = parseInt(storedCount || '0');
        const remaining = 3 - count;
        
        if (count >= 3) {
            return { allowed: false, remaining: 0 };
        }
        
        return { allowed: true, remaining: remaining };
    }
    
    incrementAIExplanationCount() {
        const today = new Date().toDateString();
        const storageKey = 'noteworthy_ai_explanations';
        const dateKey = 'noteworthy_ai_explanations_date';
        
        const storedDate = localStorage.getItem(dateKey);
        
        // Reset if it's a new day
        if (storedDate !== today) {
            localStorage.setItem(storageKey, '1');
            localStorage.setItem(dateKey, today);
            return 2; // Remaining
        }
        
        // Increment count
        const currentCount = parseInt(localStorage.getItem(storageKey) || '0');
        const newCount = currentCount + 1;
        localStorage.setItem(storageKey, newCount.toString());
        
        return 3 - newCount; // Remaining
    }
    
    async getAIExplanation(question) {
        // Check daily limit first
        const limitCheck = this.checkAIExplanationLimit();
        if (!limitCheck.allowed) {
            alert('You have reached your daily limit of 3 AI explanations. Come back tomorrow for more!');
            return;
        }
        
        const aiExplanationDiv = document.getElementById('aiExplanation');
        const aiExplanationContent = document.querySelector('.ai-explanation-content');
        const aiExplanationBtn = document.getElementById('aiExplanationBtn');
        
        if (!aiExplanationDiv || !aiExplanationContent) return;
        
        // Increment usage count
        const remaining = this.incrementAIExplanationCount();
        
        // Show loading state
        aiExplanationDiv.style.display = 'block';
        aiExplanationContent.innerHTML = `<p>🤖 AI is analyzing this story...</p><p style="font-size: 0.9em; color: rgba(255,255,255,0.7); margin-top: 10px;">AI explanations remaining today: ${remaining}</p>`;
        if (aiExplanationBtn) aiExplanationBtn.disabled = true;
        
        try {
            // Get current player stats for context
            const playerStats = {
                score: this.score,
                streak: this.streak,
                level: this.level,
                correctAnswers: this.correctAnswers,
                totalAnswers: this.totalAnswers,
                accuracy: this.totalAnswers > 0 ? (this.correctAnswers / this.totalAnswers * 100).toFixed(1) : 0,
                difficulty: this.difficulty,
                lives: this.lives
            };
            
            // Call AI with full context
            const response = await fetch('/.netlify/functions/game-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'detailed_explanation',
                    headline: question.headline,
                    source: question.source,
                    isFactual: question.isFactual,
                    explanation: question.explanation,
                    tips: question.tips,
                    category: question.category || 'general',
                    level: question.level || 1,
                    playerStats: playerStats,
                    context: {
                        gameType: 'fact-checker',
                        currentScore: this.score,
                        currentLevel: this.level,
                        accuracy: playerStats.accuracy,
                        difficulty: this.difficulty
                    }
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.message || `Server error (${response.status})`;
                console.error('AI service error:', errorMessage, errorData);
                
                // Refund the usage count since it failed
                const today = new Date().toDateString();
                const storageKey = 'noteworthy_ai_explanations';
                const dateKey = 'noteworthy_ai_explanations_date';
                const storedDate = localStorage.getItem(dateKey);
                if (storedDate === today) {
                    const currentCount = parseInt(localStorage.getItem(storageKey) || '0');
                    if (currentCount > 0) {
                        localStorage.setItem(storageKey, (currentCount - 1).toString());
                    }
                }
                
                aiExplanationContent.innerHTML = `
                    <p style="color: #e74c3c;">⚠️ Unable to load AI explanation.</p>
                    <p style="color: rgba(255,255,255,0.7); font-size: 0.9em; margin-top: 10px;">
                        ${errorMessage.includes('API key') || errorMessage.includes('configured') 
                            ? 'AI features are not configured on the server. Please contact support.' 
                            : 'The AI service is temporarily unavailable. Please try again later.'}
                    </p>
                `;
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.message) {
                const remainingAfter = this.checkAIExplanationLimit().remaining;
                aiExplanationContent.innerHTML = `
                    <h4 style="color: #4A90E2; margin-bottom: 10px;">🤖 AI Detailed Explanation</h4>
                    <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.6;">
                        ${data.message}
                    </div>
                    ${remainingAfter > 0 ? `<p style="font-size: 0.9em; color: rgba(255,255,255,0.7); margin-top: 15px;">AI explanations remaining today: ${remainingAfter}</p>` : '<p style="font-size: 0.9em; color: rgba(255,255,255,0.7); margin-top: 15px;">You have used all 3 AI explanations for today.</p>'}
                `;
            } else {
                const errorMsg = data.error || data.message || 'Unknown error';
                console.error('AI response error:', errorMsg, data);
                aiExplanationContent.innerHTML = `
                    <p style="color: #e74c3c;">⚠️ Unable to generate AI explanation.</p>
                    <p style="color: rgba(255,255,255,0.7); font-size: 0.9em; margin-top: 10px;">${errorMsg}</p>
                `;
            }
        } catch (error) {
            console.error('AI explanation failed:', error);
            
            // Refund the usage count since it failed
            const today = new Date().toDateString();
            const storageKey = 'noteworthy_ai_explanations';
            const dateKey = 'noteworthy_ai_explanations_date';
            const storedDate = localStorage.getItem(dateKey);
            if (storedDate === today) {
                const currentCount = parseInt(localStorage.getItem(storageKey) || '0');
                if (currentCount > 0) {
                    localStorage.setItem(storageKey, (currentCount - 1).toString());
                }
            }
            
            let errorMessage = 'Error loading AI explanation. Please try again later.';
            if (error.message) {
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            aiExplanationContent.innerHTML = `
                <p style="color: #e74c3c;">⚠️ ${errorMessage}</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 0.9em; margin-top: 10px;">
                    Your AI explanation count has been refunded. You can try again.
                </p>
            `;
        } finally {
            if (aiExplanationBtn) aiExplanationBtn.disabled = false;
        }
    }
    
    async enhanceFeedbackWithAI(isCorrect, question, timeBonus) {
        try {
            const aiIndicator = document.getElementById('aiIndicator');
            if (aiIndicator) {
                aiIndicator.style.display = 'flex';
                aiIndicator.innerHTML = '<span class="ai-spinner">🤖</span> AI is enhancing your feedback...';
            }
            
            // Get current player stats
            const playerStats = {
                score: this.score,
                streak: this.streak,
                level: this.level,
                correctAnswers: this.correctAnswers,
                totalAnswers: this.totalAnswers,
                accuracy: this.totalAnswers > 0 ? (this.correctAnswers / this.totalAnswers * 100).toFixed(1) : 0,
                difficulty: this.difficulty,
                lives: this.lives
            };
            
            // Call AI to enhance explanation with full context
            const response = await fetch('/.netlify/functions/game-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'enhance_explanation',
                    headline: question.headline,
                    source: question.source,
                    isFactual: question.isFactual,
                    userAnswer: isCorrect,
                    explanation: question.explanation,
                    tips: question.tips,
                    category: question.category || 'general',
                    level: question.level || 1,
                    playerStats: playerStats,
                    context: {
                        gameType: 'fact-checker',
                        currentScore: this.score,
                        currentLevel: this.level,
                        accuracy: playerStats.accuracy,
                        difficulty: this.difficulty,
                        timeBonus: timeBonus
                    }
                }),
            });
            
            if (!response.ok) {
                throw new Error('AI service unavailable');
            }
            
            const data = await response.json();
            
            if (data.success && data.message) {
                // Update feedback text with AI-enhanced explanation
                const textElement = document.getElementById('feedbackText');
                if (textElement) {
                    const enhancedText = data.message.trim();
                    textElement.innerHTML = `
                        <div class="ai-enhanced-explanation">
                            ${enhancedText}
                            ${timeBonus > 0 && isCorrect ? ` <strong>+${timeBonus} bonus points for quick answer!</strong>` : ''}
                        </div>
                        <div class="ai-badge">✨ AI-Enhanced Explanation</div>
                    `;
                }
                
                // Add personalized feedback
                await this.addPersonalizedFeedback(question, isCorrect, playerStats);
                
                // Update AI indicator
                if (aiIndicator) {
                    aiIndicator.innerHTML = '<span class="ai-icon">✨</span> AI-Enhanced';
                    setTimeout(() => {
                        if (aiIndicator) aiIndicator.style.display = 'none';
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('AI enhancement failed:', error);
            // Silently fail - don't disrupt user experience
            const aiIndicator = document.getElementById('aiIndicator');
            if (aiIndicator) {
                aiIndicator.style.display = 'none';
            }
        } finally {
            this.aiLoading = false;
        }
    }
    
    async addPersonalizedFeedback(question, isCorrect, playerStats) {
        try {
            const response = await fetch('/.netlify/functions/game-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'personalized_feedback',
                    headline: question.headline,
                    source: question.source,
                    isFactual: question.isFactual,
                    userAnswer: isCorrect,
                    playerStats: playerStats
                }),
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.success && data.message) {
                // Add personalized feedback section
                const factCheckTips = document.getElementById('factCheckTips');
                if (factCheckTips) {
                    const personalizedSection = document.createElement('div');
                    personalizedSection.className = 'ai-personalized-feedback';
                    personalizedSection.innerHTML = `
                        <h4>🎯 AI Insight:</h4>
                        <p>${data.message}</p>
                    `;
                    factCheckTips.appendChild(personalizedSection);
                }
            }
        } catch (error) {
            console.error('Personalized feedback failed:', error);
            // Silently fail
        }
    }
    
    nextQuestion() {
        // Don't show next question if out of lives
        if (this.lives <= 0) {
            console.log('Cannot show next question - out of lives');
            this.endGame();
            return;
        }
        
        this.gameState = 'playing';
        this.hideAllScreens();
        this.showGameArea();
        // Ensure hearts are visible and updated
        const livesDisplay = document.getElementById('livesDisplay');
        if (livesDisplay) {
            livesDisplay.style.display = 'flex';
        }
        this.updateHearts(); // Update hearts when showing next question
        this.showQuestion();
        
        // Hide the next headline button during question display
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        if (nextHeadlineBtn) {
            nextHeadlineBtn.style.display = 'none';
        }
    }
    
    startGameTimer() {
        this.stopGameTimer(); // Clear any existing timer
        this.gameTimerInterval = setInterval(() => {
            if (this.startTime) {
                this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
                this.updateStats();
            }
        }, 100);
    }
    
    stopGameTimer() {
        if (this.gameTimerInterval) {
            clearInterval(this.gameTimerInterval);
            this.gameTimerInterval = null;
        }
    }
    
    startQuestionTimer() {
        this.stopQuestionTimer(); // Clear any existing timer
        const questionTimerValueEl = document.getElementById('questionTimerValue');
        this.questionTimerInterval = setInterval(() => {
            if (this.questionStartTime) {
                const elapsed = (Date.now() - this.questionStartTime) / 1000;
                if (questionTimerValueEl) {
                    questionTimerValueEl.textContent = `${elapsed.toFixed(1)}s`;
                }
            }
        }, 100);
    }
    
    stopQuestionTimer() {
        if (this.questionTimerInterval) {
            clearInterval(this.questionTimerInterval);
            this.questionTimerInterval = null;
        }
    }
    
    
    loadBestTime() {
        const saved = localStorage.getItem('noteworthy_best_time');
        return saved ? parseInt(saved) : null;
    }
    
    saveBestTime(time) {
        const currentBest = this.loadBestTime();
        if (!currentBest || time < currentBest) {
            localStorage.setItem('noteworthy_best_time', time.toString());
            this.bestTime = time;
        }
    }
    
    createConfetti() {
        // Create confetti container if it doesn't exist
        let confettiContainer = document.getElementById('gameConfetti');
        if (!confettiContainer) {
            confettiContainer = document.createElement('div');
            confettiContainer.id = 'gameConfetti';
            confettiContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
            `;
            document.body.appendChild(confettiContainer);
        }
        
        // Confetti colors
        const colors = ['#ffe66d', '#4ecdc4', '#ff6b6b', '#95e1d3', '#aa96da', '#fcbad3', '#f38181', '#a8e6cf', '#2ecc71', '#3498db', '#FFD700', '#FFC107'];
        
        // Function to create confetti pieces
        const createConfettiPiece = () => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 8 + 6}px;
                height: ${Math.random() * 8 + 6}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                opacity: 1;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0%'};
                box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
            `;
            
            // Random animation duration and delay
            const duration = Math.random() * 2 + 2;
            const delay = Math.random() * 0.5;
            const horizontalDrift = (Math.random() - 0.5) * 200;
            
            confetti.style.animation = `gameConfettiFall ${duration}s linear ${delay}s forwards`;
            confetti.style.setProperty('--drift', horizontalDrift + 'px');
            
            confettiContainer.appendChild(confetti);
            
            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, (duration + delay) * 1000);
        };
        
        // Add CSS animation if not already added
        if (!document.getElementById('gameConfettiStyle')) {
            const style = document.createElement('style');
            style.id = 'gameConfettiStyle';
            style.textContent = `
                @keyframes gameConfettiFall {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) translateX(var(--drift, 0px)) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Start creating confetti continuously
        console.log('[Fact Checker Game] Starting confetti celebration...');
        let confettiInterval = setInterval(() => {
            // Create 15-25 pieces every 200ms for continuous celebration
            const pieces = Math.floor(Math.random() * 11) + 15;
            for (let i = 0; i < pieces; i++) {
                createConfettiPiece();
            }
        }, 200);
        
        // Stop confetti after 10 seconds
        setTimeout(() => {
            console.log('[Fact Checker Game] Stopping confetti after 10 seconds');
            clearInterval(confettiInterval);
            // Clean up confetti container after a delay to let remaining pieces fall
            setTimeout(() => {
                if (confettiContainer && confettiContainer.parentNode) {
                    confettiContainer.innerHTML = '';
                }
            }, 3000);
        }, 10000);
    }
    
    async endGame() {
        this.stopGameTimer();
        this.stopQuestionTimer();
        this.playSound('gameOver');
        this.gameState = 'gameOver';
        
        // Hide other screens but show game over
        this.hideAllScreens();
        
        // Always trigger confetti at game end
        try {
            this.createConfetti();
        } catch (e) {
            console.log('Error creating confetti:', e);
        }
        
        // Play NeonDreams.wav at game end
        try {
            this.playNeonDreams();
        } catch (e) {
            console.log('Error playing NeonDreams.wav:', e);
        }

        // Reset pause state when game ends
        const pauseBtn = document.getElementById('pauseToggleBtn');
        if (pauseBtn) {
            pauseBtn.classList.remove('paused');
        }
        this.isPaused = false;
        
        // Calculate final time
        const finalTime = this.elapsedTime;
        const timeString = `${Math.floor(finalTime / 60)}:${String(Math.floor(finalTime % 60)).padStart(2, '0')}`;
        const avgTime = this.questionTimes.length > 0 
            ? (this.questionTimes.reduce((a, b) => a + b, 0) / this.questionTimes.length).toFixed(1)
            : '0.0';

        // High score logic - save per user if logged in
        let highScore;
        let userId = null;
        
        // Check if user is logged in
        if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
            try {
                const isAuth = await window.auth0.isAuthenticated();
                if (isAuth) {
                    const user = await window.auth0.getUser();
                    if (user && user.sub) {
                        userId = user.sub;
                        // Save per-user high score
                        const userHighScoreKey = `noteworthy_high_score_${user.sub}`;
                        highScore = localStorage.getItem(userHighScoreKey);
                        if (!highScore || this.score > parseInt(highScore)) {
                            highScore = this.score;
                            localStorage.setItem(userHighScoreKey, highScore);
                            // Also save to general high score for backward compatibility
                            localStorage.setItem('noteworthy_high_score', highScore);
                            console.log(`[Game] Saved high score ${highScore} for user ${user.sub}`);
                        }
                    }
                }
            } catch (err) {
                console.log('[Game] Could not check auth status, using default:', err);
            }
        }
        
        // Fallback to general high score if not logged in
        if (!userId) {
            highScore = localStorage.getItem('noteworthy_high_score');
            if (!highScore || this.score > parseInt(highScore)) {
                highScore = this.score;
                localStorage.setItem('noteworthy_high_score', highScore);
            }
        }
        
        // Save best time
        this.saveBestTime(finalTime);

        // Update game over screen with advanced stats - new structure
        const bestTimeString = this.bestTime ? `${Math.floor(this.bestTime / 60)}:${String(Math.floor(this.bestTime % 60)).padStart(2, '0')}` : 'N/A';
        const accuracy = this.totalAnswers > 0 ? Math.round((this.correctAnswers / this.totalAnswers) * 100) : 0;
        
        // Update individual stat elements
        const finalScore = document.getElementById('finalScore');
        const finalLevel = document.getElementById('finalLevel');
        const finalStreak = document.getElementById('finalStreak');
        
        if (finalScore) finalScore.textContent = Math.floor(this.score).toLocaleString();
        if (finalLevel) finalLevel.textContent = this.level;
        if (finalStreak) {
            const bestStreaks = this.getBestStreak();
            const maxStreak = bestStreaks && bestStreaks.length > 0 ? Math.max(...bestStreaks) : this.streak || 0;
            finalStreak.textContent = maxStreak;
        }
        
        // Show high score
        const highScoreElem = document.getElementById('finalHighScore');
        if (highScoreElem) {
            highScoreElem.textContent = highScore;
        }
        
        const finalTimeEl = document.getElementById('finalTime');
        if (finalTimeEl) finalTimeEl.textContent = timeString;
        
        const finalBestTimeEl = document.getElementById('finalBestTime');
        if (finalBestTimeEl) finalBestTimeEl.textContent = bestTimeString;
        
        const finalAvgSpeedEl = document.getElementById('finalAvgSpeed');
        if (finalAvgSpeedEl) finalAvgSpeedEl.textContent = `${avgTime}s`;
        
        const finalSpeedBonusEl = document.getElementById('finalSpeedBonus');
        if (finalSpeedBonusEl) finalSpeedBonusEl.textContent = `+${this.speedBonus}`;
        
        const finalAccuracyEl = document.getElementById('finalAccuracy');
        if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}%`;

        // Show game over screen (after hideAllScreens was called)
        const gameOver = document.getElementById('gameOver');
        if (gameOver) {
            gameOver.style.display = 'block';
            console.log('[Game] Game over screen displayed');
        } else {
            console.error('[Game] Game over element not found!');
        }
        
        // Show leaderboard submit form
        const submitForm = document.getElementById('leaderboardSubmitForm');
        if (submitForm) {
            submitForm.style.display = 'block';
            submitForm.style.visibility = 'visible';
            submitForm.style.opacity = '1';
        }
        
        // Store score data for leaderboard submission
        this.pendingScoreData = {
                    gameType: 'fact-checker',
                    score: this.score,
            userId: userId || null, // Will be generated on backend if null
            userName: null, // Will be set by user input
                    difficulty: this.difficulty,
                    time: finalTime,
                    speedBonus: this.speedBonus,
                    avgTime: parseFloat(avgTime),
                    level: this.level,
                    streak: Math.max(...this.getBestStreak()),
        };
        
        // Set up submit button handler
        this.setupLeaderboardSubmit();
        
        // Set up view leaderboard button
        this.setupViewLeaderboard();
        
        // Load and prepare leaderboard immediately when game ends
        this.prepareLeaderboard();
    }
    
    async prepareLeaderboard() {
        // Ensure leaderboard exists
        if (!window.leaderboard) {
            console.log('[Game] Creating leaderboard instance on game end...');
            window.leaderboard = new Leaderboard('fact-checker');
            await window.leaderboard.init();
        }
        
        // Load current scores so leaderboard is ready to show
        try {
            await window.leaderboard.loadScores(10); // Load top 10 for display
            window.leaderboard.render();
            console.log('[Game] Leaderboard prepared and ready to show');
            
            // Show inline leaderboard immediately (before name submission)
            this.showInlineLeaderboard();
        } catch (error) {
            console.error('[Game] Error preparing leaderboard:', error);
        }
    }
    
    showInlineLeaderboard() {
        const container = document.getElementById('inlineLeaderboardContainer');
        const list = document.getElementById('inlineLeaderboardList');
        const cardTitle = document.getElementById('leaderboardCardTitle');
        
        if (!container || !list || !window.leaderboard) {
            console.warn('[Game] Inline leaderboard elements not found');
            return;
        }
        
        // Update card title
        if (cardTitle) {
            cardTitle.textContent = '🏆 Leaderboard';
        }
        
        // Get top 10 scores
        const topScores = window.leaderboard.scores.slice(0, 10);
        
        if (topScores.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores yet. Be the first!</div>';
            container.style.display = 'block';
            return;
        }
        
        // Render scores
        list.innerHTML = topScores.map((score, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const isTopThree = rank <= 3;
            
            // Format metadata
            const metaParts = [];
            if (score.difficulty) metaParts.push(`Difficulty: ${score.difficulty}`);
            if (score.level) metaParts.push(`Level: ${score.level}`);
            if (score.streak) metaParts.push(`Streak: ${score.streak}`);
            const metaText = metaParts.join(' | ');
            
            return `
                <div class="inline-leaderboard-item ${isTopThree ? 'top-three' : ''}" data-rank="${rank}">
                    <div class="inline-leaderboard-rank">${medal}</div>
                    <div class="inline-leaderboard-user">
                        <div class="inline-leaderboard-name">${this.escapeHtml(score.userName)}</div>
                        <div class="inline-leaderboard-meta">${metaText || '—'}</div>
                    </div>
                    <div class="inline-leaderboard-score">${score.score.toLocaleString()}</div>
                </div>
            `;
        }).join('');
        
        // Show container with animation
        container.style.display = 'block';
    }
    
    setupLeaderboardSubmit() {
        const submitBtn = document.getElementById('submitScoreBtn');
        const nameInput = document.getElementById('playerNameInput');
        const statusDiv = document.getElementById('submitStatus');
        
        if (!submitBtn || !nameInput) return;
        
        // Remove existing listeners
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new listener
        newSubmitBtn.addEventListener('click', async () => {
            const userName = nameInput.value.trim() || 'Anonymous';
            
            if (!this.pendingScoreData) {
                this.showSubmitStatus('No score data available', 'error');
                return;
            }
            
            // Disable button during submission
            newSubmitBtn.disabled = true;
            this.showSubmitStatus('Submitting...', '');
            
            try {
                const scoreData = {
                    ...this.pendingScoreData,
                    userName: userName,
                };
                
                const success = await this.submitToLeaderboard(scoreData);
                
                if (success) {
                    nameInput.disabled = true;
                    newSubmitBtn.disabled = true;
                    
                    // Ensure leaderboard exists and is initialized
                    if (!window.leaderboard) {
                        console.log('[Game] Creating leaderboard instance...');
                        window.leaderboard = new Leaderboard('fact-checker');
                        await window.leaderboard.init();
                    }
                    
                    // Load leaderboard to show user their rank
                    try {
                        await window.leaderboard.loadScores(50); // Load more to find user's rank
                        
                        // Find user's rank
                        const userScore = scoreData.score;
                        const userRank = window.leaderboard.scores.findIndex(s => 
                            s.userName === userName && Math.abs(s.score - userScore) < 0.01
                        ) + 1;
                        
                        if (userRank > 0 && userRank <= 50) {
                            this.showSubmitStatus(`✓ Score submitted! You're ranked #${userRank}!`, 'success');
                        } else {
                            this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                        }
                        
                        // Render inline leaderboard with animation
                        this.renderInlineLeaderboard(userName, userScore, userRank);
                    } catch (error) {
                        console.error('[Game] Error loading/showing leaderboard:', error);
                        this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                    }
                } else {
                    // Error message is already shown by submitToLeaderboard if it's a userName validation error
                    // For other errors, show a generic message
                    const statusDiv = document.getElementById('submitStatus');
                    if (statusDiv && !statusDiv.textContent.includes('inappropriate') && !statusDiv.textContent.includes('Please choose')) {
                        this.showSubmitStatus('Failed to submit score. Please try again.', 'error');
                    }
                    newSubmitBtn.disabled = false;
                }
            } catch (error) {
                console.error('[Game] Leaderboard submission error:', error);
                this.showSubmitStatus('Error submitting score. Please try again.', 'error');
                newSubmitBtn.disabled = false;
            }
        });
        
        // Allow Enter key to submit
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !newSubmitBtn.disabled) {
                newSubmitBtn.click();
            }
        });
    }
    
    setupViewLeaderboard() {
        // Check if view leaderboard button exists, if not create it
        let viewLeaderboardBtn = document.getElementById('viewLeaderboardBtn');
        const submitForm = document.getElementById('leaderboardSubmitForm');
        const gameOver = document.getElementById('gameOver');
        
        if (!viewLeaderboardBtn && submitForm) {
            // Create button and insert it BEFORE the submit form so it's visible immediately
            viewLeaderboardBtn = document.createElement('button');
            viewLeaderboardBtn.id = 'viewLeaderboardBtn';
            viewLeaderboardBtn.className = 'btn btn-view-leaderboard';
            viewLeaderboardBtn.textContent = '🏆 View Leaderboard';
            viewLeaderboardBtn.style.cssText = `
                margin: 20px auto;
                width: 100%;
                max-width: 400px;
                padding: 15px 30px;
                background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3));
                border: 2px solid rgba(255, 215, 0, 0.6);
                color: white;
                border-radius: 8px;
                font-weight: 700;
                font-size: 1.1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: block;
            `;
            
            // Insert before the submit form
            submitForm.parentNode.insertBefore(viewLeaderboardBtn, submitForm);
            
            // Add hover effect
            viewLeaderboardBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 193, 7, 0.4))';
            });
            viewLeaderboardBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3))';
            });
        }
        
        if (viewLeaderboardBtn) {
            // Remove existing listeners
            const newBtn = viewLeaderboardBtn.cloneNode(true);
            viewLeaderboardBtn.parentNode.replaceChild(newBtn, viewLeaderboardBtn);
            
            // Re-add hover effects
            newBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 193, 7, 0.4))';
            });
            newBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3))';
            });
            
            newBtn.addEventListener('click', async () => {
                console.log('[Game] View leaderboard button clicked');
                // Ensure leaderboard exists
                if (!window.leaderboard) {
                    console.log('[Game] Creating leaderboard instance...');
                    window.leaderboard = new Leaderboard('fact-checker');
                    await window.leaderboard.init();
                }
                
                try {
                    await window.leaderboard.loadScores(50);
                    window.leaderboard.render();
                    window.leaderboard.show();
                } catch (error) {
                    console.error('[Game] Error showing leaderboard:', error);
                    // Still try to show it
                    window.leaderboard.render();
                    window.leaderboard.show();
                }
            });
        }
    }

    showSubmitStatus(message, type) {
        const statusDiv = document.getElementById('submitStatus');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `submit-status ${type}`;
        }
    }
    
    renderInlineLeaderboard(userName, userScore, userRank) {
        const container = document.getElementById('inlineLeaderboardContainer');
        const list = document.getElementById('inlineLeaderboardList');
        const cardTitle = document.getElementById('leaderboardCardTitle');
        
        if (!container || !list) {
            console.warn('[Game] Inline leaderboard elements not found');
            return;
        }
        
        // Update card title
        if (cardTitle) {
            cardTitle.textContent = '🏆 Leaderboard';
        }
        
        // Get top 10 scores
        const topScores = window.leaderboard.scores.slice(0, 10);
        
        if (topScores.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores yet. Be the first!</div>';
            container.style.display = 'block';
            return;
        }
        
        // Render scores
        list.innerHTML = topScores.map((score, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const isUserRank = rank === userRank && score.userName === userName && Math.abs(score.score - userScore) < 0.01;
            const isTopThree = rank <= 3;
            
            // Format metadata
            const metaParts = [];
            if (score.difficulty) metaParts.push(`Difficulty: ${score.difficulty}`);
            if (score.level) metaParts.push(`Level: ${score.level}`);
            if (score.streak) metaParts.push(`Streak: ${score.streak}`);
            const metaText = metaParts.join(' | ');
            
            return `
                <div class="inline-leaderboard-item ${isTopThree ? 'top-three' : ''} ${isUserRank ? 'user-rank' : ''}" data-rank="${rank}">
                    <div class="inline-leaderboard-rank">${medal}</div>
                    <div class="inline-leaderboard-user">
                        <div class="inline-leaderboard-name">${this.escapeHtml(score.userName)}</div>
                        <div class="inline-leaderboard-meta">${metaText || '—'}</div>
                    </div>
                    <div class="inline-leaderboard-score">${score.score.toLocaleString()}</div>
                </div>
            `;
        }).join('');
        
        // Show container with animation
        container.style.display = 'block';
        
        // Scroll to user's rank if it's in the top 10
        if (userRank > 0 && userRank <= 10) {
            setTimeout(() => {
                const userItem = list.querySelector(`[data-rank="${userRank}"]`);
                if (userItem) {
                    userItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 600); // Wait for animations to start
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async submitToLeaderboard(scoreData) {
        try {
            const response = await fetch('/.netlify/functions/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData),
            });
            
            if (response.ok) {
                console.log('[Game] Score submitted to leaderboard');
                return true;
            } else {
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    const errorText = await response.text();
                    errorData = { error: errorText };
                }
                const errorMessage = errorData.error || 'Failed to submit score. Please try again.';
                console.error('[Game] Failed to submit score:', errorMessage);
                
                // If it's a userName validation error, show it to the user
                if (errorData.field === 'userName') {
                    this.showSubmitStatus(errorMessage, 'error');
                    // Re-enable the input so user can change it
                    const nameInput = document.getElementById('playerNameInput');
                    if (nameInput) {
                        nameInput.disabled = false;
                        nameInput.focus();
                        nameInput.select();
                    }
                }
                
                return false;
            }
        } catch (error) {
            console.error('[Game] Leaderboard submission error:', error);
            return false;
        }
    }
    
    async loadLeaderboard(gameType = 'fact-checker', limit = 10) {
        try {
            const response = await fetch(`/.netlify/functions/leaderboard?gameType=${gameType}&limit=${limit}`);
            if (response.ok) {
                const data = await response.json();
                return data.scores || [];
            }
            return [];
        } catch (error) {
            console.error('[Game] Failed to load leaderboard:', error);
            return [];
        }
    }
    
    restartGame() {
        // Fade out NeonDreams.wav and resume background music if playing
        try {
            this.fadeOutNeonDreamsAndResume();
        } catch (e) {
            console.log('Error fading out NeonDreams:', e);
        }
        // Stop all timers
        this.stopGameTimer();
        this.stopQuestionTimer();
        clearInterval(this.timer);
        
        // Reset all stats
        this.score = 0;
        this.level = 1;
        this.streak = 0;
        this.combo = 1;
        this.currentQuestion = 0;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.lives = this.maxLives;
        this.questionTimes = [];
        this.speedBonus = 0;
        this.elapsedTime = 0;
        this.updateStats();
        this.startGame();
    }
    
    hideAllScreens() {
        console.log('hideAllScreens called');
        
        // Hide inline leaderboard
        const inlineLeaderboard = document.getElementById('inlineLeaderboardContainer');
        if (inlineLeaderboard) {
            inlineLeaderboard.style.display = 'none';
        }
        
        // Reset leaderboard card title
        const cardTitle = document.getElementById('leaderboardCardTitle');
        if (cardTitle) {
            cardTitle.textContent = 'Submit to Leaderboard';
        }
        const startScreen = document.getElementById('startScreen');
        const gameArea = document.querySelector('.game-area');
        const gameStats = document.querySelector('.game-stats');
        const feedback = document.getElementById('feedback');
        const gameOver = document.getElementById('gameOver');
        
        if (startScreen) startScreen.style.display = 'none';
        if (gameArea) gameArea.style.display = 'none';
        if (gameStats) gameStats.style.display = 'none';
        if (feedback) feedback.style.display = 'none';
        // Don't hide game over if we're in gameOver state (it will be shown explicitly)
        if (gameOver && this.gameState !== 'gameOver') {
            gameOver.style.display = 'none';
        }
        
        console.log('All screens hidden');
    }
    
    showGameArea() {
        const gameArea = document.querySelector('.game-area');
        const gameStats = document.querySelector('.game-stats');
        
        console.log('showGameArea called');
        console.log('Game area element found:', !!gameArea);
        console.log('Game stats element found:', !!gameStats);
        
        if (gameArea) {
            gameArea.style.display = 'block';
            console.log('Game area display set to block');
            
            // Force visibility with inline styles
            gameArea.style.visibility = 'visible';
            gameArea.style.opacity = '1';
            gameArea.style.zIndex = '10';
        } else {
            console.error('Game area element not found!');
        }
        
        if (gameStats) {
            gameStats.style.display = 'flex';
            console.log('Game stats display set to flex');
        } else {
            console.error('Game stats element not found!');
        }
    }
    
    updateStats() {
        const scoreEl = document.getElementById('score');
        const levelEl = document.getElementById('level');
        const streakEl = document.getElementById('streak');
        const accuracyEl = document.getElementById('accuracy');
        const comboEl = document.getElementById('combo');
        const avgSpeedEl = document.getElementById('avgSpeed');
        const gameTimerEl = document.getElementById('gameTimer');
        
        if (scoreEl) scoreEl.textContent = Math.floor(this.score);
        if (levelEl) levelEl.textContent = this.level;
        if (streakEl) streakEl.textContent = this.streak;
        if (comboEl) comboEl.textContent = `${this.combo}x`;
        
        // Update video game hearts
        this.updateHearts();
        
        // Calculate and update accuracy
        const accuracy = this.totalAnswers > 0 ? Math.round((this.correctAnswers / this.totalAnswers) * 100) : 0;
        if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;
        
        // Update average speed
        if (this.questionTimes.length > 0) {
            const avgTime = this.questionTimes.reduce((a, b) => a + b, 0) / this.questionTimes.length;
            if (avgSpeedEl) avgSpeedEl.textContent = `${avgTime.toFixed(1)}s`;
        }
        
        // Update game timer
        if (gameTimerEl && this.elapsedTime > 0) {
            const minutes = Math.floor(this.elapsedTime / 60);
            const seconds = Math.floor(this.elapsedTime % 60);
            gameTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }
    
    updateHearts() {
        const livesDisplay = document.getElementById('livesDisplay');
        if (!livesDisplay) {
            console.warn('livesDisplay not found');
            return;
        }
        
        // Make sure hearts display is visible
        livesDisplay.style.display = 'flex';
        
        const hearts = livesDisplay.querySelectorAll('.heart');
        if (hearts.length === 0) {
            console.warn('No hearts found in livesDisplay');
            return;
        }
        
        console.log('Updating hearts, current lives:', this.lives);
        
        hearts.forEach((heart, index) => {
            const heartNumber = index + 1;
            // Check if heart was full BEFORE checking anything else
            const wasFull = heart.classList.contains('heart-full');
            const isCurrentlyFull = heartNumber <= this.lives;
            
            console.log(`Heart ${heartNumber}: wasFull=${wasFull}, isCurrentlyFull=${isCurrentlyFull}, lives=${this.lives}`);
            
            if (isCurrentlyFull) {
                // Heart should be full - show it
                if (!heart.classList.contains('heart-full')) {
                    heart.classList.remove('heart-empty', 'heart-lost');
                    heart.classList.add('heart-full');
                }
                heart.style.display = 'inline-block';
                heart.style.opacity = '1';
            } else {
                // Heart should be empty
                if (wasFull && !heart.classList.contains('heart-lost')) {
                    // Just lost this heart - animate it
                    console.log(`Animating heart ${heartNumber} loss`);
                    heart.classList.remove('heart-full', 'heart-empty');
                    heart.classList.add('heart-lost');
                    setTimeout(() => {
                        if (heart.parentNode) { // Make sure heart still exists
                            heart.classList.remove('heart-lost');
                            heart.classList.add('heart-empty');
                            console.log(`Heart ${heartNumber} set to empty`);
                        }
                    }, 500);
                } else {
                    // Already empty or being set to empty
                    if (!heart.classList.contains('heart-lost')) {
                        heart.classList.remove('heart-full');
                        heart.classList.add('heart-empty');
                        heart.style.opacity = '0.25';
                        console.log(`Heart ${heartNumber} set to empty (was already empty or transitioning)`);
                    }
                }
            }
        });
    }
    
    getRandomTimestamp() {
        const timestamps = [
            'Breaking News',
            'Just In',
            'Latest',
            'Update',
            'Report'
        ];
        return timestamps[Math.floor(Math.random() * timestamps.length)];
    }
    
    getBestStreak() {
        // This would track the best streak achieved
        return [this.streak];
    }

    initAudio() {
        // Disable audio context on mobile for performance
        const isMobile = window.innerWidth <= 1400;
        if (!isMobile) {
            // Create audio context for better sound generation
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Initialize sounds object
        this.sounds = {};
        
        // Set volume for all sounds
        const volume = 0.3;
        const hoverVolume = 0.15;
        
        // Initialize background music
        this.initBackgroundMusic();
    }
    
    // Generate ASMR-style keyboard click sound
    generateKeyboardClick(frequency = 2000, duration = 60, volume = 0.2) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Disable complex audio on mobile for performance
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Create a mechanical keyboard-like sound
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'square';
        
        // Add filter for more realistic sound
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
        filter.Q.setValueAtTime(1, this.audioContext.currentTime);
        
        // Smooth envelope for ASMR feel
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }
    
    // Generate soft pop sound for hover
    generateSoftPop(frequency = 1500, duration = 40, volume = 0.1) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Disable complex audio on mobile for performance
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Soft filter for gentle sound
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }
    
    // Generate success chime
    generateSuccessChime() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Play a pleasant ascending chime
        setTimeout(() => this.generateKeyboardClick(800, 80, 0.15), 0);
        setTimeout(() => this.generateKeyboardClick(1000, 80, 0.15), 100);
        setTimeout(() => this.generateKeyboardClick(1200, 120, 0.2), 200);
    }
    
    // Generate error sound
    generateErrorSound() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Play a gentle descending sound
        setTimeout(() => this.generateKeyboardClick(600, 100, 0.15), 0);
        setTimeout(() => this.generateKeyboardClick(400, 150, 0.15), 150);
    }
    
    // Generate different button sounds based on type
    generateButtonSound(buttonType = 'default') {
        switch(buttonType) {
            case 'factual':
                this.generateKeyboardClick(1200, 70, 0.2); // Higher pitch for factual
                break;
            case 'misleading':
                this.generateKeyboardClick(800, 70, 0.2); // Lower pitch for misleading
                break;
            case 'navigation':
                this.generateKeyboardClick(1000, 60, 0.18); // Medium pitch for nav
                break;
            case 'toggle':
                this.generateKeyboardClick(900, 50, 0.15); // Soft for toggles
                break;
            default:
                this.generateKeyboardClick(1000, 65, 0.2);
        }
    }
    
    // Generate hover sound
    generateHoverSound() {
        this.generateSoftPop(1500, 35, 0.08); // Very soft and short
    }
    
    // Generate timer sound - DISABLED per user request
    generateTimerSound() {
        // Timer sound completely disabled - no sound will play
        return;
    }
    
    // Generate game start sound - DISABLED per user request
    generateGameStartSound() {
        // Game start sound disabled - no sound will play
        return;
    }
    
    // Generate game over sound
    generateGameOverSound() {
        // Play a gentle ending sequence
        setTimeout(() => this.generateKeyboardClick(800, 100, 0.2), 0);
        setTimeout(() => this.generateKeyboardClick(600, 100, 0.2), 150);
        setTimeout(() => this.generateKeyboardClick(400, 150, 0.2), 300);
    }
    
    initBackgroundMusic() {
        // Check if global music system is available and playing
        const globalMusicAvailable = typeof window.getGlobalMusicState === 'function';
        let shouldUseGameMusic = false;
        
        if (globalMusicAvailable) {
            const globalState = window.getGlobalMusicState();
            // Only use game's own music if global music system isn't working
            shouldUseGameMusic = !globalState.isPlaying && !globalState.enabled;
        } else {
            // No global music system, use game's own music
            shouldUseGameMusic = true;
        }
        
        // Create audio element for background music (only if needed)
        this.bgAudio = document.createElement('audio');
        this.bgAudio.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
            z-index: -1;
        `;
        this.bgAudio.muted = false;
        this.bgAudio.volume = 0.3;
        this.bgAudio.loop = true;
        this.bgAudio.autoplay = false; // Don't autoplay to prevent multiple instances
        this.bgAudio.preload = 'metadata';
        // Background music removed - using global music system instead
        // this.bgAudio.src = './copy_A8F29838-31C4-4D71-B2BE-5A0CACDB005B.m4a';
        
        // Add audio to document
        document.body.appendChild(this.bgAudio);
        
        // Restore music state from localStorage (check both global and game-specific)
        const globalMusicEnabled = localStorage.getItem('globalMusicEnabled') !== 'false';
        const globalMusicPlaying = localStorage.getItem('globalMusicPlaying') === 'true';
        this.isMusicPlaying = globalMusicPlaying || localStorage.getItem('musicPlaying') === 'true';
        this.musicEnabled = globalMusicEnabled && localStorage.getItem('musicEnabled') !== 'false'; // Default to true
        
        // Only start game's own music if global music system isn't available or not playing
        // This prevents double audio
        if (shouldUseGameMusic && this.isMusicPlaying && this.musicEnabled) {
            this.bgAudio.play().catch(error => {
                console.log('Auto-resume music failed:', error);
                this.isMusicPlaying = false;
            });
        }
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, pause music
                if (this.bgAudio && !this.bgAudio.paused) {
                    this.bgAudio.pause();
                }
            } else {
                // Page is visible again, resume music if it was playing
                if (this.isMusicPlaying && this.musicEnabled && this.bgAudio.paused) {
                    this.bgAudio.play().catch(error => {
                        console.log('Audio resume failed:', error);
                    });
                }
            }
        });
        
        // Set up audio event listeners
        this.bgAudio.addEventListener('loadedmetadata', () => {
            console.log('Audio loaded successfully');
        });
        
        this.bgAudio.addEventListener('error', (e) => {
            console.log('Audio error:', e);
        });
        
        // Add timeupdate listener to handle seamless looping
        this.bgAudio.addEventListener('timeupdate', () => {
            if (this.bgAudio.currentTime >= this.bgAudio.duration - 0.1) {
                // Loop when there's 0.1 seconds left for seamless transition
                this.bgAudio.currentTime = 0;
            }
        });
        
        // Save music state when it changes
        this.bgAudio.addEventListener('play', () => {
            this.isMusicPlaying = true;
            localStorage.setItem('musicPlaying', 'true');
        });
        
        this.bgAudio.addEventListener('pause', () => {
            this.isMusicPlaying = false;
            localStorage.setItem('musicPlaying', 'false');
        });
    }
    
    startBackgroundMusic() {
        // Don't start game's own music if global music system is available and playing
        if (typeof window.getGlobalMusicState === 'function') {
            const globalState = window.getGlobalMusicState();
            if (globalState.isPlaying || globalState.enabled) {
                // Global music system is handling music, don't start game's own
                return;
            }
        }
        
        if (!this.musicEnabled || !this.bgAudio) return;
        
        // Prevent duplicate instances
        if (this.isMusicPlaying) return;
        
        // Check if audio is already playing
        if (!this.bgAudio.paused) {
            this.isMusicPlaying = true;
            localStorage.setItem('musicPlaying', 'true');
            this.updateMusicButton();
            return;
        }
        
        this.bgAudio.play().then(() => {
            this.isMusicPlaying = true;
            localStorage.setItem('musicPlaying', 'true');
            this.updateMusicButton();
            this.showMusicNotification();
        }).catch(error => {
            console.log('Audio autoplay blocked:', error);
            // Only show notification if we haven't already shown one recently
            if (!this.notificationShown) {
                this.notificationShown = true;
                this.showMusicNotification(true);
                // Reset flag after 5 seconds
                setTimeout(() => {
                    this.notificationShown = false;
                }, 5000);
            }
        });
    }
    
    stopBackgroundMusic() {
        if (this.bgAudio) {
            this.bgAudio.pause();
            this.bgAudio.currentTime = 0; // Reset to beginning
            this.isMusicPlaying = false;
            localStorage.setItem('musicPlaying', 'false');
            this.updateMusicButton();
        }
    }
    
    nextRadioStation() {
        this.currentStationIndex = (this.currentStationIndex + 1) % this.radioStations.length;
        if (this.musicEnabled && this.isMusicPlaying) {
            this.startBackgroundMusic();
        }
    }
    
    previousRadioStation() {
        this.currentStationIndex = (this.currentStationIndex - 1 + this.radioStations.length) % this.radioStations.length;
        if (this.musicEnabled && this.isMusicPlaying) {
            this.startBackgroundMusic();
        }
    }
    
    updateMusicButton() {
        const musicBtn = document.getElementById('musicToggleBtn');
        if (!musicBtn) return;
        
        const icon = musicBtn.querySelector('.btn-icon');
        if (!icon) return;
        
        // Check global music state if available
        let isPlaying = false;
        let enabled = this.musicEnabled;
        
        if (typeof window.getGlobalMusicState === 'function') {
            const state = window.getGlobalMusicState();
            isPlaying = state.isPlaying;
            enabled = state.enabled;
            this.musicEnabled = enabled;
            this.isMusicPlaying = isPlaying;
        } else {
            isPlaying = this.isMusicPlaying;
        }
        
        if (enabled && isPlaying) {
            icon.textContent = '🎵';
            musicBtn.classList.remove('disabled');
            musicBtn.setAttribute('aria-pressed', 'true');
        } else if (enabled && !isPlaying) {
            icon.textContent = '⏸️';
            musicBtn.classList.remove('disabled');
            musicBtn.setAttribute('aria-pressed', 'false');
        } else {
            icon.textContent = '🔇';
            musicBtn.classList.add('disabled');
            musicBtn.setAttribute('aria-pressed', 'false');
        }
    }
    
    showMusicNotification(blocked = false) {
        // Disable notifications on mobile for performance
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) return;
        
        // Remove any existing music notifications
        const existingNotifications = document.querySelectorAll('.music-notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });
        
        const notification = document.createElement('div');
        notification.className = 'music-notification';
        
        // Check if there's already a dark mode notification and adjust position
        const existingDarkModeNotification = document.querySelector('.dark-mode-notification');
        if (existingDarkModeNotification) {
            notification.style.top = '20px'; // Keep music notification on top
            existingDarkModeNotification.style.top = '90px'; // Move dark mode notification below
        }
        
        if (blocked) {
            notification.innerHTML = `
                <div class="music-content">
                    <span class="music-icon">🎵</span>
                    <div class="music-text">
                        <h4>Background Music</h4>
                        <p>Click to enable autoplay</p>
                    </div>
                </div>
            `;
            
            // Add click handler to enable autoplay
            notification.addEventListener('click', () => {
                this.bgVideo.play().then(() => {
                    this.isMusicPlaying = true;
                    this.updateMusicButton();
                    notification.remove();
                }).catch(error => {
                    console.log('Still blocked:', error);
                });
            });
            
            notification.style.cursor = 'pointer';
        } else {
            notification.innerHTML = `
                <div class="music-content">
                    <span class="music-icon">🎵</span>
                    <div class="music-text">
                        <h4>Now Playing</h4>
                        <p>Background music is active</p>
                    </div>
                </div>
            `;
        }
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                // Reposition remaining notifications
                this.repositionNotifications();
            }
        }, 4000);
    }
    
    showDarkModeNotification() {
        // Disable notifications on mobile for performance
        const isMobile = window.innerWidth <= 1400;
        if (isMobile) return;
        
        const notification = document.createElement('div');
        notification.className = 'dark-mode-notification';
        notification.style.animation = 'musicSlideIn 0.5s ease-out';
        
        // Check if there's already a music notification and adjust position
        const existingMusicNotification = document.querySelector('.music-notification');
        if (existingMusicNotification) {
            notification.style.top = '90px'; // Stack below music notification
        }
        
        notification.innerHTML = `
            <div class="music-content">
                <span class="music-icon">🌙</span>
                <div class="music-text">
                    <h4>Dark Mode Available</h4>
                    <p>Click the moon button to toggle dark/light mode</p>
                </div>
            </div>
        `;
        
        // Add click handler to close notification
        notification.addEventListener('click', () => {
            notification.remove();
            // Reposition remaining notifications
            this.repositionNotifications();
        });
        
        notification.style.cursor = 'pointer';
        document.body.appendChild(notification);
        
        // Remove after 6 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                // Reposition remaining notifications
                this.repositionNotifications();
            }
        }, 6000);
    }
    
    repositionNotifications() {
        const musicNotification = document.querySelector('.music-notification');
        const darkModeNotification = document.querySelector('.dark-mode-notification');
        
        if (musicNotification) {
            musicNotification.style.top = '20px';
        }
        
        if (darkModeNotification && !musicNotification) {
            darkModeNotification.style.top = '20px';
        }
    }
    
    showSpotifyMessage(song) {
        // Create a notification to open the song in Spotify
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 20px;
            border-radius: 15px;
            font-size: 14px;
            z-index: 1000;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.3);
            max-width: 300px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 600; color: #1DB954;">🎵 Now Playing</div>
            <div style="margin-bottom: 5px; font-weight: 500;">${song.title}</div>
            <div style="margin-bottom: 15px; opacity: 0.8; font-size: 12px;">by ${song.artist}</div>
            <div style="margin-bottom: 15px; font-size: 12px; opacity: 0.7;">
                Click below to open in Spotify
            </div>
            <button onclick="window.open('${song.url}', '_blank')" style="
                background: #1DB954;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            ">Open in Spotify</button>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
    }
    
    playNextSong() {
        if (!this.musicEnabled) return;
        
        // Move to next song
        this.currentMusicIndex = (this.currentMusicIndex + 1) % this.backgroundMusic.length;
        
        // Play the next actual song
        this.playCurrentSong();
    }
    
    playSound(soundName, buttonType = 'default') {
        if (!this.soundEnabled) return;
        
        try {
            switch(soundName) {
                case 'correct':
                    this.generateSuccessChime();
                    break;
                case 'incorrect':
                    this.generateErrorSound();
                    break;
                case 'button':
                    this.generateButtonSound(buttonType);
                    break;
                case 'hover':
                    this.generateHoverSound();
                    break;
                case 'timer':
                    // Timer sound completely disabled per user request
                    return;
                case 'gameStart':
                    this.generateGameStartSound();
                    break;
                case 'gameOver':
                    this.generateGameOverSound();
                    break;
                default:
                    this.generateButtonSound(buttonType);
            }
        } catch (error) {
            console.log('Sound playback failed:', error);
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundBtn = document.getElementById('soundToggleBtn');
        const icon = soundBtn.querySelector('.btn-icon');
        
        if (this.soundEnabled) {
            soundBtn.classList.remove('muted');
            icon.textContent = '🔊';
        } else {
            soundBtn.classList.add('muted');
            icon.textContent = '🔇';
        }
    }
    
    toggleMusic() {
        // Use global music system if available
        if (typeof window.toggleGlobalMusic === 'function') {
            const isPlaying = window.toggleGlobalMusic();
            this.musicEnabled = isPlaying;
            this.isMusicPlaying = isPlaying;
            localStorage.setItem('globalMusicEnabled', isPlaying ? 'true' : 'false');
            localStorage.setItem('globalMusicPlaying', isPlaying ? 'true' : 'false');
        } else {
            // Fallback to game's own music system
            this.musicEnabled = !this.musicEnabled;
            localStorage.setItem('musicEnabled', this.musicEnabled.toString());
            
            if (this.musicEnabled) {
                this.startBackgroundMusic();
            } else {
                this.stopBackgroundMusic();
            }
        }
        
        this.updateMusicButton();
    }
    
    // Initialize logo animation with puzzle piece sound
    initLogoAnimation() {
        console.log('initLogoAnimation called!');
        
        // N and W logos meet in the middle at 2 seconds (0.5s delay + 1.5s animation)
        // Puzzle piece sound disabled per user request
        // setTimeout(() => {
        //     console.log('Playing puzzle piece sound!');
        //     playPuzzlePiece();
        // }, 2500);
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseToggleBtn');
        const icon = pauseBtn.querySelector('.btn-icon');
        
        if (this.isPaused) {
            // Pause the game
            this.pauseGame();
            pauseBtn.classList.add('paused');
            icon.textContent = '▶️';
        } else {
            // Resume the game
            this.resumeGame();
            pauseBtn.classList.remove('paused');
            icon.textContent = '⏸️';
        }
    }
    
    pauseGame() {
        if (this.timer) {
            clearInterval(this.timer);
            this.pauseTimeLeft = this.timeLeft;
        }
        
        // Pause game timer and question timer
        this.stopGameTimer();
        this.stopQuestionTimer();
        
        // Store pause time for game timer
        if (this.startTime) {
            this.pauseGameTime = Date.now() - this.startTime;
        }
        
        // Show pause overlay
        const pauseOverlay = document.getElementById('pauseOverlay');
        const pauseScore = document.getElementById('pauseScore');
        const pauseTime = document.getElementById('pauseTime');
        
        if (pauseOverlay && pauseScore && pauseTime) {
            pauseScore.textContent = Math.floor(this.score);
            pauseTime.textContent = `${this.timeLeft}s`;
            pauseOverlay.classList.add('show');
        }
        
        // Disable game buttons if they exist
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        if (factBtn) factBtn.disabled = true;
        if (fakeBtn) fakeBtn.disabled = true;
        
        
        // Disable other interactive elements
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        const difficultyToggle = document.getElementById('difficultyToggle');
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (nextHeadlineBtn) nextHeadlineBtn.disabled = true;
        if (difficultyToggle) difficultyToggle.disabled = true;
        if (startBtn) startBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = true;
    }
    
    resumeGame() {
        // Hide pause overlay
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) {
            pauseOverlay.classList.remove('show');
        }
        
        // Resume game timer
        if (this.pauseGameTime !== undefined && this.startTime) {
            this.startTime = Date.now() - this.pauseGameTime;
            this.startGameTimer();
        }
        
        // Resume question timer if question is active
        if (this.questionStartTime) {
            this.startQuestionTimer();
        }
        
        // Resume question timer if active
        if (this.pauseTimeLeft) {
            this.timeLeft = this.pauseTimeLeft;
            this.startTimer();
        }
        
        // Re-enable game buttons
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        if (factBtn) factBtn.disabled = false;
        if (fakeBtn) fakeBtn.disabled = false;
        
        
        // Re-enable other interactive elements
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        const difficultyToggle = document.getElementById('difficultyToggle');
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (nextHeadlineBtn) nextHeadlineBtn.disabled = false;
        if (difficultyToggle) difficultyToggle.disabled = false;
        if (startBtn) startBtn.disabled = false;
        if (restartBtn) restartBtn.disabled = false;
    }
}

// Initialize the game when the page loads (only on game page)
document.addEventListener('DOMContentLoaded', () => {
    const headlineEl = document.getElementById('headline');
    console.log('DOM loaded, initializing game only if on game page. Game headline present:', !!headlineEl);
    if (!headlineEl) return;
    window.game = new BreakingNewsGame();
    console.log('Game initialized:', window.game);
});

// Add some fun sound effects (optional)
function playSound(type) {
    // This could be expanded with actual sound files
    console.log(`Playing ${type} sound`);
}

// Add keyboard shortcuts (only on game page)
document.addEventListener('keydown', (e) => {
    try {
        // Only handle keyboard shortcuts if we're on the game page
        const factBtn = document.getElementById('factBtn');
        const fakeBtn = document.getElementById('fakeBtn');
        
        // Early return if not on game page - prevents any errors
        if (!factBtn || !fakeBtn) {
            return;
        }
        
        if (e.key === '1' || e.key === 'f' || e.key === 'F') {
            if (factBtn && !factBtn.disabled) {
                factBtn.click();
            }
        } else if (e.key === '2' || e.key === 'm' || e.key === 'M') {
            if (fakeBtn && !fakeBtn.disabled) {
                fakeBtn.click();
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            const nextBtn = document.getElementById('nextBtn');
            const startBtn = document.getElementById('startBtn');
            const restartBtn = document.getElementById('restartBtn');
            
            if (nextBtn && nextBtn.style && nextBtn.style.display !== 'none' && !nextBtn.disabled) {
                nextBtn.click();
            } else if (startBtn && startBtn.style && startBtn.style.display !== 'none' && !startBtn.disabled) {
                startBtn.click();
            } else if (restartBtn && restartBtn.style && restartBtn.style.display !== 'none' && !restartBtn.disabled) {
                restartBtn.click();
            }
        } else if (e.key === 'p' || e.key === 'P') {
            // Pause/Resume game with 'P' key
            if (window.game && typeof window.game.togglePause === 'function') {
                window.game.togglePause();
            }
        }
    } catch (err) {
        // Silently ignore keyboard shortcut errors
        // Prevents console spam when elements don't exist
    }
});

// Helicopter functionality
function flyAwayHelicopter() {
    const helicopter = document.getElementById('helicopter');
    if (helicopter) {
        helicopter.style.animation = 'helicopterFlyAway 3s ease-in-out forwards';
        helicopter.style.cursor = 'default';
        
        // Remove click event after flying away
        helicopter.removeEventListener('click', flyAwayHelicopter);
        
        // Optional: Add sound effect
        if (window.game && window.game.audio) {
            window.game.playSound('hover');
        }
    }
}

// Add helicopter click event when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const helicopter = document.getElementById('helicopter');
    if (helicopter) {
        helicopter.addEventListener('click', flyAwayHelicopter);
        helicopter.style.cursor = 'pointer';
    }
});

// Initialize everything when the page loads
document.addEventListener("DOMContentLoaded", function() {
    console.log("Noteworthy News website initialized successfully!");
    
    // Make openChatWidget globally available
    window.openChatWidget = openChatWidget;
    
    // Authentication system disabled - all features are now open to everyone
    
    // Initialize navigation system
    window.newsNavigation = new NewsNavigation();
    
    // Initialize game system only on game page
    const gameHeadline = document.getElementById('headline');
    if (gameHeadline && !window.game) {
        window.game = new BreakingNewsGame();
    }
    
    // Add notification styles
    const style = document.createElement("style");
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        }
        
        .notification-success {
            background: linear-gradient(45deg, #2ecc71, #27ae60);
        }
        
        .notification-info {
            background: linear-gradient(45deg, #3498db, #2980b9);
        }
        
        .notification-error {
            background: linear-gradient(45deg, #e74c3c, #c0392b);
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize newsletter subscription
    initNewsletterSubscription();
    
    // Show console welcome message on page load (will appear when console is opened)
    // Also set up to show when console opens
    let consoleWelcomeShown = false;
    let consoleCheckCount = 0;
    const MAX_CONSOLE_CHECKS = 10; // Limit checks to prevent spam
    
    const showWelcomeWhenConsoleOpens = () => {
        if (consoleWelcomeShown || consoleCheckCount >= MAX_CONSOLE_CHECKS) {
            if (consoleCheckCount >= MAX_CONSOLE_CHECKS) {
                // Stop the interval if we've checked enough times
                return;
            }
            return;
        }
        
        consoleCheckCount++;
        const start = performance.now();
        // Use a more efficient detection method
        try {
        console.log('%c ', 'font-size: 1px;');
        } catch (e) {
            // Console might be closed, stop checking
            consoleWelcomeShown = true;
            return;
        }
        const end = performance.now();
        if (end - start > 1) {
            consoleWelcomeShown = true;
            showConsoleWelcome();
        }
    };
    
    // Check immediately and periodically (but with limit)
    showWelcomeWhenConsoleOpens();
    const consoleCheckInterval = setInterval(() => {
        showWelcomeWhenConsoleOpens();
        if (consoleWelcomeShown || consoleCheckCount >= MAX_CONSOLE_CHECKS) {
            clearInterval(consoleCheckInterval);
        }
    }, 1000); // Reduced frequency to every 1 second instead of 500ms
});

// Cool console welcome message with ASCII art
function showConsoleWelcome() {
    const asciiArt = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███╗   ██╗ ██████╗ ████████╗███████╗██╗    ██╗ ██████╗      ║
║   ████╗  ██║██╔═══██╗╚══██╔══╝██╔════╝██║    ██║██╔═══██╗     ║
║   ██╔██╗ ██║██║   ██║   ██║   █████╗  ██║ █╗ ██║██║   ██║     ║
║   ██║╚██╗██║██║   ██║   ██║   ██╔══╝  ██║███╗██║██║   ██║     ║
║   ██║ ╚████║╚██████╔╝   ██║   ███████╗╚███╔███╔╝╚██████╔╝     ║
║   ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚══════╝ ╚══╝╚══╝  ╚═════╝      ║
║                                                               ║
║   ███╗   ██╗███████╗██╗    ██╗███████╗                        ║
║   ████╗  ██║██╔════╝██║    ██║██╔════╝                        ║
║   ██╔██╗ ██║█████╗  ██║ █╗ ██║███████╗                        ║
║   ██║╚██╗██║██╔══╝  ██║███╗██║╚════██║                        ║
║   ██║ ╚████║███████╗╚███╔███╔╝███████║                        ║
║   ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝ ╚══════╝                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `;
    
    console.log('%c' + asciiArt, 'font-family: monospace; font-size: 10px; line-height: 1.2; color: #667eea; font-weight: bold;');
    console.log('%c✨ Made with a ton of love and months of hardwork ✨', 'font-size: 16px; font-weight: bold; color: #764ba2; padding: 10px 0;');
    console.log('%cThanks for checking out the code! 👨‍💻', 'font-size: 14px; color: #333; margin-top: 10px;');
    console.log('%cIf you have any tips to improve my code, please DM me on X @newsnoteworthy 💬', 'font-size: 13px; color: #667eea; margin-top: 5px;');
    console.log('%c🔗 https://x.com/newsnoteworthy', 'font-size: 12px; color: #999; margin-top: 5px;');
    console.log('%c' + '═'.repeat(60), 'font-size: 1px; color: #ddd;');
}

// DevTools Detection Easter Egg - REMOVED
/*
function initDevToolsSurprise() {
    let surpriseShown = false;
    let pageLoaded = false;
    let initialWidth = 0;
    let initialHeight = 0;
    
    // Wait for page to fully load before starting detection
    if (document.readyState === 'complete') {
        pageLoaded = true;
        initialWidth = window.outerWidth - window.innerWidth;
        initialHeight = window.outerHeight - window.innerHeight;
    } else {
        window.addEventListener('load', () => {
            pageLoaded = true;
            initialWidth = window.outerWidth - window.innerWidth;
            initialHeight = window.outerHeight - window.innerHeight;
        });
    }
    
    // Immediate detection on keyboard shortcuts (most common way to open DevTools)
    document.addEventListener('keydown', function(e) {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'U')) {
            // Show immediately, no delay
            if (!surpriseShown) {
                showDevToolsSurprise();
            }
        }
    });
    
    // Immediate detection via right-click context menu (Inspect Element)
    // When user right-clicks, we'll check for DevTools opening shortly after
    let rightClickTime = 0;
    let rightClickElement = null;
    
    document.addEventListener('contextmenu', function(e) {
        rightClickTime = Date.now();
        rightClickElement = e.target;
        
        // Also trigger a check immediately after context menu appears
        // (user might click "Inspect Element" from the menu)
        // Check multiple times rapidly to catch it instantly
        const checkInterval = setInterval(() => {
            if (surpriseShown) {
                clearInterval(checkInterval);
                return;
            }
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;
            if (widthDiff > 160 || heightDiff > 160) {
                showDevToolsSurprise();
                clearInterval(checkInterval);
            }
        }, 50); // Check every 50ms
        
        // Stop checking after 2 seconds
        setTimeout(() => clearInterval(checkInterval), 2000);
    });
    
    // Also detect when focus leaves the page (often happens when DevTools opens)
    let blurTime = 0;
    window.addEventListener('blur', function() {
        blurTime = Date.now();
    });
    
    window.addEventListener('focus', function() {
        // If page was blurred and refocused quickly, might be DevTools
        const timeSinceBlur = Date.now() - blurTime;
        if (timeSinceBlur < 500 && blurTime > 0 && !surpriseShown) {
            setTimeout(() => {
                const widthDiff = window.outerWidth - window.innerWidth;
                const heightDiff = window.outerHeight - window.innerHeight;
                if (widthDiff > 160 || heightDiff > 160) {
                    showDevToolsSurprise();
                }
            }, 100);
        }
    });
    
    // Fast polling for window size changes (catches DevTools opening)
    let lastWidth = initialWidth;
    let lastHeight = initialHeight;
    
    function checkDevTools() {
        // Don't check until page is loaded
        if (!pageLoaded) return;
        
        const currentWidth = window.outerWidth - window.innerWidth;
        const currentHeight = window.outerHeight - window.innerHeight;
        
        // If window dimensions changed significantly from initial, DevTools likely opened
        // Check for significant change from last check AND from initial
        const changeFromLast = Math.abs(currentWidth - lastWidth) > 160 || Math.abs(currentHeight - lastHeight) > 160;
        const changeFromInitial = Math.abs(currentWidth - initialWidth) > 160 || Math.abs(currentHeight - initialHeight) > 160;
        
        if (changeFromLast && changeFromInitial) {
            if (!surpriseShown) {
                showDevToolsSurprise();
            }
        }
        
        lastWidth = currentWidth;
        lastHeight = currentHeight;
    }
    
    // Start polling after page loads (every 100ms for detection)
    setTimeout(() => {
        if (pageLoaded) {
            setInterval(checkDevTools, 100);
        }
    }, 1000); // Wait 1 second after page load
    
    // Also check on resize (but only after page loaded)
    window.addEventListener('resize', () => {
        if (pageLoaded) {
            checkDevTools();
        }
    });
    
    // Console detection - check after page loads
    let consoleDetected = false;
    function detectConsole() {
        if (!pageLoaded || consoleDetected || surpriseShown) return;
        
        const start = performance.now();
        console.log('%c ', 'font-size: 1px;');
        const end = performance.now();
        const timeTaken = end - start;
        
        // If console is open, logging takes significantly longer
        if (timeTaken > 1) {
            consoleDetected = true;
            showDevToolsSurprise();
        }
    }
    
    // Check console after page loads (wait a bit to avoid false positives)
    setTimeout(() => {
        if (pageLoaded) {
            detectConsole();
            setInterval(detectConsole, 200);
        }
    }, 2000); // Wait 2 seconds after page load
    
    function showDevToolsSurprise() {
        if (surpriseShown) return;
        surpriseShown = true;
        
        // Log DevTools detection to analytics
        try {
            if (window.analyticsTracker && typeof window.analyticsTracker.log === 'function') {
                window.analyticsTracker.log('devtools-opened', {
                    detectionMethod: 'automatic',
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    pageUrl: window.location.href,
                    pageTitle: document.title
                });
            } else {
                // Fallback: direct fetch if analytics tracker not available
                fetch('/.netlify/functions/log-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        dataType: 'devtools-opened',
                        data: {
                            detectionMethod: 'automatic',
                            timestamp: new Date().toISOString(),
                            userAgent: navigator.userAgent,
                            pageUrl: window.location.href,
                            pageTitle: document.title,
                            referrer: document.referrer
                        }
                    })
                }).catch(err => console.error('Failed to log DevTools detection:', err));
            }
        } catch (err) {
            console.error('Error logging DevTools detection:', err);
        }
        
        // Create surprise message overlay
        const surprise = document.createElement('div');
        surprise.id = 'devtools-surprise';
        surprise.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                animation: surpriseFadeIn 0.5s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            ">
                <div style="
                    text-align: center;
                    color: white;
                    padding: 40px;
                    max-width: 600px;
                ">
                    <h1 style="
                        font-size: 48px;
                        margin: 0 0 20px 0;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                        animation: bounce 1s ease-in-out;
                    ">🎉</h1>
                    <h2 style="
                        font-size: 36px;
                        margin: 0 0 20px 0;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    ">Hey there, curious developer! 👋</h2>
                    <p style="
                        font-size: 24px;
                        line-height: 1.6;
                        margin: 0 0 20px 0;
                        opacity: 0.95;
                        font-weight: 600;
                    ">Thanks for being curious!! 🎉</p>
                    <p style="
                        font-size: 18px;
                        line-height: 1.6;
                        margin: 0 0 20px 0;
                        opacity: 0.9;
                    ">You found the secret! 🕵️‍♂️ We love developers who dig into the code and explore how things work.</p>
                    <p style="
                        font-size: 18px;
                        line-height: 1.6;
                        margin: 0 0 30px 0;
                        opacity: 0.9;
                    ">If you have any tips to improve my code, please DM me on X <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="color: #fff; text-decoration: underline; font-weight: 600; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8';" onmouseout="this.style.opacity='1';">@newsnoteworthy</a> - I'd love to hear from you! 💬</p>
                    <button id="close-surprise-btn" style="
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 15px 40px;
                        font-size: 18px;
                        font-weight: 600;
                        border-radius: 50px;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                        transition: transform 0.2s, box-shadow 0.2s;
                    " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.2)';">
                        Continue Exploring 🚀
                    </button>
                </div>
            </div>
            <style>
                @keyframes surpriseFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
            </style>
        `;
        
        document.body.appendChild(surprise);
        
        // Add close button functionality
        const closeBtn = surprise.querySelector('#close-surprise-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                surprise.remove();
            });
        }
        
        // Also allow closing by clicking outside the content (on the overlay)
        const overlay = surprise.querySelector('div');
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                // Only close if clicking directly on the overlay, not on the content
                if (e.target === overlay) {
                    surprise.remove();
                }
            });
        }
        
        // Allow closing with Escape key
        const escapeHandler = function(e) {
            if (e.key === 'Escape') {
                surprise.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Show cool welcome message in console
        showConsoleWelcome();
        
        // Also log a fun message to console
        console.log('%c🎉 Surprise! You found the easter egg!', 'font-size: 20px; font-weight: bold; color: #667eea; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);');
        console.log('%cThanks for being curious!! 👨‍💻', 'font-size: 18px; font-weight: bold; color: #764ba2;');
        console.log('%cIf you have any tips to improve my code, please DM me on X @newsnoteworthy - I\'d love to hear from you! 💬', 'font-size: 14px; color: #333; line-height: 1.6;');
        console.log('%c🔗 https://x.com/newsnoteworthy', 'font-size: 14px; color: #667eea; text-decoration: underline;');
    }
}
*/

// Welcome text cycling functionality
function initWelcomeTextCycling() {
    const welcomeText = document.getElementById('welcomeText');
    if (!welcomeText) return;

    const welcomePhrases = [
        "Welcome Home!",
        "Welcome to awesomeness!",
        "Welcome to the future!",
        "Welcome to greatness!",
        "Welcome to excellence!",
        "Welcome to innovation!",
        "Welcome to discovery!",
        "Welcome to truth!",
        "Welcome to knowledge!",
        "Welcome to wisdom!"
    ];

    let currentIndex = 0;
    let isAnimating = false;
    let currentSpeed = CONFIG.ANIMATION_SPEEDS.START_SPEED; // Start slow
    const speedAcceleration = CONFIG.ANIMATION_SPEEDS.ACCELERATION_FACTOR; // Speed up by 25% each time

    function cycleText() {
        if (isAnimating) return;
        isAnimating = true;

        // Play swoosh sound for text change
        playSwoosh('swoosh1');
        
        // Squeeze flip animation
        welcomeText.style.animation = 'squeezeFlip 0.6s ease-in-out';

        setTimeout(() => {
            // Change text
            welcomeText.textContent = welcomePhrases[currentIndex];
            
            // Gentle glow effect
            welcomeText.style.animation = 'gentleGlow 1.2s ease-in-out';

            // Move to next phrase
            currentIndex = (currentIndex + 1) % welcomePhrases.length;

            // If we've shown all phrases, stop cycling
            if (currentIndex === 0) {
                setTimeout(() => {
                    // Final squeeze flip out
                    welcomeText.style.animation = 'squeezeFlip 0.8s ease-in-out';
                        
                    setTimeout(() => {
                        // Play swoosh sound for final text
                        playSwoosh('swoosh2');
                        
                        // Show final text
                        welcomeText.textContent = "Welcome to Noteworthy News";
                        
                        // CRITICAL: Ensure text stays within bounds after animation
                        welcomeText.style.maxWidth = '100%';
                        welcomeText.style.width = 'auto';
                        
                        // Gentle glow effect for final text
                        welcomeText.style.animation = 'gentleGlow 1.5s ease-in-out';

                        isAnimating = false;
                        
                        // Add alive and loving animations after final text
                        setTimeout(() => {
                            // Heart beat animation
                            welcomeText.style.animation = 'heartBeat 1.5s ease-in-out';
                            
                            // Add warm glow effect
                            welcomeText.style.filter = 'brightness(1.2)';
                            
                            // Create sparkles around the text
                            createSparkles();
                            
                            // Add gentle pulse effect
                            setTimeout(() => {
                                welcomeText.style.animation = 'gentlePulse 2s ease-in-out infinite';
                            }, 1500);
                            
                            // Stop all animations and return to normal after 8 seconds
                            setTimeout(() => {
                                welcomeText.style.animation = 'none';
                                welcomeText.style.filter = 'none';
                                welcomeText.textContent = "Welcome to Noteworthy News";
                                
                                // CRITICAL: Ensure text stays within bounds after final animation
                                welcomeText.style.maxWidth = '100%';
                                welcomeText.style.width = 'auto';
                            }, 8000);
                            
                        }, 500);
                    }, 150);
                }, 800); // Wait before final transition
                return;
            }

            // Accelerate the speed for next cycle
            currentSpeed = Math.max(currentSpeed * speedAcceleration, CONFIG.ANIMATION_SPEEDS.MIN_SPEED); // Don't go faster than minimum speed
            
            isAnimating = false;
            
            // Schedule next cycle with current speed
            setTimeout(cycleText, currentSpeed);
        }, 150);
    }

    // Start cycling after a delay
    setTimeout(() => {
        // Initial delay before starting
        setTimeout(cycleText, CONFIG.ANIMATION_DELAYS.INITIAL_DELAY);
    }, CONFIG.ANIMATION_DELAYS.INITIAL_DELAY);
}

// Welcome location functionality - Automatic IP-based detection (no permission needed)
function initWelcomeLocation() {
    const locationElement = document.getElementById('welcomeLocation');
    if (!locationElement) return;
    
    // Get location automatically from IP after a short delay (to let the page settle)
    setTimeout(() => {
        getLocationFromIP(locationElement);
    }, 2000);
}

function getLocationFromIP(locationElement) {
    // Use a free IP geolocation service - automatic, no permission required
    // Show region/state and country for privacy (not specific city)
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            let locationName = '';
            
            // Try multiple possible field names for region/state
            // ipapi.co uses 'region' for most countries, but some APIs use 'region_name', 'subdivision', 'state', etc.
            const region = data.region || 
                          data.region_name || 
                          data.subdivision || 
                          data.state || 
                          data.state_province ||
                          data.province ||
                          data.administrative_area_level_1 ||
                          '';
            
            const country = data.country_name || 
                           data.country || 
                           '';
            
            // Show region/state and country for all countries (not just US)
            // Format: "Region, Country" or "State, Country"
            if (region && country) {
                locationName = `${region}, ${country}`;
            } else if (country) {
                // Fallback to just country if no region available
                locationName = country;
            } else if (region) {
                // Fallback to just region if no country (shouldn't happen, but handle it)
                locationName = region;
            }
            
            if (locationName) {
                displayLocation(locationElement, locationName);
            }
        })
        .catch(error => {
            console.log('IP geolocation error:', error);
            // Try alternative API as fallback
            tryAlternativeLocationAPI(locationElement);
        });
}

function tryAlternativeLocationAPI(locationElement) {
    // Fallback to ip-api.com if ipapi.co fails (uses HTTPS for mixed content)
    fetch('https://ip-api.com/json/')
        .then(response => response.json())
        .then(data => {
            let locationName = '';
            
            // ip-api.com uses 'regionName' and 'country'
            // Check multiple possible field names
            const region = data.regionName || 
                          data.region || 
                          data.state || 
                          data.state_province ||
                          data.subdivision ||
                          data.province ||
                          '';
            
            const country = data.country || 
                           data.countryName || 
                           '';
            
            if (region && country) {
                locationName = `${region}, ${country}`;
            } else if (country) {
                locationName = country;
            } else if (region) {
                locationName = region;
            }
            
            if (locationName) {
                displayLocation(locationElement, locationName);
            }
        })
        .catch(error => {
            console.log('Alternative IP geolocation also failed:', error);
            // Silently fail - don't show anything if location can't be determined
        });
}

function displayLocation(locationElement, locationName) {
    if (locationElement && locationName) {
        locationElement.textContent = `Welcome from ${locationName}`;
        // Fade in the location text (200-300ms delay for subtle entrance)
        setTimeout(() => {
            locationElement.classList.add('visible');
        }, 250);
    }
}

// Function to create sparkles around the welcome text
function createSparkles() {
    const welcomeText = document.getElementById('welcomeText');
    if (!welcomeText) return;
    
    const rect = welcomeText.getBoundingClientRect();
    const sparkleContainer = document.createElement('div');
    sparkleContainer.style.position = 'absolute';
    sparkleContainer.style.pointerEvents = 'none';
    sparkleContainer.style.zIndex = '1000';
    document.body.appendChild(sparkleContainer);
    
    // Create multiple sparkles
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.innerHTML = '✨';
            sparkle.style.position = 'absolute';
            sparkle.style.left = (rect.left + Math.random() * rect.width) + 'px';
            sparkle.style.top = (rect.top + Math.random() * rect.height) + 'px';
            sparkle.style.fontSize = '20px';
            sparkle.style.animation = 'sparkle 1.5s ease-in-out';
            sparkle.style.pointerEvents = 'none';
            
            sparkleContainer.appendChild(sparkle);
            
            // Remove sparkle after animation
            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.parentNode.removeChild(sparkle);
                }
            }, 1500);
        }, i * 200);
    }
    
    // Remove container after all sparkles are done
    setTimeout(() => {
        if (sparkleContainer.parentNode) {
            sparkleContainer.parentNode.removeChild(sparkleContainer);
        }
    }, 3000);
}

// Function to toggle the chat widget (can be called from anywhere)
function openChatWidget() {
    // Try to find the chat widget - retry multiple times if not immediately available
    let chatWidget = document.querySelector('noteworthy-chat-widget');
    
    // If not found, wait a bit and try again (widget might still be loading)
    if (!chatWidget) {
        let retries = 0;
        const maxRetries = 10; // Try for up to 1 second (10 * 100ms)
        
        const checkForWidget = setInterval(() => {
            retries++;
            chatWidget = document.querySelector('noteworthy-chat-widget');
            
            if (chatWidget) {
                clearInterval(checkForWidget);
                toggleChatWidget(chatWidget);
            } else if (retries >= maxRetries) {
                clearInterval(checkForWidget);
                console.warn('Chat widget not found after multiple retries. Make sure noteworthy-chat.js is loaded.');
                // Try to create the widget if it doesn't exist
                try {
                    const el = document.createElement('noteworthy-chat-widget');
                    el.setAttribute('data-endpoint', '/api/noteworthy');
                    el.setAttribute('data-open', 'false');
                    document.body.appendChild(el);
                    // Wait a bit more and try again
                    setTimeout(() => {
                        chatWidget = document.querySelector('noteworthy-chat-widget');
                        if (chatWidget) {
                            toggleChatWidget(chatWidget);
                        }
                    }, 200);
                } catch (err) {
                    console.error('Failed to create chat widget:', err);
                }
            }
        }, 100);
        return;
    }
    
    toggleChatWidget(chatWidget);
}

// Helper function to toggle the widget (open if closed, close if open)
function toggleChatWidget(chatWidget) {
    // Access the shadow DOM
    const shadowRoot = chatWidget.shadowRoot;
    if (!shadowRoot) {
        console.warn('Chat widget shadow root not found');
        return;
    }

    // Find the wrap element inside shadow DOM
    const wrap = shadowRoot.querySelector('.wrap');
    if (!wrap) {
        console.warn('Chat widget wrap element not found');
        return;
    }

    // Check if widget is currently open
    const isOpen = wrap.classList.contains('open');

    if (isOpen) {
        // Close the widget
        wrap.classList.remove('open');
        const launcher = shadowRoot.querySelector('.launcher');
        if (launcher) {
            launcher.setAttribute('aria-expanded', 'false');
        }
    } else {
        // Open the widget
        wrap.classList.add('open');
        
        // Focus the input field
        const input = shadowRoot.querySelector('.input input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }

        // Update launcher aria-expanded
        const launcher = shadowRoot.querySelector('.launcher');
        if (launcher) {
            launcher.setAttribute('aria-expanded', 'true');
        }
    }
}

// Legacy function name for backwards compatibility
function openChatWidgetElement(chatWidget) {
    toggleChatWidget(chatWidget);
}

// Navigation functionality
function initNavigation() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const href = link.getAttribute('href');
            
            // Check for external links (http/https)
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                // External link - don't prevent default, allow normal navigation
                return;
            }
            
            // Special handling for AI Chat link - open chat widget
            if (href === '#ai-assistant-section') {
                openChatWidget();
                // Still update active state
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                return;
            }
            
            // Remove active class from all links
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get target section
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Smooth scroll to target with header offset
                const header = document.querySelector('.main-header');
                const headerHeight = header ? header.offsetHeight : 0;
                const rect = targetSection.getBoundingClientRect();
                const offsetTop = window.pageYOffset + rect.top - (headerHeight + 10);
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        });
    });
    
    // Update active navigation based on scroll position
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('#news-section, #fact-checker-section, #credibility-section, #about-section');
        const navLinks = document.querySelectorAll('.nav-link');
        
        let current = '';
        const header = document.querySelector('.main-header');
        const headerHeight = header ? header.offsetHeight : 0;
        sections.forEach(section => {
            const sectionTop = section.offsetTop - (headerHeight + 20);
            if (window.pageYOffset >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Mobile menu functionality
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    
    if (!mobileMenuToggle || !mobileNav) return;
    
    // Toggle mobile menu
    mobileMenuToggle.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
        mobileMenuToggle.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    const mobileNavLinks = mobileNav.querySelectorAll('.nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenuToggle.contains(e.target) && !mobileNav.contains(e.target)) {
            mobileNav.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        }
    });
    
    // Close mobile menu with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
            mobileNav.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        }
    });
}

// News carousel functionality - using native scrolling
function initNewsCarousel() {
    // Native scrolling is handled by the browser
    // No custom carousel implementation needed
}

// Initialize background music autoplay
function initBackgroundMusic() {
    const backgroundMusic = document.getElementById('backgroundMusic');
    const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
    const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
    const musicControlBtn = document.getElementById('musicControlBtn');
    
    if (!backgroundMusic) {
        console.error('Background music element not found!');
        return;
    }
    
    console.log('Initializing background music...');
    console.log('Audio element found:', backgroundMusic);
    console.log('Audio source:', backgroundMusic.src || backgroundMusic.querySelector('source')?.src);
    
    // Set volume to a reasonable level (0.0 to 1.0)
    backgroundMusic.volume = 0.5;
    if (backgroundMusicSecond) {
        backgroundMusicSecond.volume = 0.5;
    }
    if (backgroundMusicLoop) {
        backgroundMusicLoop.volume = 0.5;
    }
    
    // Simple immediate playback attempt
    console.log('🎵 Attempting immediate music playback...');
    
    // Set volume and try to play
    backgroundMusic.volume = 0.5;
    backgroundMusic.muted = false;
    
    // Update button state based on music playing status (any track)
    function updateMusicButtonState() {
        if (musicControlBtn) {
            const isPlaying = (!backgroundMusic.paused) || 
                             (backgroundMusicSecond && !backgroundMusicSecond.paused) || 
                             (backgroundMusicLoop && !backgroundMusicLoop.paused);
            if (isPlaying) {
                musicControlBtn.classList.add('playing');
                musicControlBtn.querySelector('.btn-icon').textContent = '🔇';
                musicControlBtn.title = 'Mute Background Music';
            } else {
                musicControlBtn.classList.remove('playing');
                musicControlBtn.querySelector('.btn-icon').textContent = '🎵';
                musicControlBtn.title = 'Play Background Music';
            }
        }
    }
    
    // Add event listeners for music state changes
    backgroundMusic.addEventListener('play', updateMusicButtonState);
    backgroundMusic.addEventListener('pause', updateMusicButtonState);
    backgroundMusic.addEventListener('ended', () => {
        updateMusicButtonState();
        // When first track ends, play second track
        if (backgroundMusicSecond) {
            pauseAllTracks(false); // Don't save state when transitioning automatically
            backgroundMusicSecond.volume = backgroundMusic.volume;
            backgroundMusicSecond.play().catch(err => console.log('Failed to play second track:', err));
        }
    });
    
    if (backgroundMusicSecond) {
        backgroundMusicSecond.addEventListener('play', updateMusicButtonState);
        backgroundMusicSecond.addEventListener('pause', updateMusicButtonState);
        backgroundMusicSecond.addEventListener('ended', () => {
            updateMusicButtonState();
            // When second track ends, play loop track
            if (backgroundMusicLoop) {
                pauseAllTracks(false); // Don't save state when transitioning automatically
                backgroundMusicLoop.volume = backgroundMusicSecond.volume;
                backgroundMusicLoop.play().catch(err => console.log('Failed to play loop track:', err));
            }
        });
    }
    
    if (backgroundMusicLoop) {
        backgroundMusicLoop.addEventListener('play', updateMusicButtonState);
        backgroundMusicLoop.addEventListener('pause', updateMusicButtonState);
    }
    
    // Function to save current music state before pausing
    function saveMusicState() {
        let currentTrack = 'none';
        let currentTime = 0;
        
        // Check which track is currently playing
        if (backgroundMusic && !backgroundMusic.paused) {
            currentTrack = 'track1';
            currentTime = backgroundMusic.currentTime;
        } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
            currentTrack = 'track2';
            currentTime = backgroundMusicSecond.currentTime;
        } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
            currentTrack = 'loop';
            currentTime = backgroundMusicLoop.currentTime;
        } else {
            // No track is playing - check which track has progress (was playing before)
            if (backgroundMusic && backgroundMusic.currentTime > 0 && backgroundMusic.currentTime < (backgroundMusic.duration || Infinity)) {
                currentTrack = 'track1';
                currentTime = backgroundMusic.currentTime;
            } else if (backgroundMusicSecond && backgroundMusicSecond.currentTime > 0 && backgroundMusicSecond.currentTime < (backgroundMusicSecond.duration || Infinity)) {
                currentTrack = 'track2';
                currentTime = backgroundMusicSecond.currentTime;
            } else if (backgroundMusicLoop && backgroundMusicLoop.currentTime > 0) {
                currentTrack = 'loop';
                currentTime = backgroundMusicLoop.currentTime;
            }
        }
        
        // Save to localStorage if we found a track
        if (currentTrack !== 'none') {
            localStorage.setItem('globalMusicState', JSON.stringify({
                track: currentTrack,
                time: currentTime,
                timestamp: Date.now()
            }));
            console.log('Music state saved:', currentTrack, 'at', currentTime.toFixed(2), 'seconds');
        }
    }
    
    // Function to ensure only one track plays at a time
    function pauseAllTracks(saveState = true) {
        // Save state before pausing (unless we're resuming)
        if (saveState) {
            saveMusicState();
        }
        
        if (backgroundMusic && !backgroundMusic.paused) {
            backgroundMusic.pause();
        }
        if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
            backgroundMusicSecond.pause();
        }
        if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
            backgroundMusicLoop.pause();
        }
    }
    
    function playTrackOnly(track, skipSaveState = false) {
        pauseAllTracks(!skipSaveState);
        if (track && track.paused) {
            track.play().catch(err => console.log('Failed to start music:', err));
        }
    }
    
    // Music control button functionality - pause/play all tracks (mutually exclusive)
    if (musicControlBtn) {
        musicControlBtn.addEventListener('click', () => {
            const isPlaying = (!backgroundMusic.paused) || 
                             (backgroundMusicSecond && !backgroundMusicSecond.paused) || 
                             (backgroundMusicLoop && !backgroundMusicLoop.paused);
            if (isPlaying) {
                // Muting - save state and pause all tracks
                saveMusicState();
                pauseAllTracks();
                console.log('Background music paused');
            } else {
                // Unmuting - restore from saved state
                const savedState = JSON.parse(localStorage.getItem('globalMusicState') || '{}');
                const trackToResume = savedState.track;
                const timeToResume = savedState.time || 0;
                
                console.log('Attempting to resume:', trackToResume, 'at', timeToResume, 'seconds');
                
                // If we have a saved track, resume from that position
                if (trackToResume === 'track1' && backgroundMusic) {
                    backgroundMusic.currentTime = timeToResume;
                    playTrackOnly(backgroundMusic, true); // Skip saving state when resuming
                    console.log('Background music resumed at', timeToResume.toFixed(2), 'seconds');
                } else if (trackToResume === 'track2' && backgroundMusicSecond) {
                    backgroundMusicSecond.currentTime = timeToResume;
                    playTrackOnly(backgroundMusicSecond, true); // Skip saving state when resuming
                    console.log('Background second music resumed at', timeToResume.toFixed(2), 'seconds');
                } else if (trackToResume === 'loop' && backgroundMusicLoop) {
                    backgroundMusicLoop.currentTime = timeToResume;
                    playTrackOnly(backgroundMusicLoop, true); // Skip saving state when resuming
                    console.log('Background loop music resumed at', timeToResume.toFixed(2), 'seconds');
                } else {
                    // No saved state - determine which track to play based on current progress
                    if (backgroundMusic && backgroundMusic.currentTime > 0 && backgroundMusic.currentTime < (backgroundMusic.duration || Infinity)) {
                        playTrackOnly(backgroundMusic);
                        console.log('Background music started from current position');
                    } else if (backgroundMusicSecond && backgroundMusicSecond.currentTime > 0 && backgroundMusicSecond.currentTime < (backgroundMusicSecond.duration || Infinity)) {
                        playTrackOnly(backgroundMusicSecond);
                        console.log('Background second music started from current position');
                    } else if (backgroundMusicLoop && backgroundMusicLoop.currentTime > 0) {
                        playTrackOnly(backgroundMusicLoop);
                        console.log('Background loop music started from current position');
                    } else if (backgroundMusic) {
                        // All tracks finished - start from beginning
                        backgroundMusic.currentTime = 0;
                        playTrackOnly(backgroundMusic);
                        console.log('Background music started from beginning');
                    }
                }
            }
        });
    }
    
    // Ensure mutual exclusivity when tracks play
    if (backgroundMusic) {
        backgroundMusic.addEventListener('play', () => {
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                backgroundMusicSecond.pause();
            }
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                backgroundMusicLoop.pause();
            }
        });
    }
    
    if (backgroundMusicSecond) {
        backgroundMusicSecond.addEventListener('play', () => {
            if (backgroundMusic && !backgroundMusic.paused) {
                backgroundMusic.pause();
            }
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                backgroundMusicLoop.pause();
            }
        });
    }
    
    if (backgroundMusicLoop) {
        backgroundMusicLoop.addEventListener('play', () => {
            if (backgroundMusic && !backgroundMusic.paused) {
                backgroundMusic.pause();
            }
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                backgroundMusicSecond.pause();
            }
        });
    }
    
    // Add error handling for audio loading
    backgroundMusic.addEventListener('error', (e) => {
        console.error('Audio loading error:', e);
        console.error('Audio error code:', backgroundMusic.error?.code);
        console.error('Audio error message:', backgroundMusic.error?.message);
    });
    
    backgroundMusic.addEventListener('canplaythrough', () => {
        console.log('Audio can play through - ready to start');
    });
    
    backgroundMusic.addEventListener('loadstart', () => {
        console.log('Audio loading started');
    });
    
    backgroundMusic.addEventListener('loadeddata', () => {
        console.log('Audio data loaded');
    });
    
    // Simple autoplay attempt
    console.log('🎵 Attempting to play audio...');
    const playPromise = backgroundMusic.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('🎵 Background music started successfully!');
        }).catch(error => {
            console.log('⚠️ Autoplay prevented by browser:', error);
            console.log('Will start music on user interaction...');
            
            // Add a click event listener to start music on first user interaction
            const startMusicOnClick = (event) => {
                console.log('🎵 User interaction detected, starting music...');
                backgroundMusic.play().then(() => {
                    console.log('🎵 Background music started on user interaction!');
                    // Remove the event listener after first use
                    document.removeEventListener('click', startMusicOnClick);
                    document.removeEventListener('touchstart', startMusicOnClick);
                }).catch(err => {
                    console.error('❌ Failed to start music on interaction:', err);
                });
            };
            
            // Listen for first click or touch to start music
            document.addEventListener('click', startMusicOnClick, { once: true });
            document.addEventListener('touchstart', startMusicOnClick, { once: true });
        });
    } else {
        console.error('❌ Play promise is undefined - browser may not support audio');
    }
    
    // Initial button state
    updateMusicButtonState();
    
    // Initialize music beat synchronization
    initMusicBeatSync();
}

// Initialize music beat synchronization
function initMusicBeatSync() {
    const musicWave = document.getElementById('musicWave');
    if (!musicWave) return;
    
    console.log('🎵 Initializing music beat synchronization...');
    
    // Beat timing - adjust this to match your music's actual beat
    const BEAT_INTERVAL = 3150; // 3.15 seconds in milliseconds
    let beatTimer;
    
    // Function to trigger beat effect
    function triggerBeat() {
        if (musicWave) {
            // Remove any existing animation
            musicWave.classList.remove('active');
            
            // Force reflow to restart animation
            void musicWave.offsetWidth;
            
            // Add active class to trigger animation
            musicWave.classList.add('active');
            
            console.log('🎵 Beat triggered!');
        }
    }
    
    // Start beat synchronization when music starts
    function startBeatSync() {
        console.log('🎵 Starting beat synchronization...');
        
        // Clear any existing timer
        if (beatTimer) {
            clearInterval(beatTimer);
        }
        
        // Set up beat timer
        beatTimer = setInterval(triggerBeat, BEAT_INTERVAL);
        
        // Trigger first beat immediately
        triggerBeat();
    }
    
    // Stop beat synchronization when music stops
    function stopBeatSync() {
        console.log('🎵 Stopping beat synchronization...');
        if (beatTimer) {
            clearInterval(beatTimer);
            beatTimer = null;
        }
    }
    
    // Listen for music play/pause events
    const backgroundMusic = document.getElementById('backgroundMusic');
    if (backgroundMusic) {
        backgroundMusic.addEventListener('play', startBeatSync);
        backgroundMusic.addEventListener('pause', stopBeatSync);
        backgroundMusic.addEventListener('ended', stopBeatSync);
        
        // If music is already playing, start beat sync
        if (!backgroundMusic.paused) {
            startBeatSync();
        }
    }
}

// Initialize effects when page loads
function initEffects() {
    // Create floating particles
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        const particleCount = CONFIG.EFFECTS.PARTICLE_COUNT;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particle.style.opacity = Math.random() * 0.5 + 0.1;
            particlesContainer.appendChild(particle);
        }
    }
    
    // Create matrix rain effect
    function createMatrixRain() {
        const matrixContainer = document.getElementById('matrixRain');
        if (!matrixContainer) return;
        
        const characters = '01█▓▒░';
        const columns = Math.floor(window.innerWidth / CONFIG.EFFECTS.MATRIX_COLUMN_WIDTH);
        
        for (let i = 0; i < columns; i++) {
            const character = document.createElement('div');
            character.className = 'matrix-character';
            character.textContent = characters[Math.floor(Math.random() * characters.length)];
            character.style.left = (i * 20) + 'px';
            character.style.animationDelay = Math.random() * 3 + 's';
            character.style.animationDuration = (Math.random() * 2 + 2) + 's';
            matrixContainer.appendChild(character);
        }
    }
    
    createParticles();
    createMatrixRain();
}

// Smooth scrolling for news carousel - using native browser scrolling
function initSmoothScrolling() {
    // Native scrolling is handled by the browser
    // No custom scroll handlers needed
}

// Add mouse movement effect
function initMouseEffects() {
    document.addEventListener('mousemove', (e) => {
        const particles = document.querySelectorAll('.particle');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        particles.forEach((particle, index) => {
            const speed = (index % 3 + 1) * 0.5;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            particle.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize background music autoplay
    initBackgroundMusic();
    
    // Initialize effects
    initEffects();
    initMouseEffects();
    
    // Initialize navigation functionality
    initNavigation();
    
    // Initialize welcome text cycling
    initWelcomeTextCycling();
    
    // Initialize location display
    initWelcomeLocation();
    
    // Initialize news carousel
    initNewsCarousel();
    
    // Try to start music immediately on page load
    setTimeout(() => {
        const backgroundMusic = document.getElementById('backgroundMusic');
        if (backgroundMusic && backgroundMusic.paused) {
            console.log('🎵 Page loaded, attempting to start music...');
            backgroundMusic.muted = false;
            backgroundMusic.play().then(() => {
                console.log('🎵 Music started on page load!');
            }).catch(err => {
                console.log('⚠️ Page load music start failed:', err);
            });
        }
    }, 50);
    
    // Add scroll-triggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all features for animation
    document.querySelectorAll('.feature').forEach(feature => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(20px)';
        feature.style.transition = 'all 0.6s ease';
        observer.observe(feature);
    });
});

// Utility functions for error handling and logging
const Logger = {
    log: (message, data = null) => {
        if (console && console.log) {
            if (data) {
                console.log(`[Noteworthy News] ${message}`, data);
            } else {
                console.log(`[Noteworthy News] ${message}`);
            }
        }
    },
    
    warn: (message, data = null) => {
        if (console && console.warn) {
            if (data) {
                console.warn(`[Noteworthy News] WARNING: ${message}`, data);
            } else {
                console.warn(`[Noteworthy News] WARNING: ${message}`);
            }
        }
    },
    
    error: (message, error = null) => {
        if (console && console.error) {
            if (error) {
                console.error(`[Noteworthy News] ERROR: ${message}`, error);
            } else {
                console.error(`[Noteworthy News] ERROR: ${message}`);
            }
        }
    }
};

// Error boundary function
function handleError(error, context = 'Unknown') {
    Logger.error(`Error in ${context}`, error);
    
    // Try to recover gracefully
    try {
        // Hide any loading states
        const loadingElements = document.querySelectorAll('.loading, [data-loading="true"]');
        loadingElements.forEach(el => {
            el.style.display = 'none';
        });
        
        // Show user-friendly error message
        showErrorMessage('Something went wrong. Please refresh the page and try again.');
    } catch (recoveryError) {
        Logger.error('Error during recovery attempt', recoveryError);
    }
}

// Show user-friendly error message
function showErrorMessage(message) {
    try {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(el => el.remove());
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            font-family: 'Inter', sans-serif;
        `;
        
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    } catch (error) {
        Logger.error('Error showing error message', error);
    }
}

// Newsletter Subscription Handler
function initNewsletterSubscription() {
    const newsletterBtn = document.querySelector('.newsletter-btn');
    const newsletterInput = document.querySelector('.newsletter-input');
    
    if (!newsletterBtn || !newsletterInput) {
        return; // Newsletter form not found on this page
    }

    // Handle button click
    newsletterBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleNewsletterSubmit();
    });

    // Handle Enter key press
    newsletterInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await handleNewsletterSubmit();
        }
    });

    async function handleNewsletterSubmit() {
        const email = newsletterInput.value.trim();
        
        // Validate email
        if (!email) {
            showNewsletterMessage('Please enter your email address', 'error');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNewsletterMessage('Please enter a valid email address', 'error');
            return;
        }

        // Disable button and show loading state
        newsletterBtn.disabled = true;
        const originalText = newsletterBtn.textContent;
        newsletterBtn.textContent = 'Subscribing...';
        
        // Add timeout to prevent indefinite loading
        let timeoutId = setTimeout(() => {
            if (newsletterBtn.disabled) {
                showNewsletterMessage('Request is taking longer than expected. Please check your connection and try again.', 'error');
                newsletterBtn.disabled = false;
                newsletterBtn.textContent = originalText;
            }
        }, 30000); // 30 second timeout

        try {
            // Check if running from file:// protocol (not supported)
            if (window.location.protocol === 'file:') {
                throw new Error('Email functionality requires a web server. Please run "netlify dev" or deploy to Netlify to test the email feature.');
            }
            
            // Determine API endpoint based on deployment platform
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            // Try Netlify first, then Vercel as fallback
            const endpoints = isLocalhost 
                ? [
                    'http://localhost:8888/.netlify/functions/send-email',  // Netlify dev
                    'http://localhost:3000/api/send-email'  // Vercel dev
                  ]
                : [
                    '/.netlify/functions/send-email',  // Netlify production
                    '/api/send-email'  // Vercel production
                  ];

            let response;
            let data;
            let lastError;

            // Try each endpoint until one works
            for (const apiEndpoint of endpoints) {
                try {
                    console.log(`Attempting to connect to: ${apiEndpoint}`);
                    console.log(`Current page URL: ${window.location.href}`);
                    console.log(`Current protocol: ${window.location.protocol}`);
                    
                    response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email }),
                        signal: AbortSignal.timeout(25000), // 25 second timeout
                    });

                    console.log(`Response received: ${response.status} ${response.statusText}`);

                    // Only try to parse JSON if we got a response
                    if (response) {
                        // Try to parse JSON, but handle non-JSON error responses
                        try {
                            const responseText = await response.text();
                            console.log('Response text:', responseText);
                            
                            // Try to parse as JSON
                            try {
                                data = JSON.parse(responseText);
                                console.log('Response data:', data);
                            } catch (jsonError) {
                                // If it's not JSON, create an error object from the text
                                console.warn('Response is not JSON, treating as error');
                                data = {
                                    error: responseText.substring(0, 200) || 'Server error (non-JSON response)'
                                };
                            }

                            if (response.ok) {
                                break; // Success! Exit the loop
                            } else {
                                lastError = data.error || `Server error: ${response.status} ${response.statusText}`;
                                // Continue to next endpoint
                            }
                        } catch (parseError) {
                            console.error('Error parsing response:', parseError);
                            lastError = `Server error: ${response.status} ${response.statusText}`;
                            // Continue to next endpoint
                        }
                    }
                } catch (err) {
                    // Only log detailed errors if it's not a common network error
                    if (err.name !== 'TypeError' || !err.message.includes('Failed to fetch')) {
                        console.error(`Failed to connect to ${apiEndpoint}:`, err);
                    }
                    lastError = err.message || 'Network error - could not connect to server';
                    // Continue to next endpoint
                    response = null; // Make sure response is null on error
                }
            }

            // If we got here and response is not ok, all endpoints failed
            if (!response || !response.ok) {
                // Check if the error message indicates "already subscribed" - treat as success
                if (data && data.message && (
                    data.message.toLowerCase().includes('already subscribed') ||
                    data.message.toLowerCase().includes("you're already subscribed") ||
                    data.message.toLowerCase().includes('already in') ||
                    data.alreadySubscribed === true
                )) {
                    // User is already subscribed - this is actually success!
                    clearTimeout(timeoutId);
                    showNewsletterMessage(data.message || 'You are already subscribed!', 'success');
                    newsletterInput.value = '';
                    return; // Exit early, treat as success
                }
                
                // Show detailed error message to help debug
                let errorMessage = 'Failed to subscribe';
                
                if (data && data.error) {
                    errorMessage = data.error;
                    // Don't show domain verification warnings if using onboarding@resend.dev (it's fine)
                    if (data.error.includes('domain') && data.error.includes('onboarding@resend.dev')) {
                        // This is just a warning - emails still work with onboarding@resend.dev
                        // Don't show error, just log it
                        console.log('Domain verification note (safe to ignore for development):', data.error);
                        // Treat as success since emails are working
                        showNewsletterMessage('Successfully subscribed! Check your email for a welcome message.', 'success');
                        newsletterInput.value = '';
                        return; // Exit early, don't throw error
                    }
                    // Show helpful hints for common errors
                    if (data.error.includes('API key')) {
                        errorMessage += ' - Please check RESEND_API_KEY in Netlify environment variables';
                    } else if (data.error.includes('domain') && !data.error.includes('onboarding@resend.dev')) {
                        errorMessage += ' - Please verify your domain in Resend or use onboarding@resend.dev';
                    } else if (data.details) {
                        console.error('Detailed error:', data.details);
                    }
                } else {
                    errorMessage = lastError || 'Please check your deployment and try again';
                }
                
                throw new Error(errorMessage);
            }
            
            // Check if response indicates "already subscribed" even with 200 status
            if (data && (data.alreadySubscribed === true || 
                (data.message && (
                    data.message.toLowerCase().includes('already subscribed') ||
                    data.message.toLowerCase().includes("you're already subscribed")
                )))) {
                clearTimeout(timeoutId);
                showNewsletterMessage(data.message || 'You are already subscribed!', 'success');
                newsletterInput.value = '';
                return; // Exit early, treat as success
            }

            // Success!
            clearTimeout(timeoutId);
            // Store email in localStorage for user tracking across sessions
            try {
                localStorage.setItem('newsletterEmail', email);
                localStorage.setItem('userEmail', email);
                if (data && data.firstName) {
                    localStorage.setItem('userName', data.firstName);
                }
            } catch (e) {
                console.warn('Could not save email to localStorage:', e);
            }
            
            // Check if they're already subscribed
            if (data.alreadySubscribed) {
                // Use personalized message - prioritize data.message, then use displayName/fullName/firstName
                let message;
                if (data.message) {
                    message = data.message;
                } else if (data.displayName) {
                    message = `${data.displayName}, don't worry you're already subscribed!`;
                } else if (data.fullName) {
                    message = `${data.fullName}, don't worry you're already subscribed!`;
                } else if (data.firstName) {
                    message = `${data.firstName}, don't worry you're already subscribed!`;
                } else {
                    message = 'You are already subscribed to our newsletter!';
                }
                console.log('[Newsletter] Already subscribed message:', message, 'displayName:', data.displayName, 'fullName:', data.fullName, 'firstName:', data.firstName);
                showNewsletterMessage(message, 'success');
            } else {
                // Use personalized message - prioritize data.message, then use displayName/fullName/firstName
                let message;
                if (data.message) {
                    message = data.message;
                } else if (data.displayName) {
                    message = `Thanks ${data.displayName}! Successfully subscribed! Check your email for a welcome message.`;
                } else if (data.fullName) {
                    message = `Thanks ${data.fullName}! Successfully subscribed! Check your email for a welcome message.`;
                } else if (data.firstName) {
                    message = `Thanks ${data.firstName}! Successfully subscribed! Check your email for a welcome message.`;
                } else {
                    message = 'Successfully subscribed! Check your email for a welcome message.';
                }
                console.log('[Newsletter] Success message:', message, 'displayName:', data.displayName, 'fullName:', data.fullName, 'firstName:', data.firstName, 'data.message:', data.message);
                showNewsletterMessage(message, 'success');
                
                // Play subscription sound effect
                try {
                    console.log('[Newsletter] Attempting to play subscription sound...');
                    if (typeof playSubscriptionSound === 'function') {
                        playSubscriptionSound();
                    } else {
                        console.error('[Newsletter] playSubscriptionSound function not found!');
                    }
                } catch (err) {
                    console.error('[Newsletter] Error calling playSubscriptionSound:', err);
                }
            }
            newsletterInput.value = '';
            
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Newsletter subscription error:', error);
            // Show the actual error message to help with debugging
            let errorMsg = error.message || 'Something went wrong. Please try again later.';
            
            // Handle timeout errors
            if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
                errorMsg = 'Request timed out. The server may be slow or unresponsive. Please try again.';
            }
            // Handle abort errors (from fetch timeout)
            else if (error.name === 'AbortError') {
                errorMsg = 'Request took too long and was cancelled. Please check your connection and try again.';
            }
            // Add helpful hints for common issues
            else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network error')) {
                if (window.location.protocol === 'file:') {
                    errorMsg = 'Please open http://localhost:8888 in your browser (not the HTML file directly). Run "netlify dev" to start the server.';
                } else {
                    errorMsg = 'Cannot connect to server. Make sure "netlify dev" is running on port 8888.';
                }
            }
            
            showNewsletterMessage(errorMsg, 'error');
        } finally {
            // Re-enable button
            clearTimeout(timeoutId);
            newsletterBtn.disabled = false;
            newsletterBtn.textContent = originalText;
        }
    }

    // Function to play subscription sound and resume background music
    // Define this function early so it's available when needed
    const playSubscriptionSound = function() {
        const backgroundMusic = document.getElementById('backgroundMusic');
        const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
        const backgroundMusicThird = document.getElementById('backgroundMusicThird');
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        
        // Save current music state
        let wasPlaying = false;
        let currentTrack = null;
        let currentTime = 0;
        
        // Use music system's pause function if available, otherwise pause manually
        if (typeof window.pauseAllMusicTracks === 'function') {
            // Use the music system's pause function
            const state = window.pauseAllMusicTracks();
            wasPlaying = state.wasPlaying;
            currentTrack = state.currentTrack;
            currentTime = state.currentTime;
        } else {
            // Fallback: manually pause all tracks and find which one was playing
            if (backgroundMusic && !backgroundMusic.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusic;
                currentTime = backgroundMusic.currentTime;
                backgroundMusic.pause();
            } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicSecond;
                currentTime = backgroundMusicSecond.currentTime;
                backgroundMusicSecond.pause();
            } else if (backgroundMusicThird && !backgroundMusicThird.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicThird;
                currentTime = backgroundMusicThird.currentTime;
                backgroundMusicThird.pause();
            } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicLoop;
                currentTime = backgroundMusicLoop.currentTime;
                backgroundMusicLoop.pause();
            }
            
            // Ensure ALL tracks are paused (in case multiple were playing)
            if (backgroundMusic && !backgroundMusic.paused) backgroundMusic.pause();
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) backgroundMusicSecond.pause();
            if (backgroundMusicThird && !backgroundMusicThird.paused) backgroundMusicThird.pause();
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) backgroundMusicLoop.pause();
        }
        
        // Create confetti container if it doesn't exist
        let confettiContainer = document.getElementById('subscriptionConfetti');
        if (!confettiContainer) {
            confettiContainer = document.createElement('div');
            confettiContainer.id = 'subscriptionConfetti';
            confettiContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
            `;
            document.body.appendChild(confettiContainer);
        }
        
        // Confetti colors
        const colors = ['#ffe66d', '#4ecdc4', '#ff6b6b', '#95e1d3', '#aa96da', '#fcbad3', '#f38181', '#a8e6cf', '#2ecc71', '#3498db'];
        
        // Function to create confetti pieces
        function createConfettiPiece() {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 8 + 6}px;
                height: ${Math.random() * 8 + 6}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                opacity: 1;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0%'};
                box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
            `;
            
            // Random animation duration and delay
            const duration = Math.random() * 2 + 2;
            const delay = Math.random() * 0.5;
            const horizontalDrift = (Math.random() - 0.5) * 200;
            
            confetti.style.animation = `subscriptionConfettiFall ${duration}s linear ${delay}s forwards`;
            confetti.style.setProperty('--drift', horizontalDrift + 'px');
            
            confettiContainer.appendChild(confetti);
            
            // Remove after animation
            setTimeout(function() {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, (duration + delay) * 1000);
        }
        
        // Add CSS animation if not already added
        if (!document.getElementById('subscriptionConfettiStyle')) {
            const style = document.createElement('style');
            style.id = 'subscriptionConfettiStyle';
            style.textContent = `
                @keyframes subscriptionConfettiFall {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) translateX(var(--drift, 0px)) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Start creating confetti continuously
        console.log('[Subscription Sound] Starting confetti celebration...');
        let confettiInterval = setInterval(function() {
            // Create 15-25 pieces every 200ms for continuous celebration
            const pieces = Math.floor(Math.random() * 11) + 15;
            for (let i = 0; i < pieces; i++) {
                createConfettiPiece();
            }
        }, 200);
        
        // Stop confetti after 20 seconds
        setTimeout(function() {
            console.log('[Subscription Sound] Stopping confetti after 20 seconds');
            clearInterval(confettiInterval);
            // Clean up confetti container after a delay to let remaining pieces fall
            setTimeout(function() {
                if (confettiContainer && confettiContainer.parentNode) {
                    confettiContainer.innerHTML = '';
                }
            }, 3000);
        }, 20000);
        
        // Create and play subscription sound
        console.log('[Subscription Sound] Creating audio element...');
        const subscriptionSound = new Audio('Subscribedv1.mp3');
        subscriptionSound.volume = 0.7;
        
        // Store globally so it can be stopped by the music system
        window.subscriptionSound = subscriptionSound;
        
        subscriptionSound.addEventListener('loadeddata', function() {
            console.log('[Subscription Sound] Audio loaded and ready to play');
        });
        
        subscriptionSound.addEventListener('canplay', function() {
            console.log('[Subscription Sound] Audio can play');
        });
        
        subscriptionSound.addEventListener('ended', function() {
            console.log('[Subscription Sound] Audio finished playing');
            // Stop confetti
            clearInterval(confettiInterval);
            // Clean up confetti container after a delay
            setTimeout(function() {
                if (confettiContainer && confettiContainer.parentNode) {
                    confettiContainer.innerHTML = '';
                }
            }, 3000);
            
            // Resume background music when subscription sound finishes
            if (wasPlaying && currentTrack) {
                currentTrack.currentTime = currentTime;
                currentTrack.play().catch(function(err) {
                    console.log('Could not resume music:', err);
                });
            }
            // Clean up global reference
            if (window.subscriptionSound === subscriptionSound) {
                window.subscriptionSound = null;
            }
            subscriptionSound.remove(); // Clean up
        });
        
        subscriptionSound.addEventListener('error', function(err) {
            console.error('Error playing subscription sound:', err);
            // Stop confetti on error
            clearInterval(confettiInterval);
            if (confettiContainer && confettiContainer.parentNode) {
                confettiContainer.innerHTML = '';
            }
            // Resume music even if subscription sound fails
            if (wasPlaying && currentTrack) {
                currentTrack.currentTime = currentTime;
                currentTrack.play().catch(function(e) {
                    console.log('Could not resume music:', e);
                });
            }
            // Clean up global reference
            if (window.subscriptionSound === subscriptionSound) {
                window.subscriptionSound = null;
            }
        });
        
        // Play the subscription sound
        console.log('[Subscription Sound] Attempting to play...');
        subscriptionSound.play().then(function() {
            console.log('[Subscription Sound] Successfully started playing!');
        }).catch(function(err) {
            console.error('[Subscription Sound] Could not play:', err);
            // Stop confetti if sound can't play
            clearInterval(confettiInterval);
            if (confettiContainer && confettiContainer.parentNode) {
                confettiContainer.innerHTML = '';
            }
            // Resume music if subscription sound can't play
            if (wasPlaying && currentTrack) {
                currentTrack.currentTime = currentTime;
                currentTrack.play().catch(function(e) {
                    console.log('Could not resume music:', e);
                });
            }
        });
    };

    function showNewsletterMessage(message, type) {
        // Remove existing messages
        const existingMsg = document.querySelector('.newsletter-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        // Create message element
        const msgDiv = document.createElement('div');
        msgDiv.className = 'newsletter-message';
        msgDiv.textContent = message;
        
        const colors = {
            success: '#2ecc71',
            error: '#e74c3c'
        };
        
        msgDiv.style.cssText = `
            margin-top: 10px;
            padding: 10px 15px;
            border-radius: 5px;
            background-color: ${colors[type] || colors.success};
            color: white;
            font-size: 14px;
            text-align: center;
            animation: slideInRight 0.3s ease-out;
        `;

        // Insert after newsletter form
        const newsletterSignup = document.querySelector('.newsletter-signup');
        if (newsletterSignup) {
            newsletterSignup.parentNode.insertBefore(msgDiv, newsletterSignup.nextSibling);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (msgDiv.parentNode) {
                msgDiv.style.opacity = '0';
                msgDiv.style.transition = 'opacity 0.3s';
                setTimeout(() => msgDiv.remove(), 300);
            }
        }, 5000);
    }
}

// Interactive Stars - Make stars move when mouse hovers near them
(function initInteractiveStars() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInteractiveStars);
        return;
    }

    // Configuration
    const INTERACTION_DISTANCE = 100; // pixels - how close mouse needs to be to trigger movement
    const REPULSION_FORCE = 40; // pixels - how far stars move away
    const LARGE_STAR_DISTANCE = 120; // pixels - larger distance for bigger stars
    const LARGE_STAR_REPULSION = 60; // pixels - larger movement for bigger stars

    // Store original positions
    const starOriginalPositions = new Map();
    
    // Get all stars (both small and large)
    function getAllStars() {
        const smallStars = document.querySelectorAll('.western-stars .western-star');
        const largeStars = document.querySelectorAll('.western-decorations .western-star');
        return { smallStars, largeStars };
    }

    // Get star's current position
    function getStarPosition(star) {
        const rect = star.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }

    // Store original positions
    function storeOriginalPositions() {
        const { smallStars, largeStars } = getAllStars();
        
        // Store small stars positions
        smallStars.forEach((star, index) => {
            const computedStyle = window.getComputedStyle(star);
            starOriginalPositions.set(star, {
                left: computedStyle.left,
                top: computedStyle.top,
                originalLeft: parseFloat(computedStyle.left) || 0,
                originalTop: parseFloat(computedStyle.top) || 0
            });
        });

        // Store large stars positions
        largeStars.forEach((star, index) => {
            const computedStyle = window.getComputedStyle(star);
            const left = computedStyle.left !== 'auto' ? computedStyle.left : 
                        computedStyle.right !== 'auto' ? `calc(100% - ${computedStyle.right})` : '0';
            const top = computedStyle.top;
            starOriginalPositions.set(star, {
                left: left,
                top: top,
                originalLeft: left.includes('%') ? 
                    (parseFloat(left) / 100) * window.innerWidth : 
                    parseFloat(left) || 0,
                originalTop: top.includes('%') ? 
                    (parseFloat(top) / 100) * window.innerHeight : 
                    parseFloat(top) || 0
            });
        });
    }

    // Reset all stars to original positions
    function resetAllStars() {
        starOriginalPositions.forEach((position, star) => {
            star.style.transform = 'translate(0, 0)';
            star.style.opacity = '';
        });
    }

    // Calculate distance between two points
    function getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    // Handle mouse movement
    function handleMouseMove(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const { smallStars, largeStars } = getAllStars();

        // Process small stars
        smallStars.forEach(star => {
            const starPos = getStarPosition(star);
            const distance = getDistance(mouseX, mouseY, starPos.x, starPos.y);
            
            if (distance < INTERACTION_DISTANCE) {
                const angle = Math.atan2(starPos.y - mouseY, starPos.x - mouseX);
                const force = (1 - distance / INTERACTION_DISTANCE) * REPULSION_FORCE;
                const deltaX = Math.cos(angle) * force;
                const deltaY = Math.sin(angle) * force;
                
                star.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                star.style.opacity = '0.8';
            } else {
                star.style.transform = 'translate(0, 0)';
                star.style.opacity = '';
            }
        });

        // Process large stars
        largeStars.forEach(star => {
            const starPos = getStarPosition(star);
            const distance = getDistance(mouseX, mouseY, starPos.x, starPos.y);
            
            if (distance < LARGE_STAR_DISTANCE) {
                const angle = Math.atan2(starPos.y - mouseY, starPos.x - mouseX);
                const force = (1 - distance / LARGE_STAR_DISTANCE) * LARGE_STAR_REPULSION;
                const deltaX = Math.cos(angle) * force;
                const deltaY = Math.sin(angle) * force;
                
                star.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.2)`;
                star.style.opacity = '1';
            } else {
                star.style.transform = 'translate(0, 0) scale(1)';
                star.style.opacity = '';
            }
        });
    }

    // Initialize when page loads
    function init() {
        // Store original positions after a short delay to ensure styles are computed
        setTimeout(() => {
            storeOriginalPositions();
            
            // Add mouse move listener
            document.addEventListener('mousemove', handleMouseMove);
            
            // Reset stars when mouse leaves the window
            document.addEventListener('mouseleave', resetAllStars);
            
            // Reset stars when mouse leaves hero section
            const heroSection = document.querySelector('.hero-section');
            if (heroSection) {
                heroSection.addEventListener('mouseleave', resetAllStars);
            }
        }, 100);
    }

    // Initialize
    init();

    // Re-initialize on window resize to recalculate positions
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            storeOriginalPositions();
            resetAllStars();
        }, 250);
    });
})();

// Interactive Image Tilt - Make images slightly tilt away from mouse (very subtle)
(function initInteractiveImageTilt() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInteractiveImageTilt);
        return;
    }

    // Configuration - highly interactive movement
    const DETECTION_SCALE = 0.7; // Detection box is 70% of image size (smaller than actual)
    const MAX_TILT_DEGREES = 15; // Maximum tilt in degrees (very noticeable)
    const MAX_SCALE = 1.05; // Slight scale up on hover for more interactivity
    const INTERACTION_DISTANCE_MULTIPLIER = 2.0; // Detection distance multiplier (much wider detection)

    // Get the target images
    function getTargetImages() {
        const images = document.querySelectorAll('.welcome-bg-img, .hero-logo-image');
        return Array.from(images).filter(img => {
            const src = img.src || img.getAttribute('src') || '';
            // CHRISTMAS TEMP: Added SantalogoEdited.png and santabodynwbest.png check
            return src.includes('7680cb96-729f-4344-b08a-4f9a2aa314f8') || 
                   src.includes('SantalogoEdited') ||
                   src.includes('santabodynwbest') ||
                   src.includes('e2e66fe2-12c0-428b-ba44-0ff07b895551');
        });
    }

    // Get image detection area (smaller than actual image)
    function getImageDetectionArea(img) {
        const rect = img.getBoundingClientRect();
        const detectionWidth = rect.width * DETECTION_SCALE;
        const detectionHeight = rect.height * DETECTION_SCALE;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        return {
            centerX: centerX,
            centerY: centerY,
            width: detectionWidth,
            height: detectionHeight,
            maxDistance: Math.max(detectionWidth, detectionHeight) * INTERACTION_DISTANCE_MULTIPLIER
        };
    }

    // Calculate tilt angle based on mouse position
    function calculateTilt(mouseX, mouseY, imgArea) {
        // Calculate distance from mouse to image center
        const dx = mouseX - imgArea.centerX;
        const dy = mouseY - imgArea.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate tilt intensity based on distance (closer = more tilt)
        // Use extended detection distance for smoother, more responsive interaction
        const extendedDetectionDistance = imgArea.maxDistance * 2.0;
        
        // If mouse is too far away, no tilt
        if (distance > extendedDetectionDistance) {
            return { rotationX: 0, rotationY: 0, rotation: 0, scale: 1 };
        }
        
        // Calculate tilt intensity - stronger when closer, fades out smoothly
        const normalizedDistance = Math.min(distance / extendedDetectionDistance, 1);
        // Use inverse easing for stronger response when close
        const intensity = 1 - normalizedDistance;
        const easeOut = intensity * intensity; // Quadratic easing for snappier feel
        const tiltIntensity = easeOut * MAX_TILT_DEGREES;
        const scaleIntensity = 1 + (easeOut * (MAX_SCALE - 1)); // Scale up when close
        
        // Calculate tilt direction - tilt away from mouse
        // Normalize the direction vector
        const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
        const normalizedDx = dx / magnitude;
        const normalizedDy = dy / magnitude;
        
        // Strong tilt perpendicular to mouse direction (tilt away from mouse)
        const rotationY = -normalizedDx * tiltIntensity; // Horizontal tilt (rotateY) - full intensity
        const rotationX = normalizedDy * tiltIntensity; // Vertical tilt (rotateX) - full intensity
        
        return {
            rotationX: rotationX,
            rotationY: rotationY,
            rotation: 0,
            scale: scaleIntensity // Add scale for more interactivity
        };
    }

    // Handle mouse movement
    function handleMouseMove(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const images = getTargetImages();
        
        images.forEach(img => {
            const detectionArea = getImageDetectionArea(img);
            const tilt = calculateTilt(mouseX, mouseY, detectionArea);
            
            // Apply interactive 3D tilt with scale using transform
            // Always apply transform for smooth interaction
            const scale = tilt.scale || 1;
            img.style.transform = `perspective(1000px) rotateX(${tilt.rotationX.toFixed(2)}deg) rotateY(${tilt.rotationY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
            
            // Use very fast transition for snappy, responsive feel
            if (Math.abs(tilt.rotationX) > 2 || Math.abs(tilt.rotationY) > 2 || (tilt.scale && tilt.scale > 1.02)) {
                img.style.transition = 'transform 0.1s ease-out'; // Very snappy when close
            } else {
                img.style.transition = 'transform 0.2s ease-out'; // Still fast for smoothness
            }
        });
    }

    // Reset all images to normal position
    function resetImages() {
        const images = getTargetImages();
        images.forEach(img => {
            img.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            img.style.transition = 'transform 0.3s ease-out';
        });
    }

    // Initialize when page loads
    function init() {
        // Wait a bit for images to load and styles to be computed
        setTimeout(() => {
            const images = getTargetImages();
            if (images.length === 0) {
                // Images not found yet, try again
                setTimeout(init, 100);
                return;
            }
            
            console.log(`Interactive image tilt initialized for ${images.length} image(s)`);
            
            // Add transition styles and prepare images
            images.forEach(img => {
                img.style.willChange = 'transform';
                img.style.transformOrigin = 'center center';
                img.style.backfaceVisibility = 'hidden'; // Better 3D performance
                img.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)'; // Initialize
            });
            
            // Add mouse move listener with throttling for better performance
            let lastTime = 0;
            const throttleDelay = 16; // ~60fps
            function throttledHandleMouseMove(e) {
                const now = Date.now();
                if (now - lastTime >= throttleDelay) {
                    handleMouseMove(e);
                    lastTime = now;
                }
            }
            
            document.addEventListener('mousemove', throttledHandleMouseMove);
            
            // Reset images when mouse leaves the window
            document.addEventListener('mouseleave', resetImages);
        }, 200);
    }

    // Initialize
    init();
})();

// Country Spotlight Functionality
(function initCountrySpotlight() {
    // List of countries with their flag emojis
    const countries = [
        { name: 'Japan', flag: '🇯🇵' },
        { name: 'Brazil', flag: '🇧🇷' },
        { name: 'India', flag: '🇮🇳' },
        { name: 'Germany', flag: '🇩🇪' },
        { name: 'France', flag: '🇫🇷' },
        { name: 'Italy', flag: '🇮🇹' },
        { name: 'Spain', flag: '🇪🇸' },
        { name: 'United Kingdom', flag: '🇬🇧' },
        { name: 'Canada', flag: '🇨🇦' },
        { name: 'Australia', flag: '🇦🇺' },
        { name: 'Mexico', flag: '🇲🇽' },
        { name: 'South Korea', flag: '🇰🇷' },
        { name: 'China', flag: '🇨🇳' },
        // { name: 'Russia', flag: '🇷🇺' }, // Temporarily removed
        { name: 'Turkey', flag: '🇹🇷' },
        { name: 'Argentina', flag: '🇦🇷' },
        { name: 'South Africa', flag: '🇿🇦' },
        { name: 'Egypt', flag: '🇪🇬' },
        { name: 'Nigeria', flag: '🇳🇬' },
        { name: 'Thailand', flag: '🇹🇭' },
        { name: 'Indonesia', flag: '🇮🇩' },
        { name: 'Philippines', flag: '🇵🇭' },
        { name: 'Vietnam', flag: '🇻🇳' },
        { name: 'Poland', flag: '🇵🇱' },
        { name: 'Netherlands', flag: '🇳🇱' },
        { name: 'Sweden', flag: '🇸🇪' },
        { name: 'Norway', flag: '🇳🇴' },
        { name: 'Denmark', flag: '🇩🇰' },
        { name: 'Finland', flag: '🇫🇮' },
        { name: 'Greece', flag: '🇬🇷' },
        { name: 'Portugal', flag: '🇵🇹' },
        { name: 'Ireland', flag: '🇮🇪' },
        { name: 'New Zealand', flag: '🇳🇿' },
        { name: 'Chile', flag: '🇨🇱' },
        { name: 'Colombia', flag: '🇨🇴' },
        { name: 'Peru', flag: '🇵🇪' },
        { name: 'Morocco', flag: '🇲🇦' },
        { name: 'Kenya', flag: '🇰🇪' },
        { name: 'Israel', flag: '🇮🇱' },
        { name: 'Saudi Arabia', flag: '🇸🇦' },
        { name: 'United Arab Emirates', flag: '🇦🇪' },
        { name: 'Singapore', flag: '🇸🇬' },
        { name: 'Malaysia', flag: '🇲🇾' },
        { name: 'Bangladesh', flag: '🇧🇩' },
        { name: 'Pakistan', flag: '🇵🇰' },
        { name: 'Ukraine', flag: '🇺🇦' },
        { name: 'Romania', flag: '🇷🇴' },
        { name: 'Czech Republic', flag: '🇨🇿' },
        { name: 'Hungary', flag: '🇭🇺' },
        { name: 'Belgium', flag: '🇧🇪' },
        { name: 'Switzerland', flag: '🇨🇭' }
    ];
    
    const spotlightContainer = document.getElementById('spotlight-container');
    const spotlightLoading = document.getElementById('spotlight-loading');
    const spotlightContent = document.getElementById('spotlight-content');
    const spotlightError = document.getElementById('spotlight-error');
    const countryFlag = document.getElementById('country-flag');
    const countryName = document.getElementById('country-name');
    const aiResponse = document.getElementById('ai-response');
    const aiThinking = document.getElementById('ai-thinking');
    const refreshBtn = document.getElementById('refresh-spotlight-btn');
    const retryBtn = document.getElementById('retry-spotlight-btn');
    const remainingDisplay = document.getElementById('spotlight-remaining');
    
    if (!spotlightContainer) return; // Exit if section doesn't exist
    
    let currentCountry = null;
    let spotlightMusic = null;
    let savedBackgroundMusicState = null;
    let savedSpotlightMusicState = null; // Save spotlight music position
    let isSpotlightVisible = false;
    let isRestoring = false; // Flag to prevent multiple restore attempts
    
    // Fade in/out utility functions
    const FADE_DURATION = 1500; // milliseconds for fade transition - increased for smoother transitions
    
    // Easing function for smooth fade curves (ease-in-out)
    function easeInOutCubic(t) {
        // Clamp t to valid range
        t = Math.max(0, Math.min(1, t));
        if (t < 0.5) {
            return 4 * t * t * t;
        } else {
            return 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
    }
    
    // Track active fade timers to prevent overlapping fades
    const activeFadeTimers = new WeakMap();
    
    function fadeOutAudio(audio, onComplete) {
        if (!audio || audio.paused) {
            if (onComplete) onComplete();
            return;
        }
        
        // Cancel any existing fade on this audio element
        const existingTimer = activeFadeTimers.get(audio);
        if (existingTimer) {
            clearInterval(existingTimer);
            activeFadeTimers.delete(audio);
        }
        
        const startVolume = audio.volume;
        const startTime = Date.now();
        const fadeInterval = 16; // ~60fps
        
        const fadeTimer = setInterval(() => {
            // Check if audio still exists and is still playing
            if (!audio || audio.paused) {
                clearInterval(fadeTimer);
                activeFadeTimers.delete(audio);
                if (onComplete) onComplete();
                return;
            }
            
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / FADE_DURATION, 1);
            // Apply easing function for smoother curve
            const easedProgress = easeInOutCubic(progress);
            const newVolume = startVolume * (1 - easedProgress);
            
            try {
                audio.volume = Math.max(0, newVolume);
            } catch (error) {
                console.error('Error setting volume during fade out:', error);
                clearInterval(fadeTimer);
                activeFadeTimers.delete(audio);
                if (onComplete) onComplete();
                return;
            }
            
            if (progress >= 1) {
                clearInterval(fadeTimer);
                activeFadeTimers.delete(audio);
                try {
                    audio.pause();
                    audio.volume = startVolume; // Restore original volume
                } catch (error) {
                    console.error('Error pausing audio after fade out:', error);
                }
                if (onComplete) onComplete();
            }
        }, fadeInterval);
        
        // Store the timer so we can cancel it if needed
        activeFadeTimers.set(audio, fadeTimer);
    }
    
    function fadeInAudio(audio, targetVolume, onComplete) {
        if (!audio) {
            if (onComplete) onComplete();
            return;
        }
        
        // Cancel any existing fade on this audio element
        const existingTimer = activeFadeTimers.get(audio);
        if (existingTimer) {
            clearInterval(existingTimer);
            activeFadeTimers.delete(audio);
        }
        
        const startVolume = 0;
        const finalVolume = targetVolume || 0.5;
        const startTime = Date.now();
        const fadeInterval = 16; // ~60fps
        
        // Set initial volume
        try {
            audio.volume = 0;
        } catch (error) {
            console.error('Error setting initial volume:', error);
            if (onComplete) onComplete();
            return;
        }
        
        // Start playing if not already
        const playPromise = audio.paused ? audio.play() : Promise.resolve();
        
        playPromise.catch(err => {
            console.log('Could not play audio during fade in:', err);
            // Fallback: try to set volume directly and complete
            try {
                audio.volume = finalVolume;
            } catch (e) {
                console.error('Error setting audio volume:', e);
            }
            if (onComplete) onComplete();
            return;
        });
        
        // Start fade timer regardless of play state
        const fadeTimer = setInterval(() => {
            // Check if audio still exists
            if (!audio) {
                clearInterval(fadeTimer);
                activeFadeTimers.delete(audio);
                if (onComplete) onComplete();
                return;
            }
            
            try {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / FADE_DURATION, 1);
                // Apply easing function for smoother curve
                const easedProgress = easeInOutCubic(progress);
                const newVolume = startVolume + (finalVolume - startVolume) * easedProgress;
                
                // Ensure volume is valid
                if (!isNaN(newVolume) && isFinite(newVolume) && newVolume >= 0 && newVolume <= 1) {
                    audio.volume = Math.max(0, Math.min(finalVolume, newVolume));
                }
                
                if (progress >= 1) {
                    clearInterval(fadeTimer);
                    activeFadeTimers.delete(audio);
                    try {
                        audio.volume = finalVolume;
                    } catch (error) {
                        console.error('Error setting final volume:', error);
                    }
                    if (onComplete) onComplete();
                }
            } catch (error) {
                // If fade fails, just set volume directly
                console.error('Error during fade in:', error);
                clearInterval(fadeTimer);
                activeFadeTimers.delete(audio);
                try {
                    audio.volume = finalVolume;
                } catch (e) {
                    console.error('Error setting final volume:', e);
                }
                if (onComplete) onComplete();
            }
        }, fadeInterval);
        
        // Store the timer so we can cancel it if needed
        activeFadeTimers.set(audio, fadeTimer);
    }
    let isGenerating = false; // Flag to prevent multiple simultaneous generations
    let cooldownUntil = 0; // Timestamp when cooldown expires
    
    // Storage keys
    const STORAGE_KEY = 'spotlight_data';
    const RATE_LIMIT_KEY = 'spotlight_rate_limit';
    const RATE_LIMIT_COUNT = 3; // 3 spotlights per day
    const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Fallback imagery for failed AI generations
    const FALLBACK_IMAGES = [
        '/f41de8d1-cc13-41b2-815c-64e51598326a.png',
        '/f64a69de-e4a1-4ac1-9626-c9ada52df776.png',
        '/ab9518fb-3db7-4f3b-bedb-6332e0c42f2c.png',
        '/9c606b8d-2cb4-4fbf-afab-9032102e2814.png'
    ];
    const FALLBACK_MESSAGES = [
        'AI image failed — spinning up a fresh shot...',
        'Still generating visuals — hang tight!',
        'Our illustrator bot missed — trying again automatically.',
        'Visual feed dropped — relaunching render...'
    ];
    
    // Map country names to audio file names
    const countryMusicMap = {
        'Japan': 'Japan.wav',
        'Brazil': 'Brazil.wav',
        'India': 'India.wav',
        'Germany': 'German.wav', // Note: file is "German.wav"
        'France': 'France.wav',
        'Italy': 'Italy.wav',
        'Spain': 'Spain.wav',
        'United Kingdom': 'UK.wav',
        'Canada': 'Canada.wav',
        'Australia': 'Australia.wav',
        'Mexico': 'Mexico.wav',
        'South Korea': 'SouthKorea.wav',
        'China': 'China.wav',
        'Russia': 'Russia.wav',
        'Turkey': 'Turkey.wav',
        'Argentina': 'Argentina.wav',
        'South Africa': 'SouthAfrica.wav',
        'Egypt': 'Egypt.wav'
    };
    
    // TEMPORARY: Filter to only countries with music files
    // TODO: Remove this filter on next push to allow all countries
    const countriesWithMusic = countries.filter(country => countryMusicMap.hasOwnProperty(country.name));
    
    // Get background music elements
    function getBackgroundMusicElements() {
        return {
            track1: document.getElementById('backgroundMusic'),
            track2: document.getElementById('backgroundMusicSecond'),
            loop: document.getElementById('backgroundMusicLoop')
        };
    }
    
    // Save current background music state
    function saveBackgroundMusicState() {
        // First, try to get state from global music system if available
        if (typeof window.getCurrentMusicState === 'function') {
            try {
                const globalState = window.getCurrentMusicState();
                if (globalState && globalState.currentTrack) {
                    const element = globalState.currentTrack;
                    const originalVolume = element.dataset?.originalVolume ? 
                        parseFloat(element.dataset.originalVolume) : 
                        (globalState.volume || element.volume || 0.5);
                    
                    savedBackgroundMusicState = {
                        element,
                        time: globalState.currentTime || element.currentTime || 0,
                        originalVolume
                    };
                    console.log('[Spotlight] Saved background music state from global system:', {
                        track: element.id,
                        time: savedBackgroundMusicState.time,
                        volume: originalVolume
                    });
                    return;
                }
            } catch (err) {
                console.warn('[Spotlight] Failed to get state from global music system:', err);
            }
        }
        
        const music = getBackgroundMusicElements();
        let currentTrack = null;
        let currentTime = 0;
        let originalVolume = 0.5; // Default volume
        
        // Helper to get or set original volume
        const getOriginalVolume = (track) => {
            if (track.dataset.originalVolume) {
                return parseFloat(track.dataset.originalVolume);
            }
            // If no original volume stored, use current volume if it's reasonable (> 0.1)
            // Otherwise default to 0.5
            const vol = track.volume > 0.1 ? track.volume : 0.5;
            track.dataset.originalVolume = vol.toString();
            return vol;
        };
        
        // Check playing tracks first
        if (music.track1 && !music.track1.paused && music.track1.volume > 0.01) {
            currentTrack = music.track1;
            currentTime = music.track1.currentTime;
            originalVolume = getOriginalVolume(music.track1);
        } else if (music.track2 && !music.track2.paused && music.track2.volume > 0.01) {
            currentTrack = music.track2;
            currentTime = music.track2.currentTime;
            originalVolume = getOriginalVolume(music.track2);
        } else if (music.loop && !music.loop.paused && music.loop.volume > 0.01) {
            currentTrack = music.loop;
            currentTime = music.loop.currentTime;
            originalVolume = getOriginalVolume(music.loop);
        } else {
            // Get from paused track (most recent one with time > 0)
            if (music.track1 && music.track1.currentTime > 0) {
                currentTrack = music.track1;
                currentTime = music.track1.currentTime;
                originalVolume = getOriginalVolume(music.track1);
            } else if (music.track2 && music.track2.currentTime > 0) {
                currentTrack = music.track2;
                currentTime = music.track2.currentTime;
                originalVolume = getOriginalVolume(music.track2);
            } else if (music.loop && music.loop.currentTime > 0) {
                currentTrack = music.loop;
                currentTime = music.loop.currentTime;
                originalVolume = getOriginalVolume(music.loop);
            }
        }
        
        savedBackgroundMusicState = currentTrack ? {
            element: currentTrack,
            time: currentTime,
            originalVolume: originalVolume
        } : null;
        
        if (savedBackgroundMusicState) {
            console.log('[Spotlight] Saved background music state:', {
                track: currentTrack.id,
                time: currentTime,
                volume: originalVolume
            });
        } else {
            console.log('[Spotlight] No background music state to save');
        }
    }
    
    // Pause all background music with fade out
    function pauseBackgroundMusic() {
        // Don't pause if already transitioning (prevents conflicts)
        if (isTransitioning) {
            return;
        }
        
        // Ensure we have the latest background music state saved
        if (!savedBackgroundMusicState) {
            saveBackgroundMusicState();
        }
        
        // If global music system is available, use it to pause everything cleanly
        if (typeof window.pauseAllMusicTracks === 'function') {
            try {
                const musicState = window.pauseAllMusicTracks();
                if (musicState && musicState.wasPlaying && musicState.currentTrack) {
                    const element = musicState.currentTrack;
                    const originalVolume = element.dataset?.originalVolume ? parseFloat(element.dataset.originalVolume) : (element.volume || 0.5);
                    savedBackgroundMusicState = {
                        element,
                        time: musicState.currentTime || 0,
                        originalVolume
                    };
                    return;
                }
            } catch (err) {
                console.warn('Failed to pause music via global music system:', err);
            }
        }
        
        const music = getBackgroundMusicElements();
        const audioElementsToFade = [];
        
        // Helper to ensure original volume is stored before fading
        const ensureOriginalVolume = (track) => {
            if (!track.dataset.originalVolume) {
                // Store current volume as original if it's reasonable (> 0.1)
                const vol = track.volume > 0.1 ? track.volume : 0.5;
                track.dataset.originalVolume = vol.toString();
            }
        };
        
        if (music.track1 && !music.track1.paused) {
            ensureOriginalVolume(music.track1);
            audioElementsToFade.push(music.track1);
        }
        if (music.track2 && !music.track2.paused) {
            ensureOriginalVolume(music.track2);
            audioElementsToFade.push(music.track2);
        }
        if (music.loop && !music.loop.paused) {
            ensureOriginalVolume(music.loop);
            audioElementsToFade.push(music.loop);
        }
        
        // Also check for any other background music elements
        const allAudio = document.querySelectorAll('audio');
        allAudio.forEach(audio => {
            // Don't pause spotlight music
            if (audio !== spotlightMusic && 
                audio.id && 
                (audio.id.includes('backgroundMusic') || audio.id.includes('background')) &&
                !audio.paused) {
                ensureOriginalVolume(audio);
                audioElementsToFade.push(audio);
            }
        });
        
        // Fade out all background music elements
        // First, ensure all other background tracks are paused immediately to prevent overlap
        if (music.track1 && !audioElementsToFade.includes(music.track1)) {
            music.track1.pause();
        }
        if (music.track2 && !audioElementsToFade.includes(music.track2)) {
            music.track2.pause();
        }
        if (music.loop && !audioElementsToFade.includes(music.loop)) {
            music.loop.pause();
        }
        
        // Then fade out the ones that were playing
        audioElementsToFade.forEach(audio => {
            fadeOutAudio(audio);
        });
    }
    
    // Resume background music from saved state with fade in
    function resumeBackgroundMusic() {
        const stateToResume = savedBackgroundMusicState;
        if (!stateToResume || !stateToResume.element) {
            console.log('No saved background music state to resume');
            return;
        }
        
        // Don't resume if spotlight is visible or transitioning
        if (isSpotlightVisible || isTransitioning) {
            console.log('Spotlight visible or transitioning, skipping background music resume');
            return;
        }
        
        const musicElement = stateToResume.element;
        if (!musicElement) {
            console.log('Saved music element not found');
            savedBackgroundMusicState = null;
            return;
        }
        
        // Ensure all other background tracks are paused before resuming
        const music = getBackgroundMusicElements();
        if (music.track1 && music.track1 !== musicElement && !music.track1.paused) {
            music.track1.pause();
        }
        if (music.track2 && music.track2 !== musicElement && !music.track2.paused) {
            music.track2.pause();
        }
        if (music.loop && music.loop !== musicElement && !music.loop.paused) {
            music.loop.pause();
        }
        
        // Set the time before playing
        musicElement.currentTime = stateToResume.time;
        
        // Use the saved original volume, or get from dataset, or default to 0.5
        const targetVolume = stateToResume.originalVolume || 
                            (musicElement.dataset.originalVolume ? 
                                parseFloat(musicElement.dataset.originalVolume) : 0.5);
        
        // Ensure we're using the correct original volume
        if (!musicElement.dataset.originalVolume) {
            musicElement.dataset.originalVolume = targetVolume.toString();
        }
        
        // Set volume to 0 initially for fade-in
        musicElement.volume = 0;
        
        // Ensure spotlight music is fully faded out before starting background fade in
        // This creates a smoother transition
        const resumePlayback = () => {
                // Double-check spotlight is not visible before resuming
            if (isSpotlightVisible || isTransitioning) {
                console.log('Spotlight became visible during resume, aborting');
                return;
            }
            
            // Actually play the audio
            musicElement.play().catch(err => {
                console.error('Error resuming background music:', err);
                // If autoplay is blocked, try again after user interaction
                document.addEventListener('click', function playOnce() {
                    if (musicElement && musicElement.paused && !isSpotlightVisible) {
                        musicElement.play().catch(() => {});
                    }
                    document.removeEventListener('click', playOnce);
                }, { once: true });
            });
            
            // Fade in the background music
                    fadeInAudio(musicElement, targetVolume, () => {
                        // Music has faded in at original volume
                console.log('Background music resumed and faded in');
            });
        };
        
        if (spotlightMusic && !spotlightMusic.paused) {
            // Wait a bit for spotlight to finish fading, then start background
            setTimeout(() => {
                resumePlayback();
            }, 200); // Slightly longer wait for smoother transition
        } else {
            // Fade in the background music immediately
            resumePlayback();
        }
        
        // Clear saved state after scheduling resume to avoid duplicate resumes
        // But only clear after we've actually started the resume process
        setTimeout(() => {
            savedBackgroundMusicState = null;
        }, 100);
    }
    
    // Load and play country music
    function playCountryMusic(countryName, resumeFromSaved = false) {
        // Don't play if not visible (unless we're explicitly resuming from saved state)
        if (!isSpotlightVisible && !resumeFromSaved) {
            console.log('[Spotlight] Spotlight not visible, skipping country music play');
            return;
        }
        
        // If we're resuming from saved state, we're likely in a transition - that's okay
        // Otherwise, if transitioning, wait a bit
        if (isTransitioning && !resumeFromSaved) {
            console.log('[Spotlight] Transitioning, will retry country music play');
            setTimeout(() => {
                if (isSpotlightVisible) {
                    playCountryMusic(countryName, resumeFromSaved);
                }
            }, 200);
            return;
        }
        
        console.log(`[Spotlight] Playing country music for ${countryName}${resumeFromSaved ? ' (resuming from saved state)' : ''}`);
        
        const audioFile = countryMusicMap[countryName];
        if (!audioFile) {
            console.log(`No music file found for ${countryName}`);
            return;
        }
        
        // First, ensure background music is faded out smoothly
        // Don't wait for it to complete - start loading country music in parallel
        pauseBackgroundMusic();
        
        // Check if we have saved state for this country's music
        const savedState = savedSpotlightMusicState && 
                          savedSpotlightMusicState.country === countryName ? 
                          savedSpotlightMusicState : null;
        
        // If we have existing music for the same country and want to resume, try to resume it
        if (spotlightMusic && savedState && resumeFromSaved) {
            // Check if the audio source matches
            const currentSrc = spotlightMusic.src;
            const expectedSrc = `${window.location.origin}/SpotlightSongs/${audioFile}`;
            if (currentSrc.includes(audioFile)) {
                // Same audio file - resume from saved position with fade in
                spotlightMusic.currentTime = savedState.time || 0;
                if (isSpotlightVisible) {
                    fadeInAudio(spotlightMusic, 0.5, () => {
                        // Music has faded in
                    });
                }
                return;
            }
        }
        
        // Stop any existing spotlight music and save its state (with fade out)
        if (spotlightMusic) {
            // Save current state before stopping
            if (currentCountry) {
                savedSpotlightMusicState = {
                    country: currentCountry.name,
                    time: spotlightMusic.currentTime,
                    audioFile: audioFile
                };
            }
            
            // Fade out the old spotlight music
            const oldMusic = spotlightMusic;
            fadeOutAudio(oldMusic, () => {
                // After fade out completes, clean up
                oldMusic.pause();
                if (oldMusic === spotlightMusic) {
                    spotlightMusic = null;
                    window.spotlightMusic = null;
                }
            });
        }
        
        // Create new audio element
        spotlightMusic = new Audio(`/SpotlightSongs/${audioFile}`);
        spotlightMusic.volume = 0; // Start at 0 for fade in
        spotlightMusic.loop = true;
        
        // Expose on window for external checks (e.g., music monitor in index.html)
        window.spotlightMusic = spotlightMusic;
        
        // When spotlight music starts playing, pause background and start monitoring
        spotlightMusic.addEventListener('play', () => {
            pauseBackgroundMusic(); // Double-check background is paused
            startMusicMonitor();
        });
        
        let playAttempted = false; // Track if we've already attempted to play
        
        spotlightMusic.addEventListener('loadeddata', () => {
            if (isSpotlightVisible && !playAttempted) {
                playAttempted = true;
                // Make sure background is paused before playing
                pauseBackgroundMusic();
                
                // Resume from saved time if available
                if (savedState && savedState.time > 0) {
                    spotlightMusic.currentTime = savedState.time;
                }
                
                // Actually start playing the audio
                spotlightMusic.play().catch(err => {
                    // Only log if it's not an AbortError (interrupted by load)
                    if (err.name !== 'AbortError') {
                        console.error('Error playing spotlight music:', err);
                    }
                    // If autoplay is blocked, try again after user interaction
                    document.addEventListener('click', function playOnce() {
                        if (spotlightMusic && spotlightMusic.paused) {
                            spotlightMusic.play().catch(() => {});
                        }
                        document.removeEventListener('click', playOnce);
                    }, { once: true });
                });
                
                // Wait a brief moment to ensure background fade out has started
                // This creates a smoother crossfade effect
                setTimeout(() => {
                    // Fade in the new country music
                    fadeInAudio(spotlightMusic, 0.5, () => {
                        // Music has faded in
                    });
                }, 200);
            }
        });
        
        // Also try to play when canplay event fires (more reliable than loadeddata)
        spotlightMusic.addEventListener('canplay', () => {
            if (isSpotlightVisible && spotlightMusic.paused && !playAttempted) {
                playAttempted = true;
                pauseBackgroundMusic();
                
                // Resume from saved time if available
                if (savedState && savedState.time > 0) {
                    spotlightMusic.currentTime = savedState.time;
                }
                
                spotlightMusic.play().catch(err => {
                    // Only log if it's not an AbortError (interrupted by load)
                    if (err.name !== 'AbortError') {
                        console.error('Error playing spotlight music on canplay:', err);
                    }
                });
                
                // Fade in the new country music
                setTimeout(() => {
                    fadeInAudio(spotlightMusic, 0.5, () => {});
                }, 200);
            }
        });
        
        // When spotlight music stops, stop monitoring
        spotlightMusic.addEventListener('pause', () => {
            stopMusicMonitor();
            // Save current position when pausing
            if (currentCountry && spotlightMusic) {
                savedSpotlightMusicState = {
                    country: currentCountry.name,
                    time: spotlightMusic.currentTime,
                    audioFile: audioFile
                };
            }
        });
        
        spotlightMusic.addEventListener('error', (err) => {
            console.error(`Error loading spotlight music for ${countryName}:`, err);
        });
        
        // Load the audio
        spotlightMusic.load();
    }
    
    // Stop country music (but save position for resume) with fade out
    function stopCountryMusic() {
        if (spotlightMusic && currentCountry) {
            // Save current position before pausing
            savedSpotlightMusicState = {
                country: currentCountry.name,
                time: spotlightMusic.currentTime,
                audioFile: countryMusicMap[currentCountry.name]
            };
            
            // Fade out the country music
            const musicToFade = spotlightMusic;
            fadeOutAudio(musicToFade, () => {
                musicToFade.pause();
                // Don't reset currentTime - keep it for resume
                // Note: Don't clear window.spotlightMusic here - it's still valid, just paused
                // It will be cleared when a new country music starts or when spotlightMusic is set to null
            });
        }
    }
    
    // Monitor to ensure background music stays paused while spotlight music plays
    let musicMonitorInterval = null;
    let isTransitioning = false; // Lock to prevent overlapping transitions
    function startMusicMonitor() {
        if (musicMonitorInterval) return; // Already monitoring
        
        musicMonitorInterval = setInterval(() => {
            if (spotlightMusic && !spotlightMusic.paused && isSpotlightVisible && !isTransitioning) {
                // Spotlight music is playing - ensure background is paused
                // Only pause if not currently transitioning
                const music = getBackgroundMusicElements();
                let shouldPause = false;
                
                // Check if any background track is actually playing (not just paused)
                if (music.track1 && !music.track1.paused && music.track1.volume > 0.01) {
                    shouldPause = true;
                } else if (music.track2 && !music.track2.paused && music.track2.volume > 0.01) {
                    shouldPause = true;
                } else if (music.loop && !music.loop.paused && music.loop.volume > 0.01) {
                    shouldPause = true;
                }
                
                if (shouldPause) {
                    pauseBackgroundMusic();
                }
            }
        }, 1000); // Check every 1 second (less aggressive)
    }
    
    function stopMusicMonitor() {
        if (musicMonitorInterval) {
            clearInterval(musicMonitorInterval);
            musicMonitorInterval = null;
        }
    }
    
    // Setup Intersection Observer to detect when spotlight is visible
    let visibilityChangeTimeout = null;
    function setupSpotlightVisibilityObserver() {
        const spotlightSection = document.getElementById('country-spotlight-section');
        if (!spotlightSection) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Clear any pending visibility changes
                if (visibilityChangeTimeout) {
                    clearTimeout(visibilityChangeTimeout);
                    visibilityChangeTimeout = null;
                }
                
                // Debounce rapid visibility changes
                visibilityChangeTimeout = setTimeout(() => {
                    const wasVisible = isSpotlightVisible;
                    isSpotlightVisible = entry.isIntersecting && entry.intersectionRatio > 0.3;
                    
                    // Only act if visibility state actually changed and we're not transitioning
                    if (wasVisible !== isSpotlightVisible && !isTransitioning) {
                        isTransitioning = true; // Lock transitions
                        window.spotlightTransitioning = true; // Expose to global scope
                        
                        if (isSpotlightVisible) {
                            // Spotlight is now visible - pause background, play/resume country music
                            console.log('[Spotlight] Section became visible, switching to country music');
                            if (currentCountry && countryMusicMap[currentCountry.name]) {
                                // Save background music state BEFORE pausing
                                saveBackgroundMusicState();
                                // Pause background music with fade out
                                pauseBackgroundMusic();
                                // Small delay to ensure background fade has started
                                setTimeout(() => {
                                // Try to resume from saved state, otherwise start fresh
                                playCountryMusic(currentCountry.name, true);
                                
                                // Unlock after transition completes
                                setTimeout(() => {
                                    isTransitioning = false;
                                    window.spotlightTransitioning = false;
                                }, 600); // Wait for fade transitions
                                }, 100);
                            } else {
                                console.log('[Spotlight] No country music available for current country');
                                isTransitioning = false;
                                window.spotlightTransitioning = false;
                            }
                        } else {
                            // Spotlight is not visible - stop country music (save position), resume background
                            console.log('[Spotlight] Section no longer visible, resuming background music');
                            // Use a coordinated fade for smoother transition
                            stopCountryMusic();
                            stopMusicMonitor(); // Stop monitoring
                            // Wait for country music to start fading out before resuming background
                            setTimeout(() => {
                                // Clear transition flag before resuming to allow resume
                                isTransitioning = false;
                                window.spotlightTransitioning = false;
                                resumeBackgroundMusic();
                                // Re-lock briefly to prevent race conditions, then unlock after transition completes
                                setTimeout(() => {
                                    isTransitioning = false;
                                    window.spotlightTransitioning = false;
                                }, 400); // Wait for fade in
                            }, 300);
                        }
                    } else if (isSpotlightVisible && currentCountry && countryMusicMap[currentCountry.name] && !isTransitioning) {
                        // Spotlight is visible and country changed - update music
                        // Check if we need to switch music (country changed while visible)
                        if (!spotlightMusic || spotlightMusic.paused) {
                            isTransitioning = true;
                            window.spotlightTransitioning = true;
                            saveBackgroundMusicState();
                            pauseBackgroundMusic();
                            playCountryMusic(currentCountry.name, false); // New country, start fresh
                            
                            // Unlock after transition completes
                            setTimeout(() => {
                                isTransitioning = false;
                                window.spotlightTransitioning = false;
                            }, 600);
                        }
                    }
                }, 150); // Debounce rapid changes
            });
        }, {
            threshold: [0.3], // Single threshold to reduce rapid firing
            rootMargin: '0px'
        });
        
        observer.observe(spotlightSection);
    }
    
    // Get a random country, excluding the last generated one
    function getRandomCountry(excludeCountry = null) {
        // TEMPORARY: Use only countries with music
        // TODO: Change back to full countries array on next push
        const availableCountriesList = countriesWithMusic;
        
        // If no country to exclude, just pick random
        if (!excludeCountry) {
            return availableCountriesList[Math.floor(Math.random() * availableCountriesList.length)];
        }
        
        // Filter out the excluded country
        const availableCountries = availableCountriesList.filter(c => {
            // Exclude by name (case-insensitive)
            return c.name.toLowerCase() !== excludeCountry.name.toLowerCase();
        });
        
        // If all countries were excluded (shouldn't happen), fall back to all countries with music
        if (availableCountries.length === 0) {
            console.warn('All countries excluded, falling back to full list');
            return availableCountriesList[Math.floor(Math.random() * availableCountriesList.length)];
        }
        
        // Pick random from available countries
        return availableCountries[Math.floor(Math.random() * availableCountries.length)];
    }
    
    // Format AI response text
    function formatAIResponse(text) {
        // First, convert markdown links to HTML links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #4A90E2; text-decoration: underline;">$1</a>');
        
        // Split by section headers (## or ###)
        const sections = text.split(/(?=^##?\s+)/m);
        let formatted = '';
        
        sections.forEach(section => {
            section = section.trim();
            if (!section) return;
            
            // Check if it starts with a header (## or ###)
            const headerMatch = section.match(/^(##?\s+)(.+?)(\n|$)/);
            if (headerMatch) {
                const headerText = headerMatch[2].trim();
                const content = section.replace(/^##?\s+.+?\n/, '').trim();
                formatted += `<h4>${headerText}</h4>`;
                if (content) {
                    // Split content into paragraphs
                    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
                    paragraphs.forEach(p => {
                        p = p.trim();
                        // Remove any stray markdown formatting
                        p = p.replace(/\*\*/g, '');
                        p = p.replace(/^##?\s+/gm, '');
                        if (p) {
                            formatted += `<p>${p}</p>`;
                        }
                    });
                }
            } else {
                // Regular paragraph - clean up markdown
                let content = section.trim();
                // Remove markdown formatting
                content = content.replace(/\*\*/g, '');
                content = content.replace(/^##?\s+/gm, '');
                // Split into paragraphs
                const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
                paragraphs.forEach(p => {
                    p = p.trim();
                    if (p) {
                        formatted += `<p>${p}</p>`;
                    }
                });
            }
        });
        
        // If no formatting worked, just return as paragraphs with links converted
        if (!formatted) {
            const paragraphs = text.split(/\n\n+/);
            formatted = paragraphs.map(p => {
                p = p.trim();
                p = p.replace(/\*\*/g, '');
                return `<p>${p}</p>`;
            }).join('');
        }
        
        return formatted;
    }
    
    // Generate an image using the AI API with aggressive retry logic
    let imageGenerationInProgress = false;
    const imageRequestQueue = new Map(); // Track requests by prompt to avoid duplicates
    
    // Diagnostic function - expose to window for console testing
    window.testImageGeneration = async function(testPrompt = "a simple red circle on white background") {
        console.log('🧪 Testing image generation with prompt:', testPrompt);
        console.log('📡 Calling API endpoint: /.netlify/functions/generate-image');
        
        try {
            const response = await fetch('/.netlify/functions/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: testPrompt,
                    size: '1024x1024',
                    quality: 'standard',
                    style: 'vivid'
                })
            });
            
            console.log('📥 Response status:', response.status, response.statusText);
            console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
            
            const data = await response.json();
            console.log('📦 Response data:', data);
            
            if (data.error) {
                console.error('❌ Error from API:', data.error);
                console.error('📋 Error details:', data.details);
                return { success: false, error: data.error, details: data };
            }
            
            if (data.imageUrl || data.storedImageUrl) {
                console.log('✅ Success! Image URL:', data.storedImageUrl || data.imageUrl);
                return { success: true, url: data.storedImageUrl || data.imageUrl, data };
            } else {
                console.error('❌ No image URL in response');
                return { success: false, error: 'No URL returned', data };
            }
        } catch (error) {
            console.error('❌ Network/Parse error:', error);
            return { success: false, error: error.message, stack: error.stack };
        }
    };
    
    async function generateImage(prompt, retries = 5) {
        // Prevent multiple concurrent requests for the same prompt
        if (imageRequestQueue.has(prompt)) {
            // Suppress duplicate request logs to reduce console noise
            return imageRequestQueue.get(prompt);
        }
        
        // Create a promise for this request
        const requestPromise = (async () => {
            let lastError = null;
            
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    // Create abort controller for timeout (fallback for browsers without AbortSignal.timeout)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (reduced for faster failure)
                    
                    // Handle localhost vs production endpoint
                    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const endpoint = isLocalhost 
                        ? 'http://localhost:8888/.netlify/functions/generate-image'
                        : '/.netlify/functions/generate-image';
                    
                    if (attempt === 0) {
                        console.log('[Image Generation] 🚀 Starting image generation:', {
                            prompt: prompt.substring(0, 50) + '...',
                            endpoint: endpoint,
                            isLocalhost: isLocalhost
                        });
                    }
                    
                    // Ensure prompt is valid and sanitized
                    const sanitizedPrompt = prompt.trim();
                    if (!sanitizedPrompt || sanitizedPrompt.length < 3) {
                        throw new Error('Prompt is too short or empty');
                    }
                    if (sanitizedPrompt.length > 500) {
                        throw new Error('Prompt is too long (max 500 characters)');
                    }
                    
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            prompt: sanitizedPrompt,
                            size: '1024x1024',
                            quality: 'standard',
                            style: 'vivid'
                        }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId); // Clear timeout on success
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                let errorData = null;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    // Not JSON, use text as is
                }
                        
                        lastError = { status: response.status, data: errorData || errorText };
                        
                        // Log error details for debugging - always log first attempt
                        console.error('[Image Generation] ❌ API Error:', {
                            status: response.status,
                            statusText: response.statusText,
                            error: errorData || errorText,
                            prompt: prompt.substring(0, 50) + '...',
                            attempt: attempt + 1,
                            endpoint: endpoint,
                            fullError: errorData
                        });
                        
                        // Show user-friendly error for common issues
                        if (response.status === 500 && errorData?.error?.includes('API key')) {
                            console.error('[Image Generation] ⚠️ OPENAI_API_KEY not configured! Set it in Netlify environment variables or .env file for local development.');
                        } else if (response.status === 429) {
                            console.error('[Image Generation] ⚠️ Rate limit reached (30 images per hour). Please wait before generating more images.');
                        }
                        
                        // Don't retry on 400 (Bad Request) - these are client errors, not server errors
                        // Retry on 502, 503, 504 (server errors) or 429 (rate limit)
                        // Also retry on 500 (internal server error) and 408 (timeout)
                        const isClientError = [400, 401, 403, 404].includes(response.status);
                        const isServerError = [500, 502, 503, 504, 408, 429].includes(response.status);
                        const shouldRetry = isServerError && attempt < retries - 1;
                        
                        if (isClientError) {
                            // Client errors (400, 401, 403, 404) should not be retried
                            // Suppress detailed logging for 400 errors to reduce console noise
                            if (response.status !== 400) {
                                console.error(`[Image Generation] ❌ Client error (${response.status}):`, {
                                    error: errorData || errorText,
                                    prompt: prompt.substring(0, 50) + '...'
                                });
                            }
                            return null; // Don't retry client errors
                        } else if (shouldRetry) {
                            // Progressive backoff: start with 2s, increase gradually, max 30s
                            const baseDelay = 2000;
                            const delay = Math.min(baseDelay * Math.pow(1.5, attempt), 30000);
                            // Suppress retry logs to reduce console noise
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue; // Retry
                        } else {
                            // Log final error after all retries exhausted (only for non-400 errors)
                            if (response.status !== 400) {
                                console.error(`[Image Generation] ❌ Failed after ${retries} attempts:`, {
                                    status: response.status,
                                    error: errorData || errorText,
                                    prompt: prompt.substring(0, 50) + '...'
                                });
                            }
                            // For 400 errors, log the actual OpenAI error message for debugging
                            if (response.status === 400) {
                                const openAIError = errorData?.error?.message || errorData?.message || errorText || 'Bad Request';
                                console.error('[Image Generation] OpenAI rejected prompt:', {
                                    status: 400,
                                    error: openAIError,
                                    prompt: prompt.substring(0, 100),
                                    fullError: errorData
                                });
                                const error = new Error(`Image generation failed: ${openAIError}`);
                                error.status = 400;
                                error.openAIError = openAIError;
                                throw error;
                            }
                            return null;
                        }
                    }
                    
                    // Success! Parse and return the image URL
                    let data;
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        console.error('[Image Generation] ❌ Failed to parse JSON response:', parseError);
                        const responseText = await response.text().catch(() => 'Unable to read response');
                        console.error('[Image Generation] Response text:', responseText.substring(0, 200));
                        if (attempt < retries - 1) {
                            const delay = Math.min(3000 * Math.pow(1.5, attempt), 30000);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        return null;
                    }
                    
                    // Check for error in response
                    if (data.error) {
                        console.error('[Image Generation] ❌ API returned error:', {
                            error: data.error,
                            status: data.status,
                            details: data.details,
                            retryable: data.retryable
                        });
                        
                        // If it's a retryable error and we have attempts left, retry
                        if (data.retryable && attempt < retries - 1) {
                            const delay = Math.min(3000 * Math.pow(1.5, attempt), 30000);
                            console.warn(`[Image Generation] Retrying after ${delay}ms due to retryable error`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        
                        // Non-retryable error or out of attempts
                        return null;
                    }
                    
                    // Debug logging to help diagnose issues
                    if (attempt === 0) {
                        console.log('[Image Generation] ✅ API Response:', {
                            hasStoredImageUrl: !!data.storedImageUrl,
                            hasImageUrl: !!data.imageUrl,
                            storedImageUrl: data.storedImageUrl ? data.storedImageUrl.substring(0, 50) + '...' : null,
                            imageUrl: data.imageUrl ? data.imageUrl.substring(0, 50) + '...' : null,
                            stored: data.stored || false,
                            error: data.error || null
                        });
                    }
                    
                    // Prefer storedImageUrl (permanent) but fallback to imageUrl (temporary, expires in 1 hour)
            const imageUrl = data.storedImageUrl || data.imageUrl || null;
                    
                    // Log what we received
                    if (attempt === 0) {
                        console.log('[Image Generation] Response data:', {
                            hasStoredImageUrl: !!data.storedImageUrl,
                            hasImageUrl: !!data.imageUrl,
                            storedImageUrl: data.storedImageUrl ? data.storedImageUrl.substring(0, 80) + '...' : null,
                            imageUrl: data.imageUrl ? data.imageUrl.substring(0, 80) + '...' : null,
                            finalImageUrl: imageUrl ? imageUrl.substring(0, 80) + '...' : null
                        });
                    }
                    
            if (!imageUrl) {
                        // Always retry if no URL returned (unless we've exhausted all attempts)
                        if (attempt < retries - 1) {
                            const delay = Math.min(3000 * Math.pow(1.5, attempt), 30000);
                            console.warn(`[Image Generation] No URL returned, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        // Log error with full details on final attempt
                        console.error('[Image Generation] ❌ No URL returned after all retries:', {
                            responseData: data,
                            prompt: prompt.substring(0, 100),
                            attempts: retries
                        });
                        return null;
                    }
                    
                    // Log success with URL type
                    if (attempt === 0) {
                        console.log(`[Image Generation] ✅ Success: Using ${data.storedImageUrl ? 'stored (permanent)' : 'direct (temporary)'} URL`);
                    }
                    
                    // Success! Only log if we had to retry
                    if (attempt > 0) {
                        // Suppress success logs to reduce console noise
            }
            return imageUrl;
                    
        } catch (error) {
                    lastError = error;
                    
                    // Retry on network errors or timeout - always retry unless we've exhausted all attempts
                    if (attempt < retries - 1) {
                        // Progressive backoff for network errors
                        const baseDelay = 3000;
                        const delay = Math.min(baseDelay * Math.pow(1.5, attempt), 30000);
                        // Suppress retry logs to reduce console spam
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Retry
                    } else {
                        // Only log final errors, suppress 502-related network errors
                        if (error.name !== 'AbortError' && !error.message?.includes('502')) {
                            console.error(`Image generation error after ${retries} attempts:`, error);
                        }
            return null;
                    }
                }
            }
            
            // All retries exhausted
            // Don't queue 400 errors for background retry (client errors shouldn't be retried)
            if (lastError && lastError.status === 400) {
                // 400 errors are client errors - don't retry
                return null;
            }
            
            if (lastError) {
                // Suppress background retry warnings for 502 and 400 errors to reduce console spam
                const is502Error = lastError.status === 502 || lastError.message?.includes('502') || lastError.message?.includes('Bad Gateway');
                const is400Error = lastError.status === 400;
                if (!is502Error && !is400Error) {
                    console.warn(`Image generation failed after ${retries} attempts, will retry in background:`, lastError);
                }
                // Note: We can't queue here because we don't have wrapperId in this scope
                // The caller will handle background retry via failedImageRequests
            }
            return null;
        })();
        
        // Store the promise in the queue
        imageRequestQueue.set(prompt, requestPromise);
        
        // Clean up when done
        requestPromise.finally(() => {
            imageRequestQueue.delete(prompt);
        });
        
        return requestPromise;
    }
    
    // Load image into a wrapper element
    // Track failed image requests for background retry
    const failedImageRequests = new Map(); // prompt -> { wrapperId, retryCount, lastAttempt }

    function getRandomFallbackImage() {
        return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
    }

    function getRandomFallbackMessage() {
        return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
    }

    function renderFallbackState(wrapper) {
        if (!wrapper) {
            console.error('[Spotlight] Cannot render fallback - wrapper is null');
            return;
        }
        
        const fallbackSrc = getRandomFallbackImage();
        const fallbackMessage = getRandomFallbackMessage();
        
        // Ensure wrapper is visible
        if (wrapper.style.display === 'none') {
            wrapper.style.display = 'block';
        }
        
        wrapper.innerHTML = `
            <div class="image-fallback-state">
                <img src="${fallbackSrc}" alt="Temporary visual placeholder" loading="lazy" 
                     onerror="this.onerror=null; this.src='/f41de8d1-cc13-41b2-815c-64e51598326a.png';" />
                <div class="image-fallback-overlay">
                    <span class="image-fallback-title">AI image unavailable</span>
                    <span class="image-fallback-subtitle">${fallbackMessage}</span>
                </div>
            </div>
        `;
        
        // Force a reflow to ensure the fallback is rendered
        wrapper.offsetHeight;
        
        console.log(`[Spotlight] Fallback rendered for wrapper with fallback image: ${fallbackSrc}`);
    }
    
    function loadImageIntoWrapper(wrapperId, imageUrl) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) {
            console.error(`[Spotlight] Wrapper not found: ${wrapperId}`);
            return;
        }
        
        // Ensure wrapper and parent containers are visible
        if (wrapper.style.display === 'none') {
            wrapper.style.display = 'block';
        }
        
        // Ensure parent containers are visible
        let parent = wrapper.parentElement;
        while (parent && parent !== document.body) {
            if (parent.id === 'spotlight-images-container' || parent.classList.contains('spotlight-images-grid')) {
                if (window.getComputedStyle(parent).display === 'none') {
                    parent.style.display = parent.classList.contains('spotlight-images-grid') ? 'flex' : 'block';
                }
            }
            parent = parent.parentElement;
        }
        
        if (imageUrl) {
            // Convert relative URLs to absolute URLs
            let absoluteUrl = imageUrl;
            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                // It's a relative URL - convert to absolute
                if (imageUrl.startsWith('/')) {
                    // Absolute path - prepend origin
                    absoluteUrl = window.location.origin + imageUrl;
                } else {
                    // Relative path - prepend origin and current path
                    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                    absoluteUrl = window.location.origin + basePath + imageUrl;
                }
                console.log(`[Spotlight] Converted relative URL to absolute: ${imageUrl} -> ${absoluteUrl}`);
            }
            
            // Validate URL format
            if (!absoluteUrl.startsWith('http://') && !absoluteUrl.startsWith('https://')) {
                console.error(`[Spotlight] ❌ Invalid URL format for ${wrapperId}:`, absoluteUrl);
                renderFallbackState(wrapper);
                return;
            }
            
            console.log(`[Spotlight] Loading image into ${wrapperId}`);
            console.log(`[Spotlight] Full URL:`, absoluteUrl);
            console.log(`[Spotlight] URL length:`, absoluteUrl.length);
            console.log(`[Spotlight] Wrapper element:`, wrapper);
            console.log(`[Spotlight] Wrapper display:`, window.getComputedStyle(wrapper).display);
            console.log(`[Spotlight] Wrapper visibility:`, window.getComputedStyle(wrapper).visibility);
            
            // Create img element with error handling
            const img = document.createElement('img');
            img.src = absoluteUrl;
            img.alt = 'Generated image';
            img.loading = 'lazy';
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.3s ease;';
            
            // Track loading state
            img.onload = function() {
                console.log(`[Spotlight] ✅ Image loaded successfully in ${wrapperId}`);
                console.log(`[Spotlight] Image dimensions:`, this.naturalWidth, 'x', this.naturalHeight);
                this.style.opacity = '1';
                // Remove from failed requests if it was there
                for (const [prompt, data] of failedImageRequests.entries()) {
                    if (data.wrapperId === wrapperId) {
                        failedImageRequests.delete(prompt);
                        break;
                    }
                }
            };
            
            img.onerror = function() {
                console.error(`[Spotlight] ❌ Image failed to load in ${wrapperId}`);
                console.error(`[Spotlight] Failed URL:`, absoluteUrl);
                console.error(`[Spotlight] Image element:`, this);
                console.error(`[Spotlight] Error event details:`, {
                    type: 'error',
                    target: this,
                    src: this.src
                });
                // Show fallback instead
                renderFallbackState(wrapper);
            };
            
            // Clear wrapper and add image
            // IMPORTANT: Check if wrapper was already modified (race condition protection)
            const currentWrapper = document.getElementById(wrapperId);
            if (!currentWrapper) {
                console.error(`[Spotlight] ❌ Wrapper ${wrapperId} not found when trying to insert image`);
                return;
            }
            
            // Check if there's already a valid image loading
            const existingImg = currentWrapper.querySelector('img');
            if (existingImg && existingImg.src && existingImg.src === absoluteUrl) {
                console.log(`[Spotlight] Image already exists in ${wrapperId} with same URL, skipping insertion`);
                return;
            }
            
            // Clear wrapper and add image
            currentWrapper.innerHTML = '';
            currentWrapper.appendChild(img);
            
            // Verify image was added after a short delay
            setTimeout(() => {
                const verifyWrapper = document.getElementById(wrapperId);
                if (!verifyWrapper) {
                    console.error(`[Spotlight] ❌ Wrapper ${wrapperId} was removed after image insertion`);
                    return;
                }
                const verifyImg = verifyWrapper.querySelector('img');
                if (!verifyImg || verifyImg.src !== imageUrl) {
                    console.error(`[Spotlight] ❌ Image was not properly inserted into ${wrapperId} - wrapper may have been cleared`);
                    console.error(`[Spotlight] Wrapper innerHTML:`, verifyWrapper.innerHTML.substring(0, 100));
                    // Try one more time if image is missing
                    if (!verifyImg) {
                        console.log(`[Spotlight] Retrying image insertion for ${wrapperId}`);
                        verifyWrapper.innerHTML = '';
                        const retryImg = document.createElement('img');
                        retryImg.src = imageUrl;
                        retryImg.alt = 'Generated image';
                        retryImg.loading = 'lazy';
                        retryImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.3s ease;';
                        retryImg.onload = function() {
                            console.log(`[Spotlight] ✅ Retry image loaded successfully in ${wrapperId}`);
                            this.style.opacity = '1';
                        };
                        retryImg.onerror = function() {
                            console.error(`[Spotlight] ❌ Retry image failed to load in ${wrapperId}`);
                            renderFallbackState(verifyWrapper);
                        };
                        verifyWrapper.appendChild(retryImg);
                    }
        } else {
                    console.log(`[Spotlight] ✅ Image element verified in DOM for ${wrapperId}`);
                }
            }, 100);
        } else {
            console.log(`[Spotlight] No image URL provided for ${wrapperId}, showing fallback`);
            renderFallbackState(wrapper);
        }
    }
    
    // Background retry system for failed images
    async function retryFailedImages() {
        const now = Date.now();
        const maxRetries = 20; // Keep trying up to 20 times
        const retryInterval = 30000; // Retry every 30 seconds
        
        for (const [prompt, data] of failedImageRequests.entries()) {
            // Skip if we've retried too many times
            if (data.retryCount >= maxRetries) {
                failedImageRequests.delete(prompt);
                continue;
            }
            
            // Skip if this was a 400 error (client error - don't retry)
            if (data.status === 400) {
                failedImageRequests.delete(prompt);
                continue;
            }
            
            // Skip if we just tried recently
            if (now - data.lastAttempt < retryInterval) {
                continue;
            }
            
            // Try again (suppress logs to reduce console noise)
            data.lastAttempt = now;
            data.retryCount++;
            
            try {
                const url = await generateImage(prompt, 5); // Use fewer retries for background attempts
                if (url) {
                    loadImageIntoWrapper(data.wrapperId, url);
                    failedImageRequests.delete(prompt);
                } else {
                    // Keep in queue for next retry cycle
                    failedImageRequests.set(prompt, data);
                }
            } catch (error) {
                // Suppress error logs for background retries to reduce console noise
                // Keep in queue for next retry cycle
                failedImageRequests.set(prompt, data);
            }
        }
    }
    
    // Run background retry every 30 seconds
    setInterval(retryFailedImages, 30000);
    
    // Check rate limit (3 per day)
    function checkRateLimit() {
        const now = Date.now();
        const stored = localStorage.getItem(RATE_LIMIT_KEY);
        
        if (!stored) {
            // First time - initialize
            const dayStart = new Date(now);
            dayStart.setHours(0, 0, 0, 0); // Start of today
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
                dayStart: dayStart.getTime(),
                count: 0
            }));
            return { allowed: true, remaining: RATE_LIMIT_COUNT };
        }
        
        const data = JSON.parse(stored);
        const dayStart = new Date(data.dayStart);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        // If it's a new day, reset
        if (todayStart.getTime() > dayStart.getTime()) {
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
                dayStart: todayStart.getTime(),
                count: 0
            }));
            return { allowed: true, remaining: RATE_LIMIT_COUNT };
        }
        
        // Check if limit reached
        if (data.count >= RATE_LIMIT_COUNT) {
            const nextDayStart = new Date(todayStart);
            nextDayStart.setDate(nextDayStart.getDate() + 1);
            const timeRemaining = nextDayStart.getTime() - now;
            const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));
            return { 
                allowed: false, 
                remaining: 0,
                hoursRemaining: hoursRemaining
            };
        }
        
        return { 
            allowed: true, 
            remaining: RATE_LIMIT_COUNT - data.count 
        };
    }
    
    // Increment rate limit counter
    function incrementRateLimit() {
        const now = Date.now();
        const stored = localStorage.getItem(RATE_LIMIT_KEY);
        
        if (!stored) {
            const dayStart = new Date(now);
            dayStart.setHours(0, 0, 0, 0);
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
                dayStart: dayStart.getTime(),
                count: 1
            }));
            return;
        }
        
        const data = JSON.parse(stored);
        const dayStart = new Date(data.dayStart);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        // If it's a new day, reset
        if (todayStart.getTime() > dayStart.getTime()) {
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
                dayStart: todayStart.getTime(),
                count: 1
            }));
            return;
        }
        
        data.count = (data.count || 0) + 1;
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    }
    
    // Hide spotlight section when limit is reached
    function hideSpotlightSection() {
        const spotlightSection = document.getElementById('country-spotlight-section');
        if (spotlightSection) {
            spotlightSection.style.display = 'none';
            console.log('Spotlight section hidden - daily limit reached');
        }
    }
    
    // Show spotlight section
    function showSpotlightSection() {
        const spotlightSection = document.getElementById('country-spotlight-section');
        if (spotlightSection) {
            spotlightSection.style.display = 'block';
        }
    }
    
    // Check and display rate limit status
    function checkAndDisplayRateLimit() {
        const rateLimit = checkRateLimit();
        if (!rateLimit.allowed) {
            // Don't hide section - just hide buttons
            if (refreshBtn) {
                refreshBtn.style.display = 'none';
            }
            if (retryBtn) {
                retryBtn.style.display = 'none';
            }
            return false;
        }
        return true;
    }
    
    // Save spotlight data to localStorage
    function saveSpotlightData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (err) {
            console.error('Failed to save spotlight data:', err);
        }
    }
    
    // Load spotlight data from localStorage
    function loadSpotlightData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Failed to load spotlight data:', err);
            return null;
        }
    }
    
    // Restore spotlight from saved data
    function restoreSpotlight(savedData) {
        // First check rate limit - don't restore if limit reached
        const rateLimit = checkRateLimit();
        if (!rateLimit.allowed) {
            console.log('Rate limit reached - cannot restore spotlight');
            hideSpotlightSection();
            return false;
        }
        
        if (!savedData || !savedData.country) {
            console.log('No saved data or country found');
            return false;
        }
        
        // Validate required elements exist
        if (!countryFlag || !countryName || !aiResponse) {
            console.log('Required elements not found, cannot restore');
            return false;
        }
        
        currentCountry = savedData.country;
        
        // Update country display
        if (countryFlag) countryFlag.textContent = currentCountry.flag;
        if (countryName) countryName.textContent = currentCountry.name;
        
        // Restore images
        if (savedData.images) {
            if (savedData.images.flag) {
                loadImageIntoWrapper('flag-image-wrapper', savedData.images.flag);
            }
            if (savedData.images.culture1) {
                loadImageIntoWrapper('culture1-image-wrapper', savedData.images.culture1);
            }
            if (savedData.images.culture2) {
                loadImageIntoWrapper('culture2-image-wrapper', savedData.images.culture2);
            }
        }
        
        // Restore AI response
        if (savedData.aiResponse && aiResponse) {
            aiResponse.innerHTML = savedData.aiResponse;
        }
        
        // Show content
        if (spotlightLoading) spotlightLoading.style.display = 'none';
        if (spotlightContent) spotlightContent.style.display = 'block';
        if (aiThinking) aiThinking.style.display = 'none';
        if (spotlightError) spotlightError.style.display = 'none';
        
        // If spotlight is visible, play/resume country music
        if (isSpotlightVisible && currentCountry && countryMusicMap[currentCountry.name]) {
            saveBackgroundMusicState();
            pauseBackgroundMusic();
            playCountryMusic(currentCountry.name, true); // Try to resume from saved state
        }
        
        console.log('Successfully restored spotlight for:', currentCountry.name);
        return true;
    }
    
    // Load spotlight country and AI content
    async function loadSpotlight(forceNew = false) {
        try {
            // Prevent multiple simultaneous generations
            if (isGenerating) {
                console.log('Already generating, please wait...');
                return;
            }
            
            // If not forcing new, try to restore from saved data
            if (!forceNew && !isRestoring) {
                isRestoring = true; // Set flag to prevent multiple restore attempts
                const savedData = loadSpotlightData();
                console.log('Attempting to restore spotlight, savedData:', savedData ? 'exists' : 'none');
                
                // Check if saved data has all required content (country, AI response, AND all images)
                const hasAllImages = savedData && savedData.images && 
                    savedData.images.flag && 
                    savedData.images.culture1 && 
                    savedData.images.culture2;
                
                if (savedData && savedData.country && savedData.aiResponse && hasAllImages) {
                    const restored = restoreSpotlight(savedData);
                    if (restored) {
                        console.log('✅ Restored spotlight from saved data with all images - skipping API calls');
                        isRestoring = false;
                        updateButtonStates(); // Update button states after restore
                        return; // Exit early - don't generate new content
                    } else {
                        console.log('⚠️ Failed to restore spotlight, will generate new');
                    }
                } else {
                    if (savedData && savedData.country && savedData.aiResponse) {
                        console.log('⚠️ Saved data exists but images are missing - will restore text and generate images');
                        // Restore what we can (country and text), then generate missing images
                        const restored = restoreSpotlight(savedData);
                        if (restored) {
                            // Don't return - continue to generate missing images below
                            console.log('✅ Restored country and text, will generate missing images');
                        }
                    } else {
                        console.log('No saved data found or incomplete, will generate new');
                    }
                }
                isRestoring = false;
            } else if (forceNew) {
                console.log('Force new country requested');
                isRestoring = false;
            }
            
            // Check rate limit BEFORE attempting to generate
            const rateLimit = checkRateLimit();
            
            if (!rateLimit.allowed) {
                // Don't hide the section - let them view their last generation
                // Just hide the buttons and show a message
                if (spotlightError) {
                    spotlightLoading.style.display = 'none';
                    spotlightContent.style.display = 'block'; // Keep content visible
                    spotlightError.style.display = 'block';
                    const errorMsg = spotlightError.querySelector('p');
                    if (errorMsg) {
                        errorMsg.textContent = `⚠️ You've reached your daily limit of ${RATE_LIMIT_COUNT} spotlights. You can still view your last generation! Come back tomorrow for more.`;
                    }
                }
                
                // Hide generation buttons
                if (refreshBtn) {
                    refreshBtn.style.display = 'none';
                }
                if (retryBtn) {
                    retryBtn.style.display = 'none';
                }
                
                updateButtonStates();
                return;
            }
            
            // Set generating flag
            isGenerating = true;
            updateButtonStates();
            
            // Show loading state
            spotlightLoading.style.display = 'block';
            spotlightContent.style.display = 'none';
            spotlightError.style.display = 'none';
            
            // Ensure images container is visible (in case it was hidden)
            const imagesContainer = document.getElementById('spotlight-images-container');
            if (imagesContainer) {
                imagesContainer.style.display = 'block';
                const imagesGrid = imagesContainer.querySelector('.spotlight-images-grid');
                if (imagesGrid) {
                    imagesGrid.style.display = 'flex';
                }
            }
            
            // Stop any existing country music before generating new country
            stopCountryMusic();
            
            // Get random country, excluding the previous one
            const previousCountry = currentCountry;
            // Also check saved data to exclude the last generated country
            const savedData = loadSpotlightData();
            const lastGeneratedCountry = savedData && savedData.country ? savedData.country : previousCountry;
            currentCountry = getRandomCountry(lastGeneratedCountry);
            
            // Update country display
            countryFlag.textContent = currentCountry.flag;
            countryName.textContent = currentCountry.name;
            
            // If spotlight is visible, switch to new country's music
            if (isSpotlightVisible && currentCountry && countryMusicMap[currentCountry.name]) {
                // Stop previous country's music completely
                if (spotlightMusic) {
                    spotlightMusic.pause();
                    spotlightMusic.currentTime = 0;
                    spotlightMusic = null;
                    window.spotlightMusic = null; // Clear window reference
                }
                playCountryMusic(currentCountry.name, false); // New country, start fresh
            }
            
            // Show content area
            spotlightLoading.style.display = 'none';
            spotlightContent.style.display = 'block';
            
            // Ensure images container is visible when content is shown (reuse existing variable)
            if (imagesContainer) {
                imagesContainer.style.display = 'block';
                const imagesGrid = imagesContainer.querySelector('.spotlight-images-grid');
                if (imagesGrid) {
                    imagesGrid.style.display = 'flex';
                }
                
                // Ensure all image wrappers are visible
                const wrappers = imagesContainer.querySelectorAll('.spotlight-image-wrapper');
                wrappers.forEach(wrapper => {
                    if (wrapper.style.display === 'none') {
                        wrapper.style.display = 'block';
                    }
                });
            }
            
            // Check if we already have AI response (from restore)
            // If forceNew is true, always regenerate
            const hasExistingAIResponse = !forceNew && aiResponse && aiResponse.innerHTML && aiResponse.innerHTML.trim() !== '';
            if (!hasExistingAIResponse) {
                aiThinking.style.display = 'block';
                aiResponse.innerHTML = '';
            } else {
                aiThinking.style.display = 'none';
            }
            
            // Check which images are missing and need to be generated
            const flagWrapper = document.getElementById('flag-image-wrapper');
            const culture1Wrapper = document.getElementById('culture1-image-wrapper');
            const culture2Wrapper = document.getElementById('culture2-image-wrapper');
            
            // If forceNew is true, clear existing images and force regeneration
            if (forceNew) {
                console.log('[Spotlight] Force new country - clearing existing images and content');
                if (flagWrapper) flagWrapper.innerHTML = '';
                if (culture1Wrapper) culture1Wrapper.innerHTML = '';
                if (culture2Wrapper) culture2Wrapper.innerHTML = '';
            }
            
            // Check if images exist and are valid (not just placeholders)
            // If forceNew is true, always treat as missing (force regeneration)
            const flagImg = flagWrapper && flagWrapper.querySelector('img');
            const culture1Img = culture1Wrapper && culture1Wrapper.querySelector('img');
            const culture2Img = culture2Wrapper && culture2Wrapper.querySelector('img');
            
            const hasFlagImage = !forceNew && flagImg && flagImg.src && !flagImg.src.includes('data:') && flagImg.complete && !flagImg.src.includes('placeholder');
            const hasCulture1Image = !forceNew && culture1Img && culture1Img.src && !culture1Img.src.includes('data:') && culture1Img.complete && !culture1Img.src.includes('placeholder');
            const hasCulture2Image = !forceNew && culture2Img && culture2Img.src && !culture2Img.src.includes('data:') && culture2Img.complete && !culture2Img.src.includes('placeholder');
            
            console.log('Image status check:', {
                forceNew: forceNew,
                flag: hasFlagImage ? 'exists' : 'missing',
                culture1: hasCulture1Image ? 'exists' : 'missing',
                culture2: hasCulture2Image ? 'exists' : 'missing',
                aiResponse: hasExistingAIResponse ? 'exists' : 'missing'
            });
            
            // Reset placeholders for missing images (or all if forceNew)
            // When forceNew is true, we already cleared the wrappers above, so set placeholders
            if (!hasFlagImage && flagWrapper) {
                // Set placeholder if wrapper is empty or doesn't have a valid image
                const existingImg = flagWrapper.querySelector('img');
                if (!existingImg || !existingImg.src || existingImg.src.includes('placeholder')) {
                    flagWrapper.innerHTML = '<div class="image-loading-placeholder"><div class="image-spinner"></div><p>Generating...</p></div>';
                } else {
                    console.log('[Spotlight] Flag image wrapper already has an image, skipping placeholder');
                }
            }
            if (!hasCulture1Image && culture1Wrapper) {
                const existingImg = culture1Wrapper.querySelector('img');
                if (!existingImg || !existingImg.src || existingImg.src.includes('placeholder')) {
                    culture1Wrapper.innerHTML = '<div class="image-loading-placeholder"><div class="image-spinner"></div><p>Generating...</p></div>';
                } else {
                    console.log('[Spotlight] Culture1 image wrapper already has an image, skipping placeholder');
                }
            }
            if (!hasCulture2Image && culture2Wrapper) {
                const existingImg = culture2Wrapper.querySelector('img');
                if (!existingImg || !existingImg.src || existingImg.src.includes('placeholder')) {
                    culture2Wrapper.innerHTML = '<div class="image-loading-placeholder"><div class="image-spinner"></div><p>Generating...</p></div>';
                } else {
                    console.log('[Spotlight] Culture2 image wrapper already has an image, skipping placeholder');
                }
            }
            
            // Check if mobile - only generate culture images on mobile
            const isMobile = window.innerWidth <= 768;
            
            // Generate only missing images in parallel
            const imagePromises = [];
            
            // Flag image - skip on mobile
            if (!isMobile) {
            if (!hasFlagImage) {
                    console.log('[Spotlight] Generating flag image for', currentCountry.name);
                    // More specific prompt to avoid content policy violations - use descriptive, safe language
                    const flagPrompt = `A beautiful photograph of the official national flag of ${currentCountry.name}, waving gently in a clear blue sky, high quality and detailed`;
                imagePromises.push(
                        generateImage(flagPrompt).then(url => {
                            if (url) {
                                console.log('[Spotlight] ✅ Flag image generated successfully!');
                                console.log('[Spotlight] Full URL:', url);
                                console.log('[Spotlight] URL length:', url.length);
                                console.log('[Spotlight] URL starts with http:', url.startsWith('http'));
                        loadImageIntoWrapper('flag-image-wrapper', url);
                            } else {
                                // Don't add to retry queue - generateImage already handled retries
                                // Only server errors should be retried, not client errors (400)
                                loadImageIntoWrapper('flag-image-wrapper', null);
                            }
                        return { type: 'flag', url };
                    }).catch(error => {
                            // Suppress error logs for 400 errors to reduce console noise
                            if (error.status !== 400) {
                                console.error('[Spotlight] ❌ Error generating flag image:', error);
                                console.error('[Spotlight] Error details:', {
                                    message: error.message,
                                    stack: error.stack?.split('\n').slice(0, 3).join('\n')
                                });
                            }
                        loadImageIntoWrapper('flag-image-wrapper', null);
                            // Only add to retry queue if it's not a 400 error (client errors shouldn't be retried)
                            if (error.status !== 400) {
                                failedImageRequests.set(flagPrompt, {
                                    wrapperId: 'flag-image-wrapper',
                                    retryCount: 0,
                                    lastAttempt: Date.now(),
                                    status: error.status || null
                                });
                            }
                        return { type: 'flag', url: null };
                    })
                );
            } else {
                // Image already exists, return it
                console.log('Flag image already exists, skipping generation');
                const existingUrl = flagWrapper.querySelector('img').src;
                imagePromises.push(Promise.resolve({ type: 'flag', url: existingUrl }));
                }
            } else {
                // On mobile, hide flag wrapper and skip generation
                if (flagWrapper) {
                    flagWrapper.style.display = 'none';
                }
                console.log('[Spotlight] Mobile detected - skipping flag image generation');
            }
            
            if (!hasCulture1Image) {
                console.log('[Spotlight] Generating culture1 image for', currentCountry.name);
                // More specific prompt to avoid content policy violations - focus on positive cultural aspects
                const culture1Prompt = `A vibrant and colorful photograph showcasing the beautiful traditional culture and architecture of ${currentCountry.name}, featuring traditional clothing and scenic landscapes`;
                imagePromises.push(
                    generateImage(culture1Prompt).then(url => {
                        if (url) {
                            console.log('[Spotlight] ✅ Culture1 image generated successfully!');
                            console.log('[Spotlight] Full URL:', url);
                        loadImageIntoWrapper('culture1-image-wrapper', url);
                        } else {
                            // Don't add to retry queue - generateImage already handled retries
                            loadImageIntoWrapper('culture1-image-wrapper', null);
                        }
                        return { type: 'culture1', url };
                    }).catch(error => {
                        // Suppress error logs for 400 errors to reduce console noise
                        if (error.status !== 400) {
                            console.error('[Spotlight] ❌ Error generating culture1 image:', error);
                            console.error('[Spotlight] Error details:', {
                                message: error.message,
                                stack: error.stack?.split('\n').slice(0, 3).join('\n')
                            });
                        }
                        loadImageIntoWrapper('culture1-image-wrapper', null);
                        // Only add to retry queue if it's not a 400 error (client errors shouldn't be retried)
                        if (error.status !== 400) {
                            failedImageRequests.set(culture1Prompt, {
                                wrapperId: 'culture1-image-wrapper',
                                retryCount: 0,
                                lastAttempt: Date.now(),
                                status: error.status || null
                            });
                        }
                        return { type: 'culture1', url: null };
                    })
                );
            } else {
                // Image already exists, return it
                console.log('Culture1 image already exists, skipping generation');
                const existingUrl = culture1Wrapper.querySelector('img').src;
                imagePromises.push(Promise.resolve({ type: 'culture1', url: existingUrl }));
            }
            
            if (!hasCulture2Image) {
                console.log('[Spotlight] Generating culture2 image for', currentCountry.name);
                // More specific prompt to avoid content policy violations - emphasize positive cultural elements
                const culture2Prompt = `A beautiful and colorful photograph showcasing cultural festivals, traditional cuisine, and artistic traditions from ${currentCountry.name}, highlighting the rich cultural heritage`;
                imagePromises.push(
                    generateImage(culture2Prompt).then(url => {
                        if (url) {
                            console.log('[Spotlight] ✅ Culture2 image generated successfully!');
                            console.log('[Spotlight] Full URL:', url);
                        loadImageIntoWrapper('culture2-image-wrapper', url);
                        } else {
                            // Don't add to retry queue - generateImage already handled retries
                            loadImageIntoWrapper('culture2-image-wrapper', null);
                        }
                        return { type: 'culture2', url };
                    }).catch(error => {
                        // Suppress error logs for 400 errors to reduce console noise
                        if (error.status !== 400) {
                            console.error('[Spotlight] ❌ Error generating culture2 image:', error);
                            console.error('[Spotlight] Error details:', {
                                message: error.message,
                                stack: error.stack?.split('\n').slice(0, 3).join('\n')
                            });
                        }
                        loadImageIntoWrapper('culture2-image-wrapper', null);
                        // Only add to retry queue if it's not a 400 error (client errors shouldn't be retried)
                        if (error.status !== 400) {
                            failedImageRequests.set(culture2Prompt, {
                                wrapperId: 'culture2-image-wrapper',
                                retryCount: 0,
                                lastAttempt: Date.now(),
                                status: error.status || null
                            });
                        }
                        return { type: 'culture2', url: null };
                    })
                );
            } else {
                // Image already exists, return it
                console.log('Culture2 image already exists, skipping generation');
                const existingUrl = culture2Wrapper.querySelector('img').src;
                imagePromises.push(Promise.resolve({ type: 'culture2', url: existingUrl }));
            }
            
            // Call AI API for text content (only if we don't already have it)
            // Show cached text immediately if available, then update async
            let textResponse;
            if (hasExistingAIResponse) {
                // Already have text, use it
                console.log('Using existing AI response, skipping text generation');
                textResponse = Promise.resolve(aiResponse.innerHTML);
            } else {
                // Show loading state but don't block
                if (aiResponse) {
                    aiResponse.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7);">🔍 Searching for breaking news about ' + currentCountry.name + '...</p>';
                }
                
                // FIRST: Search for breaking news about the country
                const searchQuery = `breaking news ${currentCountry.name} today latest 2025`;
                console.log('[Spotlight] 🔍 Searching for breaking news:', searchQuery);
                
                const searchPromise = fetch('/.netlify/functions/search-web', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: searchQuery
                    })
                }).then(response => {
                    if (!response.ok) {
                        console.warn('[Spotlight] Web search failed:', response.status);
                        return { results: [] };
                    }
                    return response.json();
                }).catch(error => {
                    console.error('[Spotlight] Web search error:', error);
                    return { results: [] };
                });
                
                // Wait for search results, then build prompt with real-time news
                textResponse = searchPromise.then(searchData => {
                    const searchResults = searchData.results || [];
                    console.log('[Spotlight] ✅ Found', searchResults.length, 'search results');
                    
                    // Build breaking news context from search results
                    let breakingNewsContext = '';
                    if (searchResults.length > 0) {
                        breakingNewsContext = '\n\n**BREAKING NEWS CONTEXT (Real-time information from web search):**\n';
                        searchResults.slice(0, 5).forEach((result, index) => {
                            breakingNewsContext += `${index + 1}. **${result.title || 'News Item'}**\n`;
                            breakingNewsContext += `   ${result.snippet || 'No details available'}\n`;
                            if (result.url) {
                                breakingNewsContext += `   Source: ${result.url}\n`;
                            }
                            breakingNewsContext += '\n';
                        });
                    } else {
                        breakingNewsContext = '\n\n**Note:** Real-time web search did not return specific breaking news results. Use your knowledge to provide the most recent and relevant information available.';
                    }
                    
                    const textPrompt = `You are a breaking news expert. Provide a spotlight on ${currentCountry.name} focusing on REAL, CURRENT breaking news and recent developments. 

CRITICAL REQUIREMENTS:
- Focus on BREAKING NEWS and CURRENT EVENTS (not general culture or history)
- Use the web search results provided below as your PRIMARY source
- If search results contain breaking news, prioritize and highlight those stories
- Include specific details: dates, locations, names, and what makes it newsworthy
- If no breaking news is found, provide the MOST RECENT significant developments you know about
- Write in THREE sections:

1. **🔥 Breaking News** - Current breaking news stories, recent events, or major developments happening RIGHT NOW or in the past few days/weeks
2. **📰 Recent Developments** - Important recent news, policy changes, or significant events from the past few months
3. **🌍 Current Context** - What's happening in ${currentCountry.name} right now that people should know about

${breakingNewsContext}

IMPORTANT FORMATTING:
- Use proper markdown formatting with ## for section headers
- Keep it engaging and informative, around 400-500 words total
- Do NOT use ## or ** in the middle of paragraphs - only for section headers
- Focus on REAL, VERIFIED breaking news and current events
- Include specific dates, locations, and details when available
- If you reference information from search results, mention it naturally in context
- NEVER make up or invent breaking news events
- If no real breaking news is available, say so clearly rather than fabricating stories`;
                    
                    // Update loading message
                    if (aiResponse) {
                        aiResponse.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7);">🤖 Generating breaking news spotlight...</p>';
                    }
                    
                    // Now call the AI with the enhanced prompt
                    return fetch('/.netlify/functions/noteworthy-chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: textPrompt,
                            chatHistory: []
                        })
                    }).then(response => {
                        if (!response.ok) {
                            throw new Error(`API error: ${response.status}`);
                        }
                        return response.json();
                    }).then(data => {
                        if (data.reply) {
                            aiThinking.style.display = 'none';
                            const formattedResponse = formatAIResponse(data.reply);
                            aiResponse.innerHTML = formattedResponse;
                            return formattedResponse;
                        } else {
                            throw new Error('No reply from AI');
                        }
                    }).catch(error => {
                        // Suppress 429 (rate limit) errors - expected behavior
                        const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');
                        if (!isRateLimit) {
                            console.error('[Spotlight] Error fetching AI text content:', error);
                        }
                        aiThinking.style.display = 'none';
                        if (aiResponse) {
                            if (isRateLimit) {
                                aiResponse.innerHTML = '<p style="color: rgba(255, 200, 100, 0.9);">⚠️ Rate limit reached. Please try again in a moment.</p>';
                            } else {
                                aiResponse.innerHTML = '<p style="color: rgba(255, 100, 100, 0.9);">⚠️ Unable to load breaking news. Please try again later.</p>';
                            }
                        }
                        return ''; // Return empty string so Promise.allSettled doesn't fail
                    });
                }); // Close the searchPromise.then() chain
            }
            
            // Don't wait - let images and text load asynchronously
            // This allows the UI to be interactive immediately
            // Save data as each piece completes
            const allPromises = [...imagePromises, textResponse];
            
            // Clear generating flag immediately after starting promises
            // This prevents blocking the UI while still allowing the promises to complete
            // The flag was set to prevent duplicate clicks, but we clear it here so UI stays responsive
            // Note: We still prevent duplicate clicks via the early return check at function start
            isGenerating = false;
            updateButtonStates();
            
            // Process results as they complete (non-blocking - don't await)
            Promise.allSettled(allPromises).then(settledResults => {
            // Process settled results
            const results = settledResults.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    // Handle rejected promises
                    console.error(`Promise ${index} rejected:`, result.reason);
                    // If it's an image promise (first 3), return null
                    if (index < 3) {
                        const imageTypes = ['flag', 'culture1', 'culture2'];
                        loadImageIntoWrapper(`${imageTypes[index]}-image-wrapper`, null);
                        return { type: imageTypes[index], url: null };
                    }
                    // If it's the text response, return empty string
                    return '';
                }
            });
            
            // Collect image URLs
            const images = {};
            results.forEach(result => {
                if (result && result.type && result.url) {
                    images[result.type] = result.url;
                }
            });
            
            // Get AI response HTML (last result should be the formatted response)
            const aiResponseHtml = typeof results[results.length - 1] === 'string' ? results[results.length - 1] : aiResponse.innerHTML;
            
            // Save to localStorage
            const dataToSave = {
                country: currentCountry,
                images: images,
                aiResponse: aiResponseHtml,
                timestamp: Date.now()
            };
            
            console.log('Saving spotlight data:', {
                country: currentCountry.name,
                hasImages: Object.keys(images).length > 0,
                hasAiResponse: !!aiResponseHtml,
                aiResponseLength: aiResponseHtml ? aiResponseHtml.length : 0
            });
            
            saveSpotlightData(dataToSave);
            
                   // Increment rate limit counter after successful generation
                   incrementRateLimit();
                   
                   // Set 15-second cooldown
                   cooldownUntil = Date.now() + (15 * 1000);
                   startCooldownTimer();
                   
                   // Check if we've reached the limit - hide button but keep content visible
                   const newRateLimit = checkRateLimit();
                   if (!newRateLimit.allowed) {
                       // Hide the generation button but keep the content visible
                       if (refreshBtn) {
                           refreshBtn.style.display = 'none';
                       }
                       if (retryBtn) {
                           retryBtn.style.display = 'none';
                       }
                       // Don't hide the section - let them view their last generation
                   }
            }).catch(err => {
                console.error('[Spotlight] Error processing results:', err);
                // Ensure flag is cleared on error
                isGenerating = false;
                updateButtonStates();
            });
            
        } catch (error) {
            console.error('Spotlight error:', error);
            aiThinking.style.display = 'none';
            // Don't hide content on error, just show error message
            if (aiResponse) {
                aiResponse.innerHTML = '<p style="color: rgba(255, 100, 100, 0.9);">⚠️ Unable to load all content. Some images may be missing.</p>';
            }
            // Clear generating flag on error
            isGenerating = false;
            updateButtonStates();
        }
    }
    
    // Update remaining generations display
    function updateRemainingDisplay() {
        if (!remainingDisplay) return;
        
        const rateLimit = checkRateLimit();
        const remainingText = remainingDisplay.querySelector('.remaining-text');
        
        if (!remainingText) return;
        
        if (!rateLimit.allowed) {
            remainingText.textContent = '❌ Daily limit reached - Come back tomorrow!';
            remainingDisplay.style.background = 'rgba(231, 76, 60, 0.2)';
            remainingDisplay.style.borderColor = 'rgba(231, 76, 60, 0.4)';
        } else {
            const remaining = rateLimit.remaining;
            if (remaining === RATE_LIMIT_COUNT) {
                remainingText.textContent = `✨ ${remaining} generation${remaining !== 1 ? 's' : ''} available today`;
            } else if (remaining > 0) {
                remainingText.textContent = `✨ ${remaining} generation${remaining !== 1 ? 's' : ''} remaining today`;
            } else {
                remainingText.textContent = '❌ No generations remaining today';
            }
            remainingDisplay.style.background = 'rgba(74, 144, 226, 0.2)';
            remainingDisplay.style.borderColor = 'rgba(74, 144, 226, 0.4)';
        }
    }
    
    // Enable/disable buttons based on state
    function updateButtonStates() {
        const now = Date.now();
        const rateLimit = checkRateLimit();
        const inCooldown = now < cooldownUntil;
        const disabled = isGenerating || inCooldown || !rateLimit.allowed;
        
        // Update remaining display
        updateRemainingDisplay();
        
        if (refreshBtn) {
            refreshBtn.disabled = disabled;
            if (disabled) {
                refreshBtn.style.opacity = '0.5';
                refreshBtn.style.cursor = 'not-allowed';
                if (inCooldown) {
                    const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
                    refreshBtn.textContent = `⏳ Wait ${secondsLeft}s`;
                } else if (!rateLimit.allowed) {
                    refreshBtn.textContent = '❌ Daily Limit Reached';
                } else if (isGenerating) {
                    refreshBtn.textContent = '⏳ Generating...';
                } else {
                    refreshBtn.innerHTML = '<span>🔄</span> New Country';
                }
            } else {
                refreshBtn.style.opacity = '1';
                refreshBtn.style.cursor = 'pointer';
                refreshBtn.innerHTML = '<span>🔄</span> New Country';
            }
        }
        
        if (retryBtn) {
            retryBtn.disabled = disabled;
            if (disabled) {
                retryBtn.style.opacity = '0.5';
                retryBtn.style.cursor = 'not-allowed';
                if (inCooldown) {
                    const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
                    retryBtn.textContent = `⏳ Wait ${secondsLeft}s`;
                } else if (!rateLimit.allowed) {
                    retryBtn.textContent = '❌ Daily Limit Reached';
                } else if (isGenerating) {
                    retryBtn.textContent = '⏳ Generating...';
                } else {
                    retryBtn.textContent = 'Retry';
                }
            } else {
                retryBtn.style.opacity = '1';
                retryBtn.style.cursor = 'pointer';
                retryBtn.textContent = 'Retry';
            }
        }
    }
    
    // Update button states periodically during cooldown
    let cooldownInterval = null;
    function startCooldownTimer() {
        if (cooldownInterval) clearInterval(cooldownInterval);
        cooldownInterval = setInterval(() => {
            const now = Date.now();
            if (now >= cooldownUntil) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
            }
            updateButtonStates();
        }, 1000); // Update every second
    }
    
    // Event listeners
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Check if already generating
            if (isGenerating) return;
            
            // Check cooldown
            const now = Date.now();
            if (now < cooldownUntil) {
                const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
                alert(`Please wait ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''} before generating another country.`);
                return;
            }
            
            // Check rate limit before allowing new country
            const rateLimit = checkRateLimit();
            if (!rateLimit.allowed) {
                // Hide buttons but keep content visible
                if (refreshBtn) {
                    refreshBtn.style.display = 'none';
                }
                if (retryBtn) {
                    retryBtn.style.display = 'none';
                }
                alert(`You've reached your daily limit of ${RATE_LIMIT_COUNT} spotlights. You can still view your last generation! Come back tomorrow for more.`);
                updateButtonStates();
                return;
            }
            
            loadSpotlight(true); // Force new country
        });
    }
    
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            // Check if already generating
            if (isGenerating) return;
            
            // Check cooldown
            const now = Date.now();
            if (now < cooldownUntil) {
                const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
                alert(`Please wait ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''} before generating another country.`);
                return;
            }
            
            // Check rate limit before allowing new country
            const rateLimit = checkRateLimit();
            if (!rateLimit.allowed) {
                // Hide buttons but keep content visible
                if (refreshBtn) {
                    refreshBtn.style.display = 'none';
                }
                if (retryBtn) {
                    retryBtn.style.display = 'none';
                }
                alert(`You've reached your daily limit of ${RATE_LIMIT_COUNT} spotlights. You can still view your last generation! Come back tomorrow for more.`);
                updateButtonStates();
                return;
            }
            
            loadSpotlight(true); // Force new country
        });
    }
    
    // Track if spotlight has been loaded
    let spotlightLoaded = false;
    
    // Setup visibility observer and load spotlight (restore or generate new)
    function initSpotlight() {
        // Wait a bit to ensure all DOM elements are ready
        setTimeout(() => {
            const spotlightSection = document.getElementById('country-spotlight-section');
            if (!spotlightSection) {
                console.warn('Country spotlight section not found');
                return;
            }
            
            // Initialize button states and remaining display
            updateButtonStates();
            updateRemainingDisplay();
            
            // Set up the visibility observer for music management
            setupSpotlightVisibilityObserver();
            
            // Function to load spotlight
            const triggerLoadSpotlight = () => {
                if (spotlightLoaded) return; // Prevent multiple loads
                        spotlightLoaded = true;
                console.log('Country spotlight section is visible - loading spotlight');
                        
                        // Check rate limit - hide buttons if limit reached, but keep section visible
                        const rateLimit = checkRateLimit();
                        if (!rateLimit.allowed) {
                            console.log('Daily spotlight limit reached - hiding buttons but keeping content visible');
                            // Hide generation buttons
                            if (refreshBtn) {
                                refreshBtn.style.display = 'none';
                            }
                            if (retryBtn) {
                                retryBtn.style.display = 'none';
                            }
                            updateButtonStates(); // Update button states
                            updateRemainingDisplay(); // Update remaining display
                            // Still load/restore the last generation so they can view it
                            loadSpotlight(false); // Try to restore last generation
                        } else {
                            // Load spotlight (restore or generate new)
                            loadSpotlight(false); // Try to restore, generate new if needed
                        }
            };
            
            // Check if section is already visible on page load
            const rect = spotlightSection.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            const isSignificantlyVisible = rect.top < window.innerHeight * 0.7 && rect.bottom > window.innerHeight * 0.3;
            
            if (isSignificantlyVisible) {
                // Section is already visible - load immediately
                console.log('Spotlight section already visible on page load - loading immediately');
                triggerLoadSpotlight();
            } else {
                // Set up intersection observer to load spotlight when it becomes visible
                const loadObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        // Only load once when section becomes visible (at least 30% visible)
                        if (entry.isIntersecting && entry.intersectionRatio >= 0.3 && !spotlightLoaded) {
                            triggerLoadSpotlight();
                        // Disconnect observer after first load
                        loadObserver.disconnect();
                    }
                });
            }, {
                threshold: [0.3],
                rootMargin: '0px'
            });
            
            // Start observing the spotlight section
            loadObserver.observe(spotlightSection);
            }
        }, 100);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSpotlight);
    } else {
        initSpotlight();
    }
})();