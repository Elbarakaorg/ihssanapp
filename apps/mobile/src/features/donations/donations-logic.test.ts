import { describe, expect, it } from 'vitest';

import { caseShareUrl, instagramEmbedUrl, isUuid, isValidEmail, collectorInviteUrl, formatMad, groupAccountNumber, parseAmount, percentFunded, pledgeStatus, safeHttpsUrl, suggestedAmounts, timeLeft, validateAmount } from './donations-logic';

describe('donation logic', () => {
  it('computes progress safely', () => {
    expect(percentFunded(5000, 50000)).toBe(10);
    expect(percentFunded(60000, 50000)).toBe(100);
    expect(percentFunded(10, 0)).toBe(0);
    expect(percentFunded(-5, 100)).toBe(0);
  });
  it('parses typed amounts', () => {
    expect(parseAmount('1 500')).toBe(1500);
    expect(parseAmount('١٢٠')).toBe(120);
    expect(parseAmount('12.5x')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('123456789')).toBeNull();
  });
  it('validates amounts', () => {
    expect(validateAmount(null, 20)).toMatch(/Enter/);
    expect(validateAmount(10, 20)).toMatch(/minimum/);
    expect(validateAmount(20, 20)).toBe('');
    expect(validateAmount(2_000_000, 20)).toMatch(/contact/);
  });
  it('suggests amounts around the minimum and remaining', () => {
    expect(suggestedAmounts(20, 0)).toEqual([50, 100, 200, 500, 1000]);
    expect(suggestedAmounts(20, 150)).toEqual([50, 100]);
    expect(suggestedAmounts(300, 0)).toEqual([500, 1000]);
    expect(suggestedAmounts(5000, 0)).toEqual([5000]);
  });
  it('counts down', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(timeLeft('2026-01-01T05:07:00Z', now)).toEqual({ expired: false, label: '5h 07m left' });
    expect(timeLeft('2026-01-01T00:00:20Z', now).label).toBe('1 min left');
    expect(timeLeft('2025-12-31T00:00:00Z', now).expired).toBe(true);
  });
  it('maps statuses', () => {
    expect(pledgeStatus('confirmed').tone).toBe('ok');
    expect(pledgeStatus('weird').label).toBe('weird');
  });
  it('validates donor emails', () => {
    expect(isValidEmail(' donor@example.com ')).toBe(true);
    expect(isValidEmail('donor@example')).toBe(false);
    expect(isValidEmail('do nor@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@x.co`)).toBe(false);
  });
  it('only allows https links', () => {
    expect(safeHttpsUrl('https://instagram.com/a')).toContain('https://');
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('http://x.com')).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
  });
  it('builds urls and formats', () => {
    expect(caseShareUrl('https://ihssanapp.com/', 'abc')).toBe('https://ihssanapp.com/cases/abc');
    expect(collectorInviteUrl('https://ihssanapp.com', 'a b')).toBe('https://ihssanapp.com/collect/accept?token=a%20b');
    expect(formatMad(1234.4)).toBe('1,234 MAD');
    expect(groupAccountNumber('230780000000000000000001')).toBe('2307 8000 0000 0000 0000 0001');
  });
});

describe('case links and reels', () => {
  it('detects uuids versus readable names', () => {
    expect(isUuid('b392287a-f4e0-4a64-9e8b-a0c26262c652')).toBe(true);
    expect(isUuid('amina-el-fassi')).toBe(false);
    expect(caseShareUrl('https://ihssanapp.com/', 'amina-el-fassi')).toBe('https://ihssanapp.com/cases/amina-el-fassi');
  });
  it('only embeds instagram reel and post links', () => {
    expect(instagramEmbedUrl('https://www.instagram.com/reel/Cabc12345/?igsh=x')).toBe('https://www.instagram.com/reel/Cabc12345/embed');
    expect(instagramEmbedUrl('https://instagram.com/p/Cabc12345')).toBe('https://www.instagram.com/p/Cabc12345/embed');
    expect(instagramEmbedUrl('https://evil.com/reel/Cabc12345/')).toBeNull();
    expect(instagramEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(instagramEmbedUrl(null)).toBeNull();
  });
});
