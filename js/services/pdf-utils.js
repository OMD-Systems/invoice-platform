/* ═══════════════════════════════════════════════════════
   PdfUtils — Shared PDF generation utilities
   HTML → html2canvas → jsPDF with pagination, watermark & encryption
   Invoice Platform · Woodenshark
   ═══════════════════════════════════════════════════════ */

var PdfUtils = {

  PAGE_HEIGHT_PX: Math.ceil(297 * 794 / 210), // 1123 — A4 height in CSS px at 794px width
  WRAPPER_PAD: 40,

  /**
   * Render an HTML string to a protected PDF blob.
   * Handles pagination (no mid-element cuts), tiled watermarks, page numbers.
   */
  renderToPdf: function (html, opts) {
    opts = opts || {};
    var scale = opts.scale || 2;
    var watermark = opts.watermark || 'WOODENSHARK LLC CONFIDENTIAL';
    var self = this;

    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.style.cssText =
        'position:fixed;left:-9999px;top:0;width:794px;z-index:-1;background:#fff;padding:0;margin:0;';

      var wrapper = document.createElement('div');
      wrapper.style.cssText =
        'background:#fff;color:#000;font-family:Calibri,Cambria,Segoe UI,Arial,sans-serif;' +
        'font-size:10pt;line-height:1.4;padding:' + self.WRAPPER_PAD + 'px;margin:0;' +
        'width:794px;min-height:auto;position:relative;overflow:hidden;';

      var content = document.createElement('div');
      content.style.cssText = 'position:relative;z-index:1;';
      content.innerHTML = html;
      wrapper.appendChild(content);
      container.appendChild(wrapper);
      document.body.appendChild(container);

      setTimeout(function () {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
          container.remove();
          reject(new Error('jsPDF or html2canvas not loaded'));
          return;
        }

        // Paginate: insert spacers so no element is cut across pages
        self.paginateContainer(content, self.WRAPPER_PAD);

        // Tiled watermarks (one per page, centered)
        if (watermark) {
          self._addWatermarks(wrapper, watermark);
        }

        // Wait for reflow after DOM changes
        setTimeout(function () {
          html2canvas(wrapper, {
            scale: scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 794,
            windowWidth: 794
          }).then(function (canvas) {
            container.remove();

            try {
              var jsPDF = jspdf.jsPDF;
              var pdfOpts = { orientation: 'p', unit: 'mm', format: 'a4' };

              if (opts.ownerPassword) {
                pdfOpts.encryption = {
                  ownerPassword: opts.ownerPassword,
                  userPassword: '',
                  userPermissions: ['print', 'copy']
                };
              }

              var pdf = new jsPDF(pdfOpts);
              var pdfW = 210;
              var pdfH = 297;
              var imgW = pdfW;
              var imgH = (canvas.height * pdfW) / canvas.width;
              var imgData = canvas.toDataURL('image/jpeg', 0.95);
              var heightLeft = imgH;
              var pos = 0;

              pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH);
              heightLeft -= pdfH;

              while (heightLeft > 0) {
                pos = -(imgH - heightLeft);
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH);
                heightLeft -= pdfH;
              }

              // Page numbers
              var totalPages = pdf.getNumberOfPages();
              for (var p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text('Page ' + p + ' of ' + totalPages, 105, 290, { align: 'center' });
              }

              resolve(pdf.output('blob'));
            } catch (err) {
              reject(err);
            }
          }).catch(function (err) {
            container.remove();
            reject(err);
          });
        }, 100);
      }, 200);
    });
  },

  /**
   * Insert spacers before [data-pdf-block] elements that would be cut by page boundaries.
   * Reads live offsetTop after each spacer insert so subsequent elements auto-adjust.
   */
  paginateContainer: function (contentEl, wrapperPadTop) {
    var PAGE_H = this.PAGE_HEIGHT_PX;
    var BOTTOM_SAFE = 60;   // don't start a block within last 60px of a page
    var NEW_PAGE_PAD = 36;  // top margin on new page

    var blocks = contentEl.querySelectorAll('[data-pdf-block]');

    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var y = block.offsetTop;
      var h = block.offsetHeight;
      var wTop = wrapperPadTop + y;
      var wBot = wTop + h;

      var pageEnd = (Math.floor(wTop / PAGE_H) + 1) * PAGE_H;

      var crossesPage = wBot > pageEnd && wTop < pageEnd;
      var inSafeZone = (pageEnd - wTop) > 0 && (pageEnd - wTop) < BOTTOM_SAFE;

      if (crossesPage || inSafeZone) {
        // Only push if block can fit on one page
        if (h < PAGE_H - NEW_PAGE_PAD - BOTTOM_SAFE) {
          var gap = (pageEnd - wTop) + NEW_PAGE_PAD;
          var spacer = document.createElement('div');
          spacer.style.height = gap + 'px';
          block.parentNode.insertBefore(spacer, block);
        }
      }
    }
  },

  /**
   * Add tiled watermark instances — one centered per page.
   */
  _addWatermarks: function (wrapper, text) {
    var totalH = wrapper.scrollHeight;
    var PAGE_H = this.PAGE_HEIGHT_PX;
    var pages = Math.ceil(totalH / PAGE_H);

    var wmContainer = document.createElement('div');
    wmContainer.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:' + totalH + 'px;' +
      'pointer-events:none;z-index:0;overflow:hidden;';

    for (var i = 0; i < pages; i++) {
      var wm = document.createElement('div');
      wm.style.cssText =
        'position:absolute;left:0;width:100%;height:' + PAGE_H + 'px;' +
        'top:' + (i * PAGE_H) + 'px;' +
        'display:flex;align-items:center;justify-content:center;pointer-events:none;';
      wm.innerHTML =
        '<div style="transform:rotate(-45deg);font-size:54px;font-weight:700;' +
        'color:rgba(0,0,0,0.06);white-space:nowrap;letter-spacing:8px;' +
        'font-family:Calibri,Arial,sans-serif;user-select:none;">' +
        PdfUtils.esc(text) + '</div>';
      wmContainer.appendChild(wm);
    }

    wrapper.insertBefore(wmContainer, wrapper.firstChild);
  },

  esc: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatDateLong: function (dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  nlToBr: function (str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br>');
  }
};
