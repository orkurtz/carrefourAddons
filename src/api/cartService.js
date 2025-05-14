/**
 * cartService.js - מודול לטיפול בפעולות API הקשורות לעגלת הקניות
 */

import CONFIG from '../utils/config';
import { fetchWithTimeout, formatApiUrl, getCartData, sleep } from '../utils/helpers';

/**
 * קבלת נתוני העגלה הנוכחית מהשרת
 * @returns {Promise<Object>} מידע על פריטי העגלה
 */
export async function getCurrentCart() {
  try {
    const cartData = await getCartData();
    
    // בדיקה אם יש לנו X-Auth-Token
    if (cartData[CONFIG.STORAGE_KEYS.X_AUTH_TOKEN]) {
      try {
        const response = await fetchWithTimeout(
          CONFIG.API.CART_API_URL,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': cartData[CONFIG.STORAGE_KEYS.X_AUTH_TOKEN]
            }
          }
        );
        
        return processCartApiResponse(response);
      } catch (error) {
        console.warn('שגיאה בקבלת נתוני עגלה דרך X-Auth-Token:', error);
        // נמשיך לנסות דרך API אחר
      }
    }
    
    // אם הגענו לכאן, ננסה דרך API של Bearer Token
    if (cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN] && cartData[CONFIG.STORAGE_KEYS.CART_DETAILS]) {
      const cartDetails = cartData[CONFIG.STORAGE_KEYS.CART_DETAILS];
      const apiUrl = formatApiUrl(CONFIG.API.CART_V2_API_URL_TEMPLATE, {
        retailerId: cartDetails.retailerId,
        branchId: cartDetails.branchId,
        cartId: cartDetails.cartId,
        appId: cartDetails.appId || '4'
      });
      
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Authorization': `Bearer ${cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN]}`,
            'Accept': 'application/json, text/plain, */*',
            'X-HTTP-Method-Override': 'PATCH'
          },
          body: JSON.stringify({})
        }
      );
      
      return processCartV2ApiResponse(response);
    }
    
    throw new Error('לא נמצאו נתוני אימות הדרושים לקבלת פרטי העגלה');
  } catch (error) {
    console.error('שגיאה בקבלת תוכן העגלה:', error);
    throw error;
  }
}

/**
 * עיבוד תשובה מה-API הראשי של העגלה
 * @param {Object} response - תשובה מה-API
 * @returns {Array<Object>} מערך פריטי העגלה המעובדים
 */
function processCartApiResponse(response) {
  // לוג של התשובה המקורית מהAPI
  console.log('===== תשובה מקורית מה-API הראשי =====', response);
  
  if (!response.items || response.items.length === 0) {
    return [];
  }
  
  const processedItems = response.items.map(item => {
    // Check for weighableProductUnits field to determine the quantity
    let quantity;
    if (item.weighableProductUnits !== undefined && item.weighableProductUnits !== null) {
      quantity = item.weighableProductUnits;
      console.log(`Using weighableProductUnits (${quantity}) instead of quantity (${item.quantity}) for product: ${item.product?.name || item.text}`);
    } else {
      quantity = item.quantity || 1;
    }
    
    return {
      name: item.text || item.product?.names?.[1]?.long || item.product?.name || '',
      barcode: item.barcode || '',
      quantity: quantity,
      price: item.unitPrice || item.price || item.product?.price || 0,
      actualPrice: item.actualPrice || 0,
      totalPrice: item.totalPrice || 0,
      link: `https://www.carrefour.co.il/product/${item.product?.id || ''}`,
      productId: item.product?.productId || '',
      retailerProductId: item.retailerProductId || item.product?.id || ''
    };
  });
  
  // לוג של הפריטים לאחר עיבוד
  console.log('===== פריטים לאחר עיבוד מה-API הראשי =====');
  console.table(processedItems);
  
  return processedItems;
}

/**
 * עיבוד תשובה מה-API המשני של העגלה
 * @param {Object} response - תשובה מה-API
 * @returns {Array<Object>} מערך פריטי העגלה המעובדים
 */
