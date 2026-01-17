import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Available brainrot actions (5 final actions)
const ACTIONS = [
	'dab', '67hands', 'fanum', 'tongue', 'monkeythink'
] as const;
type ActionType = typeof ACTIONS[number];

const ACTION_NAMES: Record<ActionType, string> = {
	'dab': 'DAB',
	'67hands': '67 HANDS',
	'fanum': 'FANUM TAX',
	'tongue': 'TONGUE OUT',
	'monkeythink': 'MONKEY THINK'
};

let server: http.Server | undefined = undefined;
let currentAction: ActionType | null | undefined = undefined;
let onActionDetectedCallback: (() => void) | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('VSHater is now active!');

	const startDetection = vscode.commands.registerCommand('vshater.startDetection', () => {
		// Pick a random action
		const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
		startActionDetection(context, randomAction);
	});

	// Test mode - shows action picker
	const testDetection = vscode.commands.registerCommand('vshater.testDetection', () => {
		startActionDetection(context, null); // null = show picker
	});

	const helloWorld = vscode.commands.registerCommand('vshater.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from VSHater!');
	});

	context.subscriptions.push(startDetection, testDetection, helloWorld);
}

async function startActionDetection(context: vscode.ExtensionContext, action: ActionType | null) {
	// If server already running, just open the browser
	if (server) {
		const address = server.address();
		if (address && typeof address === 'object') {
			const url = action
				? `http://localhost:${address.port}?action=${action}`
				: `http://localhost:${address.port}`;
			vscode.env.openExternal(vscode.Uri.parse(url));
		}
		return;
	}

	currentAction = action;

	// Read the HTML file
	const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'index.html');
	const html = fs.readFileSync(htmlPath, 'utf8');

	// Create HTTP server
	server = http.createServer((req, res) => {
		const url = new URL(req.url || '/', `http://localhost`);

		if (url.pathname === '/') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(html);
		} else if (url.pathname === '/action-detected') {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('OK');

			const actionName = currentAction ? ACTION_NAMES[currentAction] : 'ACTION';
			vscode.window.showInformationMessage(`${actionName} DETECTED! You absolute legend!`);

			if (onActionDetectedCallback) {
				onActionDetectedCallback();
			}

			setTimeout(() => {
				stopServer();
			}, 1000);
		} else {
			res.writeHead(404);
			res.end('Not found');
		}
	});

	// Find an available port
	server.listen(0, 'localhost', () => {
		const address = server?.address();
		if (address && typeof address === 'object') {
			const url = action
				? `http://localhost:${address.port}?action=${action}`
				: `http://localhost:${address.port}`;
			console.log(`VSHater server running at ${url}`);

			vscode.env.openExternal(vscode.Uri.parse(url));
			if (action) {
				const actionName = ACTION_NAMES[action];
				vscode.window.showInformationMessage(`Opening browser... DO THE ${actionName}!`);
			} else {
				vscode.window.showInformationMessage(`Opening browser... Pick your brainrot!`);
			}
		}
	});

	server.on('error', (err) => {
		console.error('Server error:', err);
		vscode.window.showErrorMessage(`Failed to start server: ${err.message}`);
	});
}

function stopServer() {
	if (server) {
		server.close();
		server = undefined;
	}
	currentAction = undefined;
}

// ========== API FOR OTHER STAGES ==========

/**
 * Start pose detection for a specific action type
 * @param context Extension context
 * @param action The action to detect ('dab' | '67hands' | 'tongue' | 'monkeythink')
 * @param onDetected Callback when the action is successfully detected
 */
export function startPoseDetection(
	context: vscode.ExtensionContext,
	action: ActionType,
	onDetected: () => void
): void {
	onActionDetectedCallback = onDetected;
	startActionDetection(context, action);
}

/**
 * Start detection with a random action
 */
export function startRandomDetection(
	context: vscode.ExtensionContext,
	onDetected: () => void
): void {
	const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
	onActionDetectedCallback = onDetected;
	startActionDetection(context, randomAction);
}

/**
 * Stop the current detection and close the webview
 */
export function stopPoseDetection(): void {
	stopServer();
	onActionDetectedCallback = undefined;
}

/**
 * Check if detection is currently active
 */
export function isDetectionActive(): boolean {
	return server !== undefined;
}

/**
 * Get current action being detected
 */
export function getCurrentAction(): ActionType | null | undefined {
	return currentAction;
}

export function deactivate() {
	stopServer();
}
