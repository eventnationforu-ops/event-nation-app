const GST_RATE = 0.18;

export function calculatePricing(pkg, members) {
  const adults = members.filter((m) => m.age >= 12);
  const kids = members.filter((m) => m.age < 12);

  const includedAdults = Math.min(adults.length, pkg.max_adults);
  const extraAdults = Math.max(0, adults.length - pkg.max_adults);

  const subtotal =
    Number(pkg.base_price) + extraAdults * Number(pkg.extra_adult_price);
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;

  return {
    adults_count: adults.length,
    kids_count: kids.length,
    included_adults: includedAdults,
    extra_adults: extraAdults,
    subtotal,
    gst,
    total,
  };
}
