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
        ANIMATION_RESET_DELATION: 8000
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

// Authentication System
class AuthSystem {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindAuthEvents();
        this.checkAuthStatus();
    }

    bindAuthEvents() {
        const signinBtn = document.getElementById("signinBtn");
        const signupBtn = document.getElementById("signupBtn");
        const closeAuth = document.getElementById("closeAuth");
        const authModal = document.getElementById("authModal");
        const authTabs = document.querySelectorAll(".auth-tab");
        const signinForm = document.getElementById("signinForm");
        const signupForm = document.getElementById("signupForm");

        if (signinBtn) {
            signinBtn.addEventListener("click", () => {
                this.showAuthModal("signin");
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener("click", () => {
                this.showAuthModal("signup");
            });
        }

        if (closeAuth) {
            closeAuth.addEventListener("click", () => {
                this.hideAuthModal();
            });
        }

        if (authModal) {
            authModal.addEventListener("click", (e) => {
                if (e.target === authModal) {
                    this.hideAuthModal();
                }
            });
        }

        // Tab switching
        if (authTabs.length > 0) {
            authTabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    this.switchAuthTab(tab.dataset.tab);
                });
            });
        }

        // Form submissions
        if (signinForm) {
            signinForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleSignin(e.target);
            });
        }

        if (signupForm) {
            signupForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleSignup(e.target);
            });
        }
    }

    showAuthModal(tab = "signin") {
        const authModal = document.getElementById("authModal");
        if (authModal) {
            authModal.style.display = "flex";
            this.switchAuthTab(tab);
        }
    }

    hideAuthModal() {
        const authModal = document.getElementById("authModal");
        if (authModal) {
            authModal.style.display = "none";
        }
    }

    switchAuthTab(tab) {
        const authTabs = document.querySelectorAll(".auth-tab");
        const signinForm = document.getElementById("signinForm");
        const signupForm = document.getElementById("signupForm");

        authTabs.forEach(t => t.classList.remove("active"));
        const activeTab = document.querySelector(`[data-tab="${tab}"]`);
        if (activeTab) activeTab.classList.add("active");

        if (tab === "signin") {
            if (signinForm) signinForm.style.display = "flex";
            if (signupForm) signupForm.style.display = "none";
        } else {
            if (signinForm) signinForm.style.display = "none";
            if (signupForm) signupForm.style.display = "flex";
        }
    }

    handleSignin(form) {
        const email = form.querySelector("input[type=email]").value;
        const password = form.querySelector("input[type=password]").value;

        // Enhanced validation using new validator
        if (!Validator.isValidEmail(email)) {
            this.showNotification("Please enter a valid email address", "error");
            return;
        }

        if (!Validator.isValidPassword(password)) {
            this.showNotification("Password must be at least 8 characters with uppercase, lowercase, and number", "error");
            return;
        }

        // Simulate authentication
        this.isAuthenticated = true;
        this.currentUser = { email };
        this.updateAuthUI();
        this.hideAuthModal();
        
        // Show success message
        this.showNotification("Successfully signed in!", "success");
    }

    handleSignup(form) {
        const fullName = form.querySelector("input[type=text]").value;
        const email = form.querySelector("input[type=email]").value;
        const password = form.querySelector("input[type=password]").value;
        const confirmPassword = form.querySelector("input[type=password]:last-of-type").value;

        // Enhanced validation using new validator
        if (!Validator.isValidName(fullName)) {
            this.showNotification("Please enter a valid name (2-50 characters)", "error");
            return;
        }

        if (!Validator.isValidEmail(email)) {
            this.showNotification("Please enter a valid email address", "error");
            return;
        }

        if (!Validator.isValidPassword(password)) {
            this.showNotification("Password must be at least 8 characters with uppercase, lowercase, and number", "error");
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification("Passwords do not match", "error");
            return;
        }

        // Simulate registration
        this.isAuthenticated = true;
        this.currentUser = { fullName, email };
        this.updateAuthUI();
        this.hideAuthModal();
        
        // Show success message
        this.showNotification("Successfully signed up!", "success");
    }

    updateAuthUI() {
        const signinBtn = document.getElementById("signinBtn");
        const signupBtn = document.getElementById("signupBtn");

        if (this.isAuthenticated) {
            if (signinBtn) signinBtn.textContent = `Hi, ${this.currentUser.fullName || this.currentUser.email}`;
            if (signupBtn) signupBtn.textContent = "Sign Out";
            
            // Update button event listeners
            if (signupBtn) {
                signupBtn.onclick = () => this.signOut();
            }
        } else {
            if (signinBtn) signinBtn.textContent = "Sign In";
            if (signupBtn) signupBtn.textContent = "Sign Up";
            
            // Restore original event listeners
            if (signupBtn) {
                signupBtn.onclick = () => this.showAuthModal("signup");
            }
        }
    }

    signOut() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.updateAuthUI();
        this.showNotification("Successfully signed out!", "info");
    }

    checkAuthStatus() {
        // Check if user was previously authenticated
        const savedUser = localStorage.getItem("noteworthy_user");
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.isAuthenticated = true;
                this.updateAuthUI();
            } catch (e) {
                localStorage.removeItem("noteworthy_user");
            }
        }
    }

    showNotification(message, type = "info") {
        const notification = document.createElement("div");
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

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
                e.preventDefault();
                e.stopPropagation();
                
                const targetSection = link.getAttribute("href").substring(1);
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
        this.currentQuestion = 0;
        this.gameState = 'start'; // start, playing, feedback, gameOver
        this.difficulty = 'easy';
        this.timeLimit = 30;
        this.timer = null;
        this.timeLeft = 30;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.currentMusicIndex = 0;
        this.isPaused = false;
        this.pauseTimeLeft = 0;
        this.notificationShown = false;
        
        // Create and shuffle questions
        this.questions = this.createAndShuffleQuestions();
        console.log('Questions created:', this.questions.length);
        console.log('First question:', this.questions[0]);
        
        this.initializeGame();
    }
    
    createAndShuffleQuestions() {
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
                headline: "ACTIVE SHOOTER at U.S. Army base Fort Stewart in Georgia. At least four people have been shot near Building 8420 (2nd Brigade). Reports indicate there may be two shooters. The base is on lockdown, and the scene is being treated as a mass casualty event.",
                source: "Noteworthy News",
                isFactual: true,
                explanation: "This is factual breaking news from Noteworthy News. Military base incidents are verified through official military sources and law enforcement.",
                tips: "Breaking news about military incidents should be verified through official military sources and law enforcement agencies.",
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
            }
        ];
        
        // Shuffle the questions array using Fisher-Yates algorithm
        return this.shuffleArray(allQuestions);
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
        this.initTheme();
        this.initLogoAnimation(); // Initialize logo animation with puzzle piece sound
        this.showStartScreen();
        
        // Add user interaction listener to start music
        const startMusicOnInteraction = () => {
            if (!this.isMusicPlaying && this.musicEnabled) {
                this.startBackgroundMusic();
            }
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
        };
        
        document.addEventListener('click', startMusicOnInteraction);
        document.addEventListener('touchstart', startMusicOnInteraction);
        
        // Show dark mode notification after a delay
        setTimeout(() => {
            this.showDarkModeNotification();
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
        document.getElementById('howToPlayToggleBtn').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.toggleHowToPlaySidebar();
        });
        document.getElementById('howToPlayToggle').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.toggleHowToPlaySidebar();
        });
        
        // Sound toggle functionality
        document.getElementById('soundToggleBtn').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.toggleSound();
        });
        
        // Music toggle functionality
        document.getElementById('musicToggleBtn').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.toggleMusic();
        });
        
        // Theme toggle functionality
        document.getElementById('themeToggleBtn').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.toggleTheme();
        });
        
        // Pause toggle functionality
        document.getElementById('pauseToggleBtn').addEventListener('click', () => {
            this.playSound('button', 'toggle');
            this.togglePause();
        });
        
        // Resume button functionality
        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.playSound('button', 'navigation');
            this.togglePause();
        });
        
        // Add hover sounds to all buttons
        this.setupHoverSounds();
    }
    
    setupHoverSounds() {
        // Get all buttons and add hover sound effects
        const buttons = document.querySelectorAll('.btn, .tips-toggle-btn, .how-to-play-toggle-btn, .sound-toggle-btn, .music-toggle-btn, .theme-toggle-btn, .pause-toggle-btn, .sidebar-toggle');
        
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
                this.updateDifficultyDisplay();
                document.body.removeChild(modal);
            });
            
            // Add hover sound to modal buttons
            btn.addEventListener('mouseenter', () => {
                this.playSound('hover');
            });
        });
        
        modal.querySelector('#closeModal').addEventListener('click', () => {
            this.playSound('button');
            document.body.removeChild(modal);
        });
        
        // Add hover sound to close button
        modal.querySelector('#closeModal').addEventListener('mouseenter', () => {
            this.playSound('hover');
        });
    }
    
    updateDifficultyDisplay() {
        const difficultyNames = {
            'easy': 'Easy',
            'medium': 'Medium', 
            'hard': 'Hard'
        };
        document.getElementById('currentDifficulty').textContent = difficultyNames[this.difficulty];
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
        
        this.hideAllScreens();
        console.log('Screens hidden');
        
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
    }
    
    showQuestion() {
        console.log('showQuestion called, currentQuestion:', this.currentQuestion);
        console.log('Questions array length:', this.questions.length);
        
        if (this.currentQuestion >= this.questions.length) {
            console.log('Game over - no more questions');
            this.endGame();
            return;
        }
        
        const question = this.questions[this.currentQuestion];
        console.log('Showing question:', question.headline);
        
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
        this.playSound('timer');
        clearInterval(this.timer);
        this.checkAnswer(null); // null means time ran out
    }
    
    checkAnswer(userAnswer) {
        clearInterval(this.timer);
        
        const question = this.questions[this.currentQuestion];
        const isCorrect = userAnswer === question.isFactual;
        const timeBonus = userAnswer !== null ? Math.floor(this.timeLeft / 2) : 0;
        
        // Disable buttons during feedback
        document.getElementById('factBtn').disabled = true;
        document.getElementById('fakeBtn').disabled = true;
        
        if (isCorrect) {
            this.playSound('correct');
            this.score += 10 + timeBonus;
            this.streak++;
            this.correctAnswers++;
            this.showFeedback(true, question, timeBonus);
        } else {
            this.playSound('incorrect');
            this.streak = 0;
            this.showFeedback(false, question, timeBonus);
        }
        
        this.totalAnswers++;
        this.updateStats();
        this.currentQuestion++;
        
        // Level up every 5 questions
        if (this.currentQuestion % 5 === 0) {
            this.level++;
        }
    }
    
    showFeedback(isCorrect, question, timeBonus) {
        this.gameState = 'feedback';
        this.hideAllScreens();
        
        const feedbackElement = document.getElementById('feedback');
        const titleElement = document.getElementById('feedbackTitle');
        const textElement = document.getElementById('feedbackText');
        
        if (isCorrect) {
            titleElement.textContent = 'Correct! ✅';
            titleElement.style.color = '#2ecc71';
            textElement.textContent = `${question.explanation}${timeBonus > 0 ? ` +${timeBonus} bonus points for quick answer!` : ''}`;
        } else {
            titleElement.textContent = 'Incorrect! ❌';
            titleElement.style.color = '#e74c3c';
            textElement.textContent = question.explanation;
        }
        
        // Update tips
        document.getElementById('factCheckTips').innerHTML = `
            <h4>💡 Fact-Checking Tips:</h4>
            <ul>
                <li>Check multiple reliable sources</li>
                <li>Look for evidence and citations</li>
                <li>Be wary of sensational language</li>
                <li>Verify the source's credibility</li>
                <li>${question.tips}</li>
            </ul>
        `;
        
        feedbackElement.style.display = 'block';
    }
    
    nextQuestion() {
        this.gameState = 'playing';
        this.hideAllScreens();
        this.showGameArea();
        this.showQuestion();
        
        // Hide the next headline button during question display
        const nextHeadlineBtn = document.getElementById('nextHeadlineBtn');
        if (nextHeadlineBtn) {
            nextHeadlineBtn.style.display = 'none';
        }
    }
    
    endGame() {
        this.playSound('gameOver');
        this.gameState = 'gameOver';
        this.hideAllScreens();

        // Reset pause state when game ends
        const pauseBtn = document.getElementById('pauseToggleBtn');
        if (pauseBtn) {
            pauseBtn.classList.remove('paused');
        }
        this.isPaused = false;

        // High score logic
        let highScore = localStorage.getItem('noteworthy_high_score');
        if (!highScore || this.score > parseInt(highScore)) {
            highScore = this.score;
            localStorage.setItem('noteworthy_high_score', highScore);
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;
        document.getElementById('finalStreak').textContent = Math.max(...this.getBestStreak());
        // Show high score
        const highScoreElem = document.getElementById('finalHighScore');
        if (highScoreElem) {
            highScoreElem.textContent = highScore;
        }

        document.getElementById('gameOver').style.display = 'block';
    }
    
    restartGame() {
        this.score = 0;
        this.level = 1;
        this.streak = 0;
        this.currentQuestion = 0;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.updateStats();
        this.startGame();
    }
    
    hideAllScreens() {
        console.log('hideAllScreens called');
        const startScreen = document.getElementById('startScreen');
        const gameArea = document.querySelector('.game-area');
        const gameStats = document.querySelector('.game-stats');
        const feedback = document.getElementById('feedback');
        const gameOver = document.getElementById('gameOver');
        
        if (startScreen) startScreen.style.display = 'none';
        if (gameArea) gameArea.style.display = 'none';
        if (gameStats) gameStats.style.display = 'none';
        if (feedback) feedback.style.display = 'none';
        if (gameOver) gameOver.style.display = 'none';
        
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
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('streak').textContent = this.streak;
        // Calculate and update accuracy
        const accuracy = this.totalAnswers > 0 ? Math.round((this.correctAnswers / this.totalAnswers) * 100) : 0;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        // Show high score in stats bar
        const highScore = localStorage.getItem('noteworthy_high_score') || 0;
        const highScoreElem = document.getElementById('highScore');
        if (highScoreElem) {
            highScoreElem.textContent = highScore;
        }
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
    
    // Generate timer sound
    generateTimerSound() {
        // Create a gentle warning sound
        setTimeout(() => this.generateKeyboardClick(400, 200, 0.25), 0);
        setTimeout(() => this.generateKeyboardClick(300, 300, 0.25), 250);
    }
    
    // Generate game start sound
    generateGameStartSound() {
        // Play a pleasant startup sequence
        setTimeout(() => this.generateKeyboardClick(800, 60, 0.15), 0);
        setTimeout(() => this.generateKeyboardClick(1000, 60, 0.15), 100);
        setTimeout(() => this.generateKeyboardClick(1200, 60, 0.15), 200);
        setTimeout(() => this.generateKeyboardClick(1400, 120, 0.2), 300);
    }
    
    // Generate game over sound
    generateGameOverSound() {
        // Play a gentle ending sequence
        setTimeout(() => this.generateKeyboardClick(800, 100, 0.2), 0);
        setTimeout(() => this.generateKeyboardClick(600, 100, 0.2), 150);
        setTimeout(() => this.generateKeyboardClick(400, 150, 0.2), 300);
    }
    
    initBackgroundMusic() {
        // Create audio element for background music
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
        this.bgAudio.src = './copy_A8F29838-31C4-4D71-B2BE-5A0CACDB005B.m4a';
        
        // Add audio to document
        document.body.appendChild(this.bgAudio);
        
        // Restore music state from localStorage
        this.isMusicPlaying = localStorage.getItem('musicPlaying') === 'true';
        this.musicEnabled = localStorage.getItem('musicEnabled') !== 'false'; // Default to true
        
        // If music was playing, start it automatically
        if (this.isMusicPlaying && this.musicEnabled) {
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
        const icon = musicBtn.querySelector('.btn-icon');
        
        if (this.musicEnabled && this.isMusicPlaying) {
            icon.textContent = '🎵';
            musicBtn.classList.remove('disabled');
        } else if (this.musicEnabled && !this.isMusicPlaying) {
            icon.textContent = '⏸️';
            musicBtn.classList.remove('disabled');
        } else {
            icon.textContent = '🔇';
            musicBtn.classList.add('disabled');
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
                    this.generateTimerSound();
                    break;
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
        this.musicEnabled = !this.musicEnabled;
        localStorage.setItem('musicEnabled', this.musicEnabled.toString());
        
        if (this.musicEnabled) {
            this.startBackgroundMusic();
        } else {
            this.stopBackgroundMusic();
        }
        
        this.updateMusicButton();
    }
    
    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
    }
    
    // Initialize logo animation with puzzle piece sound
    initLogoAnimation() {
        console.log('initLogoAnimation called!');
        
        // N and W logos meet in the middle at 2 seconds (0.5s delay + 1.5s animation)
        // Add a small delay to ensure audio context is ready
        setTimeout(() => {
            console.log('Playing puzzle piece sound!');
            playPuzzlePiece();
        }, 2500); // Increased to 2.5s to ensure logos have fully met
        
        // Add test button for debugging (remove this later)
        const testButton = document.createElement('button');
        testButton.textContent = '🔊 Test Puzzle Sound';
        testButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 10px;
            background: #4A90E2;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;
        testButton.onclick = () => {
            console.log('Manual puzzle sound test!');
            playPuzzlePiece();
        };
        document.body.appendChild(testButton);
        
        // Also add a simple beep test button
        const beepButton = document.createElement('button');
        beepButton.textContent = '🔔 Simple Beep Test';
        beepButton.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            padding: 10px;
            background: #E74C3C;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;
        beepButton.onclick = () => {
            console.log('Simple beep test!');
            // Create a simple beep using the existing audio context
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                
                console.log('Simple beep played!');
            } catch (error) {
                console.log('Simple beep error:', error);
            }
        };
        document.body.appendChild(beepButton);
    }
    
    toggleTheme() {
        if (document.body.classList.contains('dark-mode')) {
            this.enableLightMode();
        } else {
            this.enableDarkMode();
        }
    }
    
    enableDarkMode() {
        document.body.classList.add('dark-mode');
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.classList.add('dark-mode');
            themeBtn.querySelector('.btn-icon').textContent = '☀️';
            themeBtn.querySelector('.btn-text').textContent = 'Light';
        }
        localStorage.setItem('theme', 'dark');
    }
    
    enableLightMode() {
        document.body.classList.remove('dark-mode');
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.classList.remove('dark-mode');
            themeBtn.querySelector('.btn-icon').textContent = '🌙';
            themeBtn.querySelector('.btn-text').textContent = 'Dark';
        }
        localStorage.setItem('theme', 'light');
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
        
        // Show pause overlay
        const pauseOverlay = document.getElementById('pauseOverlay');
        const pauseScore = document.getElementById('pauseScore');
        const pauseTime = document.getElementById('pauseTime');
        
        if (pauseOverlay && pauseScore && pauseTime) {
            pauseScore.textContent = this.score;
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
        
        // Restart timer with remaining time if game is playing
        if (this.gameState === 'playing' && this.pauseTimeLeft > 0) {
            this.timeLeft = this.pauseTimeLeft;
            this.startTimer();
        }
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

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === '1' || e.key === 'f') {
        document.getElementById('factBtn').click();
    } else if (e.key === '2' || e.key === 'm') {
        document.getElementById('fakeBtn').click();
    } else if (e.key === 'Enter' || e.key === ' ') {
        const nextBtn = document.getElementById('nextBtn');
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (nextBtn.style.display !== 'none') {
            nextBtn.click();
        } else if (startBtn.style.display !== 'none') {
            startBtn.click();
        } else if (restartBtn.style.display !== 'none') {
            restartBtn.click();
        }
    } else if (e.key === 'p' || e.key === 'P') {
        // Pause/Resume game with 'P' key
        if (window.game) {
            window.game.togglePause();
        }
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
    
    // Initialize authentication system
    window.authSystem = new AuthSystem();
    
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
});

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

