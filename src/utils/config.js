/**
 * config.js - מאגד את כל הגדרות הקונפיגורציה וקבועים של ההרחבה
 */

export const CONFIG = {
  // מזהי אלמנטים
  ELEMENTS: {
    DEBUG_ELEMENT_ID: 'carrefour-extension-debug',
    EXPORT_BUTTON_ID: 'carrefour-export-csv',
    IMPORT_PROGRESS_MODAL_ID: 'import-progress-modal'
  },
  
  // כתובות API ותבניות
  API: {
    CART_API_URL: 'https://www.carrefour.co.il/api/v1/cart',
    CART_V2_API_URL_TEMPLATE: 'https://www.carrefour.co.il/v2/retailers/{retailerId}/branches/{branchId}/carts/{cartId}?appId={appId}',
    SEARCH_API_URL: 'https://www.carrefour.co.il/api/v1/products/search',
    PRODUCT_URL_TEMPLATE: 'https://www.carrefour.co.il/product/{productId}'
  },
  
  // קבועי זמן ומרווחים
  TIMEOUTS: {
    STANDARD_DELAY: 500,
    RETRY_DELAY: 1000,
    API_TIMEOUT: 5000,
    CLEANUP_DELAY: 2000
  },
  
  // שמות שדות באחסון מקומי
  STORAGE_KEYS: {
    AUTH_TOKEN: 'carrefour_auth_token',
    CART_DETAILS: 'carrefour_cart_details',
    X_AUTH_TOKEN: 'carrefour_token',
    PENDING_ACTION: 'carrefour_pending_action',
    IMPORT_DATA: 'carrefour_csv_import_data',
    IMPORT_MODE: 'carrefour_csv_import_mode'
  },
  
  // מצבי ייבוא
  IMPORT_MODES: {
    REPLACE: 'replace',
    ADD: 'add'
  },
  
  // הגדרות UI
  UI: {
    STYLES: {
      PRIMARY_COLOR: '#f39200',
      SECONDARY_COLOR: '#f0f0f0',
      ERROR_COLOR: 'red',
      SUCCESS_COLOR: '#4CAF50'
    }
  },
  
  // סוגי בקשות API
  REQUEST_TYPES: {
    CART_EXPORT: 'export',
    CART_IMPORT: 'import'
  },
  
  // קבועים לטיפול בקבצי CSV
  CSV: {
    EXPECTED_HEADERS: {
      NAME: ['product_name', 'שם מוצר', 'שם', 'name'],
      BARCODE: ['barcode', 'ברקוד'],
      QUANTITY: ['quantity', 'כמות', 'qty'],
      LINK: ['product_link', 'קישור מוצר', 'קישור', 'link'],
      PRODUCT_ID: ['productId', 'product_id', 'מזהה מוצר'],
      RETAILER_PRODUCT_ID: ['retailerProductId', 'retailer_product_id', 'מזהה ספק']
    },
    DEFAULT_FILENAME: 'carrefour_products.csv'
  }
};

// ייצוא ברירת מחדל לשימוש נוח
export default CONFIG; 