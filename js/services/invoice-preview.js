/* ═══════════════════════════════════════════════════════
   InvoicePreview — HTML Preview Service
   Invoice Platform · OMD Systems
   Renders invoices as HTML for modal preview and print-to-PDF.
   Matches the 5-section DOCX structure exactly.
   ═══════════════════════════════════════════════════════ */

var InvoicePreview = {

  /**
   * Show a modal with the invoice rendered as HTML.
   * @param {object} invoiceData - Full invoice data object
   *   .employee   { full_name_lat, address, phone, iban, swift, receiver_name, bank_name }
   *   .billedTo   { name, address }
   *   .invoiceNumber  string
   *   .invoiceDate    string (formatted)
   *   .dueDays        string (e.g. "Net 15")
   *   .items          [{ description, price, qty, total }]
   *   .subtotal       number
   *   .discount       number (default 0)
   *   .tax            number (default 0)
   *   .taxRate        string (default "0")
   *   .total          number
   *   .terms          string
   *   .status         string (optional, for stamp)
   */
  show: function (invoiceData) {
    // Remove any existing preview modal
    var existing = document.querySelector('.invoice-preview-overlay');
    if (existing) existing.remove();

    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'fury-modal-overlay active invoice-preview-overlay';
    overlay.setAttribute('data-print', 'hide');

    overlay.innerHTML =
      '<div class="fury-modal fury-modal-lg" style="max-width: 860px; max-height: 92vh;">' +
        '<div class="fury-modal-header">' +
          '<span class="fury-modal-title">Invoice Preview</span>' +
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<button class="fury-btn fury-btn-secondary fury-btn-sm no-print" id="ipv-btn-print">' +
              'Print / PDF' +
            '</button>' +
            '<button class="fury-modal-close no-print" id="ipv-btn-close" title="Close">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="fury-modal-body" style="padding: 24px; overflow-y: auto;">' +
          '<div class="invoice-preview">' +
            this.renderInvoiceHTML(invoiceData) +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var self = this;

    // Shared close function that cleans up escape handler
    var escHandler;
    var closeOverlay = function () {
      if (escHandler) document.removeEventListener('keydown', escHandler);
      self._closeOverlay(overlay);
    };

    // Close on Escape
    escHandler = function (e) {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', escHandler);

    // Bind close button
    var closeBtn = overlay.querySelector('#ipv-btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeOverlay);
    }

    // Bind print
    var printBtn = overlay.querySelector('#ipv-btn-print');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });
  },

  /**
   * Close and remove the overlay with animation.
   * @param {HTMLElement} overlay
   */
  _closeOverlay: function (overlay) {
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
    }, 260);
  },

  /**
   * Render the full invoice as HTML matching the DOCX 5-section structure.
   * Uses CSS classes from invoice-print.css for both screen and print styling.
   * @param {object} data - Invoice data object (same shape as show())
   * @returns {string} HTML string
   */
  renderInvoiceHTML: function (data) {
    var emp = data.employee || {};
    var billedTo = data.billedTo || {};
    var items = data.items || [];
    var subtotal = data.subtotal || 0;
    var discount = data.discount || 0;
    var tax = data.tax || 0;
    var taxRate = data.taxRate || '0';
    var total = data.total || 0;
    var terms = data.terms || '';
    var status = data.status || '';

    // Status stamp
    var stampHtml = '';
    if (status === 'paid') {
      stampHtml = '<div class="invoice-stamp-paid">PAID</div>';
    } else if (status === 'overdue') {
      stampHtml = '<div class="invoice-stamp-overdue">OVERDUE</div>';
    } else if (status === 'draft') {
      stampHtml = '<div class="invoice-stamp-draft">DRAFT</div>';
    }

    // Build line item rows
    var itemsHtml = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemPrice = this._parseCurrency(item.price);
      var itemTotal = this._parseCurrency(item.total);
      var itemQty = item.qty != null ? item.qty : 1;

      itemsHtml +=
        '<tr>' +
          '<td class="text-center">' + (i + 1) + '</td>' +
          '<td>' + this._esc(item.description || '') + '</td>' +
          '<td class="text-right">$' + this._fmtNum(itemPrice) + '</td>' +
          '<td class="text-center">' + itemQty + '</td>' +
          '<td class="text-right">$' + this._fmtNum(itemTotal) + '</td>' +
        '</tr>';
    }

    // If no items, show placeholder row
    if (items.length === 0) {
      itemsHtml = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 16pt;">No line items</td></tr>';
    }

    // Compose all 5 sections
    var html =
      '<div class="invoice-stamp" style="position: relative;">' +
        stampHtml +

        /* ═════ SECTION 1: Header ═════ */
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

        /* ═════ SECTION 2: Billing Info ═════ */
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
                '<div class="invoice-meta-value">' + this._esc(data.dueDays || '') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* ═════ SECTION 3: Line Items Table ═════ */
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

        /* ═════ SECTION 4: Totals ═════ */
        '<div class="invoice-totals">' +
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

        /* ═════ SECTION 5: Footer (Bank + Terms) ═════ */
        '<div style="display: flex; justify-content: space-between; gap: 24pt; margin-top: 12pt;">' +
          '<div class="invoice-payment" style="flex: 1;">' +
            '<div class="invoice-payment-title">BANK ACCOUNT</div>' +
            '<div class="invoice-payment-details">' +
              (emp.iban ? '<strong>IBAN:</strong> ' + this._esc(emp.iban) + '<br>' : '') +
              (emp.swift ? '<strong>SWIFT/BIC Code:</strong> ' + this._esc(emp.swift) + '<br>' : '') +
              (emp.receiver_name ? '<strong>Receiver:</strong> ' + this._esc(emp.receiver_name) + '<br>' : '') +
              (emp.bank_name ? '<strong>Bank:</strong> ' + this._esc(emp.bank_name) : '') +
            '</div>' +
          '</div>' +
          (terms ?
            '<div class="invoice-terms" style="flex: 1; margin-top: 0; padding-top: 0; border-top: none;">' +
              '<div class="invoice-terms-title">TERMS AND CONDITIONS</div>' +
              '<div class="invoice-terms-text">' + this._nlToBr(this._esc(terms)) + '</div>' +
            '</div>'
          : '') +
        '</div>' +

      '</div>'; // close .invoice-stamp

    return html;
  },

  /* ── Helpers ── */

  /**
   * Escape HTML entities.
   * @param {string} str
   * @returns {string}
   */
  _esc: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Convert newlines to <br> tags.
   * @param {string} str
   * @returns {string}
   */
  _nlToBr: function (str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br>');
  },

  /**
   * Parse a value to a number (handles string inputs like "$1,200").
   * @param {*} val
   * @returns {number}
   */
  _parseCurrency: function (val) {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    var cleaned = String(val).replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0;
  },

  /**
   * Format a number with 2 decimal places and locale-friendly thousands.
   * @param {number} num
   * @returns {string}
   */
  _fmtNum: function (num) {
    if (num == null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};
