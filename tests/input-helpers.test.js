import { describe, it, expect } from 'vitest';
import { isEditableTarget } from '../src/game/input.js';

describe('isEditableTarget — 表單欄位聚焦時別吃鍵', () => {
  it('input / textarea / select / contenteditable → true（放行,不攔駕駛鍵）', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('遊戲畫布 / 一般元素 / null → false（照常吃駕駛鍵）', () => {
    expect(isEditableTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});
