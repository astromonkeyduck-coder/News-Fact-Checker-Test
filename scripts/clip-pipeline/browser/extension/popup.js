const REPO_DIR = '~/breaking-news-game';

const bufferSelect = document.getElementById('bufferSeconds');
const saveBtn = document.getElementById('saveNow');
const openYtBtn = document.getElementById('openYoutube');
const recheckBtn = document.getElementById('recheckSetup');
const copyInstallBtn = document.getElementById('copyInstallCmd');
const copyServerBtn = document.getElementById('copyServerCmd');
const installCmdEl = document.getElementById('installCmd');
const serverCmdEl = document.getElementById('serverCmd');
const extensionIdEl = document.getElementById('extensionId');
const panelReady = document.getElementById('panelReady');
const panelNativeSetup = document.getElementById('panelNativeSetup');
const panelLocalFallback = document.getElementById('panelLocalFallback');
const serverFallbackDetails = document.getElementById('serverFallbackDetails');
const readyDetail = document.getElementById('readyDetail');
const nativeErrorEl = document.getElementById('nativeError');
const msg = document.getElementById('msg');

let installCmd = '';
let serverCmd = '';

function show(text, type) {
  msg.textContent = text;
  msg.className = `msg ${type || ''}`;
}

function buildInstallCmd(extensionId) {
  return `cd ${REPO_DIR} && npm run clip:install-native-host -- ${extensionId}`;
}

function buildServerCmd() {
  return `cd ${REPO_DIR} && npm run clip:convert-server`;
}

async function copyText(text, successLabel) {
  try {
    await navigator.clipboard.writeText(text);
    show(successLabel, 'ok');
  } catch {
    show('Copy failed — select the command manually', 'error');
  }
}

function renderSetupStatus(status) {
  const nativeOk = Boolean(status?.native?.ok);
  const localOk = Boolean(status?.localServer);
  const extensionId = status?.extensionId || chrome.runtime.id;

  installCmd = buildInstallCmd(extensionId);
  serverCmd = buildServerCmd();
  installCmdEl.textContent = installCmd;
  serverCmdEl.textContent = serverCmd;
  extensionIdEl.textContent = extensionId;

  panelReady.classList.toggle('hidden', !nativeOk);
  panelNativeSetup.classList.toggle('hidden', nativeOk);
  panelLocalFallback.classList.toggle('hidden', nativeOk || !localOk);
  serverFallbackDetails.classList.toggle('hidden', nativeOk);

  if (nativeOk) {
    readyDetail.textContent = 'Native converter connected. Saves download as MP4 automatically.';
    nativeErrorEl.classList.add('hidden');
    nativeErrorEl.textContent = '';
    show('Setup complete — ready to clip', 'ok');
  } else if (localOk) {
    nativeErrorEl.classList.toggle('hidden', !status?.nativeError);
    nativeErrorEl.textContent = status?.nativeError
      ? `Native host issue: ${status.nativeError}`
      : '';
    show('Using convert-server fallback. Install native host for fully automatic saves.', 'ok');
  } else {
    nativeErrorEl.classList.remove('hidden');
    nativeErrorEl.textContent = status?.nativeError
      ? `Native host issue: ${status.nativeError}. Confirm the Extension ID above matches your install command, then quit and reopen Chrome.`
      : 'Run the install command, quit and reopen Chrome, then reload the extension.';
    show('Setup incomplete — see details below', 'error');
  }
}

function loadSetupStatus() {
  show('Checking converter…');
  chrome.runtime.sendMessage({ type: 'GET_CONVERT_STATUS' }, (status) => {
    if (chrome.runtime.lastError) {
      show(chrome.runtime.lastError.message, 'error');
      return;
    }
    if (!status?.ok) {
      show(status?.error || 'Could not check converter status', 'error');
      return;
    }
    renderSetupStatus(status);
  });
}

chrome.storage.sync.get({ bufferSeconds: 30 }, (data) => {
  bufferSelect.value = String(data.bufferSeconds);
});

bufferSelect.addEventListener('change', () => {
  const value = parseInt(bufferSelect.value, 10);
  chrome.storage.sync.set({ bufferSeconds: value }, () => {
    show(`Buffer set to ${value}s`, 'ok');
  });
});

copyInstallBtn.addEventListener('click', () => {
  copyText(installCmd, 'Copied install command — paste in Terminal');
});

copyServerBtn.addEventListener('click', () => {
  copyText(serverCmd, 'Copied convert-server command');
});

recheckBtn.addEventListener('click', loadSetupStatus);

saveBtn.addEventListener('click', () => {
  show('Saving…');
  chrome.runtime.sendMessage({ type: 'SAVE_FROM_POPUP' }, (response) => {
    if (chrome.runtime.lastError) {
      show(chrome.runtime.lastError.message, 'error');
      return;
    }
    if (!response?.ok) {
      show(response?.error || 'Failed — open a YouTube watch page.', 'error');
      return;
    }
    const via = response.via ? ` (${response.via})` : '';
    const fmt = response.format || 'mp4';
    show(`Saved ~${response.seconds || '?'}s ${fmt}${via}`, response.warning ? 'error' : 'ok');
  });
});

openYtBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.youtube.com/' });
});

loadSetupStatus();