// Navigation functionality
function initNavigation() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
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

// News carousel functionality - DISABLED to fix scrolling issues
function initNewsCarousel() {
    // DISABLED: This function was causing scrolling problems
    console.log('News carousel initialization disabled - using native scrolling');
    return;
    
    /* DISABLED CODE:
    const track = document.getElementById('articlesTrack');
    if (!track) return;

    let index = 0;
    let touchStartX = 0;
    let touchEndX = 0;
    let isDragging = false;
    let startTranslateX = 0;
    let currentTranslateX = 0;
    let mouseStartX = 0;
    let mouseStartTranslateX = 0;
    let isMouseDragging = false;

    // Add keyboard navigation
    function addKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Only handle keys when carousel is focused or visible
            const carousel = track.parentElement;
            if (!carousel || !carousel.offsetParent) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (index > 0) slide(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (index < maxIndex()) slide(1);
                    break;
                case 'Home':
                    e.preventDefault();
                    index = 0;
                    update();
                    break;
                case 'End':
                    e.preventDefault();
                    index = maxIndex();
                    update();
                    break;
            }
        });
    }

    // Add navigation buttons
    function addNavigationButtons() {
        const carousel = track.parentElement;
        if (!carousel) return;

        // Remove existing buttons
        const existingButtons = carousel.querySelectorAll('.carousel-nav-btn');
        existingButtons.forEach(btn => btn.remove());

        // Create previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-nav-btn carousel-prev';
        prevBtn.innerHTML = '‹';
        prevBtn.style.cssText = `
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(74, 144, 226, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 24px;
            cursor: pointer;
            z-index: 10;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        prevBtn.onclick = () => slide(-1);

        // Create next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-nav-btn carousel-next';
        nextBtn.innerHTML = '›';
        nextBtn.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(74, 144, 226, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 24px;
            cursor: pointer;
            z-index: 10;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        nextBtn.onclick = () => slide(1);

        // Add hover effects
        [prevBtn, nextBtn].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(74, 144, 226, 1)';
                btn.style.transform = 'translateY(-50%) scale(1.1)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(74, 144, 226, 0.8)';
                btn.style.transform = 'translateY(-50%) scale(1)';
            });
        });

        // Add buttons to carousel
        carousel.appendChild(prevBtn);
        carousel.appendChild(nextBtn);

        // Navigation functions removed - only scrolling allowed
        // updateNavigationButtons();
    }

    // Navigation functions removed - only scrolling allowed
    // function updateNavigationButtons() {
    //     const prevBtn = document.querySelector('.carousel-prev');
    //     const nextBtn = document.querySelector('.carousel-next');
    //     
    //     if (prevBtn) {
    //         prevBtn.style.opacity = index > 0 ? '1' : '0.3';
    //         prevBtn.style.pointerEvents = index > 0 ? 'auto' : 'none';
    //     }
    //     
    //     if (nextBtn) {
    //         nextBtn.style.opacity = index < maxIndex() ? '1' : '0.3';
    //         nextBtn.style.pointerEvents = index < maxIndex() ? 'auto' : 'none';
    //     }
    // }

    function calculateVisibleCards() {
        const container = track.parentElement;
        if (!container) return 1;
        
        const containerWidth = container.getBoundingClientRect().width;
        const containerStyle = window.getComputedStyle(container);
        const leftPadding = parseFloat(containerStyle.paddingLeft);
        const rightPadding = parseFloat(containerStyle.paddingRight);
        const contentWidth = containerWidth - leftPadding - rightPadding;
        
        // Get card width and gap
        const firstCard = track.querySelector('.article-card');
        if (!firstCard) return 1;
        
        const cardWidth = firstCard.offsetWidth;
        const gap = 20; // CSS gap value
        
        // Calculate how many cards can fit
        const cardsPerView = Math.floor((contentWidth + gap) / (cardWidth + gap));
        
        return Math.max(1, cardsPerView);
    }

    function maxIndex() {
        const cards = track.querySelectorAll('.article-card').length;
        const per = calculateVisibleCards();
        // Calculate how many slides we need
        const totalSlides = Math.ceil(cards / per);
        return Math.max(0, totalSlides - 1);
    }

    function update() {
        const per = calculateVisibleCards();
        const cards = track.querySelectorAll('.article-card');
        if (cards.length === 0) return;
        
        // Calculate the viewport width for sliding
        const container = track.parentElement;
        if (!container) return;
        
        const containerWidth = container.getBoundingClientRect().width;
        const containerStyle = window.getComputedStyle(container);
        const leftPadding = parseFloat(containerStyle.paddingLeft);
        const rightPadding = parseFloat(containerStyle.paddingRight);
        const contentWidth = containerWidth - leftPadding - rightPadding;
        
        // Get card width and gap to calculate proper slide distance
        const firstCard = cards[0];
        const cardWidth = firstCard.offsetWidth;
        const gap = 20; // CSS gap value
        
        // Calculate how many cards fit in the viewport
        const cardsPerView = Math.floor((contentWidth + gap) / (cardWidth + gap));
        
        // Slide by the width of visible cards + gap
        const slideDistance = index * (cardsPerView * cardWidth + (cardsPerView - 1) * gap);
        
        // Apply the transform
        track.style.transform = `translateX(${-slideDistance}px)`;
        
        // Navigation functions removed - only scrolling allowed
        // updateNavigationButtons();
        // updateVisualIndicators();
    }

    function slide(dir) {
        index = Math.min(Math.max(0, index + dir), maxIndex());
        update();
    }

    /* DISABLED TOUCH FUNCTIONALITY - Using native scrolling instead
    // Touch/swipe functionality for mobile
    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        startTranslateX = currentTranslateX;
        isDragging = true;
        track.style.transition = 'none'; // Disable transition during drag
        
        // Prevent default to avoid page scrolling
        e.preventDefault();
    }, { passive: false });

    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const touchX = e.touches[0].clientX;
        const diff = touchX - touchStartX;
        currentTranslateX = startTranslateX + diff;
        
        // Apply the drag transform
        track.style.transform = `translateX(${currentTranslateX}px)`;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        track.style.transition = 'transform 0.45s ease'; // Re-enable transition
        
        touchEndX = e.changedTouches[0].clientX;
        const swipeDistance = touchEndX - touchStartX;
        const minSwipeDistance = 80; // Higher threshold to avoid accidental swipes
        
        if (Math.abs(swipeDistance) > minSwipeDistance) {
            if (swipeDistance > 0 && index > 0) {
                // Swipe right - go to previous
                slide(-1);
            } else if (swipeDistance < 0 && index < maxIndex()) {
                // Swipe left - go to next
                slide(1);
            } else {
                // Invalid swipe - snap back
                update();
            }
        } else {
            // Not enough distance - snap back
            update();
        }
    }, { passive: true });
    */

    /* DISABLED MOUSE DRAG FUNCTIONALITY - Using native scrolling instead
    // Mouse drag functionality for desktop
    track.addEventListener('mousedown', (e) => {
        // Only start drag on left mouse button
        if (e.button !== 0) return;
        
        mouseStartX = e.clientX;
        mouseStartTranslateX = currentTranslateX;
        isMouseDragging = true;
        track.style.transition = 'none';
        track.style.cursor = 'grabbing';
        
        // Prevent text selection during drag
        e.preventDefault();
    });

    track.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        
        const mouseX = e.clientX;
        const diff = mouseX - mouseStartX;
        currentTranslateX = mouseStartTranslateX + diff;
        
        track.style.transform = `translateX(${currentTranslateX}px)`;
    });

    track.addEventListener('mouseup', (e) => {
        if (!isMouseDragging) return;
        
        isMouseDragging = false;
        track.style.transition = 'transform 0.45s ease';
        track.style.cursor = 'grab';
        
        const mouseEndX = e.clientX;
        const dragDistance = mouseEndX - mouseStartX;
        const minDragDistance = 100; // Higher threshold to avoid accidental drags
        
        if (Math.abs(dragDistance) > minDragDistance) {
            if (dragDistance > 0 && index > 0) {
                slide(-1);
            } else if (dragDistance < 0 && index < maxIndex()) {
                slide(1);
            } else {
                update();
            }
        } else {
            update();
        }
    });
    */

    track.addEventListener('mouseleave', () => {
        if (isMouseDragging) {
            isMouseDragging = false;
            track.style.transition = 'transform 0.45s ease';
            track.style.cursor = 'grab';
            update();
        }
    });

    // Prevent context menu on right-click
    track.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    /* DISABLED WHEEL FUNCTIONALITY - Using native scrolling instead
    // Two-finger swipe support for laptop trackpads
    let wheelTimeout;
    let wheelDeltaX = 0;
    let isWheeling = false;

    track.addEventListener('wheel', (e) => {
        // Only handle horizontal scroll (two-finger swipe on trackpad)
        // Make the threshold much higher to avoid interfering with normal scrolling
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
            e.preventDefault();
            
            // Accumulate horizontal scroll
            wheelDeltaX += e.deltaX;
            
            if (!isWheeling) {
                isWheeling = true;
            }
            
            // Clear previous timeout
            clearTimeout(wheelTimeout);
            
            // Set timeout to process the swipe after scrolling stops
            wheelTimeout = setTimeout(() => {
                isWheeling = false;
                
                // Determine swipe direction and distance
                const swipeThreshold = 100; // Higher threshold to avoid accidental swipes
                
                if (Math.abs(wheelDeltaX) > swipeThreshold) {
                    if (wheelDeltaX > 0 && index > 0) {
                        // Swipe right - go to previous
                        slide(-1);
                    } else if (wheelDeltaX < 0 && index < maxIndex()) {
                        // Swipe left - go to next
                        slide(1);
                    }
                }
                
                // Reset delta
                wheelDeltaX = 0;
            }, 150); // Longer delay for better responsiveness
        }
    }, { passive: false });
    */

    // Set initial cursor style
    track.style.cursor = 'grab';
    
    // Handle resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            index = Math.min(index, maxIndex());
            update();
        }, 100);
    });
    
    // Initial update
    requestAnimationFrame(update);

    // Disable carousel navigation - users can only scroll
    // addNavigationButtons();
    // addKeyboardNavigation();
    // addVisualIndicators();
}

