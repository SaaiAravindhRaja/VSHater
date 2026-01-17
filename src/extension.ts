// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { encryptContent, decryptContent, isEncrypted } from './encryption';
import { startServer, stopServer, setSession, getServerUrl } from './server';
import { spawn } from 'child_process';
import { platform } from 'os';

// Map to track locked files for decryption
const lockedFiles = new Map<string, vscode.TextDocument>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	console.log('Extension "vshater" is now active - files will be encrypted on open!');

	try {
		// Start the HTTP server for challenges
		await startServer();
	} catch (err) {
		console.error('Failed to start server:', err);
		vscode.window.showErrorMessage('VSHater: Failed to start challenge server');
	}

	// Listen for file open events
	const openDisposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
		await handleFileOpen(document, context);
	});

	// Listen for file save events to re-encrypt if needed
	const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
		handleFileSave(document);
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

	context.subscriptions.push(openDisposable, saveDisposable, decryptDisposable);

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

		// Open challenge in browser
		await openChallengeBrowser(fileUri, document.fileName);
	} catch (error) {
		console.error('Error encrypting file:', error);
	}
}

async function openChallengeBrowser(fileUri: string, fileName: string) {
	const serverUrl = getServerUrl();

	// Set up session to handle completion
	setSession({
		fileUri,
		fileName,
		onComplete: async (success: boolean) => {
			if (success) {
				await decryptFile(fileUri);
			}
		},
		onError: (error: string) => {
			vscode.window.showErrorMessage(`Challenge error: ${error}`);
		}
	});

	// Open browser based on platform
	try {
		const osType = platform();

		// Add small delay to ensure server is ready
		await new Promise(resolve => setTimeout(resolve, 500));

		if (osType === 'win32') {
			// Windows: use cmd.exe to run start command
			spawn('cmd.exe', ['/c', `start ${serverUrl}`], { detached: true, stdio: 'ignore' });
		} else if (osType === 'darwin') {
			// macOS: use open command
			spawn('open', [serverUrl], { detached: true, stdio: 'ignore' });
		} else {
			// Linux: use xdg-open
			spawn('xdg-open', [serverUrl], { detached: true, stdio: 'ignore' });
		}

		console.log(`Opening browser at ${serverUrl}`);
	} catch (error) {
		console.error('Error opening browser:', error);
		vscode.window.showErrorMessage('Failed to open challenge browser. Please manually visit: ' + getServerUrl());
	}
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

// This method is called when your extension is deactivated
export function deactivate() {}
