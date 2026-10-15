const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  const isWindowMode = process.env.MODE === 'window';

  async function checkAndRequestCameraPermission() {
    try {
      const status = await ipcRenderer.invoke('check-camera-permission');
      console.log('Camera permission status:', status);

      if (status === 'unknown' || status !== 'granted') {
        console.log('Requesting camera permission...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        console.log('Camera permission granted');
        return true;
      } else if (status === 'granted') {
        return true;
      } else {
        console.log('Camera permission not granted');
        return false;
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }
  function areEnvVariablesSet() {
    const requiredEnvVariables = [
      'ACCESS_KEY',
      'ACCESS_SECRET',
      'ENDPOINT',
      'REGION',
      'BUCKET_NAME',
    ];

    for (const variable of requiredEnvVariables) {
      if (!process.env[variable]) {
        console.error(`Environment variable ${variable} is not set`);
        alert(`Please make sure all required environment variables are set.`);
        ipcRenderer.send('quit-app'); // Request the main process to close the app
        return false;
      }
    }
    return true;
  }

  // Call this function when your app starts
  // checkAndRequestCameraPermission();

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const audioCheckbox = document.getElementById('audioCheckbox');
  const audioDeviceSelect = document.getElementById('audioDeviceSelect');
  const cameraCheckbox = document.getElementById('cameraCheckbox');
  const sourceSelect = document.getElementById('sourceSelect');
  const areaCheckbox = document.getElementById('areaCheckbox');
  const qualitySelect = document.getElementById('qualitySelect');
  const formatSelect = document.getElementById('formatSelect');

  // Lower presets cap resolution, frame rate and bitrate for smaller files
  const QUALITY_PRESETS = {
    low: {
      maxWidth: 1280,
      maxHeight: 720,
      maxFrameRate: 15,
      videoBitsPerSecond: 800_000,
      audioBitsPerSecond: 64_000,
    },
    medium: {
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 30,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 96_000,
    },
    high: {
      maxWidth: 3840,
      maxHeight: 2160,
      maxFrameRate: 30,
      videoBitsPerSecond: 5_000_000,
      audioBitsPerSecond: 128_000,
    },
  };

  const FORMATS = [
    {
      id: 'webm-vp9',
      label: 'WebM (VP9)',
      mimeType: 'video/webm; codecs=vp9,opus',
      extension: 'webm',
      contentType: 'video/webm',
    },
    {
      id: 'webm-vp8',
      label: 'WebM (VP8)',
      mimeType: 'video/webm; codecs=vp8,opus',
      extension: 'webm',
      contentType: 'video/webm',
    },
    {
      id: 'mp4-h264',
      label: 'MP4 (H.264)',
      // AAC rather than Opus so the file plays in QuickTime and Safari
      mimeType: 'video/mp4; codecs=avc1,mp4a.40.2',
      extension: 'mp4',
      contentType: 'video/mp4',
    },
  ].filter((format) => MediaRecorder.isTypeSupported(format.mimeType));

  FORMATS.forEach((format) => {
    const option = document.createElement('option');
    option.value = format.id;
    option.text = format.label;
    formatSelect.appendChild(option);
  });

  qualitySelect.value = localStorage.getItem('quality') || 'medium';
  formatSelect.value = localStorage.getItem('format') || FORMATS[0]?.id;
  qualitySelect.addEventListener('change', () =>
    localStorage.setItem('quality', qualitySelect.value)
  );
  formatSelect.addEventListener('change', () =>
    localStorage.setItem('format', formatSelect.value)
  );

  // Draws the recording (screen + camera); set while recording
  let compositor = null;

  // Add minimize and close buttons for window mode
  if (isWindowMode) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.top = '5px';
    controlsDiv.style.right = '5px';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '_';
    minimizeBtn.onclick = () => ipcRenderer.send('minimize-window');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.onclick = () => ipcRenderer.send('close-window');

    controlsDiv.appendChild(minimizeBtn);
    controlsDiv.appendChild(closeBtn);
    document.body.appendChild(controlsDiv);
  }

  cameraCheckbox.addEventListener('change', async () => {
    if (cameraCheckbox.checked) {
      const permissionGranted = await checkAndRequestCameraPermission();
      if (permissionGranted) {
        ipcRenderer.invoke('toggle-camera', true);
        if (compositor) compositor.setCamera(true);
      } else {
        cameraCheckbox.checked = false;
        alert('Camera permission is required to use this feature.');
      }
    } else {
      ipcRenderer.invoke('toggle-camera', false);
      if (compositor) compositor.setCamera(false);
      await releaseCameraStream();
    }
  });

  async function releaseCameraStream() {
    const streamId = await ipcRenderer.invoke('get-camera-stream');
    if (streamId) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSourceId: streamId } },
      });
      stream.getTracks().forEach((track) => track.stop());
      await ipcRenderer.invoke('release-camera-stream');
    }
  }

  console.log('Start button found:', !!startBtn);
  console.log('Stop button found:', !!stopBtn);
  console.log('Audio checkbox found:', !!audioCheckbox);
  console.log('Audio device select found:', !!audioDeviceSelect);

  let mediaRecorder = null;
  let recordingFormat = null;
  let activeTracks = [];
  let cameraBubble = null;
  let recordedChunks = [];
  let isRecordingCancelled = false;

  const loadingOverlay = document.getElementById('loadingOverlay');

  function showLoading() {
    loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    loadingOverlay.style.display = 'none';
  }

  async function populateAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('All devices:', devices);
      const audioDevices = devices.filter(
        (device) => device.kind === 'audioinput'
      );
      console.log('Audio devices:', audioDevices);
      audioDeviceSelect.innerHTML = '';
      audioDevices.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text =
          device.label || `Microphone ${audioDeviceSelect.options.length + 1}`;
        audioDeviceSelect.appendChild(option);
      });
      console.log('Audio devices populated:', audioDeviceSelect.options.length);
    } catch (error) {
      console.error('Error populating audio devices:', error);
    }
  }

  audioCheckbox.addEventListener('change', () => {
    console.log('Audio checkbox changed, checked:', audioCheckbox.checked);
    if (audioCheckbox.checked) {
      audioDeviceSelect.classList.add('visible');
      populateAudioDevices(); // Populate devices when checked
    } else {
      audioDeviceSelect.classList.remove('visible');
    }
  });

  let sources = [];

  function selectedSource() {
    return sources.find((source) => source.id === sourceSelect.value);
  }

  function isScreenSource(source) {
    return Boolean(source) && source.id.startsWith('screen:');
  }

  // Area selection only makes sense when recording a whole screen
  function updateAreaCheckbox() {
    const enabled = isScreenSource(selectedSource());
    areaCheckbox.disabled = !enabled;
    areaCheckbox.closest('label').classList.toggle('opacity-50', !enabled);
  }

  async function populateSources() {
    try {
      sources = await ipcRenderer.invoke('get-sources');
    } catch (error) {
      console.error('Error loading sources:', error);
      return;
    }
    const previous = sourceSelect.value;
    sourceSelect.innerHTML = '';

    const screens = sources.filter(isScreenSource);
    const windows = sources.filter((source) => !isScreenSource(source));
    const groups = [
      ['Screens', screens],
      ['Windows', windows],
    ];
    groups.forEach(([label, items]) => {
      if (!items.length) return;
      const group = document.createElement('optgroup');
      group.label = label;
      items.forEach((source, index) => {
        const option = document.createElement('option');
        option.value = source.id;
        option.text =
          label === 'Screens' && screens.length > 1
            ? `Screen ${index + 1}`
            : source.name;
        group.appendChild(option);
      });
      sourceSelect.appendChild(group);
    });

    if (sources.some((source) => source.id === previous)) {
      sourceSelect.value = previous;
    }
    updateAreaCheckbox();
  }

  sourceSelect.addEventListener('change', updateAreaCheckbox);
  ipcRenderer.on('window-focused', () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') populateSources();
  });

  areaCheckbox.checked = localStorage.getItem('areaOnly') === 'true';
  areaCheckbox.addEventListener('change', () =>
    localStorage.setItem('areaOnly', areaCheckbox.checked)
  );

  // Recording didn't start: reset the tray icon and the button state
  function abortRecording() {
    ipcRenderer.invoke('stop-recording');
    releaseTracks();
    document.dispatchEvent(new Event('recording-aborted'));
  }

  function releaseTracks() {
    if (compositor) compositor.stop();
    compositor = null;
    activeTracks.forEach((track) => track.stop());
    activeTracks = [];
  }

  // Where the camera bubble window is on screen, in DIPs (null when hidden)
  ipcRenderer.on('camera-bounds', (event, bubble) => {
    cameraBubble = bubble;
  });

  function evenSize(value) {
    return Math.max(2, Math.round(value / 2) * 2);
  }

  // Draws every recorded frame onto a canvas: the screen (cropped to
  // `area.rect` when recording an area) with the camera on top. macOS screen
  // capture leaves out this app's own windows, so the camera bubble has to be
  // drawn in here rather than captured. Returns the canvas' video track.
  function createCompositor(screenTrack, { display, area }, preset) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let sized = false;

    if (area) {
      const pixelWidth = area.rect.width * display.scaleFactor;
      const pixelHeight = area.rect.height * display.scaleFactor;
      const fit = Math.min(
        1,
        preset.maxWidth / pixelWidth,
        preset.maxHeight / pixelHeight
      );
      // Encoders (H.264 especially) want even dimensions
      canvas.width = evenSize(pixelWidth * fit);
      canvas.height = evenSize(pixelHeight * fit);
      sized = true;
    }

    let screenFrame = null;
    let cameraFrame = null;
    let cameraReader = null;
    let cameraTrack = null;
    let running = true;

    // Bubble position and size in canvas pixels, kept inside the frame so the
    // camera is always recorded even if the bubble sits outside the area.
    function cameraRect() {
      const { bounds, display: bubbleDisplay } = cameraBubble;
      const onRecordedScreen =
        display &&
        bubbleDisplay.bounds.x === display.bounds.x &&
        bubbleDisplay.bounds.y === display.bounds.y;

      let x = 0;
      let y = 0;
      let scale = 1;
      if (onRecordedScreen) {
        const src = area
          ? area.rect
          : { x: 0, y: 0, width: display.bounds.width };
        scale = canvas.width / src.width;
        x = (bounds.x - display.bounds.x - src.x) * scale;
        y = (bounds.y - display.bounds.y - src.y) * scale;
      } else {
        // Window source, or bubble on another screen: same relative spot
        const db = bubbleDisplay.bounds;
        scale = Math.min(
          bubbleDisplay.scaleFactor,
          (canvas.width * 0.35) / bounds.width
        );
        x = ((bounds.x - db.x) / db.width) * canvas.width;
        y = ((bounds.y - db.y) / db.height) * canvas.height;
      }

      const width = bounds.width * scale;
      const height = bounds.height * scale;
      return {
        x: Math.min(Math.max(0, x), canvas.width - width),
        y: Math.min(Math.max(0, y), canvas.height - height),
        width,
        height,
        radius: 12 * scale,
      };
    }

    function drawScreen(frame) {
      if (area) {
        const scaleX = frame.displayWidth / display.bounds.width;
        const scaleY = frame.displayHeight / display.bounds.height;
        ctx.drawImage(
          frame,
          area.rect.x * scaleX,
          area.rect.y * scaleY,
          area.rect.width * scaleX,
          area.rect.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        );
        return;
      }
      // Windows can be resized mid-recording; letterbox to the original size
      const fit = Math.min(
        canvas.width / frame.displayWidth,
        canvas.height / frame.displayHeight
      );
      const width = frame.displayWidth * fit;
      const height = frame.displayHeight * fit;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        frame,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height
      );
    }

    function drawCamera(frame) {
      const box = cameraRect();
      // Crop the camera image to the bubble's aspect ratio ("cover")
      const frameAspect = frame.displayWidth / frame.displayHeight;
      const boxAspect = box.width / box.height;
      let sw = frame.displayWidth;
      let sh = frame.displayHeight;
      if (frameAspect > boxAspect) sw = sh * boxAspect;
      else sh = sw / boxAspect;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, box.radius);
      ctx.clip();
      // Mirrored, matching the preview bubble
      ctx.translate(box.x + box.width, box.y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        frame,
        (frame.displayWidth - sw) / 2,
        (frame.displayHeight - sh) / 2,
        sw,
        sh,
        0,
        0,
        box.width,
        box.height
      );
      ctx.restore();
    }

    function draw() {
      if (!screenFrame) return;
      if (!sized) {
        canvas.width = evenSize(screenFrame.displayWidth);
        canvas.height = evenSize(screenFrame.displayHeight);
        sized = true;
      }
      drawScreen(screenFrame);
      if (cameraFrame && cameraBubble) drawCamera(cameraFrame);
    }

    // Reads frames from a track until the reader is cancelled
    async function pump(reader, onFrame) {
      try {
        let result = await reader.read();
        while (!result.done) {
          onFrame(result.value);
          result = await reader.read();
        }
      } catch (error) {
        console.error('Error reading video frames:', error);
      }
    }

    const screenReader = new MediaStreamTrackProcessor({
      track: screenTrack,
    }).readable.getReader();
    pump(screenReader, (frame) => {
      if (screenFrame) screenFrame.close();
      screenFrame = frame;
      // The camera drives redraws when it's on, so it stays live even
      // while the screen is static (screen capture only sends changes)
      if (!cameraReader) draw();
    });

    async function startCamera() {
      if (cameraReader) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!running) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraTrack = stream.getVideoTracks()[0];
        cameraReader = new MediaStreamTrackProcessor({
          track: cameraTrack,
        }).readable.getReader();
        pump(cameraReader, (frame) => {
          if (cameraFrame) cameraFrame.close();
          cameraFrame = frame;
          draw();
        });
      } catch (error) {
        console.error('Error starting camera for recording:', error);
      }
    }

    function cancelReader(reader) {
      reader
        .cancel()
        .catch((error) => console.warn('Error cancelling frame reader:', error));
    }

    function stopCamera() {
      if (cameraReader) cancelReader(cameraReader);
      if (cameraTrack) cameraTrack.stop();
      if (cameraFrame) cameraFrame.close();
      cameraReader = null;
      cameraTrack = null;
      cameraFrame = null;
    }

    const output = canvas.captureStream(preset.maxFrameRate);
    const outputTrack = output.getVideoTracks()[0];

    return {
      track: outputTrack,
      setCamera(enabled) {
        if (enabled) startCamera();
        else stopCamera();
      },
      stop() {
        running = false;
        stopCamera();
        cancelReader(screenReader);
        if (screenFrame) screenFrame.close();
        screenFrame = null;
        outputTrack.stop();
      },
    };
  }

  startBtn.addEventListener('click', () => {
    if (audioCheckbox.checked && !audioDeviceSelect.value) {
      alert('Please select an audio device.');
      return;
    }
    if (!areEnvVariablesSet()) {
      console.log(
        'Recording cannot start due to missing environment variables.'
      );
      return;
    }
    ipcRenderer.invoke('start-recording'); // Notify main process that recording is starting
    startRecording(
      audioCheckbox.checked,
      audioDeviceSelect.value,
      cameraCheckbox.checked
    );
  });

  stopBtn.addEventListener('click', () => {
    console.log('Stop button clicked');
    ipcRenderer.invoke('stop-recording');
    stopRecording();
  });

  cancelBtn.addEventListener('click', () => {
    console.log('Stop button clicked');
    ipcRenderer.invoke('stop-recording');
    cancelRecording();
  });

  async function startRecording(recordAudio, audioDeviceId, enableCamera) {
    try {
      // The chosen window may have closed since the list was loaded
      await populateSources();
      const source = selectedSource() || sources.find(isScreenSource);
      if (!source) throw new Error('No screen or window available to record');

      const preset =
        QUALITY_PRESETS[qualitySelect.value] || QUALITY_PRESETS.medium;
      recordingFormat =
        FORMATS.find((format) => format.id === formatSelect.value) ||
        FORMATS[0];

      let area = null;
      if (areaCheckbox.checked && isScreenSource(source)) {
        area = await ipcRenderer.invoke('select-area', source.display_id);
        if (!area) {
          console.log('Area selection cancelled');
          abortRecording();
          return;
        }
      }

      // When cropping, capture the screen at full resolution and let the
      // crop step apply the quality preset's size limit instead.
      const mandatory = {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxWidth: area
          ? Math.round(area.display.width * area.display.scaleFactor)
          : preset.maxWidth,
        maxHeight: area
          ? Math.round(area.display.height * area.display.scaleFactor)
          : preset.maxHeight,
        maxFrameRate: preset.maxFrameRate,
      };

      const captureStream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory },
      });
      const captureTrack = captureStream.getVideoTracks()[0];
      activeTracks.push(captureTrack);

      const display = isScreenSource(source)
        ? await ipcRenderer.invoke('get-display', source.display_id)
        : null;
      compositor = createCompositor(captureTrack, { display, area }, preset);
      if (enableCamera) compositor.setCamera(true);

      const videoStream = new MediaStream([compositor.track]);

      if (recordAudio && audioDeviceId) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: audioDeviceId },
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
          });
          const audioTrack = audioStream.getAudioTracks()[0];
          activeTracks.push(audioTrack);
          videoStream.addTrack(audioTrack);
        } catch (audioError) {
          console.error('Error capturing audio:', audioError);
          alert(
            `Error capturing audio: ${audioError.message}. Continuing with video only.`
          );
        }
      }

      const options = {
        mimeType: recordingFormat.mimeType,
        videoBitsPerSecond: preset.videoBitsPerSecond,
        audioBitsPerSecond: preset.audioBitsPerSecond,
      };
      mediaRecorder = new MediaRecorder(videoStream, options);

      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.onstop = handleStop;

      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      cancelBtn.disabled = false;
    } catch (e) {
      console.error('Error starting recording:', e);
      alert(`Error starting recording: ${e.message}`);
      abortRecording();
    }
  }

  function stopRecording() {
    console.log('Stopping recording');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log('MediaRecorder stopped');
      startBtn.disabled = false;
      stopBtn.disabled = true;
      console.log('Buttons updated');
    } else {
      console.log('MediaRecorder not active, cannot stop');
    }
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      isRecordingCancelled = true;
      mediaRecorder.stop();
      recordedChunks = [];
      startBtn.disabled = false;
      stopBtn.disabled = true;
      cancelBtn.disabled = true;
      alert('Recording cancelled. No data will be uploaded.');
    }
  }

  function handleDataAvailable(e) {
    console.log('Data available');
    recordedChunks.push(e.data);
  }

  async function handleStop() {
    releaseTracks();
    if (isRecordingCancelled) {
      console.log(
        'Recording was cancelled. No data will be processed or uploaded.'
      );
      isRecordingCancelled = false;
      return;
    }

    console.log('Recording stopped, processing data');
    const blob = new Blob(recordedChunks, { type: recordingFormat.mimeType });
    console.log('Blob created, size:', blob.size);
    const buffer = Buffer.from(await blob.arrayBuffer());
    console.log('Buffer created, length:', buffer.length);
    showLoading();
    ipcRenderer.send('save-recording', buffer, {
      extension: recordingFormat.extension,
      contentType: recordingFormat.contentType,
    });
    console.log('Save recording message sent to main process');
    recordedChunks = [];
  }

  ipcRenderer.on('recording-saved', (event, url) => {
    console.log('Recording saved and uploaded successfully');
    console.log('Video URL:', url);
    hideLoading();
    // alert(`Recording saved and uploaded successfully. Video URL: ${url}`);
  });

  ipcRenderer.on('recording-error', (event, error) => {
    console.error('Error saving or uploading recording:', error);
    alert(`Error saving or uploading recording: ${error}`);
    hideLoading();
  });

  // Initialize audio devices and recording sources
  populateAudioDevices();
  populateSources();

  console.log('Renderer script loaded');
});
