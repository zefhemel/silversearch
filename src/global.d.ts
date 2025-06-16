declare module '*.css';

declare module globalThis {
    async function syscall(name: string, ...args: any): any;
}