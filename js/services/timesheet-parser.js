/**
 * TimesheetParser — Service for parsing OMD Systems Excel timesheets (.xlsx)
 *
 * Reads uploaded .xlsx files using the SheetJS library (global XLSX from CDN)
 * and extracts employee hours data from the standard OMD timesheet format.
 *
 * Expected workbook structure:
 *   - "TS" sheet: monthly timesheet rows (employee hours per project)
 *   - "Tech" sheet: employee directory (name, PIN, manager, type)
 *
 * TS sheet columns (row 2 = headers):
 *   A: Month | B: Year | C: PIN | D: Employee name ("Surname, Name")
 *   E: Manager | F: Employee type (FTE / Hourly Contractor)
 *   G: Start date | H: End date | I: Regular hours | J: Total Actual hours
 *   K: SPECTR | L: FURY | M: KESTREL | N: RATO BOOSTER
 *   O: MOTORS | P: BATTERIES | Q: OTHER | R-T: Reserved | U: Check (J-I)
 *
 * Depends on: global XLSX (SheetJS), DB (Supabase wrapper — optional, for import)
 */
const TimesheetParser = {

  // ---- Column mapping -------------------------------------------------------

  /** Project code -> 0-indexed column in the TS sheet (K=10 .. Q=16) */
  PROJECT_COLUMNS: {
    'SPECTR':       10, // K
    'FURY':         11, // L
    'KESTREL':      12, // M
    'RATO_BOOSTER': 13, // N
    'MOTORS':       14, // O
    'BATTERIES':    15, // P
    'OTHER':        16, // Q
  },

  /** Fixed column indices for scalar fields */
  COL: {
    MONTH:         0,  // A
    YEAR:          1,  // B
    PIN:           2,  // C
    EMPLOYEE_NAME: 3,  // D
    MANAGER:       4,  // E
    EMPLOYEE_TYPE: 5,  // F
    START_DATE:    6,  // G
    END_DATE:      7,  // H
    REGULAR_HOURS: 8,  // I
    TOTAL_HOURS:   9,  // J
    CHECK:         20, // U
  },

  // ---- Public API -----------------------------------------------------------

  /**
   * Parse an uploaded File / Blob and return structured data.
   * @param {File} file - .xlsx file from an <input type="file">
   * @returns {Promise<{timesheets: Array, employees: Array, metadata: Object}>}
   */
  async parse(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library is not loaded. Include it via CDN before using TimesheetParser.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });

          const timesheets = this.parseTS(workbook);
          const employees  = this.parseTech(workbook);

          const result = {
            timesheets,
            employees,
            metadata: {
              fileName:   file.name,
              fileSize:   file.size,
              sheets:     workbook.SheetNames,
              rowCount:   timesheets.length,
              employeeCount: employees.length,
              parsedAt:   new Date().toISOString(),
            },
          };

          resolve(result);
        } catch (err) {
          reject(new Error('Failed to parse timesheet: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  },

  // ---- TS sheet parsing -----------------------------------------------------

  /**
   * Parse the TS (TimeSheet) sheet from the workbook.
   * @param {Object} workbook - SheetJS workbook object
   * @returns {Array<Object>} parsed timesheet rows
   */
  parseTS(workbook) {
    const sheetName = this._findSheet(workbook, ['ts', 'time', 'timesheet']);
    if (!sheetName) {
      console.warn('TimesheetParser: no TS sheet found, using first sheet');
    }

    const effectiveName = sheetName || (workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null);
    if (!effectiveName) return [];

    const sheet = workbook.Sheets[effectiveName];
    if (!sheet) return [];

    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (jsonData.length < 2) return [];

    const headerRow = this._findHeaderRow(jsonData, [
      'employee', 'month', 'name', 'pin', 'hours',
    ]);

    // Also try to detect dynamic project columns from the header
    const dynamicProjects = this._detectProjectColumns(jsonData, headerRow);

    const results = [];

    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const employeeName = this._str(row[this.COL.EMPLOYEE_NAME]);
      if (!employeeName || employeeName === '#REF!' || employeeName === '#N/A') continue;

      const month        = this._num(row[this.COL.MONTH]);
      const year         = this._num(row[this.COL.YEAR]);
      const pin          = this._str(row[this.COL.PIN]);
      const manager      = this._str(row[this.COL.MANAGER]);
      const employeeType = this._str(row[this.COL.EMPLOYEE_TYPE]);
      const startDate    = this._parseDate(row[this.COL.START_DATE]);
      const endDate      = this._parseDate(row[this.COL.END_DATE]);
      const regularHours = this._num(row[this.COL.REGULAR_HOURS]);
      const totalHours   = this._num(row[this.COL.TOTAL_HOURS]);

      // Skip rows that are clearly not data (e.g. subtotal labels with no month)
      if (month === 0 && year === 0 && totalHours === 0) continue;

      // Parse project hours from both fixed mapping and any dynamic overrides
      const projectCols = Object.keys(dynamicProjects).length > 0
        ? dynamicProjects
        : this.PROJECT_COLUMNS;

      const projects = {};
      let projectHoursSum = 0;

      for (const [projectCode, colIndex] of Object.entries(projectCols)) {
        const hours = this._num(row[colIndex]);
        if (hours !== 0) {
          projects[projectCode] = hours;
          projectHoursSum += hours;
        }
      }

      // Check column (U = col 20). Fall back to computed difference.
      const rawCheck = this._num(row[this.COL.CHECK]);
      const check = rawCheck !== 0 ? rawCheck : (totalHours - regularHours);

      results.push({
        month,
        year,
        pin,
        employeeName,
        manager,
        employeeType,
        startDate,
        endDate,
        regularHours,
        totalHours,
        projects,
        projectHoursSum,
        check,
        overtime: check > 0,
        rowIndex: i,
      });
    }

    return results;
  },

  // ---- Tech sheet parsing ---------------------------------------------------

  /**
   * Parse the Tech (employee directory) sheet from the workbook.
   * @param {Object} workbook - SheetJS workbook object
   * @returns {Array<Object>} employee directory entries
   */
  parseTech(workbook) {
    const sheetName = this._findSheet(workbook, ['tech', 'employee', 'directory', 'staff']);
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (jsonData.length < 2) return [];

    // Detect header row (look for "name", "pin", "manager", etc.)
    const headerRow = this._findHeaderRow(jsonData, ['name', 'pin', 'manager', 'type']);

    const employees = [];

    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const name    = this._str(row[0]);
      const pin     = this._str(row[1]);
      const manager = this._str(row[2]);
      const type    = this._str(row[3]);

      if (!name || name === '#REF!' || name === '#N/A') continue;

      employees.push({
        name,
        pin,
        manager,
        employeeType: type,
        rowIndex: i,
      });
    }

    return employees;
  },

  // ---- Employee matching ----------------------------------------------------

  /**
   * Match parsed timesheet entries to database employees by PIN or name.
   * Requires global DB service with getEmployees().
   * @param {Array} parsedTimesheets - output of parseTS()
   * @returns {Promise<Array>} timesheets with employeeId and match info
   */
  async matchEmployees(parsedTimesheets) {
    if (typeof DB === 'undefined' || typeof DB.getEmployees !== 'function') {
      console.warn('TimesheetParser.matchEmployees: DB service not available');
      return parsedTimesheets.map(ts => ({
        ...ts,
        employeeId: null,
        matched: false,
        dbEmployee: null,
      }));
    }

    const { data: dbEmployees, error } = await DB.getEmployees();
    if (error || !dbEmployees) {
      console.error('TimesheetParser.matchEmployees: failed to load employees', error);
      return parsedTimesheets.map(ts => ({
        ...ts,
        employeeId: null,
        matched: false,
        dbEmployee: null,
      }));
    }

    // Build lookup maps for fast matching
    const byPin  = new Map();
    const byName = new Map();

    for (const emp of dbEmployees) {
      if (emp.pin)  byPin.set(String(emp.pin).trim(), emp);
      if (emp.name) byName.set(emp.name.toLowerCase().trim(), emp);
    }

    return parsedTimesheets.map(ts => {
      // 1. Try exact PIN match
      let match = ts.pin ? byPin.get(ts.pin) : null;

      // 2. Try exact name match (case-insensitive)
      if (!match && ts.employeeName) {
        match = byName.get(ts.employeeName.toLowerCase().trim());
      }

      // 3. Try reversed name order ("Name Surname" vs "Surname, Name")
      if (!match && ts.employeeName) {
        const reversed = this._reverseName(ts.employeeName);
        if (reversed) {
          match = byName.get(reversed.toLowerCase().trim());
        }
      }

      return {
        ...ts,
        employeeId: match?.id || null,
        matched: !!match,
        dbEmployee: match || null,
      };
    });
  },

  // ---- Database import ------------------------------------------------------

  /**
   * Import parsed timesheet data into the database.
   * Requires global DB service with getEmployees(), getProjects(), upsertTimesheet().
   * @param {Array} parsedData - output of parseTS()
   * @param {number|null} month - override month (null = use from each row)
   * @param {number|null} year  - override year  (null = use from each row)
   * @param {string} userId - ID of the user performing the import
   * @returns {Promise<{imported: number, skipped: number, errors: string[]}>}
   */
  async importToDb(parsedData, month, year, userId) {
    if (typeof DB === 'undefined') {
      throw new Error('DB service is not available');
    }

    if (!parsedData || parsedData.length === 0) {
      return { imported: 0, skipped: 0, errors: ['No data to import'] };
    }

    // Run validation and log warnings (non-blocking — issues are informational)
    const validationIssues = this.validate(parsedData);
    if (validationIssues.length > 0) {
      console.warn('TimesheetParser.importToDb: validation issues found:', validationIssues);
    }

    const matched = await this.matchEmployees(parsedData);
    const results = { imported: 0, skipped: 0, errors: [] };

    // Pre-fetch projects once (not inside the loop)
    const { data: projects, error: projError } = await DB.getProjects();
    if (projError || !projects) {
      throw new Error('Failed to load projects: ' + (projError?.message || 'unknown error'));
    }

    // Build project lookup by code (case-insensitive)
    const projectByCode = new Map();
    for (const p of projects) {
      if (p.code) projectByCode.set(p.code.toUpperCase(), p);
    }

    for (const ts of matched) {
      if (!ts.matched) {
        results.skipped++;
        results.errors.push(`No match for: ${ts.employeeName} (PIN: ${ts.pin || 'none'})`);
        continue;
      }

      for (const [projectCode, hours] of Object.entries(ts.projects)) {
        const project = projectByCode.get(projectCode.toUpperCase());

        if (!project) {
          results.errors.push(`Unknown project code: ${projectCode}`);
          continue;
        }

        const { error } = await DB.upsertTimesheet({
          employee_id: ts.employeeId,
          project_id:  project.id,
          month:       month || ts.month,
          year:        year  || ts.year,
          hours,
          created_by:  userId,
        });

        if (error) {
          results.errors.push(`Error for ${ts.employeeName}/${projectCode}: ${error.message}`);
        } else {
          results.imported++;
        }
      }
    }

    return results;
  },

  // ---- Validation -----------------------------------------------------------

  /**
   * Validate parsed timesheet data and return a list of issues.
   * @param {Array} parsedTimesheets - output of parseTS()
   * @returns {string[]} list of human-readable validation issues
   */
  validate(parsedTimesheets) {
    const issues = [];

    if (!parsedTimesheets || parsedTimesheets.length === 0) {
      issues.push('No timesheet data found');
      return issues;
    }

    const seenEmployees = new Map(); // name -> count, to detect duplicates

    for (const ts of parsedTimesheets) {
      const label = ts.employeeName || `row ${ts.rowIndex}`;

      // Negative hours on any project
      for (const [code, hours] of Object.entries(ts.projects)) {
        if (hours < 0) {
          issues.push(`${label}: negative hours (${hours}) on ${code}`);
        }
      }

      // Excessive hours (> 300 per month is suspicious)
      if (ts.totalHours > 300) {
        issues.push(`${label}: unusually high total hours (${ts.totalHours})`);
      }

      // Zero hours
      if (ts.totalHours === 0) {
        issues.push(`${label}: zero hours reported`);
      }

      // Total hours mismatch vs project sum
      if (ts.projectHoursSum > 0 && Math.abs(ts.totalHours - ts.projectHoursSum) > 0.5) {
        issues.push(
          `${label}: total hours (${ts.totalHours}) does not match sum of projects (${ts.projectHoursSum})`
        );
      }

      // Missing month/year
      if (!ts.month || ts.month < 1 || ts.month > 12) {
        issues.push(`${label}: invalid or missing month (${ts.month})`);
      }
      if (!ts.year || ts.year < 2000 || ts.year > 2100) {
        issues.push(`${label}: invalid or missing year (${ts.year})`);
      }

      // Missing PIN
      if (!ts.pin) {
        issues.push(`${label}: missing PIN`);
      }

      // Overtime flag check
      if (ts.check > 16) {
        issues.push(`${label}: significant overtime detected (${ts.check} hours over regular)`);
      }

      // Duplicate detection
      const key = `${ts.employeeName}|${ts.month}|${ts.year}`;
      const count = (seenEmployees.get(key) || 0) + 1;
      seenEmployees.set(key, count);
      if (count === 2) {
        issues.push(`${label}: duplicate entry for ${ts.month}/${ts.year}`);
      }
    }

    return issues;
  },

  // ---- Summary / aggregation ------------------------------------------------

  /**
   * Build a summary of parsed timesheet data grouped by project.
   * @param {Array} parsedTimesheets - output of parseTS()
   * @returns {Object} { byProject, byEmployee, totals }
   */
  summarize(parsedTimesheets) {
    if (!Array.isArray(parsedTimesheets) || parsedTimesheets.length === 0) {
      return { byProject: {}, byEmployee: {}, totals: { employees: 0, totalHours: 0, regularHours: 0, overtime: 0 } };
    }

    const byProject  = {};
    const byEmployee = {};
    let totalHours = 0;
    let totalRegular = 0;

    for (const ts of parsedTimesheets) {
      totalHours   += ts.totalHours;
      totalRegular += ts.regularHours;

      // Per-employee summary
      if (!byEmployee[ts.employeeName]) {
        byEmployee[ts.employeeName] = {
          pin: ts.pin,
          type: ts.employeeType,
          totalHours: 0,
          regularHours: 0,
          projects: {},
        };
      }
      const emp = byEmployee[ts.employeeName];
      emp.totalHours   += ts.totalHours;
      emp.regularHours += ts.regularHours;

      // Per-project aggregation
      for (const [code, hours] of Object.entries(ts.projects)) {
        // Global
        if (!byProject[code]) byProject[code] = { totalHours: 0, employeeCount: 0, employees: [] };
        byProject[code].totalHours += hours;
        byProject[code].employees.push({ name: ts.employeeName, hours });

        // Per employee
        emp.projects[code] = (emp.projects[code] || 0) + hours;
      }
    }

    // Finalize employee counts per project
    for (const proj of Object.values(byProject)) {
      proj.employeeCount = proj.employees.length;
    }

    return {
      byProject,
      byEmployee,
      totals: {
        employees:    parsedTimesheets.length,
        totalHours,
        regularHours: totalRegular,
        overtime:     totalHours - totalRegular,
      },
    };
  },

  // ---- Private helpers ------------------------------------------------------

  /**
   * Find a sheet by partial name match (case-insensitive).
   * Tries each keyword in order, returns first match or null.
   */
  _findSheet(workbook, keywords) {
    for (const keyword of keywords) {
      const found = workbook.SheetNames.find(
        n => n.toLowerCase().includes(keyword)
      );
      if (found) return found;
    }
    return null;
  },

  /**
   * Detect the header row index by looking for keyword matches in the first N rows.
   * Returns 0-based row index. Defaults to 1 (second row) if not found.
   */
  _findHeaderRow(jsonData, keywords) {
    const searchDepth = Math.min(10, jsonData.length);

    for (let i = 0; i < searchDepth; i++) {
      const row = jsonData[i];
      if (!row) continue;

      const rowText = row.map(cell => String(cell).toLowerCase()).join(' ');
      const matchCount = keywords.filter(kw => rowText.includes(kw)).length;

      // If at least 2 keywords match, this is likely the header
      if (matchCount >= 2) return i;
    }

    // Default: row index 1 (Excel row 2)
    return 1;
  },

  /**
   * Try to detect project columns dynamically from the header row.
   * Falls back to the static PROJECT_COLUMNS mapping if detection fails.
   */
  _detectProjectColumns(jsonData, headerRow) {
    if (headerRow < 0 || headerRow >= jsonData.length) return {};

    // Check the row above the header for section labels (row 1 often has merged headers)
    const sectionRow = headerRow > 0 ? jsonData[headerRow - 1] : null;
    const headerCells = jsonData[headerRow];
    if (!headerCells) return {};

    const detected = {};
    const knownProjects = [
      'SPECTR', 'FURY', 'KESTREL', 'RATO BOOSTER', 'RATO_BOOSTER',
      'MOTORS', 'BATTERIES', 'OTHER',
    ];

    for (let col = 10; col < Math.min(headerCells.length, 25); col++) {
      const cellValue = String(headerCells[col] || '').trim().toUpperCase();
      if (!cellValue) continue;

      for (const proj of knownProjects) {
        // Require exact match or substring match with a minimum length of 3
        // to avoid false positives from short cell values like "O" matching "MOTORS"
        if (cellValue === proj ||
            (cellValue.length >= 3 && (cellValue.includes(proj) || proj.includes(cellValue)))) {
          // Normalize to underscore form
          const code = proj.replace(/\s+/g, '_');
          detected[code] = col;
          break;
        }
      }
    }

    return detected;
  },

  /**
   * Safely convert a cell value to a trimmed string. Handles null, undefined, numbers.
   */
  _str(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  },

  /**
   * Safely parse a cell value as a number. Returns 0 for non-numeric values.
   * Handles strings like "160.00", locale-formatted numbers, and actual numbers.
   */
  _num(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;

    // Try to parse string representations
    const cleaned = String(value).replace(/[,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  },

  /**
   * Parse a date cell value. SheetJS may return a Date object or a serial number.
   */
  _parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'number') {
      // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string' && value.trim()) {
      const d = new Date(value.trim());
      return isNaN(d.getTime()) ? value.trim() : d.toISOString().split('T')[0];
    }
    return null;
  },

  /**
   * Reverse a "Surname, Name" string to "Name Surname" (and vice versa).
   * Used for fuzzy employee matching.
   */
  _reverseName(name) {
    if (!name) return null;

    if (name.includes(',')) {
      // "Surname, Name" -> "Name Surname"
      const parts = name.split(',').map(s => s.trim());
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
    } else if (name.includes(' ')) {
      // "Name Surname" -> "Surname, Name"
      const parts = name.split(/\s+/);
      if (parts.length === 2) return `${parts[1]}, ${parts[0]}`;
    }

    return null;
  },
};
