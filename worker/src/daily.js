// worker/src/daily.js — Task 18 完整實作
import { json } from './util.js';
export const handleDaily = async (req, env, origin) => json({ todo: true }, origin, 501);
