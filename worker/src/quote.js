// worker/src/quote.js — Task 20 完整實作
import { json } from './util.js';
export const handleQuote = async (req, env, origin) => json({ todo: true }, origin, 501);
