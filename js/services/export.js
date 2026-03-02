/* =============================================================
   ExportService — XLSX Export Utilities
   Invoice Platform · OMD Systems
   ============================================================= */

const ExportService = {

  /* ── Project display order (consistent with Timesheet page) ── */
  PROJECT_ORDER: {
    'SPECTR': 1, 'FURY': 2, 'KESTREL': 3, 'RATO_BOOSTER': 4,
    'MOTORS': 5, 'BATTERIES': 6, 'OTHER': 99
  },

  /**
   * Download a complete monthly invoice summary as XLSX.
   * Creates 3 sheets: Summary, Hours, Settlements.
   *
   * @param {object} data - {
   *   invoices: Array,        // invoice objects with employee join data
   *   employees: Array,       // employee objects
   *   timesheets: Array,      // timesheet rows with project join data
   *   settlements: object,    // result from Settlements.calculate()
   *   projects: Array         // project objects
   * }
   * @param {number} month - 1-12
   * @param {number} year  - e.g. 2026
   */
  downloadSummaryXlsx(data, month, year) {
    var wb = XLSX.utils.book_new();

    // ── Sheet 1: Summary ──
    this._buildSummarySheet(wb, data.invoices || [], data.employees || []);

    // ── Sheet 2: Hours ──
    this._buildHoursSheet(wb, data.employees || [], data.timesheets || [], data.projects || [], month, year);

    // ── Sheet 3: Settlements ──
    this._buildSettlementsSheet(wb, data.settlements);

    // Download file
    var monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    var filename = 'OMD_Invoice_Summary_' + monthName + '_' + year + '.xlsx';
    XLSX.writeFile(wb, filename);
  },

  /* ═══════════════════════════════════════════════════
     Sheet 1: Summary
     Columns: File Title | Supplier Name | Invoice Total
     ═══════════════════════════════════════════════════ */
  _buildSummarySheet(wb, invoices, employees) {
    // Build employee lookup
    var empMap = {};
    for (var e = 0; e < employees.length; e++) {
      empMap[employees[e].id] = employees[e];
    }

    var rows = [];
    var total = 0;

    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      var emp = inv.employees || empMap[inv.employee_id] || {};
      var employeeName = emp.full_name_lat || emp.name || 'Unknown';

      // Generate file title from invoice data
      var fileTitle = this._getInvoiceFileTitle(inv, emp);
      var amount = parseFloat(inv.total_usd) || 0;
      total += amount;

      rows.push({
        'File Title': fileTitle,
        'Supplier Name': employeeName,
        'Invoice Total': amount
      });
    }

    // Totals row
    rows.push({
      'File Title': '',
      'Supplier Name': 'TOTAL',
      'Invoice Total': this._round(total)
    });

    var ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 40 },  // File Title
      { wch: 25 },  // Supplier Name
      { wch: 16 }   // Invoice Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  },

  /* ═══════════════════════════════════════════════════
     Sheet 2: Hours
     Columns: Employee | <PROJECT_CODES...> | Total | Regular | Diff
     ═══════════════════════════════════════════════════ */
  _buildHoursSheet(wb, employees, timesheets, projects, month, year) {
    var self = this;

    // Sort projects by display order
    var sortedProjects = projects.slice().sort(function (a, b) {
      return (self.PROJECT_ORDER[a.code] || 99) - (self.PROJECT_ORDER[b.code] || 99);
    });

    var projectCodes = [];
    for (var p = 0; p < sortedProjects.length; p++) {
      projectCodes.push(sortedProjects[p].code);
    }

    // Build timesheet data: { employeeId: { projectCode: hours } }
    var tsData = {};
    var projIdToCode = {};
    for (var pi = 0; pi < sortedProjects.length; pi++) {
      projIdToCode[sortedProjects[pi].id] = sortedProjects[pi].code;
    }

    for (var t = 0; t < timesheets.length; t++) {
      var ts = timesheets[t];
      var empId = ts.employee_id;
      var code = (ts.projects && ts.projects.code) || projIdToCode[ts.project_id] || 'OTHER';
      var hours = parseFloat(ts.hours) || 0;

      if (!tsData[empId]) tsData[empId] = {};
      tsData[empId][code] = (tsData[empId][code] || 0) + hours;
    }

    // Calculate regular hours for the month
    var regularHours = this._calculateRegularHours(month, year);

    // Build header
    var headers = ['Employee'];
    for (var h = 0; h < projectCodes.length; h++) {
      headers.push(projectCodes[h]);
    }
    headers.push('Total');
    headers.push('Regular');
    headers.push('Diff');

    // Build rows
    var wsData = [headers];

    // Sort employees by name
    var sortedEmployees = employees.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    for (var e = 0; e < sortedEmployees.length; e++) {
      var emp = sortedEmployees[e];
      var empHours = tsData[emp.id] || {};
      var row = [emp.name || emp.full_name_lat || 'Unknown'];

      var empTotal = 0;
      for (var c = 0; c < projectCodes.length; c++) {
        var hrs = empHours[projectCodes[c]] || 0;
        empTotal += hrs;
        row.push(hrs || '');
      }

      var empRegular = (emp.employee_type === 'Hourly Contractor') ? 0 : regularHours;
      var diff = this._round(empTotal - empRegular);

      row.push(empTotal || 0);
      row.push(empRegular);
      row.push(diff);

      wsData.push(row);
    }

    var ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    var cols = [{ wch: 25 }]; // Employee
    for (var cw = 0; cw < projectCodes.length; cw++) {
      cols.push({ wch: 10 });
    }
    cols.push({ wch: 8 });  // Total
    cols.push({ wch: 8 });  // Regular
    cols.push({ wch: 8 });  // Diff
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'Hours');
  },

  /* ═══════════════════════════════════════════════════
     Sheet 3: Settlements
     Columns: Employee | Total Paid | WS | OMD | OM Energy | OM Energy UA
     ═══════════════════════════════════════════════════ */
  _buildSettlementsSheet(wb, settlements) {
    if (!settlements || !settlements.results) {
      // Create an empty sheet with headers only
      var emptyData = [['Employee', 'Total Paid', 'WS', 'OMD', 'OM Energy', 'OM Energy UA']];
      var emptyWs = XLSX.utils.aoa_to_sheet(emptyData);
      XLSX.utils.book_append_sheet(wb, emptyWs, 'Settlements');
      return;
    }

    var rows = [];

    // Sort results by employee name
    var sortedResults = settlements.results.slice().sort(function (a, b) {
      var nameA = (a.employee && a.employee.name) || '';
      var nameB = (b.employee && b.employee.name) || '';
      return nameA.localeCompare(nameB);
    });

    for (var i = 0; i < sortedResults.length; i++) {
      var r = sortedResults[i];
      rows.push({
        'Employee': (r.employee && r.employee.name) || (r.employee && r.employee.full_name_lat) || 'Unknown',
        'Total Paid': r.totalPaid,
        'WS': r.companyCost.WS || 0,
        'OMD': r.companyCost.OMD || 0,
        'OM Energy': r.companyCost.OM_ENERGY || 0,
        'OM Energy UA': r.companyCost.OM_ENERGY_UA || 0
      });
    }

    // Totals row
    rows.push({
      'Employee': 'TOTAL',
      'Total Paid': settlements.grandTotal || 0,
      'WS': (settlements.totals && settlements.totals.WS) || 0,
      'OMD': (settlements.totals && settlements.totals.OMD) || 0,
      'OM Energy': (settlements.totals && settlements.totals.OM_ENERGY) || 0,
      'OM Energy UA': (settlements.totals && settlements.totals.OM_ENERGY_UA) || 0
    });

    var ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 25 },  // Employee
      { wch: 14 },  // Total Paid
      { wch: 14 },  // WS
      { wch: 14 },  // OMD
      { wch: 14 },  // OM Energy
      { wch: 14 }   // OM Energy UA
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Settlements');
  },

  /* ═══════════════════════════════════════════════════
     Timesheet Template Generator
     ═══════════════════════════════════════════════════ */

  /**
   * Download a blank timesheet template for data entry.
   * Same format as the existing timesheet Excel files.
   *
   * @param {Array}  employees - Employee objects
   * @param {Array}  projects  - Project objects
   * @param {number} month     - 1-12
   * @param {number} year      - e.g. 2026
   */
  downloadTimesheetTemplate(employees, projects, month, year) {
    var self = this;
    var wb = XLSX.utils.book_new();

    // Sort projects by display order
    var sortedProjects = projects.slice().sort(function (a, b) {
      return (self.PROJECT_ORDER[a.code] || 99) - (self.PROJECT_ORDER[b.code] || 99);
    });

    var projectCodes = [];
    for (var p = 0; p < sortedProjects.length; p++) {
      projectCodes.push(sortedProjects[p].code);
    }

    // Build header row
    var headers = ['Employee'];
    for (var h = 0; h < projectCodes.length; h++) {
      headers.push(projectCodes[h]);
    }
    headers.push('Total');
    headers.push('Regular');
    headers.push('Check');

    // Build data rows
    var regularHours = this._calculateRegularHours(month, year);
    var wsData = [headers];

    // Sort employees by name
    var sortedEmployees = employees.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    for (var e = 0; e < sortedEmployees.length; e++) {
      var emp = sortedEmployees[e];
      var row = [emp.name || emp.full_name_lat || 'Unknown'];

      // Empty cells for each project
      for (var c = 0; c < projectCodes.length; c++) {
        row.push('');
      }

      row.push('');  // Total (will be filled by user)
      row.push(emp.employee_type === 'Hourly Contractor' ? 0 : regularHours);  // Regular
      row.push('');  // Check

      wsData.push(row);
    }

    var ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    var cols = [{ wch: 25 }]; // Employee
    for (var cw = 0; cw < projectCodes.length; cw++) {
      cols.push({ wch: 10 });
    }
    cols.push({ wch: 8 });  // Total
    cols.push({ wch: 8 });  // Regular
    cols.push({ wch: 8 });  // Check
    ws['!cols'] = cols;

    // Sheet name
    var monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

    // Download
    var filename = 'Timesheet_' + monthName + '_' + year + '.xlsx';
    XLSX.writeFile(wb, filename);
  },

  /* ═══════════════════════════════════════════════════
     Single Invoice Export (alternative to DOCX)
     ═══════════════════════════════════════════════════ */

  /**
   * Download a single invoice as XLSX (simpler alternative to DOCX).
   *
   * @param {object} invoiceData - Invoice with items, employee, etc.
   */
  downloadInvoiceXlsx(invoiceData) {
    var wb = XLSX.utils.book_new();
    var emp = invoiceData.employee || {};
    var items = invoiceData.items || [];

    // Header info
    var wsData = [];
    wsData.push(['INVOICE']);
    wsData.push([]);
    wsData.push(['From:', emp.full_name_lat || emp.name || '']);
    wsData.push(['Address:', emp.address || '']);
    wsData.push(['Phone:', emp.phone || '']);
    wsData.push([]);
    wsData.push(['Billed To:', (invoiceData.billedTo && invoiceData.billedTo.name) || 'Woodenshark LLC']);
    wsData.push(['', (invoiceData.billedTo && invoiceData.billedTo.address) || '']);
    wsData.push([]);
    wsData.push(['Invoice Number:', invoiceData.invoiceNumber || '']);
    wsData.push(['Invoice Date:', invoiceData.invoiceDate || '']);
    wsData.push(['Due Days:', invoiceData.dueDays || 7]);
    wsData.push([]);

    // Line items header
    wsData.push(['#', 'Description', 'Price', 'QTY', 'Total']);

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var price = parseFloat(item.price || item.price_usd) || 0;
      var qty = parseFloat(item.qty) || 1;
      wsData.push([
        i + 1,
        item.description || '',
        price,
        qty,
        this._round(price * qty)
      ]);
    }

    wsData.push([]);
    wsData.push(['', '', '', 'SUBTOTAL', invoiceData.subtotal || 0]);
    wsData.push(['', '', '', 'DISCOUNT', invoiceData.discount || 0]);
    wsData.push(['', '', '', 'TAX', invoiceData.tax || 0]);
    wsData.push(['', '', '', 'TOTAL', invoiceData.total || 0]);

    // Bank details
    wsData.push([]);
    wsData.push(['BANK DETAILS']);
    wsData.push(['IBAN:', emp.iban || '']);
    wsData.push(['SWIFT:', emp.swift || '']);
    wsData.push(['Receiver:', emp.receiver_name || emp.full_name_lat || '']);
    wsData.push(['Bank:', emp.bank_name || '']);

    var ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 16 },
      { wch: 40 },
      { wch: 12 },
      { wch: 6 },
      { wch: 14 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

    var nameParts = (emp.full_name_lat || 'Invoice').split(' ');
    var filename = 'Invoice-' + (invoiceData.invoiceNumber || 0) + '-' + nameParts.join('-') + '.xlsx';
    XLSX.writeFile(wb, filename);
  },

  /* ═══════════════════════════════════════════════════
     UTILITY HELPERS
     ═══════════════════════════════════════════════════ */

  /**
   * Generate a file title for the summary sheet based on invoice data.
   */
  _getInvoiceFileTitle(invoice, employee) {
    var format = employee.invoice_format || 'WS';
    var number = invoice.invoice_number || '';
    var nameParts = (employee.full_name_lat || 'Unknown').split(' ');

    switch (format) {
      case 'WS':
        return 'WS-Invoice-' + number + '-' + nameParts.join('-');
      case 'FOP':
        return nameParts[0] + '_Invoice-' + number + '-FOP';
      case 'CUSTOM':
        return (employee.invoice_prefix || 'Invoice') + '-' + number;
      default:
        return 'Invoice-' + number + '-' + nameParts.join('-');
    }
  },

  /**
   * Calculate regular working hours for a month (weekdays * 8).
   * Does NOT apply the settings adjustment — caller should handle that separately.
   */
  _calculateRegularHours(month, year) {
    var workingDays = 0;
    var daysInMonth = new Date(year, month, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dayOfWeek = new Date(year, month - 1, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    return workingDays * 8;
  },

  /**
   * Round to 2 decimal places.
   */
  _round(value) {
    return Math.round((parseFloat(value) || 0) * 100) / 100;
  }
};
