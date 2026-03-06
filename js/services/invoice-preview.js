/* ═══════════════════════════════════════════════════════
   InvoicePreview — PDF Preview Service
   Invoice Platform · OMD Systems
   Generates PDF in memory from HTML, displays in iframe.
   ═══════════════════════════════════════════════════════ */

var InvoicePreview = {

  _currentBlobUrl: null,
  _currentInvoiceData: null,

  /**
   * Show a modal with the invoice rendered as PDF in an iframe.
   * Bottom action bar with Download and Print buttons.
   * @param {object} invoiceData - Full invoice data object
   */
  show: function (invoiceData) {
    var self = this;
    this._currentInvoiceData = invoiceData;
    this._revokeBlobUrl();

    var existing = document.querySelector('.invoice-preview-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'fury-modal-overlay active invoice-preview-overlay';
    overlay.style.cssText = 'z-index: 9999;';

    overlay.innerHTML =
      '<div style="width: 92vw; max-width: 860px; height: 90vh; display: flex; flex-direction: column; ' +
        'background: var(--fury-card, #111114); border-radius: 12px; overflow: hidden; ' +
        'box-shadow: 0 25px 50px rgba(0,0,0,0.5);">' +

        // Header
        '<div style="display: flex; justify-content: space-between; align-items: center; ' +
          'padding: 12px 20px; background: var(--fury-elevated, #1A1A1F); ' +
          'border-bottom: 1px solid var(--fury-border, #374151); flex-shrink: 0;">' +
          '<span style="font-size: 14px; font-weight: 600; color: var(--fury-text, #E5E7EB);">Invoice Preview</span>' +
          '<button id="ipv-btn-close" style="background: none; border: none; color: var(--fury-text-secondary, #9CA3AF); ' +
            'font-size: 22px; cursor: pointer; padding: 0 4px; line-height: 1;" title="Close">&times;</button>' +
        '</div>' +

        // PDF viewer area
        '<div id="ipv-body" style="flex: 1; overflow: hidden; position: relative; background: #525659;">' +
          '<div id="ipv-loading" style="display: flex; align-items: center; justify-content: center; ' +
            'height: 100%; color: #ccc;">' +
            '<div style="text-align: center;">' +
              '<div style="font-size: 14px; margin-bottom: 12px;">Generating PDF...</div>' +
              '<div class="fury-loading" style="margin: 0 auto;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Bottom action bar
        '<div id="ipv-actions" style="display: flex; justify-content: center; align-items: center; gap: 12px; ' +
          'padding: 12px 20px; background: var(--fury-elevated, #1A1A1F); ' +
          'border-top: 1px solid var(--fury-border, #374151); flex-shrink: 0;">' +
          '<button id="ipv-btn-download" class="fury-btn fury-btn-sm" disabled ' +
            'style="background: var(--fury-accent, #00D4FF); color: #000; border: none; font-weight: 600; ' +
            'padding: 8px 24px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Download PDF' +
          '</button>' +
          '<button id="ipv-btn-print" class="fury-btn fury-btn-secondary fury-btn-sm" disabled ' +
            'style="padding: 8px 24px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="6 9 6 2 18 2 18 9"/>' +
              '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
              '<rect x="6" y="14" width="12" height="8"/>' +
            '</svg>' +
            'Print' +
          '</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('fury-modal-open');

    // Close handlers
    var escHandler;
    var closeOverlay = function () {
      if (escHandler) document.removeEventListener('keydown', escHandler);
      document.body.classList.remove('fury-modal-open');
      self._closeOverlay(overlay);
    };
    escHandler = function (e) { if (e.key === 'Escape') closeOverlay(); };
    document.addEventListener('keydown', escHandler);

    overlay.querySelector('#ipv-btn-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    // Generate PDF
    this._generatePdf(invoiceData, function (blobUrl) {
      if (!blobUrl) {
        var loadingEl = overlay.querySelector('#ipv-loading');
        if (loadingEl) {
          loadingEl.innerHTML =
            '<div style="text-align: center; color: var(--fury-danger, #EF4444);">' +
            '<div style="font-size: 14px;">Failed to generate PDF</div></div>';
        }
        return;
      }

      self._currentBlobUrl = blobUrl;
      var body = overlay.querySelector('#ipv-body');
      var loadingDiv = overlay.querySelector('#ipv-loading');

      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 768);

      if (isMobile) {
        if (loadingDiv) {
          loadingDiv.innerHTML =
            '<div style="text-align: center; padding: 40px 20px;">' +
            '<div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">&#128196;</div>' +
            '<div style="font-size: 14px; color: #ccc; margin-bottom: 20px;">' +
            'PDF preview is not available on this device.<br>Use the buttons below to download or print.' +
            '</div></div>';
        }
      } else {
        if (loadingDiv) loadingDiv.remove();
        var iframe = document.createElement('iframe');
        iframe.id = 'ipv-pdf-frame';
        iframe.src = blobUrl;
        iframe.type = 'application/pdf';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
        body.appendChild(iframe);
      }

      // Enable action buttons
      var dlBtn = overlay.querySelector('#ipv-btn-download');
      var printBtn = overlay.querySelector('#ipv-btn-print');

      if (dlBtn) {
        dlBtn.disabled = false;
        dlBtn.addEventListener('click', function () {
          self._downloadPdf(blobUrl);
        });
      }
      if (printBtn) {
        printBtn.disabled = false;
        printBtn.addEventListener('click', function () {
          self._printPdf(overlay);
        });
      }
    });
  },

  /**
   * Generate PDF from invoice data using jsPDF + html2canvas.
   * @param {object} data - Invoice data
   * @param {function} callback - Called with blob URL or null on error
   */
  _generatePdf: function (data, callback) {
    var self = this;

    self._computeHash(data).then(function (hash) {
      var container = document.createElement('div');
      container.style.cssText =
        'position: fixed; left: -9999px; top: 0; width: 794px; z-index: -1; ' +
        'background: #fff; padding: 0; margin: 0;';

      var preview = document.createElement('div');
      preview.className = 'invoice-preview';
      preview.style.cssText =
        'background: #fff; color: #000; font-family: Calibri, Segoe UI, Arial, sans-serif; ' +
        'font-size: 10pt; line-height: 1.4; padding: 14px 40px; margin: 0; ' +
        'width: 794px; min-height: auto; box-shadow: none; border-radius: 0;';
      preview.innerHTML = self.renderInvoiceHTML(data, hash);
      container.appendChild(preview);
      document.body.appendChild(container);

      setTimeout(function () {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
          console.error('[InvoicePreview] jsPDF or html2canvas not loaded');
          container.remove();
          callback(null);
          return;
        }

        var blocks = preview.querySelectorAll('[data-pdf-block]');
        var PAGE_H = 1123;
        var PAD_TOP = 14;
        for (var bi = 0; bi < blocks.length; bi++) {
          var b = blocks[bi];
          var wTop = PAD_TOP + b.offsetTop;
          var wBot = wTop + b.offsetHeight;
          var pageEnd = (Math.floor(wTop / PAGE_H) + 1) * PAGE_H;
          if (wBot > pageEnd && wTop < pageEnd && b.offsetHeight < PAGE_H - 140) {
            var gap = (pageEnd - wTop) + 40;
            var sp = document.createElement('div');
            sp.style.height = gap + 'px';
            b.parentNode.insertBefore(sp, b);
          }
        }

        html2canvas(preview, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794
        }).then(function (canvas) {
          container.remove();

          try {
            var jsPDF = jspdf.jsPDF;
            var pdf = new jsPDF('p', 'mm', 'a4');
            var pdfWidth = 210;
            var pdfHeight = 297;

            var imgWidth = pdfWidth;
            var imgHeight = (canvas.height * pdfWidth) / canvas.width;

            var imgData = canvas.toDataURL('image/jpeg', 0.95);

            var heightLeft = imgHeight;
            var position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position = -(imgHeight - heightLeft);
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
              heightLeft -= pdfHeight;
            }

            var blob = pdf.output('blob');
            var blobUrl = URL.createObjectURL(blob);
            callback(blobUrl);
          } catch (err) {
            console.error('[InvoicePreview] PDF generation error:', err);
            callback(null);
          }
        }).catch(function (err) {
          console.error('[InvoicePreview] html2canvas error:', err);
          container.remove();
          callback(null);
        });
      }, 200);
    });
  },

  _computeHash: function (data) {
    var emp = data.employee || {};
    var total = parseFloat(data.total) || 0;
    var hashSeed = String(data.invoiceNumber || '') + '|' +
      String(data.invoiceDate || '') + '|' +
      String(total) + '|' +
      String(emp.full_name_lat || emp.name || '');

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      var encoder = new TextEncoder();
      return crypto.subtle.digest('SHA-256', encoder.encode(hashSeed)).then(function (buf) {
        var arr = new Uint8Array(buf);
        var hex = '';
        for (var h = 0; h < arr.length; h++) {
          hex += ('0' + arr[h].toString(16)).slice(-2);
        }
        return hex;
      });
    }
    return Promise.resolve('');
  },

  _downloadPdf: function (blobUrl) {
    var filename = this._getPrintFileName() + '.pdf';
    var a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 100);
  },

  _printPdf: function (overlay) {
    var iframe = overlay
      ? overlay.querySelector('#ipv-pdf-frame')
      : document.querySelector('#ipv-pdf-frame');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.open(this._currentBlobUrl);
      }
    } else if (this._currentBlobUrl) {
      window.open(this._currentBlobUrl);
    }
  },

  _getPrintFileName: function () {
    var data = this._currentInvoiceData;
    if (!data) return 'Invoice';

    if (typeof Numbering !== 'undefined' && Numbering.getFileName) {
      return Numbering.getFileName(data.employee, data.invoiceNumber, data.invoiceDate)
        .replace(/\.pdf$/i, '');
    }

    var emp = data.employee || {};
    var name = (emp.full_name_lat || 'Unknown').replace(/\s+/g, '-');
    return (data.invoiceNumber || 'Invoice') + '-' + name;
  },

  _closeOverlay: function (overlay) {
    if (!overlay) return;
    overlay.classList.remove('active');
    var self = this;

    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
      self._revokeBlobUrl();
    }, 260);
  },

  _revokeBlobUrl: function () {
    if (this._currentBlobUrl) {
      URL.revokeObjectURL(this._currentBlobUrl);
      this._currentBlobUrl = null;
    }
  },

  renderInvoiceHTML: function (data, hash) {
    var emp = data.employee || {};
    var billedTo = data.billedTo || {};
    var items = data.items || [];
    var subtotal = parseFloat(data.subtotal) || 0;
    var discount = parseFloat(data.discount) || 0;
    var tax = parseFloat(data.tax) || 0;
    var taxRate = (data.taxRate != null && data.taxRate !== '') ? String(data.taxRate) : '0';
    var total = parseFloat(data.total) || 0;
    var terms = data.terms || '';
    var status = data.status || '';

    var stampHtml = '';
    if (status === 'paid') {
      stampHtml = '<div class="invoice-stamp-paid">PAID</div>';
    } else if (status === 'overdue') {
      stampHtml = '<div class="invoice-stamp-overdue">OVERDUE</div>';
    } else if (status === 'draft') {
      stampHtml = '<div class="invoice-stamp-draft">DRAFT</div>';
    }

    var itemsHtml = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemPrice = this._parseCurrency(item.price);
      var itemQty = parseFloat(item.qty) || 1;
      var itemTotal = item.total != null
        ? this._parseCurrency(item.total)
        : Math.round(itemPrice * itemQty * 100) / 100;
      var desc = String(item.description || '');
      if (desc.length > 500) desc = desc.slice(0, 497) + '...';

      itemsHtml +=
        '<tr data-pdf-block>' +
        '<td class="text-center">' + (i + 1) + '</td>' +
        '<td>' + this._esc(desc) + '</td>' +
        '<td class="text-right">$' + this._fmtNum(itemPrice) + '</td>' +
        '<td class="text-center">' + this._fmtNum(itemQty).replace(/\.00$/, '') + '</td>' +
        '<td class="text-right">$' + this._fmtNum(itemTotal) + '</td>' +
        '</tr>';
    }

    if (items.length === 0) {
      itemsHtml = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 16pt;">No line items</td></tr>';
    }

    var hashDisplay = hash ? 'Document ID: ' + hash : 'Document ID: N/A';

    // Inline styles — self-contained for html2canvas capture
    var css =
      '<style>' +
      '.invoice-page-frame{position:relative;border:1.5pt solid #00D4FF;padding:20px 28px 14px;overflow:hidden;}' +
      '.invoice-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72pt;font-weight:900;color:rgba(0,212,255,0.06);letter-spacing:12pt;white-space:nowrap;pointer-events:none;z-index:0;user-select:none;}' +
      '.invoice-brand-header{text-align:center;margin-bottom:10pt;padding-bottom:6pt;border-bottom:1px solid #e0e0e0;position:relative;z-index:1;}' +
      '.invoice-brand-logo{font-size:18pt;font-weight:800;color:#00D4FF;letter-spacing:4pt;margin-bottom:4pt;}' +
      '.invoice-brand-address{font-size:7.5pt;color:#888;letter-spacing:0.3pt;}' +
      '.invoice-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14pt;padding-bottom:8pt;border-bottom:2pt solid #205968;}' +
      '.invoice-title{font-size:22pt;font-weight:700;color:#205968;text-transform:uppercase;letter-spacing:1pt;text-align:right;margin:0;}' +
      '.invoice-company-name{font-size:12pt;font-weight:700;color:#000;margin-bottom:2pt;}' +
      '.invoice-address,.invoice-contact{font-size:9pt;color:#333;line-height:1.5;}' +
      '.invoice-parties{display:flex;justify-content:space-between;margin-bottom:14pt;gap:20pt;}' +
      '.invoice-to{flex:1;}' +
      '.invoice-section-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;color:#205968;margin-bottom:6pt;padding-bottom:3pt;border-bottom:1px solid #205968;}' +
      '.invoice-meta-item{text-align:right;}' +
      '.invoice-meta-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;color:#444;margin-bottom:2pt;}' +
      '.invoice-meta-value{font-size:10pt;font-weight:600;color:#000;}' +
      '.invoice-table{width:100%;border-collapse:collapse;margin-bottom:14pt;font-size:9pt;}' +
      '.invoice-table thead{background:#205968;}' +
      '.invoice-table thead th{padding:7pt 10pt;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;color:#fff;text-align:left;border:1px solid #205968;}' +
      '.invoice-table thead th:last-child,.invoice-table thead th.text-right{text-align:right;}' +
      '.invoice-table tbody td{padding:7pt 10pt;color:#000;border:1px solid #ccc;vertical-align:top;font-size:9pt;}' +
      '.invoice-table tbody tr:nth-child(even){background:#f5f7f8;}' +
      '.invoice-table tbody td:last-child,.invoice-table tbody td.text-right{text-align:right;}' +
      '.invoice-table tbody td.text-center{text-align:center;}' +
      '.invoice-totals{display:flex;justify-content:flex-end;margin-bottom:14pt;}' +
      '.invoice-totals-table{width:250pt;border-collapse:collapse;}' +
      '.invoice-totals-table tr td{padding:4pt 10pt;font-size:9pt;color:#333;}' +
      '.invoice-totals-table tr td:first-child{text-align:left;font-weight:500;}' +
      '.invoice-totals-table tr td:last-child{text-align:right;font-variant-numeric:tabular-nums;}' +
      '.invoice-totals-table tr.subtotal td{border-top:1px solid #ccc;padding-top:8pt;}' +
      '.invoice-totals-table tr.tax td{color:#333;}' +
      '.invoice-totals-table tr.discount td{color:#c0392b;}' +
      '.invoice-totals-table tr.total td{border-top:2pt solid #205968;padding-top:8pt;font-size:12pt;font-weight:700;color:#000;}' +
      '.invoice-totals-table tr.total td:first-child{color:#205968;}' +
      '.invoice-total-amount{font-size:14pt;font-weight:700;color:#000;}' +
      '.invoice-footer-columns{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;gap:24pt;margin-top:10pt;}' +
      '.invoice-footer-columns>.invoice-payment{flex:1 1 45%;min-width:0;margin-bottom:0;}' +
      '.invoice-footer-columns>.invoice-terms{flex:1 1 45%;min-width:0;margin-top:0;padding-top:0;border-top:none;}' +
      '.invoice-payment{margin-bottom:16pt;padding:10pt 12pt;border:1px solid #ccc;border-left:3pt solid #205968;background:#f9fafb;}' +
      '.invoice-payment-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;color:#205968;margin-bottom:6pt;}' +
      '.invoice-payment-details{font-size:9pt;color:#333;line-height:1.6;}' +
      '.invoice-payment-details strong{color:#000;}' +
      '.invoice-terms{margin-top:16pt;padding-top:10pt;border-top:1px solid #ddd;}' +
      '.invoice-terms-title{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;color:#205968;margin-bottom:4pt;}' +
      '.invoice-terms-text{font-size:8pt;color:#444;line-height:1.5;}' +
      '.invoice-doc-footer{margin-top:12pt;position:relative;z-index:1;}' +
      '.invoice-doc-footer-line{border-top:1px solid #00D4FF;margin-bottom:4pt;}' +
      '.invoice-doc-footer-text{font-size:7pt;color:#999;}' +
      '.invoice-doc-footer-hash{font-size:7pt;color:#888;font-family:"Courier New",monospace;}' +
      '.invoice-stamp-paid{position:absolute;top:30%;right:10%;transform:rotate(-15deg);font-size:36pt;font-weight:900;color:rgba(34,197,94,0.25);text-transform:uppercase;letter-spacing:4pt;border:4pt solid rgba(34,197,94,0.25);padding:6pt 20pt;border-radius:6pt;pointer-events:none;}' +
      '.invoice-stamp-overdue{position:absolute;top:30%;right:10%;transform:rotate(-15deg);font-size:36pt;font-weight:900;color:rgba(239,68,68,0.25);text-transform:uppercase;letter-spacing:4pt;border:4pt solid rgba(239,68,68,0.25);padding:6pt 20pt;border-radius:6pt;pointer-events:none;}' +
      '.invoice-stamp-draft{position:absolute;top:30%;right:10%;transform:rotate(-15deg);font-size:36pt;font-weight:900;color:rgba(107,114,128,0.2);text-transform:uppercase;letter-spacing:4pt;border:4pt solid rgba(107,114,128,0.2);padding:6pt 20pt;border-radius:6pt;pointer-events:none;}' +
      '</style>';

    var html = css +
      '<div class="invoice-page-frame">' +
      '<div class="invoice-watermark">WOODENSHARK LLC</div>' +
      stampHtml +

      '<div class="invoice-brand-header">' +
      '<div class="invoice-brand-logo">WOODENSHARK LLC</div>' +
      '<div class="invoice-brand-address">Woodenshark LLC &bull; 8 The Green, Suite A, Dover, DE 19901, USA</div>' +
      '</div>' +

      '<div class="invoice-header">' +
      '<div>' +
      '<div class="invoice-company-name" style="color: #205968; font-size: 14pt;">' +
      this._esc(emp.full_name_lat || emp.name || '') +
      '</div>' +
      '<div class="invoice-address">' + this._esc(emp.address || '') + '</div>' +
      '<div class="invoice-contact">' + this._esc(emp.phone || '') + '</div>' +
      '</div>' +
      '<div style="text-align: right;">' +
      '<div class="invoice-title">INVOICE</div>' +
      '</div>' +
      '</div>' +

      '<div class="invoice-parties">' +
      '<div class="invoice-to">' +
      '<div class="invoice-section-label">BILLED TO</div>' +
      '<div class="invoice-company-name">' + this._esc(billedTo.name || '') + '</div>' +
      '<div class="invoice-address">' + this._nlToBr(this._esc(billedTo.address || '')) + '</div>' +
      '</div>' +
      '<div style="flex: 1;">' +
      '<div style="display: flex; flex-direction: column; gap: 12pt; align-items: flex-end;">' +
      '<div class="invoice-meta-item">' +
      '<div class="invoice-meta-label">INVOICE NUMBER</div>' +
      '<div class="invoice-meta-value">' + this._esc(data.invoiceNumber || '') + '</div>' +
      '</div>' +
      '<div class="invoice-meta-item">' +
      '<div class="invoice-meta-label">INVOICE DATE</div>' +
      '<div class="invoice-meta-value">' + this._esc(data.invoiceDate || '') + '</div>' +
      '</div>' +
      '<div class="invoice-meta-item">' +
      '<div class="invoice-meta-label">DUE DATE</div>' +
      '<div class="invoice-meta-value">' + this._esc(this._calcDueDate(data.invoiceDate, data.dueDays)) + '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<table class="invoice-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="width: 40pt; text-align: center;">ID</th>' +
      '<th>Description</th>' +
      '<th class="text-right" style="width: 80pt;">Price</th>' +
      '<th style="width: 50pt; text-align: center;">QTY</th>' +
      '<th class="text-right" style="width: 80pt;">Total</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      itemsHtml +
      '</tbody>' +
      '</table>' +

      '<div class="invoice-totals" data-pdf-block>' +
      '<table class="invoice-totals-table">' +
      '<tr class="subtotal">' +
      '<td>SUBTOTAL</td>' +
      '<td>$' + this._fmtNum(subtotal) + '</td>' +
      '</tr>' +
      '<tr class="discount">' +
      '<td>DISCOUNT</td>' +
      '<td>$' + this._fmtNum(discount) + '</td>' +
      '</tr>' +
      '<tr class="tax">' +
      '<td>TAX (' + this._esc(taxRate) + '%)</td>' +
      '<td>$' + this._fmtNum(tax) + '</td>' +
      '</tr>' +
      '<tr class="total">' +
      '<td>INVOICE TOTAL</td>' +
      '<td class="invoice-total-amount">$' + this._fmtNum(total) + '</td>' +
      '</tr>' +
      '</table>' +
      '</div>' +

      '<div class="invoice-footer-columns" data-pdf-block>' +
      '<div class="invoice-payment">' +
      '<div class="invoice-payment-title">BANK ACCOUNT</div>' +
      '<div class="invoice-payment-details">' +
      (emp.iban ? '<strong>IBAN:</strong> ' + this._esc(emp.iban) + '<br>' : '') +
      (emp.swift ? '<strong>SWIFT/BIC Code:</strong> ' + this._esc(emp.swift) + '<br>' : '') +
      (emp.receiver_name ? '<strong>Receiver:</strong> ' + this._esc(emp.receiver_name) + '<br>' : '') +
      (emp.bank_name ? '<strong>Bank:</strong> ' + this._esc(emp.bank_name) : '') +
      '</div>' +
      '</div>' +
      (terms ?
        '<div class="invoice-terms">' +
        '<div class="invoice-terms-title">TERMS AND CONDITIONS</div>' +
        '<div class="invoice-terms-text">' + this._nlToBr(this._esc(terms)) + '</div>' +
        '</div>'
        : '') +
      '</div>' +

      '<div class="invoice-doc-footer" data-pdf-block>' +
      '<div class="invoice-doc-footer-line"></div>' +
      '<div class="invoice-doc-footer-text">' +
      'Generated by OMD Finance Platform &bull; ' +
      new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC' +
      '</div>' +
      '<div class="invoice-doc-footer-hash">' +
      this._esc(hashDisplay) +
      '</div>' +
      '</div>' +

      '</div>';

    return html;
  },

  _esc: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _nlToBr: function (str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br>');
  },

  _parseCurrency: function (val) {
    if (val == null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    var cleaned = String(val).replace(/[^0-9.\-]/g, '');
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  },

  _calcDueDate: function (invoiceDate, dueDays) {
    var days = parseInt(String(dueDays).replace(/\D/g, '')) || 15;
    var base;
    if (invoiceDate) {
      var m = String(invoiceDate).match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
      if (m) {
        var yr = m[3].length === 2 ? '20' + m[3] : m[3];
        base = new Date(parseInt(yr), parseInt(m[2]) - 1, parseInt(m[1]));
      } else {
        var isoMatch = String(invoiceDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          base = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        } else {
          base = new Date(invoiceDate);
        }
      }
      if (isNaN(base.getTime())) base = new Date();
    } else {
      base = new Date();
    }
    base.setDate(base.getDate() + days);
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[base.getMonth()] + ' ' + base.getDate() + ', ' + base.getFullYear();
  },

  _fmtNum: function (num) {
    var n = parseFloat(num);
    if (isNaN(n)) return '0.00';
    n = Math.round(n * 100) / 100;
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};
