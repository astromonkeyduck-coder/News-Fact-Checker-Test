// Shared Music System - Optimized for Performance
// Include this script on all pages
// Usage: <script src="music-system.js"></script>

(function() {
    'use strict';
    
    // Prevent multiple initializations
    if (window.musicSystemInitialized) {
        return;
    }
    window.musicSystemInitialized = true;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMusic);
    } else {
        initMusic();
    }
    
    function initMusic() {
        const backgroundMusic = document.getElementById('backgroundMusic');
        const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
        const backgroundMusicThird = document.getElementById('backgroundMusicThird');
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        
        if (!backgroundMusic) {
            console.warn('Background music elements not found');
            return;
        }
        
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
        
        function fadeOutAudio(audio, onComplete) {
            if (!audio || audio.paused) {
                if (onComplete) onComplete();
                return;
            }
            
            const startVolume = audio.volume;
            const startTime = Date.now();
            const fadeInterval = 16; // ~60fps
            
            const fadeTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / FADE_DURATION, 1);
                // Apply easing function for smoother curve
                const easedProgress = easeInOutCubic(progress);
                const newVolume = startVolume * (1 - easedProgress);
                
                audio.volume = Math.max(0, newVolume);
                
                if (progress >= 1) {
                    clearInterval(fadeTimer);
                    audio.pause();
                    audio.volume = startVolume; // Restore original volume
                    if (onComplete) onComplete();
                }
            }, fadeInterval);
        }
        
        function fadeInAudio(audio, targetVolume, onComplete) {
            if (!audio) {
                if (onComplete) onComplete();
                return;
            }
            
            const startVolume = 0;
            const finalVolume = targetVolume || 0.5;
            const startTime = Date.now();
            const fadeInterval = 16; // ~60fps
            
            // Set initial volume
            audio.volume = 0;
            
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
                        audio.volume = finalVolume;
                        if (onComplete) onComplete();
                    }
                } catch (error) {
                    // If fade fails, just set volume directly
                    console.error('Error during fade in:', error);
                    clearInterval(fadeTimer);
                    try {
                        audio.volume = finalVolume;
                    } catch (e) {
                        console.error('Error setting final volume:', e);
                    }
                    if (onComplete) onComplete();
                }
            }, fadeInterval);
        }
        
        // Create ending song audio element if it doesn't exist
        let endingSong = document.getElementById('endingSong');
        if (!endingSong) {
            endingSong = document.createElement('audio');
            endingSong.id = 'endingSong';
            endingSong.preload = 'metadata';
            endingSong.volume = 0.5;
            const source = document.createElement('source');
            source.src = 'Endingsong.wav';
            source.type = 'audio/wav';
            endingSong.appendChild(source);
            document.body.appendChild(endingSong);
        }
        
        let musicStateBeforeLeave = null; // Save music state when leaving
        
        // Optimize audio loading - only preload metadata, not entire files
        backgroundMusic.preload = 'metadata';
        if (backgroundMusicSecond) backgroundMusicSecond.preload = 'metadata';
        if (backgroundMusicThird) backgroundMusicThird.preload = 'metadata';
        if (backgroundMusicLoop) backgroundMusicLoop.preload = 'metadata';
        
        // Set audio quality settings
        backgroundMusic.volume = 0.5;
        if (backgroundMusicSecond) backgroundMusicSecond.volume = 0.5;
        if (backgroundMusicThird) backgroundMusicThird.volume = 0.5;
        if (backgroundMusicLoop) backgroundMusicLoop.volume = 0.5;
        
        // Store original volume in data attributes for restoration
        backgroundMusic.dataset.originalVolume = '0.5';
        if (backgroundMusicSecond) backgroundMusicSecond.dataset.originalVolume = '0.5';
        if (backgroundMusicThird) backgroundMusicThird.dataset.originalVolume = '0.5';
        if (backgroundMusicLoop) backgroundMusicLoop.dataset.originalVolume = '0.5';
        
        // Explicitly load audio metadata for all tracks
        // This ensures they're ready when we need to play
        if (backgroundMusic.readyState === 0) {
            backgroundMusic.load();
        }
        if (backgroundMusicSecond && backgroundMusicSecond.readyState === 0) {
            backgroundMusicSecond.load();
        }
        if (backgroundMusicThird && backgroundMusicThird.readyState === 0) {
            backgroundMusicThird.load();
        }
        if (backgroundMusicLoop && backgroundMusicLoop.readyState === 0) {
            backgroundMusicLoop.load();
        }
        
        // Check if music should be playing (from localStorage)
        const musicWasPlaying = localStorage.getItem('globalMusicPlaying') === 'true';
        const musicEnabled = localStorage.getItem('globalMusicEnabled') !== 'false';
        
        // Check for music=true URL parameter (from shared links)
        const urlParams = new URLSearchParams(window.location.search);
        const musicParam = urlParams.get('music');
        const isSharedLink = musicParam === 'true';
        
        // Get saved music state
        const savedMusicState = JSON.parse(localStorage.getItem('globalMusicState') || '{}');
        const savedTrack = savedMusicState.track || 'track1';
        const savedTime = savedMusicState.time || 0;
        const savedTimestamp = savedMusicState.timestamp || 0;
        
        // Throttle state saving to reduce localStorage writes
        let lastSaveTime = 0;
        const SAVE_THROTTLE = 2000; // Save at most every 2 seconds
        
        // Function to save current music state (throttled)
        function saveMusicState(force) {
            const now = Date.now();
            if (!force && (now - lastSaveTime) < SAVE_THROTTLE) {
                return;
            }
            lastSaveTime = now;
            
            let currentTrack = 'none';
            let currentTime = 0;
            
            if (backgroundMusic && !backgroundMusic.paused) {
                currentTrack = 'track1';
                currentTime = backgroundMusic.currentTime;
            } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                currentTrack = 'track2';
                currentTime = backgroundMusicSecond.currentTime;
            } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                currentTrack = 'loop';
                currentTime = backgroundMusicLoop.currentTime;
            } else if (endingSong && !endingSong.paused) {
                currentTrack = 'ending';
                currentTime = endingSong.currentTime;
            } else {
                // Get time from paused track
                if (backgroundMusic && backgroundMusic.currentTime > 0 && backgroundMusic.duration > 0 && backgroundMusic.currentTime < backgroundMusic.duration) {
                    currentTrack = 'track1';
                    currentTime = backgroundMusic.currentTime;
                } else if (backgroundMusicSecond && backgroundMusicSecond.currentTime > 0 && backgroundMusicSecond.duration > 0 && backgroundMusicSecond.currentTime < backgroundMusicSecond.duration) {
                    currentTrack = 'track2';
                    currentTime = backgroundMusicSecond.currentTime;
                } else if (backgroundMusicLoop && backgroundMusicLoop.currentTime > 0 && backgroundMusicLoop.duration > 0) {
                    currentTrack = 'loop';
                    currentTime = backgroundMusicLoop.currentTime;
                } else if (endingSong && endingSong.currentTime > 0 && endingSong.duration > 0) {
                    currentTrack = 'ending';
                    currentTime = endingSong.currentTime;
                }
            }
            
            if (currentTrack !== 'none') {
                try {
                    localStorage.setItem('globalMusicState', JSON.stringify({
                        track: currentTrack,
                        time: currentTime,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    // localStorage quota exceeded or other error
                    console.warn('Failed to save music state:', e);
                }
            }
        }
        
        // Function to ensure only one track plays at a time
        function pauseAllTracks() {
            if (backgroundMusic && !backgroundMusic.paused) {
                backgroundMusic.pause();
            }
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                backgroundMusicSecond.pause();
            }
            if (backgroundMusicThird && !backgroundMusicThird.paused) {
                backgroundMusicThird.pause();
            }
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                backgroundMusicLoop.pause();
            }
            if (endingSong && !endingSong.paused) {
                endingSong.pause();
            }
            // Also pause subscription sound if it's playing
            if (window.subscriptionSound && !window.subscriptionSound.paused) {
                window.subscriptionSound.pause();
                // Clean up reference
                window.subscriptionSound = null;
            }
        }
        
        // Expose function to pause all tracks and return current state (for subscription sound)
        window.pauseAllMusicTracks = function() {
            let wasPlaying = false;
            let currentTrack = null;
            let currentTime = 0;
            
            // Find which track is playing and save its state
            if (backgroundMusic && !backgroundMusic.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusic;
                currentTime = backgroundMusic.currentTime;
            } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicSecond;
                currentTime = backgroundMusicSecond.currentTime;
            } else if (backgroundMusicThird && !backgroundMusicThird.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicThird;
                currentTime = backgroundMusicThird.currentTime;
            } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                wasPlaying = true;
                currentTrack = backgroundMusicLoop;
                currentTime = backgroundMusicLoop.currentTime;
            } else if (endingSong && !endingSong.paused) {
                wasPlaying = true;
                currentTrack = endingSong;
                currentTime = endingSong.currentTime;
            }
            
            // Pause all tracks
            pauseAllTracks();
            
            return {
                wasPlaying: wasPlaying,
                currentTrack: currentTrack,
                currentTime: currentTime
            };
        };
        
        // Function to play a specific track at a specific time with fade in
        function playTrackAtTime(trackName, time) {
            // Fade out currently playing tracks
            const currentlyPlaying = [];
            if (backgroundMusic && !backgroundMusic.paused) {
                currentlyPlaying.push(backgroundMusic);
            }
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                currentlyPlaying.push(backgroundMusicSecond);
            }
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                currentlyPlaying.push(backgroundMusicLoop);
            }
            if (endingSong && !endingSong.paused) {
                currentlyPlaying.push(endingSong);
            }
            
            let track = null;
            if (trackName === 'track1') {
                track = backgroundMusic;
            } else if (trackName === 'track2') {
                track = backgroundMusicSecond;
            } else if (trackName === 'loop') {
                track = backgroundMusicLoop;
            } else if (trackName === 'ending') {
                track = endingSong;
            }
            
            // Remove the track we're about to play from fade out list
            const tracksToFadeOut = currentlyPlaying.filter(t => t !== track);
            
            // Fade out other tracks
            tracksToFadeOut.forEach(audio => {
                fadeOutAudio(audio, () => {
                    audio.pause();
                });
            });
            
            if (track) {
                // Ensure audio is loaded before playing
                const attemptPlay = () => {
                    try {
                        track.currentTime = Math.max(0, Math.min(time, track.duration || Infinity));
                        const targetVolume = track.volume || 0.5;
                        
                        // Fade in the new track
                        fadeInAudio(track, targetVolume, () => {
                            console.log('Music playing:', trackName);
                        });
                    } catch (e) {
                        console.warn('Error playing track:', e);
                    }
                };
                
                if (track.readyState < 1) {
                    // No metadata yet - load it
                    track.load();
                    track.addEventListener('loadedmetadata', () => {
                        attemptPlay();
                    }, { once: true });
                } else if (track.readyState < 2) {
                    // Has metadata but not enough data - try to play anyway
                    track.addEventListener('canplay', () => {
                        attemptPlay();
                    }, { once: true });
                    attemptPlay(); // Try immediately as fallback
                    track.load(); // Ensure loading continues
                } else {
                    // Ready to play
                    attemptPlay();
                }
            }
        }
        
        // Function to play only one track with fade in
        function playTrackOnly(track) {
            // Fade out currently playing tracks
            const currentlyPlaying = [];
            if (backgroundMusic && !backgroundMusic.paused) {
                currentlyPlaying.push(backgroundMusic);
            }
            if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                currentlyPlaying.push(backgroundMusicSecond);
            }
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                currentlyPlaying.push(backgroundMusicLoop);
            }
            if (endingSong && !endingSong.paused) {
                currentlyPlaying.push(endingSong);
            }
            
            // Remove the track we're about to play from fade out list
            const tracksToFadeOut = currentlyPlaying.filter(t => t !== track);
            
            // Fade out other tracks
            tracksToFadeOut.forEach(audio => {
                fadeOutAudio(audio, () => {
                    audio.pause();
                });
            });
            
            if (track) {
                // Ensure audio is loaded
                const attemptPlay = () => {
                    const targetVolume = track.volume || 0.5;
                    
                    // Fade in the new track
                    fadeInAudio(track, targetVolume, () => {
                        console.log('Track playing');
                    });
                };
                
                if (track.readyState < 1) {
                    // No metadata - load it
                    track.load();
                    track.addEventListener('loadedmetadata', () => {
                        attemptPlay();
                    }, { once: true });
                } else if (track.readyState < 2) {
                    // Has metadata - try to play
                    track.addEventListener('canplay', () => {
                        attemptPlay();
                    }, { once: true });
                    attemptPlay(); // Try immediately
                    track.load(); // Continue loading
                } else if (track.paused) {
                    attemptPlay();
                }
            }
        }
        
        // Restore music state when page loads
        function restoreMusicState() {
            // Only restore if saved within last 5 minutes
            const timeSinceSave = Date.now() - savedTimestamp;
            if (timeSinceSave > 300000) return; // 5 minutes
            
            if (musicEnabled && musicWasPlaying && savedTrack !== 'none') {
                // Wait for audio to be ready
                const tryRestore = () => {
                    const track = savedTrack === 'track1' ? backgroundMusic :
                                 savedTrack === 'track2' ? backgroundMusicSecond :
                                 savedTrack === 'ending' ? endingSong :
                                 backgroundMusicLoop;
                    
                    if (track) {
                        // Load audio if not ready
                        if (track.readyState < 1) {
                            track.load();
                            track.addEventListener('loadedmetadata', () => {
                                playTrackAtTime(savedTrack, savedTime);
                            }, { once: true });
                        } else if (track.readyState < 2) {
                            // Has metadata but not full data - try anyway
                            track.addEventListener('loadeddata', () => {
                                playTrackAtTime(savedTrack, savedTime);
                            }, { once: true });
                            playTrackAtTime(savedTrack, savedTime); // Try now, fallback if needed
                        } else {
                            // Ready to play
                            playTrackAtTime(savedTrack, savedTime);
                        }
                    }
                };
                
                // Try after a short delay to let page settle
                setTimeout(tryRestore, 100);
            }
        }
        
        // Save state before page unload (forced save)
        window.addEventListener('beforeunload', () => saveMusicState(true));
        window.addEventListener('pagehide', () => saveMusicState(true));
        
        // Reduced frequency interval for periodic saves (every 5 seconds instead of 1)
        setInterval(() => saveMusicState(), 5000);
        
        // Automatically add music=true to URL when music is playing (so manual copies include it)
        function updateURLWithMusicParam() {
            if (window.getGlobalMusicState && window.getGlobalMusicState().isPlaying) {
                const url = new URL(window.location.href);
                if (url.searchParams.get('music') !== 'true') {
                    url.searchParams.set('music', 'true');
                    // Update URL without page reload (using replaceState to avoid adding to history)
                    window.history.replaceState({}, '', url.toString());
                }
            }
        }
        
        // Update URL when music starts playing
        [backgroundMusic, backgroundMusicSecond, backgroundMusicLoop, endingSong].forEach(audio => {
            if (audio) {
                audio.addEventListener('play', () => {
                    // Small delay to ensure state is updated
                    setTimeout(updateURLWithMusicParam, 100);
                });
            }
        });
        
        // Also check on page load if music is already playing
        setTimeout(updateURLWithMusicParam, 1000);
        
        // Create a visual prompt for music if autoplay is blocked
        function createMusicPrompt() {
            // Check if prompt already exists
            if (document.getElementById('music-autoplay-prompt')) {
                return;
            }
            
            const prompt = document.createElement('div');
            prompt.id = 'music-autoplay-prompt';
            prompt.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                animation: slideInUp 0.3s ease-out;
            `;
            
            // Add animation keyframes if not already present
            if (!document.getElementById('music-prompt-styles')) {
                const style = document.createElement('style');
                style.id = 'music-prompt-styles';
                style.textContent = `
                    @keyframes slideInUp {
                        from {
                            transform: translateY(20px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            prompt.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 24px;">🎵</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 4px;">Music Ready!</div>
                        <div style="font-size: 12px; opacity: 0.8;">Click to start the soundtrack</div>
                    </div>
                </div>
                <button id="music-prompt-button" style="
                    width: 100%;
                    padding: 10px;
                    background: #1DA1F2;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#1a8cd8'" onmouseout="this.style.background='#1DA1F2'">
                    Play Music
                </button>
            `;
            
            document.body.appendChild(prompt);
            
            // Add click handler to button
            const button = prompt.querySelector('#music-prompt-button');
            button.addEventListener('click', () => {
                startMusic();
                prompt.style.animation = 'slideInUp 0.3s ease-out reverse';
                setTimeout(() => prompt.remove(), 300);
            });
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (prompt.parentNode) {
                    prompt.style.animation = 'slideInUp 0.3s ease-out reverse';
                    setTimeout(() => prompt.remove(), 300);
                }
            }, 10000);
        }
        
        // Start music if it was playing or if enabled
        const startMusic = () => {
            // First try to restore previous state
            if (musicWasPlaying && savedTrack !== 'none') {
                restoreMusicState();
            } else if (musicEnabled && localStorage.getItem('globalMusicPlaying') === null) {
                // First time - start from beginning with fade in
                if (backgroundMusic) {
                    if (backgroundMusic.readyState < 2) {
                        backgroundMusic.load();
                        backgroundMusic.addEventListener('loadeddata', () => {
                            backgroundMusic.currentTime = 0;
                            const targetVolume = backgroundMusic.volume || 0.5;
                            fadeInAudio(backgroundMusic, targetVolume, () => {
                                localStorage.setItem('globalMusicPlaying', 'true');
                                localStorage.setItem('globalMusicEnabled', 'true');
                            });
                        }, { once: true });
                    } else {
                        backgroundMusic.currentTime = 0;
                        const targetVolume = backgroundMusic.volume || 0.5;
                        fadeInAudio(backgroundMusic, targetVolume, () => {
                            localStorage.setItem('globalMusicPlaying', 'true');
                            localStorage.setItem('globalMusicEnabled', 'true');
                        });
                    }
                }
            }
            
            document.removeEventListener('click', startMusic);
            document.removeEventListener('touchstart', startMusic);
            document.removeEventListener('keydown', startMusic);
        };
        
        // Try to start on page load (if audio is ready)
        if (musicEnabled || isSharedLink) {
            // If this is a shared link with music=true, enable music if not already enabled
            if (isSharedLink && !musicEnabled) {
                localStorage.setItem('globalMusicEnabled', 'true');
            }
            
            // If music was playing, try to restore immediately
            if (musicWasPlaying && savedTrack !== 'none') {
                // Load audio if needed, then restore
                const tryRestoreImmediately = () => {
                    const track = savedTrack === 'track1' ? backgroundMusic :
                                 savedTrack === 'track2' ? backgroundMusicSecond :
                                 savedTrack === 'ending' ? endingSong :
                                 backgroundMusicLoop;
                    
                    if (track) {
                        // Load the audio file if needed
                        if (track.readyState < 1) {
                            track.load();
                        }
                        
                        // Try to play once metadata is loaded
                        const playWhenReady = () => {
                            if (track.readyState >= 1) {
                                playTrackAtTime(savedTrack, savedTime);
                            } else {
                                track.addEventListener('loadedmetadata', () => {
                                    playTrackAtTime(savedTrack, savedTime);
                                }, { once: true });
                                track.load();
                            }
                        };
                        
                        if (track.readyState >= 1) {
                            // Already has metadata, play immediately
                            playTrackAtTime(savedTrack, savedTime);
                        } else {
                            // Wait for metadata
                            track.addEventListener('loadedmetadata', () => {
                                playTrackAtTime(savedTrack, savedTime);
                            }, { once: true });
                            track.load();
                        }
                    }
                };
                
                // Try immediately, or after a short delay
                setTimeout(tryRestoreImmediately, 100);
            }
            
            // Wait for audio to load
            const audioElements = [backgroundMusic, backgroundMusicSecond, backgroundMusicLoop, endingSong].filter(Boolean);
            let loadedCount = 0;
            
            audioElements.forEach(audio => {
                if (audio.readyState >= 1) { // Can play
                    loadedCount++;
                } else {
                    audio.addEventListener('loadedmetadata', () => {
                        loadedCount++;
                        if (loadedCount === audioElements.length) {
                            setTimeout(startMusic, 200);
                        }
                    }, { once: true });
                    // Trigger load if not already loading
                    if (audio.readyState === 0) {
                        audio.load();
                    }
                }
            });
            
            if (loadedCount === audioElements.length) {
                setTimeout(() => {
                    // If this is a shared link, try to start music immediately
                    if (isSharedLink) {
                        // Try to start music directly (may be blocked by browser)
                        const attemptAutoplay = async () => {
                            try {
                                if (backgroundMusic) {
                                    await backgroundMusic.play();
                                    localStorage.setItem('globalMusicPlaying', 'true');
                                    localStorage.setItem('globalMusicEnabled', 'true');
                                }
                            } catch (error) {
                                // Autoplay was blocked - show prompt
                                console.log('Autoplay blocked, showing prompt');
                                createMusicPrompt();
                            }
                        };
                        attemptAutoplay();
                    } else {
                        startMusic();
                    }
                }, 200);
            }
            
            // Also listen for user interaction (required by browsers) - but make it more accessible
            const startOnInteraction = () => {
                startMusic();
                document.removeEventListener('click', startOnInteraction);
                document.removeEventListener('touchstart', startOnInteraction);
                document.removeEventListener('keydown', startOnInteraction);
                document.removeEventListener('mousemove', startOnInteraction);
            };
            
            // For shared links, be more aggressive about trying to start music
            if (isSharedLink) {
                // Try multiple interaction types
                document.addEventListener('click', startOnInteraction, { once: true });
                document.addEventListener('touchstart', startOnInteraction, { once: true });
                document.addEventListener('keydown', startOnInteraction, { once: true });
                document.addEventListener('mousemove', startOnInteraction, { once: true });
                
                // Also try to start on any scroll (very common first interaction)
                const startOnScroll = () => {
                    startMusic();
                    window.removeEventListener('scroll', startOnScroll);
                    window.removeEventListener('wheel', startOnScroll);
                };
                window.addEventListener('scroll', startOnScroll, { once: true, passive: true });
                window.addEventListener('wheel', startOnScroll, { once: true, passive: true });
            } else {
                document.addEventListener('click', startOnInteraction, { once: true });
                document.addEventListener('touchstart', startOnInteraction, { once: true });
                document.addEventListener('keydown', startOnInteraction, { once: true });
                document.addEventListener('mousemove', startOnInteraction, { once: true });
            }
            
            // Also try to start on window focus if music was playing
            window.addEventListener('focus', () => {
                if (musicWasPlaying && musicEnabled) {
                    const state = window.getGlobalMusicState ? window.getGlobalMusicState() : { isPlaying: false };
                    if (!state.isPlaying) {
                        startMusic();
                    }
                }
            });
        }
        
        // Track when music ends and play next track (throttled event listeners)
        if (backgroundMusic) {
            backgroundMusic.addEventListener('ended', () => {
                saveMusicState(true);
                if (backgroundMusicSecond && localStorage.getItem('globalMusicEnabled') !== 'false') {
                    if (backgroundMusicSecond.readyState < 2) {
                        backgroundMusicSecond.load();
                    }
                    backgroundMusicSecond.currentTime = 0;
                    playTrackOnly(backgroundMusicSecond);
                }
            });
            
            backgroundMusic.addEventListener('play', () => {
                localStorage.setItem('globalMusicPlaying', 'true');
                saveMusicState(true);
            });
            
            backgroundMusic.addEventListener('pause', () => {
                saveMusicState(true);
            });
            
            // Throttled timeupdate - only save every 3 seconds
            let lastTimeUpdate = 0;
            backgroundMusic.addEventListener('timeupdate', () => {
                const now = Date.now();
                if (now - lastTimeUpdate > 3000) {
                    lastTimeUpdate = now;
                    saveMusicState();
                }
            });
        }
        
        if (backgroundMusicSecond) {
            backgroundMusicSecond.addEventListener('ended', () => {
                saveMusicState(true);
                if (backgroundMusicLoop && localStorage.getItem('globalMusicEnabled') !== 'false') {
                    if (backgroundMusicLoop.readyState < 2) {
                        backgroundMusicLoop.load();
                    }
                    backgroundMusicLoop.currentTime = 0;
                    playTrackOnly(backgroundMusicLoop);
                }
            });
            
            backgroundMusicSecond.addEventListener('play', () => {
                localStorage.setItem('globalMusicPlaying', 'true');
                saveMusicState(true);
            });
            
            backgroundMusicSecond.addEventListener('pause', () => {
                saveMusicState(true);
            });
            
            // Throttled timeupdate
            let lastTimeUpdate = 0;
            backgroundMusicSecond.addEventListener('timeupdate', () => {
                const now = Date.now();
                if (now - lastTimeUpdate > 3000) {
                    lastTimeUpdate = now;
                    saveMusicState();
                }
            });
        }
        
        if (backgroundMusicLoop) {
            // Set loop attribute programmatically to ensure it loops
            backgroundMusicLoop.loop = true;
            
            // Note: Loop track should loop continuously, so we don't need an 'ended' handler
            // The loop attribute will handle the looping automatically
            
            backgroundMusicLoop.addEventListener('play', () => {
                localStorage.setItem('globalMusicPlaying', 'true');
                saveMusicState(true);
            });
            
            backgroundMusicLoop.addEventListener('pause', () => {
                saveMusicState(true);
            });
            
            // Throttled timeupdate
            let lastTimeUpdate = 0;
            backgroundMusicLoop.addEventListener('timeupdate', () => {
                const now = Date.now();
                if (now - lastTimeUpdate > 3000) {
                    lastTimeUpdate = now;
                    saveMusicState();
                }
            });
        }
        
        // When ending song finishes, restart the music sequence from the beginning
        if (endingSong) {
            endingSong.addEventListener('ended', () => {
                saveMusicState(true);
                // Restart the music sequence from the beginning
                if (backgroundMusic && localStorage.getItem('globalMusicEnabled') !== 'false') {
                    if (backgroundMusic.readyState < 2) {
                        backgroundMusic.load();
                    }
                    backgroundMusic.currentTime = 0;
                    playTrackOnly(backgroundMusic);
                }
            });
            
            endingSong.addEventListener('play', () => {
                localStorage.setItem('globalMusicPlaying', 'true');
                saveMusicState(true);
            });
            
            endingSong.addEventListener('pause', () => {
                saveMusicState(true);
            });
        }
        
        // Ensure mutual exclusivity (optimized)
        [backgroundMusic, backgroundMusicSecond, backgroundMusicLoop, endingSong].forEach(audio => {
            if (audio) {
                audio.addEventListener('play', () => {
                    pauseAllTracks();
                    // Small delay to ensure pause completes
                    setTimeout(() => {
                        if (audio && !audio.paused) {
                            // Already playing, keep it
                        }
                    }, 10);
                });
            }
        });
        
        // Expose global music control function
        window.toggleGlobalMusic = function() {
            const isPlaying = (!backgroundMusic.paused) || 
                             (backgroundMusicSecond && !backgroundMusicSecond.paused) || 
                             (backgroundMusicLoop && !backgroundMusicLoop.paused) ||
                             (endingSong && !endingSong.paused) ||
                             (window.subscriptionSound && !window.subscriptionSound.paused);
            
            if (isPlaying) {
                // Muting - save current state before pausing
                saveMusicState(true);
                pauseAllTracks();
                localStorage.setItem('globalMusicEnabled', 'false');
                localStorage.setItem('globalMusicPlaying', 'false');
                return false;
            } else {
                // Unmuting - restore from saved state
                const currentState = JSON.parse(localStorage.getItem('globalMusicState') || '{}');
                const trackToResume = currentState.track || savedTrack;
                const timeToResume = currentState.time !== undefined ? currentState.time : savedTime;
                
                // If we have a saved track and time, resume from there
                if (trackToResume !== 'none' && trackToResume) {
                    playTrackAtTime(trackToResume, timeToResume);
                } else {
                    // No saved state - determine which track to play based on current progress
                    // Check which track has progress (not finished)
                    if (backgroundMusic && backgroundMusic.currentTime > 0 && backgroundMusic.currentTime < (backgroundMusic.duration || Infinity)) {
                        playTrackAtTime('track1', backgroundMusic.currentTime);
                    } else if (backgroundMusicSecond && backgroundMusicSecond.currentTime > 0 && backgroundMusicSecond.currentTime < (backgroundMusicSecond.duration || Infinity)) {
                        playTrackAtTime('track2', backgroundMusicSecond.currentTime);
                    } else if (backgroundMusicLoop && backgroundMusicLoop.currentTime > 0) {
                        playTrackAtTime('loop', backgroundMusicLoop.currentTime);
                    } else if (endingSong && endingSong.currentTime > 0 && endingSong.currentTime < (endingSong.duration || Infinity)) {
                        playTrackAtTime('ending', endingSong.currentTime);
                    } else {
                        // All tracks finished or at start - start from beginning
                        if (backgroundMusic) {
                            playTrackAtTime('track1', 0);
                        }
                    }
                }
                localStorage.setItem('globalMusicEnabled', 'true');
                localStorage.setItem('globalMusicPlaying', 'true');
                return true;
            }
        };
        
        // Expose function to get music state
        window.getGlobalMusicState = function() {
            return {
                isPlaying: (!backgroundMusic.paused) || 
                          (backgroundMusicSecond && !backgroundMusicSecond.paused) || 
                          (backgroundMusicLoop && !backgroundMusicLoop.paused) ||
                          (endingSong && !endingSong.paused) ||
                          (window.subscriptionSound && !window.subscriptionSound.paused),
                enabled: localStorage.getItem('globalMusicEnabled') !== 'false'
            };
        };
        
        // Handle page visibility changes to pause/resume
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page hidden - pause music and save state
                const wasPlaying = window.getGlobalMusicState().isPlaying;
                if (wasPlaying) {
                    // Save current music state
                    musicStateBeforeLeave = {
                        track: null,
                        time: 0
                    };
                    
                    if (backgroundMusic && !backgroundMusic.paused) {
                        musicStateBeforeLeave.track = 'track1';
                        musicStateBeforeLeave.time = backgroundMusic.currentTime;
                        backgroundMusic.pause();
                    } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                        musicStateBeforeLeave.track = 'track2';
                        musicStateBeforeLeave.time = backgroundMusicSecond.currentTime;
                        backgroundMusicSecond.pause();
                    } else if (backgroundMusicThird && !backgroundMusicThird.paused) {
                        musicStateBeforeLeave.track = 'track3';
                        musicStateBeforeLeave.time = backgroundMusicThird.currentTime;
                        backgroundMusicThird.pause();
                    } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                        musicStateBeforeLeave.track = 'loop';
                        musicStateBeforeLeave.time = backgroundMusicLoop.currentTime;
                        backgroundMusicLoop.pause();
                    } else if (endingSong && !endingSong.paused) {
                        musicStateBeforeLeave.track = 'ending';
                        musicStateBeforeLeave.time = endingSong.currentTime;
                        endingSong.pause();
                    }
                    
                    saveMusicState(true);
                }
            } else {
                // Page visible - restore if needed
                if (musicStateBeforeLeave && musicEnabled) {
                    // Use in-memory state if available (more recent)
                    const trackToResume = musicStateBeforeLeave.track;
                    const timeToResume = musicStateBeforeLeave.time;
                    
                    if (trackToResume === 'track1' && backgroundMusic) {
                        backgroundMusic.currentTime = timeToResume;
                        backgroundMusic.play().catch(() => {});
                    } else if (trackToResume === 'track2' && backgroundMusicSecond) {
                        backgroundMusicSecond.currentTime = timeToResume;
                        backgroundMusicSecond.play().catch(() => {});
                    } else if (trackToResume === 'track3' && backgroundMusicThird) {
                        backgroundMusicThird.currentTime = timeToResume;
                        backgroundMusicThird.play().catch(() => {});
                    } else if (trackToResume === 'loop' && backgroundMusicLoop) {
                        backgroundMusicLoop.currentTime = timeToResume;
                        backgroundMusicLoop.play().catch(() => {});
                    }
                    
                    musicStateBeforeLeave = null;
                } else if (musicEnabled && musicWasPlaying) {
                    // Fall back to localStorage state
                    const currentState = window.getGlobalMusicState();
                    if (!currentState.isPlaying) {
                        restoreMusicState();
                    }
                }
            }
        });
        
        // Track if mouse is currently in the window
        let mouseInWindow = true;
        let mouseLeaveTimeout = null;
        
        // Handle mouse leaving the window (more reliable detection)
        document.addEventListener('mouseout', (e) => {
            // Check if mouse left the document (not just moving between elements)
            if (!e.relatedTarget && !e.toElement) {
                // Mouse left the window
                if (mouseInWindow) {
                    mouseInWindow = false;
                    
                    // Clear any pending timeout
                    if (mouseLeaveTimeout) {
                        clearTimeout(mouseLeaveTimeout);
                        mouseLeaveTimeout = null;
                    }
                    
                    // Small delay to avoid false triggers
                    mouseLeaveTimeout = setTimeout(() => {
                        const wasPlaying = window.getGlobalMusicState().isPlaying;
                        if (wasPlaying) {
                            // Save current music state
                            musicStateBeforeLeave = {
                                track: null,
                                time: 0
                            };
                            
                            if (backgroundMusic && !backgroundMusic.paused) {
                                musicStateBeforeLeave.track = 'track1';
                                musicStateBeforeLeave.time = backgroundMusic.currentTime;
                                backgroundMusic.pause();
                            } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                                musicStateBeforeLeave.track = 'track2';
                                musicStateBeforeLeave.time = backgroundMusicSecond.currentTime;
                                backgroundMusicSecond.pause();
                            } else if (backgroundMusicThird && !backgroundMusicThird.paused) {
                                musicStateBeforeLeave.track = 'track3';
                                musicStateBeforeLeave.time = backgroundMusicThird.currentTime;
                                backgroundMusicThird.pause();
                            } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                                musicStateBeforeLeave.track = 'loop';
                                musicStateBeforeLeave.time = backgroundMusicLoop.currentTime;
                                backgroundMusicLoop.pause();
                            } else if (endingSong && !endingSong.paused) {
                                musicStateBeforeLeave.track = 'ending';
                                musicStateBeforeLeave.time = endingSong.currentTime;
                                endingSong.pause();
                            }
                            
                            saveMusicState(true);
                        }
                    }, 100); // Small delay to confirm mouse actually left
                }
            }
        });
        
        // Handle mouse entering the window
        document.addEventListener('mouseover', (e) => {
            if (!mouseInWindow) {
                mouseInWindow = true;
                
                // Clear any pending leave timeout
                if (mouseLeaveTimeout) {
                    clearTimeout(mouseLeaveTimeout);
                    mouseLeaveTimeout = null;
                }
                
                // Resume music if it was playing before
                if (musicStateBeforeLeave && musicEnabled) {
                    const trackToResume = musicStateBeforeLeave.track;
                    const timeToResume = musicStateBeforeLeave.time;
                    
                    if (trackToResume === 'track1' && backgroundMusic) {
                        backgroundMusic.currentTime = timeToResume;
                        backgroundMusic.play().catch(() => {});
                    } else if (trackToResume === 'track2' && backgroundMusicSecond) {
                        backgroundMusicSecond.currentTime = timeToResume;
                        backgroundMusicSecond.play().catch(() => {});
                    } else if (trackToResume === 'track3' && backgroundMusicThird) {
                        backgroundMusicThird.currentTime = timeToResume;
                        backgroundMusicThird.play().catch(() => {});
                    } else if (trackToResume === 'loop' && backgroundMusicLoop) {
                        backgroundMusicLoop.currentTime = timeToResume;
                        backgroundMusicLoop.play().catch(() => {});
                    } else if (trackToResume === 'ending' && endingSong) {
                        endingSong.currentTime = timeToResume;
                        endingSong.play().catch(() => {});
                    }
                    
                    musicStateBeforeLeave = null;
                }
            }
        });
        
        // Also handle window blur/focus for tab changes
        window.addEventListener('blur', () => {
            const wasPlaying = window.getGlobalMusicState().isPlaying;
            if (wasPlaying) {
                // Save current music state
                musicStateBeforeLeave = {
                    track: null,
                    time: 0
                };
                
                if (backgroundMusic && !backgroundMusic.paused) {
                    musicStateBeforeLeave.track = 'track1';
                    musicStateBeforeLeave.time = backgroundMusic.currentTime;
                    backgroundMusic.pause();
                } else if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
                    musicStateBeforeLeave.track = 'track2';
                    musicStateBeforeLeave.time = backgroundMusicSecond.currentTime;
                    backgroundMusicSecond.pause();
                } else if (backgroundMusicThird && !backgroundMusicThird.paused) {
                    musicStateBeforeLeave.track = 'track3';
                    musicStateBeforeLeave.time = backgroundMusicThird.currentTime;
                    backgroundMusicThird.pause();
                } else if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                    musicStateBeforeLeave.track = 'loop';
                    musicStateBeforeLeave.time = backgroundMusicLoop.currentTime;
                    backgroundMusicLoop.pause();
                } else if (endingSong && !endingSong.paused) {
                    musicStateBeforeLeave.track = 'ending';
                    musicStateBeforeLeave.time = endingSong.currentTime;
                    endingSong.pause();
                }
                
                saveMusicState(true);
            }
        });
        
        window.addEventListener('focus', () => {
            // Resume music if it was playing before
            if (musicStateBeforeLeave && musicEnabled) {
                const trackToResume = musicStateBeforeLeave.track;
                const timeToResume = musicStateBeforeLeave.time;
                
                if (trackToResume === 'track1' && backgroundMusic) {
                    backgroundMusic.currentTime = timeToResume;
                    backgroundMusic.play().catch(() => {});
                } else if (trackToResume === 'track2' && backgroundMusicSecond) {
                    backgroundMusicSecond.currentTime = timeToResume;
                    backgroundMusicSecond.play().catch(() => {});
                } else if (trackToResume === 'track3' && backgroundMusicThird) {
                    backgroundMusicThird.currentTime = timeToResume;
                    backgroundMusicThird.play().catch(() => {});
                } else if (trackToResume === 'loop' && backgroundMusicLoop) {
                    backgroundMusicLoop.currentTime = timeToResume;
                    backgroundMusicLoop.play().catch(() => {});
                } else if (trackToResume === 'ending' && endingSong) {
                    endingSong.currentTime = timeToResume;
                    endingSong.play().catch(() => {});
                }
                
                musicStateBeforeLeave = null;
            }
        });
    }
})();
