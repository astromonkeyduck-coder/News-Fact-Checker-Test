/**
 * VoicePlaybackManager - Production-grade single-playback voice system
 * 
 * Ensures only one audio stream can play at any moment.
 * Implements state machine, generation IDs, and hard-stop cancellation.
 * 
 * Usage:
 *   const manager = new VoicePlaybackManager(audioContext);
 *   manager.play(audioChunks); // Cancels any existing playback
 *   manager.stop(); // Hard stop
 */

// Set DEBUG_VOICE via window.DEBUG_VOICE or default to true
const DEBUG_VOICE = typeof window !== 'undefined' && window.DEBUG_VOICE !== undefined 
  ? window.DEBUG_VOICE 
  : true; // Set to false to disable debug logs

class VoicePlaybackManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.state = 'idle'; // idle | loading | playing | stopping | error
    this.playbackGeneration = 0; // Increments on each new playback request
    this.currentGeneration = null; // Generation ID of currently playing audio
    this.activeSources = []; // Array of active AudioBufferSourceNode instances
    this.chunkQueue = []; // Queue of audio chunks for current generation
    this.isProcessingQueue = false;
    this.onStateChange = null; // Optional callback for state changes
    
    if (DEBUG_VOICE) {
      console.log('[VoicePlaybackManager] ✅ Initialized');
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get current generation ID
   */
  getCurrentGeneration() {
    return this.currentGeneration;
  }

  /**
   * Transition to new state
   */
  _transitionTo(newState, reason = '') {
    const oldState = this.state;
    this.state = newState;
    
    if (DEBUG_VOICE) {
      console.log(`[VoicePlaybackManager] 🔄 State: ${oldState} → ${newState}${reason ? ` (${reason})` : ''}`);
    }
    
    if (this.onStateChange) {
      this.onStateChange(newState, oldState);
    }
  }

  /**
   * Hard stop all audio playback immediately
   */
  stop() {
    if (DEBUG_VOICE) {
      console.log('[VoicePlaybackManager] 🛑 STOP requested, generation:', this.currentGeneration);
    }

    // Increment generation to invalidate any in-flight operations
    this.playbackGeneration++;
    
    // Transition to stopping state
    if (this.state !== 'idle' && this.state !== 'stopping') {
      this._transitionTo('stopping', 'user stop');
    }

    // Hard stop all active sources
    this._hardStopAllSources();

    // Clear queue
    this.chunkQueue = [];
    this.isProcessingQueue = false;

    // Transition to idle
    this._transitionTo('idle', 'stopped');
    
    if (DEBUG_VOICE) {
      console.log('[VoicePlaybackManager] ✅ STOP complete, new generation:', this.playbackGeneration);
    }
  }

  /**
   * Hard stop all AudioBufferSourceNode instances
   * CRITICAL: This must stop ALL sources immediately, no exceptions
   */
  _hardStopAllSources() {
    const sourcesToStop = [...this.activeSources];
    this.activeSources = []; // Clear immediately to prevent re-processing

    if (sourcesToStop.length === 0) {
      return; // Nothing to stop
    }

    if (DEBUG_VOICE) {
      console.log(`[VoicePlaybackManager] 🛑 Hard-stopping ${sourcesToStop.length} audio source(s)`);
    }

    sourcesToStop.forEach((source, index) => {
      try {
        // CRITICAL: Stop the source IMMEDIATELY (stop at time 0 = now)
        if (source && typeof source.stop === 'function') {
          try {
            source.stop(0); // Stop immediately at current time
          } catch (stopError) {
            // Some sources may already be stopped - ignore
            if (DEBUG_VOICE && !stopError.message?.includes('already stopped')) {
              console.warn(`[VoicePlaybackManager] ⚠️ Error calling stop() on source ${index}:`, stopError);
            }
          }
        }
        
        // CRITICAL: Disconnect from destination to prevent any further audio
        if (source && typeof source.disconnect === 'function') {
          try {
            source.disconnect();
          } catch (disconnectError) {
            if (DEBUG_VOICE) {
              console.warn(`[VoicePlaybackManager] ⚠️ Error disconnecting source ${index}:`, disconnectError);
            }
          }
        }
        
        // CRITICAL: Remove ALL event listeners to prevent callbacks
        if (source) {
          source.onended = null;
          source.onerror = null;
          // Also try to remove any other listeners if they exist
          if (source.removeEventListener) {
            source.removeEventListener('ended', () => {});
            source.removeEventListener('error', () => {});
          }
        }
        
        if (DEBUG_VOICE) {
          console.log(`[VoicePlaybackManager] ✅ Hard-stopped source ${index + 1}/${sourcesToStop.length}`);
        }
      } catch (error) {
        if (DEBUG_VOICE) {
          console.error(`[VoicePlaybackManager] ❌ Error stopping source ${index}:`, error);
        }
        // Continue stopping other sources even if one fails
      }
    });

    if (DEBUG_VOICE) {
      console.log(`[VoicePlaybackManager] ✅ All ${sourcesToStop.length} source(s) hard-stopped`);
    }
  }

  /**
   * Play audio chunks (cancels any existing playback)
   * @param {Array<string>} audioChunks - Array of base64-encoded audio chunks
   * @returns {Promise<void>} Resolves when playback completes or is cancelled
   */
  async play(audioChunks) {
    if (!audioChunks || audioChunks.length === 0) {
      if (DEBUG_VOICE) {
        console.warn('[VoicePlaybackManager] ⚠️ play() called with empty chunks');
      }
      return;
    }

    // CRITICAL: Increment generation FIRST to invalidate any in-flight operations
    this.playbackGeneration++;
    const generation = this.playbackGeneration;
    
    if (DEBUG_VOICE) {
      console.log(`[VoicePlaybackManager] ▶️ PLAY requested, generation: ${generation}, chunks: ${audioChunks.length}`);
    }

    // CRITICAL: Cancel any existing playback IMMEDIATELY
    if (this.state !== 'idle') {
      if (DEBUG_VOICE) {
        console.log(`[VoicePlaybackManager] 🛑 Cancelling existing playback (gen ${this.currentGeneration}, state: ${this.state}) for new playback (gen ${generation})`);
      }
      // Hard stop all sources and clear queue
      this._hardStopAllSources();
      this.chunkQueue = [];
      this.isProcessingQueue = false;
      // Force transition to stopping then idle
      if (this.state !== 'stopping') {
        this._transitionTo('stopping', 'cancelled for new playback');
      }
      this._transitionTo('idle', 'cancelled for new playback');
    }

    // CRITICAL: Set current generation BEFORE transitioning (so getCurrentGeneration() works immediately)
    // This must happen AFTER stopping old playback
    this.currentGeneration = generation;
    
    // Transition to loading
    this._transitionTo('loading', `generation ${generation}`);

    // Check if cancelled before starting
    if (this._isCancelled(generation)) {
      if (DEBUG_VOICE) {
        console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} cancelled before loading`);
      }
      this._transitionTo('idle', 'cancelled before load');
      return;
    }

    // Ensure AudioContext is running
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        if (DEBUG_VOICE) {
          console.log(`[VoicePlaybackManager] 🔊 AudioContext resumed, state: ${this.audioContext.state}`);
        }
      } catch (error) {
        if (DEBUG_VOICE) {
          console.error('[VoicePlaybackManager] ❌ Failed to resume AudioContext:', error);
        }
        this._transitionTo('error', 'AudioContext resume failed');
        return;
      }
    }

    // Check if cancelled after resume
    if (this._isCancelled(generation)) {
      if (DEBUG_VOICE) {
        console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} cancelled after resume`);
      }
      this._transitionTo('idle', 'cancelled after resume');
      return;
    }

    // Set up queue
    this.chunkQueue = [...audioChunks];
    this.isProcessingQueue = false;

    // Transition to playing
    this._transitionTo('playing', `generation ${generation}`);

    // Process queue
    try {
      await this._processQueue(generation);
      
      // Check if we completed or were cancelled
      if (this._isCancelled(generation)) {
        if (DEBUG_VOICE) {
          console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} was cancelled during playback`);
        }
        this._transitionTo('idle', 'cancelled during playback');
      } else if (this.currentGeneration === generation) {
        // Only transition to idle if this generation is still current
        if (DEBUG_VOICE) {
          console.log(`[VoicePlaybackManager] ✅ Generation ${generation} completed`);
        }
        this._transitionTo('idle', 'playback complete');
      }
    } catch (error) {
      if (DEBUG_VOICE) {
        console.error(`[VoicePlaybackManager] ❌ Error processing queue for generation ${generation}:`, error);
      }
      this._transitionTo('error', `error: ${error.message}`);
      
      // Clean up on error
      this._hardStopAllSources();
      this.chunkQueue = [];
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process audio chunk queue sequentially
   */
  async _processQueue(generation) {
    // CRITICAL: Prevent multiple queue processors from running simultaneously
    if (this.isProcessingQueue) {
      if (DEBUG_VOICE) {
        console.warn('[VoicePlaybackManager] ⚠️ Queue processor already running, ignoring duplicate call');
      }
      return;
    }

    // CRITICAL: Check if cancelled before starting
    if (this._isCancelled(generation)) {
      if (DEBUG_VOICE) {
        console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} cancelled before queue processing`);
      }
      return;
    }

    this.isProcessingQueue = true;
    const playedHashes = new Set(); // Deduplicate chunks

    try {
      while (this.chunkQueue.length > 0 && !this._isCancelled(generation)) {
        const chunk = this.chunkQueue.shift();
        if (!chunk) continue;

        // Deduplicate
        const hash = chunk.substring(0, 50) + chunk.length;
        if (playedHashes.has(hash)) {
          if (DEBUG_VOICE) {
            console.log('[VoicePlaybackManager] ⏭️ Skipping duplicate chunk');
          }
          continue;
        }
        playedHashes.add(hash);

        // CRITICAL: Check cancellation before playing each chunk
        if (this._isCancelled(generation)) {
          if (DEBUG_VOICE) {
            console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} cancelled before chunk playback`);
          }
          break;
        }

        // Play chunk and wait for completion
        await this._playChunk(chunk, generation);

        // CRITICAL: Check if cancelled after each chunk
        if (this._isCancelled(generation)) {
          if (DEBUG_VOICE) {
            console.log(`[VoicePlaybackManager] ⏭️ Generation ${generation} cancelled after chunk playback`);
          }
          break;
        }
      }
    } finally {
      // Always reset processing flag, even if cancelled or errored
      this.isProcessingQueue = false;
    }
  }

  /**
   * Play a single audio chunk
   */
  async _playChunk(audioBase64, generation) {
    return new Promise((resolve) => {
      // Check if cancelled before starting
      if (this._isCancelled(generation)) {
        if (DEBUG_VOICE) {
          console.log(`[VoicePlaybackManager] ⏭️ Chunk cancelled before decode (gen ${generation})`);
        }
        resolve();
        return;
      }

      try {
        // Decode base64 to Float32Array
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert PCM16 to Float32
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }

        // Check if cancelled after decode
        if (this._isCancelled(generation)) {
          if (DEBUG_VOICE) {
            console.log(`[VoicePlaybackManager] ⏭️ Chunk cancelled after decode (gen ${generation})`);
          }
          resolve();
          return;
        }

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
        audioBuffer.copyToChannel(float32, 0);

        // Create source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // CRITICAL: Check cancellation one more time before adding to active sources
        if (this._isCancelled(generation)) {
          if (DEBUG_VOICE) {
            console.log(`[VoicePlaybackManager] ⏭️ Chunk cancelled before adding to active sources (gen ${generation})`);
          }
          resolve();
          return;
        }

        // Add to active sources for cleanup (must be before start())
        this.activeSources.push(source);

        // Calculate duration
        const duration = float32.length / 24000; // 24kHz sample rate
        const timeoutMs = Math.max(Math.ceil(duration * 1000) + 150, 50);

        let resolved = false;
        let timeoutId = null;
        const resolveOnce = () => {
          if (resolved) return;
          resolved = true;
          
          // Clear timeout if it exists
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Remove from active sources
          const index = this.activeSources.indexOf(source);
          if (index > -1) {
            this.activeSources.splice(index, 1);
          }
          
          resolve();
        };

        // CRITICAL: Handle completion - check cancellation before resolving
        source.onended = () => {
          // Only log if not cancelled
          if (DEBUG_VOICE && !this._isCancelled(generation)) {
            console.log(`[VoicePlaybackManager] ✅ Chunk finished (gen ${generation}), duration: ${duration.toFixed(3)}s`);
          }
          resolveOnce();
        };

        source.onerror = (error) => {
          if (DEBUG_VOICE) {
            console.error(`[VoicePlaybackManager] ❌ Chunk error (gen ${generation}):`, error);
          }
          resolveOnce();
        };

        // CRITICAL: Final cancellation check before starting playback
        if (this._isCancelled(generation)) {
          if (DEBUG_VOICE) {
            console.log(`[VoicePlaybackManager] ⏭️ Chunk cancelled immediately before start() (gen ${generation})`);
          }
          // Remove from active sources since we're not starting it
          const index = this.activeSources.indexOf(source);
          if (index > -1) {
            this.activeSources.splice(index, 1);
          }
          resolve();
          return;
        }

        // Start playback
        try {
          source.start(0);
          
          if (DEBUG_VOICE && !this._isCancelled(generation)) {
            console.log(`[VoicePlaybackManager] 🔊 Playing chunk (gen ${generation}), duration: ${duration.toFixed(3)}s`);
          }
        } catch (startError) {
          if (DEBUG_VOICE) {
            console.error(`[VoicePlaybackManager] ❌ Error starting chunk (gen ${generation}):`, startError);
          }
          // Remove from active sources on error
          const index = this.activeSources.indexOf(source);
          if (index > -1) {
            this.activeSources.splice(index, 1);
          }
          resolve();
          return;
        }

        // Fallback timeout
        timeoutId = setTimeout(() => {
          if (!resolved) {
            if (DEBUG_VOICE) {
              console.warn(`[VoicePlaybackManager] ⏱️ Chunk timeout (gen ${generation}), forcing resolve`);
            }
            resolveOnce();
          }
        }, timeoutMs);

      } catch (error) {
        if (DEBUG_VOICE) {
          console.error(`[VoicePlaybackManager] ❌ Error playing chunk (gen ${generation}):`, error);
        }
        resolve(); // Resolve to continue queue
      }
    });
  }

  /**
   * Check if a generation has been cancelled
   */
  _isCancelled(generation) {
    return this.currentGeneration !== generation || this.playbackGeneration > generation;
  }

  /**
   * Add chunks to current playback (for streaming)
   */
  addChunks(audioChunks, generation) {
    // Only add chunks if they match current generation
    if (generation !== this.currentGeneration) {
      if (DEBUG_VOICE) {
        console.log(`[VoicePlaybackManager] ⏭️ Ignoring chunks for old generation ${generation} (current: ${this.currentGeneration})`);
      }
      return;
    }

    if (this.state !== 'playing' && this.state !== 'loading' && this.state !== 'idle') {
      if (DEBUG_VOICE) {
        console.warn(`[VoicePlaybackManager] ⚠️ addChunks() called in state: ${this.state}`);
      }
      return;
    }

    this.chunkQueue.push(...audioChunks);
    
    if (DEBUG_VOICE) {
      console.log(`[VoicePlaybackManager] 📦 Added ${audioChunks.length} chunks (gen ${generation}), queue length: ${this.chunkQueue.length}`);
    }

    // Restart queue processor if not running and we're in playing state
    // Also restart if in loading state (chunks arrived before playback started)
    if (!this.isProcessingQueue && this.chunkQueue.length > 0 && 
        (this.state === 'playing' || this.state === 'loading')) {
      this._processQueue(generation).catch(error => {
        if (DEBUG_VOICE) {
          console.error('[VoicePlaybackManager] ❌ Queue processor error:', error);
        }
        this._transitionTo('error', `queue error: ${error.message}`);
      });
    }
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    if (DEBUG_VOICE) {
      console.log('[VoicePlaybackManager] 🧹 Destroying manager');
    }
    
    this.stop();
    this.audioContext = null;
    this.onStateChange = null;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoicePlaybackManager;
}

