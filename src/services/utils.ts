export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const SERVICE_FEE_RATE = 0.05;

export function getDriverVisiblePrice(basePricePerHour: number): number {
  return Math.round(basePricePerHour * (1 + SERVICE_FEE_RATE));
}
