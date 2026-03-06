/* ═══════════════════════════════════════════════════════
   NdaPdf — Non-Disclosure Agreement PDF Generator
   HTML → html2canvas → jsPDF (replaces nda-docx.js)
   Invoice Platform · Woodenshark
   ═══════════════════════════════════════════════════════ */

var NdaPdf = {

  COLORS: {
    DARK_RED:       '#1A0000',
    CRIMSON:        '#8B0000',
    RED_ACCENT:     '#C62828',
    DEEP_RED:       '#7B1A1A',
    GOLD:           '#B8860B',
    GOLD_LIGHT:     '#D4A017',
    TEXT_PRIMARY:   '#1A1A1A',
    TEXT_SECONDARY: '#4A4A4A',
    TEXT_MUTED:     '#6B6B6B',
    LIGHT_GRAY:     '#D0D0D0',
    RED_TINT:       '#FDF2F2',
    WHITE:          '#FFFFFF',
    PARTY_BG:       '#FBF5F5',
  },

  WS_NAME:      'Woodenshark LLC',
  WS_ADDRESS:   '3411 Silverside Road, Suite 104\nWilmington, DE 19810, USA',

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

  validateFields: function (emp) {
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

  renderHTML: function (emp) {
    var self = this;
    var esc = PdfUtils.esc;
    var fmtDate = PdfUtils.formatDateLong;
    var C = self.COLORS;
    var titleH = PdfUtils.PAGE_HEIGHT_PX - PdfUtils.WRAPPER_PAD;

    var effectiveDate = fmtDate(emp.effective_date) || fmtDate(emp.agreement_date) || fmtDate(new Date().toISOString());
    var dob = fmtDate(emp.date_of_birth);
    var passIssued = fmtDate(emp.passport_issued);
    var passExpires = fmtDate(emp.passport_expires);

    var html = '';

    // ── CSS ──
    html += '<style>' +
      'body,div,p,td,th{margin:0;padding:0;font-family:Cambria,Georgia,Calibri,serif;color:#1A1A1A;font-size:11pt;line-height:1.2;}' +
      '.title-page{height:' + titleH + 'px;display:flex;flex-direction:column;overflow:hidden;padding:20px 0 10px;}' +
      '.brand{font-family:Calibri,sans-serif;font-size:32pt;font-weight:700;margin-bottom:4px;}' +
      '.brand .w{color:' + C.DARK_RED + ';}' +
      '.brand .llc{color:' + C.CRIMSON + ';}' +
      '.red-line{height:1.5px;background:' + C.RED_ACCENT + ';margin-bottom:36px;}' +
      '.doc-title{font-family:Calibri,sans-serif;font-size:28pt;font-weight:700;color:' + C.DARK_RED + ';letter-spacing:3px;margin-bottom:4px;}' +
      '.dark-red-line{height:2.5px;background:' + C.DARK_RED + ';margin-bottom:6px;}' +
      '.subtitle{font-family:Calibri,sans-serif;font-size:14pt;color:' + C.TEXT_SECONDARY + ';margin-bottom:32px;}' +
      '.title-spacer{flex-grow:1;}' +
      '.info-tbl{border-collapse:collapse;width:100%;margin-bottom:24px;}' +
      '.info-tbl td{padding:4px 8px;vertical-align:top;border:none;}' +
      '.info-tbl .lbl{font-family:Calibri,sans-serif;font-size:8.5pt;color:' + C.TEXT_MUTED + ';width:140px;}' +
      '.info-tbl .val{font-weight:700;font-size:11pt;}' +
      '.info-tbl .sep td{border-bottom:1px solid ' + C.LIGHT_GRAY + ';padding:2px 0;}' +
      '.classification{font-family:Calibri,sans-serif;font-size:9pt;}' +
      '.classification .badge{background:' + C.DARK_RED + ';color:' + C.GOLD_LIGHT + ';font-weight:700;padding:2px 8px;font-size:9pt;}' +
      '.preamble{text-align:justify;margin-bottom:10px;}' +
      '.between{text-align:center;font-family:Calibri,sans-serif;font-size:12pt;color:' + C.CRIMSON + ';font-weight:700;margin:10px 0;}' +
      '.parties{display:flex;gap:14px;margin-bottom:14px;}' +
      '.party-box{flex:1;background:' + C.PARTY_BG + ';border-left:3px solid ' + C.RED_ACCENT + ';padding:10px 12px;}' +
      '.party-label{font-family:Calibri,sans-serif;font-size:9pt;color:' + C.DEEP_RED + ';font-weight:700;margin-bottom:4px;}' +
      '.party-name{font-weight:700;margin-bottom:3px;}' +
      '.party-addr{font-size:10pt;color:' + C.TEXT_SECONDARY + ';}' +
      '.party-role{font-size:10pt;color:' + C.TEXT_MUTED + ';font-style:italic;margin-top:4px;}' +
      '.sec-heading{font-family:Calibri,sans-serif;font-size:13pt;font-weight:700;color:' + C.CRIMSON + ';border-bottom:1.5px solid ' + C.RED_ACCENT + ';padding-bottom:2px;margin-top:20px;margin-bottom:6px;}' +
      '.sec-heading .num{color:' + C.RED_ACCENT + ';}' +
      '.body-para{text-align:justify;margin-bottom:5px;}' +
      '.sub-para{text-align:justify;margin-bottom:4px;margin-left:4px;}' +
      '.sub-para .label{color:' + C.RED_ACCENT + ';font-weight:700;}' +
      '.callout-warn{background:' + C.RED_TINT + ';border:1px solid ' + C.LIGHT_GRAY + ';border-left:4px solid ' + C.RED_ACCENT + ';padding:8px 12px;text-align:justify;margin:6px 0;}' +
      '.sig-line{height:3px;background:' + C.DARK_RED + ';margin-top:20px;margin-bottom:12px;}' +
      '.witness{text-align:justify;font-style:italic;margin-bottom:12px;}' +
      '.sig-table{display:flex;gap:14px;}' +
      '.sig-cell{flex:1;border-top:1.5px solid ' + C.RED_ACCENT + ';padding-top:8px;}' +
      '.sig-label{font-family:Calibri,sans-serif;font-size:9pt;color:' + C.DEEP_RED + ';font-weight:700;margin-bottom:4px;}' +
      '.sig-name{font-weight:700;margin-bottom:3px;}' +
      '.sig-detail{font-size:8pt;color:' + C.TEXT_SECONDARY + ';margin-bottom:2px;}' +
      '.sig-underline{color:' + C.DARK_RED + ';margin-top:12px;margin-bottom:2px;}' +
      '.sig-caption{font-family:Calibri,sans-serif;font-size:8pt;color:' + C.TEXT_MUTED + ';}' +
      '.sig-field{font-size:8pt;color:' + C.TEXT_SECONDARY + ';margin-bottom:3px;}' +
    '</style>';

    // ── TITLE PAGE (exact height = 1 PDF page) ──
    html += '<div class="title-page">';
    html += '<div style="height:20px;"></div>';
    html += '<div class="brand"><span class="w">WOODENSHARK</span><span class="llc"> LLC</span></div>';
    html += '<div class="red-line"></div>';
    html += '<div class="doc-title">NON-DISCLOSURE AGREEMENT</div>';
    html += '<div class="dark-red-line"></div>';
    html += '<div class="subtitle">Proprietary &amp; Restricted Information Protection</div>';

    html += '<table class="info-tbl">';
    html += '<tr><td class="lbl">EFFECTIVE DATE</td><td class="val">' + esc(effectiveDate) + '</td></tr>';
    html += '<tr><td class="lbl">DURATION</td><td class="val">5 years</td></tr>';
    html += '<tr class="sep"><td></td><td></td></tr>';
    html += '<tr><td class="lbl">DISCLOSING PARTY</td><td class="val">' + esc(self.WS_NAME) + '</td></tr>';
    html += '<tr><td class="lbl">RECEIVING PARTY</td><td class="val">' + esc(emp.full_name_lat || '') + '</td></tr>';
    html += '</table>';

    html += '<div class="title-spacer"></div>';
    html += '<div class="classification"><span style="color:' + C.TEXT_MUTED + ';">CLASSIFICATION: </span><span class="badge">STRICTLY CONFIDENTIAL</span></div>';
    html += '</div>';

    // ── PREAMBLE (header drawn by jsPDF overlay) ──

    // ── PREAMBLE ──
    html += '<div data-pdf-block>';
    html += '<div class="preamble"><b>This Non-Disclosure Agreement</b> (the \u201cAgreement\u201d) is entered into as of <b>' + esc(effectiveDate) + '</b> (the \u201cEffective Date\u201d).</div>';
    html += '<div class="between">BETWEEN:</div>';
    html += '</div>';

    // ── PARTIES ──
    html += '<div data-pdf-block>';
    html += '<div class="parties">';
    html += '<div class="party-box">';
    html += '<div class="party-label">DISCLOSING PARTY</div>';
    html += '<div class="party-name">' + esc(self.WS_NAME) + '</div>';
    html += '<div class="party-addr">' + PdfUtils.nlToBr(esc(self.WS_ADDRESS)) + '</div>';
    html += '</div>';
    html += '<div class="party-box">';
    html += '<div class="party-label">RECEIVING PARTY</div>';
    html += '<div class="party-name">' + esc(emp.full_name_lat || '') + '</div>';
    html += '<div class="party-addr">' +
      'Born: ' + esc(dob) + '<br>' +
      'Passport: ' + esc(emp.passport_number || '') + '<br>' +
      'Issued: ' + esc(passIssued) + '<br>' +
      'Valid until: ' + esc(passExpires) + '<br>' +
      esc(emp.address || '') +
      '</div>';
    html += '<div class="party-role">(the \u201cReceiving Party\u201d)</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // ── RECITALS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading">RECITALS</div>';
    html += '<div class="body-para">WHEREAS, the Company is engaged in the research, development, design, and production of Unmanned Aerial Vehicles (\u201cUAVs\u201d), Radio-Electronic Systems, and related defense and dual-use technologies;</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="body-para">WHEREAS, the Receiving Party possesses specialized technical expertise and has entered into a Consulting Agreement with the Company dated ' + esc(effectiveDate) + ' to provide engineering and technical services;</div></div>';

    html += '<div data-pdf-block><div class="body-para">WHEREAS, in the course of the engagement, the Parties anticipate that the Company may disclose or provide access to certain proprietary, confidential, and trade secret information to the Receiving Party;</div></div>';

    html += '<div data-pdf-block><div class="body-para"><b>NOW, THEREFORE,</b> in consideration of the mutual covenants contained herein, the Parties agree as follows:</div></div>';

    // ── 1. DEFINITIONS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">1. </span>DEFINITIONS</div>';
    html += '<div class="sub-para"><span class="label">1.1</span> \u201cCompany\u201d shall mean Woodenshark LLC, as the Disclosing Party under this Agreement.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.2</span> \u201cConfidential Information\u201d shall mean any and all non-public, proprietary, or trade secret information, whether in oral, written, electronic, visual, or any other form, that is disclosed by or on behalf of the Company to the Receiving Party, including but not limited to the categories set forth in Section 2.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.3</span> \u201cReceiving Party\u201d shall mean the Party receiving Confidential Information.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.4</span> \u201cRepresentatives\u201d shall mean officers, directors, employees, agents, contractors, advisors, attorneys, and accountants who have a legitimate need to know the Confidential Information and who are bound by obligations of confidentiality no less restrictive than those set forth herein.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.5</span> \u201cPurpose\u201d shall mean the evaluation, performance, and administration of the Consulting Agreement, including research, design, development, engineering, testing, and production of UAV systems, Radio-Electronic Warfare systems, embedded firmware, flight control systems, and related defense technologies.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.6</span> \u201cMaterials\u201d shall mean all tangible and intangible embodiments of Confidential Information, including documents, drawings, schematics, prototypes, source code, firmware, datasets, reports, and any copies or derivatives thereof.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">1.7</span> \u201cTrade Secrets\u201d shall mean any information that derives independent economic value from not being generally known to or readily ascertainable by other persons, and is the subject of reasonable efforts to maintain its secrecy, as defined under the Delaware Uniform Trade Secrets Act and the Defend Trade Secrets Act of 2016.</div></div>';

    // ── 2. CONFIDENTIAL INFORMATION ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">2. </span>CONFIDENTIAL INFORMATION</div>';
    html += '<div class="body-para">Confidential Information includes, without limitation, the following categories:</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(a)</span> Technical Information: designs, drawings, engineering specifications, schematics, PCB layouts, CAD/CAM files, algorithms, formulas, processes, inventions, research data, test data, flight test logs, telemetry data, and technical know-how;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(b)</span> Software and Firmware: source code, object code, firmware images, APIs, communication protocols, encryption keys, flight control algorithms, navigation algorithms, and related documentation;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(c)</span> Product Information: prototypes, product specifications, product roadmaps, production processes, manufacturing techniques, bill of materials, and supply chain data;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(d)</span> Business Information: business plans, strategies, pricing, financial data, customer lists, supplier lists, contract terms, and partnership discussions;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(e)</span> Defense and Military Information: information related to defense applications, military specifications, electronic warfare parameters, frequency data, signal characteristics, and any information subject to export control regulations including ITAR and EAR;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(f)</span> Intellectual Property: patent applications, invention disclosures, trade secrets, trademarks, copyrights, and any other proprietary rights.</div></div>';

    html += '<div data-pdf-block><div class="body-para">Confidential Information need not be marked as \u201cconfidential\u201d to be protected under this Agreement. Information disclosed orally shall be considered Confidential Information if it would reasonably be understood to be confidential given the nature of the information and the circumstances of disclosure.</div></div>';

    // ── 3. OBLIGATIONS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">3. </span>OBLIGATIONS OF RECEIVING PARTY</div>';
    html += '<div class="sub-para"><span class="label">3.1</span> The Receiving Party shall not, without the prior written consent of the Disclosing Party, disclose, publish, or otherwise make available any Confidential Information to any third party, except to its Representatives in accordance with this Agreement.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.2</span> The Receiving Party shall protect the Confidential Information using at least the same degree of care that it uses to protect its own confidential information, but in no event less than a reasonable degree of care.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.3</span> The Receiving Party shall use the Confidential Information solely for the Purpose and shall not use it for any other purpose, including reverse engineering, competitive analysis, or development of competing products.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.4</span> The Receiving Party shall not reverse engineer, disassemble, decompile, or otherwise attempt to derive the composition, structure, or underlying ideas of any Confidential Information, including prototypes, hardware, software, or firmware.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.5</span> The Receiving Party shall use encrypted communications when transmitting Confidential Information electronically, use strong passwords and multi-factor authentication, and not store Confidential Information on unsecured personal devices or public cloud services without prior written consent.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.6</span> The Receiving Party shall promptly notify the Disclosing Party in writing of any actual or suspected unauthorized access, disclosure, or loss of Confidential Information.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">3.7</span> If the Receiving Party becomes legally compelled by judicial or administrative order, subpoena, or other legal process to disclose any Confidential Information, the Receiving Party shall: (i) provide the Disclosing Party with prompt written notice, to the extent legally permitted, so that the Disclosing Party may seek a protective order or other appropriate remedy; (ii) cooperate with the Disclosing Party in seeking such protective measures; and (iii) disclose only the minimum portion of Confidential Information that is legally required.</div></div>';

    // ── 4. EXCLUSIONS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">4. </span>EXCLUSIONS FROM CONFIDENTIAL INFORMATION</div>';
    html += '<div class="body-para">The obligations of confidentiality shall not apply to information that the Receiving Party can demonstrate by clear and convincing evidence:</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(a)</span> was already in the public domain at the time of disclosure through no fault of the Receiving Party;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(b)</span> becomes publicly available after disclosure through no fault of the Receiving Party;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(c)</span> was rightfully in the Receiving Party\u2019s possession prior to disclosure, as documented by contemporaneous written records;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(d)</span> is rightfully obtained from a third party without obligation of confidentiality;</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">(e)</span> is independently developed without reference to or use of the Confidential Information.</div></div>';

    // ── 5. TERM AND TERMINATION ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">5. </span>TERM AND TERMINATION</div>';
    html += '<div class="sub-para"><span class="label">5.1</span> This Agreement shall commence on the Effective Date and shall remain in full force and effect for a period of five (5) years, unless earlier terminated.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">5.2</span> Either Party may terminate this Agreement by providing thirty (30) days\u2019 prior written notice.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">5.3</span> The obligations of confidentiality shall survive for a period of five (5) years following expiration or termination. With respect to Trade Secrets, the obligations shall survive for as long as such information remains a Trade Secret.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">5.4</span> Upon termination, the Receiving Party shall immediately cease all use of the Confidential Information and comply with the return obligations set forth in Section 6.</div></div>';

    // ── 6. RETURN OF MATERIALS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">6. </span>RETURN OF MATERIALS</div>';
    html += '<div class="sub-para"><span class="label">6.1</span> Upon expiration, termination, or written request, the Receiving Party shall promptly return or destroy all Materials containing Confidential Information and provide written certification of destruction within fifteen (15) business days.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">6.2</span> For electronically stored Confidential Information, the Receiving Party shall employ secure deletion methods (multi-pass overwrite, degaussing, or physical destruction of storage media).</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">6.3</span> The Receiving Party may retain one archival copy solely for compliance with applicable law, provided it remains subject to all confidentiality obligations.</div></div>';

    // ── 7. REMEDIES ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">7. </span>REMEDIES</div>';
    html += '<div class="callout-warn"><b>The Parties acknowledge that any breach may cause irreparable injury for which monetary damages would be inadequate.</b> The Disclosing Party shall be entitled to seek immediate injunctive relief without the necessity of proving actual damages or posting a bond.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">7.1</span> The rights and remedies are cumulative and in addition to any other rights available at law or in equity, including claims for damages, an accounting of profits, and recovery of attorneys\u2019 fees.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">7.2</span> The Receiving Party shall indemnify and hold harmless the Disclosing Party from all claims, damages, losses, and expenses arising from any breach of this Agreement.</div></div>';

    // ── 8. NON-SOLICITATION ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">8. </span>NON-SOLICITATION</div>';
    html += '<div class="body-para">During the term and for two (2) years following termination, the Receiving Party shall not use Confidential Information to directly or indirectly solicit, recruit, or hire any employee, contractor, or key personnel of the Company, or to solicit or divert any client, customer, supplier, or business partner of the Company.</div>';
    html += '</div>';

    // ── 9. INTELLECTUAL PROPERTY ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">9. </span>INTELLECTUAL PROPERTY</div>';
    html += '<div class="sub-para"><span class="label">9.1</span> Nothing in this Agreement grants the Receiving Party any right, title, or interest in the Confidential Information or any intellectual property of the Disclosing Party.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">9.2</span> Any inventions or work product created using the Company\u2019s Confidential Information shall be governed by the Consulting Agreement and shall be the sole property of the Company.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">9.3</span> ALL CONFIDENTIAL INFORMATION IS PROVIDED \u201cAS IS.\u201d NEITHER PARTY MAKES ANY WARRANTY WITH RESPECT TO THE ACCURACY, COMPLETENESS, OR FITNESS FOR A PARTICULAR PURPOSE OF ANY CONFIDENTIAL INFORMATION.</div></div>';

    // ── 10. GOVERNING LAW ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">10. </span>GOVERNING LAW AND JURISDICTION</div>';
    html += '<div class="sub-para"><span class="label">10.1</span> This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of laws principles.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">10.2</span> The Parties submit to the exclusive jurisdiction of the courts of the State of Delaware. Each Party waives any objection to venue.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">10.3</span> In any action to enforce this Agreement, the prevailing Party shall be entitled to recover reasonable attorneys\u2019 fees and costs.</div></div>';

    // ── 11. GENERAL PROVISIONS ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">11. </span>GENERAL PROVISIONS</div>';
    html += '<div class="sub-para"><span class="label">11.1</span> All notices shall be in writing, delivered personally, by registered mail, or by recognized courier service to the addresses set forth herein.</div>';
    html += '</div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.2</span> Neither Party may assign this Agreement without prior written consent, except that the Company may assign to a successor entity in connection with a merger or acquisition.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.3</span> No failure or delay in exercising any right shall operate as a waiver thereof.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.4</span> If any provision is held invalid, it shall be modified to the minimum extent necessary; the remaining provisions shall continue in full force.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.5</span> This Agreement may not be amended except by a written instrument signed by all Parties.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.6</span> The Receiving Party acknowledges that certain Confidential Information may be subject to ITAR and EAR export control regulations and agrees to comply with all applicable export control laws.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.7</span> No Party shall issue any public disclosure regarding this Agreement without the prior written consent of the other Parties.</div></div>';

    html += '<div data-pdf-block><div class="sub-para"><span class="label">11.8</span> This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic signatures and PDF copies shall be deemed originals for all purposes.</div></div>';

    // ── 12. ENTIRE AGREEMENT ──
    html += '<div data-pdf-block>';
    html += '<div class="sec-heading"><span class="num">12. </span>ENTIRE AGREEMENT</div>';
    html += '<div class="body-para">This Agreement, together with the Consulting Agreement dated ' + esc(effectiveDate) + ', constitutes the entire agreement between the Parties with respect to the subject matter hereof. In the event of any conflict regarding Confidential Information, the more restrictive provision shall prevail.</div>';
    html += '</div>';

    // ── SIGNATURE BLOCK (kept together) ──
    html += '<div data-pdf-block>';
    html += '<div class="sig-line"></div>';
    html += '<div class="witness"><b>IN WITNESS WHEREOF,</b> the Parties have executed this Non-Disclosure Agreement as of the Effective Date first written above.</div>';

    html += '<div class="sig-table">';

    html += '<div class="sig-cell">';
    html += '<div class="sig-label">WOODENSHARK LLC</div>';
    html += '<div class="sig-detail">' + PdfUtils.nlToBr(esc('3411 Silverside Road\nSuite 104, Wilmington\nDE 19810, USA')) + '</div>';
    html += '<div class="sig-underline">________________________</div>';
    html += '<div class="sig-caption">Signature</div>';
    html += '<div class="sig-field">Name: ____________________</div>';
    html += '<div class="sig-field">Title: ____________________</div>';
    html += '<div class="sig-field">Date: ____________________</div>';
    html += '</div>';

    html += '<div class="sig-cell">';
    html += '<div class="sig-label">RECEIVING PARTY</div>';
    html += '<div class="sig-name" style="font-size:9pt;">' + esc(emp.full_name_lat || '') + '</div>';
    html += '<div class="sig-detail">Passport: ' + esc(emp.passport_number || '') + '</div>';
    html += '<div class="sig-detail">' + esc(emp.work_email || '') + '</div>';
    html += '<div class="sig-underline">________________________</div>';
    html += '<div class="sig-caption">Signature</div>';
    html += '<div class="sig-field">Name: ' + esc(emp.full_name_lat || '') + '</div>';
    html += '<div class="sig-field">Date: ____________________</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    return html;
  },

  _drawOverlay: function (pdf, page, total) {
    var C = this.COLORS;
    // ── HEADER: white bg → dark-red bar → company line → red line ──
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 15, 'F');

    pdf.setFillColor(26, 0, 0);
    pdf.rect(0, 0, 210, 7, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(212, 160, 23);
    pdf.text('STRICTLY CONFIDENTIAL  \u2014  PROPRIETARY & RESTRICTED', 105, 4.5, { align: 'center', charSpace: 1.2 });

    pdf.setFontSize(7);
    pdf.setTextColor(139, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('WOODENSHARK LLC', 18, 11);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(107, 107, 107);
    pdf.text('Non-Disclosure Agreement', 192, 11, { align: 'right' });

    pdf.setDrawColor(198, 40, 40);
    pdf.setLineWidth(0.4);
    pdf.line(18, 13, 192, 13);

    // ── FOOTER: white bg → gray line → page info → dark-red bar ──
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 277, 210, 20, 'F');

    pdf.setDrawColor(208, 208, 208);
    pdf.setLineWidth(0.15);
    pdf.line(18, 283, 192, 283);

    pdf.setFontSize(7);
    pdf.setTextColor(107, 107, 107);
    pdf.setFont(undefined, 'normal');
    pdf.text('Non-Disclosure Agreement  |  STRICTLY CONFIDENTIAL  |  Page ' + page + ' of ' + total, 105, 286.5, { align: 'center' });

    pdf.setFillColor(26, 0, 0);
    pdf.rect(0, 289, 210, 8, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(212, 160, 23);
    pdf.text('STRICTLY CONFIDENTIAL  \u2014  PROPRIETARY & RESTRICTED', 105, 293.5, { align: 'center', charSpace: 1.2 });
  },

  async generate(emp) {
    var self = this;
    var html = this.renderHTML(emp);
    var ownerPassword = 'WS-' + emp.id.slice(0, 8) + '-' + Date.now();
    return PdfUtils.renderToPdf(html, {
      ownerPassword: ownerPassword,
      watermark: 'WOODENSHARK LLC CONFIDENTIAL',
      skipOverlayOnPage1: true,
      overlay: function (pdf, page, total) {
        self._drawOverlay(pdf, page, total);
      }
    });
  },

  getFileName: function (emp) {
    var name = (emp.full_name_lat || 'Unknown').replace(/\s+/g, ' ').trim();
    return 'NDA ' + name + '.pdf';
  },
};
