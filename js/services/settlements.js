/* =============================================================
   Settlements — Inter-Company Settlement Calculator
   Invoice Platform · OMD Systems
   ============================================================= */

const Settlements = {

  /* ── Project-to-company mapping (loaded from DB) ── */
  projectCompanyMap: {},
  projectIdToCode: {},

  /* ── Known companies ── */
  COMPANIES: ['WS', 'OMD', 'OM_ENERGY', 'OM_ENERGY_UA'],

  /* ── Company display labels ── */
  COMPANY_LABELS: {
    'WS': 'Woodenshark',
    'OMD': 'OMD Systems',
    'OM_ENERGY': 'OM Energy',
    'OM_ENERGY_UA': 'OM Energy UA',
  },

  /* ── Preferred project display order ── */
  PROJECT_ORDER: ['SPECTR', 'FURY', 'KESTREL', 'RATO_BOOSTER', 'MOTORS', 'BATTERIES', 'OTHER'],

  /**
   * Load the project -> company mapping from the projects table.
   * Also builds a project_id -> code lookup.
   */
  async loadMapping() {
    var result = await DB.getProjects();
    var projects = result.data || [];

    this.projectCompanyMap = {};
    this.projectIdToCode = {};

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      this.projectCompanyMap[p.code] = p.company || 'WS';
      this.projectIdToCode[p.id] = p.code;
    }
  },

  /**
   * Calculate inter-company cost allocation for a given month.
   *
   * Logic:
   *   1. For each employee, gather all timesheet entries for the month.
   *   2. Sum total hours worked.
   *   3. Determine the employee's total cost (invoice total_usd, or rate_usd fallback).
   *   4. Calculate percentage allocation per project based on hours.
   *   5. Multiply total cost by each project's percentage to get per-project cost.
   *   6. Map each project to its owning company.
   *   7. Aggregate costs per company across all employees.
   *
   * @param {number} month - 1-12
   * @param {number} year  - e.g. 2026
   * @param {Array}  employees - Array of employee objects
   * @param {Array}  timesheets - Array of timesheet rows with project join data
   * @param {Array}  invoices - Array of invoice objects for the month
   * @param {number} expectedHours - Configured working hours for the month (e.g. 168)
   * @returns {{ results: Array, totals: object, grandTotal: number }}
   */
  async calculate(month, year, employees, timesheets, invoices, expectedHours = 168) {
    await this.loadMapping();

    var self = this;
    var results = [];

    // Build invoice lookup by employee_id (sum totals if multiple invoices per employee)
    var invoiceMap = {};
    for (var iv = 0; iv < invoices.length; iv++) {
      var inv = invoices[iv];
      if (invoiceMap[inv.employee_id]) {
        invoiceMap[inv.employee_id].total_usd =
          (parseFloat(invoiceMap[inv.employee_id].total_usd) || 0) +
          (parseFloat(inv.total_usd) || 0);
      } else {
        invoiceMap[inv.employee_id] = { total_usd: inv.total_usd, employee_id: inv.employee_id };
      }
    }

    for (var e = 0; e < employees.length; e++) {
      var emp = employees[e];

      // Get this employee's timesheet entries
      var empTimesheets = [];
      for (var t = 0; t < timesheets.length; t++) {
        if (timesheets[t].employee_id === emp.id) {
          empTimesheets.push(timesheets[t]);
        }
      }

      // Sum total hours
      var totalHours = 0;
      for (var h = 0; h < empTimesheets.length; h++) {
        totalHours += parseFloat(empTimesheets[h].hours) || 0;
      }

      if (totalHours === 0) continue;

      // Determine total paid amount
      // Priority: invoice total_usd > expected math
      var invoice = invoiceMap[emp.id] || null;
      var totalPaid = 0;
      var empType = emp.employee_type || 'monthly';
      var rate = parseFloat(emp.rate_usd) || 0;

      if (invoice && invoice.total_usd != null) {
        totalPaid = parseFloat(invoice.total_usd) || 0;
      } else if (empType === 'hourly') {
        totalPaid = rate * totalHours;
      } else {
        // Monthly - prorated
        var expectedHrs = expectedHours || 168; // 21 days * 8 hrs default
        if (expectedHrs > 0) {
          totalPaid = rate * (totalHours / expectedHrs);
        } else {
          totalPaid = rate;
        }
      }

      // Calculate hours per project
      // Resolve project code from either the join data or the ID-to-code map
      var projectHours = {};
      for (var p = 0; p < empTimesheets.length; p++) {
        var ts = empTimesheets[p];
        var code = self._resolveProjectCode(ts);
        var hrs = parseFloat(ts.hours) || 0;
        if (hrs > 0) {
          projectHours[code] = (projectHours[code] || 0) + hrs;
        }
      }

      // Calculate percentage allocation per project
      var projectPct = {};
      var projectKeys = Object.keys(projectHours);
      for (var pk = 0; pk < projectKeys.length; pk++) {
        var projCode = projectKeys[pk];
        projectPct[projCode] = projectHours[projCode] / totalHours;
      }

      // Calculate cost per project
      var projectCost = {};
      for (var pc = 0; pc < projectKeys.length; pc++) {
        var pcCode = projectKeys[pc];
        projectCost[pcCode] = self._round(totalPaid * projectPct[pcCode]);
      }

      // Distribute rounding remainder to the largest-cost project
      var costSum = 0;
      for (var cs = 0; cs < projectKeys.length; cs++) {
        costSum += projectCost[projectKeys[cs]];
      }
      var remainder = self._round(totalPaid - costSum);
      if (remainder !== 0 && projectKeys.length > 0) {
        // Find project with most hours (largest allocation)
        var maxKey = projectKeys[0];
        for (var mk = 1; mk < projectKeys.length; mk++) {
          if (projectHours[projectKeys[mk]] > projectHours[maxKey]) {
            maxKey = projectKeys[mk];
          }
        }
        projectCost[maxKey] = self._round(projectCost[maxKey] + remainder);
      }

      // Group cost by company
      var companyCost = {};
      for (var cc = 0; cc < self.COMPANIES.length; cc++) {
        companyCost[self.COMPANIES[cc]] = 0;
      }
      for (var gc = 0; gc < projectKeys.length; gc++) {
        var gcCode = projectKeys[gc];
        var company = self.projectCompanyMap[gcCode] || 'WS';
        companyCost[company] = (companyCost[company] || 0) + projectCost[gcCode];
      }

      // Round company costs
      for (var rc = 0; rc < self.COMPANIES.length; rc++) {
        companyCost[self.COMPANIES[rc]] = self._round(companyCost[self.COMPANIES[rc]]);
      }

      results.push({
        employee: emp,
        totalHours: self._round(totalHours),
        totalPaid: self._round(totalPaid),
        projectHours: projectHours,
        projectPct: projectPct,
        projectCost: projectCost,
        companyCost: companyCost
      });
    }

    // Calculate grand totals per company
    var totals = {};
    for (var ti = 0; ti < self.COMPANIES.length; ti++) {
      totals[self.COMPANIES[ti]] = 0;
    }

    var grandTotal = 0;
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      grandTotal += r.totalPaid;
      var companyNames = Object.keys(r.companyCost);
      for (var cn = 0; cn < companyNames.length; cn++) {
        var cName = companyNames[cn];
        totals[cName] = (totals[cName] || 0) + r.companyCost[cName];
      }
    }

    // Round totals
    for (var ft = 0; ft < self.COMPANIES.length; ft++) {
      totals[self.COMPANIES[ft]] = self._round(totals[self.COMPANIES[ft]]);
    }

    return {
      results: results,
      totals: totals,
      grandTotal: self._round(grandTotal)
    };
  },

  /**
   * Resolve the project code from a timesheet row.
   * Timesheet rows may have joined project data (projects.code)
   * or just a project_id that needs mapping.
   */
  _resolveProjectCode(timesheetRow) {
    // Prefer joined project data
    if (timesheetRow.projects && timesheetRow.projects.code) {
      return timesheetRow.projects.code;
    }
    // Fallback to ID-to-code map
    if (timesheetRow.project_id && this.projectIdToCode[timesheetRow.project_id]) {
      return this.projectIdToCode[timesheetRow.project_id];
    }
    // Last resort: use project_code if present, or 'OTHER'
    return timesheetRow.project_code || 'OTHER';
  },

  /**
   * Round to 2 decimal places (currency precision).
   */
  _round(value) {
    return Math.round((parseFloat(value) || 0) * 100) / 100;
  },

  /**
   * Format a settlement result into a summary suitable for display.
   * Returns an array of row objects for a table.
   *
   * @param {{ results: Array, totals: object, grandTotal: number }} settlementData
   * @returns {Array<{ name: string, totalPaid: number, WS: number, OMD: number, OM_ENERGY: number, OM_ENERGY_UA: number }>}
   */
  formatForTable(settlementData) {
    var rows = [];

    for (var i = 0; i < settlementData.results.length; i++) {
      var r = settlementData.results[i];
      rows.push({
        name: r.employee.name || r.employee.full_name_lat || 'Unknown',
        totalPaid: r.totalPaid,
        WS: r.companyCost.WS || 0,
        OMD: r.companyCost.OMD || 0,
        OM_ENERGY: r.companyCost.OM_ENERGY || 0,
        OM_ENERGY_UA: r.companyCost.OM_ENERGY_UA || 0
      });
    }

    // Add totals row
    rows.push({
      name: 'TOTAL',
      totalPaid: settlementData.grandTotal,
      WS: settlementData.totals.WS || 0,
      OMD: settlementData.totals.OMD || 0,
      OM_ENERGY: settlementData.totals.OM_ENERGY || 0,
      OM_ENERGY_UA: settlementData.totals.OM_ENERGY_UA || 0
    });

    return rows;
  },

  /**
   * Verify settlement integrity: total paid must equal sum of company allocations.
   * Returns true if all rows pass, false otherwise.
   */
  verify(settlementData) {
    for (var i = 0; i < settlementData.results.length; i++) {
      var r = settlementData.results[i];
      var companySum = 0;
      var companies = Object.keys(r.companyCost);
      for (var c = 0; c < companies.length; c++) {
        companySum += r.companyCost[companies[c]];
      }
      companySum = this._round(companySum);

      if (companySum !== this._round(r.totalPaid)) {
        console.warn(
          '[Settlements] Integrity check failed for',
          r.employee.name,
          ': totalPaid=' + r.totalPaid,
          'companySum=' + companySum
        );
        return false;
      }
    }
    return true;
  },

  /**
   * Get the human-readable label for a company code.
   * @param {string} code - e.g. 'WS', 'OMD'
   * @returns {string}
   */
  getCompanyLabel(code) {
    return this.COMPANY_LABELS[code] || code;
  },

  /**
   * Extract the unique project codes that appear in settlement results,
   * sorted by PROJECT_ORDER then alphabetically for unknown codes.
   *
   * @param {{ results: Array }} settlementData
   * @returns {string[]}
   */
  getActiveProjectCodes(settlementData) {
    var seen = {};
    for (var i = 0; i < settlementData.results.length; i++) {
      var codes = Object.keys(settlementData.results[i].projectHours);
      for (var c = 0; c < codes.length; c++) {
        seen[codes[c]] = true;
      }
    }

    // Order: first those in PROJECT_ORDER, then any extras alphabetically
    var ordered = [];
    for (var po = 0; po < this.PROJECT_ORDER.length; po++) {
      if (seen[this.PROJECT_ORDER[po]]) {
        ordered.push(this.PROJECT_ORDER[po]);
        delete seen[this.PROJECT_ORDER[po]];
      }
    }
    var extras = Object.keys(seen).sort();
    for (var ex = 0; ex < extras.length; ex++) {
      ordered.push(extras[ex]);
    }
    return ordered;
  },

  /**
   * Extract the unique companies that appear in settlement results, sorted.
   *
   * @param {{ results: Array }} settlementData
   * @returns {string[]}
   */
  getActiveCompanies(settlementData) {
    var seen = {};
    for (var i = 0; i < settlementData.results.length; i++) {
      var companies = Object.keys(settlementData.results[i].companyCost);
      for (var c = 0; c < companies.length; c++) {
        if (settlementData.results[i].companyCost[companies[c]] !== 0) {
          seen[companies[c]] = true;
        }
      }
    }
    // Also include companies from project mapping for completeness
    var projectCodes = this.getActiveProjectCodes(settlementData);
    for (var p = 0; p < projectCodes.length; p++) {
      var comp = this.projectCompanyMap[projectCodes[p]] || 'WS';
      seen[comp] = true;
    }
    return Object.keys(seen).sort();
  },

  /**
   * Get the project-to-company mapping entries for display (chips/badges).
   * Returns array of { code, company, label }.
   *
   * @returns {Array<{ code: string, company: string, label: string }>}
   */
  getMappingChips() {
    var chips = [];
    var codes = Object.keys(this.projectCompanyMap);
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      var company = this.projectCompanyMap[code];
      chips.push({
        code: code,
        company: company,
        label: this.COMPANY_LABELS[company] || company,
      });
    }
    return chips;
  },

  /**
   * Format settlement data for detailed table rendering.
   * Returns per-employee rows with project-level and company-level allocations,
   * plus project totals and company totals.
   *
   * @param {{ results: Array, totals: object, grandTotal: number }} settlementData
   * @param {string[]} activeProjectCodes - ordered project codes to include
   * @param {string[]} companies - ordered company codes to include
   * @returns {{ rows: Array, projectTotals: object, companyTotals: object, grandTotal: number }}
   */
  formatForDetailedTable(settlementData, activeProjectCodes, companies) {
    var self = this;
    var rows = [];

    for (var i = 0; i < settlementData.results.length; i++) {
      var r = settlementData.results[i];

      // Build project allocations for requested codes
      var projectAllocations = {};
      for (var p = 0; p < activeProjectCodes.length; p++) {
        var code = activeProjectCodes[p];
        projectAllocations[code] = {
          hours: r.projectHours[code] || 0,
          percentage: r.projectPct[code] || 0,
          cost: r.projectCost[code] || 0,
        };
      }

      // Build company allocations for requested companies
      var companyAllocations = {};
      for (var c = 0; c < companies.length; c++) {
        companyAllocations[companies[c]] = r.companyCost[companies[c]] || 0;
      }

      rows.push({
        employee: r.employee,
        totalPaid: r.totalPaid,
        totalHours: r.totalHours,
        projectAllocations: projectAllocations,
        companyAllocations: companyAllocations,
      });
    }

    // Sort by employee name
    rows.sort(function (a, b) {
      var nameA = a.employee.name || '';
      var nameB = b.employee.name || '';
      return nameA.localeCompare(nameB);
    });

    // Calculate project totals
    var projectTotals = {};
    for (var pt = 0; pt < activeProjectCodes.length; pt++) {
      var ptCode = activeProjectCodes[pt];
      projectTotals[ptCode] = 0;
      for (var ri = 0; ri < rows.length; ri++) {
        projectTotals[ptCode] += rows[ri].projectAllocations[ptCode].cost;
      }
      projectTotals[ptCode] = self._round(projectTotals[ptCode]);
    }

    // Company totals from settlementData
    var companyTotals = {};
    for (var ct = 0; ct < companies.length; ct++) {
      companyTotals[companies[ct]] = settlementData.totals[companies[ct]] || 0;
    }

    return {
      rows: rows,
      projectTotals: projectTotals,
      companyTotals: companyTotals,
      grandTotal: settlementData.grandTotal,
    };
  },

  /**
   * Format settlement data for XLSX export.
   * Returns header array and data rows (array of arrays).
   *
   * @param {{ rows: Array, projectTotals: object, companyTotals: object, grandTotal: number }} detailedData
   * @param {string[]} activeProjectCodes
   * @param {string[]} companies
   * @returns {{ header: string[], dataRows: Array[], totalRow: Array }}
   */
  formatForExport(detailedData, activeProjectCodes, companies) {
    var self = this;

    var header = ['Employee', 'Total Paid ($)', 'Hours'];
    for (var pi = 0; pi < activeProjectCodes.length; pi++) {
      header.push(activeProjectCodes[pi] + ' ($)');
    }
    for (var ci = 0; ci < companies.length; ci++) {
      header.push((self.COMPANY_LABELS[companies[ci]] || companies[ci]) + ' ($)');
    }

    var dataRows = [];
    for (var r = 0; r < detailedData.rows.length; r++) {
      var row = detailedData.rows[r];
      var dataRow = [
        row.employee.name || 'Unknown',
        row.totalPaid,
        row.totalHours,
      ];
      for (var pci = 0; pci < activeProjectCodes.length; pci++) {
        dataRow.push(row.projectAllocations[activeProjectCodes[pci]].cost);
      }
      for (var cci = 0; cci < companies.length; cci++) {
        dataRow.push(row.companyAllocations[companies[cci]] || 0);
      }
      dataRows.push(dataRow);
    }

    // Total row
    var totalRow = ['TOTAL', detailedData.grandTotal, ''];
    for (var ptci = 0; ptci < activeProjectCodes.length; ptci++) {
      totalRow.push(detailedData.projectTotals[activeProjectCodes[ptci]] || 0);
    }
    for (var ctci = 0; ctci < companies.length; ctci++) {
      totalRow.push(detailedData.companyTotals[companies[ctci]] || 0);
    }

    return {
      header: header,
      dataRows: dataRows,
      totalRow: totalRow,
    };
  }
};
