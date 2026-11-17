const sekFormatter = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
});

export function formatCurrency(priceMinor) {
  return sekFormatter.format(priceMinor / 100);
}
