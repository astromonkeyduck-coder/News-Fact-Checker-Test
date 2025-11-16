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
        const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
        
        if (!backgroundMusic) {
            console.warn('Background music elements not found');
            return;
        }
        
        // Optimize audio loading - only preload metadata, not entire files
        backgroundMusic.preload = 'metadata';
        if (backgroundMusicSecond) backgroundMusicSecond.preload = 'metadata';
        if (backgroundMusicLoop) backgroundMusicLoop.preload = 'metadata';
        
        // Set audio quality settings
        backgroundMusic.volume = 0.5;
        if (backgroundMusicSecond) backgroundMusicSecond.volume = 0.5;
        if (backgroundMusicLoop) backgroundMusicLoop.volume = 0.5;
        
        // Explicitly load audio metadata for all tracks
        // This ensures they're ready when we need to play
        if (backgroundMusic.readyState === 0) {
            backgroundMusic.load();
        }
        if (backgroundMusicSecond && backgroundMusicSecond.readyState === 0) {
            backgroundMusicSecond.load();
        }
        if (backgroundMusicLoop && backgroundMusicLoop.readyState === 0) {
            backgroundMusicLoop.load();
        }
        
        // Check if music should be playing (from localStorage)
        const musicWasPlaying = localStorage.getItem('globalMusicPlaying') === 'true';
        const musicEnabled = localStorage.getItem('globalMusicEnabled') !== 'false';
        
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
            if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
                backgroundMusicLoop.pause();
            }
            // Also pause subscription sound if it's playing
            if (window.subscriptionSound && !window.subscriptionSound.paused) {
                window.subscriptionSound.pause();
                // Clean up reference
                window.subscriptionSound = null;
            }
        }
        
        // Function to play a specific track at a specific time
        function playTrackAtTime(trackName, time) {
            pauseAllTracks();
            
            let track = null;
            if (trackName === 'track1') {
                track = backgroundMusic;
            } else if (trackName === 'track2') {
                track = backgroundMusicSecond;
            } else if (trackName === 'loop') {
                track = backgroundMusicLoop;
            }
            
            if (track) {
                // Ensure audio is loaded before playing
                const attemptPlay = () => {
                    try {
                        track.currentTime = Math.max(0, Math.min(time, track.duration || Infinity));
                        const playPromise = track.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                console.log('Music playing:', trackName);
                            }).catch(err => {
                                console.log('Autoplay blocked, will play on interaction:', err);
                                // Set up to play on next interaction
                                const playOnInteraction = () => {
                                    track.play().catch(() => {});
                                    document.removeEventListener('click', playOnInteraction);
                                    document.removeEventListener('touchstart', playOnInteraction);
                                    document.removeEventListener('keydown', playOnInteraction);
                                };
                                document.addEventListener('click', playOnInteraction, { once: true });
                                document.addEventListener('touchstart', playOnInteraction, { once: true });
                                document.addEventListener('keydown', playOnInteraction, { once: true });
                            });
                        }
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
        
        // Function to play only one track
        function playTrackOnly(track) {
            pauseAllTracks();
            if (track) {
                // Ensure audio is loaded
                const attemptPlay = () => {
                    const playPromise = track.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            console.log('Track playing');
                        }).catch(err => {
                            console.log('Play blocked, waiting for interaction:', err);
                            // Will play on next user interaction
                        });
                    }
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
        
        // Start music if it was playing or if enabled
        const startMusic = () => {
            // First try to restore previous state
            if (musicWasPlaying && savedTrack !== 'none') {
                restoreMusicState();
            } else if (musicEnabled && localStorage.getItem('globalMusicPlaying') === null) {
                // First time - start from beginning
                if (backgroundMusic) {
                    if (backgroundMusic.readyState < 2) {
                        backgroundMusic.load();
                        backgroundMusic.addEventListener('loadeddata', () => {
                            backgroundMusic.currentTime = 0;
                            backgroundMusic.play().catch(() => {});
                            localStorage.setItem('globalMusicPlaying', 'true');
                            localStorage.setItem('globalMusicEnabled', 'true');
                        }, { once: true });
                    } else {
                        backgroundMusic.currentTime = 0;
                        backgroundMusic.play().catch(() => {});
                        localStorage.setItem('globalMusicPlaying', 'true');
                        localStorage.setItem('globalMusicEnabled', 'true');
                    }
                }
            }
            
            document.removeEventListener('click', startMusic);
            document.removeEventListener('touchstart', startMusic);
            document.removeEventListener('keydown', startMusic);
        };
        
        // Try to start on page load (if audio is ready)
        if (musicEnabled) {
            // If music was playing, try to restore immediately
            if (musicWasPlaying && savedTrack !== 'none') {
                // Load audio if needed, then restore
                const tryRestoreImmediately = () => {
                    const track = savedTrack === 'track1' ? backgroundMusic :
                                 savedTrack === 'track2' ? backgroundMusicSecond :
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
            const audioElements = [backgroundMusic, backgroundMusicSecond, backgroundMusicLoop].filter(Boolean);
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
                setTimeout(startMusic, 200);
            }
            
            // Also listen for user interaction (required by browsers) - but make it more accessible
            const startOnInteraction = () => {
                startMusic();
                document.removeEventListener('click', startOnInteraction);
                document.removeEventListener('touchstart', startOnInteraction);
                document.removeEventListener('keydown', startOnInteraction);
                document.removeEventListener('mousemove', startOnInteraction);
            };
            
            document.addEventListener('click', startOnInteraction, { once: true });
            document.addEventListener('touchstart', startOnInteraction, { once: true });
            document.addEventListener('keydown', startOnInteraction, { once: true });
            document.addEventListener('mousemove', startOnInteraction, { once: true });
            
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
        
        // Ensure mutual exclusivity (optimized)
        [backgroundMusic, backgroundMusicSecond, backgroundMusicLoop].forEach(audio => {
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
                          (window.subscriptionSound && !window.subscriptionSound.paused),
                enabled: localStorage.getItem('globalMusicEnabled') !== 'false'
            };
        };
        
        // Handle page visibility changes to pause/resume
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page hidden - save state but keep playing in background
                saveMusicState(true);
            } else {
                // Page visible - restore if needed
                if (musicEnabled && musicWasPlaying) {
                    const currentState = window.getGlobalMusicState();
                    if (!currentState.isPlaying) {
                        restoreMusicState();
                    }
                }
            }
        });
    }
})();
