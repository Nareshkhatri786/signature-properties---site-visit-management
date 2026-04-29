export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except '+'
  let clean = phone.replace(/[^\d+]/g, '');

  // 1. If it starts with +91, keep as is (assuming it's followed by 10 digits)
  if (clean.startsWith('+91')) {
    return clean;
  }

  // 2. If it starts with 91 and has 12 digits, convert to +91XXXXXXXXXX
  if (clean.startsWith('91') && clean.length === 12) {
    return '+' + clean;
  }

  // 3. If it has 10 digits, add +91 prefix
  if (clean.length === 10 && !clean.startsWith('+')) {
    return '+91' + clean;
  }

  // 4. Handle cases with leading 0 (common in India for 10-digit numbers)
  if (clean.startsWith('0') && clean.length === 11) {
    return '+91' + clean.substring(1);
  }

  // Default fallback: ensure it has the + if it looks like a full number, 
  // but if it's specifically for India and only 10 digits were provided:
  if (clean.length === 10) {
    return '+91' + clean;
  }

  return clean.startsWith('+') ? clean : (clean.length > 0 ? '+' + clean : clean);
}
