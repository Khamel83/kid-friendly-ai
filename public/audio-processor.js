class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options.processorOptions.sampleRate || 16000;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input.length > 0) {
      // Send the audio data to the main thread
      this.port.postMessage(input[0].buffer, [input[0].buffer]);
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor); 