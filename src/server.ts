import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { decryptContent } from './encryption';

interface ChallengeSession {
	fileUri: string;
	fileName: string;
	onComplete: (success: boolean) => void;
	onError: (error: string) => void;
}

let server: http.Server | null = null;
let session: ChallengeSession | null = null;
const PORT = 3742; // Use a less common port to avoid conflicts

export function startServer(): Promise<number> {
	return new Promise((resolve, reject) => {
		if (server) {
			resolve(PORT);
			return;
		}

		server = http.createServer((req, res) => {
			const parsedUrl = url.parse(req.url || '', true);
			const pathname = parsedUrl.pathname || '';

			// Enable CORS
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

			if (req.method === 'OPTIONS') {
				res.writeHead(200);
				res.end();
				return;
			}

			// Serve static assets
			if (pathname.startsWith('/assets/')) {
				// Try multiple possible paths for assets
				const possiblePaths = [
					path.join(__dirname, '..', 'src', pathname),
					path.join(__dirname, pathname),
					path.join(__dirname, '..', pathname),
					path.join(process.cwd(), pathname),
				];

				for (const assetPath of possiblePaths) {
					try {
						const stat = fs.statSync(assetPath);
						if (stat.isFile()) {
							const ext = path.extname(assetPath).toLowerCase();
							const mimeTypes: { [key: string]: string } = {
								'.jpg': 'image/jpeg',
								'.jpeg': 'image/jpeg',
								'.png': 'image/png',
								'.gif': 'image/gif',
								'.webp': 'image/webp'
							};
							const contentType = mimeTypes[ext] || 'application/octet-stream';
							res.writeHead(200, { 'Content-Type': contentType });
							res.end(fs.readFileSync(assetPath));
							return;
						}
					} catch (err) {
						// Try next path
					}
				}
			}

			if (pathname === '/' && req.method === 'GET') {
				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(getChallengeHTML());
			} else if (pathname === '/complete' && req.method === 'POST') {
				let body = '';

				req.on('data', (chunk) => {
					body += chunk.toString();
				});

				req.on('end', () => {
					try {
						const data = JSON.parse(body);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true, message: 'Challenge completed!' }));

						if (session) {
							session.onComplete(true);
							session = null;
						}
					} catch (err) {
						res.writeHead(400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
					}
				});
			} else if (pathname === '/health' && req.method === 'GET') {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ status: 'ok' }));
			} else {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Not found' }));
			}
		});

		server.listen(PORT, 'localhost', () => {
			console.log(`Challenge server started on localhost:${PORT}`);
			resolve(PORT);
		});

		server.on('error', (err) => {
			console.error('Server error:', err);
			reject(err);
		});
	});
}

export function stopServer(): Promise<void> {
	return new Promise((resolve) => {
		if (server) {
			server.close(() => {
				server = null;
				console.log('Challenge server stopped');
				resolve();
			});
		} else {
			resolve();
		}
	});
}

export function setSession(challengeSession: ChallengeSession) {
	session = challengeSession;
}

export function clearSession() {
	session = null;
}

export function getServerUrl(): string {
	return `http://localhost:${PORT}`;
}

const CHALLENGE_IMAGES = [
	'/assets/67.jpg',
	'/assets/flight-emote.jpg',
	'/assets/monkey.jpg'
];