// Initialize background music autoplay
function initBackgroundMusic() {
    const backgroundMusic = document.getElementById('backgroundMusic');
    const musicControlBtn = document.getElementById('musicControlBtn');
    
    if (!backgroundMusic) {
        console.error('Background music element not found!');
        return;
    }
    
    console.log('Initializing background music...');
    console.log('Audio element found:', backgroundMusic);
    console.log('Audio source:', backgroundMusic.src || backgroundMusic.querySelector('source')?.src);
    
    // Set volume to a reasonable level (0.0 to 1.0)
    backgroundMusic.volume = 0.5; // Increased volume for testing
    
    // Simple immediate playback attempt
    console.log('🎵 Attempting immediate music playback...');
    
    // Set volume and try to play
    backgroundMusic.volume = 0.5;
    backgroundMusic.muted = false;
    
    // Update button state based on music playing status
    function updateMusicButtonState() {
        if (musicControlBtn) {
            if (!backgroundMusic.paused) {
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
    backgroundMusic.addEventListener('ended', updateMusicButtonState);
    
    // Music control button functionality
    if (musicControlBtn) {
        musicControlBtn.addEventListener('click', () => {
            if (backgroundMusic.paused) {
                backgroundMusic.play().then(() => {
                    console.log('Background music started');
                }).catch(err => {
                    console.log('Failed to start music:', err);
                });
            } else {
                backgroundMusic.pause();
                console.log('Background music paused');
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

// Smooth scrolling for news carousel
function initSmoothScrolling() {
    // DISABLED: This function was causing teleporting/jumping issues
    // Let the browser handle native scrolling behavior instead
    console.log('Native scrolling enabled - custom scroll handlers disabled');
    return;
    
    /* DISABLED CODE THAT WAS CAUSING ISSUES:
    const newsCarousel = document.querySelector('.news-carousel');
    if (!newsCarousel) return;
    
    let isScrolling = false;
    let scrollTimeout;
    
    // Prevent scroll jumping and ensure smooth behavior
    newsCarousel.addEventListener('scroll', () => {
        if (!isScrolling) {
            isScrolling = true;
        }
        
        // Clear previous timeout
        clearTimeout(scrollTimeout);
        
        // Set timeout to mark scrolling as finished
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 150);
    }, { passive: true });
    
    // Improve touch scrolling on mobile
    let touchStartX = 0;
    let touchStartScrollLeft = 0;
    
    newsCarousel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartScrollLeft = newsCarousel.scrollLeft;
    }, { passive: true });
    
    newsCarousel.addEventListener('touchmove', (e) => {
        if (!isScrolling) return;
        
        const touchX = e.touches[0].clientX;
        const diff = touchStartX - touchX;
        const scrollLeft = touchStartScrollLeft + diff;
        
        // Smooth scroll to position
        newsCarousel.scrollTo({
            left: scrollLeft,
            behavior: 'auto' // Use auto for touch scrolling to prevent lag
        });
    }, { passive: true });
    
    // Ensure scroll position is maintained
    newsCarousel.addEventListener('scrollend', () => {
        isScrolling = false;
    }, { passive: true });
    */
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