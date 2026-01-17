// Simple encryption utility for file content

const ENCRYPTION_KEY = 'vshater_encryption_key';
const METADATA_KEY = 'vshater_metadata';

interface FileMetadata {
	originalHash: string;
	timestamp: number;
	fileName: string;
}

/**
 * Encrypts content using a simple XOR-based cipher combined with character substitution
 * Creates gibberish that looks nothing like the original content
 */
export function encryptContent(content: string, fileName: string): string {
	// Create a simple hash of the original content to store
	const hash = simpleHash(content);

	// Apply multiple layers of obfuscation
	let encrypted = xorEncrypt(content, ENCRYPTION_KEY);
	encrypted = substituteCharacters(encrypted);
	encrypted = reverseAndScramble(encrypted);

	// Prepend a marker so we know it's encrypted
	const marker = '🔒VSHATER_ENCRYPTED🔒';
	return marker + encrypted;
}

/**
 * Decrypts content back to original
 */
export function decryptContent(content: string): string | null {
	const marker = '🔒VSHATER_ENCRYPTED🔒';

	if (!content.startsWith(marker)) {
		return null;
	}

	let encrypted = content.substring(marker.length);

	// Reverse the obfuscation layers
	encrypted = reverseAndUnscramble(encrypted);
	encrypted = unsubstituteCharacters(encrypted);
	const decrypted = xorDecrypt(encrypted, ENCRYPTION_KEY);

	return decrypted;
}

/**
 * Checks if content is encrypted
 */
export function isEncrypted(content: string): boolean {
	return content.startsWith('🔒VSHATER_ENCRYPTED🔒');
}

/**
 * Simple XOR encryption
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
 * Simple XOR decryption
 */
function xorDecrypt(text: string, key: string): string {
	return xorEncrypt(text, key); // XOR is symmetric
}

/**
 * Character substitution for additional obfuscation
 */
function substituteCharacters(text: string): string {
	const substitutionMap: { [key: string]: string } = {
		'a': '⁰', 'b': '⁴', 'c': '⁵', 'd': '⁶', 'e': '⁷',
		'f': '⁸', 'g': '⁹', 'h': '◊', 'i': '◈', 'j': '◉',
		'k': '◎', 'l': '○', 'm': '●', 'n': '◌', 'o': '◐',
		'p': '◑', 'q': '◒', 'r': '◓', 's': '◔', 't': '◕',
		'u': '◖', 'v': '◗', 'w': '◘', 'x': '◙', 'y': '◚', 'z': '◛',
	};

	let result = '';
	for (const char of text) {
		const lower = char.toLowerCase();
		result += substitutionMap[lower] || char;
	}
	return result;
}

/**
 * Reverse character substitution
 */
function unsubstituteCharacters(text: string): string {
	const substitutionMap: { [key: string]: string } = {
		'⁰': 'a', '⁴': 'b', '⁵': 'c', '⁶': 'd', '⁷': 'e',
		'⁸': 'f', '⁹': 'g', '◊': 'h', '◈': 'i', '◉': 'j',
		'◎': 'k', '○': 'l', '●': 'm', '◌': 'n', '◐': 'o',
		'◑': 'p', '◒': 'q', '◓': 'r', '◔': 's', '◕': 't',
		'◖': 'u', '◗': 'v', '◘': 'w', '◙': 'x', '◚': 'y', '◛': 'z',
	};

	let result = '';
	for (const char of text) {
		result += substitutionMap[char] || char;
	}
	return result;
}

/**
 * Reverse the string and add some scrambling
 */
function reverseAndScramble(text: string): string {
	let reversed = text.split('').reverse().join('');

	// Add some noise every 10 characters
	let scrambled = '';
	for (let i = 0; i < reversed.length; i++) {
		scrambled += reversed[i];
		if ((i + 1) % 10 === 0) {
			scrambled += String.fromCharCode(Math.floor(Math.random() * 256));
		}
	}

	return scrambled;
}

/**
 * Reverse the scrambling and unscramble
 */
function reverseAndUnscramble(text: string): string {
	// Remove noise every 10 characters
	let unscrambled = '';
	let charCount = 0;
	for (let i = 0; i < text.length; i++) {
		if ((charCount + 1) % 10 === 0 && i !== text.length - 1) {
			i++; // Skip the noise character
		} else {
			unscrambled += text[i];
			charCount++;
		}
	}

	return unscrambled.split('').reverse().join('');
}

/**
 * Simple hash function for content
 */
function simpleHash(text: string): string {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

/**
 * Store file metadata
 */
export function storeFileMetadata(fileName: string, content: string): FileMetadata {
	return {
		originalHash: simpleHash(content),
		timestamp: Date.now(),
		fileName: fileName,
	};
}
