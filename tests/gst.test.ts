import { describe, it, expect } from 'vitest'
import { validateGSTIN, validateBill } from '../src/shared/gst'

describe('GSTIN Verification & Mod-36 Checksum', () => {
  it('validates a real valid GSTIN with correct checksum', () => {
    // 27AAPFU0939F1ZV (Valid Maharashtra GSTIN)
    const result = validateGSTIN('27AAPFU0939F1ZV')
    expect(result.isValid).toBe(true)
    expect(result.stateName).toBe('Maharashtra')

    // 27AASCS2460H1Z0 (Valid Maharashtra GSTIN ending in numeric check char)
    const result2 = validateGSTIN('27AASCS2460H1Z0')
    expect(result2.isValid).toBe(true)
  })

  it('rejects an invalid GSTIN checksum', () => {
    // Tampered check character ('X' instead of 'V')
    const result = validateGSTIN('27AAPFU0939F1ZX')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Invalid GSTIN checksum')
  })

  it('rejects an invalid GSTIN format or length', () => {
    expect(validateGSTIN('12345').isValid).toBe(false)
    expect(validateGSTIN('27AABCU9603R1').isValid).toBe(false)
    expect(validateGSTIN(null).isValid).toBe(false)
  })

  it('rejects an invalid state code', () => {
    // State code 99 is invalid
    const result = validateGSTIN('99ABCDE1234F1Z5')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Invalid state code')
  })
})

describe('Bill Tax Math & Consistency Rules', () => {
  it('passes a clean intra-state invoice with matching CGST + SGST', () => {
    const res = validateBill({
      vendor_gstin: '27AAPFU0939F1ZV',
      buyer_state: '27',
      taxable_amount: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      cess: 0,
      total_amount: 1180,
      bill_date: '2026-09-15',
      line_items: [{ amount: 1000 }]
    })

    expect(res.isValid).toBe(true)
    expect(res.warnings).toHaveLength(0)
    expect(res.confidence).toBe(1.0)
  })

  it('flags total amount mismatch when taxes do not add up', () => {
    const res = validateBill({
      vendor_gstin: '27AAPFU0939F1ZV',
      buyer_state: '27',
      taxable_amount: 1000,
      cgst: 90,
      sgst: 90,
      total_amount: 1500, // Deliberate mismatch
      bill_date: '2026-09-15'
    })

    expect(res.isValid).toBe(false)
    expect(res.warnings.some((w) => w.includes('Total amount mismatch'))).toBe(true)
    expect(res.confidence).toBeLessThan(1.0)
  })

  it('flags CGST and SGST mismatch', () => {
    const res = validateBill({
      vendor_gstin: '27AAPFU0939F1ZV',
      buyer_state: '27',
      taxable_amount: 1000,
      cgst: 90,
      sgst: 50, // Mismatched
      total_amount: 1140,
      bill_date: '2026-09-15'
    })

    expect(res.warnings.some((w) => w.includes('CGST (₹90) and SGST (₹50) are not equal'))).toBe(true)
  })

  it('flags inter-state transaction expecting IGST', () => {
    const res = validateBill({
      vendor_gstin: '27AAPFU0939F1ZV', // Maharashtra
      buyer_state: '29', // Karnataka
      taxable_amount: 1000,
      cgst: 90,
      sgst: 90, // Wrong: Should be IGST
      total_amount: 1180,
      bill_date: '2026-09-15'
    })

    expect(res.warnings.some((w) => w.includes('Expected IGST'))).toBe(true)
  })

  it('flags future dates', () => {
    const res = validateBill({
      total_amount: 100,
      bill_date: '2099-01-01'
    })

    expect(res.warnings.some((w) => w.includes('future'))).toBe(true)
  })
})
