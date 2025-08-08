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
            for (let i = 0; i < 8; i++) {
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
        
        console.log('Start button found:', !!startBtn);
        console.log('Fact button found:', !!factBtn);
        console.log('Fake button found:', !!fakeBtn);
        console.log('Next button found:', !!nextBtn);
        console.log('Next headline button found:', !!nextHeadlineBtn);
        console.log('Restart button found:', !!restartBtn);
        
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
        
        this.isMusicPlaying = false;
        this.musicEnabled = true;
        
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
            if (this.bgAudio.currentTime >= this.bgAudio.duration - 3.5) {
                // Loop 3.5 seconds before the end
                this.bgAudio.currentTime = 0;
            }
        });
    }
    
    startBackgroundMusic() {
        if (!this.musicEnabled || !this.bgAudio) return;
        
        // Prevent duplicate instances
        if (this.isMusicPlaying) return;
        
        // Check if audio is already playing
        if (!this.bgAudio.paused) {
            this.isMusicPlaying = true;
            this.updateMusicButton();
            return;
        }
        
        this.bgAudio.play().then(() => {
            this.isMusicPlaying = true;
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

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    // Test if headline element exists
    const headlineTest = document.getElementById('headline');
    console.log('Headline element found on DOM load:', !!headlineTest);
    if (headlineTest) {
        console.log('Headline element text:', headlineTest.textContent);
    }
    
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