function processCartV2ApiResponse(response) {
  // לוג של התשובה המקורית מהAPI
  console.log('===== תשובה מקורית מה-API המשני (V2) =====', response);
  
  if (!response.cart || !response.cart.lines || response.cart.lines.length === 0) {
    return [];
  }
  
  const processedItems = response.cart.lines
    .filter(item => !item.text?.includes("איסוף עצמי")) // דילוג על מוצרים לא רלוונטיים
    .map(item => {
      // Check for weighableProductUnits field to determine the quantity
      let quantity;
      if (item.weighableProductUnits !== undefined && item.weighableProductUnits !== null) {
        quantity = item.weighableProductUnits;
        console.log(`Using weighableProductUnits (${quantity}) instead of quantity (${item.quantity}) for product: ${item.text}`);
      } else {
        quantity = item.quantity || 1;
      }
      
      return {
        name: item.text || item.product?.names?.[1]?.long || '',
        barcode: item.barcode || '',
        quantity: quantity,
        price: item.unitPrice || item.price || 0,
        actualPrice: item.actualPrice || 0,
        totalPrice: item.totalPrice || 0,
        link: `https://www.carrefour.co.il/?catalogProduct=${item.product?.productId || ''}`,
        productId: item.product?.productId || '',
        retailerProductId: item.retailerProductId || item.product?.id || ''
      };
    });
  
  // לוג של הפריטים לאחר עיבוד
  console.log('===== פריטים לאחר עיבוד מה-API המשני (V2) =====');
  console.table(processedItems);
  
  return processedItems;
}

/**
 * ריקון מלא של העגלה הנוכחית
 * @param {Array<Object>} existingItems - רשימת פריטים קיימים בעגלה
 * @returns {Promise<boolean>} האם הריקון הצליח
 */
export async function clearCart(existingItems = null) {
  try {
    if (!existingItems || existingItems.length === 0) {
      // אם לא סופקו פריטים, נקבל אותם
      existingItems = await getCurrentCart();
    }
    
    if (!existingItems || existingItems.length === 0) {
      // אין פריטים לריקון
      return true;
    }
    
    // השגת נתוני הרשאה
    const cartData = await getCartData();
    
    if (!cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN] || !cartData[CONFIG.STORAGE_KEYS.CART_DETAILS]) {
      throw new Error('חסרים נתוני אימות הדרושים לריקון העגלה');
    }
    
    const cartDetails = cartData[CONFIG.STORAGE_KEYS.CART_DETAILS];
    const apiUrl = formatApiUrl(CONFIG.API.CART_V2_API_URL_TEMPLATE, {
      retailerId: cartDetails.retailerId,
      branchId: cartDetails.branchId,
      cartId: cartDetails.cartId,
      appId: cartDetails.appId || '4'
    });
    
    // שלב 1: הורדת כמויות לאפס
    const linesWithZeroQuantity = existingItems.map(item => ({
      quantity: 0,
      soldBy: null,
      comments: "",
      isCase: false,
      metaData: null,
      retailerProductId: parseInt(item.retailerProductId, 10),
      type: 1
    }));
    
    const requestBody = {
      lines: linesWithZeroQuantity,
      source: "importCSV",
      deliveryProduct_Id: 16388534,
      deliveryType: 2
    };
    
    // שליחת בקשה לאיפוס כמויות
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN]}`,
          'Accept': 'application/json, text/plain, */*',
          'X-HTTP-Method-Override': 'PATCH'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    // המתנה קצרה אחרי איפוס הכמויות
    await sleep(CONFIG.TIMEOUTS.RETRY_DELAY);
    
    // שלב 2: מחיקה מלאה של הפריטים
    const linesToDelete = existingItems.map(item => ({
      delete: true,
      retailerProductId: parseInt(item.retailerProductId, 10),
      isCase: false,
      type: 1
    }));
    
    const deleteRequestBody = {
      lines: linesToDelete,
      deliveryProduct_Id: 16388534,
      deliveryType: 2
    };
    
    // שליחת בקשה למחיקת פריטים
    const deleteResponse = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN]}`,
          'Accept': 'application/json, text/plain, */*',
          'X-HTTP-Method-Override': 'PATCH'
        },
        body: JSON.stringify(deleteRequestBody)
      }
    );
    
    // בדיקה אם יש פריטים לא פעילים שיש להסיר
    if (deleteResponse.inactiveLines && deleteResponse.inactiveLines.length > 0) {
      await removeInactiveCartItems(deleteResponse.inactiveLines);
    }
    
    return true;
  } catch (error) {
    console.error('שגיאה בריקון העגלה:', error);
    return false;
  }
}

