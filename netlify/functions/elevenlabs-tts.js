// ElevenLabs Text-to-Speech API integration
// Converts text to high-quality audio using ElevenLabs voices

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "API key not configured. Please set ELEVENLABS_API_KEY in environment variables." 
        }),
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed. Use POST." }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { text, voice_id, model_id, stability, similarity_boost, style, use_speaker_boost } = body;

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Text is required." }),
      };
    }

    // Default to a high-quality ElevenLabs voice if not specified
    // Popular voices: Rachel, Domi, Bella, Antoni, Elli, Josh, Arnold, Adam, Sam
    const defaultVoiceId = voice_id || "21m00Tcm4TlvDq8ikWAM"; // Rachel - popular default
    
    // Default model (eleven_multilingual_v2 is good for multiple languages)
    const model = model_id || "eleven_multilingual_v2";
    
    // Voice settings (0.0 to 1.0)
    const voiceSettings = {
      stability: stability !== undefined ? stability : 0.5,
      similarity_boost: similarity_boost !== undefined ? similarity_boost : 0.75,
      style: style !== undefined ? style : 0.0,
      use_speaker_boost: use_speaker_boost !== undefined ? use_speaker_boost : true
    };

    console.log(`[ElevenLabs TTS] Generating audio for ${text.length} characters with voice ${defaultVoiceId}`);

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: voiceSettings
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs TTS] API error:', response.status, errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `ElevenLabs API error: ${response.status}`,
          details: errorText
        }),
      };
    }

    // Get audio as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for transmission
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    // Calculate character count for billing
    const characterCount = text.length;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: base64Audio,
        format: 'mp3',
        character_count: characterCount,
        voice_id: defaultVoiceId,
        model_id: model
      }),
    };

  } catch (error) {
    console.error('[ElevenLabs TTS] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }),
    };
  }
};

