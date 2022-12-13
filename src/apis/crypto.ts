import { secretbox, randomBytes } from 'tweetnacl';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const convertHexToBin = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
export const convertBinToHex = (bin: Uint8Array) => bin.reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '');

export const createNonce = () => randomBytes(secretbox.nonceLength);
export const createKey = () => randomBytes(secretbox.keyLength);

/** Encription/decryption API */
export interface CryptoAPI {
    encrypt: (value: any) => Uint8Array,
    decrypt: (nonceAndBox: Uint8Array) => any
}

/** Create Crypto API with encryption key */
export const createCryptoApi = (key: Uint8Array): CryptoAPI => {
    const encrypt = (value: any): Uint8Array => {
        const nonce = createNonce();
        const raw = encoder.encode(JSON.stringify(value));
        const box = secretbox(raw, nonce, key);
        const nonceAndBox = new Uint8Array(nonce.length + box.length);
        nonceAndBox.set(nonce);
        nonceAndBox.set(box, nonce.length);
        return nonceAndBox;
    }
    const decrypt = (nonceAndBox: Uint8Array): any => {
        const nonce = nonceAndBox.slice(0, secretbox.nonceLength);
        const box = nonceAndBox.slice(secretbox.nonceLength);
        const raw = secretbox.open(box, nonce, key);
        const value = raw && JSON.parse(decoder.decode(raw));
        return value;
    }
    return { encrypt, decrypt }
};
