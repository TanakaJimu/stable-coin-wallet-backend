export function to2(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.round(v * 100) / 100;
  }
  
  export function assertPositiveAmount(amount) {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error("Amount must be a positive number");
    }
    return to2(v);
  }
  