import * as vscode from 'vscode';
import { encryptContent, decryptContent, isEncrypted } from './encryption';
import { startServer, stopServer, setSession, getServerUrl } from './server';

// Map to track locked files for decryption
const lockedFiles = new Map<string, vscode.TextDocument>();

export async function activate(context: vscode.ExtensionContext) {
	console.log('VSHater is now active - files will be encrypted on open!');

	// Listen for file open events
	const openDisposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
		await handleFileOpen(document);
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

	context.subscriptions.push(
		openDisposable,
		saveDisposable,
		decryptDisposable
	);

	// Cleanup on deactivation
	context.subscriptions.push(
		new vscode.Disposable(() => {
			stopServer();
		})
	);
}

async function handleFileOpen(document: vscode.TextDocument) {
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
		await startPoseChallenge(fileUri, document.fileName);
	} catch (error) {
		console.error('Error encrypting file:', error);
	}
}

async function startPoseChallenge(fileUri: string, fileName: string) {
	// Set the session with callbacks for when challenge is completed
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

	try {
		// Start the server and open the browser
		await startServer();
		const url = getServerUrl();
		vscode.env.openExternal(vscode.Uri.parse(url));
		vscode.window.showInformationMessage('Complete the challenge to unlock your file!');
	} catch (error) {
		console.error('Failed to start challenge server:', error);
		vscode.window.showErrorMessage('Failed to start challenge');
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

export function deactivate() {
	stopServer();
}
