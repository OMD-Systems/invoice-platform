/* ═══════════════════════════════════════════════════════
   InvoiceDocx — DOCX Invoice Generator
   Matches WS-Invoice template format exactly (5 tables)
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

const InvoiceDocx = {

  /* ── Color constants ── */
  COLORS: {
    NAME_TEAL:     '205968',
    SECTION_LABEL: '51646D',
    SUBTOTAL_GRAY: '999999',
    BLACK:         '000000',
    WHITE:         'FFFFFF',
    LINE_BORDER:   'EFEFEF',
    HEADER_BG:     'F2F2F2',
  },

  /* ── Font defaults ── */
  FONT: 'Calibri',
  SIZE_BASE:    20,  // 10pt in half-points
  SIZE_SMALL:   18,  // 9pt
  SIZE_TITLE:   28,  // 14pt
  SIZE_TOTAL:   24,  // 12pt

  /* ── Invisible border (white) ── */
  _noBorder() {
    const { BorderStyle } = docx;
    const side = { style: BorderStyle.SINGLE, size: 1, color: this.COLORS.WHITE };
    return { top: side, bottom: side, left: side, right: side };
  },

  /* ── Light gray border for line items ── */
  _grayBorder() {
    const { BorderStyle } = docx;
    const side = { style: BorderStyle.SINGLE, size: 1, color: this.COLORS.LINE_BORDER };
    return { top: side, bottom: side, left: side, right: side };
  },

  /* ── Shorthand: create a TextRun ── */
  _text(text, opts = {}) {
    const { TextRun } = docx;
    return new TextRun({
      text: String(text),
      font: opts.font || this.FONT,
      size: opts.size || this.SIZE_BASE,
      bold: opts.bold || false,
      color: opts.color || this.COLORS.BLACK,
    });
  },

  /* ── Shorthand: create a Paragraph ── */
  _para(children, opts = {}) {
    const { Paragraph, AlignmentType } = docx;
    if (!Array.isArray(children)) children = [children];
    return new Paragraph({
      children: children,
      alignment: opts.alignment || AlignmentType.LEFT,
      spacing: opts.spacing || { after: 0, before: 0 },
    });
  },

  /* ── Shorthand: create a TableCell ── */
  _cell(paragraphs, opts = {}) {
    const { TableCell, WidthType, VerticalAlign } = docx;
    if (!Array.isArray(paragraphs)) paragraphs = [paragraphs];
    return new TableCell({
      children: paragraphs,
      borders: opts.borders || this._noBorder(),
      width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      verticalAlign: opts.verticalAlign || VerticalAlign.TOP,
      shading: opts.shading || undefined,
      columnSpan: opts.columnSpan || undefined,
      margins: opts.margins || {
        top: 40,
        bottom: 40,
        left: 80,
        right: 80,
      },
    });
  },

  /* ══════════════════════════════════════════════════════
     TABLE 1: Header (2 rows × 3 cols)
     Row 1: empty | empty | "INVOICE" (14pt bold)
     Row 2: NAME (bold teal) | Address | Phone
     ══════════════════════════════════════════════════════ */
  _buildHeaderTable(employee) {
    const { Table, TableRow, TableLayoutType, WidthType, AlignmentType } = docx;

    // Row 1
    const row1 = new TableRow({
      children: [
        this._cell(this._para(this._text('')), { width: 3600 }),
        this._cell(this._para(this._text('')), { width: 3600 }),
        this._cell(
          this._para(
            this._text('INVOICE', { size: this.SIZE_TITLE, bold: true }),
            { alignment: AlignmentType.RIGHT }
          ),
          { width: 3600 }
        ),
      ],
    });

    // Row 2
    const row2 = new TableRow({
      children: [
        this._cell(
          this._para(
            this._text(employee.full_name_lat || '', { bold: true, color: this.COLORS.NAME_TEAL, size: this.SIZE_BASE })
          ),
          { width: 3600 }
        ),
        this._cell(
          this._para(
            this._text(employee.address || '', { size: this.SIZE_BASE })
          ),
          { width: 3600 }
        ),
        this._cell(
          this._para(
            this._text(employee.phone || '', { size: this.SIZE_BASE }),
            { alignment: AlignmentType.RIGHT }
          ),
          { width: 3600 }
        ),
      ],
    });

    return new Table({
      rows: [row1, row2],
      width: { size: 10800, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    });
  },

  /* ══════════════════════════════════════════════════════
     TABLE 2: Billing Info (3 rows × 3 cols)
     Col1 all rows: BILLED TO + address (spans visually)
     Col2: spacer
     Col3 row1: INVOICE NUMBER + number
     Col3 row2: INVOICE DATE + date
     Col3 row3: DUE DATE + days
     ══════════════════════════════════════════════════════ */
  _buildBillingTable(invoiceData) {
    const { Table, TableRow, TableLayoutType, WidthType, AlignmentType } = docx;
    const billedTo = invoiceData.billedTo || {};

    // Col1 content for each row
    const billedToLabel = this._para(
      this._text('BILLED TO', { bold: true, color: this.COLORS.SECTION_LABEL, size: this.SIZE_SMALL })
    );
    const billedToName = this._para(
      this._text(billedTo.name || 'Woodenshark LLC', { size: this.SIZE_BASE })
    );
    const billedToAddr = this._para(
      this._text(billedTo.address || '', { size: this.SIZE_BASE })
    );

    // Row 1: BILLED TO label | spacer | INVOICE NUMBER
    const row1 = new TableRow({
      children: [
        this._cell([billedToLabel, billedToName, billedToAddr], { width: 5400 }),
        this._cell(this._para(this._text('')), { width: 1800 }),
        this._cell([
          this._para(
            this._text('INVOICE NUMBER', { bold: true, color: this.COLORS.SECTION_LABEL, size: this.SIZE_SMALL }),
            { alignment: AlignmentType.RIGHT }
          ),
          this._para(
            this._text(String(invoiceData.invoiceNumber || ''), { size: this.SIZE_BASE }),
            { alignment: AlignmentType.RIGHT }
          ),
        ], { width: 3600 }),
      ],
    });

    // Row 2: empty | spacer | INVOICE DATE
    const row2 = new TableRow({
      children: [
        this._cell(this._para(this._text('')), { width: 5400 }),
        this._cell(this._para(this._text('')), { width: 1800 }),
        this._cell([
          this._para(
            this._text('INVOICE DATE', { bold: true, color: this.COLORS.SECTION_LABEL, size: this.SIZE_SMALL }),
            { alignment: AlignmentType.RIGHT }
          ),
          this._para(
            this._text(invoiceData.invoiceDate || '', { size: this.SIZE_BASE }),
            { alignment: AlignmentType.RIGHT }
          ),
        ], { width: 3600 }),
      ],
    });

    // Row 3: empty | spacer | DUE DATE
    const row3 = new TableRow({
      children: [
        this._cell(this._para(this._text('')), { width: 5400 }),
        this._cell(this._para(this._text('')), { width: 1800 }),
        this._cell([
          this._para(
            this._text('DUE DATE', { bold: true, color: this.COLORS.SECTION_LABEL, size: this.SIZE_SMALL }),
            { alignment: AlignmentType.RIGHT }
          ),
          this._para(
            this._text(String(invoiceData.dueDays != null ? invoiceData.dueDays : 7), { size: this.SIZE_BASE }),
            { alignment: AlignmentType.RIGHT }
          ),
        ], { width: 3600 }),
      ],
    });

    return new Table({
      rows: [row1, row2, row3],
      width: { size: 10800, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    });
  },

  /* ══════════════════════════════════════════════════════
     TABLE 3: Line Items (header + data rows + empty row)
     5 cols: ID | Description | Price | QTY | Total
     Header = bold, light gray background
     Gray borders (#EFEFEF)
     ══════════════════════════════════════════════════════ */
  _buildLineItemsTable(items) {
    const { Table, TableRow, TableLayoutType, WidthType, AlignmentType, ShadingType } = docx;

    const grayShading = {
      type: ShadingType.CLEAR,
      fill: this.COLORS.HEADER_BG,
      color: this.COLORS.HEADER_BG,
    };

    const borders = this._grayBorder();

    // Column widths (DXA) — total ~10800
    const colW = [800, 5400, 1600, 1000, 2000];

    // Header row
    const headerTexts = ['ID', 'DESCRIPTION', 'PRICE', 'QTY', 'TOTAL'];
    const headerRow = new TableRow({
      children: headerTexts.map(function (txt, i) {
        return this._cell(
          this._para(
            this._text(txt, { bold: true, size: this.SIZE_SMALL }),
            { alignment: i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT }
          ),
          { width: colW[i], borders: borders, shading: grayShading }
        );
      }.bind(this)),
    });

    // Data rows
    var dataRows = (items || []).map(function (item, idx) {
      return new TableRow({
        children: [
          this._cell(
            this._para(this._text(String(idx + 1), { size: this.SIZE_BASE })),
            { width: colW[0], borders: borders }
          ),
          this._cell(
            this._para(this._text(item.description || '', { size: this.SIZE_BASE })),
            { width: colW[1], borders: borders }
          ),
          this._cell(
            this._para(
              this._text(this.formatCurrency(item.price || 0), { size: this.SIZE_BASE }),
              { alignment: AlignmentType.RIGHT }
            ),
            { width: colW[2], borders: borders }
          ),
          this._cell(
            this._para(
              this._text(String(item.qty || 1), { size: this.SIZE_BASE }),
              { alignment: AlignmentType.RIGHT }
            ),
            { width: colW[3], borders: borders }
          ),
          this._cell(
            this._para(
              this._text(this.formatCurrency((item.price || 0) * (item.qty || 1)), { size: this.SIZE_BASE }),
              { alignment: AlignmentType.RIGHT }
            ),
            { width: colW[4], borders: borders }
          ),
        ],
      });
    }.bind(this));

    // Empty trailing row (visual spacer like original template)
    var emptyRow = new TableRow({
      children: colW.map(function (w) {
        return this._cell(
          this._para(this._text('', { size: this.SIZE_SMALL })),
          { width: w, borders: borders }
        );
      }.bind(this)),
    });

    return new Table({
      rows: [headerRow].concat(dataRows).concat([emptyRow]),
      width: { size: 10800, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    });
  },

  /* ══════════════════════════════════════════════════════
     TABLE 4: Totals (4 rows × 2 cols, right-aligned)
     SUBTOTAL | $x.xx
     DISCOUNT | $0.00
     TAX (TAX RATE %) | $0.00
     INVOICE TOTAL (bold) | $x.xx (12pt bold)
     ══════════════════════════════════════════════════════ */
  _buildTotalsTable(invoiceData) {
    const { Table, TableRow, TableLayoutType, WidthType, AlignmentType } = docx;

    var self = this;
    var taxRate = invoiceData.taxRate || 0;

    var rows = [
      {
        label: 'SUBTOTAL',
        value: self.formatCurrency(invoiceData.subtotal || 0),
        labelColor: self.COLORS.SUBTOTAL_GRAY,
        valueSize: self.SIZE_BASE,
        bold: false,
      },
      {
        label: 'DISCOUNT',
        value: self.formatCurrency(invoiceData.discount || 0),
        labelColor: self.COLORS.SUBTOTAL_GRAY,
        valueSize: self.SIZE_BASE,
        bold: false,
      },
      {
        label: 'TAX' + (taxRate ? ' (' + taxRate + '%)' : ' (TAX RATE %)'),
        value: self.formatCurrency(invoiceData.tax || 0),
        labelColor: self.COLORS.SUBTOTAL_GRAY,
        valueSize: self.SIZE_BASE,
        bold: false,
      },
      {
        label: 'INVOICE TOTAL',
        value: self.formatCurrency(invoiceData.total || 0),
        labelColor: self.COLORS.SECTION_LABEL,
        valueSize: self.SIZE_TOTAL,
        bold: true,
      },
    ];

    var tableRows = rows.map(function (r) {
      return new TableRow({
        children: [
          // Spacer cell to push totals right
          self._cell(self._para(self._text('')), { width: 6800 }),
          // Label
          self._cell(
            self._para(
              self._text(r.label, {
                bold: r.bold,
                color: r.labelColor,
                size: r.bold ? self.SIZE_BASE : self.SIZE_SMALL,
              }),
              { alignment: AlignmentType.RIGHT }
            ),
            { width: 2200 }
          ),
          // Value
          self._cell(
            self._para(
              self._text(r.value, {
                bold: r.bold,
                size: r.valueSize,
              }),
              { alignment: AlignmentType.RIGHT }
            ),
            { width: 1800 }
          ),
        ],
      });
    });

    return new Table({
      rows: tableRows,
      width: { size: 10800, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    });
  },

  /* ══════════════════════════════════════════════════════
     TABLE 5: Footer (1 row × 3 cols)
     Col1: BANK ACCOUNT section (IBAN, SWIFT, Receiver, Bank)
     Col2: spacer
     Col3: TERMS AND CONDITIONS
     ══════════════════════════════════════════════════════ */
  _buildFooterTable(employee, terms) {
    const { Table, TableRow, TableLayoutType, WidthType } = docx;

    var self = this;

    // Bank details paragraphs
    var bankParas = [
      self._para(
        self._text('BANK ACCOUNT', { bold: true, color: self.COLORS.SECTION_LABEL, size: self.SIZE_SMALL })
      ),
      self._para(self._text('')), // spacer line
      self._para([
        self._text('IBAN: ', { bold: true, size: self.SIZE_SMALL }),
        self._text(employee.iban || '', { size: self.SIZE_SMALL }),
      ]),
      self._para([
        self._text('SWIFT: ', { bold: true, size: self.SIZE_SMALL }),
        self._text(employee.swift || 'UNJSUAUKXXX', { size: self.SIZE_SMALL }),
      ]),
      self._para([
        self._text('Receiver: ', { bold: true, size: self.SIZE_SMALL }),
        self._text(employee.receiver_name || employee.full_name_lat || '', { size: self.SIZE_SMALL }),
      ]),
      self._para([
        self._text('Bank: ', { bold: true, size: self.SIZE_SMALL }),
        self._text(employee.bank_name || 'JSC UNIVERSAL BANK, KYIV, UKRAINE', { size: self.SIZE_SMALL }),
      ]),
    ];

    // Terms paragraphs
    var termsParas = [
      self._para(
        self._text('TERMS AND CONDITIONS', { bold: true, color: self.COLORS.SECTION_LABEL, size: self.SIZE_SMALL })
      ),
      self._para(self._text('')), // spacer line
      self._para(
        self._text(terms || 'Thank you for your business!', { size: self.SIZE_SMALL })
      ),
    ];

    var row = new TableRow({
      children: [
        self._cell(bankParas, { width: 5400 }),
        self._cell(self._para(self._text('')), { width: 1000 }),
        self._cell(termsParas, { width: 4400 }),
      ],
    });

    return new Table({
      rows: [row],
      width: { size: 10800, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
    });
  },

  /* ══════════════════════════════════════════════════════
     MAIN GENERATE METHOD
     Builds complete DOCX with all 5 tables
     ══════════════════════════════════════════════════════ */
  async generate(invoiceData) {
    // invoiceData = {
    //   employee: { full_name_lat, address, phone, iban, swift, bank_name, receiver_name },
    //   invoiceNumber: 6,
    //   invoiceDate: '28.02.26',
    //   dueDays: 7,
    //   items: [{ description: 'UAV Systems Development Services', price: 7979, qty: 1 }, ...],
    //   subtotal: 10870,
    //   discount: 0,
    //   tax: 0,
    //   taxRate: 0,
    //   total: 10870,
    //   billedTo: { name: 'Woodenshark LLC', address: '3411 Silverside Road...' },
    //   terms: 'Thank you for your business!...'
    // }

    const { Document, Packer, Paragraph, TextRun } = docx;

    var employee = invoiceData.employee || {};
    var terms = invoiceData.terms || 'Thank you for your business! Please make the payment within 14 days. There will be a 4% interest charge per month on late invoices.';

    // Spacer paragraph between tables
    var spacer = new Paragraph({
      children: [new TextRun({ text: '', size: this.SIZE_BASE })],
      spacing: { after: 200, before: 200 },
    });

    // Build all 5 tables
    var headerTable    = this._buildHeaderTable(employee);
    var billingTable   = this._buildBillingTable(invoiceData);
    var lineItemsTable = this._buildLineItemsTable(invoiceData.items);
    var totalsTable    = this._buildTotalsTable(invoiceData);
    var footerTable    = this._buildFooterTable(employee, terms);

    // Assemble document
    var doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: 12240,   // A4 width in twentieths of a point (8.5 inches)
              height: 15840,  // A4 height (11 inches — letter; use 16838 for true A4)
            },
            margin: {
              top: 1440,     // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [
          headerTable,
          spacer,
          billingTable,
          spacer,
          lineItemsTable,
          spacer,
          totalsTable,
          spacer,
          spacer,
          footerTable,
        ],
      }],
    });

    // Pack to Blob
    var blob = await Packer.toBlob(doc);
    return blob;
  },

  /* ── Format currency as "$1,234.56" ── */
  formatCurrency(amount) {
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /* ── Ensure DD.MM.YY format ── */
  formatDate(dateStr) {
    if (!dateStr) return '';
    // Already in DD.MM.YY
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(dateStr)) return dateStr;
    // DD.MM.YYYY -> DD.MM.YY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      return dateStr.slice(0, 6) + dateStr.slice(8);
    }
    // ISO date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      var d = new Date(dateStr);
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var yy = String(d.getFullYear()).slice(2);
      return dd + '.' + mm + '.' + yy;
    }
    return dateStr;
  },

  /* ── Format date as DD.MM.YYYY for filenames ── */
  formatDateFull(dateStr) {
    if (!dateStr) return '';
    // DD.MM.YY -> DD.MM.20YY
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(dateStr)) {
      return dateStr.slice(0, 6) + '20' + dateStr.slice(6);
    }
    // Already DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    // ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      var d = new Date(dateStr);
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var yyyy = String(d.getFullYear());
      return dd + '.' + mm + '.' + yyyy;
    }
    return dateStr;
  },

  /* ── Generate filename based on employee format ── */
  getFileName(employee, invoiceNumber, date) {
    var nameParts = (employee.full_name_lat || 'Unknown').split(' ');
    var format = employee.invoice_format || 'WS';
    var fullDate = this.formatDateFull(date);
    var shortDate = this.formatDate(date);

    switch (format) {
      case 'WS':
        // WS-Invoice-{N}-{FIRSTNAME}-{LASTNAME} {DD.MM.YYYY}.docx
        return 'WS-Invoice-' + invoiceNumber + '-' + nameParts.join('-') + ' ' + fullDate + '.docx';
      case 'FOP':
        // {Surname}_Invoice-{N}-FOP.docx
        return nameParts[0] + '_Invoice-' + invoiceNumber + '-FOP.docx';
      case 'CUSTOM':
        // {prefix}-{N}.docx
        return (employee.invoice_prefix || 'Invoice') + '-' + invoiceNumber + '.docx';
      default:
        return 'Invoice-' + invoiceNumber + '-' + nameParts.join('-') + '.docx';
    }
  },

  /* ── Download single invoice ── */
  async downloadInvoice(invoiceData) {
    var blob = await this.generate(invoiceData);
    var fileName = this.getFileName(
      invoiceData.employee,
      invoiceData.invoiceNumber,
      invoiceData.invoiceDate
    );
    saveAs(blob, fileName);
  },

  /* ── Download batch of invoices (one by one with delay) ── */
  async downloadBatch(invoicesData) {
    for (var i = 0; i < invoicesData.length; i++) {
      await this.downloadInvoice(invoicesData[i]);
      // Small delay between downloads to avoid browser blocking
      if (i < invoicesData.length - 1) {
        await new Promise(function (r) { setTimeout(r, 500); });
      }
    }
  },
};