function getChallengeHTML(): string {
	const randomImage = CHALLENGE_IMAGES[Math.floor(Math.random() * CHALLENGE_IMAGES.length)];
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>VSHater Challenge</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700&family=Manrope:wght@400;600&display=swap" rel="stylesheet">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: 'Manrope', sans-serif;
			background: #0a0e27;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			padding: 16px 10px;
		}

		.container {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 12px;
			width: 100%;
			max-width: 1000px;
		}

		.header {
			text-align: center;
		}

		.lock-icon {
			font-size: 28px;
		}

		h1 {
			font-family: 'Archivo', sans-serif;
			font-size: 28px;
			font-weight: 700;
			letter-spacing: -1px;
			background: linear-gradient(135deg, #00d9ff 0%, #0099ff 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			display: flex;
			align-items: center;
			gap: 8px;
			justify-content: center;
			margin: 0;
		}

		.content {
			display: flex;
			flex-direction: row;
			gap: 12px;
			width: 100%;
		}

		.card {
			flex: 1;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid rgba(0, 217, 255, 0.2);
			border-radius: 16px;
			overflow: hidden;
			backdrop-filter: blur(10px);
			transition: all 0.3s ease;
			min-height: 260px;
			position: relative;
		}

		.card:hover {
			border-color: rgba(0, 217, 255, 0.4);
			background: rgba(255, 255, 255, 0.08);
			box-shadow: 0 8px 32px rgba(0, 217, 255, 0.1);
		}

		.progress-section {
			display: flex;
			align-items: center;
			gap: 12px;
			width: 100%;
			max-width: 1000px;
			padding: 0 10px;
		}

		.progress-bar-wrapper {
			flex: 1;
			height: 5px;
			background: rgba(0, 217, 255, 0.1);
			border-radius: 2.5px;
			overflow: hidden;
			border: 1px solid rgba(0, 217, 255, 0.2);
		}

		.progress-bar {
			height: 100%;
			background: linear-gradient(90deg, #00d9ff, #0099ff);
			transition: width 0.4s ease;
			border-radius: 2.5px;
		}

		.progress-text {
			font-size: 11px;
			font-weight: 600;
			color: #00d9ff;
			letter-spacing: 0.5px;
			min-width: 28px;
			text-align: center;
			white-space: nowrap;
		}

		.image-section {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			background: #1a1f3a;
		}

		.image-section img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
		}

		.webcam-section {
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			background: #000;
			position: relative;
		}

		video {
			width: 100%;
			height: 100%;
			display: block;
			object-fit: cover;
		}

		.webcam-error {
			position: absolute;
			inset: 0;
			display: none;
			align-items: center;
			justify-content: center;
			color: #ff4d6d;
			font-size: 16px;
			text-align: center;
			padding: 40px;
			background: rgba(0, 0, 0, 0.95);
			backdrop-filter: blur(4px);
		}

		.webcam-error.show {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.hidden {
			display: none;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1><span class="lock-icon">🔒</span> FILE LOCKED</h1>
		</div>

		<div class="content">
			<div class="card" id="imageCard">
				<div class="image-section" id="imageSection">
					<img id="challengeImage" src="${randomImage}" alt="Challenge" />
				</div>
			</div>

			<div class="card" id="webcamCard">
				<div class="webcam-section">
					<video id="webcam" autoplay playsinline muted></video>
					<div class="webcam-error" id="webcamError"></div>
				</div>
			</div>
		</div>

		<div class="progress-section">
			<div class="progress-bar-wrapper">
				<div class="progress-bar" id="overallProgressBar"></div>
			</div>
			<div class="progress-text" id="overallProgressText">0/3</div>
		</div>
	</div>

	<script>
		const IMAGES = ['${CHALLENGE_IMAGES[0]}', '${CHALLENGE_IMAGES[1]}', '${CHALLENGE_IMAGES[2]}'];

		// Image carousel
		let imageIndex = 0;
		const challengeImage = document.getElementById('challengeImage');
		const imageCard = document.getElementById('imageCard');

		// Webcam carousel (3 views)
		let webcamIndex = 0;
		const video = document.getElementById('webcam');
		const webcamError = document.getElementById('webcamError');
		const webcamCard = document.getElementById('webcamCard');

		// Overall progress
		const overallProgressBar = document.getElementById('overallProgressBar');
		const overallProgressText = document.getElementById('overallProgressText');

		let stream = null;

		function updateOverallProgress() {
			const totalSteps = imageIndex + 1;
			const percentage = (totalSteps / 3) * 100;
			overallProgressBar.style.width = percentage + '%';
			overallProgressText.textContent = totalSteps + '/3';
		}

		imageCard.addEventListener('click', (e) => {
			if (e.target.tagName !== 'IMG') return;
			if (imageIndex < 2) {
				imageIndex++;
				challengeImage.src = IMAGES[imageIndex];
				updateOverallProgress();
			}
		});

		webcamCard.addEventListener('click', () => {
			if (webcamIndex < 2) {
				webcamIndex++;
				updateOverallProgress();
			}
		});

		async function initWebcam() {
			try {
				if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
					throw new Error('Webcam API not available');
				}

				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: 'user'
					},
					audio: false
				});

				video.srcObject = stream;
				webcamError.classList.remove('show');
			} catch (err) {
				console.error('Webcam error:', err);
				webcamError.textContent = err.message;
				webcamError.classList.add('show');
			}
		}

		window.addEventListener('load', () => {
			initWebcam();
			updateOverallProgress();
		});

		window.addEventListener('beforeunload', () => {
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
			}
		});
	</script>
</body>
</html>`;
}
