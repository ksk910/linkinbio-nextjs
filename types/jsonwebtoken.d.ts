// Minimal type declaration for jsonwebtoken to satisfy TypeScript in CI.
// For full types, consider installing @types/jsonwebtoken.
declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    algorithm?: string;
  }
  export interface VerifyOptions {
    algorithms?: string[];
  }
  export function sign(payload: string | object | Buffer, secretOrPrivateKey: string, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: string, options?: VerifyOptions): any;
  export function decode(token: string): null | { [key: string]: any } | string;
  const _default: {
    sign: typeof sign;
    verify: typeof verify;
    decode: typeof decode;
  };
  export default _default;
}
