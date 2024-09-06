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
      } else {
        cameraCheckbox.checked = false;
        alert('Camera permission is required to use this feature.');
      }
    } else {
      ipcRenderer.invoke('toggle-camera', false);
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

  let mediaRecorder;
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
      const sources = await ipcRenderer.invoke('get-sources');
      const source = sources[0];

      const constraints = {
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        },
      };

      let videoStream = await navigator.mediaDevices.getUserMedia(constraints);

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
          videoStream.addTrack(audioStream.getAudioTracks()[0]);
        } catch (audioError) {
          console.error('Error capturing audio:', audioError);
          alert(
            `Error capturing audio: ${audioError.message}. Continuing with video only.`
          );
        }
      }

      const options = { mimeType: 'video/webm; codecs=vp9' };
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
    }
  }

  startBtn.addEventListener('click', () => {
    if (audioCheckbox.checked && !audioDeviceSelect.value) {
      alert('Please select an audio device.');
      return;
    }
    ipcRenderer.invoke('start-recording'); // Notify main process that recording is starting
    startRecording(
      audioCheckbox.checked,
      audioDeviceSelect.value,
      cameraCheckbox.checked
    );
  });

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
    if (isRecordingCancelled) {
      console.log(
        'Recording was cancelled. No data will be processed or uploaded.'
      );
      isRecordingCancelled = false;
      return;
    }

    console.log('Recording stopped, processing data');
    const blob = new Blob(recordedChunks, { type: 'video/webm; codecs=vp9' });
    console.log('Blob created, size:', blob.size);
    const buffer = Buffer.from(await blob.arrayBuffer());
    console.log('Buffer created, length:', buffer.length);
    showLoading();
    ipcRenderer.send('save-recording', buffer);
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

  // Initialize audio devices
  populateAudioDevices();

  console.log('Renderer script loaded');
});
