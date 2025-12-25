/**
 * VoiceAudioEngine - SINGLETON Audio Output Engine
 * 
 * CRITICAL: This is the ONLY place that creates/manages audio output.
 * Enforces single audio pipeline with proper scheduling to prevent overlaps.
 * 
 * Features:
 * - Single AudioContext ownership
 * - Proper nextStartTime scheduling (prevents overlapping chunks)
 * - Generation + response_id gating (drops old chunks)
 * - Hard stop with complete cleanup
 * - AnalyserNode for real-time audio amplitude (for UI waves)
 * 
 * Usage:
 *   import { voiceAudioEngine } from './voice-audio-engine.js';
 *   voiceAudioEngine.initialize(audioContext);
 *   voiceAudioEngine.reset(gen, responseId);
 *   voiceAudioEngine.pushPcmChunk(pcmFloat32Array, gen, responseId);
 *   voiceAudioEngine.hardStop('user cancelled');
 */

const DEBUG_VOICE = typeof window !== 'undefined' && window.DEBUG_VOICE !== undefined 
  ? window.DEBUG_VOICE 
  : true;

class VoiceAudioEngine {
  constructor() {
    this.engineId = `engine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.audioContext = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.isInitialized = false;
    
    // Scheduling state
    this.nextStartTime = 0; // Scheduled start time for next chunk (in seconds, relative to audioContext.currentTime)
    this.activeSources = []; // All currently playing AudioBufferSourceNode instances
    this.activeResponseId = null;
    this.activeGen = null;
    
    // State callbacks
    this.onListeningStateChange = null;
    this.onSpeakingStateChange = null;
    
    // Internal state
    this.isListening = false;
    this.isSpeaking = false;
    this.queueDrained = false;
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] ✅ Created engine: ${this.engineId}`);
    }
  }

  /**
   * Initialize with AudioContext (must be called before use)
   */
  initialize(audioContext) {
    if (!audioContext) {
      throw new Error('AudioContext is required');
    }
    
    // Dispose old engine if exists
    this.dispose();
    
    this.audioContext = audioContext;
    
    // Create output chain: analyser -> gain -> destination
    // AnalyserNode for real-time amplitude (for UI waves)
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 256; // Small FFT for performance
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // GainNode for volume control
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect: analyser -> gain -> destination
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(audioContext.destination);
    
    // Reset scheduling
    this.nextStartTime = audioContext.currentTime;
    
    this.isInitialized = true;
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] ✅ Initialized engine ${this.engineId} with AudioContext, state: ${audioContext.state}`);
    }
  }

  /**
   * Reset for new response (increments generation, sets response_id)
   */
  reset(gen, responseId) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized. Call initialize(audioContext) first.');
    }
    
    const oldGen = this.activeGen;
    const oldResponseId = this.activeResponseId;
    
    // Hard stop any existing playback
    this.hardStop('new response started');
    
    // Set new active generation and response
    this.activeGen = gen;
    this.activeResponseId = responseId;
    
    // CRITICAL: Always reset scheduling to current time (don't preserve old nextStartTime)
    // This ensures no overlaps from previous response
    this.nextStartTime = this.audioContext.currentTime + 0.02; // Small safety lead (20ms)
    
    this.queueDrained = false;
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] 🔄 RESET: gen ${oldGen}→${gen}, responseId ${oldResponseId}→${responseId}, nextStartTime: ${this.nextStartTime.toFixed(3)}`);
    }
  }

  /**
   * Push PCM chunk for playback (with generation/response_id gating)
   */
  pushPcmChunk(pcmFloat32Array, gen, responseId) {
    if (!this.isInitialized) {
      console.error('[VoiceAudioEngine] ❌ Not initialized, dropping chunk');
      return;
    }
    
    // CRITICAL: Drop chunk if generation or response_id doesn't match
    if (gen !== this.activeGen || responseId !== this.activeResponseId) {
      if (DEBUG_VOICE) {
        console.log(`[VoiceAudioEngine] ⏭️ DISCARDING chunk: gen ${gen} !== ${this.activeGen} OR responseId ${responseId} !== ${this.activeResponseId}`);
      }
      return;
    }
    
    // Update speaking state on first chunk
    if (!this.isSpeaking) {
      this.setSpeakingState(true);
    }
    
    try {
      // Create AudioBuffer from PCM Float32Array
      const sampleRate = this.audioContext.sampleRate;
      const bufferLength = pcmFloat32Array.length;
      const audioBuffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
      audioBuffer.copyToChannel(pcmFloat32Array, 0);
      
      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to analyser (which connects to gain -> destination)
      source.connect(this.analyserNode);
      
      // Calculate duration
      const duration = audioBuffer.duration;
      
      // CRITICAL: Schedule with nextStartTime (prevents overlaps)
      const scheduledStartTime = this.nextStartTime;
      
      // Ensure we don't schedule in the past
      const minStartTime = this.audioContext.currentTime + 0.01; // 10ms minimum lead
      const actualStartTime = Math.max(scheduledStartTime, minStartTime);
      
      // Update nextStartTime for next chunk
      this.nextStartTime = actualStartTime + duration;
      
      // Track this source
      this.activeSources.push(source);
      
      // Remove from active sources when done
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        
        // Check if queue is drained (no more active sources)
        if (this.activeSources.length === 0) {
          this.queueDrained = true;
          // Update speaking state to false after a small delay (for smooth transition)
          setTimeout(() => {
            if (this.activeSources.length === 0 && this.queueDrained) {
              this.setSpeakingState(false);
            }
          }, 50);
        }
        
        if (DEBUG_VOICE) {
          console.log(`[VoiceAudioEngine] ✅ Chunk finished, remaining sources: ${this.activeSources.length}`);
        }
      };
      
      // CRITICAL: Set global flag to allow this ONE playback call (bypasses AudioBufferSourceNode override)
      // Use try-finally to ensure flag is always cleared, even if start() throws or multiple chunks run concurrently
      if (typeof window !== 'undefined') {
        window._allowAudioPlayback = true;
      }
      
      try {
        // Schedule playback (synchronous call)
      source.start(actualStartTime);
      } finally {
        // Always clear flag, even if start() throws or if another chunk is processing
        // This prevents race conditions with concurrent chunk processing
      if (typeof window !== 'undefined') {
        window._allowAudioPlayback = false;
        }
      }
      
      if (DEBUG_VOICE) {
        console.log(`[VoiceAudioEngine] 🔊 SCHEDULED chunk: startTime=${actualStartTime.toFixed(3)}, duration=${duration.toFixed(3)}, nextStartTime=${this.nextStartTime.toFixed(3)}, gen=${gen}, responseId=${responseId}`);
      }
      
    } catch (error) {
      console.error('[VoiceAudioEngine] ❌ Error pushing PCM chunk:', error);
    }
  }

  /**
   * Hard stop all playback immediately
   */
  hardStop(reason = 'unknown') {
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] 🛑 HARD STOP (${reason}), active sources: ${this.activeSources.length}`);
    }
    
    // Stop all active sources
    this.activeSources.forEach((source, index) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source may already be stopped/disconnected
        if (DEBUG_VOICE) {
          console.warn(`[VoiceAudioEngine] Warning stopping source ${index}:`, e.message);
        }
      }
    });
    
    // Clear active sources array
    this.activeSources = [];
    
    // Reset scheduling
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
    
    // Update speaking state
    this.setSpeakingState(false);
    this.queueDrained = true;
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] ✅ HARD STOP complete`);
    }
  }

  /**
   * Set listening state (for UI)
   */
  setListeningState(isListening) {
    if (this.isListening === isListening) return;
    
    this.isListening = isListening;
    
    if (this.onListeningStateChange) {
      this.onListeningStateChange(isListening);
    }
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] 🎤 Listening state: ${isListening}`);
    }
  }

  /**
   * Set speaking state (for UI)
   */
  setSpeakingState(isSpeaking) {
    if (this.isSpeaking === isSpeaking) return;
    
    this.isSpeaking = isSpeaking;
    
    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange(isSpeaking);
    }
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] 🔊 Speaking state: ${isSpeaking}`);
    }
  }

  /**
   * Get current audio amplitude (0-1) for UI waves
   */
  getAmplitude() {
    if (!this.analyserNode) return 0;
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    
    // Calculate RMS (root mean square) for amplitude
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // Normalize to 0-1 range
    return Math.min(rms / 255, 1.0);
  }

  /**
   * Dispose engine (cleanup all resources)
   */
  dispose() {
    this.hardStop('dispose');
    
    // Disconnect nodes
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {}
      this.analyserNode = null;
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {}
      this.gainNode = null;
    }
    
    // Don't close AudioContext (it might be reused)
    this.audioContext = null;
    this.isInitialized = false;
    
    if (DEBUG_VOICE) {
      console.log(`[VoiceAudioEngine] 🧹 Disposed engine ${this.engineId}`);
    }
  }
}

// SINGLETON PATTERN: Export exactly ONE instance
let _singletonInstance = null;

function getVoiceAudioEngine() {
  if (!_singletonInstance) {
    _singletonInstance = new VoiceAudioEngine();
    
    if (DEBUG_VOICE) {
      console.log('[VoiceAudioEngine] 🎯 SINGLETON created');
    }
  }
  return _singletonInstance;
}

// Export singleton instance
const voiceAudioEngine = getVoiceAudioEngine();

// Global access
if (typeof window !== 'undefined') {
  window.VoiceAudioEngine = VoiceAudioEngine; // For testing
  window.voiceAudioEngine = voiceAudioEngine; // Global access
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoiceAudioEngine, voiceAudioEngine, getVoiceAudioEngine };
}
