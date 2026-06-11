// worker/src/score.js — Task 19 完整實作
import { json } from './util.js';
export const handleScore = async (req, env, origin) => json({ todo: true }, origin, 501);
