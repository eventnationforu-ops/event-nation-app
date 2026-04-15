const GST_RATE = 0.18;
const BASE_ADULTS_INCLUDED = 2;
const MAX_KIDS_ALLOWED = 2;
const MAX_CHILD_AGE = 12;
const EXTRA_ADULT_MULTIPLIER = 0.5;

/**
 * Dynamically calculate booking price.
 *
 * Base package includes 2 adults + up to 2 kids (age <= 12).
 * per_adult_price   = base_price / 2
 * extra_adult_price = per_adult_price * 0.5   (50% of per-adult price)
 * GST at 18% is applied on the subtotal.
 */
function calculatePricing(pkg, members) {
  const basePrice = Number(pkg.base_price);
  const adults = members.filter((m) => m.age > MAX_CHILD_AGE);
  const kids = members.filter((m) => m.age <= MAX_CHILD_AGE);

  const perAdultPrice = basePrice / BASE_ADULTS_INCLUDED;
  const extraAdultPrice = perAdultPrice * EXTRA_ADULT_MULTIPLIER;

  const extraAdults = Math.max(0, adults.length - BASE_ADULTS_INCLUDED);
  const extraAdultsCost = Math.round(extraAdults * extraAdultPrice * 100) / 100;

  const subtotal = Math.round((basePrice + extraAdultsCost) * 100) / 100;
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;

  return {
    adults_count: adults.length,
    kids_count: kids.length,
    extra_adults: extraAdults,
    breakdown: {
      base_price: basePrice,
      per_adult_price: perAdultPrice,
      extra_adult_price: extraAdultPrice,
      extra_adults_cost: extraAdultsCost,
    },
    subtotal,
    gst,
    total,
  };
}

module.exports = {
  calculatePricing,
  GST_RATE,
  BASE_ADULTS_INCLUDED,
  MAX_KIDS_ALLOWED,
  MAX_CHILD_AGE,
};
