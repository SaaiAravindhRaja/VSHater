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
	{ path: '/assets/monkey.jpg', pose: 'monkeythink', description: 'MONKEY THINK - Put finger on your lip' },
	{ path: '/assets/khaby.jpg', pose: 'khaby', description: 'KHABY LAME - Palms up shrug with bent elbows' },
	{ path: '/assets/mewing.jpg', pose: 'mewing', description: 'MEWING - Point to jawline with lips closed' },
	{ path: '/assets/monkeyhappy.jpg', pose: 'monkeyhappy', description: 'MONKEY HAPPY - Smile wide and point up' },
	{ path: '/assets/dab.jpg', pose: 'dab', description: 'DAB - Tuck face into elbow, extend other arm out' }
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
			max-width: 1300px;
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
			height: 420px;
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
			max-width: 1300px;
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
			transform: scaleX(-1);
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

		function checkKhaby(landmarks) {
			// KHABY LAME: Palms up shrug gesture
			// Wrists below shoulders, elbows bent < 120 degrees, wrists above mid torso
			const leftShoulder = landmarks[11];
			const rightShoulder = landmarks[12];
			const leftElbow = landmarks[13];
			const rightElbow = landmarks[14];
			const leftWrist = landmarks[15];
			const rightWrist = landmarks[16];
			const leftHip = landmarks[23];
			const rightHip = landmarks[24];

			if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow ||
				!leftWrist || !rightWrist || !leftHip || !rightHip) {
				return false;
			}

			// Check visibility
			if (leftWrist.visibility < 0.5 || rightWrist.visibility < 0.5 ||
				leftElbow.visibility < 0.5 || rightElbow.visibility < 0.5) {
				return false;
			}

			// Calculate mid torso Y (average of shoulders and hips)
			const midTorsoY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

			// Check wrists below shoulders (y increases downward)
			const leftWristBelowShoulder = leftWrist.y > leftShoulder.y;
			const rightWristBelowShoulder = rightWrist.y > rightShoulder.y;

			// Check wrists above mid torso
			const leftWristAboveMidTorso = leftWrist.y < midTorsoY;
			const rightWristAboveMidTorso = rightWrist.y < midTorsoY;

			// Calculate elbow angles using dot product
			function calculateAngle(a, b, c) {
				// Angle at point b, formed by points a-b-c
				const ba = { x: a.x - b.x, y: a.y - b.y };
				const bc = { x: c.x - b.x, y: c.y - b.y };
				const dot = ba.x * bc.x + ba.y * bc.y;
				const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
				const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
				if (magBA === 0 || magBC === 0) return 180;
				const cosAngle = dot / (magBA * magBC);
				const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
				return angle;
			}

			// Elbow angle: shoulder -> elbow -> wrist
			const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
			const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

			// Elbows bent less than 120 degrees
			const leftElbowBent = leftElbowAngle < 120;
			const rightElbowBent = rightElbowAngle < 120;

			return leftWristBelowShoulder && rightWristBelowShoulder &&
				leftWristAboveMidTorso && rightWristAboveMidTorso &&
				leftElbowBent && rightElbowBent;
		}

		function checkMewing(landmarks) {
			// MEWING: Index finger on jawline
			// Requires FaceMesh for jawline detection

			if (!currentFaceLandmarks || currentFaceLandmarks.length === 0) {
				return false;
			}

			const fl = currentFaceLandmarks;

			// FaceMesh jawline landmarks (along the jaw)
			const jawlinePoints = [132, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 361];

			// Get face bounding box to check finger is in face region
			const noseTip = fl[1];
			const chin = fl[152];
			if (!noseTip || !chin) return false;

			// Pose landmarks: 19 = left index, 20 = right index
			const leftIndex = landmarks[19];
			const rightIndex = landmarks[20];

			function checkFingerOnJawline(finger) {
				if (!finger || finger.visibility < 0.3) return false;

				// Finger must be in lower face region (below nose, near chin level)
				if (finger.y < noseTip.y) return false;

				for (const idx of jawlinePoints) {
					const jawPoint = fl[idx];
					if (!jawPoint) continue;

					const dx = finger.x - jawPoint.x;
					const dy = finger.y - jawPoint.y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					if (distance < 0.07) {
						return true;
					}
				}
				return false;
			}

			return checkFingerOnJawline(leftIndex) || checkFingerOnJawline(rightIndex);
		}

		function checkMonkeyHappy(landmarks) {
			// MONKEY HAPPY: Index finger pointing up and minimal smile

			if (!currentFaceLandmarks || currentFaceLandmarks.length === 0) {
				return false;
			}

			const fl = currentFaceLandmarks;

			// Minimal smile check - just mouth corners slightly up
			const leftMouthCorner = fl[61];
			const rightMouthCorner = fl[291];
			const upperLip = fl[13];

			let hasSmile = true; // Default to true if landmarks missing
			if (leftMouthCorner && rightMouthCorner && upperLip) {
				// Corners at or above upper lip = smile
				hasSmile = leftMouthCorner.y <= upperLip.y + 0.02 || rightMouthCorner.y <= upperLip.y + 0.02;
			}

			// Index finger pointing upward (very loose)
			const leftIndex = landmarks[19];
			const rightIndex = landmarks[20];
			const leftWrist = landmarks[15];
			const rightWrist = landmarks[16];

			function isFingerUp(index, wrist) {
				if (!index || !wrist) return false;
				if (index.visibility < 0.2) return false;
				// Just check finger is above wrist
				return index.y < wrist.y;
			}

			const fingerUp = isFingerUp(leftIndex, leftWrist) || isFingerUp(rightIndex, rightWrist);

			return hasSmile && fingerUp;
		}

		function checkDab(landmarks) {
			// DAB: One arm bent with face tucked into elbow, other arm extended diagonally
			const nose = landmarks[0];
			const leftShoulder = landmarks[11];
			const rightShoulder = landmarks[12];
			const leftElbow = landmarks[13];
			const rightElbow = landmarks[14];
			const leftWrist = landmarks[15];
			const rightWrist = landmarks[16];

			if (!nose || !leftShoulder || !rightShoulder ||
				!leftElbow || !rightElbow || !leftWrist || !rightWrist) {
				return false;
			}

			// Helper: distance between two points
			function dist(a, b) {
				return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
			}

			// Helper: check if arm is somewhat extended (elbow angle > 110 degrees)
			function isArmExtended(shoulder, elbow, wrist) {
				const ba = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
				const bc = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
				const dot = ba.x * bc.x + ba.y * bc.y;
				const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
				const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
				if (magBA === 0 || magBC === 0) return false;
				const cosAngle = dot / (magBA * magBC);
				const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
				return angle > 110;
			}

			// Helper: check if arm is bent (elbow angle < 130 degrees)
			function isArmBent(shoulder, elbow, wrist) {
				const ba = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
				const bc = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
				const dot = ba.x * bc.x + ba.y * bc.y;
				const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
				const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
				if (magBA === 0 || magBC === 0) return false;
				const cosAngle = dot / (magBA * magBC);
				const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
				return angle < 130;
			}

			// Check left dab: face near left elbow/wrist area, right arm extended
			const noseNearLeftArm = dist(nose, leftElbow) < 0.4 || dist(nose, leftWrist) < 0.3;
			const leftArmBent = isArmBent(leftShoulder, leftElbow, leftWrist);
			const rightArmExtended = isArmExtended(rightShoulder, rightElbow, rightWrist);
			const leftDab = noseNearLeftArm && leftArmBent && rightArmExtended;

			// Check right dab: face near right elbow/wrist area, left arm extended
			const noseNearRightArm = dist(nose, rightElbow) < 0.4 || dist(nose, rightWrist) < 0.3;
			const rightArmBent = isArmBent(rightShoulder, rightElbow, rightWrist);
			const leftArmExtended = isArmExtended(leftShoulder, leftElbow, leftWrist);
			const rightDab = noseNearRightArm && rightArmBent && leftArmExtended;

			return leftDab || rightDab;
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
				case 'khaby':
					return checkKhaby(landmarks);
				case 'mewing':
					return checkMewing(landmarks);
				case 'monkeyhappy':
					return checkMonkeyHappy(landmarks);
				case 'dab':
					return checkDab(landmarks);
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
