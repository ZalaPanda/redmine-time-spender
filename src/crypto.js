import { secretbox, randomBytes } from 'tweetnacl';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const createNonce = () => randomBytes(secretbox.nonceLength);
export const createKey = () => randomBytes(secretbox.keyLength);

export const createCryptoApi = (key) => {
    /**
     * @param {value} any
     * @returns {Uint8Array}
     * */
    const encrypt = (value) => {
        const nonce = createNonce();
        const raw = encoder.encode(JSON.stringify(value));
        const box = secretbox(raw, nonce, key);
        const nonceAndBox = new Uint8Array(nonce.length + box.length);
        nonceAndBox.set(nonce);
        nonceAndBox.set(box, nonce.length);
        return nonceAndBox;
    }
    /**
     * @param {Uint8Array} nonceAndBox
     * @returns {any}
     * */
    const decrypt = (nonceAndBox) => {
        const nonce = nonceAndBox.slice(0, secretbox.nonceLength);
        const box = nonceAndBox.slice(secretbox.nonceLength);
        const raw = secretbox.open(box, nonce, key);
        const value = raw && JSON.parse(decoder.decode(raw));
        return value;
    }
    return { encrypt, decrypt }
};

// const fromHexString = hexString => new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
// const toHexString = bytes => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// const cookieName = '_redmine_time_spender';
// export const cookieKey = (url) => ({
//     get: _ => new Promise((resolve, reject) => chrome.cookies.get({
//         name: cookieName, url
//     }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(fromHexString(cookie.value)))),
//     set: _ => new Promise((resolve, reject) => chrome.cookies.set({
//         name: cookieName, value: toHexString(genKey()), url, httpOnly: true, secure: true, expirationDate: 2147483647
//     }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(fromHexString(cookie.value))))
// });

// export const encryptItems = (key, schema, items) => {
//     const keys = [schema.primKey?.name, ...schema.indexes?.map(index => index.name)].filter(key => key);
//     return items.map(item => ({
//         ...Object.fromEntries(Object.entries(item).filter(([key]) => keys.includes(key))), // keys
//         _data: encrypt(key, Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)))) // rest
//     }));
// }

// export const decryptItems = (key, items) => items.map(({ _data, ...keys }) => ({
//     ...keys,
//     ...decrypt(key, _data)
// }));
