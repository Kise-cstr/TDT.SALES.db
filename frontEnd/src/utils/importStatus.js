export const SALES_IMPORT_KEY = 'tdt_sales_data_imported';
export const GOOGLE_SHEETS_KEY = 'tdt_google_sheets_connected';
export const SALES_IMPORT_EVENT = 'tdt-sales-import-status';

export function hasImportedSalesData() {
  return (
    localStorage.getItem(SALES_IMPORT_KEY) === 'true' ||
    localStorage.getItem(GOOGLE_SHEETS_KEY) === 'true'
  );
}

export function markSalesDataImported(source) {
  localStorage.setItem(SALES_IMPORT_KEY, 'true');
  if (source) {
    localStorage.setItem('tdt_sales_data_source', source);
  }
  window.dispatchEvent(new Event(SALES_IMPORT_EVENT));
}
