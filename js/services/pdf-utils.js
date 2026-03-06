/* ═══════════════════════════════════════════════════════
   PdfUtils — Shared PDF generation utilities
   HTML → html2canvas → jsPDF with pagination, watermark,
   repeating headers/footers & encryption
   Invoice Platform · Woodenshark
   ═══════════════════════════════════════════════════════ */

var PdfUtils = {

  PAGE_HEIGHT_PX: Math.ceil(297 * 794 / 210), // 1123
  WRAPPER_PAD: 40,
  HEADER_ZONE: 55,  // px reserved at top of each page for header (~14.5mm)
  FOOTER_ZONE: 80,  // px reserved at bottom for footer (~21mm, covers white rect at y=277mm)

  renderToPdf: function (html, opts) {
    opts = opts || {};
    var scale = opts.scale || 2;
    var watermark = opts.watermark || 'WOODENSHARK LLC CONFIDENTIAL';
    var overlay = opts.overlay || null;
    var skipOverlayP1 = opts.skipOverlayOnPage1 !== false;
    var self = this;

    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.style.cssText =
        'position:absolute;left:-9999px;top:0;width:794px;z-index:-1;background:#fff;padding:0;margin:0;';

      var wrapper = document.createElement('div');
      wrapper.style.cssText =
        'background:#fff;color:#000;font-family:Calibri,Cambria,"Segoe UI",Arial,Helvetica,sans-serif;' +
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

        // 1) Regular pagination (prevent mid-element cuts)
        self._paginateBlocks(content, self.WRAPPER_PAD, overlay ? self.FOOTER_ZONE : 0);

        // 2) Header spacers — ensure no content in header zone of each page
        if (overlay) {
          self._addHeaderSpacers(content, self.WRAPPER_PAD);
        }

        // 3) Tiled watermarks
        if (watermark) {
          self._addWatermarks(wrapper, watermark);
        }

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
              var pdfOpts = { orientation: 'p', unit: 'mm', format: 'a4', compress: true };

              if (opts.ownerPassword) {
                pdfOpts.encryption = {
                  ownerPassword: opts.ownerPassword,
                  userPassword: '',
                  userPermissions: ['print', 'copy']
                };
              }

              var pdf = new jsPDF(pdfOpts);
              var pdfW = 210, pdfH = 297;
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

              // Draw overlay (header/footer) on each page
              var totalPages = pdf.getNumberOfPages();
              for (var p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                if (overlay && !(skipOverlayP1 && p === 1)) {
                  overlay(pdf, p, totalPages);
                } else if (!overlay) {
                  pdf.setFontSize(8);
                  pdf.setTextColor(150, 150, 150);
                  pdf.text('Page ' + p + ' of ' + totalPages, 105, 290, { align: 'center' });
                }
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

  /** Push blocks away from page boundaries so nothing is cut */
  _paginateBlocks: function (contentEl, padTop, footerZone) {
    var PAGE_H = this.PAGE_HEIGHT_PX;
    var FOOTER = footerZone || 0;
    var SAFE = 70;
    var PAD = 70;

    var blocks = contentEl.querySelectorAll('[data-pdf-block]');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var wTop = padTop + b.offsetTop;
      var wBot = wTop + b.offsetHeight;
      var pageEnd = (Math.floor(wTop / PAGE_H) + 1) * PAGE_H;
      var contentEnd = pageEnd - FOOTER;

      var crosses = wBot > contentEnd && wTop < contentEnd;
      var inSafe = wTop < contentEnd && (contentEnd - wTop) <= SAFE;

      if (crosses || inSafe) {
        if (b.offsetHeight < PAGE_H - SAFE - PAD - FOOTER) {
          var gap = (pageEnd - wTop) + PAD;
          var sp = document.createElement('div');
          sp.style.height = gap + 'px';
          b.parentNode.insertBefore(sp, b);
        }
      }
    }
  },

  /** Ensure no content sits in the header zone at top of each page (except p1) */
  _addHeaderSpacers: function (contentEl, padTop) {
    var PAGE_H = this.PAGE_HEIGHT_PX;
    var HZONE = this.HEADER_ZONE;

    for (var iter = 0; iter < 8; iter++) {
      var totalH = padTop + contentEl.scrollHeight;
      var stable = true;

      for (var boundary = PAGE_H; boundary < totalH; boundary += PAGE_H) {
        var blocks = contentEl.querySelectorAll('[data-pdf-block]');
        for (var j = 0; j < blocks.length; j++) {
          var b = blocks[j];
          var bTop = padTop + b.offsetTop;
          if (bTop >= boundary && bTop < boundary + HZONE) {
            var needed = boundary + HZONE - bTop;
            if (needed > 2) {
              var sp = document.createElement('div');
              sp.style.height = needed + 'px';
              b.parentNode.insertBefore(sp, b);
              stable = false;
            }
            break;
          }
        }
      }
      if (stable) break;
    }
  },

  _addWatermarks: function (wrapper, text) {
    var totalH = wrapper.scrollHeight;
    var PAGE_H = this.PAGE_HEIGHT_PX;
    var pages = Math.ceil(totalH / PAGE_H);

    var wc = document.createElement('div');
    wc.style.cssText =
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
        'color:rgba(0,0,0,0.11);white-space:nowrap;letter-spacing:8px;' +
        'font-family:Calibri,Arial,sans-serif;user-select:none;">' +
        PdfUtils.esc(text) + '</div>';
      wc.appendChild(wm);
    }
    wrapper.insertBefore(wc, wrapper.firstChild);
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
