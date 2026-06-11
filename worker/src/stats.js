// worker/src/stats.js — Task 22 完整實作
import { json } from './util.js';
export const handleStats = async (req, env, origin) => json({ todo: true }, origin, 501);
export const handleEvent = async (req, env, origin) => json({ todo: true }, origin, 501);
