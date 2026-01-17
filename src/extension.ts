// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { encryptContent, decryptContent, isEncrypted } from './encryption';

// Map to track which files are encrypted
const encryptedFiles = new Map<string, string>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Extension "vshater" is now active - files will be encrypted on open!');

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

	context.subscriptions.push(openDisposable, saveDisposable, decryptDisposable);
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
		// Store the original content
		const fileUri = document.uri.toString();
		encryptedFiles.set(fileUri, content);

		// Encrypt the content
		const encrypted = encryptContent(content, document.fileName);

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
	} catch (error) {
		console.error('Error encrypting file:', error);
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
