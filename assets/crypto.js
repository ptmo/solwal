// crypto.js - Advanced Security Module
const CryptoService = {
    // 1. Derivasi PIN menjadi Kunci Kriptografi 256-bit menggunakan PBKDF2
    async deriveKey(pin, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(pin),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000, // Standar industri untuk memperlambat Brute Force
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    // 2. Enkripsi Data (Private Key / Seed Phrase)
    async encryptData(plainText, pin) {
        const enc = new TextEncoder();
        const salt = window.crypto.getRandomValues(new Uint8Array(16)); // Salt acak
        const iv = window.crypto.getRandomValues(new Uint8Array(12));   // Initialization Vector acak

        const key = await this.deriveKey(pin, salt);
        const encodedData = enc.encode(plainText);

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedData
        );

        // Gabungkan IV, Salt, dan Ciphertext untuk disimpan
        const encryptedBuffer = new Uint8Array(encryptedContent);
        const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.length);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(encryptedBuffer, salt.length + iv.length);

        // Convert ke Base64 agar bisa disimpan di localStorage
        return btoa(String.fromCharCode.apply(null, combined));
    },

    // 3. Dekripsi Data (Membuka brankas saat mau transaksi)
    async decryptData(base64Cipher, pin) {
        try {
            const combinedStr = atob(base64Cipher);
            const combined = new Uint8Array(combinedStr.length);
            for (let i = 0; i < combinedStr.length; i++) {
                combined[i] = combinedStr.charCodeAt(i);
            }

            // Ekstrak Salt, IV, dan Ciphertext
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 28);
            const encryptedData = combined.slice(28);

            const key = await this.deriveKey(pin, salt);

            const decryptedContent = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encryptedData
            );

            const dec = new TextDecoder();
            return dec.decode(decryptedContent);
        } catch (error) {
            console.error("Dekripsi gagal. PIN salah atau data korup.");
            return null; // PIN salah
        }
    }
};