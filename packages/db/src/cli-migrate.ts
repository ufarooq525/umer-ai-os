import { closeMySql, migrate } from './index.js';

await migrate();
await closeMySql();

