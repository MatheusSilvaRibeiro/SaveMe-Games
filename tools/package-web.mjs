import { cp, mkdir } from 'node:fs/promises';
const target = new URL('../backend/public/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(new URL('../dist/', import.meta.url), target, { recursive: true });
console.log('Site preparado em backend/public.');
