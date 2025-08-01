$(function () {
  $('.hijri-date').hijriDatePicker({
    hijri: true,
    showSwitcher: false,
    format: 'iYYYY-iMM-iDD'
  });

  const issue = $('input[name="IssueDate"]');
  const exp = $('input[name="ExpirationDate"]');

  function setExpiration() {
    const val = issue.val();
    if (!val) return;
    const m = moment(val, 'iYYYY-iMM-iDD');
    if (!m.isValid()) return;
    const d = m.clone().add(1, 'iYear');
    exp.val(d.format('iYYYY-iMM-iDD'));
  }

  if (issue.length && exp.length) {
    if (!issue.val()) {
      issue.val(moment().format('iYYYY-iMM-iDD'));
    }
    setExpiration();
    issue.on('change input dp.change', setExpiration);
  }

  $('table.data-table').DataTable({
    order: [],
    responsive: true,
    stripeClasses: [],
    pageLength: 10,
    lengthMenu: [10, 20, 50, 100],
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.5/i18n/ar.json',
      searchPlaceholder: 'بحث...',
      search: ' '
    },
    dom: "<'row'<'col-sm-12 col-md-6'f><'col-sm-12 col-md-6'lp>>" +
         "<'row'<'col-sm-12'tr>>" +
         "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
    pagingType: 'simple_numbers'
  });

  $('.select2')
    .select2({
      dir: 'rtl',
      width: '100%',
      placeholder: 'اختر...',
      allowClear: true
    })
    .on('select2:open', () => {
      const searchField = document.querySelector('.select2-container--open .select2-search__field');
      if (searchField) searchField.focus();
    });

  $('select[name="FacilityID"]').on('change', function () {
    const fid = $(this).val();
    if (!fid) return;
    $('#addDriverBtn').attr('href', '/nagl/drivers/new?facilityId=' + fid);
    $('#addVehicleBtn').attr('href', '/nagl/vehicles/new?facilityId=' + fid);
    $.getJSON('/nagl/api/drivers', { facilityId: fid }, function (data) {
      const dSel = $('select[name="DriverID"]');
      if (dSel.length) {
        dSel.empty();
        data.forEach(d => dSel.append(`<option value="${d.DriverID}">${d.FirstName} ${d.LastName} - ${d.IdentityNumber || ''}</option>`));
        dSel.trigger('change');
      }
    });
    $.getJSON('/nagl/api/vehicles', { facilityId: fid }, function (data) {
      const vSel = $('select[name="VehicleID"]');
      if (vSel.length) {
        vSel.empty();
        data.forEach(v => vSel.append(`<option value="${v.ID}">${v.PlateNumber || v.SerialNumber}</option>`));
        vSel.trigger('change');
      }
    });
  }).trigger('change');

});
