const { ipcRenderer, app } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  const isWindowMode = process.env.MODE === 'window';

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
        ipcRenderer.send('quit-app'); // Solicita ao processo principal para fechar o aplicativo
        return false;
      }
    }
    return true;
  }

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const cancelBtn = document.getElementById('cancelBtn');

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

  console.log('Start button found:', !!startBtn);
  console.log('Stop button found:', !!stopBtn);

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

  startBtn.addEventListener('click', () => {
    if (!areEnvVariablesSet()) {
      console.log(
        'Recording cannot start due to missing environment variables.'
      );
      return;
    }

    ipcRenderer.invoke('start-recording');
    startRecording();
  });

  stopBtn.addEventListener('click', () => {
    console.log('Stop button clicked');
    ipcRenderer.invoke('stop-recording');
    stopRecording();
  });

  cancelBtn.addEventListener('click', () => {
    console.log('Cancel button clicked');
    ipcRenderer.invoke('stop-recording');
    cancelRecording();
  });

  async function startRecording() {
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

  function stopRecording() {
    console.log('Stopping recording');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log('MediaRecorder stopped');
      startBtn.disabled = false;
      stopBtn.disabled = true;
      cancelBtn.disabled = true;
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

  console.log('Renderer script loaded');
});
