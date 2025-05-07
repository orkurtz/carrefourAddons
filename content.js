// משתנים גלובליים לתהליך ייבוא המוצרים
let fileInput = null;
let progressDialog = null;
let progressTitle = null;
let progressStatus = null;
let progressFill = null;
let closeButton = null;
let csvData = [];
let fixedRows = [];
let headers = [];
let nameIndex = -1;
let barcodeIndex = -1;
let quantityIndex = -1;
let linkIndex = -1;
let productIdIndex = -1;
let retailerProductIdIndex = -1;
let currentIndex = 0;

// בדיקה אם אנחנו בדף של Carrefour
if (window.location.href.includes('carrefour.co.il')) {
  // הגדלת חשיבות ההודעה כדי לוודא שהדפדפן רואה אותה ב-console
  console.log('%c CARREFOUR EXTENSION LOADED ', 'background: #f39200; color: white; font-size: 16px;', window.location.href);
  
  // רישום זיהוי חד ערכי של המופע של הסקריפט כדי לוודא שיש לנו גישה
  const scriptId = Math.random().toString(36).substring(2, 15);
  console.log('content.js: מזהה מופע סקריפט:', scriptId);
  
  // כדי לבדוק אם ה-content script נטען כמצופה
  document.documentElement.dataset.carrefourExtensionActive = scriptId;
  
  // יצירת אלמנט דיבאג שמסייע לעקוב אחר פעולת הסקריפט
  const debugElement = document.createElement('div');
  debugElement.id = 'carrefour-extension-debug';
  debugElement.style.position = 'fixed';
  debugElement.style.bottom = '10px';
  debugElement.style.right = '10px';
  debugElement.style.zIndex = '10000';
  debugElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
  debugElement.style.color = 'white';
  debugElement.style.padding = '5px';
  debugElement.style.fontSize = '10px';
  debugElement.style.borderRadius = '3px';
  debugElement.style.display = 'none';
  debugElement.textContent = `סקריפט פעיל (${scriptId})`;
  document.body.appendChild(debugElement);
  
  // בדיקה והוספה של כפתור הייצוא
  if (window.location.href.includes('/cart')) {
    // אנחנו בדף העגלה, נוסיף את הכפתור
    addExportButton();
  }
  
  // להציג את אלמנט הדיבאג באלט+D
  document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'd') {
      debugElement.style.display = debugElement.style.display === 'none' ? 'block' : 'none';
    }
  });
  
  // האזנה להודעות מהחלון הקופץ
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(`content.js (${scriptId}): התקבלה הודעה:`, request);
    debugElement.textContent = `התקבלה הודעה: ${request.action} (${new Date().toLocaleTimeString()})`;
    debugElement.style.display = 'block'; // מציג את אלמנט הדיבאג בעת קבלת הודעה
    
    try {
      if (request.action === "exportCart") {
        console.log('content.js: התקבלה בקשה לייצוא עגלה מהחלון הקופץ');
        debugElement.textContent += ' - מתחיל ייצוא';
        
        // ייתכן שאנחנו לא בדף העגלה - נבדוק
        if (!window.location.href.includes('/cart')) {
          console.log('לא נמצאים בדף העגלה, ננסה לעבור לדף העגלה תחילה');
          // נשמור את הפעולה באחסון מקומי ונעבור לדף העגלה
          chrome.storage.local.set({ 'carrefour_pending_action': 'export' }, function() {
            window.location.href = 'https://www.carrefour.co.il/cart/';
            // לא נשלח תשובה מיד, כי אנחנו עוברים לדף אחר
            sendResponse({status: 'redirecting'});
          });
        } else {
          // אנחנו בדף העגלה, נבצע את הייצוא מיד
          exportCartToCsv();
          sendResponse({status: 'ok'});
        }
        return true;
      }
      else if (request.action === "importCart") {
        console.log('content.js: התקבלה בקשה לייבוא עגלה מהחלון הקופץ', 
          request.data ? `(${request.data.length} פריטים)` : '(ללא נתונים)');
        debugElement.textContent += ' - מתחיל ייבוא';
        
        if (request.data && Array.isArray(request.data) && request.data.length > 1) {
          importCartFromCsv(request.data);
          sendResponse({status: 'started'});
        } else {
          console.error('content.js: נתוני CSV לא תקינים:', request.data);
          sendResponse({error: 'נתונים לא תקינים'});
        }
        return true;
      }
      else {
        console.log('content.js: התקבלה פעולה לא מוכרת:', request.action);
        sendResponse({error: 'פעולה לא מוכרת'});
        return true;
      }
    } catch (error) {
      console.error('content.js: שגיאה בעת טיפול בהודעה:', error);
      debugElement.textContent += ` - שגיאה: ${error.message}`;
      sendResponse({error: error.message});
      return true;
    }
  });
  
  // בדיקה האם יש פעולה ממתינה לביצוע (לאחר מעבר לדף אחר)
  chrome.storage.local.get(['carrefour_pending_action', 'carrefour_csv_import_data'], function(data) {
    if (data.carrefour_pending_action === 'export' && window.location.href.includes('/cart')) {
      console.log('נמצאה פעולת ייצוא ממתינה, מבצע');
      // נקה את הפעולה הממתינה
      chrome.storage.local.remove(['carrefour_pending_action']);
      // מתחיל בייצוא
      setTimeout(exportCartToCsv, 1000);
    }
    else if (data.carrefour_csv_import_data) {
      console.log('content.js: נמצאו נתוני ייבוא מאוחסנים:', data.carrefour_csv_import_data.length);
      // יש לנו נתונים מאוחסנים, נתחיל את הייבוא אוטומטית
      if (confirm('נמצאו נתוני ייבוא CSV שטרם יובאו. האם להתחיל בייבוא כעת?')) {
        importCartFromCsv(data.carrefour_csv_import_data);
        // נקה את הנתונים המאוחסנים
        chrome.storage.local.remove(['carrefour_csv_import_data']);
      } else {
        // נקה את הנתונים המאוחסנים
        chrome.storage.local.remove(['carrefour_csv_import_data']);
      }
    }
  });
  
  // הוספת כפתור הייצוא לדף
  function addExportButton() {
    if (document.getElementById('carrefour-export-csv')) {
      return;
    }
    
    console.log('מוסיף כפתור ייצוא לדף העגלה');
    
    const button = document.createElement('button');
    button.id = 'carrefour-export-csv';
    button.textContent = 'ייצא לקובץ CSV';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#f39200'; // צבע קרפור
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = 'bold';
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    
    button.addEventListener('mouseenter', function() {
      this.style.backgroundColor = '#e58a00';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '#f39200';
    });
    
    document.body.appendChild(button);
    
    button.addEventListener('click', exportCartToCsv);
    console.log('כפתור ייצוא CSV נוסף לדף העגלה');
  }

  // פונקציית הייצוא לCSV
  async function exportCartToCsv() {
    try {
      // עדכון הכפתור למצב טעינה
      const button = document.getElementById('carrefour-export-csv');
      if (button) {
        button.disabled = true;
        button.textContent = 'טוען...';
        button.style.backgroundColor = '#aaa';
      }
      
      debugElement.style.display = 'block';
      debugElement.textContent = 'מבקש נתוני עגלה מסקריפט הרקע...';
      
      // בקשת מידע מסקריפט הרקע
      console.log('content.js: שולח בקשה לקבלת נתוני עגלה מסקריפט הרקע');
      
      let data;
      try {
        data = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('פסק זמן בבקשת נתוני עגלה'));
          }, 5000); // 5 שניות לטיים-אאוט
          
          chrome.runtime.sendMessage({action: "getCartData"}, response => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(new Error('תקלה בתקשורת עם סקריפט הרקע: ' + chrome.runtime.lastError.message));
            } else if (!response) {
              reject(new Error('לא התקבלה תשובה מסקריפט הרקע'));
            } else {
              resolve(response);
            }
          });
        });
      } catch (err) {
        console.error('content.js: שגיאה בקבלת נתוני עגלה:', err);
        debugElement.textContent = 'שגיאה בקבלת נתוני עגלה: ' + err.message;
        alert('שגיאה בקבלת נתוני עגלה: ' + err.message);
        resetButton();
        return;
      }
      
      console.log('content.js: התקבלה תשובה מסקריפט הרקע:', {
        hasAuthToken: !!data.carrefour_auth_token,
        hasCartDetails: !!data.carrefour_cart_details,
        hasXAuthToken: !!data.carrefour_token
      });
      
      if (!data) {
        const errMsg = 'לא התקבלו נתונים משירות הרקע';
        console.error('content.js:', errMsg);
        debugElement.textContent = errMsg;
        alert(errMsg + '. נסה לרענן את הדף ולנסות שוב.');
        resetButton();
        return;
      }
      
      if (!data.carrefour_auth_token || !data.carrefour_cart_details) {
        // נבדוק אם יש לנו X-Auth-Token
        if (!data.carrefour_token) {
          const errMsg = 'לא נמצאו נתוני עגלה או טוקן אימות';
          console.error('content.js:', errMsg);
          debugElement.textContent = errMsg;
          alert(errMsg + '. נסה לבצע פעולה בעגלה, לרענן את הדף ולנסות שוב.');
          resetButton();
          return;
        }
        
        // אם יש לנו רק X-Auth-Token, ננסה להשתמש בו
        debugElement.textContent = 'נמצא טוקן X-Auth בלבד. מנסה להשתמש בו...';
        console.log('content.js: נמצא רק טוקן X-Auth, מנסה לבקש את העגלה ישירות');
        
        // נסיון לקבל את פרטי העגלה ישירות דרך ה-API של העגלה
        try {
          const cartApiUrl = 'https://www.carrefour.co.il/api/v1/cart';
          const cartResponse = await fetch(cartApiUrl, {
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': data.carrefour_token
            }
          });
          
          if (!cartResponse.ok) {
            throw new Error(`שגיאת API: ${cartResponse.status} ${cartResponse.statusText}`);
          }
          
          const cartData = await cartResponse.json();
          console.log('content.js: התקבלו נתוני עגלה ישירות:', cartData);
          
          // עיבוד התשובה - נוסח אחר של ה-API
          if (!cartData.items || cartData.items.length === 0) {
            alert('העגלה ריקה או שלא התקבל מידע תקין');
            resetButton();
            return;
          }
          
          const result = cartData.items.map(item => {
            // חילוץ מזהי המוצר
            const productId = item.product?.productId || item.product?.id || '';
            const retailerProductId = item.product?.retailerProductId || item.product?.id || '';
            
            return {
              שם: item.product?.name || '',
              ברקוד: item.product?.barcode || '',
              כמות: item.quantity || 1,
              מחיר: item.product?.price || 0,
              'סה"כ': (item.quantity * item.product?.price) || 0,
              קישור: `https://www.carrefour.co.il/product/${item.product?.id || ''}`,
              productId: productId,  // מזהה המוצר
              retailerProductId: retailerProductId  // מזהה הספק של המוצר
            };
          });
          
          // המשך לייצוא ה-CSV כרגיל
          exportResultToCsv(result);
          return;
        } catch (apiError) {
          console.error('content.js: שגיאה בניסיון לקבל נתוני עגלה ישירות:', apiError);
          debugElement.textContent = 'שגיאה בניסיון ישיר: ' + apiError.message;
          // ממשיכים לבדיקה הרגילה
        }
      }
      
      const authToken = data.carrefour_auth_token;
      const cartDetails = data.carrefour_cart_details;
      
      debugElement.textContent = 'התקבלו נתוני עגלה, שולח בקשה ל-API...';
      console.log('content.js: התקבלו נתוני עגלה:', cartDetails);
      
      // בניית URL לבקשה
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId}`;
      
      console.log('content.js: שולח בקשה אל:', apiUrl);
      
      // ביצוע הבקשה
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Authorization": `Bearer ${authToken}`,
          "Accept": "application/json, text/plain, */*",
          "X-HTTP-Method-Override": "PATCH"
        },
        credentials: "include",
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        debugElement.textContent = `שגיאת API: ${response.status} ${response.statusText}`;
        throw new Error(`שגיאת API: ${response.status} ${response.statusText}`);
      }
      
      const raw = await response.json();
      debugElement.textContent = 'התקבלו נתוני עגלה מה-API';
      console.log('content.js: התקבלו נתוני עגלה מה-API');
      
      // עיבוד התשובה
      const lines = raw.cart.lines;
      
      if (!lines || lines.length === 0) {
        debugElement.textContent = 'העגלה ריקה או שלא התקבל מידע';
        alert('העגלה ריקה או שלא התקבל מידע');
        resetButton();
        return;
      }

      const result = lines
        .filter(item => !item.text.includes("איסוף עצמי")) // דילוג על מוצרים לא רלוונטיים
        .map(item => {
          // גישה בטוחה למזהי המוצר
          const productId = item.product?.productId || '';
          const retailerProductId = item.product?.id || item.retailerProductId || '';
          
          return {
            שם: item.text || '',
            ברקוד: item.barcode || '',
            כמות: item.quantity || 1,
            מחיר: item.unitPrice || 0,
            'סה"כ': item.totalPrice || 0,
            קישור: `https://www.carrefour.co.il/?catalogProduct=${productId}`,
            productId: productId,  // מזהה המוצר
            retailerProductId: retailerProductId  // מזהה הספק של המוצר
          };
        });

      console.log(`content.js: נמצאו ${result.length} מוצרים בעגלה`);
      debugElement.textContent = `נמצאו ${result.length} מוצרים בעגלה, מכין קובץ CSV`;

      // ייצוא המידע ל-CSV
      exportResultToCsv(result);
      
    } catch (error) {
      console.error("content.js: שגיאה:", error);
      debugElement.textContent = `שגיאה: ${error.message}`;
      alert(`שגיאה: ${error.message}`);
      resetButton();
    }
  }
  
  // פונקציית עזר לייצוא תוצאות ל-CSV
  function exportResultToCsv(result) {
    try {
      // הוספת עיבוד לפני יצירת ה-CSV - וידוא שיש את כל השדות הנכונים
      const processedResult = result.map(item => {
        // וידוא שיש שדה productId
        if (!item.productId && item.retailerProductId) {
          item.productId = item.retailerProductId;
        }
        return item;
      });
      
      // יצירת קובץ CSV
      const headers = Object.keys(processedResult[0]).join(',');
      const rows = processedResult.map(obj => Object.values(obj).map(val =>
        `"${String(val || '').replace(/"/g, '""')}"`
      ).join(','));
      const csvContent = [headers, ...rows].join('\n');

      debugElement.textContent = `יצירת קובץ להורדה (${processedResult.length} מוצרים)`;
      
      // הורדת הקובץ
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "carrefour_products.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('content.js: קובץ CSV הורד בהצלחה');
      debugElement.textContent = 'קובץ CSV הורד בהצלחה';
      
      resetButton("ייצוא הושלם!");
      
      setTimeout(() => {
        resetButton();
      }, 2000);
    } catch (error) {
      console.error("content.js: שגיאה בייצוא ל-CSV:", error);
      debugElement.textContent = `שגיאה בייצוא ל-CSV: ${error.message}`;
      alert(`שגיאה בייצוא ל-CSV: ${error.message}`);
      resetButton();
    }
  }
  
  // פונקציה לייבוא מוצרים מקובץ CSV לעגלה
  async function importCartFromCsv(csvData) {
    console.log('מתחיל בייבוא מוצרים מקובץ CSV', csvData.length);
    
    // יוצר דיאלוג התקדמות
    const progressModal = document.createElement('div');
    progressModal.id = 'import-progress-modal';
    progressModal.style.position = 'fixed';
    progressModal.style.top = '50%';
    progressModal.style.left = '50%';
    progressModal.style.transform = 'translate(-50%, -50%)';
    progressModal.style.backgroundColor = 'white';
    progressModal.style.padding = '20px';
    progressModal.style.borderRadius = '8px';
    progressModal.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    progressModal.style.zIndex = '10000';
    progressModal.style.minWidth = '300px';
    progressModal.style.direction = 'rtl';
    
    const progressTitle = document.createElement('h3');
    progressTitle.textContent = 'מייבא מוצרים לעגלה...';
    progressTitle.style.margin = '0 0 15px 0';
    progressTitle.style.color = '#333';
    
    const progressBar = document.createElement('div');
    progressBar.style.width = '100%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#f0f0f0';
    progressBar.style.borderRadius = '10px';
    progressBar.style.overflow = 'hidden';
    
    const progressFill = document.createElement('div');
    progressFill.style.width = '0%';
    progressFill.style.height = '100%';
    progressFill.style.backgroundColor = '#f39200';
    progressFill.style.transition = 'width 0.3s';
    
    const progressStatus = document.createElement('div');
    progressStatus.textContent = 'מתחיל בייבוא... (0/' + (csvData.length - 1) + ')';
    progressStatus.style.marginTop = '10px';
    progressStatus.style.fontSize = '14px';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'סגור';
    closeButton.style.marginTop = '15px';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#f0f0f0';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.display = 'none'; // יוצג רק בסיום
    
    closeButton.addEventListener('click', function() {
      document.body.removeChild(progressModal);
    });
    
    progressBar.appendChild(progressFill);
    progressModal.appendChild(progressTitle);
    progressModal.appendChild(progressBar);
    progressModal.appendChild(progressStatus);
    progressModal.appendChild(closeButton);
    
    document.body.appendChild(progressModal);
    
    // הכנת נתוני ה-CSV לעיבוד
    // שורה ראשונה מכילה כותרות
    const headers = csvData[0];
    const productRows = csvData.slice(1);
    
    console.log('כותרות הקובץ:', headers);
    
    // טיפול במקרה שיש כותרות שמכילות פסיקים - פיצול כותרות ומיזוג עמודות
    // בדיקה אם יש כותרת ארוכה שמכילה פסיקים
    let fixedHeaders = [...headers];
    let columnsToMerge = [];
    
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes(',')) {
        // מצאנו כותרת שמכילה פסיקים בתוכה
        console.log('נמצאה כותרת עם פסיקים:', headers[i]);
        
        // פיצול הכותרת לכותרות נפרדות
        const splitHeaders = headers[i].split(',');
        
        // מחליף את הכותרת הנוכחית עם הראשונה מהפיצול
        fixedHeaders[i] = splitHeaders[0];
        
        // מוסיף את שאר הכותרות כעמודות חדשות
        for (let j = 1; j < splitHeaders.length; j++) {
          fixedHeaders.push(splitHeaders[j]);
          
          // שומר את המיקום של העמודות ששייכות למיזוג
          columnsToMerge.push(fixedHeaders.length - 1);
        }
      }
    }
    
    // עדכון השורות אם היה צורך במיזוג עמודות
    let fixedRows = productRows;
    if (columnsToMerge.length > 0) {
      console.log('מתקן מבנה נתונים - מוסיף עמודות:', columnsToMerge);
      
      fixedRows = productRows.map(row => {
        const newRow = [...row];
        // מוסיף ערכים ריקים לעמודות החדשות
        for (let i = 0; i < columnsToMerge.length; i++) {
          newRow.push('');
        }
        return newRow;
      });
    }
    
    console.log('כותרות מתוקנות:', fixedHeaders);
    
    // נמצא את האינדקסים של העמודות החשובות בכותרות המתוקנות
    const nameIndex = fixedHeaders.findIndex(h => 
      h === 'product_name' || 
      h === 'שם מוצר' || 
      h === 'שם' || 
      h === 'name' || 
      h.includes('שם') ||
      h.includes('name')
    );

    const barcodeIndex = fixedHeaders.findIndex(h => 
      h === 'barcode' || 
      h === 'ברקוד' || 
      h.includes('ברקוד') ||
      h.includes('barcode')
    );

    const quantityIndex = fixedHeaders.findIndex(h => 
      h === 'quantity' || 
      h === 'כמות' || 
      h === 'qty' || 
      h.includes('כמות') ||
      h.includes('quantity')
    );

    const linkIndex = fixedHeaders.findIndex(h => 
      h === 'product_link' || 
      h === 'קישור מוצר' || 
      h === 'קישור' || 
      h === 'link' || 
      h.includes('קישור') ||
      h.includes('link')
    );

    // חיפוש עמודת מזהה מוצר
    const productIdIndex = fixedHeaders.findIndex(h => 
      h === 'productId' ||
      h === 'product_id' ||
      h === 'מזהה מוצר' ||
      h.includes('product') && h.includes('id')
    );

    // חיפוש עמודת מזהה ספק
    const retailerProductIdIndex = fixedHeaders.findIndex(h => 
      h === 'retailerProductId' ||
      h === 'retailer_product_id' ||
      h === 'מזהה ספק' ||
      h.includes('retailer') && h.includes('id')
    );

    console.log('אינדקסים של עמודות:', { 
      nameIndex, 
      barcodeIndex, 
      quantityIndex, 
      linkIndex, 
      productIdIndex, 
      retailerProductIdIndex 
    });

    // אם לא מצאנו עמודת שם מוצר, ננסה להשתמש בעמודה הראשונה
    if (nameIndex === -1 && fixedHeaders.length > 0) {
      console.log('לא נמצאה עמודת שם מוצר, משתמש בעמודה הראשונה:', fixedHeaders[0]);
      nameIndex = 0;
    }

    // אם לא מצאנו עמודת כמות, ננסה להשתמש בכל עמודה מספרית
    if (quantityIndex === -1) {
      // מחפש עמודה שיש בה מספרים
      for (let i = 0; i < fixedHeaders.length; i++) {
        if (i !== nameIndex && i !== barcodeIndex && i !== linkIndex) {
          // בודק אם בשורה הראשונה יש מספר בעמודה הזו
          if (fixedRows.length > 0 && !isNaN(parseFloat(fixedRows[0][i]))) {
            console.log('נמצאה עמודה מספרית שיכולה להיות כמות:', fixedHeaders[i]);
            quantityIndex = i;
            break;
          }
        }
      }
    }

    // בדיקה שמצאנו את העמודות הדרושות
    if (nameIndex === -1) {
      progressStatus.textContent = 'שגיאה: לא נמצאה עמודת שם מוצר בקובץ';
      progressTitle.textContent = 'שגיאה בייבוא';
      progressFill.style.backgroundColor = 'red';
      closeButton.style.display = 'block';
      console.error('לא נמצאה עמודת שם מוצר בקובץ ה-CSV');
      return;
    }

    if (quantityIndex === -1) {
      // במקרה שלא נמצאה עמודת כמות, נשתמש בכמות 1 לכל המוצרים
      console.warn('לא נמצאה עמודת כמות, משתמש בכמות ברירת מחדל של 1');
      progressStatus.textContent = 'אזהרה: לא נמצאה עמודת כמות, משתמש בכמות 1';
    }
    
    // לולאה שמוסיפה את המוצרים אחד אחרי השני
    let currentIndex = 0;
    
    function addNextProduct() {
      if (currentIndex >= fixedRows.length) {
        // סיימנו להוסיף את כל המוצרים
        progressTitle.textContent = 'הייבוא הושלם בהצלחה';
        progressStatus.textContent = 'כל המוצרים יובאו לעגלה (' + currentIndex + '/' + fixedRows.length + ')';
        closeButton.style.display = 'block';
        return;
      }
      
      const row = fixedRows[currentIndex];
      
      // אם השורה ריקה או לא מערך, נדלג עליה
      if (!row || !Array.isArray(row) || row.length === 0) {
        console.warn('דילוג על שורה לא תקינה:', row);
        currentIndex++;
        setTimeout(addNextProduct, 100);
        return;
      }
      
      const productName = row[nameIndex] || '';
      const barcode = barcodeIndex !== -1 ? row[barcodeIndex] : '';
      
      // טיפול בכמות - אם לא נמצאה עמודת כמות, נשתמש בכמות 1
      let quantity = 1;
      if (quantityIndex !== -1) {
        // נסיון לחלץ מספר מהערך בעמודת הכמות
        const rawQuantity = row[quantityIndex];
        if (rawQuantity !== undefined && rawQuantity !== null) {
          // אם זה מחרוזת, ננסה להמיר למספר
          if (typeof rawQuantity === 'string') {
            // מחליף פסיק בנקודה (במקרה של מספרים עשרוניים בפורמט עברי)
            const normalizedQuantity = rawQuantity.replace(',', '.');
            quantity = parseFloat(normalizedQuantity) || 1;
          } else if (typeof rawQuantity === 'number') {
            quantity = rawQuantity;
          }
          
          // וידוא שהכמות היא מספר חיובי
          quantity = Math.max(1, Math.round(quantity));
        }
      }
      
      const productLink = row[linkIndex] || '';
      
      // חילוץ מזהי מוצר
      const productId = productIdIndex !== -1 ? row[productIdIndex] : '';
      const retailerProductId = retailerProductIdIndex !== -1 ? row[retailerProductIdIndex] : '';
      
      // אם אין שם מוצר, נדלג על השורה
      if (!productName && !productId && !retailerProductId) {
        console.warn('דילוג על שורה ללא זיהוי מוצר:', row);
        currentIndex++;
        setTimeout(addNextProduct, 100);
        return;
      }
      
      console.log('מוסיף מוצר:', { 
        productName, 
        productId, 
        retailerProductId, 
        barcode, 
        quantity, 
        productLink 
      });
      
      // עדכון התקדמות
      const progress = Math.round((currentIndex + 1) / fixedRows.length * 100);
      progressFill.style.width = progress + '%';
      progressStatus.textContent = 'מוסיף: ' + productName + ' (' + (currentIndex + 1) + '/' + fixedRows.length + ')';
      
      // לוגיקת הוספה לעגלה - סדר העדיפויות:
      // 1. retailerProductId - מזהה הספק של המוצר (עדיפות ראשונה)
      // 2. productId - מזהה המוצר
      // 3. קישור מוצר
      // 4. ברקוד
      // 5. שם מוצר
      
      if (retailerProductId) {
        // יש לנו retailerProductId ישיר, נשתמש בו - זה המזהה הנכון להוספה!
        addProductById(retailerProductId, quantity, function(success) {
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (productId) {
        // יש לנו מזהה מוצר אחר, נשתמש בו
        addProductById(productId, quantity, function(success) {
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (productLink && productLink.includes('carrefour.co.il')) {
        // יש לנו קישור למוצר, נשתמש בו (רק אם נראה כמו קישור תקין)
        addProductByLink(productLink, quantity, function(success) {
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (barcode) {
        // יש לנו ברקוד, ננסה להשתמש בו
        addProductByBarcode(barcode, quantity, function(success) {
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else {
        // יש לנו רק שם, ננסה לחפש את המוצר
        addProductByName(productName, quantity, function(success) {
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      }
    }
    
    // התחל את תהליך ההוספה
    setTimeout(addNextProduct, 500);
  }
  
  // פונקציה שמוסיפה מוצר לעגלה באמצעות קישור ישיר
  function addProductByLink(productLink, quantity, callback) {
    console.log('מוסיף מוצר לפי קישור:', productLink);
    
    // חילוץ מזהה המוצר מהקישור
    const productId = extractProductIdFromLink(productLink);
    if (!productId) {
      console.error('לא הצלחנו לחלץ מזהה מוצר מהקישור:', productLink);
      callback(false);
      return;
    }
    
    // שימוש בפונקציה הקיימת להוספת מוצר לפי מזהה
    // כך נמנע מכפילות קוד ומבטיחים שהשינויים מיושמים בשני המקומות
    addProductById(productId, quantity, callback);
  }

  // פונקציה שמוסיפה מוצר לעגלה באמצעות ברקוד
  function addProductByBarcode(barcode, quantity, callback) {
    console.log('מוסיף מוצר לפי ברקוד:', barcode);
    
    // חיפוש מוצר לפי ברקוד
    fetch(`https://www.carrefour.co.il/api/v1/products/search?search=${barcode}`)
      .then(response => response.json())
      .then(data => {
        if (data && data.products && data.products.length > 0) {
          const productId = data.products[0].id;
          addProductByLink(`https://www.carrefour.co.il/product/${productId}`, quantity, callback);
        } else {
          console.error('לא נמצא מוצר עם ברקוד:', barcode);
          callback(false);
        }
      })
      .catch(error => {
        console.error('שגיאה בחיפוש מוצר לפי ברקוד:', error);
        callback(false);
      });
  }

  // פונקציה שמוסיפה מוצר לעגלה באמצעות שם
  function addProductByName(productName, quantity, callback) {
    console.log('מוסיף מוצר לפי שם:', productName);
    
    // חיפוש מוצר לפי שם
    fetch(`https://www.carrefour.co.il/api/v1/products/search?search=${encodeURIComponent(productName)}`)
      .then(response => response.json())
      .then(data => {
        if (data && data.products && data.products.length > 0) {
          const productId = data.products[0].id;
          addProductByLink(`https://www.carrefour.co.il/product/${productId}`, quantity, callback);
        } else {
          console.error('לא נמצא מוצר עם שם:', productName);
          callback(false);
        }
      })
      .catch(error => {
        console.error('שגיאה בחיפוש מוצר לפי שם:', error);
        callback(false);
      });
  }

  // פונקציה שמחלצת מזהה מוצר מקישור
  function extractProductIdFromLink(link) {
    try {
      // בדיקה אם הקישור מכיל מזהה מוצר
      const match = link.match(/\/product\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      // גם ננסה למצוא מזהה בחלק האחרון של ה-URL
      const parts = link.split('/');
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        return lastPart;
      }
      
      return null;
    } catch (error) {
      console.error('שגיאה בחילוץ מזהה מוצר מקישור:', error);
      return null;
    }
  }
  
  function resetButton(text = 'ייצא לקובץ CSV') {
    const button = document.getElementById('carrefour-export-csv');
    if (button) {
      button.disabled = false;
      button.textContent = text;
      button.style.backgroundColor = '#f39200';
    }
  }
  
  // פונקציה שמוסיפה מוצר לעגלה באמצעות מזהה מוצר (Product ID)
  function addProductById(productId, quantity, callback) {
    console.log('מוסיף מוצר לפי מזהה מוצר (Product ID):', productId);
    
    // בקשת מידע מסקריפט הרקע - בדיוק כמו בפונקציית exportCartToCsv
    // שימוש בפרומיס כדי לאפשר async/await בדיוק כמו בייצוא
    (async function() {
      try {
        let data;
        try {
          data = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('פסק זמן בבקשת נתוני טוקן'));
            }, 5000); // 5 שניות לטיים-אאוט
            
            chrome.runtime.sendMessage({action: "getCartData"}, response => {
              clearTimeout(timeoutId);
              if (chrome.runtime.lastError) {
                reject(new Error('תקלה בתקשורת עם סקריפט הרקע: ' + chrome.runtime.lastError.message));
              } else if (!response) {
                reject(new Error('לא התקבלה תשובה מסקריפט הרקע'));
              } else {
                resolve(response);
              }
            });
          });
        } catch (err) {
          console.error('שגיאה בקבלת נתוני טוקן:', err);
          callback(false);
          return;
        }
        
        console.log('התקבלה תשובה מסקריפט הרקע:', {
          hasAuthToken: !!data.carrefour_auth_token,
          hasCartDetails: !!data.carrefour_cart_details,
          hasXAuthToken: !!data.carrefour_token
        });
        
        if (!data) {
          console.error('לא התקבלו נתונים משירות הרקע');
          callback(false);
          return;
        }
        
        // בדיקה אם יש לנו את הטוקן ופרטי העגלה הנדרשים
        if (!data.carrefour_auth_token || !data.carrefour_cart_details) {
          console.error('חסרים נתוני טוקן או עגלה - צריך את שניהם להוספת מוצר');
          callback(false);
          return;
        }
        
        // קבלת הטוקן ופרטי העגלה
        const authToken = data.carrefour_auth_token;
        const cartDetails = data.carrefour_cart_details;
        
        console.log('נתוני עגלה שהתקבלו:', cartDetails);
        
        // וידוא שיש לנו את כל הפרמטרים הנדרשים
        if (!cartDetails.retailerId || !cartDetails.branchId || !cartDetails.cartId) {
          console.error('חסרים פרטי עגלה חיוניים לביצוע הבקשה:', cartDetails);
          callback(false);
          return;
        }
        
        // בניית URL לבקשה עם הפרמטרים המתאימים
        const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId || 4}`;
        
        console.log('שולח בקשה להוספת מוצר לעגלה אל:', apiUrl);
        
        // המרת מזהה המוצר למספר שלם (מאד חשוב!)
        const retailerProductIdNumber = parseInt(productId, 10);
        
        // בניית גוף הבקשה בדיוק כמו בבקשה האמיתית
        const requestBody = {
          lines: [
            {
              quantity: quantity,
              soldBy: null,
              retailerProductId: retailerProductIdNumber, // כמספר שלם, לא כמחרוזת
              type: 1
            }
          ],
          source: "importCSV", // מקור הבקשה - מציין שזה מייבוא CSV
          deliveryProduct_Id: 16388534,
          deliveryType: 2
        };
        
        console.log('גוף הבקשה:', requestBody);
        
        // שליחת הבקשה בדיוק באותו פורמט שמשתמש האתר
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "Authorization": `Bearer ${authToken}`,
            "Accept": "application/json, text/plain, */*",
            "X-HTTP-Method-Override": "PATCH"  // חשוב להעביר את השיטה האמיתית
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          console.log('המוצר נוסף בהצלחה לעגלה:', productId);
          try {
            const responseData = await response.json();
            console.log('תשובה מהשרת:', responseData);
            
            // בדיקה אם יש שורות לא פעילות
            if (responseData.inactiveLines && responseData.inactiveLines.length > 0) {
              console.warn('שים לב: יש שורות לא פעילות בתשובה:', responseData.inactiveLines);
            }
            
          } catch (parseError) {
            console.log('לא ניתן לקרוא את תשובת השרת המלאה');
          }
          callback(true);
        } else {
          console.error('שגיאה בהוספת המוצר לעגלה:', response.status);
          try {
            const errorData = await response.text();
            console.error('פרטי שגיאה:', errorData);
          } catch (parseError) {
            console.error('לא ניתן לקרוא את פרטי השגיאה');
          }
          callback(false);
        }
      } catch (error) {
        console.error('שגיאה כללית בתהליך הוספת המוצר:', error);
        callback(false);
      }
    })();
  }
  
  // מחכה שהדף יסיים לטעון ואז מוסיף את הכפתור
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportButton);
  } else {
    addExportButton();
  }
} 

function processCSV(csvText) {
  // חלוקה לשורות
  const lines = csvText.split('\n');
  if (lines.length === 0) {
    alert('הקובץ ריק');
    return;
  }

  // טיפול בשורת הכותרות
  const headerLine = lines[0].trim();
  headers = parseCSVLine(headerLine);
  console.log('כותרות CSV:', headers);

  // איתור אינדקסים של עמודות חשובות
  nameIndex = -1;
  barcodeIndex = -1;
  quantityIndex = -1;
  linkIndex = -1;
  productIdIndex = -1;
  retailerProductIdIndex = -1;

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    if (normalizedHeader === 'שם' || normalizedHeader === 'שם מוצר' || normalizedHeader === 'product name' || normalizedHeader === 'name') {
      nameIndex = index;
    } else if (normalizedHeader === 'ברקוד' || normalizedHeader === 'barcode') {
      barcodeIndex = index;
    } else if (normalizedHeader === 'כמות' || normalizedHeader === 'quantity') {
      quantityIndex = index;
    } else if (normalizedHeader === 'קישור' || normalizedHeader === 'link' || normalizedHeader === 'url') {
      linkIndex = index;
    } else if (normalizedHeader === 'מזהה מוצר' || normalizedHeader === 'product id' || normalizedHeader === 'id') {
      productIdIndex = index;
    } else if (normalizedHeader === 'מזהה ספק' || normalizedHeader === 'retailer product id' || normalizedHeader === 'retailerproductid') {
      retailerProductIdIndex = index;
    }
  });

  // חלוקת שאר השורות לשדות
  fixedRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const row = parseCSVLine(line);
      if (row.length > 0) {
        fixedRows.push(row);
      }
    }
  }

  console.log('סה"כ מוצרים לייבוא:', fixedRows.length);
  console.log('אינדקסים שזוהו:', { nameIndex, barcodeIndex, quantityIndex, linkIndex, productIdIndex, retailerProductIdIndex });

  // אתחול התקדמות
  currentIndex = 0;
  createProgressDialog(fixedRows.length);
  
  // התחלת תהליך הוספת המוצרים
  addNextProduct();
} 