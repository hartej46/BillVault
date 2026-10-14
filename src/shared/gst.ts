/**
 * GST utilities, GSTIN verification (regex + mod-36 checksum),
 * tax math consistency checks, and Indian financial year validation.
 */

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export const INDIAN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
}

/**
 * Validates 15-character GSTIN format and mod-36 checksum according to Indian GST specifications.
 */
export function validateGSTIN(gstin: string | null | undefined): { isValid: boolean; stateName?: string; error?: string } {
  if (!gstin) {
    return { isValid: false, error: 'GSTIN is missing' }
  }

  const clean = gstin.trim().toUpperCase()
  if (clean.length !== 15) {
    return { isValid: false, error: `Invalid GSTIN length (${clean.length} chars, expected 15)` }
  }

  if (!GSTIN_REGEX.test(clean)) {
    return { isValid: false, error: 'Invalid GSTIN format pattern' }
  }

  const stateCode = clean.slice(0, 2)
  const stateName = INDIAN_STATE_CODES[stateCode]
  if (!stateName) {
    return { isValid: false, error: `Invalid state code: ${stateCode}` }
  }

  // Mod-36 Checksum verification
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let factor = 1
  let sum = 0

  for (let i = 0; i < 14; i++) {
    const codePoint = chars.indexOf(clean[i])
    let addend = factor * codePoint
    factor = factor === 2 ? 1 : 2
    addend = Math.floor(addend / 36) + (addend % 36)
    sum += addend
  }

  const remainder = sum % 36
  const checkCodePoint = (36 - remainder) % 36
  const checkChar = chars[checkCodePoint]

  if (checkChar !== clean[14]) {
    return {
      isValid: false,
      stateName,
      error: `Invalid GSTIN checksum (expected check character '${checkChar}', found '${clean[14]}')`
    }
  }

  return { isValid: true, stateName }
}

export interface BillValidationInput {
  vendor_gstin?: string | null
  buyer_gstin?: string | null
  buyer_state?: string | null
  place_of_supply_state?: string | null
  taxable_amount?: number | null
  cgst?: number | null
  sgst?: number | null
  igst?: number | null
  cess?: number | null
  total_amount?: number | null
  bill_date?: string | null
  line_items?: Array<{ amount?: number | null }>
}

export interface ValidationResult {
  isValid: boolean
  confidence: number // 0 to 1
  warnings: string[]
}

/**
 * Validates tax math, GST rules, dates, and returns human-readable warnings and a confidence score.
 */
export function validateBill(input: BillValidationInput): ValidationResult {
  const warnings: string[] = []
  let penalty = 0

  // 1. GSTIN Check
  if (input.vendor_gstin) {
    const gstinCheck = validateGSTIN(input.vendor_gstin)
    if (!gstinCheck.isValid) {
      warnings.push(`Vendor GSTIN issue: ${gstinCheck.error}`)
      penalty += 0.25
    }
  } else {
    warnings.push('Vendor GSTIN missing')
    penalty += 0.1
  }

  // 2. State mismatch check (Intra-state vs Inter-state)
  const vendorState = input.vendor_gstin ? input.vendor_gstin.slice(0, 2) : input.place_of_supply_state
  const buyerState = input.buyer_state || (input.buyer_gstin ? input.buyer_gstin.slice(0, 2) : null)

  const cgst = input.cgst || 0
  const sgst = input.sgst || 0
  const igst = input.igst || 0
  const cess = input.cess || 0
  const taxable = input.taxable_amount || 0
  const total = input.total_amount || 0

  if (vendorState && buyerState) {
    if (vendorState === buyerState) {
      // Intra-state: Should have CGST + SGST, no IGST
      if (igst > 0 && cgst === 0 && sgst === 0) {
        warnings.push(`Same state (${vendorState}): Expected CGST+SGST, but bill has IGST (₹${igst})`)
        penalty += 0.15
      }
    } else {
      // Inter-state: Should have IGST, not CGST + SGST
      if ((cgst > 0 || sgst > 0) && igst === 0) {
        warnings.push(`Inter-state transaction (Vendor: ${vendorState}, Buyer: ${buyerState}): Expected IGST, but found CGST/SGST`)
        penalty += 0.15
      }
    }
  }

  // 3. CGST vs SGST equality check
  if (cgst > 0 && sgst > 0) {
    if (Math.abs(cgst - sgst) > 0.05) {
      warnings.push(`CGST (₹${cgst}) and SGST (₹${sgst}) are not equal`)
      penalty += 0.1
    }
  }

  // 4. Math Check: Taxable + CGST + SGST + IGST + Cess ≈ Total
  if (total > 0 && taxable > 0) {
    const calculatedTotal = taxable + cgst + sgst + igst + cess
    const diff = Math.abs(calculatedTotal - total)
    if (diff > 1.0) {
      warnings.push(`Total amount mismatch: Taxable (₹${taxable}) + Taxes (₹${cgst + sgst + igst + cess}) = ₹${calculatedTotal.toFixed(2)}, but bill total is ₹${total.toFixed(2)} (diff: ₹${diff.toFixed(2)})`)
      penalty += 0.3
    }
  } else if (total <= 0) {
    warnings.push('Total amount is missing or zero')
    penalty += 0.35
  }

  // 5. Line items sum check
  if (input.line_items && input.line_items.length > 0 && taxable > 0) {
    const itemsSum = input.line_items.reduce((acc, item) => acc + (item.amount || 0), 0)
    if (itemsSum > 0 && Math.abs(itemsSum - taxable) > 2.0) {
      warnings.push(`Line items sum (₹${itemsSum.toFixed(2)}) does not match taxable amount (₹${taxable.toFixed(2)})`)
      penalty += 0.15
    }
  }

  // 6. Date validation: Must not be in the future, must be reasonable
  if (input.bill_date) {
    const billDate = new Date(input.bill_date)
    const now = new Date()
    if (isNaN(billDate.getTime())) {
      warnings.push('Invalid bill date format')
      penalty += 0.15
    } else if (billDate.getTime() > now.getTime() + 86400000) {
      warnings.push(`Bill date is in the future (${input.bill_date})`)
      penalty += 0.25
    }
  } else {
    warnings.push('Bill date is missing')
    penalty += 0.1
  }

  const confidence = Math.max(0, Math.min(1, parseFloat((1 - penalty).toFixed(2))))

  return {
    isValid: warnings.length === 0,
    confidence,
    warnings
  }
}