/**
 * הסרת פריטים לא פעילים מהעגלה
 * @param {Array<Object>} inactiveItems - פריטים לא פעילים להסרה
 * @returns {Promise<boolean>} האם ההסרה הצליחה
 */
export async function removeInactiveCartItems(inactiveItems) {
  if (!inactiveItems || inactiveItems.length === 0) {
    return true;
  }
  
  try {
    const cartData = await getCartData();
    
    if (!cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN] || !cartData[CONFIG.STORAGE_KEYS.CART_DETAILS]) {
      throw new Error('חסרים נתוני אימות הדרושים להסרת פריטים לא פעילים');
    }
    
    const cartDetails = cartData[CONFIG.STORAGE_KEYS.CART_DETAILS];
    const apiUrl = formatApiUrl(CONFIG.API.CART_V2_API_URL_TEMPLATE, {
      retailerId: cartDetails.retailerId,
      branchId: cartDetails.branchId,
      cartId: cartDetails.cartId,
      appId: cartDetails.appId || '4'
    });
    
    const linesToDelete = inactiveItems.map(item => ({
      delete: true,
      retailerProductId: parseInt(item.retailerProductId, 10),
      isCase: false,
      type: 1
    }));
    
    const requestBody = {
      lines: linesToDelete,
      deliveryProduct_Id: 16388534,
      deliveryType: 2
    };
    
    await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN]}`,
          'Accept': 'application/json, text/plain, */*',
          'X-HTTP-Method-Override': 'PATCH'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    return true;
  } catch (error) {
    console.error('שגיאה בהסרת פריטים לא פעילים:', error);
    return false;
  }
}

/**
 * הוספת מוצר לעגלה לפי מזהה מוצר
 * @param {string} productId - מזהה המוצר
 * @param {number} quantity - הכמות להוספה
 * @returns {Promise<boolean>} האם ההוספה הצליחה
 */
export async function addProductToCart(productId, quantity) {
  try {
    // Validate quantity - don't proceed with Carrefour API call if quantity is 0
    if (quantity <= 0) {
      console.warn('לא ניתן להוסיף מוצר עם כמות 0 או שלילית');
      return false;
    }

    const cartData = await getCartData();
    
    if (!cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN] || !cartData[CONFIG.STORAGE_KEYS.CART_DETAILS]) {
      throw new Error('חסרים נתוני אימות הדרושים להוספת מוצר');
    }
    
    const cartDetails = cartData[CONFIG.STORAGE_KEYS.CART_DETAILS];
    const apiUrl = formatApiUrl(CONFIG.API.CART_V2_API_URL_TEMPLATE, {
      retailerId: cartDetails.retailerId,
      branchId: cartDetails.branchId,
      cartId: cartDetails.cartId,
      appId: cartDetails.appId || '4'
    });
    
    // המרת מזהה המוצר למספר שלם
    const retailerProductIdNumber = parseInt(productId, 10);
    
    const requestBody = {
      lines: [
        {
          quantity: quantity,
          soldBy: null,
          retailerProductId: retailerProductIdNumber,
          type: 1
        }
      ],
      source: "importCSV",
      deliveryProduct_Id: 16388534,
      deliveryType: 2
    };
    
    await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${cartData[CONFIG.STORAGE_KEYS.AUTH_TOKEN]}`,
          'Accept': 'application/json, text/plain, */*',
          'X-HTTP-Method-Override': 'PATCH'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    return true;
  } catch (error) {
    console.error('שגיאה בהוספת מוצר לעגלה:', error);
    return false;
  }
}

/**
 * חיפוש מוצר לפי שם או ברקוד
 * @param {string} searchTerm - מונח החיפוש (שם או ברקוד)
 * @returns {Promise<Array<Object>|null>} תוצאות החיפוש או null אם אין תוצאות
 */
export async function searchProduct(searchTerm) {
  try {
    const url = `${CONFIG.API.SEARCH_API_URL}?search=${encodeURIComponent(searchTerm)}`;
    
    const response = await fetchWithTimeout(url);
    
    if (response && response.products && response.products.length > 0) {
      return response.products;
    }
    
    return null;
  } catch (error) {
    console.error('שגיאה בחיפוש מוצר:', error);
    return null;
  }
}

export default {
  getCurrentCart,
  clearCart,
  addProductToCart,
  searchProduct,
  removeInactiveCartItems
}; 