/* ═══════════════════════════════════════════════════════
   ContractPdf — Consulting Agreement PDF Generator
   HTML → html2canvas → jsPDF (replaces contract-docx.js)
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

var ContractPdf = {

  COLORS: {
    NAVY:           '#0A0E17',
    DARK:           '#0D1117',
    CYAN:           '#00BCD4',
    CYAN_DARK:      '#0097A7',
    TEXT_PRIMARY:   '#1A1A1A',
    TEXT_SECONDARY: '#4A4A4A',
    TEXT_MUTED:     '#6B6B6B',
    LIGHT_GRAY:     '#D0D0D0',
    ALT_ROW:        '#F4F6F8',
    CYAN_TINT:      '#E8F5F7',
    WHITE:          '#FFFFFF',
    FAFBFC:         '#FAFBFC',
  },

  CLIENT_NAME:    'Woodenshark LLC',
  CLIENT_ADDRESS: '3411 Silverside Road, Suite 104\nRodney Building, Wilmington, DE, 19810',
  CLIENT_SWIFT:   'CMFGUS33',
  CLIENT_ACCOUNT: '822000034828',
  CLIENT_BANK:    'Wise Inc',

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

  SECTIONS: [
    { title: 'SERVICES PROVIDED', paragraphs: [
      'The Client hereby agrees to engage a Consultant to provide the Client with the following consulting services (the \u201cServices\u201d):',
      null,
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
      null,
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
      null,
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

  validateFields: function (emp) {
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

  _numberToWords: function (n) {
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

  renderHTML: function (emp) {
    var self = this;
    var esc = PdfUtils.esc;
    var fmtDate = PdfUtils.formatDateLong;
    var C = self.COLORS;

    var agreementDate = fmtDate(emp.agreement_date) || fmtDate(new Date().toISOString());
    var effectiveDate = fmtDate(emp.effective_date) || agreementDate;
    var dob = fmtDate(emp.date_of_birth);
    var passIssued = fmtDate(emp.passport_issued);
    var passExpires = fmtDate(emp.passport_expires);

    var rate = parseFloat(emp.rate_usd) || 0;
    var taxRate = 0.06;
    var totalWithTax = Math.round(rate * (1 + taxRate));
    var rateWords = self._numberToWords(rate);
    var totalWords = self._numberToWords(totalWithTax);
    var rateFmt = rate.toLocaleString('en-US', { maximumFractionDigits: 0 });
    var totalFmt = totalWithTax.toLocaleString('en-US', { maximumFractionDigits: 0 });

    var html = '';

    // ── CSS ──
    html += '<style>' +
      'body,div,p,td,th{margin:0;padding:0;font-family:Cambria,Calibri,serif;color:#1A1A1A;font-size:10.5pt;line-height:1.45;}' +
      '.title-page{page-break-after:always;min-height:680px;padding:20px 0;}' +
      '.brand{font-family:Calibri,sans-serif;font-size:32pt;font-weight:700;margin-bottom:6px;}' +
      '.brand .w{color:' + C.NAVY + ';}' +
      '.brand .llc{color:' + C.CYAN_DARK + ';}' +
      '.cyan-line{height:4px;background:' + C.CYAN + ';margin-bottom:40px;}' +
      '.doc-title{font-family:Calibri,sans-serif;font-size:28pt;font-weight:700;color:' + C.NAVY + ';letter-spacing:3px;margin-bottom:6px;}' +
      '.navy-line{height:6px;background:' + C.NAVY + ';margin-bottom:8px;}' +
      '.subtitle{font-family:Calibri,sans-serif;font-size:14pt;color:' + C.TEXT_SECONDARY + ';margin-bottom:40px;}' +
      '.info-tbl{border-collapse:collapse;width:100%;margin-bottom:40px;}' +
      '.info-tbl td{padding:5px 8px;vertical-align:top;border:none;}' +
      '.info-tbl .lbl{font-family:Calibri,sans-serif;font-size:8.5pt;color:' + C.TEXT_MUTED + ';width:140px;}' +
      '.info-tbl .val{font-weight:700;}' +
      '.info-tbl .sep td{border-bottom:1px solid ' + C.LIGHT_GRAY + ';padding:3px 0;}' +
      '.classification{font-family:Calibri,sans-serif;font-size:9pt;}' +
      '.classification .badge{background:' + C.NAVY + ';color:#fff;font-weight:700;padding:2px 8px;font-size:9pt;}' +
      '.hdr-bar{background:' + C.NAVY + ';color:#fff;text-align:center;font-family:Calibri,sans-serif;font-size:7.5pt;font-weight:700;letter-spacing:4px;padding:4px 0;margin-bottom:4px;}' +
      '.hdr-line{display:flex;justify-content:space-between;font-family:Calibri,sans-serif;font-size:8pt;border-bottom:2px solid ' + C.CYAN + ';padding-bottom:4px;margin-bottom:16px;}' +
      '.hdr-line .co{color:' + C.DARK + ';font-weight:700;}' +
      '.hdr-line .dt{color:' + C.TEXT_MUTED + ';}' +
      '.preamble{text-align:justify;margin-bottom:12px;}' +
      '.between{text-align:center;font-family:Calibri,sans-serif;font-size:12pt;color:' + C.DARK + ';font-weight:700;margin:12px 0;}' +
      '.parties{display:flex;gap:16px;margin-bottom:16px;}' +
      '.party-box{flex:1;background:' + C.FAFBFC + ';border-left:5px solid ' + C.CYAN + ';padding:12px 14px;}' +
      '.party-label{font-family:Calibri,sans-serif;font-size:9pt;color:' + C.CYAN_DARK + ';font-weight:700;margin-bottom:6px;}' +
      '.party-name{font-weight:700;margin-bottom:4px;}' +
      '.party-addr{font-size:10pt;color:' + C.TEXT_SECONDARY + ';}' +
      '.party-role{font-size:10pt;color:' + C.TEXT_MUTED + ';font-style:italic;margin-top:6px;}' +
      '.bg-heading{font-family:Calibri,sans-serif;font-size:13pt;font-weight:700;color:' + C.DARK + ';border-bottom:3px solid ' + C.CYAN + ';padding-bottom:3px;margin-top:20px;margin-bottom:8px;}' +
      '.bg-heading .num{color:' + C.CYAN + ';}' +
      '.sec-heading{font-family:Calibri,sans-serif;font-size:13pt;font-weight:700;color:' + C.DARK + ';border-bottom:3px solid ' + C.CYAN + ';padding-bottom:3px;margin-top:22px;margin-bottom:8px;}' +
      '.sec-heading .num{color:' + C.CYAN + ';}' +
      '.body-para{text-align:justify;margin-bottom:6px;}' +
      '.callout{background:' + C.CYAN_TINT + ';border-left:6px solid ' + C.CYAN + ';border:1px solid ' + C.LIGHT_GRAY + ';border-left:6px solid ' + C.CYAN + ';padding:10px 14px;text-align:center;font-family:Calibri,sans-serif;font-size:13pt;font-weight:700;color:' + C.DARK + ';margin:8px 0;}' +
      '.notice-box{border-bottom:1px solid ' + C.LIGHT_GRAY + ';padding:6px 12px;margin-bottom:4px;}' +
      '.notice-box .nm{font-weight:700;}' +
      '.notice-box .ct{color:' + C.TEXT_SECONDARY + ';}' +
      '.in-consideration{text-align:justify;margin-top:12px;margin-bottom:8px;}' +
      '.sig-line{height:6px;background:' + C.NAVY + ';margin-top:24px;margin-bottom:16px;}' +
      '.witness{text-align:justify;font-style:italic;margin-bottom:16px;}' +
      '.sig-table{display:flex;gap:16px;}' +
      '.sig-cell{flex:1;border-top:3px solid ' + C.CYAN + ';padding-top:10px;}' +
      '.sig-label{font-family:Calibri,sans-serif;font-size:9pt;color:' + C.CYAN_DARK + ';font-weight:700;margin-bottom:6px;}' +
      '.sig-name{font-weight:700;margin-bottom:4px;}' +
      '.sig-detail{font-size:9pt;color:' + C.TEXT_SECONDARY + ';margin-bottom:2px;}' +
      '.sig-bank{font-family:Calibri,sans-serif;font-size:9pt;color:' + C.TEXT_MUTED + ';font-weight:700;margin-top:6px;margin-bottom:2px;}' +
      '.sig-underline{color:' + C.NAVY + ';margin-top:16px;margin-bottom:2px;}' +
      '.sig-caption{font-family:Calibri,sans-serif;font-size:8pt;color:' + C.TEXT_MUTED + ';}' +
      '.ftr-bar{background:' + C.NAVY + ';color:#fff;text-align:center;font-family:Calibri,sans-serif;font-size:7pt;font-weight:700;letter-spacing:4px;padding:3px 0;margin-top:20px;}' +
    '</style>';

    // ── TITLE PAGE ──
    html += '<div class="title-page">';
    html += '<div style="height:30px;"></div>';
    html += '<div class="brand"><span class="w">WOODENSHARK</span><span class="llc"> LLC</span></div>';
    html += '<div class="cyan-line"></div>';
    html += '<div style="height:20px;"></div>';
    html += '<div class="doc-title">CONSULTING AGREEMENT</div>';
    html += '<div class="navy-line"></div>';
    html += '<div class="subtitle">Professional Services &amp; Technical Consulting</div>';

    html += '<table class="info-tbl">';
    html += '<tr><td class="lbl">AGREEMENT DATE</td><td class="val">' + esc(agreementDate) + '</td></tr>';
    html += '<tr><td class="lbl">EFFECTIVE DATE</td><td class="val">' + esc(effectiveDate) + '</td></tr>';
    html += '<tr class="sep"><td></td><td></td></tr>';
    html += '<tr><td class="lbl">PARTY A (CLIENT)</td><td class="val">' + esc(self.CLIENT_NAME) + '</td></tr>';
    html += '<tr><td class="lbl">PARTY B (CONSULTANT)</td><td class="val">' + esc(emp.full_name_lat || '') + '</td></tr>';
    html += '</table>';

    html += '<div class="classification"><span style="color:' + C.TEXT_MUTED + ';">CLASSIFICATION: </span><span class="badge">CONFIDENTIAL</span></div>';
    html += '</div>';

    // ── HEADER BAR ──
    html += '<div class="hdr-bar">CONFIDENTIAL &mdash; WOODENSHARK LLC PROPRIETARY</div>';
    html += '<div class="hdr-line"><span class="co">WOODENSHARK LLC</span><span class="dt">Consulting Agreement</span></div>';

    // ── PREAMBLE ──
    html += '<div class="preamble"><b>THIS CONSULTING AGREEMENT</b> (the \u201cAgreement\u201d) dated <b>' + esc(agreementDate) + '</b></div>';
    html += '<div class="between">BETWEEN:</div>';

    // Parties
    html += '<div class="parties">';
    html += '<div class="party-box">';
    html += '<div class="party-label">CLIENT</div>';
    html += '<div class="party-name">' + esc(self.CLIENT_NAME) + '</div>';
    html += '<div class="party-addr">' + PdfUtils.nlToBr(esc(self.CLIENT_ADDRESS)) + '</div>';
    html += '<div class="party-role">(the \u201cClient\u201d)</div>';
    html += '</div>';
    html += '<div class="party-box">';
    html += '<div class="party-label">CONSULTANT</div>';
    html += '<div class="party-name">' + esc(emp.full_name_lat || '') + '</div>';
    html += '<div class="party-addr">' + esc(emp.address || '') + '</div>';
    html += '<div class="party-role">(the \u201cConsultant\u201d)</div>';
    html += '</div>';
    html += '</div>';

    // ── BACKGROUND (Section 1) ──
    html += '<div class="bg-heading"><span class="num">1. </span>BACKGROUND</div>';
    html += '<div class="body-para">The Client is of the opinion that the Consultant has the necessary qualifications, experience and abilities to provide consulting services to the Client.</div>';
    html += '<div class="body-para">The Consultant agrees to provide such consulting services to the Client on the terms and conditions set out in this Agreement.</div>';
    html += '<div class="body-para">This Consulting Agreement (hereinafter the \u201cAgreement\u201d) states the terms and conditions that govern the contractual agreement by and between</div>';

    html += '<div class="body-para"><b>' + esc(self.CLIENT_NAME) + '</b>, a company incorporated and registered in the United States of America whose registered office is at ' + esc(self.CLIENT_ADDRESS.replace(/\n/g, ', ')) + ' <b>(hereinafter the \u201cClient\u201d)</b></div>';

    html += '<div class="body-para"><b>' + esc(emp.full_name_lat || '') + '</b>, with the date of birth <b>' + esc(dob) + '</b>, the holder of Ukrainian Foreign Passport \u2116 <b>' + esc(emp.passport_number || '') + '</b> issued on <b>' + esc(passIssued) + '</b> and valid till <b>' + esc(passExpires) + '</b>, with the primary address of residence <b>' + esc(emp.address || '') + '</b></div>';

    html += '<div class="in-consideration"><b>IN CONSIDERATION OF</b> the matters described above and of the mutual benefits and obligations set forth in this Agreement, the receipt and sufficiency of which consideration is hereby acknowledged, the Client and the Consultant (individually, the \u201cParty\u201d and collectively the \u201cParties\u201d to this Agreement) agree as follows:</div>';

    // ── SECTIONS ──
    var sn = 2;
    for (var s = 0; s < self.SECTIONS.length; s++) {
      var sec = self.SECTIONS[s];
      html += '<div class="sec-heading"><span class="num">' + sn + '. </span>' + esc(sec.title) + '</div>';

      for (var p = 0; p < sec.paragraphs.length; p++) {
        var text = sec.paragraphs[p];
        if (text === null) {
          if (sec.title === 'SERVICES PROVIDED') {
            html += '<div class="callout">' + esc(emp.service_description || 'UAV Systems Development Services') + '</div>';
          } else if (sec.title === 'NOTICE') {
            html += '<div class="notice-box"><span class="nm">' + esc(self.CLIENT_NAME) + '</span>, <span class="ct">mitgor@woodenshark.com</span></div>';
            html += '<div class="notice-box"><span class="nm">' + esc(emp.full_name_lat || '') + '</span>, <span class="ct">' + esc(emp.work_email || emp.phone || '') + '</span></div>';
          } else if (sec.title === 'COMPENSATION') {
            html += '<div class="body-para">The Consultant will charge the Client for the Services at the rate of ' + rateFmt + ' (' + rateWords + ') USD plus 6% tax, totaling ' + totalFmt + ' (' + totalWords + ') USD per month (the \u201cCompensation\u201d) for full time employment.</div>';
          }
          continue;
        }
        html += '<div class="body-para">' + esc(text) + '</div>';
      }
      sn++;
    }

    // ── SIGNATURE BLOCK ──
    html += '<div class="sig-line"></div>';
    html += '<div class="witness"><b>IN WITNESS WHEREOF</b> the Parties have duly affixed their signatures under hand and seal on <b>' + esc(effectiveDate) + '</b>.</div>';

    html += '<div class="sig-table">';

    // Client signature
    html += '<div class="sig-cell">';
    html += '<div class="sig-label">CLIENT</div>';
    html += '<div class="sig-name">' + esc(self.CLIENT_NAME) + '</div>';
    html += '<div class="sig-detail">' + PdfUtils.nlToBr(esc(self.CLIENT_ADDRESS)) + '</div>';
    html += '<div class="sig-bank">Bank account:</div>';
    html += '<div class="sig-detail">SWIFT: <b>' + esc(self.CLIENT_SWIFT) + '</b></div>';
    html += '<div class="sig-detail">Account: <b>' + esc(self.CLIENT_ACCOUNT) + '</b></div>';
    html += '<div class="sig-detail">' + esc(self.CLIENT_BANK) + '</div>';
    html += '<div class="sig-underline">____________________________</div>';
    html += '<div class="sig-caption">Signature</div>';
    html += '</div>';

    // Consultant signature
    html += '<div class="sig-cell">';
    html += '<div class="sig-label">CONSULTANT</div>';
    html += '<div class="sig-name">' + esc(emp.full_name_lat || '') + '</div>';
    html += '<div class="sig-detail">' + esc(emp.address || '') + '</div>';
    html += '<div class="sig-bank">Bank account:</div>';
    html += '<div class="sig-detail">IBAN: <b>' + esc(emp.iban || '') + '</b></div>';
    html += '<div class="sig-detail">SWIFT/BIC: <b>' + esc(emp.swift || '') + '</b></div>';
    html += '<div class="sig-detail">Receiver: <b>' + esc(emp.receiver_name || '') + '</b></div>';
    html += '<div class="sig-underline">____________________________</div>';
    html += '<div class="sig-caption">' + esc(emp.full_name_lat || '') + '</div>';
    html += '</div>';

    html += '</div>';

    // Footer bar
    html += '<div class="ftr-bar">CONFIDENTIAL &mdash; WOODENSHARK LLC PROPRIETARY</div>';

    return html;
  },

  async generate(emp) {
    var html = this.renderHTML(emp);
    var ownerPassword = 'WS-' + emp.id.slice(0, 8) + '-' + Date.now();
    return PdfUtils.renderToPdf(html, {
      ownerPassword: ownerPassword,
      watermark: 'WOODENSHARK LLC CONFIDENTIAL'
    });
  },

  getFileName: function (emp) {
    var name = (emp.full_name_lat || 'Unknown').replace(/\s+/g, ' ').trim();
    return 'Consulting Agreement ' + name + '.pdf';
  },
};
