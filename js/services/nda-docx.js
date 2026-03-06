/* ═══════════════════════════════════════════════════════
   NdaDocx — Non-Disclosure Agreement DOCX Generator
   Ported from generate_nda.py → docx.js 9.6.0
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

const NdaDocx = {

  /* ── Color constants (Crimson + Gold theme) ── */
  COLORS: {
    DARK_RED:       '1A0000',
    CRIMSON:        '8B0000',
    RED_ACCENT:     'C62828',
    DEEP_RED:       '7B1A1A',
    GOLD:           'B8860B',
    GOLD_LIGHT:     'D4A017',
    TEXT_PRIMARY:   '1A1A1A',
    TEXT_SECONDARY: '4A4A4A',
    TEXT_MUTED:     '6B6B6B',
    LIGHT_GRAY:     'D0D0D0',
    RED_TINT:       'FDF2F2',
    WHITE:          'FFFFFF',
    PARTY_BG:       'FBF5F5',
  },

  FONT_HEADING: 'Calibri',
  FONT_BODY:    'Cambria',

  /* ── Company constants ── */
  WS_NAME:      'Woodenshark LLC',
  WS_ADDRESS:   '3411 Silverside Road, Suite 104\nWilmington, DE 19810, USA',
  OMD_NAME:     'OMD Systems Inc',
  OMD_ADDRESS:  '836 Corriente Pointe Dr\nRedwood City, CA 94065, USA',

  /* ── Required fields ── */
  REQUIRED_FIELDS: [
    'full_name_lat', 'date_of_birth', 'passport_number',
    'passport_issued', 'passport_expires', 'address'
  ],

  FIELD_LABELS: {
    full_name_lat:   'Full Name (Latin)',
    date_of_birth:   'Date of Birth',
    passport_number: 'Passport Number',
    passport_issued: 'Passport Issued',
    passport_expires:'Passport Expires',
    address:         'Address',
  },

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  _noBorder() {
    var s = { style: docx.BorderStyle.SINGLE, size: 1, color: this.COLORS.WHITE };
    return { top: s, bottom: s, left: s, right: s };
  },

  _noneBorder() {
    return { style: docx.BorderStyle.NONE, size: 0, color: 'auto' };
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
          characterSpacing: opts.characterSpacing || undefined,
          shading: opts.shading || undefined,
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
      characterSpacing: opts.characterSpacing || undefined,
      shading: opts.shading || undefined,
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

  _formatDateLong(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  /* ── Section heading with number and red underline ── */
  _sectionHeading(title, number) {
    var children = [];
    if (number) {
      children.push(this._text(number + '. ', { font: this.FONT_HEADING, size: 26, color: this.COLORS.RED_ACCENT, bold: true }));
    }
    children.push(this._text(title, { font: this.FONT_HEADING, size: 26, color: this.COLORS.CRIMSON, bold: true }));

    return new docx.Paragraph({
      children: children,
      spacing: { before: 360, after: 80 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 8, color: this.COLORS.RED_ACCENT, space: 1 } },
      keepNext: true,
    });
  },

  /* ── Body paragraph ── */
  _bodyPara(text) {
    return new docx.Paragraph({
      children: [this._text(text)],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100, line: 276 },
    });
  },

  /* ── Sub-clause with bold label ── */
  _subPara(text, label) {
    var children = [];
    if (label) {
      children.push(this._text(label + ' ', { color: this.COLORS.RED_ACCENT, bold: true }));
    }
    children.push(this._text(text));
    return new docx.Paragraph({
      children: children,
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 40, after: 80, line: 276 },
    });
  },

  /* ═══════════════════════════════════════════════════════
     VALIDATION
     ═══════════════════════════════════════════════════════ */
  validateFields(emp) {
    var missing = [];
    for (var i = 0; i < this.REQUIRED_FIELDS.length; i++) {
      var f = this.REQUIRED_FIELDS[i];
      var val = emp[f];
      if (val === null || val === undefined || val === '') {
        missing.push(this.FIELD_LABELS[f] || f);
      }
    }
    return missing;
  },

  /* ═══════════════════════════════════════════════════════
     TITLE PAGE
     ═══════════════════════════════════════════════════════ */
  _buildTitlePage(emp) {
    var self = this;
    var C = self.COLORS;
    var effectiveDate = self._formatDateLong(emp.effective_date) || self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var elements = [];

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 400 } }));

    // Brand
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'OMD', font: self.FONT_HEADING, size: 64, bold: true, color: C.DARK_RED }),
        new docx.TextRun({ text: ' SYSTEMS', font: self.FONT_HEADING, size: 64, bold: true, color: C.CRIMSON }),
      ],
      spacing: { before: 0, after: 60 },
    }));

    // Red accent line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 10, color: C.RED_ACCENT, space: 1 } },
    }));

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 600 } }));

    // Title
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'NON-DISCLOSURE AGREEMENT', font: self.FONT_HEADING, size: 56, bold: true, color: C.DARK_RED, characterSpacing: 30 }),
      ],
      spacing: { before: 0, after: 80 },
    }));

    // Dark red line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 16, color: C.DARK_RED, space: 1 } },
    }));

    // Subtitle
    elements.push(new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'Proprietary & Restricted Information Protection', font: self.FONT_HEADING, size: 28, color: C.TEXT_SECONDARY }),
      ],
      spacing: { before: 80, after: 0 },
    }));

    // Spacer
    elements.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '', size: 20 })], spacing: { before: 0, after: 0, line: 800 } }));

    // Info table
    var infoData = [
      ['EFFECTIVE DATE', effectiveDate],
      ['DURATION', '5 years'],
      ['', ''],
      ['DISCLOSING PARTIES', self.WS_NAME + ' / ' + self.OMD_NAME],
      ['RECEIVING PARTY', emp.full_name_lat || ''],
    ];

    var infoRows = infoData.map(function(pair) {
      var nb = self._noBorder();
      if (pair[0] === '') {
        return new docx.TableRow({
          children: [
            self._cell(self._para(self._text('')), {
              width: 2835,
              borders: { top: nb.top, bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY }, left: nb.left, right: nb.right },
              margins: { top: 20, bottom: 20, left: 0, right: 60 },
            }),
            self._cell(self._para(self._text('')), {
              width: 6521,
              borders: { top: nb.top, bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY }, left: nb.left, right: nb.right },
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
            self._para(self._text(pair[1], { bold: true }), { spacing: { before: 40, after: 40 } }),
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
        self._text('  CLASSIFICATION:  ', { font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        new docx.TextRun({
          text: '  STRICTLY CONFIDENTIAL  ',
          font: self.FONT_HEADING, size: 18, color: C.GOLD_LIGHT, bold: true,
          shading: { type: docx.ShadingType.CLEAR, fill: C.DARK_RED, color: C.DARK_RED },
        }),
      ],
      spacing: { before: 0, after: 0 },
    }));

    // Page break
    elements.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));

    return elements;
  },

  /* ═══════════════════════════════════════════════════════
     PREAMBLE + PARTIES TABLE
     ═══════════════════════════════════════════════════════ */
  _buildPreamble(emp) {
    var self = this;
    var C = self.COLORS;
    var nb = self._noneBorder();
    var effectiveDate = self._formatDateLong(emp.effective_date) || self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var dob = self._formatDateLong(emp.date_of_birth);
    var passIssued = self._formatDateLong(emp.passport_issued);
    var passExpires = self._formatDateLong(emp.passport_expires);

    var elements = [];

    // Preamble
    elements.push(new docx.Paragraph({
      children: [
        self._text('This Non-Disclosure Agreement ', { bold: true }),
        self._text('(the \u201cAgreement\u201d) is entered into as of '),
        self._text(effectiveDate, { bold: true }),
        self._text(' (the \u201cEffective Date\u201d).'),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 200, line: 276 },
    }));

    // BETWEEN:
    elements.push(new docx.Paragraph({
      children: [self._text('BETWEEN:', { font: self.FONT_HEADING, size: 24, color: C.CRIMSON, bold: true })],
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
    }));

    // Parties table
    var leftBorder = { style: docx.BorderStyle.SINGLE, size: 16, color: C.RED_ACCENT };

    var disclosingCell = self._cell([
      self._para(self._text('DISCLOSING PARTIES', { font: self.FONT_HEADING, size: 18, color: C.DEEP_RED, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(self.WS_NAME, { bold: true }), { spacing: { before: 0, after: 20 } }),
      self._para(self._text(self.WS_ADDRESS, { size: 18, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(self.OMD_NAME, { bold: true }), { spacing: { before: 0, after: 20 } }),
      self._para(self._text(self.OMD_ADDRESS, { size: 18, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4536,
      margins: { top: 80, bottom: 80, left: 160, right: 80 },
      shading: { type: docx.ShadingType.CLEAR, fill: C.PARTY_BG, color: C.PARTY_BG },
      borders: { top: nb, bottom: nb, left: leftBorder, right: nb },
    });

    var receivingCell = self._cell([
      self._para(self._text('RECEIVING PARTY', { font: self.FONT_HEADING, size: 18, color: C.DEEP_RED, bold: true }), { spacing: { before: 0, after: 60 } }),
      self._para(self._text(emp.full_name_lat || '', { bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(
        'Born: ' + dob + '\n' +
        'Passport: ' + (emp.passport_number || '') + '\n' +
        'Issued: ' + passIssued + '\n' +
        'Valid until: ' + passExpires + '\n' +
        (emp.address || ''),
        { size: 18, color: C.TEXT_SECONDARY }
      ), { spacing: { before: 0, after: 60 } }),
      self._para(self._text('(the \u201cReceiving Party\u201d)', { size: 20, color: C.TEXT_MUTED, italics: true }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 4820,
      margins: { top: 80, bottom: 80, left: 160, right: 80 },
      shading: { type: docx.ShadingType.CLEAR, fill: C.PARTY_BG, color: C.PARTY_BG },
      borders: { top: nb, bottom: nb, left: leftBorder, right: nb },
    });

    elements.push(new docx.Table({
      rows: [new docx.TableRow({ children: [disclosingCell, receivingCell] })],
      width: { size: 9356, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
    }));

    return elements;
  },

  /* ═══════════════════════════════════════════════════════
     RECITALS + SECTIONS
     ═══════════════════════════════════════════════════════ */
  _buildBody(emp) {
    var self = this;
    var C = self.COLORS;
    var effectiveDate = self._formatDateLong(emp.effective_date) || self._formatDateLong(emp.agreement_date) || self._formatDateLong(new Date().toISOString());
    var elements = [];

    // RECITALS
    elements.push(self._sectionHeading('RECITALS', null));
    elements.push(self._bodyPara('WHEREAS, the Company is engaged in the research, development, design, and production of Unmanned Aerial Vehicles (\u201cUAVs\u201d), Radio-Electronic Systems, and related defense and dual-use technologies;'));
    elements.push(self._bodyPara('WHEREAS, the Receiving Party possesses specialized technical expertise and has entered into a Consulting Agreement with the Company dated ' + effectiveDate + ' to provide engineering and technical services;'));
    elements.push(self._bodyPara('WHEREAS, in the course of the engagement, the Parties anticipate that the Company may disclose or provide access to certain proprietary, confidential, and trade secret information to the Receiving Party;'));

    // NOW THEREFORE
    elements.push(new docx.Paragraph({
      children: [
        self._text('NOW, THEREFORE, ', { bold: true }),
        self._text('in consideration of the mutual covenants contained herein, the Parties agree as follows:'),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 100, after: 200, line: 276 },
    }));

    var sn = 1;

    // 1. DEFINITIONS
    elements.push(self._sectionHeading('DEFINITIONS', sn)); sn++;
    elements.push(self._subPara('\u201cCompany\u201d shall mean Woodenshark LLC and OMD Systems Inc, collectively, as the Disclosing Parties under this Agreement.', '1.1'));
    elements.push(self._subPara('\u201cConfidential Information\u201d shall mean any and all non-public, proprietary, or trade secret information, whether in oral, written, electronic, visual, or any other form, that is disclosed by or on behalf of the Company to the Receiving Party, including but not limited to the categories set forth in Section 2.', '1.2'));
    elements.push(self._subPara('\u201cReceiving Party\u201d shall mean the Party receiving Confidential Information.', '1.3'));
    elements.push(self._subPara('\u201cRepresentatives\u201d shall mean officers, directors, employees, agents, contractors, advisors, attorneys, and accountants who have a legitimate need to know the Confidential Information and who are bound by obligations of confidentiality no less restrictive than those set forth herein.', '1.4'));
    elements.push(self._subPara('\u201cPurpose\u201d shall mean the evaluation, performance, and administration of the Consulting Agreement, including research, design, development, engineering, testing, and production of UAV systems, Radio-Electronic Warfare systems, embedded firmware, flight control systems, and related defense technologies.', '1.5'));
    elements.push(self._subPara('\u201cMaterials\u201d shall mean all tangible and intangible embodiments of Confidential Information, including documents, drawings, schematics, prototypes, source code, firmware, datasets, reports, and any copies or derivatives thereof.', '1.6'));
    elements.push(self._subPara('\u201cTrade Secrets\u201d shall mean any information that derives independent economic value from not being generally known to or readily ascertainable by other persons, and is the subject of reasonable efforts to maintain its secrecy, as defined under the Delaware Uniform Trade Secrets Act and the Defend Trade Secrets Act of 2016.', '1.7'));

    // 2. CONFIDENTIAL INFORMATION
    elements.push(self._sectionHeading('CONFIDENTIAL INFORMATION', sn)); sn++;
    elements.push(self._bodyPara('Confidential Information includes, without limitation, the following categories:'));
    elements.push(self._subPara('Technical Information: designs, drawings, engineering specifications, schematics, PCB layouts, CAD/CAM files, algorithms, formulas, processes, inventions, research data, test data, flight test logs, telemetry data, and technical know-how;', '(a)'));
    elements.push(self._subPara('Software and Firmware: source code, object code, firmware images, APIs, communication protocols, encryption keys, flight control algorithms, navigation algorithms, and related documentation;', '(b)'));
    elements.push(self._subPara('Product Information: prototypes, product specifications, product roadmaps, production processes, manufacturing techniques, bill of materials, and supply chain data;', '(c)'));
    elements.push(self._subPara('Business Information: business plans, strategies, pricing, financial data, customer lists, supplier lists, contract terms, and partnership discussions;', '(d)'));
    elements.push(self._subPara('Defense and Military Information: information related to defense applications, military specifications, electronic warfare parameters, frequency data, signal characteristics, and any information subject to export control regulations including ITAR and EAR;', '(e)'));
    elements.push(self._subPara('Intellectual Property: patent applications, invention disclosures, trade secrets, trademarks, copyrights, and any other proprietary rights.', '(f)'));
    elements.push(self._bodyPara('Confidential Information need not be marked as \u201cconfidential\u201d to be protected under this Agreement. Information disclosed orally shall be considered Confidential Information if it would reasonably be understood to be confidential given the nature of the information and the circumstances of disclosure.'));

    // 3. OBLIGATIONS
    elements.push(self._sectionHeading('OBLIGATIONS OF RECEIVING PARTY', sn)); sn++;
    elements.push(self._subPara('The Receiving Party shall not, without the prior written consent of the Disclosing Party, disclose, publish, or otherwise make available any Confidential Information to any third party, except to its Representatives in accordance with this Agreement.', '3.1'));
    elements.push(self._subPara('The Receiving Party shall protect the Confidential Information using at least the same degree of care that it uses to protect its own confidential information, but in no event less than a reasonable degree of care.', '3.2'));
    elements.push(self._subPara('The Receiving Party shall use the Confidential Information solely for the Purpose and shall not use it for any other purpose, including reverse engineering, competitive analysis, or development of competing products.', '3.3'));
    elements.push(self._subPara('The Receiving Party shall not reverse engineer, disassemble, decompile, or otherwise attempt to derive the composition, structure, or underlying ideas of any Confidential Information, including prototypes, hardware, software, or firmware.', '3.4'));
    elements.push(self._subPara('The Receiving Party shall use encrypted communications when transmitting Confidential Information electronically, use strong passwords and multi-factor authentication, and not store Confidential Information on unsecured personal devices or public cloud services without prior written consent.', '3.5'));
    elements.push(self._subPara('The Receiving Party shall promptly notify the Disclosing Party in writing of any actual or suspected unauthorized access, disclosure, or loss of Confidential Information.', '3.6'));
    elements.push(self._subPara('If the Receiving Party becomes legally compelled by judicial or administrative order, subpoena, or other legal process to disclose any Confidential Information, the Receiving Party shall: (i) provide the Disclosing Party with prompt written notice, to the extent legally permitted, so that the Disclosing Party may seek a protective order or other appropriate remedy; (ii) cooperate with the Disclosing Party in seeking such protective measures; and (iii) disclose only the minimum portion of Confidential Information that is legally required.', '3.7'));

    // 4. EXCLUSIONS
    elements.push(self._sectionHeading('EXCLUSIONS FROM CONFIDENTIAL INFORMATION', sn)); sn++;
    elements.push(self._bodyPara('The obligations of confidentiality shall not apply to information that the Receiving Party can demonstrate by clear and convincing evidence:'));
    elements.push(self._subPara('was already in the public domain at the time of disclosure through no fault of the Receiving Party;', '(a)'));
    elements.push(self._subPara('becomes publicly available after disclosure through no fault of the Receiving Party;', '(b)'));
    elements.push(self._subPara('was rightfully in the Receiving Party\u2019s possession prior to disclosure, as documented by contemporaneous written records;', '(c)'));
    elements.push(self._subPara('is rightfully obtained from a third party without obligation of confidentiality;', '(d)'));
    elements.push(self._subPara('is independently developed without reference to or use of the Confidential Information.', '(e)'));

    // 5. TERM AND TERMINATION
    elements.push(self._sectionHeading('TERM AND TERMINATION', sn)); sn++;
    elements.push(self._subPara('This Agreement shall commence on the Effective Date and shall remain in full force and effect for a period of five (5) years, unless earlier terminated.', '5.1'));
    elements.push(self._subPara('Either Party may terminate this Agreement by providing thirty (30) days\u2019 prior written notice.', '5.2'));
    elements.push(self._subPara('The obligations of confidentiality shall survive for a period of five (5) years following expiration or termination. With respect to Trade Secrets, the obligations shall survive for as long as such information remains a Trade Secret.', '5.3'));
    elements.push(self._subPara('Upon termination, the Receiving Party shall immediately cease all use of the Confidential Information and comply with the return obligations set forth in Section 6.', '5.4'));

    // 6. RETURN OF MATERIALS
    elements.push(self._sectionHeading('RETURN OF MATERIALS', sn)); sn++;
    elements.push(self._subPara('Upon expiration, termination, or written request, the Receiving Party shall promptly return or destroy all Materials containing Confidential Information and provide written certification of destruction within fifteen (15) business days.', '6.1'));
    elements.push(self._subPara('For electronically stored Confidential Information, the Receiving Party shall employ secure deletion methods (multi-pass overwrite, degaussing, or physical destruction of storage media).', '6.2'));
    elements.push(self._subPara('The Receiving Party may retain one archival copy solely for compliance with applicable law, provided it remains subject to all confidentiality obligations.', '6.3'));

    // 7. REMEDIES
    elements.push(self._sectionHeading('REMEDIES', sn)); sn++;

    // Warning callout box
    elements.push(new docx.Paragraph({
      children: [
        self._text('The Parties acknowledge that any breach may cause irreparable injury for which monetary damages would be inadequate. ', { bold: true }),
        self._text('The Disclosing Party shall be entitled to seek immediate injunctive relief without the necessity of proving actual damages or posting a bond.'),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 80, line: 276 },
      border: {
        left: { style: docx.BorderStyle.SINGLE, size: 24, color: C.RED_ACCENT, space: 8 },
        top: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 4 },
        bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 4 },
        right: { style: docx.BorderStyle.SINGLE, size: 4, color: C.LIGHT_GRAY, space: 4 },
      },
      shading: { type: docx.ShadingType.CLEAR, fill: C.RED_TINT, color: C.RED_TINT },
      indent: { left: 120 },
    }));

    elements.push(self._subPara('The rights and remedies are cumulative and in addition to any other rights available at law or in equity, including claims for damages, an accounting of profits, and recovery of attorneys\u2019 fees.', '7.1'));
    elements.push(self._subPara('The Receiving Party shall indemnify and hold harmless the Disclosing Party from all claims, damages, losses, and expenses arising from any breach of this Agreement.', '7.2'));

    // 8. NON-SOLICITATION
    elements.push(self._sectionHeading('NON-SOLICITATION', sn)); sn++;
    elements.push(self._bodyPara('During the term and for two (2) years following termination, the Receiving Party shall not use Confidential Information to directly or indirectly solicit, recruit, or hire any employee, contractor, or key personnel of the Company, or to solicit or divert any client, customer, supplier, or business partner of the Company.'));

    // 9. INTELLECTUAL PROPERTY
    elements.push(self._sectionHeading('INTELLECTUAL PROPERTY', sn)); sn++;
    elements.push(self._subPara('Nothing in this Agreement grants the Receiving Party any right, title, or interest in the Confidential Information or any intellectual property of the Disclosing Party.', '9.1'));
    elements.push(self._subPara('Any inventions or work product created using the Company\u2019s Confidential Information shall be governed by the Consulting Agreement and shall be the sole property of the Company.', '9.2'));
    elements.push(self._subPara('ALL CONFIDENTIAL INFORMATION IS PROVIDED \u201cAS IS.\u201d NEITHER PARTY MAKES ANY WARRANTY WITH RESPECT TO THE ACCURACY, COMPLETENESS, OR FITNESS FOR A PARTICULAR PURPOSE OF ANY CONFIDENTIAL INFORMATION.', '9.3'));

    // 10. GOVERNING LAW
    elements.push(self._sectionHeading('GOVERNING LAW AND JURISDICTION', sn)); sn++;
    elements.push(self._subPara('This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of laws principles.', '10.1'));
    elements.push(self._subPara('The Parties submit to the exclusive jurisdiction of the courts of the State of Delaware. Each Party waives any objection to venue.', '10.2'));
    elements.push(self._subPara('In any action to enforce this Agreement, the prevailing Party shall be entitled to recover reasonable attorneys\u2019 fees and costs.', '10.3'));

    // 11. GENERAL PROVISIONS
    elements.push(self._sectionHeading('GENERAL PROVISIONS', sn)); sn++;
    elements.push(self._subPara('All notices shall be in writing, delivered personally, by registered mail, or by recognized courier service to the addresses set forth herein.', '11.1'));
    elements.push(self._subPara('Neither Party may assign this Agreement without prior written consent, except that the Company may assign to a successor entity in connection with a merger or acquisition.', '11.2'));
    elements.push(self._subPara('No failure or delay in exercising any right shall operate as a waiver thereof.', '11.3'));
    elements.push(self._subPara('If any provision is held invalid, it shall be modified to the minimum extent necessary; the remaining provisions shall continue in full force.', '11.4'));
    elements.push(self._subPara('This Agreement may not be amended except by a written instrument signed by all Parties.', '11.5'));
    elements.push(self._subPara('The Receiving Party acknowledges that certain Confidential Information may be subject to ITAR and EAR export control regulations and agrees to comply with all applicable export control laws.', '11.6'));
    elements.push(self._subPara('No Party shall issue any public disclosure regarding this Agreement without the prior written consent of the other Parties.', '11.7'));
    elements.push(self._subPara('This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic signatures and PDF copies shall be deemed originals for all purposes.', '11.8'));

    // 12. ENTIRE AGREEMENT
    elements.push(self._sectionHeading('ENTIRE AGREEMENT', sn)); sn++;
    elements.push(self._bodyPara('This Agreement, together with the Consulting Agreement dated ' + effectiveDate + ', constitutes the entire agreement between the Parties with respect to the subject matter hereof. In the event of any conflict regarding Confidential Information, the more restrictive provision shall prevail.'));

    return elements;
  },

  /* ═══════════════════════════════════════════════════════
     SIGNATURE BLOCK (3 parties)
     ═══════════════════════════════════════════════════════ */
  _buildSignatureBlock(emp) {
    var self = this;
    var C = self.COLORS;
    var nb = self._noneBorder();
    var topBorder = { style: docx.BorderStyle.SINGLE, size: 8, color: C.RED_ACCENT };
    var elements = [];

    // Heavy line
    elements.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: '', size: 4 })],
      spacing: { before: 0, after: 0, line: 60 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 16, color: C.DARK_RED, space: 1 } },
    }));

    // IN WITNESS WHEREOF
    elements.push(new docx.Paragraph({
      children: [
        self._text('IN WITNESS WHEREOF, ', { bold: true, italics: true }),
        self._text('the Parties have executed this Non-Disclosure Agreement as of the Effective Date first written above.', { italics: true }),
      ],
      alignment: docx.AlignmentType.JUSTIFIED,
      spacing: { before: 240, after: 240, line: 276 },
    }));

    // Build signature cells
    var buildSigCell = function(title, details, nameLabel, width) {
      return self._cell([
        self._para(self._text(title, { font: self.FONT_HEADING, size: 16, color: C.DEEP_RED, bold: true }), { spacing: { before: 0, after: 40 } }),
        self._para(self._text(details, { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 160 } }),
        self._para(self._text('________________________', { size: 20, color: C.DARK_RED }), { spacing: { before: 0, after: 20 } }),
        self._para(self._text('Signature', { font: self.FONT_HEADING, size: 14, color: C.TEXT_MUTED }), { spacing: { before: 0, after: 80 } }),
        self._para(self._text('Name: ' + nameLabel, { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 40 } }),
        self._para(self._text('Title: ____________________', { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 40 } }),
        self._para(self._text('Date: ____________________', { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 0 } }),
      ], {
        width: width,
        margins: { top: 80, bottom: 40, left: 60, right: 40 },
        borders: { top: topBorder, bottom: nb, left: nb, right: nb },
      });
    };

    var wsCell = buildSigCell(
      'WOODENSHARK LLC',
      '3411 Silverside Road\nSuite 104, Wilmington\nDE 19810, USA',
      '____________________',
      3119
    );

    var omdCell = buildSigCell(
      'OMD SYSTEMS INC',
      '836 Corriente Pointe Dr\nRedwood City\nCA 94065, USA',
      '____________________',
      3119
    );

    var empCell = self._cell([
      self._para(self._text('RECEIVING PARTY', { font: self.FONT_HEADING, size: 16, color: C.DEEP_RED, bold: true }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text(emp.full_name_lat || '', { size: 18, bold: true }), { spacing: { before: 0, after: 20 } }),
      self._para(self._text(
        'Passport: ' + (emp.passport_number || '') + '\n' +
        (emp.work_email || ''),
        { size: 16, color: C.TEXT_SECONDARY }
      ), { spacing: { before: 0, after: 120 } }),
      self._para(self._text('________________________', { size: 20, color: C.DARK_RED }), { spacing: { before: 0, after: 20 } }),
      self._para(self._text('Signature', { font: self.FONT_HEADING, size: 14, color: C.TEXT_MUTED }), { spacing: { before: 0, after: 80 } }),
      self._para(self._text('Name: ' + (emp.full_name_lat || ''), { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 40 } }),
      self._para(self._text('Date: ____________________', { size: 16, color: C.TEXT_SECONDARY }), { spacing: { before: 0, after: 0 } }),
    ], {
      width: 3118,
      margins: { top: 80, bottom: 40, left: 60, right: 40 },
      borders: { top: topBorder, bottom: nb, left: nb, right: nb },
    });

    elements.push(new docx.Table({
      rows: [new docx.TableRow({ children: [wsCell, omdCell, empCell] })],
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

    var children = [];
    children = children.concat(self._buildTitlePage(emp));
    children = children.concat(self._buildPreamble(emp));
    children = children.concat(self._buildBody(emp));
    children = children.concat(self._buildSignatureBlock(emp));

    // Header
    var headerChildren = [
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: 'STRICTLY CONFIDENTIAL  \u2014  PROPRIETARY & RESTRICTED',
            font: self.FONT_HEADING, size: 15, color: C.GOLD_LIGHT, bold: true,
            characterSpacing: 50,
          }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 320 },
        shading: { type: docx.ShadingType.CLEAR, fill: C.DARK_RED, color: C.DARK_RED },
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: 'OMD SYSTEMS', font: self.FONT_HEADING, size: 16, color: C.CRIMSON, bold: true }),
          new docx.TextRun({ text: '                                                                                           ', font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
          new docx.TextRun({ text: 'Non-Disclosure Agreement', font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        ],
        spacing: { before: 60, after: 40 },
        border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: C.RED_ACCENT, space: 1 } },
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
          new docx.TextRun({ children: ['Non-Disclosure Agreement  |  STRICTLY CONFIDENTIAL  |  Page ', docx.PageNumber.CURRENT, ' of ', docx.PageNumber.TOTAL_PAGES], font: self.FONT_HEADING, size: 16, color: C.TEXT_MUTED }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: 'STRICTLY CONFIDENTIAL  \u2014  PROPRIETARY & RESTRICTED',
            font: self.FONT_HEADING, size: 14, color: C.GOLD_LIGHT, bold: true,
            characterSpacing: 50,
          }),
        ],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 40, after: 0, line: 280 },
        shading: { type: docx.ShadingType.CLEAR, fill: C.DARK_RED, color: C.DARK_RED },
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
    return 'NDA ' + name + '.docx';
  },
};
