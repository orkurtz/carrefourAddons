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
    // addExportButton(); // מבוטל כדי שהפונקציונליות תהיה רק דרך ה-popup
    console.log('כפתור ייצוא CSV לא נוסף לדף (פעיל רק דרך ה-popup)');
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
    debugElement.style.display = 'block';
    
    try {
      if (request.action === "exportCart") {
        console.log('content.js: התקבלה בקשה לייצוא עגלה מהחלון הקופץ');
        debugElement.textContent += ' - מתחיל ייצוא';
        
        // ייתכן שאנחנו לא בדף העגלה - נבדוק
        /*
        if (!window.location.href.includes('/cart')) {
          console.log('לא נמצאים בדף העגלה, ננסה לעבור לדף העגלה תחילה');
          // נשמור את הפעולה באחסון מקומי ונעבור לדף העגלה
          chrome.storage.local.set({ 'carrefour_pending_action': 'export' }, function() {
            window.location.href = 'https://www.carrefour.co.il/cart/summary';
            // לא נשלח תשובה מיד, כי אנחנו עוברים לדף אחר
            sendResponse({status: 'redirecting'});
          });
        } else {
        */
          // אנחנו בדף העגלה, נבצע את הייצוא מיד
          exportCartToCsv();
          sendResponse({status: 'ok'});
        //}
        return true;
      }
      else if (request.action === "importCart") {
        console.log('content.js: התקבלה בקשה לייבוא עגלה מהחלון הקופץ', 
          request.data ? `(${request.data.length} פריטים)` : '(ללא נתונים)',
          'מצב:', request.mode || 'replace');
        debugElement.textContent += ' - מתחיל ייבוא';
        
        if (request.data && Array.isArray(request.data) && request.data.length > 1) {
          importCartFromCsv(request.data, request.mode || 'replace');
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
  chrome.storage.local.get(['carrefour_pending_action', 'carrefour_csv_import_data', 'carrefour_csv_import_mode'], function(data) {
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
        importCartFromCsv(data.carrefour_csv_import_data, data.carrefour_csv_import_mode || 'replace');
        // נקה את הנתונים המאוחסנים
        chrome.storage.local.remove(['carrefour_csv_import_data', 'carrefour_csv_import_mode']);
      } else {
        // נקה את הנתונים המאוחסנים
        chrome.storage.local.remove(['carrefour_csv_import_data', 'carrefour_csv_import_mode']);
      }
    }
  });
  
  // הוספת כפתור הייצוא לדף
  function addExportButton() {
    // פונקציה זו מבוטלת כרגע ולא מוסיפה את הכפתור לדף
    // הפונקציונליות של ייצוא CSV זמינה רק דרך חלון ה-popup
    console.log('addExportButton: פונקציה מבוטלת - הכפתור לא נוסף לדף העגלה');
    return;
    
    /* קוד מקורי מבוטל
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
    */
  }

  // פונקציית הייצוא לCSV
  async function exportCartToCsv() {
    try {
      // עדכון הכפתור למצב טעינה (רק אם הוא קיים)
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
  async function importCartFromCsv(csvData, mode = 'replace') {
    console.log('מתחיל בייבוא מוצרים מקובץ CSV', csvData.length, 'במצב:', mode);
    
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
    progressTitle.textContent = mode === 'replace' ? 'מייבא מוצרים לעגלה (החלפה)...' : 'מוסיף מוצרים לעגלה...';
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
    
    // קבלת נתוני עגלה ונתוני אימות
    let cartData;
    try {
      progressStatus.textContent = 'מקבל נתוני עגלה נוכחית...';
      console.log('שלב 1: מקבל נתוני עגלה נוכחית');
      
      // קבלת נתוני עגלה מסקריפט הרקע
      cartData = await new Promise((resolve, reject) => {
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
      
      if (!cartData) {
        throw new Error('לא התקבלו נתוני עגלה');
      }
      
      console.log('התקבלה תשובה מסקריפט הרקע:', {
        hasAuthToken: !!cartData.carrefour_auth_token,
        hasCartDetails: !!cartData.carrefour_cart_details,
        hasXAuthToken: !!cartData.carrefour_token
      });
      
    } catch (error) {
      console.error('שגיאה בקבלת נתוני עגלה:', error);
      progressStatus.textContent = 'שגיאה בקבלת נתוני עגלה: ' + error.message;
      progressTitle.textContent = 'שגיאה בייבוא';
      progressFill.style.backgroundColor = 'red';
      closeButton.style.display = 'block';
      return;
    }
    
    // שלב 2: טיפול בעגלה קיימת בהתאם למצב היבוא
    let existingCartItems = [];
    
    try {
      // אם במצב החלפה, נקבל את תוכן העגלה ונרוקן אותה לפני הוספת פריטים חדשים
      if (mode === 'replace') {
        progressStatus.textContent = 'מכין את העגלה להחלפה...';
        console.log('שלב 2: מכין את העגלה להחלפה (מצב replace)');
        
        // קבלת הפריטים הקיימים בעגלה
        existingCartItems = await getExistingCartItems(cartData);
        
        // אם יש פריטים בעגלה, נרוקן אותה
        if (existingCartItems.length > 0) {
          progressStatus.textContent = `מרוקן את העגלה הקיימת (${existingCartItems.length} פריטים)...`;
          console.log('מרוקן את העגלה הקיימת לפני החלפה:', existingCartItems.length, 'פריטים');
          console.log('פרטי הפריטים להסרה:', existingCartItems.map(item => `${item.name} (ID: ${item.retailerProductId}, כמות: ${item.quantity})`));
          
          // וידוא שהנתונים מועברים כראוי לפונקציית clearCart
          console.log('מעביר נתוני טוקן לריקון העגלה:', {
            hasAuthToken: !!cartData.carrefour_auth_token,
            hasCartDetails: !!cartData.carrefour_cart_details
          });
          
          const clearSuccess = await clearCart(cartData, existingCartItems);
          if (clearSuccess) {
            console.log('העגלה רוקנה בהצלחה');
            progressStatus.textContent = 'העגלה הקיימת רוקנה בהצלחה';
            // איפוס רשימת הפריטים הקיימים
            existingCartItems = [];
            
            // המתנה קצרה אחרי ריקון העגלה לפני תחילת הוספת המוצרים
            console.log('ממתין לסיום ריקון העגלה לפני הוספת פריטים חדשים...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('סיום המתנה, ממשיך להוספת פריטים חדשים');
          } else {
            console.error('שגיאה בריקון העגלה');
            progressStatus.textContent = 'שגיאה בריקון העגלה - ממשיך ביבוא';
          }
        } else {
          console.log('העגלה הנוכחית ריקה, אין צורך בריקון');
          progressStatus.textContent = 'העגלה הנוכחית ריקה';
        }
      } else if (mode === 'add') {
        progressStatus.textContent = 'מכין את העגלה להוספת פריטים...';
        console.log('שלב 2: מכין את העגלה להוספת פריטים (מצב add)');
        
        // קבלת הפריטים הקיימים בעגלה
        existingCartItems = await getExistingCartItems(cartData);
        
        if (existingCartItems.length > 0) {
          console.log(`נמצאו ${existingCartItems.length} מוצרים קיימים בעגלה שנשקול לעדכן כמויות`);
          progressStatus.textContent = `נמצאו ${existingCartItems.length} מוצרים בעגלה הקיימת`;
        } else {
          console.log('העגלה הנוכחית ריקה, אין מוצרים קיימים לעדכון כמויות');
          progressStatus.textContent = 'העגלה הנוכחית ריקה';
        }
      }
    } catch (error) {
      console.error('שגיאה בטיפול בעגלה הנוכחית:', error);
      progressStatus.textContent = 'שגיאה בטיפול בעגלה הנוכחית - ממשיך ביבוא';
      // אם הייתה שגיאה בריקון העגלה, ננסה להמשיך לייבא תוך סיכון שפריטים קיימים לא יימחקו
    }
    
    // שלב 3: הכנת נתוני ה-CSV לעיבוד
    progressStatus.textContent = 'מכין נתוני CSV לייבוא...';
    console.log('שלב 3: מכין נתוני CSV לייבוא');
    
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
    
    // שלב 4: מציאת אינדקסים של עמודות חשובות
    console.log('שלב 4: מחפש אינדקסים של עמודות חשובות');
    
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
      return;
    }

    // שלב 5: מוסיף את המוצרים אחד אחד
    console.log('שלב 5: מתחיל להוסיף מוצרים מה-CSV לעגלה');
    progressStatus.textContent = 'מתחיל בהוספת מוצרים לעגלה...';

    // לולאה שמוסיפה את המוצרים אחד אחרי השני
    let currentIndex = 0;
    let skippedItems = 0;
    
    function addNextProduct() {
      if (currentIndex >= fixedRows.length) {
        // סיימנו להוסיף את כל המוצרים
        progressTitle.textContent = 'הייבוא הושלם בהצלחה';
        if (mode === 'add' && skippedItems > 0) {
          progressStatus.textContent = `הוספו ${currentIndex - skippedItems} מוצרים לעגלה, דולגו ${skippedItems} מוצרים שכבר קיימים`;
        } else {
          progressStatus.textContent = 'כל המוצרים יובאו לעגלה (' + currentIndex + '/' + fixedRows.length + ')';
        }
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
      
      let originalQuantity = quantity; // שמירת הכמות המקורית מה-CSV
      let existingItem = null;
      
      // אם במצב הוספה (add), בדוק אם המוצר כבר קיים בעגלה
      if (mode === 'add' && existingCartItems.length > 0) {
        console.log(`בודק אם המוצר "${productName}" כבר קיים בעגלה...`);
        
        // לוגיקת החיפוש שופרה - נבדוק לפי retailerProductId, productId, ושם
        let existingItem = null;
        
        // חיפוש לפי מזהה ספק
        if (retailerProductId) {
          console.log(`מחפש מוצר קיים לפי retailerProductId: ${retailerProductId}`);
          existingItem = existingCartItems.find(item => 
            item.retailerProductId === retailerProductId || 
            item.retailerProductId === String(retailerProductId) || 
            String(item.retailerProductId) === retailerProductId);
          
          if (existingItem) {
            console.log(`נמצא מוצר קיים בעגלה לפי retailerProductId ${retailerProductId}: ${existingItem.name} (כמות: ${existingItem.quantity})`);
          }
        }
        
        // חיפוש לפי מזהה מוצר אם לא נמצא לפי מזהה ספק
        if (!existingItem && productId) {
          console.log(`מחפש מוצר קיים לפי productId: ${productId}`);
          existingItem = existingCartItems.find(item => 
            item.productId === productId || 
            item.productId === String(productId) || 
            String(item.productId) === productId);
          
          if (existingItem) {
            console.log(`נמצא מוצר קיים בעגלה לפי productId ${productId}: ${existingItem.name} (כמות: ${existingItem.quantity})`);
          }
        }
        
        // חיפוש לפי שם מוצר בדיוק אם לא נמצא לפי מזהים
        if (!existingItem && productName) {
          console.log(`מחפש מוצר קיים לפי שם מדויק: "${productName}"`);
          existingItem = existingCartItems.find(item => 
            item.name === productName);
          
          if (existingItem) {
            console.log(`נמצא מוצר קיים בעגלה לפי שם מדויק: ${existingItem.name} (כמות: ${existingItem.quantity})`);
          }
        }
        
        if (existingItem) {
          // המוצר כבר קיים בעגלה - במצב הוספה, נוסיף את הכמות החדשה לכמות הקיימת
          console.log(`מוצר "${productName}" כבר קיים בעגלה:`, 
                    'מזהה:', retailerProductId || productId, 
                    'כמות קיימת:', existingItem.quantity, 
                    'כמות להוספה:', originalQuantity);
          
          // חישוב הכמות המעודכנת: הכמות הקיימת + הכמות החדשה
          const updatedQuantity = existingItem.quantity + originalQuantity;
          progressStatus.textContent = `מעדכן כמות: ${productName} (${existingItem.quantity} + ${originalQuantity} = ${updatedQuantity})`;
          console.log(`מעדכן כמות ל-${updatedQuantity} (${existingItem.quantity} + ${originalQuantity})`);
          
          // העברת הכמות המעודכנת
          quantity = updatedQuantity;
        } else {
          console.log(`המוצר "${productName}" אינו קיים בעגלה. מוסיף כמוצר חדש (כמות: ${quantity}).`);
        }
      } else if (mode === 'replace') {
        console.log(`מוסיף מוצר חדש במצב החלפה: "${productName}" (כמות: ${quantity})`);
      }
      
      console.log('מוסיף מוצר:', { 
        productName, 
        productId, 
        retailerProductId, 
        barcode, 
        quantity,
        existingInCart: existingItem ? 'כן' : 'לא',
        originalQuantity,
        finalQuantity: quantity, 
        productLink 
      });
      
      // עדכון התקדמות
      const progress = Math.round((currentIndex + 1) / fixedRows.length * 100);
      progressFill.style.width = progress + '%';
      
      if (existingItem) {
        progressStatus.textContent = `מעדכן: ${productName} (${existingItem.quantity} + ${originalQuantity} = ${quantity}) - ${currentIndex + 1}/${fixedRows.length}`;
      } else {
        progressStatus.textContent = `מוסיף: ${productName} (כמות: ${quantity}) - ${currentIndex + 1}/${fixedRows.length}`;
      }
      
      // לוגיקת הוספה לעגלה - סדר העדיפויות:
      // 1. retailerProductId - מזהה הספק של המוצר (עדיפות ראשונה)
      // 2. productId - מזהה המוצר
      // 3. קישור מוצר
      // 4. ברקוד
      // 5. שם מוצר
      
      if (retailerProductId) {
        // יש לנו retailerProductId ישיר, נשתמש בו - זה המזהה הנכון להוספה!
        console.log(`מוסיף לעגלה לפי retailerProductId: ${retailerProductId}, כמות: ${quantity}`);
        addProductById(retailerProductId, quantity, function(success) {
          if (success) {
            console.log(`המוצר "${productName}" נוסף בהצלחה לעגלה עם כמות ${quantity}`);
            if (existingItem) {
              console.log(`עדכון הושלם: מכמות ${existingItem.quantity} לכמות ${quantity}`);
            }
          } else {
            console.error(`שגיאה בהוספת/עדכון המוצר "${productName}" (retailerProductId: ${retailerProductId})`);
          }
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (productId) {
        // יש לנו מזהה מוצר אחר, נשתמש בו
        console.log(`מוסיף לעגלה לפי productId: ${productId}, כמות: ${quantity}`);
        addProductById(productId, quantity, function(success) {
          if (success) {
            console.log(`המוצר "${productName}" נוסף בהצלחה לעגלה עם כמות ${quantity}`);
            if (existingItem) {
              console.log(`עדכון הושלם: מכמות ${existingItem.quantity} לכמות ${quantity}`);
            }
          } else {
            console.error(`שגיאה בהוספת/עדכון המוצר "${productName}" (productId: ${productId})`);
          }
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (productLink && productLink.includes('carrefour.co.il')) {
        // יש לנו קישור למוצר, נשתמש בו (רק אם נראה כמו קישור תקין)
        console.log(`מוסיף לעגלה לפי קישור: ${productLink}, כמות: ${quantity}`);
        addProductByLink(productLink, quantity, function(success) {
          if (success) {
            console.log(`המוצר "${productName}" נוסף בהצלחה לעגלה דרך קישור`);
            if (existingItem) {
              console.log(`עדכון הושלם: מכמות ${existingItem.quantity} לכמות ${quantity}`);
            }
          } else {
            console.error(`שגיאה בהוספת/עדכון המוצר "${productName}" דרך קישור`);
          }
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else if (barcode) {
        // יש לנו ברקוד, ננסה להשתמש בו
        console.log(`מוסיף לעגלה לפי ברקוד: ${barcode}, כמות: ${quantity}`);
        addProductByBarcode(barcode, quantity, function(success) {
          if (success) {
            console.log(`המוצר "${productName}" נוסף בהצלחה לעגלה דרך ברקוד`);
            if (existingItem) {
              console.log(`עדכון הושלם: מכמות ${existingItem.quantity} לכמות ${quantity}`);
            }
          } else {
            console.error(`שגיאה בהוספת/עדכון המוצר "${productName}" דרך ברקוד`);
          }
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      } else {
        // יש לנו רק שם, ננסה לחפש את המוצר
        console.log(`מוסיף לעגלה לפי שם: ${productName}, כמות: ${quantity}`);
        addProductByName(productName, quantity, function(success) {
          if (success) {
            console.log(`המוצר "${productName}" נוסף בהצלחה לעגלה לפי שם`);
            if (existingItem) {
              console.log(`עדכון הושלם: מכמות ${existingItem.quantity} לכמות ${quantity}`);
            }
          } else {
            console.error(`שגיאה בהוספת/עדכון המוצר "${productName}" לפי שם`);
          }
          currentIndex++;
          setTimeout(addNextProduct, 500);
        });
      }
    }
    
    // התחל את תהליך ההוספה
    setTimeout(addNextProduct, 500);
  }
  
  // פונקציה לריקון העגלה הנוכחית
  async function clearCart(cartData, existingItems) {
    console.log('התחלת פונקציית clearCart:', {
      hasItems: !!existingItems && existingItems.length > 0,
      itemCount: existingItems?.length || 0,
      hasCartData: !!cartData,
      hasAuthToken: cartData ? !!cartData.carrefour_auth_token : false,
      hasCartDetails: cartData ? !!cartData.carrefour_cart_details : false
    });
    
    if (!existingItems || existingItems.length === 0) {
      console.log('אין פריטים בעגלה לריקון');
      return true;
    }
    
    // וידוא שיש לנו את כל הנתונים הנדרשים
    if (!cartData) {
      console.error('לא התקבלו נתוני כרטיס לריקון העגלה');
      return false;
    }
    
    if (!cartData.carrefour_auth_token) {
      console.error('חסר טוקן אימות (carrefour_auth_token) - נדרש לריקון העגלה');
      return false;
    }
    
    if (!cartData.carrefour_cart_details) {
      console.error('חסרים פרטי עגלה (carrefour_cart_details) - נדרשים לריקון העגלה');
      return false;
    }
    
    try {
      const authToken = cartData.carrefour_auth_token;
      const cartDetails = cartData.carrefour_cart_details;
      
      console.log('נתוני עגלה וטוקן לריקון:', {
        authTokenExists: !!authToken,
        cartDetailsExists: !!cartDetails,
        retailerId: cartDetails?.retailerId,
        branchId: cartDetails?.branchId,
        cartId: cartDetails?.cartId,
        appId: cartDetails?.appId || 4
      });
      
      // וידוא שיש לנו את כל הפרמטרים הנדרשים
      if (!cartDetails.retailerId || !cartDetails.branchId || !cartDetails.cartId) {
        console.error('חסרים פרטי עגלה חיוניים לביצוע בקשת ריקון:', cartDetails);
        return false;
      }
      
      // בניית URL לבקשה עם הפרמטרים המתאימים
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId || 4}`;
      
      console.log('שולח בקשה לריקון העגלה אל:', apiUrl);
      
      // בניית מערך של פריטים עם דגל delete: true לריקון העגלה
      const linesWithZeroQuantity = existingItems.map(item => ({
        quantity: 0,
        soldBy: null,
        comments: "",
        isCase: false,
        metaData: null,
        retailerProductId: parseInt(item.retailerProductId, 10),
        type: 1
      }));
      
      console.log(`מכין בקשת ריקון עבור ${linesWithZeroQuantity.length} פריטים`);
      console.log('פרטי הבקשה לריקון:', linesWithZeroQuantity.map((item, index) => 
        `פריט ${index+1}: retailerProductId=${item.retailerProductId}, quantity=${item.quantity}`
      ));
      
      // בניית גוף הבקשה לריקון העגלה
      const requestBody = {
        lines: linesWithZeroQuantity,
        source: "importCSV",
        deliveryProduct_Id: 16388534,
        deliveryType: 2
      };
      
      console.log('גוף בקשת הריקון:', JSON.stringify(requestBody));
      
      // שליחת הבקשה
      console.log('שולח בקשת API לריקון העגלה...');
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Authorization": `Bearer ${authToken}`,
          "Accept": "application/json, text/plain, */*",
          "X-HTTP-Method-Override": "PATCH"
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('התקבלה תשובה מהשרת לבקשת הריקון:', response.status, response.statusText);
      
      if (response.ok) {
        console.log('העגלה רוקנה בהצלחה (כמות אופסה)');
        try {
          const responseData = await response.json();
          console.log('תשובת ריקון העגלה:', responseData);
          
          // בדיקה האם יש עדיין פריטים בעגלה
          let remainingItems = [];
          if (responseData.cart && responseData.cart.lines) {
            remainingItems = responseData.cart.lines.filter(line => 
              line.quantity > 0 && !line.text.includes("איסוף עצמי"));
          }
          
          // שלב 2: מחיקה מלאה של כל המוצרים שהיו בעגלה
          console.log(`שלב 2: מוחק לגמרי את כל הפריטים (${existingItems.length}) שהיו בעגלה`);
          
          // המתנה קצרה לפני ניסיון מחיקת הפריטים
          console.log('ממתין לפני מחיקת הפריטים מהעגלה...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // בניית מערך של פריטים עם דגל delete: true למחיקה מלאה מהעגלה
          const linesToDelete = existingItems.map(item => ({
            delete: true,
            retailerProductId: parseInt(item.retailerProductId, 10),
            isCase: false,
            type: 1
          }));
          
          console.log(`מכין בקשת מחיקה מלאה עבור ${linesToDelete.length} פריטים`);
          console.log('פרטי הבקשה למחיקה מלאה:', 
            linesToDelete.map((item, index) => 
              `פריט ${index+1}: retailerProductId=${item.retailerProductId}, delete=${item.delete}`));
          
          // בניית גוף הבקשה למחיקת פריטים
          const deleteRequestBody = {
            lines: linesToDelete,
            deliveryProduct_Id: 16388534,
            deliveryType: 2
          };
          
          console.log('גוף בקשת המחיקה המלאה:', JSON.stringify(deleteRequestBody));
          
          // שליחת הבקשה
          console.log('שולח בקשת API למחיקה מלאה של הפריטים...');
          const deleteResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json;charset=UTF-8",
              "Authorization": `Bearer ${authToken}`,
              "Accept": "application/json, text/plain, */*",
              "X-HTTP-Method-Override": "PATCH"
            },
            body: JSON.stringify(deleteRequestBody)
          });
          
          console.log('התקבלה תשובה מהשרת לבקשת המחיקה המלאה:', deleteResponse.status, deleteResponse.statusText);
          
          if (deleteResponse.ok) {
            console.log('כל הפריטים נמחקו לגמרי מהעגלה בהצלחה');
            try {
              const deleteResponseData = await deleteResponse.json();
              console.log('תשובת מחיקת הפריטים:', deleteResponseData);
              
              // בדיקה אם יש עדיין פריטים בעגלה אחרי המחיקה המלאה
              let itemsAfterDelete = [];
              if (deleteResponseData.cart && deleteResponseData.cart.lines) {
                itemsAfterDelete = deleteResponseData.cart.lines.filter(line => 
                  !line.text.includes("איסוף עצמי"));
              }
              
              if (itemsAfterDelete.length > 0) {
                console.warn(`לאחר מחיקה מלאה עדיין יש ${itemsAfterDelete.length} פריטים בעגלה:`, 
                  itemsAfterDelete.map(item => `${item.text} (ID: ${item.retailerProductId})`));
              } else {
                console.log('העגלה רוקנה לחלוטין, אין פריטים נותרים');
              }
            } catch (error) {
              console.log('לא ניתן לפרסר את תשובת מחיקת הפריטים:', error);
            }
          } else {
            console.error('שגיאה במחיקה מלאה של הפריטים:', deleteResponse.status);
            try {
              const errorText = await deleteResponse.text();
              console.error('פרטי שגיאת המחיקה המלאה:', errorText);
            } catch (error) {
              console.error('לא ניתן לקרוא את פרטי שגיאת המחיקה המלאה');
            }
          }
          
          // בדיקה אם יש פריטים לא פעילים בעגלה שיש להסיר
          let inactiveItems = [];
          if (responseData.inactiveLines && responseData.inactiveLines.length > 0) {
            inactiveItems = responseData.inactiveLines;
            console.log(`נמצאו ${inactiveItems.length} פריטים לא פעילים בעגלה:`, 
                      inactiveItems.map(item => `${item.text || 'פריט'} (ID: ${item.retailerProductId})`));
            
            // ניסיון להסיר את הפריטים הלא פעילים
            const inactiveRemovalSuccess = await removeInactiveCartItems(cartData, inactiveItems);
            
            if (inactiveRemovalSuccess) {
              console.log('הפריטים הלא פעילים הוסרו בהצלחה מהעגלה');
            } else {
              console.warn('לא הצלחנו להסיר את כל הפריטים הלא פעילים מהעגלה');
            }
          } else {
            console.log('לא נמצאו פריטים לא פעילים נוספים בעגלה');
          }
          
          // המתנה נוספת אחרי כל פעולות הריקון והמחיקה
          console.log('ממתין אחרי סיום תהליך ריקון העגלה...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          return true;
        } catch (error) {
          console.log('לא ניתן לפרסר את תשובת ריקון העגלה:', error);
          return false;
        }
      } else {
        console.error('שגיאה בריקון העגלה:', response.status);
        try {
          const errorText = await response.text();
          console.error('פרטי שגיאת ריקון:', errorText);
        } catch (error) {
          console.error('לא ניתן לקרוא את פרטי שגיאת הריקון');
        }
        return false;
      }
    } catch (error) {
      console.error('שגיאה בתהליך ריקון העגלה:', error);
      return false;
    }
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
  
  // מחכה שהדף יסיים לטעון ואז מוסיף את הכפתור - מבוטל כעת
  /* 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportButton);
  } else {
    addExportButton();
  }
  */
  
  // הסרת ההוספה האוטומטית של הכפתור
  console.log('ממשק ייצוא עגלה זמין רק דרך חלון ה-popup');
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

// פונקציה להסרת פריטים לא פעילים מהעגלה
async function removeInactiveCartItems(cartData, inactiveItems) {
  if (!inactiveItems || inactiveItems.length === 0) {
    console.log('אין פריטים לא פעילים להסרה מהעגלה');
    return true;
  }

  console.log(`מסיר ${inactiveItems.length} פריטים לא פעילים מהעגלה:`, 
    inactiveItems.map(item => `${item.text || item.name || 'פריט'} (ID: ${item.retailerProductId})`));

  try {
    if (!cartData || !cartData.carrefour_auth_token || !cartData.carrefour_cart_details) {
      console.error('חסרים נתוני טוקן או עגלה להסרת פריטים לא פעילים');
      return false;
    }

    const authToken = cartData.carrefour_auth_token;
    const cartDetails = cartData.carrefour_cart_details;
    
    // וידוא שיש לנו את כל הפרמטרים הנדרשים
    if (!cartDetails.retailerId || !cartDetails.branchId || !cartDetails.cartId) {
      console.error('חסרים פרטי עגלה חיוניים להסרת פריטים לא פעילים:', cartDetails);
      return false;
    }
    
    // בניית URL לבקשה עם הפרמטרים המתאימים
    const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId || 4}`;
    
    console.log('שולח בקשה להסרת פריטים לא פעילים מהעגלה אל:', apiUrl);
    
    // בניית מערך של פריטים עם דגל delete: true להסרה מלאה מהעגלה
    const linesToDelete = inactiveItems.map(item => ({
      delete: true,
      retailerProductId: parseInt(item.retailerProductId, 10),
      isCase: false,
      type: 1
    }));
    
    console.log(`מכין בקשת הסרה עבור ${linesToDelete.length} פריטים לא פעילים`);
    console.log('פרטי הבקשה להסרת פריטים לא פעילים:', 
                JSON.stringify(linesToDelete.map((item, index) => 
                  `פריט ${index+1}: retailerProductId=${item.retailerProductId}, delete=${item.delete}`)));
    
    // בניית גוף הבקשה להסרת פריטים לא פעילים
    const requestBody = {
      lines: linesToDelete,
      deliveryProduct_Id: 16388534,
      deliveryType: 2
    };
    
    console.log('גוף בקשת ההסרה:', JSON.stringify(requestBody));
    
    // שליחת הבקשה
    console.log('שולח בקשת API להסרת פריטים לא פעילים...');
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Authorization": `Bearer ${authToken}`,
        "Accept": "application/json, text/plain, */*",
        "X-HTTP-Method-Override": "PATCH"
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('התקבלה תשובה מהשרת לבקשת הסרת פריטים לא פעילים:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('הפריטים הלא פעילים הוסרו בהצלחה מהעגלה');
      try {
        const responseData = await response.json();
        console.log('תשובת הסרת פריטים לא פעילים:', responseData);
        
        // בדיקה האם יש עדיין פריטים לא פעילים בעגלה
        if (responseData.inactiveLines && responseData.inactiveLines.length > 0) {
          console.warn(`לאחר הסרת פריטים לא פעילים עדיין יש ${responseData.inactiveLines.length} פריטים לא פעילים בעגלה:`, 
                       responseData.inactiveLines);
        } else {
          console.log('כל הפריטים הלא פעילים הוסרו בהצלחה מהעגלה');
        }
        
        return true;
      } catch (error) {
        console.log('לא ניתן לפרסר את תשובת הסרת הפריטים הלא פעילים:', error);
        return true; // עדיין נחשב כהצלחה
      }
    } else {
      console.error('שגיאה בהסרת פריטים לא פעילים:', response.status);
      try {
        const errorText = await response.text();
        console.error('פרטי שגיאת הסרת פריטים לא פעילים:', errorText);
      } catch (error) {
        console.error('לא ניתן לקרוא את פרטי שגיאת הסרת פריטים לא פעילים');
      }
      return false;
    }
  } catch (error) {
    console.error('שגיאה בתהליך הסרת פריטים לא פעילים:', error);
    return false;
  }
}

// פונקציה לקבלת הפריטים הקיימים בעגלה
async function getExistingCartItems(cartData) {
  let existingCartItems = [];
  
  try {
    // בדיקה אם יש לנו טוקן X-Auth
    if (cartData.carrefour_token) {
      console.log('מנסה לקבל פריטים קיימים באמצעות טוקן X-Auth');
      const cartApiUrl = 'https://www.carrefour.co.il/api/v1/cart';
      const cartResponse = await fetch(cartApiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': cartData.carrefour_token
        }
      });
      
      console.log('סטטוס תשובה מה-API:', cartResponse.status, cartResponse.statusText);
      
      if (cartResponse.ok) {
        const cartDataResponse = await cartResponse.json();
        console.log('התקבלו נתוני עגלה מה-API:', cartDataResponse);
        
        if (cartDataResponse.items && cartDataResponse.items.length > 0) {
          // שמירת הפריטים הקיימים עם מזהה וכמות
          existingCartItems = cartDataResponse.items.map(item => ({
            retailerProductId: String(item.product?.retailerProductId || item.product?.id || ''),
            productId: String(item.product?.productId || item.product?.id || ''),
            quantity: item.quantity || 1,
            name: item.product?.name || ''
          }));
          
          console.log(`נמצאו ${existingCartItems.length} פריטים קיימים בעגלה:`, 
            existingCartItems.map(item => `${item.name} (ID: ${item.retailerProductId}, כמות: ${item.quantity})`));
        } else {
          console.log('העגלה הנוכחית ריקה (לפי API ראשי)');
        }
      } else {
        console.error('שגיאה בקבלת נתוני עגלה מה-API הראשי:', cartResponse.status);
      }
    } else {
      console.log('אין טוקן X-Auth זמין לקבלת נתוני עגלה - ננסה דרך API אחר');
    }
    
    // אם לא הצלחנו לקבל פריטים דרך X-Auth או שאין לנו X-Auth, ננסה דרך API אחר
    if (existingCartItems.length === 0 && cartData.carrefour_auth_token && cartData.carrefour_cart_details) {
      console.log('מנסה לקבל פריטים קיימים באמצעות API אחר');
      const cartDetails = cartData.carrefour_cart_details;
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId || 4}`;
      
      console.log('שולח בקשה לקבלת פרטי העגלה מ-API אחר:', apiUrl);
      
      // שליחת בקשה לקבלת פרטי העגלה
      const cartResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Authorization": `Bearer ${cartData.carrefour_auth_token}`,
          "Accept": "application/json, text/plain, */*",
          "X-HTTP-Method-Override": "PATCH"
        },
        body: JSON.stringify({})
      });
      
      if (cartResponse.ok) {
        const cartDataResponse = await cartResponse.json();
        console.log('התקבלו פרטי עגלה מה-API האחר:', cartDataResponse);
        
        if (cartDataResponse.cart && cartDataResponse.cart.lines && cartDataResponse.cart.lines.length > 0) {
          // שמירת הפריטים הקיימים
          const cartLines = cartDataResponse.cart.lines.filter(line => 
            !line.text.includes("איסוף עצמי") && line.quantity > 0);
          
          if (cartLines.length > 0) {
            console.log(`נמצאו ${cartLines.length} פריטים בעגלה (API אחר):`);
            
            existingCartItems = cartLines.map(line => ({
              retailerProductId: String(line.retailerProductId || line.product?.id || ''),
              productId: String(line.productId || ''),
              quantity: line.quantity || 1,
              name: line.text || ''
            }));
            
            console.log(`פריטים קיימים בעגלה (${existingCartItems.length}):`, 
              existingCartItems.map(item => `${item.name} (ID: ${item.retailerProductId}, כמות: ${item.quantity})`));
              
            // הדפסת כל המזהים של הפריטים הקיימים לצורך ניפוי באגים
            existingCartItems.forEach(item => {
              console.log(`פריט: ${item.name}, retailerProductId: "${item.retailerProductId}" (${typeof item.retailerProductId}), productId: "${item.productId}" (${typeof item.productId})`);
            });
          } else {
            console.log('לא נמצאו פריטים רלוונטיים בעגלה (API אחר)');
          }
        } else {
          console.log('העגלה ריקה לפי ה-API השני');
        }
      } else {
        console.error('שגיאה בקבלת נתוני עגלה מה-API האחר:', cartResponse.status);
      }
    }
  } catch (error) {
    console.error('שגיאה בקבלת פריטים קיימים בעגלה:', error);
  }
  
  return existingCartItems;
}