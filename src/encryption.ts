// Simple encryption utility for file content
// Uses deterministic encryption for reliable decryption

const ENCRYPTION_KEY = 'vshater_encryption_key_42';

/**
 * Encrypts content using XOR cipher + Base64 encoding for reliable reversal
 */
export function encryptContent(content: string): string {
	// Apply XOR encryption
	let encrypted = xorEncrypt(content, ENCRYPTION_KEY);

	// Convert to Base64 for safe transmission (handles all byte values)
	const base64Encrypted = Buffer.from(encrypted, 'binary').toString('base64');

	// Add marker so we know it's encrypted
	const marker = '🔒VSHATER_ENCRYPTED🔒';
	return marker + base64Encrypted;
}

/**
 * Decrypts content back to original
 */
export function decryptContent(content: string): string | null {
	const marker = '🔒VSHATER_ENCRYPTED🔒';

	if (!content.startsWith(marker)) {
		return null;
	}

	try {
		// Remove marker
		const base64Encrypted = content.substring(marker.length);

		// Decode from Base64
		const encrypted = Buffer.from(base64Encrypted, 'base64').toString('binary');

		// Decrypt using XOR
		const decrypted = xorDecrypt(encrypted, ENCRYPTION_KEY);

		return decrypted;
	} catch (err) {
		console.error('Decryption error:', err);
		return null;
	}
}

/**
 * Checks if content is encrypted
 */
export function isEncrypted(content: string): boolean {
	return content.startsWith('🔒VSHATER_ENCRYPTED🔒');
}

/**
 * XOR encryption - deterministic and reversible
 */
function xorEncrypt(text: string, key: string): string {
	let result = '';
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);
		const keyCode = key.charCodeAt(i % key.length);
		result += String.fromCharCode(charCode ^ keyCode);
	}
	return result;
}

/**
 * XOR decryption - XOR is symmetric, so same as encryption
 */
function xorDecrypt(text: string, key: string): string {
	return xorEncrypt(text, key);
}
