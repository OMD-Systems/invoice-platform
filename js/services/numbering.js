/* ═══════════════════════════════════════════════════════
   Numbering — Invoice Number Tracking Service
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

const Numbering = {

  /* ── Get the next invoice number for an employee ── */
  async getNextNumber(employeeId, formatType) {
    formatType = formatType || 'WS';

    var result = await DB.client
      .from('employees')
      .select('next_invoice_number')
      .eq('id', employeeId)
      .single();

    if (result.error) {
      console.error('[Numbering] getNextNumber error:', result.error);
      return 1;
    }

    return (result.data && result.data.next_invoice_number) || 1;
  },

  /* ── Increment the invoice number in DB after generation ── */
  async incrementNumber(employeeId) {
    var current = await this.getNextNumber(employeeId);

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

    switch (format) {
      case 'WS':
        // WS-Invoice-{N}-{FIRSTNAME}-{LASTNAME} {DD.MM.YYYY}.docx
        var fullDate = Numbering._toFullDate(date);
        return 'WS-Invoice-' + number + '-' + nameParts.join('-') + ' ' + fullDate + '.docx';

      case 'FOP':
        // {Surname}_Invoice-{N}-FOP.docx
        return nameParts[0] + '_Invoice-' + number + '-FOP.docx';

      case 'CUSTOM':
        // {prefix}-{N}.docx
        var prefix = employee.invoice_prefix || 'Invoice';
        return prefix + '-' + number + '.docx';

      default:
        return 'Invoice-' + number + '-' + nameParts.join('-') + '.docx';
    }
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
    var nextNum = await this.getNextNumber(employeeId);

    // Check if this number is already used (edge case: manual override)
    var used = await this.isNumberUsed(employeeId, nextNum);
    var maxAttempts = 100;
    var attempts = 0;

    while (used && attempts < maxAttempts) {
      nextNum++;
      used = await this.isNumberUsed(employeeId, nextNum);
      attempts++;
    }

    return nextNum;
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
