// Client-side utility functions

/**
 * Hash password using SHA-256 (client-side hashing)
 * Includes a pure JS fallback for non-secure contexts (HTTP on Android/IP)
 */
export async function hashPassword(password) {
    // Try native crypto first (requires secure context - HTTPS or localhost)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (e) {
            console.warn('Native crypto failed, falling back to JS implementation', e);
        }
    }

    // Fallback SHA-256 implementation
    return sha256_fallback(password);
}

/**
 * Pure JS SHA-256 implementation for non-secure contexts
 */
function sha256_fallback(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    
    const Math_pow = Math.pow;
    const maxWord = Math_pow(2, 32);
    const lengthProperty = 'length';
    let i, j; // Used as a counter across the whole file
    let result = '';

    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    
    // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
    let hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    // Constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let primeCounter = k[lengthProperty];
    const isPrime = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isPrime[candidate]) {
            for (i = 0; i < 313; i += candidate) {
                isPrime[i] = candidate;
            }
            hash[primeCounter] = (Math_pow(candidate, .5) * maxWord) | 0;
            k[primeCounter++] = (Math_pow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    
    ascii += '\x80'; // Append '1' bit (plus zero padding)
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // More zero padding
    for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return; // NOT sessions.json - just bail if not ASCII
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    
    // Process each chunk
    for (j = 0; j < words[lengthProperty]; ) {
        const w = words.slice(j, j += 16); // The next 16 words
        const oldHash = hash;
        // Initial values for this chunk
        hash = hash.slice(0, 8);
        
        for (i = 0; i < 64; i++) {
            const i2 = i + j;
            // Expand the message schedule if needed
            const w15 = w[i - 15], w2 = w[i - 2];

            // Iteration functions
            const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
            const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const b0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
            const b1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

            const temp1 = hash[7] + b1 + ch + k[i] + (w[i] = (i < 16) ? w[i] : (
                w[i - 16] + s0 + w[i - 7] + s1
            ) | 0);
            const temp2 = b0 + maj;
            
            hash = [(temp1 + temp2) | 0].concat(hash); // We don't use hash.unshift for performance
            hash[4] = (hash[4] + temp1) | 0;
        }
        
        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }
    
    for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
            const b = (hash[i] >> (j * 8)) & 255;
            result += (b < 16 ? '0' : '') + b.toString(16);
        }
    }
    return result;
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return Math.floor(num).toLocaleString();
}

/**
 * Format countdown timer
 */
export function formatCountdown(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format timestamp as readable date
 */
export function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

/**
 * Format timestamp as readable time
 */
export function formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
