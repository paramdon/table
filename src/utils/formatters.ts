/**
 * Format numbers according to Indian Rupee (INR) numbering system.
 * e.g., 1450 -> ₹1,450, 10250.5 -> ₹10,250.50
 */
export function formatINR(amount: number, showDecimals: boolean = false): string {
  const rounded = showDecimals ? amount.toFixed(2) : Math.round(amount).toString();
  const parts = rounded.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian currency numbering regex (last 3 digits, then groups of 2)
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  return `₹${integerPart}${decimalPart ? '.' + decimalPart : ''}`;
}

export interface UpiParams {
  payeeVpa: string; // e.g. saffronverandah@merchantupi
  payeeName: string; // e.g. The Saffron Verandah
  amount: number; // e.g. 1420.00
  transactionNote: string; // e.g. Table 4 Dining Bill
}

export function generateUpiUri({ payeeVpa, payeeName, amount, transactionNote }: UpiParams): string {
  const encodedName = encodeURIComponent(payeeName);
  const encodedNote = encodeURIComponent(transactionNote);
  const formattedAmt = amount.toFixed(2);
  return `upi://pay?pa=${payeeVpa}&pn=${encodedName}&am=${formattedAmt}&cu=INR&tn=${encodedNote}`;
}
