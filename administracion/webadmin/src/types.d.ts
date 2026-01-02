// Declaraciones de tipos para módulos que no tienen tipos definidos

declare module 'bcryptjs' {
  export function compare(password: string, hash: string): Promise<boolean>;
  export function hash(password: string, saltRounds: number): Promise<string>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string): any;
}