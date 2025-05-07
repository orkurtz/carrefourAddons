// בדיקה אם אנחנו בדף העגלה של Carrefour
if (window.location.href.includes('/cart')) {
  console.log('סקריפט התוכן נטען בדף העגלה של Carrefour');
  
  // האזנה להודעות מהחלון הקופץ
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "exportCart") {
      console.log('התקבלה בקשה לייצוא עגלה מהחלון הקופץ');
      exportCartToCsv();
      sendResponse({status: 'ok'});
    }
  });
  
  // הוספת כפתור הייצוא לדף
  function addExportButton() {
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
      
      // בקשת מידע מסקריפט הרקע
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({action: "getCartData"}, response => {
          resolve(response);
        });
      });
      
      if (!data || !data.carrefour_auth_token || !data.carrefour_cart_details) {
        alert('לא נמצאו נתוני עגלה או טוקן אימות. נסה לרענן את הדף ולנסות שוב.');
        resetButton();
        return;
      }
      
      const authToken = data.carrefour_auth_token;
      const cartDetails = data.carrefour_cart_details;
      
      console.log('התקבלו נתוני עגלה:', cartDetails);
      
      // בניית URL לבקשה
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId}`;
      
      console.log('שולח בקשה אל:', apiUrl);
      
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
      console.log('התקבלו נתוני עגלה מה-API');
      
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

      console.log(`נמצאו ${result.length} מוצרים בעגלה`);

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
      
      console.log('קובץ CSV הורד בהצלחה');
      
      resetButton("ייצוא הושלם!");
      
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
  
  // מחכה שהדף יסיים לטעון ואז מוסיף את הכפתור
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportButton);
  } else {
    addExportButton();
  }
} 