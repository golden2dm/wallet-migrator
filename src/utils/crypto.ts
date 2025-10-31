import CryptoJS from 'crypto-js';

class Crypto {
  encrypt(pk: string, signature: string): string {
    return CryptoJS.AES.encrypt(pk, signature).toString();
  }

  decrypt(encrypted: string, signature: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, signature);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  }
}

export default new Crypto();

