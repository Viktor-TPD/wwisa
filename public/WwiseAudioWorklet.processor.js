class WwiseAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor(nodeOptions) {
    super();
    this._initialized = false;
    this._frameCount = 0;
    this.port.onmessage = this._onmessage.bind(this);
    console.log("🎵 [WORKLET] Constructor called");
  }

  _onmessage(event) {
    const evtdata = event.data;
    console.log("🔧 [WORKLET] Received init message:", evtdata);

    if (!this.validate(evtdata)) {
      console.error("❌ [WORKLET] Invalid data!");
      return;
    }

    this._options = evtdata;
    this._numBuffers = evtdata.numbuffers;
    this._bufferLength = evtdata.bufferlen;
    this._channelCount = evtdata.channelcount;
    this._readIndex = 0;
    this._frameIndex = 0;
    this._initialized = true;

    console.log("✅ [WORKLET] Initialized successfully!");
    console.log(
      `  Buffers: ${this._numBuffers}, Length: ${this._bufferLength}, Channels: ${this._channelCount}`
    );
  }

  validate(data) {
    if (!data.buffer) return false;
    if (!data.state) return false;
    if (!data.bufferlen || data.bufferlen < 0) return false;
    if (!data.numbuffers || data.numbuffers < 0) return false;
    if (!data.channelcount || data.channelcount <= 0) return false;
    return true;
  }

  process(inputs, outputs) {
    if (!this._initialized) {
      return true;
    }

    this._frameCount++;

    var ringBufferState = new Int32Array(
      this._options.state,
      0,
      this._options.fields.NUM_FIELDS
    );
    const ringBufferData = new Float32Array(
      this._options.buffer,
      0,
      this._bufferLength * this._channelCount * this._numBuffers
    );

    if (outputs[0].length != this._channelCount) {
      console.error("[WORKLET] Channel mismatch!");
      return true;
    }

    var buffersReady = ringBufferState[this._options.fields.BUFFERS_READY];

    // Log every 100 frames (~2 seconds at 48kHz)
    if (this._frameCount % 100 === 0) {
      console.log(
        `🔊 [WORKLET] Frame ${this._frameCount}: BuffersReady=${buffersReady}`
      );
    }

    if (buffersReady > 0) {
      const inlen = this._bufferLength;
      const outlen = outputs[0][0].length;

      if (outlen > inlen - this._frameIndex) {
        console.error("[WORKLET] Frame size error");
        return true;
      }

      for (var c = 0; c < this._channelCount; c++) {
        const outputChannelData = outputs[0][c];
        const channelOffset = this._readIndex + c * inlen + this._frameIndex;
        const inputChannelData = ringBufferData.subarray(
          channelOffset,
          channelOffset + outlen
        );

        // Copy audio data to output
        outputChannelData.set(inputChannelData);

        // Log audio data every 100 frames
        if (this._frameCount % 100 === 0 && c === 0) {
          // Check if there's actual audio (non-zero values)
          const hasAudio = inputChannelData.some((v) => Math.abs(v) > 0.001);
          const maxValue = Math.max(...inputChannelData.map(Math.abs));
          console.log(
            `  📊 Channel ${c}: hasAudio=${hasAudio}, maxValue=${maxValue.toFixed(
              4
            )}`
          );
        }
      }

      this._frameIndex += outlen;
      if (this._frameIndex >= inlen) {
        Atomics.sub(ringBufferState, this._options.fields.BUFFERS_READY, 1);
        this._readIndex =
          (this._readIndex + inlen * this._channelCount) %
          (inlen * this._channelCount * this._numBuffers);
        this._frameIndex = 0;
      }
    } else {
      // Signal starvation
      Atomics.compareExchange(
        ringBufferState,
        this._options.fields.STARVING,
        0,
        1
      );
    }

    return true;
  }
}

registerProcessor("wwise-worklet-processor", WwiseAudioWorkletProcessor);
