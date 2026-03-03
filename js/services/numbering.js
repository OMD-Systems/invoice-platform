/* ═══════════════════════════════════════════════════════
   Numbering — Invoice Number Tracking Service
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

function _sanitizeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

const Numbering = {

  /* ── Format a raw number with optional prefix ── */
  formatNumber(prefix, num) {
    var padded = String(num).padStart(3, '0');
    return prefix ? prefix + '-' + padded : padded;
  },

  /* ── Get the next invoice number for an employee (raw int) ── */
  async getNextNumber(employeeId) {
    var result = await DB.client
      .from('employees')
      .select('next_invoice_number, invoice_prefix')
      .eq('id', employeeId)
      .single();

    if (result.error) {
      console.error('[Numbering] getNextNumber error:', result.error);
      return { number: 1, prefix: '' };
    }

    return {
      number: (result.data && result.data.next_invoice_number) || 1,
      prefix: (result.data && result.data.invoice_prefix) || ''
    };
  },

  /* ── Get the next formatted invoice number string (convenience) ── */
  async getNextFormattedNumber(employeeId) {
    var info = await this.getNextNumber(employeeId);
    return this.formatNumber(info.prefix, info.number);
  },

  /* ── Increment the invoice number in DB after generation ── */
  async incrementNumber(employeeId) {
    var info = await this.getNextNumber(employeeId);
    var current = info.number;

    var result = await DB.client
      .from('employees')
      .update({ next_invoice_number: current + 1 })
      .eq('id', employeeId);

    if (result.error) {
      console.error('[Numbering] incrementNumber error:', result.error);
      throw new Error('Failed to increment invoice number: ' + result.error.message);
    }

    return current;
  },

  /* ── Use the DB RPC function for atomic increment (preferred) ── */
  async incrementNumberAtomic(employeeId) {
    var result = await DB.client
      .rpc('increment_invoice_number', { emp_id: employeeId });

    if (result.error) {
      console.error('[Numbering] incrementNumberAtomic error:', result.error);
      // Fall back to non-atomic version
      return await this.incrementNumber(employeeId);
    }

    return result.data;
  },

  /* ── Generate filename based on employee format ── */
  getFileName(employee, number, date) {
    var nameParts = (employee.full_name_lat || 'Unknown').split(' ');
    var format = employee.invoice_format || 'WS';

    var rawName;
    switch (format) {
      case 'WS':
        var fullDate = Numbering._toFullDate(date);
        rawName = 'WS-Invoice-' + number + '-' + nameParts.join('-') + ' ' + fullDate + '.docx';
        break;
      case 'FOP':
        rawName = nameParts[nameParts.length - 1] + '_Invoice-' + number + '-FOP.docx';
        break;
      case 'CUSTOM':
        var prefix = employee.invoice_prefix || 'Invoice';
        rawName = prefix + '-' + number + '.docx';
        break;
      default:
        rawName = 'Invoice-' + number + '-' + nameParts.join('-') + '.docx';
    }
    return _sanitizeFileName(rawName);
  },

  /* ── Validate invoice number is not already used ── */
  async isNumberUsed(employeeId, number, month, year) {
    var result = await DB.client
      .from('invoices')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('invoice_number', number)
      .maybeSingle();

    if (result.error) {
      console.error('[Numbering] isNumberUsed error:', result.error);
      return false;
    }

    return !!result.data;
  },

  /* ── Get the next available number (skipping used ones) ── */
  async getNextAvailableNumber(employeeId) {
    var info = await this.getNextNumber(employeeId);
    var nextNum = info.number;
    var prefix = info.prefix;

    // Check if this number is already used (edge case: manual override)
    var formatted = this.formatNumber(prefix, nextNum);
    var used = await this.isNumberUsed(employeeId, formatted);
    var maxAttempts = 100;
    var attempts = 0;

    while (used && attempts < maxAttempts) {
      nextNum++;
      formatted = this.formatNumber(prefix, nextNum);
      used = await this.isNumberUsed(employeeId, formatted);
      attempts++;
    }

    return { number: nextNum, prefix: prefix, formatted: formatted };
  },

  /* ── Internal: convert date to DD.MM.YYYY ── */
  _toFullDate(dateStr) {
    if (!dateStr) return '';
    // DD.MM.YY -> DD.MM.20YY
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(dateStr)) {
      return dateStr.slice(0, 6) + '20' + dateStr.slice(6);
    }
    // Already DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    // ISO date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      var d = new Date(dateStr);
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var yyyy = String(d.getFullYear());
      return dd + '.' + mm + '.' + yyyy;
    }
    return dateStr;
  },
};
