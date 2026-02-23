export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PVP-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function isValidReferralCode(code: string): boolean {
  return /^PVP-[A-HJ-NP-Z2-9]{6}$/.test(code);
}
