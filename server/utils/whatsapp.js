const normalizeWhatsAppNumber = (value) => {
  if (!value) return '';
  return String(value).replace(/[^0-9]/g, '');
};

module.exports = {
  normalizeWhatsAppNumber,
};