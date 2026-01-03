// AudioWorklet processor for real-time audio capture
// Replaces deprecated ScriptProcessorNode
// Processes audio at 24kHz for OpenAI Realtime API

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // ~170ms at 24kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // If no input channel, skip processing
    if (input.length === 0 || input[0].length === 0) {
      return true;
    }

    const inputChannel = input[0];
    
    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];
      
      // When buffer is full, send it to main thread
      if (this.bufferIndex >= this.bufferSize) {
        // Convert Float32 to Int16 (PCM16) for OpenAI API
        const pcm16 = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          const sample = Math.max(-1, Math.min(1, this.buffer[j]));
          pcm16[j] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Send to main thread
        this.port.postMessage({
          type: 'audioData',
          data: pcm16.buffer
        }, [pcm16.buffer]);
        
        // Reset buffer
        this.bufferIndex = 0;
      }
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('voice-capture-processor', VoiceCaptureProcessor);


















