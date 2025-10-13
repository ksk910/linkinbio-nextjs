// Minimal type declaration for bcrypt to satisfy TypeScript in CI.
// If you prefer full types, install @types/bcrypt as a devDependency.
declare module 'bcrypt' {
  export function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
  const _default: {
    hash: typeof hash;
    compare: typeof compare;
    genSalt: typeof genSalt;
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
    genSaltSync: typeof genSaltSync;
  };
  export default _default;
}
