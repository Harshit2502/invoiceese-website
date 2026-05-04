const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const formatINR = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

const templateThemes = {
  modern: {
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    accentColor: '#dc2626',
    heading: 'INVOICE',
  },
  minimal: {
    primaryColor: '#111827',
    secondaryColor: '#6b7280',
    accentColor: '#111827',
    heading: 'Invoice',
  },
  classic: {
    primaryColor: '#7c2d12',
    secondaryColor: '#57534e',
    accentColor: '#b45309',
    heading: 'Tax Invoice',
  },
  premium: {
    primaryColor: '#0f766e',
    secondaryColor: '#475569',
    accentColor: '#ca8a04',
    heading: 'Premium Invoice',
  },
};

const getImageBufferFromDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
};

const numberToWords = (num) => {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'only' : 'only';
  return str.trim() + (str.trim() === 'only' ? '' : ' Rupees');
};

const generateClassicPDF = (doc, invoice, user) => {
  const primaryColor = '#000000';
  const tableHeaderColor = '#b2ebf2';
  const hasGst = Boolean(user.gstNumber);
  const badgeText = hasGst ? 'TAX INVOICE' : 'INVOICE';
  const badgeColor = hasGst ? '#059669' : '#d97706';

  doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text(user.businessName || 'My Business', 50, 50);
  doc.fontSize(10).font('Helvetica').text(`GST: ${user.gstNumber || 'N/A'}`, 50, 75);

  doc.fontSize(10).font('Helvetica')
     .text(`Original • #Sale Bill no. ${invoice.invoiceNumber}`, 350, 50, { align: 'right' })
     .text(`Date: ${new Date(invoice.date || new Date()).toLocaleDateString('en-IN')}`, 350, 70, { align: 'right' });

  doc.fillColor(badgeColor).fontSize(14).font('Helvetica-Bold').text(badgeText, 350, 30, { align: 'right' });

  const billToY = 110;
  doc.rect(50, billToY, 495, 90).stroke();
  doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('BILL TO', 60, billToY + 10);
  doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(invoice.clientName, 60, billToY + 25);
  
  let yPos = billToY + 40;
  if (invoice.clientAddress) {
    doc.fontSize(10).font('Helvetica').text(invoice.clientAddress, 60, yPos);
    yPos += 15;
  }
  if (invoice.clientMobile) {
    doc.fontSize(10).font('Helvetica').text(`Mobile: ${invoice.clientMobile}`, 60, yPos);
    yPos += 15;
  }
  if (hasGst) {
    doc.fontSize(10).font('Helvetica-Bold').text(`GSTIN: ${invoice.clientGst || 'N/A'}`, 60, yPos);
  }

  const tableTop = 210;
  doc.rect(50, tableTop, 495, 20).fillAndStroke(tableHeaderColor, primaryColor);
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold');
  
  const colPositions = hasGst 
    ? { sno: 55, items: 90, hsn: 280, qty: 350, rate: 410, amount: 480 }
    : { sno: 55, items: 90, qty: 350, rate: 410, amount: 480 };
  
  doc.text('S.No.', colPositions.sno, tableTop + 6)
     .text('ITEMS', colPositions.items, tableTop + 6);
  
  if (hasGst) doc.text('HSN/SAC', colPositions.hsn, tableTop + 6);

  doc.text('QTY', colPositions.qty, tableTop + 6, { width: 50, align: 'right' })
     .text('RATE', colPositions.rate, tableTop + 6, { width: 50, align: 'right' })
     .text('AMOUNT', colPositions.amount, tableTop + 6, { width: 60, align: 'right' });

  const drawTableLines = (yStart, yEnd) => {
    const lines = hasGst ? [50, 85, 275, 345, 405, 475, 545] : [50, 85, 345, 405, 475, 545];
    lines.forEach(x => { doc.moveTo(x, yStart).lineTo(x, yEnd).stroke(); });
  };

  let itemsY = tableTop + 20;
  doc.font('Helvetica').fontSize(9);

  const invoiceItems = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [{ description: invoice.service || 'Service', quantity: 1, unitPrice: Number(invoice.subtotal || invoice.amount) || 0, amount: Number(invoice.subtotal || invoice.amount) || 0 }];

  invoiceItems.forEach((item, i) => {
    doc.text(String(i + 1), colPositions.sno, itemsY + 5)
       .text(item.description || 'Item', colPositions.items, itemsY + 5, { width: hasGst ? 180 : 250 });
    
    if (hasGst) doc.text(item.hsn || '', colPositions.hsn, itemsY + 5);

    doc.text(String(item.quantity || 1), colPositions.qty, itemsY + 5, { width: 50, align: 'right' })
       .text(Number(item.unitPrice || 0).toFixed(2), colPositions.rate, itemsY + 5, { width: 50, align: 'right' })
       .text(Number(item.amount || (item.quantity || 1) * (item.unitPrice || 0)).toFixed(2), colPositions.amount, itemsY + 5, { width: 60, align: 'right' });
    itemsY += 20;
  });

  const minTableHeight = Math.max(itemsY, tableTop + 100);
  drawTableLines(tableTop, minTableHeight);
  itemsY = minTableHeight;

  doc.rect(50, itemsY, 495, 20).stroke(); drawTableLines(itemsY, itemsY + 20);
  doc.font('Helvetica-Bold').text('Subtotal', colPositions.items, itemsY + 6).text(Number(invoice.amount || invoice.subtotal || 0).toFixed(2), colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
  itemsY += 20;

  if (invoice.gstAmount > 0 && hasGst) {
    const halfGst = (Number(invoice.gstAmount) / 2).toFixed(2);
    const halfRate = (Number(invoice.gstRate) / 2).toFixed(1);
    
    doc.rect(50, itemsY, 495, 20).stroke(); drawTableLines(itemsY, itemsY + 20);
    doc.font('Helvetica-Bold').text(`CGST (${halfRate}%)`, colPositions.items, itemsY + 6).text(halfGst, colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
    itemsY += 20;

    doc.rect(50, itemsY, 495, 20).stroke(); drawTableLines(itemsY, itemsY + 20);
    doc.font('Helvetica-Bold').text(`SGST (${halfRate}%)`, colPositions.items, itemsY + 6).text(halfGst, colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
    itemsY += 20;
  }

  const finalTotal = Number(invoice.totalAmount || invoice.total || invoice.amount || 0);
  doc.rect(50, itemsY, 495, 20).fillAndStroke(tableHeaderColor, primaryColor); drawTableLines(itemsY, itemsY + 20);
  doc.fillColor(primaryColor).font('Helvetica-Bold').text('TOTAL', colPositions.items, itemsY + 6).text(finalTotal.toFixed(2), colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
  itemsY += 20;

  const received = invoice.status === 'paid' ? finalTotal : 0;
  const balance = finalTotal - received;
  
  doc.rect(50, itemsY, 495, 20).stroke(); drawTableLines(itemsY, itemsY + 20);
  doc.font('Helvetica-Bold').text('RECEIVED AMOUNT', colPositions.items, itemsY + 6).text(received.toFixed(2), colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
  itemsY += 20;

  doc.rect(50, itemsY, 495, 20).stroke(); drawTableLines(itemsY, itemsY + 20);
  doc.font('Helvetica-Bold').text('INVOICE BALANCE', colPositions.items, itemsY + 6).text(balance.toFixed(2), colPositions.amount, itemsY + 6, { width: 60, align: 'right' });
  itemsY += 20;

  const wordsY = itemsY + 20;
  doc.rect(50, wordsY, 495, 40).stroke();
  doc.font('Helvetica-Bold').text('TOTAL AMOUNT IN WORDS', 60, wordsY + 8);
  doc.font('Helvetica').fillColor('#666666').text(numberToWords(Math.round(finalTotal)), 60, wordsY + 22);

  if (invoice.showWatermark) {
    doc.save();
    doc.rotate(-35, { origin: [300, 420] });
    doc.fillColor('#94a3b8').opacity(0.16).fontSize(44).font('Helvetica-Bold').text('InvoiceEase', 135, 420, { align: 'center', width: 320 });
    doc.restore(); doc.opacity(1);
  }
  doc.end();
};

const generatePremiumPDF = (doc, invoice, user) => {
  const primaryColor = '#c2591d'; // Orange/brown
  const textColor = '#000000';
  const mutedColor = '#6b7280';
  const tableBorder = '#e5e7eb';
  const bgGray = '#f8fafc';
  const hasGst = Boolean(user.gstNumber);
  const badgeText = hasGst ? 'TAX INVOICE' : 'INVOICE';
  const badgeColor = hasGst ? '#059669' : '#d97706';

  const formatAmountNoSymbol = (val) => Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  // 1. Top Header
  const bizInitial = (user.businessName || 'M').charAt(0).toUpperCase();
  doc.roundedRect(50, 50, 28, 28, 6).fill(primaryColor);
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(bizInitial, 50, 56, { width: 28, align: 'center' });
  
  doc.fillColor(textColor).fontSize(20).font('Helvetica-Bold').text(user.businessName || 'My Business', 85, 52);
  doc.fillColor(mutedColor).fontSize(10).font('Helvetica-Oblique').text(`Phone: ${user.whatsapp || 'N/A'}`, 85, 75);

  doc.fillColor(badgeColor).fontSize(12).font('Helvetica-Bold').text(badgeText, 300, 35, { width: 245, align: 'right' });
  doc.fillColor(textColor).fontSize(16).font('Helvetica-Bold').text(`No. ${invoice.invoiceNumber || '1'}`, 300, 52, { width: 245, align: 'right' });
  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(`Invoice Date: ${new Date(invoice.date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 300, 75, { width: 245, align: 'right' });

  // 2. Bill To Box
  const billToY = 110;
  doc.roundedRect(50, billToY, 495, 110, 8).lineWidth(1).stroke(primaryColor);
  
  doc.fillColor(mutedColor).fontSize(11).font('Helvetica').text('Bill and Ship To', 65, billToY + 15);
  doc.fillColor(textColor).fontSize(13).font('Helvetica-Bold').text(invoice.clientName || 'Client Name', 65, billToY + 35);
  
  let pYPos = billToY + 55;
  if (invoice.clientAddress) {
    doc.fillColor(textColor).fontSize(10).font('Helvetica').text(invoice.clientAddress, 65, pYPos);
    pYPos += 15;
  }
  if (invoice.clientMobile) {
    doc.fillColor(textColor).fontSize(10).font('Helvetica').text(`Mobile: ${invoice.clientMobile}`, 65, pYPos);
    pYPos += 15;
  }
  if (hasGst) {
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(`GSTIN: ${invoice.clientGst || 'N/A'}`, 65, pYPos);
  }

  const finalTotal = Number(invoice.totalAmount || invoice.total || invoice.amount || 0);
  doc.fillColor(textColor).fontSize(10).font('Helvetica').text('Total amount', 350, billToY + 15, { width: 175, align: 'right' });
  doc.fillColor(textColor).fontSize(24).font('Helvetica-Bold').text(formatAmountNoSymbol(finalTotal), 350, billToY + 30, { width: 175, align: 'right' });
  doc.fillColor(mutedColor).fontSize(10).font('Helvetica-Oblique').text(numberToWords(Math.round(finalTotal)), 250, billToY + 65, { width: 275, align: 'right' });

  if (invoice.status === 'paid') {
    doc.save();
    doc.translate(380, billToY + 45);
    doc.rotate(-20);
    doc.circle(0, 0, 30).lineWidth(3).stroke('#22c55e');
    doc.circle(0, 0, 25).lineWidth(1).stroke('#22c55e');
    doc.fillColor('#22c55e').fontSize(14).font('Helvetica-Bold').text('PAID', -20, -7, { width: 40, align: 'center' });
    doc.fontSize(6).text('THANK YOU', -20, -18, { width: 40, align: 'center' });
    doc.restore();
  }

  // 3. Items Table
  let tableTop = 235;
  const colPositions = hasGst 
    ? { sno: 65, items: 100, hsn: 210, priceUnit: 270, qty: 350, rate: 410, total: 470 }
    : { sno: 65, items: 110, priceUnit: 260, qty: 350, rate: 410, total: 470 };

  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold');
  doc.text('#', colPositions.sno, tableTop + 15)
     .text('Item Details', colPositions.items, tableTop + 15);
     
  if (hasGst) doc.text('HSN/SAC', colPositions.hsn, tableTop + 15);

  doc.text('Price/Unit', colPositions.priceUnit, tableTop + 15, { width: 70, align: 'center' })
     .text('Qty', colPositions.qty, tableTop + 15, { width: 40, align: 'center' })
     .text('Rate', colPositions.rate, tableTop + 15, { width: 60, align: 'center' })
     .text('Total', colPositions.total, tableTop + 15, { width: 60, align: 'right' });

  doc.moveTo(50, tableTop + 35).lineTo(545, tableTop + 35).lineWidth(1).stroke(textColor);

  let itemsY = tableTop + 50;
  doc.font('Helvetica').fontSize(10);

  const invoiceItems = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [{ description: invoice.service || 'Service', quantity: 1, unitPrice: Number(invoice.subtotal || invoice.amount) || 0, amount: Number(invoice.subtotal || invoice.amount) || 0 }];

  invoiceItems.forEach((item, i) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const amt = Number(item.amount || (qty * unitPrice));
    
    doc.text(String(i + 1).padStart(2, '0'), colPositions.sno, itemsY)
       .text(item.description || 'Item', colPositions.items, itemsY, { width: hasGst ? 100 : 140 });
       
    if (hasGst) doc.text(item.hsn || '', colPositions.hsn, itemsY);

    doc.text(`${unitPrice.toFixed(0)}/PCS`, colPositions.priceUnit, itemsY, { width: 70, align: 'center' })
       .text(String(qty), colPositions.qty, itemsY, { width: 40, align: 'center' })
       .text(unitPrice.toFixed(0), colPositions.rate, itemsY, { width: 60, align: 'center' })
       .font('Helvetica-Bold')
       .text(amt.toFixed(0), colPositions.total, itemsY, { width: 60, align: 'right' })
       .font('Helvetica');
    itemsY += 25;
  });

  const subY = itemsY + 10;
  doc.rect(51, subY, 493, 30).fill(bgGray);
  
  doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9).text('Sub-total Amount', colPositions.sno, subY + 10);
  
  const totalQty = invoiceItems.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
  doc.text(String(totalQty), colPositions.qty, subY + 10, { width: 40, align: 'center' })
     .text(Number(invoice.amount || invoice.subtotal || 0).toFixed(0), colPositions.rate, subY + 10, { width: 60, align: 'center' })
     .text(Number(invoice.amount || invoice.subtotal || 0).toFixed(0), colPositions.total, subY + 10, { width: 60, align: 'right' });

  itemsY = subY + 30;

  if (invoice.gstAmount > 0 && hasGst) {
    const halfGst = (Number(invoice.gstAmount) / 2).toFixed(0);
    const halfRate = (Number(invoice.gstRate) / 2).toFixed(1);

    let gstY = itemsY;
    doc.rect(51, gstY, 493, 20).fill('#ffffff');
    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
       .text(`CGST (${halfRate}%)`, colPositions.sno, gstY + 5)
       .text(halfGst, colPositions.total, gstY + 5, { width: 60, align: 'right' });
    gstY += 20;

    doc.rect(51, gstY, 493, 20).fill('#ffffff');
    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9)
       .text(`SGST (${halfRate}%)`, colPositions.sno, gstY + 5)
       .text(halfGst, colPositions.total, gstY + 5, { width: 60, align: 'right' });
       
    itemsY = gstY + 25;
  }

  doc.roundedRect(50, tableTop, 495, itemsY - tableTop, 8).lineWidth(1).stroke(tableBorder);

  const btmTotalY = itemsY + 30;
  doc.fillColor(textColor).fontSize(14).font('Helvetica').text('Total amount', 350, btmTotalY, { width: 175, align: 'right' });
  doc.fillColor(textColor).fontSize(28).font('Helvetica-Bold').text(formatAmountNoSymbol(finalTotal), 350, btmTotalY + 20, { width: 175, align: 'right' });
  doc.fillColor(mutedColor).fontSize(10).font('Helvetica-Oblique').text(numberToWords(Math.round(finalTotal)), 250, btmTotalY + 55, { width: 275, align: 'right' });

  const footerY = 730;
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('~ THIS IS A DIGITALLY CREATED INVOICE ~', 50, footerY, { align: 'center', width: 495 });
  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text('AUTHORISED SIGNATURE', 350, footerY + 30, { width: 175, align: 'right' });

  if (invoice.showWatermark) {
    doc.save();
    doc.rotate(-35, { origin: [300, 420] });
    doc.fillColor('#94a3b8').opacity(0.12).fontSize(44).font('Helvetica-Bold').text('InvoiceEase', 135, 420, { align: 'center', width: 320 });
    doc.restore(); doc.opacity(1);
  }

  doc.end();
};

const generateInvoicePDF = (invoice, user) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDFs directory if it doesn't exist
      const pdfDir = path.join(__dirname, '..', 'pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const fileName = `${invoice.invoiceNumber}.pdf`;
      const filePath = path.join(pdfDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: user.businessName,
          Subject: `Invoice for ${invoice.clientName}`,
        }
      });

      // Pipe to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      if (invoice.templateStyle === 'classic') {
        generateClassicPDF(doc, invoice, user);
        stream.on('finish', () => resolve({ fileName, filePath, url: `/pdf/${invoice.id}` }));
        stream.on('error', (err) => reject(err));
        return;
      }

      if (invoice.templateStyle === 'premium') {
        generatePremiumPDF(doc, invoice, user);
        stream.on('finish', () => resolve({ fileName, filePath, url: `/pdf/${invoice.id}` }));
        stream.on('error', (err) => reject(err));
        return;
      }

      // Colors and fonts
      const template = templateThemes[invoice.templateStyle] || templateThemes.modern;
      const primaryColor = template.primaryColor;
      const secondaryColor = template.secondaryColor;
      const accentColor = template.accentColor;

      // Header
      doc.fillColor(primaryColor)
         .fontSize(28)
         .font('Helvetica-Bold')
         .text(template.heading, 50, 50);

      if (user.logoUrl) {
        const logoBuffer = getImageBufferFromDataUrl(user.logoUrl);
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 50, 92, { fit: [120, 60], align: 'left', valign: 'center' });
          } catch (error) {
            console.warn('Logo render skipped:', error.message);
          }
        }
      }

      // Invoice details
      doc.fillColor(secondaryColor)
         .fontSize(12)
         .font('Helvetica')
         .text(`Invoice #: ${invoice.invoiceNumber}`, 400, 50)
         .text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 400, 70)
         .text(`Due Date: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-IN')}`, 400, 90);

      // Company details
      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
        .text(user.businessName, 50, user.logoUrl ? 165 : 120);

      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
        .text(user.address || '', 50, user.logoUrl ? 185 : 140)
        .text(`${user.city || ''}, ${user.pincode || ''}`, 50, user.logoUrl ? 200 : 155)
        .text(`GST: ${user.gstNumber || 'Not provided'}`, 50, user.logoUrl ? 215 : 170);

      // Bill to
      doc.fillColor(primaryColor)
         .fontSize(14)
         .font('Helvetica-Bold')
        .text('Bill To:', 50, user.logoUrl ? 250 : 220);

      doc.fillColor('#000000')
         .fontSize(12)
         .font('Helvetica-Bold')
        .text(invoice.clientName, 50, user.logoUrl ? 270 : 240);

      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
        .text(`GST: ${invoice.clientGst || 'Not provided'}`, 50, user.logoUrl ? 285 : 255);

      const invoiceItems = Array.isArray(invoice.items) && invoice.items.length > 0
        ? invoice.items
        : [
          {
            description: invoice.service || 'Service',
            quantity: 1,
            unitPrice: Number(invoice.subtotal) || Number(invoice.amount) || 0,
            amount: Number(invoice.subtotal) || Number(invoice.amount) || 0,
          },
         ];

      // Service details
      const serviceHeaderY = user.logoUrl ? 330 : 300;
      doc.fillColor(primaryColor)
         .fontSize(14)
         .font('Helvetica-Bold')
        .text('Service Details', 50, serviceHeaderY);

      // Table header
      const tableTop = serviceHeaderY + 30;
      doc.fillColor('#f8fafc')
         .rect(50, tableTop, 500, 20)
         .fill();

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
        .text('Description', 60, tableTop + 5)
        .text('Qty', 330, tableTop + 5)
        .text('Rate', 390, tableTop + 5)
        .text('Amount', 465, tableTop + 5);

      // Table content
      doc.fillColor('#000000').fontSize(10).font('Helvetica');
      let itemsY = tableTop + 30;
      invoiceItems.forEach((item, index) => {
        if (index > 0) {
         doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(60, itemsY - 8).lineTo(540, itemsY - 8).stroke();
        }
        doc.text(item.description || 'Service', 60, itemsY, { width: 250 })
          .text(String(item.quantity || 1), 332, itemsY)
          .text(formatINR(item.unitPrice || 0), 390, itemsY)
          .text(formatINR(item.amount || 0), 465, itemsY);
        itemsY += 22;
      });

      // GST breakdown
      let yPosition = itemsY + 10;

      if (invoice.gstApplicable) {
        doc.fillColor(secondaryColor)
           .fontSize(9)
           .text('GST Breakdown:', 60, yPosition);

        yPosition += 15;

        if (invoice.gstType === 'intrastate') {
          const gstPercent = (invoice.gstRate / 2).toFixed(0);
          doc.text(`CGST (${gstPercent}%): ${formatINR(invoice.cgst)}`, 70, yPosition);
          yPosition += 12;
          doc.text(`SGST (${gstPercent}%): ${formatINR(invoice.sgst)}`, 70, yPosition);
        } else {
          doc.text(`IGST (${invoice.gstRate}%): ${formatINR(invoice.igst)}`, 70, yPosition);
        }

        yPosition += 20;
      }

      // Total
      doc.strokeColor(primaryColor)
         .lineWidth(1)
         .moveTo(400, yPosition)
         .lineTo(550, yPosition)
         .stroke();

      doc.fillColor(primaryColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('TOTAL:', 400, yPosition + 10)
         .text(formatINR(invoice.total), 450, yPosition + 10);

      // Footer
      const footerY = 700;
      doc.fillColor(secondaryColor)
         .fontSize(8)
         .font('Helvetica')
         .text('Thank you for your business!', 50, footerY)
         .text('Payment terms: Net 30 days', 50, footerY + 15)
         .text('Generated by InvoiceEase', 400, footerY + 15);

      // Bank details (if available)
      if (user.bankName) {
        doc.fillColor(primaryColor)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('Payment Details:', 50, footerY + 40);

        doc.fillColor(secondaryColor)
           .fontSize(9)
           .font('Helvetica')
           .text(`Bank: ${user.bankName}`, 50, footerY + 55)
           .text(`Account: ${user.accountNumber}`, 50, footerY + 67)
           .text(`IFSC: ${user.ifscCode}`, 50, footerY + 79)
           .text(`UPI: ${user.upiId || 'N/A'}`, 50, footerY + 91);
      }

      if (invoice.showWatermark) {
        doc.save();
        doc.rotate(-35, { origin: [300, 420] });
        doc.fillColor('#94a3b8')
           .opacity(0.16)
           .fontSize(44)
           .font('Helvetica-Bold')
           .text('InvoiceEase', 135, 420, { align: 'center', width: 320 });
        doc.restore();
        doc.opacity(1);
      }

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        resolve({
          fileName,
          filePath,
          url: `/pdf/${invoice.id}`
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF
};
