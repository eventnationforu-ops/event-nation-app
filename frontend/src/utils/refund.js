const PROCESSING_FEE_RATE = 0.05;

export function calculateRefund(bookingTotal, eventDate) {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = event.getTime() - now.getTime();
  const daysBeforeEvent = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let refundPercentage;
  if (daysBeforeEvent >= 15) {
    refundPercentage = 90;
  } else if (daysBeforeEvent >= 10) {
    refundPercentage = 50;
  } else if (daysBeforeEvent >= 7) {
    refundPercentage = 25;
  } else {
    refundPercentage = 0;
  }

  const grossRefund = (parseFloat(bookingTotal) * refundPercentage) / 100;
  const processingFee = Math.round(grossRefund * PROCESSING_FEE_RATE * 100) / 100;
  const refundAmount = Math.round((grossRefund - processingFee) * 100) / 100;

  return {
    days_before_event: daysBeforeEvent,
    refund_percentage: refundPercentage,
    gross_refund: grossRefund,
    processing_fee: processingFee,
    refund_amount: refundAmount,
  };
}
