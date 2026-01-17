import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { encryptContent, decryptContent, isEncrypted } from './encryption';
import { spawn } from 'child_process';
import { platform } from 'os';

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

// Map to track locked files for decryption
const lockedFiles = new Map<string, vscode.TextDocument>();

export async function activate(context: vscode.ExtensionContext) {
	console.log('VSHater is now active - files will be encrypted on open!');

	// Listen for file open events
	const openDisposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
		await handleFileOpen(document, context);
	});

	// Listen for file save events to re-encrypt if needed
	const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
		handleFileSave(document);
	});

	// Test commands for pose detection
	const startDetection = vscode.commands.registerCommand('vshater.startDetection', () => {
		const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
		startActionDetection(context, randomAction);
	});

	const testDetection = vscode.commands.registerCommand('vshater.testDetection', () => {
		startActionDetection(context, null);
	});

	// Register command to decrypt a file (for testing purposes)
	const decryptDisposable = vscode.commands.registerCommand('vshater.decryptFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No file is open');
			return;
		}

		const document = editor.document;
		const content = document.getText();

		if (!isEncrypted(content)) {
			vscode.window.showErrorMessage('This file is not encrypted');
			return;
		}

		const decrypted = decryptContent(content);
		if (!decrypted) {
			vscode.window.showErrorMessage('Failed to decrypt file');
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(content.length)
		);

		edit.replace(document.uri, fullRange, decrypted);
		await vscode.workspace.applyEdit(edit);
		vscode.window.showInformationMessage('File decrypted!');
	});

	context.subscriptions.push(
		openDisposable, 
		saveDisposable, 
		decryptDisposable,
		startDetection,
		testDetection
	);

	// Cleanup on deactivation
	context.subscriptions.push(
		new vscode.Disposable(() => {
			stopServer();
		})
	);
}

async function handleFileOpen(document: vscode.TextDocument, context: vscode.ExtensionContext) {
	// Skip non-file documents (like untitled, git, etc.)
	if (document.uri.scheme !== 'file') {
		return;
	}

	// Skip certain file types
	const skipPatterns = ['node_modules', '.git', 'dist', 'build', '.vscode', 'package.json', 'package-lock.json'];
	const filePath = document.uri.fsPath;

	if (skipPatterns.some(pattern => filePath.includes(pattern))) {
		return;
	}

	const content = document.getText();

	// Skip if already encrypted
	if (isEncrypted(content)) {
		return;
	}

	// Skip empty files
	if (content.trim().length === 0) {
		return;
	}

	// Skip very large files (to avoid performance issues)
	if (content.length > 1000000) {
		return;
	}

	try {
		// Track locked file for later decryption
		const fileUri = document.uri.toString();
		lockedFiles.set(fileUri, document);

		// Encrypt the content
		const encrypted = encryptContent(content);

		// Replace the file content with encrypted version
		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(content.length)
		);

		edit.replace(document.uri, fullRange, encrypted);
		await vscode.workspace.applyEdit(edit);

		console.log(`File encrypted: ${document.fileName}`);
		vscode.window.showInformationMessage(`🔒 File locked: ${document.fileName}`);

		// Start pose detection challenge to unlock
		await startPoseChallenge(context, fileUri, document.fileName);
	} catch (error) {
		console.error('Error encrypting file:', error);
	}
}

async function startPoseChallenge(context: vscode.ExtensionContext, fileUri: string, fileName: string) {
	// Pick a random action for the user to perform
	const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
	
	onActionDetectedCallback = async () => {
		// When pose is detected, decrypt the file
		await decryptFile(fileUri);
	};

	await startActionDetection(context, randomAction);
}

async function decryptFile(fileUri: string) {
	// Find the document through all open text documents
	let document: vscode.TextDocument | undefined;
	for (const doc of vscode.workspace.textDocuments) {
		if (doc.uri.toString() === fileUri) {
			document = doc;
			break;
		}
	}

	if (!document) {
		console.error('Document not found for URI:', fileUri);
		vscode.window.showErrorMessage('File not found');
		return;
	}

	const content = document.getText();
	console.log(`Decrypting file: ${document.fileName}, content starts with: ${content.substring(0, 30)}`);

	const decrypted = decryptContent(content);

	if (!decrypted) {
		console.error('Decryption failed - content might not be encrypted');
		vscode.window.showErrorMessage('Failed to decrypt file');
		return;
	}

	try {
		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(content.length)
		);

		edit.replace(document.uri, fullRange, decrypted);
		const success = await vscode.workspace.applyEdit(edit);

		if (success) {
			lockedFiles.delete(fileUri);

			// Save the file
			await document.save();

			vscode.window.showInformationMessage(`✓ File unlocked: ${document.fileName}`);
			console.log(`File decrypted successfully: ${document.fileName}`);
		} else {
			vscode.window.showErrorMessage('Failed to apply decryption');
		}
	} catch (error) {
		console.error('Error decrypting file:', error);
		vscode.window.showErrorMessage(`Failed to decrypt file: ${error}`);
	}
}

function handleFileSave(document: vscode.TextDocument) {
	// If the file is encrypted, prevent normal save and keep it encrypted
	const content = document.getText();
	if (isEncrypted(content)) {
		console.log(`Encrypted file saved: ${document.fileName}`);
	}
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