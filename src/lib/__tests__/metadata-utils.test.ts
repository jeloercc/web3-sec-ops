import { describe, it, expect } from 'vitest';
import { extractGas } from '../metadata-utils';

describe('extractGas', () => {
  it('returns null for undefined metadata', () => {
    expect(extractGas(undefined)).toBeNull();
  });

  it('returns null for null metadata', () => {
    expect(extractGas(null)).toBeNull();
  });

  it('returns null for non-object metadata', () => {
    expect(extractGas('string')).toBeNull();
    expect(extractGas(123)).toBeNull();
  });

  it('extracts gasUsedPercent', () => {
    expect(extractGas({ gasUsedPercent: 75 })).toBe(75);
  });

  it('extracts gasUsageRatio and converts to percentage', () => {
    expect(extractGas({ gasUsageRatio: 0.75 })).toBe(75);
  });

  it('extracts gasPercent', () => {
    expect(extractGas({ gasPercent: 50 })).toBe(50);
  });

  it('extracts gasUsedPercentage', () => {
    expect(extractGas({ gasUsedPercentage: 90 })).toBe(90);
  });

  it('prefers gasUsedPercent over other keys', () => {
    expect(extractGas({ gasUsedPercent: 80, gasUsageRatio: 0.5 })).toBe(80);
  });

  it('returns null for non-finite numbers', () => {
    expect(extractGas({ gasUsedPercent: NaN })).toBeNull();
    expect(extractGas({ gasUsedPercent: Infinity })).toBeNull();
  });

  it('returns null for non-numeric values', () => {
    expect(extractGas({ gasUsedPercent: '75' })).toBeNull();
    expect(extractGas({ gasUsedPercent: {} })).toBeNull();
  });

  it('handles ratio <= 1 as fraction', () => {
    expect(extractGas({ gasUsageRatio: 0.5 })).toBe(50);
    expect(extractGas({ gasUsageRatio: 1 })).toBe(100);
  });

  it('handles values > 1 as percentage', () => {
    expect(extractGas({ gasUsedPercent: 150 })).toBe(150);
  });
});