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

// Map images to required poses
const ALL_CHALLENGES = [
	{ path: '/assets/67.jpg', pose: '67hands', description: '67 HANDS - Wave both hands up and down rapidly' },
	{ path: '/assets/flight-emote.jpg', pose: 'fanum', description: 'FANUM TAX - Stick out tongue and shake head' },
	{ path: '/assets/monkey.jpg', pose: 'monkeythink', description: 'MONKEY THINK - Put finger on your lip' }
];

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

function getChallengeHTML(): string {
	// Shuffle challenges each time
	const challenges = shuffleArray(ALL_CHALLENGES);
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
			max-width: 400px;
			max-height: 260px;
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

		.match-meter {
			position: absolute;
			bottom: 16px;
			left: 16px;
			right: 16px;
			height: 8px;
			background: rgba(0, 0, 0, 0.6);
			border-radius: 4px;
			overflow: hidden;
			border: 1px solid rgba(255, 255, 255, 0.2);
		}

		.match-meter-fill {
			height: 100%;
			width: 0%;
			background: linear-gradient(90deg, #ff4d6d, #ffaa00, #00ff88);
			border-radius: 4px;
			transition: width 0.15s ease-out;
		}

		.match-meter-fill.matched {
			background: #00ff88;
			box-shadow: 0 0 12px #00ff88;
		}

		.match-label {
			position: absolute;
			bottom: 30px;
			left: 0;
			right: 0;
			text-align: center;
			font-size: 11px;
			font-weight: 700;
			color: rgba(255, 255, 255, 0.7);
			letter-spacing: 1px;
			text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
		}

		.match-label.matched {
			color: #00ff88;
			text-shadow: 0 0 8px #00ff88;
		}

		.action-description {
			padding: 12px;
			background: rgba(0, 217, 255, 0.1);
			border-top: 1px solid rgba(0, 217, 255, 0.2);
			font-size: 13px;
			font-weight: 600;
			color: #00d9ff;
			text-align: center;
			letter-spacing: 0.5px;
			min-height: 40px;
			display: flex;
			align-items: center;
			justify-content: center;
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
					<img id="challengeImage" src="${challenges[0].path}" alt="Challenge" />
				</div>
				<div class="action-description" id="actionDescription">${challenges[0].description}</div>
			</div>

			<div class="card" id="webcamCard">
				<div class="webcam-section">
					<video id="webcam" autoplay playsinline muted></video>
					<div class="webcam-error" id="webcamError"></div>
					<div class="match-meter" id="matchMeter">
						<div class="match-meter-fill" id="matchMeterFill"></div>
					</div>
					<div class="match-label" id="matchLabel">MATCHING...</div>
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

	<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js"></script>
	<script>
		const IMAGES = [
			{ path: '${challenges[0].path}', pose: '${challenges[0].pose}', desc: '${challenges[0].description}' },
			{ path: '${challenges[1].path}', pose: '${challenges[1].pose}', desc: '${challenges[1].description}' },
			{ path: '${challenges[2].path}', pose: '${challenges[2].pose}', desc: '${challenges[2].description}' }
		];

		// State
		let imageIndex = 0;
		let stream = null;
		let pose = null;
		let faceMesh = null;
		let camera = null;
		let poseDetectionActive = false;
		let poseConfidenceCounter = 0;
		let isTransitioning = false;
		const POSE_CONFIDENCE_THRESHOLD = 5;

		// FaceMesh results storage (updated by faceMesh callback)
		let currentFaceLandmarks = null;

		function updateOverallProgress() {
			const totalSteps = imageIndex + 1;
			const percentage = (totalSteps / 3) * 100;
			document.getElementById('overallProgressBar').style.width = percentage + '%';
			document.getElementById('overallProgressText').textContent = totalSteps + '/3';
		}

		async function completeChallenge() {
			try {
				poseDetectionActive = false;
				const response = await fetch('/complete', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ completed: true, timestamp: Date.now() })
				});

				if (response.ok) {
					setTimeout(() => {
						if (stream) {
							stream.getTracks().forEach(track => track.stop());
						}
						if (camera) {
							camera.stop();
						}
						window.close();
					}, 300);
				}
			} catch (err) {
				console.error('Error completing challenge:', err);
			}
		}

		function clearMotionHistory() {
			leftWristHistory = [];
			rightWristHistory = [];
			handYHistory = [];
			headXHistory = [];
			currentFaceLandmarks = null;
		}

		function advanceToNextImage() {
			if (imageIndex < 2) {
				imageIndex++;
				document.getElementById('challengeImage').src = IMAGES[imageIndex].path;
				document.getElementById('actionDescription').textContent = IMAGES[imageIndex].desc;
				updateOverallProgress();
				poseConfidenceCounter = 0;
				clearMotionHistory();
				console.log(\`Advanced to image \${imageIndex + 1}/3: \${IMAGES[imageIndex].desc}\`);
			} else if (imageIndex === 2) {
				console.log('All poses completed!');
				completeChallenge();
			}
		}

		// Pose matchers - Based on index.html detection logic
		// Landmark indices: 0=nose, 2=left_eye, 5=right_eye, 11=left_shoulder, 12=right_shoulder
		// 13=left_elbow, 14=right_elbow, 15=left_wrist, 16=right_wrist

		// Distance helper
		function dist(a, b) {
			return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
		}

		// History tracking for motion-based detection
		let leftWristHistory = [];
		let rightWristHistory = [];
		let handYHistory = [];
		let headXHistory = []; // For head shake detection

		function check67Hands(landmarks) {
			// 67 HANDS: Wave both hands up and down rapidly (oscillation detection)
			const leftWrist = landmarks[15];
			const rightWrist = landmarks[16];

			if (!leftWrist || !rightWrist) return false;

			// Track wrist Y positions over time
			leftWristHistory.push(leftWrist.y);
			rightWristHistory.push(rightWrist.y);
			if (leftWristHistory.length > 30) leftWristHistory.shift();
			if (rightWristHistory.length > 30) rightWristHistory.shift();

			if (leftWristHistory.length < 15) return false;

			// Count direction changes (oscillation)
			function countChanges(hist) {
				let changes = 0, lastDir = 0;
				for (let i = 1; i < hist.length; i++) {
					const diff = hist[i] - hist[i - 1];
					if (Math.abs(diff) > 0.015) {
						const dir = diff > 0 ? 1 : -1;
						if (lastDir !== 0 && dir !== lastDir) changes++;
						lastDir = dir;
					}
				}
				return changes;
			}

			// Get movement range
			function getRange(hist) {
				return Math.max(...hist) - Math.min(...hist);
			}

			const leftChanges = countChanges(leftWristHistory);
			const rightChanges = countChanges(rightWristHistory);
			const leftRange = getRange(leftWristHistory);
			const rightRange = getRange(rightWristHistory);

			// Require actual movement amplitude
			if (leftRange < 0.08 || rightRange < 0.08) return false;

			// Need at least 3 direction changes on each hand
			return leftChanges >= 3 && rightChanges >= 3;
		}

		function checkFanumTax(landmarks) {
			// FANUM TAX: Stick out tongue and shake head
			// Requires FaceMesh for mouth/tongue detection

			if (!currentFaceLandmarks || currentFaceLandmarks.length === 0) {
				return false;
			}

			const fl = currentFaceLandmarks;

			// FaceMesh landmark indices:
			// 13 = upper lip inner, 14 = lower lip inner
			// 78 = left mouth corner, 308 = right mouth corner
			// 1 = nose tip (for head position tracking)

			const upperLip = fl[13];
			const lowerLip = fl[14];
			const leftMouth = fl[78];
			const rightMouth = fl[308];
			const noseTip = fl[1];

			if (!upperLip || !lowerLip || !leftMouth || !rightMouth || !noseTip) {
				return false;
			}

			// Check mouth open (tongue out proxy)
			// Measure vertical opening relative to mouth width
			const mouthWidth = Math.abs(rightMouth.x - leftMouth.x) + 0.001;
			const mouthOpen = Math.abs(lowerLip.y - upperLip.y);
			const openRatio = mouthOpen / mouthWidth;

			// Mouth needs to be significantly open (tongue out)
			const isTongueOut = openRatio > 0.35;

			// Track head X position for shake detection
			headXHistory.push(noseTip.x);
			if (headXHistory.length > 30) headXHistory.shift();

			// Check for head shake (oscillation in X direction)
			let isShakingHead = false;
			if (headXHistory.length >= 15) {
				// Count direction changes
				let changes = 0;
				let lastDir = 0;
				for (let i = 1; i < headXHistory.length; i++) {
					const diff = headXHistory[i] - headXHistory[i - 1];
					if (Math.abs(diff) > 0.008) {
						const dir = diff > 0 ? 1 : -1;
						if (lastDir !== 0 && dir !== lastDir) changes++;
						lastDir = dir;
					}
				}

				// Get movement range
				const range = Math.max(...headXHistory) - Math.min(...headXHistory);

				// Need at least 3 direction changes and some range
				isShakingHead = changes >= 3 && range > 0.04;
			}

			return isTongueOut && isShakingHead;
		}

		function checkMonkeyThink(landmarks) {
			// MONKEY THINK: Finger on lip/mouth corner (thinking pose)
			const nose = landmarks[0];
			const mouthLeft = landmarks[9];
			const mouthRight = landmarks[10];
			const leftIndex = landmarks[19];  // Left index finger tip
			const rightIndex = landmarks[20]; // Right index finger tip

			if (!nose) return false;

			// Check if index finger is near mouth/lip area
			let fingerOnLip = false;

			// Left index finger near mouth
			if (leftIndex && leftIndex.visibility > 0.3) {
				const leftFingerNearMouth = (mouthLeft && dist(leftIndex, mouthLeft) < 0.08) ||
					(mouthRight && dist(leftIndex, mouthRight) < 0.08) ||
					(dist(leftIndex, nose) < 0.12 && leftIndex.y > nose.y);
				if (leftFingerNearMouth) fingerOnLip = true;
			}

			// Right index finger near mouth
			if (rightIndex && rightIndex.visibility > 0.3) {
				const rightFingerNearMouth = (mouthLeft && dist(rightIndex, mouthLeft) < 0.08) ||
					(mouthRight && dist(rightIndex, mouthRight) < 0.08) ||
					(dist(rightIndex, nose) < 0.12 && rightIndex.y > nose.y);
				if (rightFingerNearMouth) fingerOnLip = true;
			}

			return fingerOnLip;
		}

		function checkCurrentPose(landmarks) {
			const requiredPose = IMAGES[imageIndex].pose;

			switch (requiredPose) {
				case '67hands':
					return check67Hands(landmarks);
				case 'fanum':
					return checkFanumTax(landmarks);
				case 'monkeythink':
					return checkMonkeyThink(landmarks);
				default:
					return false;
			}
		}

		function updateMatchMeter(value, matched = false) {
			const fill = document.getElementById('matchMeterFill');
			const label = document.getElementById('matchLabel');
			const percentage = Math.min(100, (value / POSE_CONFIDENCE_THRESHOLD) * 100);

			fill.style.width = percentage + '%';

			if (matched) {
				fill.classList.add('matched');
				label.classList.add('matched');
				label.textContent = 'MATCHED!';
			} else if (percentage > 0) {
				fill.classList.remove('matched');
				label.classList.remove('matched');
				label.textContent = 'HOLD POSE...';
			} else {
				fill.classList.remove('matched');
				label.classList.remove('matched');
				label.textContent = 'MATCHING...';
			}
		}

		async function onPoseResults(results) {
			if (!poseDetectionActive) return;

			// MediaPipe Pose returns poseLandmarks (not landmarks)
			const landmarks = results.poseLandmarks;
			// Skip detection during transitions
			if (isTransitioning) return;

			if (landmarks && landmarks.length > 0) {
				if (checkCurrentPose(landmarks)) {
					poseConfidenceCounter++;
					updateMatchMeter(poseConfidenceCounter, false);

					if (poseConfidenceCounter >= POSE_CONFIDENCE_THRESHOLD) {
						// Block further detection during transition
						isTransitioning = true;
						updateMatchMeter(POSE_CONFIDENCE_THRESHOLD, true);
						console.log(\`Pose detected: \${IMAGES[imageIndex].pose}\`);

						// Delay before next pose (longer to prevent carry-over)
						setTimeout(() => {
							advanceToNextImage();
							poseConfidenceCounter = 0;
							clearMotionHistory();
							updateMatchMeter(0, false);
							// Re-enable detection after transition
							isTransitioning = false;
						}, 2000);
					}
				} else {
					// Strictly consecutive: reset to 0 immediately when pose lost
					poseConfidenceCounter = 0;
					updateMatchMeter(0, false);
				}
			} else {
				// No pose detected - reset counter
				poseConfidenceCounter = 0;
				updateMatchMeter(0, false);
			}
		}

		async function initPoseDetection() {
			try {
				if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
					throw new Error('Webcam API not available');
				}

				const video = document.getElementById('webcam');
				const webcamError = document.getElementById('webcamError');

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

				// Initialize MediaPipe Pose
				pose = new Pose({
					locateFile: (file) => {
						return \`https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/\${file}\`;
					}
				});

				pose.setOptions({
					modelComplexity: 1,
					smoothLandmarks: true,
					enableSegmentation: false,
					smoothSegmentation: false,
					minDetectionConfidence: 0.5,
					minTrackingConfidence: 0.5
				});

				pose.onResults(onPoseResults);

				// Initialize MediaPipe FaceMesh (for fanum pose)
				faceMesh = new FaceMesh({
					locateFile: (file) => {
						return \`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/\${file}\`;
					}
				});

				faceMesh.setOptions({
					maxNumFaces: 1,
					refineLandmarks: true,
					minDetectionConfidence: 0.5,
					minTrackingConfidence: 0.5
				});

				faceMesh.onResults((results) => {
					// Store face landmarks for use in pose detection
					if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
						currentFaceLandmarks = results.multiFaceLandmarks[0];
					} else {
						currentFaceLandmarks = null;
					}
				});

				// Initialize Camera
				camera = new Camera(video, {
					onFrame: async () => {
						await pose.send({ image: video });
						await faceMesh.send({ image: video });
					},
					width: 1280,
					height: 720
				});

				camera.start();
				poseDetectionActive = true;
				console.log('Pose detection started');
			} catch (err) {
				console.error('Initialization error:', err);
				const webcamError = document.getElementById('webcamError');
				webcamError.textContent = err.message || 'Failed to initialize pose detection';
				webcamError.classList.add('show');
				poseDetectionActive = false;
			}
		}

		window.addEventListener('load', () => {
			initPoseDetection();
			updateOverallProgress();
		});

		window.addEventListener('beforeunload', () => {
			poseDetectionActive = false;
			if (camera) {
				camera.stop();
			}
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
			}
		});
	</script>
</body>
</html>`;
}
