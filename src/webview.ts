import * as vscode from 'vscode';

let challengePanel: vscode.WebviewPanel | undefined;

export function showChallengeWebview(context: vscode.ExtensionContext, fileName: string) {
	// Reuse existing panel if available, otherwise create new one
	if (challengePanel) {
		challengePanel.reveal(vscode.ViewColumn.Beside);
	} else {
		challengePanel = vscode.window.createWebviewPanel(
			'vshaterChallenge',
			'🔒 Unlock Your File',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				enableFindWidget: false,
				enableCommandUris: false,
				localResourceRoots: [],
			}
		);

		challengePanel.onDidDispose(() => {
			challengePanel = undefined;
		});
	}

	challengePanel.webview.html = getWebviewContent();
}

function getWebviewContent(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>VSHater Challenge</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			padding: 20px;
		}

		.container {
			background: rgba(255, 255, 255, 0.95);
			border-radius: 16px;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
			padding: 15px 30px 30px 30px;
			max-width: 500px;
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.header {
			text-align: center;
			margin-bottom: 20px;
		}

		.lock-icon {
			font-size: 48px;
			margin-bottom: 10px;
		}

		h1 {
			color: #333;
			font-size: 24px;
			margin-bottom: 10px;
		}

		.subtitle {
			color: #666;
			font-size: 14px;
		}

		.image-section {
			display: flex;
			justify-content: center;
			background: #f5f5f5;
			border-radius: 12px;
			padding: 20px;
			min-height: 300px;
			max-height: 400px;
			overflow: hidden;
		}

		.image-section img {
			max-width: 100%;
			max-height: 100%;
			border-radius: 8px;
			object-fit: contain;
		}

		.image-section.placeholder {
			display: flex;
			align-items: center;
			justify-content: center;
			color: #999;
			font-size: 14px;
		}

		.webcam-section {
			display: flex;
			justify-content: center;
			background: #000;
			border-radius: 12px;
			padding: 15px;
			min-height: 200px;
			overflow: hidden;
		}

		video {
			width: 100%;
			height: 100%;
			border-radius: 8px;
			background: #000;
		}

		.message {
			text-align: center;
			color: #666;
			font-size: 13px;
			padding: 15px;
			background: #f0f0f0;
			border-radius: 8px;
			border-left: 4px solid #667eea;
		}

		.error {
			color: #d32f2f;
			font-size: 12px;
			padding: 10px;
			background: #ffebee;
			border-radius: 6px;
			display: none;
		}

		.error.show {
			display: block;
		}

		.retry-button {
			background: #667eea;
			color: white;
			border: none;
			padding: 10px 20px;
			border-radius: 6px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			transition: background 0.2s;
		}

		.retry-button:hover {
			background: #764ba2;
		}

		.retry-button:active {
			transform: scale(0.98);
		}

		.instructions {
			font-size: 12px;
			color: #666;
			padding: 10px;
			background: #fafafa;
			border-radius: 6px;
			display: none;
		}

		.instructions.show {
			display: block;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="lock-icon">🔒</div>
			<h1>File Locked</h1>
			<p class="subtitle">Complete the challenge to unlock your file</p>
		</div>

		<div class="image-section placeholder" id="imageSection">
			<span>Loading image...</span>
		</div>

		<div class="webcam-section">
			<video id="webcam" autoplay playsinline></video>
		</div>

		<div class="message" id="successMessage">
			Your webcam is active. Complete the challenge to unlock your file.
		</div>

		<div class="error" id="errorMessage"></div>

		<div class="instructions" id="instructions">
			<strong>Webcam Permission Denied</strong><br><br>
			To use the webcam in VSCode extensions:<br>
			1. Make sure your browser/system allows webcam access<br>
			2. Check your camera privacy settings<br>
			3. Try a different application first to confirm your webcam works
		</div>

		<button class="retry-button" id="retryButton" style="display: none; width: 100%;">
			Retry Webcam Access
		</button>
	</div>

	<script>
		// Initialize webcam
		const video = document.getElementById('webcam');
		const errorMessage = document.getElementById('errorMessage');
		const successMessage = document.getElementById('successMessage');
		const instructions = document.getElementById('instructions');
		const retryButton = document.getElementById('retryButton');
		const imageSection = document.getElementById('imageSection');

		async function initWebcam() {
			try {
				// Check if mediaDevices is available
				if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
					showError('Webcam API not available in this environment');
					return;
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: 'user'
					}
				});

				video.srcObject = stream;
				successMessage.style.display = 'block';
				errorMessage.classList.remove('show');
				instructions.classList.remove('show');
				retryButton.style.display = 'none';
			} catch (err) {
				showError('Could not access webcam: ' + err.message);
				console.error('Webcam error:', err);

				// Show instructions if permission denied
				if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
					instructions.classList.add('show');
					retryButton.style.display = 'block';
				}
			}
		}

		function showError(message) {
			successMessage.style.display = 'none';
			errorMessage.textContent = message;
			errorMessage.classList.add('show');
		}

		function loadDummyImage() {
			// Create a canvas-based dummy image for demonstration
			const canvas = document.createElement('canvas');
			canvas.width = 400;
			canvas.height = 300;
			const ctx = canvas.getContext('2d');

			// Draw gradient background
			const gradient = ctx.createLinearGradient(0, 0, 400, 300);
			gradient.addColorStop(0, '#667eea');
			gradient.addColorStop(1, '#764ba2');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 400, 300);

			// Draw text
			ctx.fillStyle = '#fff';
			ctx.font = 'bold 32px Arial';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('🔐', 200, 100);
			ctx.font = '18px Arial';
			ctx.fillText('Challenge Image', 200, 200);
			ctx.fillText('Complete the task!', 200, 240);

			const img = document.createElement('img');
			img.src = canvas.toDataURL();

			imageSection.innerHTML = '';
			imageSection.classList.remove('placeholder');
			imageSection.appendChild(img);
		}

		// Retry button handler
		retryButton.addEventListener('click', () => {
			retryButton.disabled = true;
			retryButton.textContent = 'Requesting access...';
			initWebcam();
			setTimeout(() => {
				retryButton.disabled = false;
				retryButton.textContent = 'Retry Webcam Access';
			}, 2000);
		});

		// Initialize when page loads
		window.addEventListener('load', () => {
			initWebcam();
			loadDummyImage();
		});

		// Cleanup on page unload
		window.addEventListener('beforeunload', () => {
			const stream = video.srcObject;
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
			}
		});
	</script>
</body>
</html>`;
}
