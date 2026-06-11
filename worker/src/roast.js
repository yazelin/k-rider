// worker/src/roast.js — Task 21 完整實作
import { json } from './util.js';
export const handleRoast = async (req, env, origin) => json({ todo: true }, origin, 501);
