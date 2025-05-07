/**
 * Carrefour Cart CSV Exporter
 * סקריפט המאפשר ייצוא עגלת הקניות של Carrefour לקובץ CSV
 */

javascript:(function() {
  // 1. ניטור בקשות רשת לאיתור API העגלה
  function findCartApiRequest() {
    // בדיקה אם אנחנו בדף העגלה
    if (!window.location.href.includes('/cart')) {
      alert('יש להפעיל את הסקריפט מתוך עמוד העגלה');
      return null;
    }

    // ניסיון לחלץ את הפרמטרים מה-localStorage או cookies
    let retailerId = getCookieValue('retailerId');
    if (!retailerId) {
      retailerId = '1540'; // ערך ברירת מחדל לפי הדוגמה
    }
    
    // הקוד ינסה לאתר את פרטי ה-API מתשובות קיימות
    return new Promise(resolve => {
      // ננסה להשתמש ב-Performance API לבדיקת בקשות קודמות
      let cartApiDetails = null;
      if (window.performance && window.performance.getEntries) {
        const entries = window.performance.getEntries();
        for (let entry of entries) {
          if (entry.name && typeof entry.name === 'string' && 
              entry.name.includes('/v2/retailers/') && 
              entry.name.includes('/carts/')) {
            
            // מצאנו בקשת API רלוונטית
            const url = new URL(entry.name);
            const pathSegments = url.pathname.split('/');
            
            // חילוץ הפרמטרים מה-URL
            cartApiDetails = {
              url: entry.name,
              retailerId: pathSegments[3],
              branchId: pathSegments[5],
              cartId: pathSegments[7].split('?')[0],
              appId: url.searchParams.get('appId') || '4'
            };
            break;
          }
        }
      }
      
      // אם לא מצאנו מידע מבקשות קודמות, ננסה לחלץ מה-URL הנוכחי אם אנחנו בדף העגלה
      if (!cartApiDetails && window.location.href.includes('/cart')) {
        try {
          // ניסיון לחלץ את cartId מהדף
          let cartId = '';
          
          // חיפוש ב-HTML של הדף (אם יש אלמנט שמכיל את מזהה העגלה)
          const cartElements = document.querySelectorAll('[data-cart-id]');
          if (cartElements.length > 0) {
            cartId = cartElements[0].getAttribute('data-cart-id');
          }
          
          // חיפוש בסקריפטים
          if (!cartId) {
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
              const content = script.textContent || '';
              const match = content.match(/cartId['":\s]+([0-9]+)/);
              if (match && match[1]) {
                cartId = match[1];
                break;
              }
            }
          }
          
          // אם מצאנו cartId
          if (cartId) {
            cartApiDetails = {
              retailerId: retailerId,
              branchId: '2992', // ערך ברירת מחדל לפי הדוגמה
              cartId: cartId,
              appId: '4'
            };
          }
        } catch (e) {
          console.error('שגיאה בחילוץ פרטי העגלה:', e);
        }
      }
      
      // אם עדיין לא מצאנו מידע, נשתמש בערכי ברירת מחדל מהדוגמה
      if (!cartApiDetails) {
        cartApiDetails = { 
          retailerId: '1540',
          branchId: '2992',
          cartId: '78696291',
          appId: '4'
        };
        
        console.log('משתמש בערכי ברירת מחדל עבור API העגלה:', cartApiDetails);
      }
      
      resolve(cartApiDetails);
    });
  }
  
  // מציאת טוקן אימות
  function getAuthToken() {
    return new Promise(resolve => {
      // שימוש בטוקן קבוע מהדוגמה כברירת מחדל
      const defaultToken = 'a01c3ac7923bf509a3b76e5d034b30ba3a2fa9b61e38817c5c4dc520cd833be414c9917d574d0793c61f22b8ff8a2d87c85ea6c4cdc3d42c5e4996bff204f68b';
      let token = '';
      
      // בדיקה אם יש טוקן שמור
      if (window.localStorage) {
        const storedToken = window.localStorage.getItem('carrefour_auth_token');
        if (storedToken) {
          token = storedToken;
        }
      }
      
      // שיטה 1: חיפוש בסקריפטים
      if (!token) {
        try {
          const scripts = document.querySelectorAll('script:not([src])'); // רק סקריפטים פנימיים
          for (let script of scripts) {
            const content = script.textContent || '';
            
            // ביטויים שונים למציאת הטוקן
            const bearerMatch = content.match(/Bearer\s+([a-zA-Z0-9]{40,})/);
            const tokenMatch = content.match(/token['":\s]+(["']?)([a-zA-Z0-9]{40,})\1/);
            const authMatch = content.match(/authorization['":\s]+(["']?)Bearer\s+([a-zA-Z0-9]{40,})\1/i);
            
            if (bearerMatch && bearerMatch[1]) {
              token = bearerMatch[1];
              break;
            } else if (tokenMatch && tokenMatch[2]) {
              token = tokenMatch[2];
              break;
            } else if (authMatch && authMatch[2]) {
              token = authMatch[2];
              break;
            }
          }
        } catch (e) {
          console.error("שגיאה בחיפוש הטוקן בסקריפטים:", e);
        }
      }
      
      // שיטה 2: חיפוש ב-localStorage עם שמות מפתח נפוצים
      if (!token && window.localStorage) {
        const possibleKeys = ['auth_token', 'token', 'authToken', 'accessToken', 'userToken', 'jwt'];
        for (let key of possibleKeys) {
          try {
            const value = window.localStorage.getItem(key);
            if (value && value.length > 40) {
              token = value.replace(/^Bearer\s+/i, ''); // מסיר את המילה Bearer אם קיימת
              break;
            }
          } catch (e) { /* התעלם משגיאות */ }
        }
      }
      
      // שיטה 3: חיפוש בכל ה-localStorage
      if (!token && window.localStorage) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            if (value && typeof value === 'string' && value.length > 40 && 
                /^[a-zA-Z0-9]{40,}$/.test(value)) {
              token = value;
              break;
            }
          }
        } catch (e) {
          console.error("שגיאה בסריקת localStorage:", e);
        }
      }
      
      // שיטה 4: חיפוש באלמנטים דינמיים בדף
      if (!token) {
        try {
          // חיפוש באטריבוטים של אלמנטים
          const elements = document.querySelectorAll('[data-token], [data-auth]');
          for (let elem of elements) {
            const dataToken = elem.getAttribute('data-token');
            const dataAuth = elem.getAttribute('data-auth');
            
            if (dataToken && dataToken.length > 40) {
              token = dataToken;
              break;
            } else if (dataAuth && dataAuth.length > 40) {
              token = dataAuth;
              break;
            }
          }
        } catch (e) {
          console.error("שגיאה בחיפוש הטוקן באלמנטים:", e);
        }
      }
      
      // אם לא מצאנו טוקן, נשתמש בברירת מחדל (הטוקן הקבוע מהדוגמה)
      if (!token) {
        console.log('משתמש בטוקן ברירת מחדל');
        token = defaultToken;
      }
      
      // שמירת הטוקן לשימוש עתידי
      if (token && window.localStorage) {
        window.localStorage.setItem('carrefour_auth_token', token);
      }
      
      resolve(token);
    });
  }

  // פונקציה עזר לחילוץ ערך מ-cookie
  function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // הוספת כפתור לממשק
  function addExportButton() {
    // בדיקה אם הכפתור כבר קיים
    if (document.getElementById('carrefour-export-csv')) {
      return;
    }
    
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
  }

  // פונקציה ראשית - ייצוא העגלה ל-CSV
  async function exportCartToCsv() {
    try {
      // שינוי מצב הכפתור בזמן הטעינה
      const button = document.getElementById('carrefour-export-csv');
      if (button) {
        button.disabled = true;
        button.textContent = 'טוען...';
        button.style.backgroundColor = '#aaa';
      }
      
      // מציאת פרטי API העגלה
      const cartDetails = await findCartApiRequest();
      if (!cartDetails) {
        alert('לא הצלחנו לאתר את פרטי העגלה');
        resetButton();
        return;
      }
      
      // השגת טוקן אימות
      const authToken = await getAuthToken();
      if (!authToken) {
        alert('נדרש טוקן אימות כדי להמשיך');
        resetButton();
        return;
      }
      
      // בניית URL לבקשה
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId}`;
      
      console.log('שולח בקשה ל-API:', apiUrl);
      console.log('עם טוקן:', authToken.substring(0, 10) + '...');
      
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
        throw new Error(`שגיאת API: ${response.status} ${response.statusText}`);
      }
      
      const raw = await response.json();
      
      // עיבוד התשובה
      const lines = raw.cart.lines;
      
      if (!lines || lines.length === 0) {
        alert('העגלה ריקה או שלא התקבל מידע');
        resetButton();
        return;
      }

      const result = lines
        .filter(item => !item.text.includes("איסוף עצמי")) // דילוג על מוצרים לא רלוונטיים
        .map(item => ({
          שם: item.text,
          ברקוד: item.barcode,
          כמות: item.quantity,
          מחיר: item.unitPrice,
          'סה"כ': item.totalPrice,
          קישור: `https://www.carrefour.co.il/?catalogProduct=${item.product?.productId ?? ''}`
        }));

      console.table(result);

      // יצירת קובץ CSV
      const headers = Object.keys(result[0]).join(',');
      const rows = result.map(obj => Object.values(obj).map(val =>
        `"${String(val).replace(/"/g, '""')}"`
      ).join(','));
      const csvContent = [headers, ...rows].join('\n');

      // הורדת הקובץ
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "carrefour_products.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      resetButton("ייצוא הושלם!");
      
      // החזרת הכפתור למצב המקורי אחרי 2 שניות
      setTimeout(() => {
        resetButton();
      }, 2000);
      
    } catch (error) {
      console.error("שגיאה:", error);
      alert(`שגיאה: ${error.message}`);
      resetButton();
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

  // התחלת הסקריפט
  addExportButton();
})(); 