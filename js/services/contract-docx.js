/* ═══════════════════════════════════════════════════════
   ContractDocx — Consulting Agreement DOCX Generator
   Ported from style_agreement.py → docx.js 9.6.0
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

const ContractDocx = {

  /* ── Color constants (Navy + Cyan theme) ── */
  COLORS: {
    NAVY:           '0A0E17',
    DARK:           '0D1117',
    CYAN:           '00BCD4',
    CYAN_DARK:      '0097A7',
    TEXT_PRIMARY:   '1A1A1A',
    TEXT_SECONDARY: '4A4A4A',
    TEXT_MUTED:     '6B6B6B',
    LIGHT_GRAY:     'D0D0D0',
    ALT_ROW:        'F4F6F8',
    CYAN_TINT:      'E8F5F7',
    WHITE:          'FFFFFF',
    FAFBFC:         'FAFBFC',
  },

  /* ── Font defaults ── */
  FONT_HEADING: 'Calibri',
  FONT_BODY:    'Cambria',

  /* ── Company constants ── */
  CLIENT_NAME:    'Woodenshark LLC',
  CLIENT_ADDRESS: '3411 Silverside Road, Suite 104\nRodney Building, Wilmington, DE, 19810',
  CLIENT_SWIFT:   'CMFGUS33',
  CLIENT_ACCOUNT: '822000034828',
  CLIENT_BANK:    'Wise Inc',

  /* ── Required fields for validation ── */
  REQUIRED_FIELDS: [
    'full_name_lat', 'date_of_birth', 'passport_number',
    'passport_issued', 'passport_expires', 'address',
    'iban', 'swift', 'receiver_name', 'rate_usd'
  ],

  FIELD_LABELS: {
    full_name_lat:   'Full Name (Latin)',
    date_of_birth:   'Date of Birth',
    passport_number: 'Passport Number',
    passport_issued: 'Passport Issued',
    passport_expires:'Passport Expires',
    address:         'Address',
    iban:            'IBAN',
    swift:           'SWIFT',
    receiver_name:   'Receiver Name',
    rate_usd:        'Rate (USD)',
  },

  /* ── Legal sections ── */
  SECTIONS: [
    { title: 'SERVICES PROVIDED', paragraphs: [
      'The Client hereby agrees to engage a Consultant to provide the Client with the following consulting services (the \u201cServices\u201d):',
      null, // role placeholder
      'The Services will also include any other consulting tasks which the Parties may agree on. The Consultant hereby agrees to provide such Services to the Client.',
    ]},
    { title: 'TERM OF AGREEMENT', paragraphs: [
      'The term of this Agreement (the \u201cTerm\u201d) will begin on the date of this Agreement and will remain in full force and effect until 31.12.2026, subject to earlier termination as provided in this Agreement. The Term may be extended with the written consent of the Parties.',
      'In the event that either Party wishes to terminate this Agreement prior to 31.12.2026 that Party will be required to provide 30 days\u2019 written notice to the other Party.',
    ]},
    { title: 'PERFORMANCE', paragraphs: [
      'The Parties agree to do everything necessary to ensure that the terms of this Agreement take effect.',
    ]},
    { title: 'CURRENCY', paragraphs: [
      'Except as otherwise provided in this Agreement, all monetary amounts referred to in this Agreement are in USD.',
    ]},
    { title: 'COMPENSATION', paragraphs: [
      null, // compensation placeholder — filled dynamically
      'The Client will be invoiced every month.',
      'Invoices submitted by the Consultant to the Client are due upon receipt.',
    ]},
    { title: 'REIMBURSEMENT OF EXPENSES', paragraphs: [
      'The Consultant will be reimbursed all reasonable and necessary expenses incurred by the Consultant in connection with providing the Services, such as travel expenses and other related to business development expenses.',
      'All expenses must be pre-approved by the Client.',
    ]},
    { title: 'CONFIDENTIALITY', paragraphs: [
      'Confidential information (the \u201cConfidential Information\u201d) refers to any data or information relating to the Client, whether business or personal, which would reasonably be considered to be private or proprietary to the Client and that is not generally known and where the release of that Confidential Information could reasonably be expected to cause harm to the Client.',
      'The Consultant agrees that they will not disclose, divulge, reveal, report or use, for any purpose, any Confidential Information which the Consultant has obtained, except as authorized by the Client or as required by law. The obligations of confidentiality will apply during the Term and will survive indefinitely upon termination of this Agreement.',
      'All written and oral information and material disclosed or provided by the Client to the Consultant under this Agreement is Confidential Information regardless of whether it was provided before or after the date of this Agreement or how it was provided to the Consultant.',
    ]},
    { title: 'OWNERSHIP OF INTELLECTUAL PROPERTY', paragraphs: [
      'All intellectual property and related material, including any trade secrets, moral rights, goodwill, relevant registrations or applications for registration, and rights in any patent, copyright, trademark, trade dress, industrial design and trade name (the \u201cIntellectual Property\u201d) that is developed or produced under this Agreement, is a \u201cwork made for hire\u201d and will be the sole property of the Client. The use of the Intellectual Property by the Client will not be restricted in any manner.',
      'The Consultant may not use the Intellectual Property for any purpose other than that contracted for in this Agreement except with the written consent of the Client. The Consultant will be responsible for any and all damages resulting from the unauthorized use of the Intellectual Property.',
    ]},
    { title: 'RETURN OF PROPERTY', paragraphs: [
      'Upon the expiration or termination of this Agreement, the Consultant will return to the Client any property, documentation, records, or Confidential Information which is the property of the Client.',
    ]},
    { title: 'CAPACITY / INDEPENDENT CONTRACTOR', paragraphs: [
      'In providing the Services under this Agreement it is expressly agreed that the Consultant is acting as an independent contractor and not as an employee. The Consultant and the Client acknowledge that this Agreement does not create a partnership or joint venture between them, and is exclusively a contract for service. The Client is not required to pay, or make any contributions to any social security, local, state or federal tax, unemployment compensation, workers\u2019 compensation, insurance premium, profit-sharing, pension or any other employee benefit for the Consultant during the Term. The Consultant is responsible for paying, and complying with reporting requirements for, all local, state and federal taxes related to payments made to the Consultant under this Agreement.',
    ]},
    { title: 'NOTICE', paragraphs: [
      'All notices, requests, demands or other communications required or permitted by the terms of this Agreement will be given in writing and delivered to the Parties at the following addresses:',
      null, // notice addresses placeholder
      'or to such other address as either Party may from time to time notify the other, and will be deemed to be properly delivered (a) immediately upon being served personally, (b) two days after being deposited with the postal service if served by registered mail, or (c) the following day after being deposited with an overnight courier.',
    ]},
    { title: 'INDEMNIFICATION', paragraphs: [
      'Except to the extent paid in settlement from any applicable insurance policies, and to the extent permitted by applicable law, each Party agrees to indemnify and hold harmless the other Party, and its respective affiliates, officers, agents, employees, and permitted successors and assigns against any and all claims, losses, damages, liabilities, penalties, punitive damages, expenses, reasonable legal fees and costs of any kind or amount whatsoever, which result from or arise out of any act or omission of the indemnifying party, its respective affiliates, officers, agents, employees, and permitted successors and assigns that occurs in connection with this Agreement. This indemnification shall survive the termination of this Agreement.',
    ]},
    { title: 'MODIFICATION OF AGREEMENT', paragraphs: [
      'Any amendment or modification of this Agreement or additional obligation assumed by either Party in connection with this Agreement will only be binding if evidenced in writing signed by each Party or an authorized representative of each Party.',
    ]},
    { title: 'TIME OF THE ESSENCE', paragraphs: [
      'Time is of the essence in this Agreement. No extension or variation of this Agreement will operate as a waiver of this provision.',
    ]},
    { title: 'ASSIGNMENT', paragraphs: [
      'The Consultant will not voluntarily, or by operation of law, assign or otherwise transfer its obligations under this Agreement without the prior written consent of the Client.',
    ]},
    { title: 'ENTIRE AGREEMENT', paragraphs: [
      'It is agreed that there is no representation, warranty, collateral agreement or condition affecting this Agreement except as expressly provided in this Agreement.',
    ]},
    { title: 'ENUREMENT', paragraphs: [
      'This Agreement will enure to the benefit of and be binding on the Parties and their respective heirs, executors, administrators and permitted successors and assigns.',
    ]},
    { title: 'TITLES / HEADINGS', paragraphs: [
      'Headings are inserted for the convenience of the Parties only and are not to be considered when interpreting this Agreement.',
    ]},
    { title: 'GENDER', paragraphs: [
      'Words in the singular mean and include the plural and vice versa. Words in the masculine mean and include the feminine and vice versa.',
    ]},
    { title: 'GOVERNING LAW', paragraphs: [
      'This Agreement will be governed by and construed in accordance with the laws of the state of Delaware.',
    ]},
    { title: 'SEVERABILITY', paragraphs: [
      'In the event that any of the provisions of this Agreement are held to be invalid or unenforceable in whole or in part, all other provisions will nevertheless continue to be valid and enforceable with the invalid or unenforceable parts severed from the remainder of this Agreement.',
    ]},
    { title: 'WAIVER', paragraphs: [
      'The waiver by either Party of a breach, default, delay or omission of any of the provisions of this Agreement by the other Party will not be construed as a waiver of any subsequent breach of the same or other provisions.',
    ]},
  ],

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  _noBorder() {
    var s = { style: docx.BorderStyle.SINGLE, size: 1, color: this.COLORS.WHITE };
    return { top: s, bottom: s, left: s, right: s };
  },

  _text(text, opts) {
    opts = opts || {};
    var str = String(text);
    // Handle \n by splitting into multiple TextRun with break
    if (str.indexOf('\n') !== -1) {
      var parts = str.split('\n');
      var runs = [];
      for (var i = 0; i < parts.length; i++) {
        var runOpts = {
          text: parts[i],
          font: opts.font || this.FONT_BODY,
          size: opts.size || 22,
          bold: opts.bold || false,
          italics: opts.italics || false,
          color: opts.color || this.COLORS.TEXT_PRIMARY,
        };
        if (i > 0) runOpts.break = 1;
        runs.push(new docx.TextRun(runOpts));
      }
      return runs;
    }
    return new docx.TextRun({
      text: str,
      font: opts.font || this.FONT_BODY,
      size: opts.size || 22,
      bold: opts.bold || false,
      italics: opts.italics || false,
      color: opts.color || this.COLORS.TEXT_PRIMARY,
    });
  },

  _para(children, opts) {
    opts = opts || {};
    if (!Array.isArray(children)) children = [children];
    // Flatten nested arrays (from _text with \n)
    var flat = [];
    for (var i = 0; i < children.length; i++) {
      if (Array.isArray(children[i])) {
        for (var j = 0; j < children[i].length; j++) flat.push(children[i][j]);
      } else {
        flat.push(children[i]);
      }
    }
    return new docx.Paragraph({
      children: flat,
      alignment: opts.alignment || docx.AlignmentType.LEFT,
      spacing: opts.spacing || { before: 0, after: 0 },
    });
  },

  _cell(paragraphs, opts) {
    opts = opts || {};
    if (!Array.isArray(paragraphs)) paragraphs = [paragraphs];
    return new docx.TableCell({
      children: paragraphs,
      borders: opts.borders || this._noBorder(),
      width: opts.width ? { size: opts.width, type: docx.WidthType.DXA } : undefined,
      verticalAlign: opts.verticalAlign || docx.VerticalAlign.TOP,
      shading: opts.shading || undefined,
      columnSpan: opts.columnSpan || undefined,
      margins: opts.margins || { top: 40, bottom: 40, left: 80, right: 80 },
    });
  },

  /* ── Date formatting ── */
  _formatDateLong(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  _formatDateShort(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    return dd + '.' + mm + '.' + d.getFullYear();
  },

  /* ═══════════════════════════════════════════════════════
     VALIDATION
     ═══════════════════════════════════════════════════════ */
  validateFields(emp) {
    var missing = [];
    for (var i = 0; i < this.REQUIRED_FIELDS.length; i++) {
      var f = this.REQUIRED_FIELDS[i];
      var val = emp[f];
      if (val === null || val === undefined || val === '' || val === 0) {
        missing.push(this.FIELD_LABELS[f] || f);
      }
    }
    return missing;
  },

  /* ═══════════════════════════════════════════════════════
     DOCUMENT BUILDERS
     ═══════════════════════════════════════════════════════ */

  /* ── Title Page ── */
  _buildTitlePage(emp) {
    var self = this;
    var C = self.COLORS;
    var agreementDate = self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var effectiveDate = self._formatDateLong(emp.effective_date) || agreementDate;

    var elements = [];

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 400 } }));

    // Brand: OMD SYSTEMS
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'OMD', font: self.FONT_HEADING, size: 64, bold: true, color: C.NAVY }),
        new docx.TextRun({ text: ' SYSTEMS', font: self.FONT_HEADING, size: 64, bold: true, color: C.CYAN_DARK }),
      ],
      spacing: { before: 0, after: 60 },
    }));

    // Cyan line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 10, color: C.CYAN, space: 1 } },
    }));

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 600 } }));

    // Title
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'CONSULTING AGREEMENT', font: self.FONT_HEADING, size: 56, bold: true, color: C.NAVY, characterSpacing: 30 }),
      ],
      spacing: { before: 0, after: 80 },
    }));

    // Navy line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 16, color: C.NAVY, space: 1 } },
    }));

    // Subtitle
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'Professional Services & Technical Consulting', font: self.FONT_HEADING, size: 28, color: C.TEXT_SECONDARY }),
      ],
      spacing: { before: 80, after: 0 },
    }));

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 800 } }));

    // Info table
    var infoData = [
      ['AGREEMENT DATE', agreementDate],
      ['EFFECTIVE DATE', effectiveDate],
      ['', ''],
      ['PARTY A  (CLIENT)', self.CLIENT_NAME],
      ['PARTY B  (CONSULTANT)', emp.full_name_lat || ''],
    ];

    var infoRows = infoData.map(function(pair) {
      if (pair[0] === '') {
        return new docx.TableRow({
          children: [
            self._cell(self._para(self._text('')), {
              width: 2835,
              borders: { top: self._noBorder().top, bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY }, left: self._noBorder().left, right: self._noBorder().right },
              margins: { top: 20, bottom: 20, left: 0, right: 60 },
            }),
            self._cell(self._para(self._text('')), {
              width: 6521,
              borders: { top: self._noBorder().top, bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY }, left: self._noBorder().left, right: self._noBorder().right },
              margins: { top: 20, bottom: 20, left: 60, right: 0 },
            }),
          ],
        });
      }
      return new docx.TableRow({
        children: [
          self._cell(
            self._para(self._text(pair[0], { font: self.FONT_HEADING, size: 17, color: C.TEXT_MUTED }), { spacing: { before: 40, after: 40 } }),
            { width: 2835, margins: { top: 20, bottom: 20, left: 0, right: 60 } }
          ),
          self._cell(
            self._para(self._text(pair[1], { bold: true, size: 22 }), { spacing: { before: 40, after: 40 } }),
            { width: 6521, margins: { top: 20, bottom: 20, left: 60, right: 0 } }
          ),
        ],
      });
    });

    elements.push(new docx.Table({
      rows: infoRows,
      width: { size: 9356, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
    }));

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 600 } }));

    // Classification
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: '  CLASSIFICATION:  ', font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        new docx.TextRun({ text: '  CONFIDENTIAL  ', font: self.FONT_HEADING, size: 18, color: C.WHITE, bold: true, shading: { type: docx.ShadingType.CLEAR, fill: C.NAVY, color: C.NAVY } }),
      ],
      spacing: { before: 0, after: 0 },
    }));

    // Page break
    elements.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));

    return elements;
  },

  /* ── Preamble + Parties table ── */
  _buildPreamble(emp) {
    var self = this;
    var C = self.COLORS;
    var agreementDate = self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var effectiveDate = self._formatDateLong(emp.effective_date) || agreementDate;

    var elements = [];

    // Preamble
    elements.push(new docx.Paragraph({
      children: [
        self._text('THIS CONSULTING AGREEMENT ', { bold: true }),
        self._text('(the \u201cAgreement\u201d) dated '),
        self._text(agreementDate, { bold: true }),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 200, line: 276 },
    }));

    // BETWEEN:
    elements.push(new docx.Paragraph({
      children: [self._text('BETWEEN:', { font: self.FONT_HEADING, size: 24, color: C.DARK, bold: true })],
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
    }));

    // Parties table
    var clientCell = self._cell([
      self._para(self._text('CLIENT', { font: self.FONT_HEADING, size: 18, color: C.CYAN_DARK, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(self.CLIENT_NAME, { bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(self.CLIENT_ADDRESS, { size: 20, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text('(the \u201cClient\u201d)', { size: 20, color: C.TEXT_MUTED, italics: true }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4536,
      margins: { top: 80, bottom: 80, left: 160, right: 80 },
      shading: { type: docx.ShadingType.CLEAR, fill: C.FAFBFC, color: C.FAFBFC },
      borders: {
        top: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: docx.BorderStyle.SINGLE, size: 16, color: C.CYAN },
        right: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
      },
    });

    var consultantCell = self._cell([
      self._para(self._text('CONSULTANT', { font: self.FONT_HEADING, size: 18, color: C.CYAN_DARK, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(emp.full_name_lat || '', { bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(emp.address || '', { size: 20, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text('(the \u201cConsultant\u201d)', { size: 20, color: C.TEXT_MUTED, italics: true }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4820,
      margins: { top: 80, bottom: 80, left: 160, right: 80 },
      shading: { type: docx.ShadingType.CLEAR, fill: C.FAFBFC, color: C.FAFBFC },
      borders: {
        top: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: docx.BorderStyle.SINGLE, size: 16, color: C.CYAN },
        right: { style: docx.BorderStyle.NONE, size: 0, color: 'auto' },
      },
    });

    elements.push(new docx.Table({
      rows: [new docx.TableRow({ children: [clientCell, consultantCell] })],
      width: { size: 9356, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
    }));

    return elements;
  },

  /* ── Background section with consultant details ── */
  _buildBackground(emp) {
    var self = this;
    var C = self.COLORS;
    var dob = self._formatDateLong(emp.date_of_birth);
    var passIssued = self._formatDateLong(emp.passport_issued);
    var passExpires = self._formatDateLong(emp.passport_expires);

    var elements = [];

    // Section heading
    elements.push(self._sectionHeading('BACKGROUND', 1));

    elements.push(self._bodyPara('The Client is of the opinion that the Consultant has the necessary qualifications, experience and abilities to provide consulting services to the Client.'));
    elements.push(self._bodyPara('The Consultant agrees to provide such consulting services to the Client on the terms and conditions set out in this Agreement.'));
    elements.push(self._bodyPara('This Consulting Agreement (hereinafter the \u201cAgreement\u201d) states the terms and conditions that govern the contractual agreement by and between'));

    // Client paragraph
    elements.push(new docx.Paragraph({
      children: [
        self._text(self.CLIENT_NAME, { bold: true }),
        self._text(', a company incorporated and registered in the United States of America whose registered office is at ' + self.CLIENT_ADDRESS.replace(/\n/g, ', ') + ' '),
        self._text('(hereinafter the \u201cClient\u201d)', { bold: true }),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 80, line: 276 },
    }));

    // Consultant paragraph
    var consultantChildren = [
      self._text(emp.full_name_lat || '', { bold: true }),
      self._text(', with the date of birth '),
      self._text(dob, { bold: true }),
      self._text(', the holder of Ukrainian Foreign Passport \u2116 '),
      self._text(emp.passport_number || '', { bold: true }),
      self._text(' issued on '),
      self._text(passIssued, { bold: true }),
      self._text(' and valid till '),
      self._text(passExpires, { bold: true }),
      self._text(', with the primary address of residence '),
      self._text(emp.address || '', { bold: true }),
    ];

    elements.push(new docx.Paragraph({
      children: consultantChildren,
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 80, line: 276 },
    }));

    // IN CONSIDERATION OF
    elements.push(new docx.Paragraph({
      children: [
        self._text('IN CONSIDERATION OF ', { bold: true }),
        self._text('the matters described above and of the mutual benefits and obligations set forth in this Agreement, the receipt and sufficiency of which consideration is hereby acknowledged, the Client and the Consultant (individually, the \u201cParty\u201d and collectively the \u201cParties\u201d to this Agreement) agree as follows:'),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 160, after: 100, line: 276 },
    }));

    return elements;
  },

  /* ── Section heading with number and cyan underline ── */
  _sectionHeading(title, number) {
    var children = [];
    if (number) {
      children.push(this._text(number + '. ', { font: this.FONT_HEADING, size: 26, color: this.COLORS.CYAN, bold: true }));
    }
    children.push(this._text(title, { font: this.FONT_HEADING, size: 26, color: this.COLORS.DARK, bold: true }));

    return new docx.Paragraph({
      children: children,
      spacing: { before: 360, after: 80 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 8, color: this.COLORS.CYAN, space: 1 } },
      keepNext: true,
    });
  },

  /* ── Body paragraph (justified) ── */
  _bodyPara(text) {
    return new docx.Paragraph({
      children: [this._text(text)],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100, line: 276 },
    });
  },

  /* ── Build all legal sections ── */
  _buildSections(emp) {
    var self = this;
    var C = self.COLORS;
    var elements = [];
    var sectionNum = 2; // 1 was BACKGROUND

    for (var s = 0; s < self.SECTIONS.length; s++) {
      var sec = self.SECTIONS[s];
      elements.push(self._sectionHeading(sec.title, sectionNum));

      for (var p = 0; p < sec.paragraphs.length; p++) {
        var text = sec.paragraphs[p];

        if (text === null) {
          // Special placeholders
          if (sec.title === 'SERVICES PROVIDED') {
            // Role callout box
            elements.push(new docx.Paragraph({
              children: [
                self._text(emp.service_description || 'UAV Systems Development Services', { font: self.FONT_HEADING, size: 26, color: C.DARK, bold: true }),
              ],
              alignment: docx.AlignmentType.CENTER,
              spacing: { before: 120, after: 120, line: 360 },
              border: {
                top: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 4 },
                bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 4 },
                left: { style: docx.BorderStyle.SINGLE, size: 24, color: C.CYAN, space: 8 },
                right: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 8 },
              },
              shading: { type: docx.ShadingType.CLEAR, fill: C.CYAN_TINT, color: C.CYAN_TINT },
            }));
          } else if (sec.title === 'NOTICE') {
            // Notice addresses table
            var nb = self._noBorder();
            var addrRows = [
              new docx.TableRow({
                children: [self._cell([
                  new docx.Paragraph({
                    children: [
                      self._text(self.CLIENT_NAME, { bold: true }),
                      self._text(', mitgor@woodenshark.com', { color: C.TEXT_SECONDARY }),
                    ],
                    spacing: { before: 60, after: 60 },
                  }),
                ], {
                  width: 9356,
                  borders: { top: nb.top, bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY }, left: nb.left, right: nb.right },
                  margins: { top: 40, bottom: 40, left: 120, right: 0 },
                })],
              }),
              new docx.TableRow({
                children: [self._cell([
                  new docx.Paragraph({
                    children: [
                      self._text(emp.full_name_lat || '', { bold: true }),
                      self._text(', ' + (emp.work_email || emp.phone || ''), { color: C.TEXT_SECONDARY }),
                    ],
                    spacing: { before: 60, after: 60 },
                  }),
                ], {
                  width: 9356,
                  margins: { top: 40, bottom: 40, left: 120, right: 0 },
                })],
              }),
            ];

            elements.push(new docx.Table({
              rows: addrRows,
              width: { size: 9356, type: docx.WidthType.DXA },
              layout: docx.TableLayoutType.FIXED,
            }));
          } else if (sec.title === 'COMPENSATION') {
            // Compensation paragraph with dynamic rate
            var rate = parseFloat(emp.rate_usd) || 0;
            var taxRate = 0.06;
            var totalWithTax = Math.round(rate * (1 + taxRate));
            var rateWords = self._numberToWords(rate);
            var totalWords = self._numberToWords(totalWithTax);

            elements.push(self._bodyPara(
              'The Consultant will charge the Client for the Services at the rate of ' +
              rate.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' (' + rateWords + ') USD plus 6% tax, totaling ' +
              totalWithTax.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' (' + totalWords + ') USD per month (the \u201cCompensation\u201d) for full time employment.'
            ));
          }
          continue;
        }

        elements.push(self._bodyPara(text));
      }

      sectionNum++;
    }

    return elements;
  },

  /* ── Number to words (simple implementation for amounts) ── */
  _numberToWords(n) {
    var ones = ['','one','two','three','four','five','six','seven','eight','nine',
                'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
                'seventeen','eighteen','nineteen'];
    var tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    n = Math.round(n);
    if (n === 0) return 'zero';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' hundred' + (n%100 ? ' ' + this._numberToWords(n%100) : '');
    if (n < 1000000) return this._numberToWords(Math.floor(n/1000)) + ' thousand' + (n%1000 ? ' ' + this._numberToWords(n%1000) : '');
    return String(n);
  },

  /* ── Signature block ── */
  _buildSignatureBlock(emp) {
    var self = this;
    var C = self.COLORS;
    var effectiveDate = self._formatDateLong(emp.effective_date) || self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var elements = [];

    // Heavy line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 16, color: C.NAVY, space: 1 } },
    }));

    // IN WITNESS WHEREOF
    elements.push(new docx.Paragraph({
      children: [
        self._text('IN WITNESS WHEREOF ', { bold: true, italics: true }),
        self._text('the Parties have duly affixed their signatures under hand and seal on ', { italics: true }),
        self._text(effectiveDate, { bold: true, italics: true }),
        self._text('.', { italics: true }),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 240, after: 240, line: 276 },
    }));

    // Signature table
    var topBorder = { style: docx.BorderStyle.SINGLE, size: 8, color: C.CYAN };
    var noneBorder = { style: docx.BorderStyle.NONE, size: 0, color: 'auto' };

    var clientSigCell = self._cell([
      self._para(self._text('CLIENT', { font: self.FONT_HEADING, size: 18, color: C.CYAN_DARK, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(self.CLIENT_NAME, { bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(self.CLIENT_ADDRESS, { size: 18, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 80 } }),
      self._para(self._text('Bank account:', { font: self.FONT_HEADING, size: 18, color: C.TEXT_MUTED, bold: true }), { spacing: { before: 0, after: 20 } }),
      new docx.Paragraph({ children: [
        self._text('SWIFT: ', { size: 18, color: C.TEXT_MUTED }),
        self._text(self.CLIENT_SWIFT, { size: 18, bold: true }),
      ], spacing: { before: 0, after: 20 } }),
      new docx.Paragraph({ children: [
        self._text('Account: ', { size: 18, color: C.TEXT_MUTED }),
        self._text(self.CLIENT_ACCOUNT, { size: 18, bold: true }),
      ], spacing: { before: 0, after: 20 } }),
      self._para(self._text(self.CLIENT_BANK, { size: 18, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 200 } }),
      self._para(self._text('____________________________', { color: C.NAVY }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text('Signature', { font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4678,
      margins: { top: 100, bottom: 60, left: 120, right: 60 },
      borders: { top: topBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
    });

    var consultantSigCell = self._cell([
      self._para(self._text('CONSULTANT', { font: self.FONT_HEADING, size: 18, color: C.CYAN_DARK, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(emp.full_name_lat || '', { bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(emp.address || '', { size: 18, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 80 } }),
      self._para(self._text('Bank account:', { font: self.FONT_HEADING, size: 18, color: C.TEXT_MUTED, bold: true }), { spacing: { before: 0, after: 20 } }),
      new docx.Paragraph({ children: [
        self._text('IBAN: ', { size: 18, color: C.TEXT_MUTED }),
        self._text(emp.iban || '', { size: 18, bold: true }),
      ], spacing: { before: 0, after: 20 } }),
      new docx.Paragraph({ children: [
        self._text('SWIFT/BIC: ', { size: 18, color: C.TEXT_MUTED }),
        self._text(emp.swift || '', { size: 18, bold: true }),
      ], spacing: { before: 0, after: 20 } }),
      new docx.Paragraph({ children: [
        self._text('Receiver: ', { size: 18, color: C.TEXT_MUTED }),
        self._text(emp.receiver_name || '', { size: 18, bold: true }),
      ], spacing: { before: 0, after: 200 } }),
      self._para(self._text('____________________________', { color: C.NAVY }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(emp.full_name_lat || '', { font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4678,
      margins: { top: 100, bottom: 60, left: 120, right: 60 },
      borders: { top: topBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
    });

    elements.push(new docx.Table({
      rows: [new docx.TableRow({ children: [clientSigCell, consultantSigCell] })],
      width: { size: 9356, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
    }));

    return elements;
  },

  /* ═══════════════════════════════════════════════════════
     MAIN GENERATE
     ═══════════════════════════════════════════════════════ */
  async generate(emp) {
    var self = this;
    var C = self.COLORS;

    // Collect all elements
    var children = [];
    children = children.concat(self._buildTitlePage(emp));
    children = children.concat(self._buildPreamble(emp));
    children = children.concat(self._buildBackground(emp));
    children = children.concat(self._buildSections(emp));
    children = children.concat(self._buildSignatureBlock(emp));

    // Header
    var headerChildren = [
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: 'CONFIDENTIAL  \u2014  OMD SYSTEMS PROPRIETARY',
            font: self.FONT_HEADING, size: 15, color: C.WHITE, bold: true,
            characterSpacing: 50,
          }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 320 },
        shading: { type: docx.ShadingType.CLEAR, fill: C.NAVY, color: C.NAVY },
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: 'OMD SYSTEMS', font: self.FONT_HEADING, size: 16, color: C.DARK, bold: true }),
          new docx.TextRun({ text: '                                                                                           ', font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
          new docx.TextRun({ text: 'Consulting Agreement', font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        ],
        spacing: { before: 60, after: 40 },
        border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: C.CYAN, space: 1 } },
      }),
    ];

    // Footer
    var footerChildren = [
      new docx.Paragraph({
        children: [new docx.TextRun({ text: '', size: 4 })],
        spacing: { before: 0, after: 40, line: 60 },
        border: { bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 1 } },
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ children: ['Consulting Services Agreement  |  CONFIDENTIAL  |  Page ', docx.PageNumber.CURRENT, ' of ', docx.PageNumber.TOTAL_PAGES], font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: 'CONFIDENTIAL  \u2014  OMD SYSTEMS PROPRIETARY',
            font: self.FONT_HEADING, size: 14, color: C.WHITE, bold: true,
            characterSpacing: 50,
          }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 40, after: 0, line: 280 },
        shading: { type: docx.ShadingType.CLEAR, fill: C.NAVY, color: C.NAVY },
      }),
    ];

    var doc = new docx.Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1814, bottom: 1418, left: 1418, right: 1134 },
          },
        },
        headers: {
          default: new docx.Header({ children: headerChildren }),
        },
        footers: {
          default: new docx.Footer({ children: footerChildren }),
        },
        children: children,
      }],
    });

    return await docx.Packer.toBlob(doc);
  },

  /* ── Get filename ── */
  getFileName(emp) {
    var name = (emp.full_name_lat || 'Unknown').replace(/\s+/g, ' ').trim();
    return 'Consulting Agreement ' + name + '.docx';
  },
};
