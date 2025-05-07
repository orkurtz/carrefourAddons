// מעקב אחר בקשות HTTP לשרת Carrefour כדי לחלץ טוקן וכותרות
chrome.webRequest.onSendHeaders.addListener(
  function(details) {
    // בודק אם זו בקשה רלוונטית ל-API של העגלה
    if (details.url.includes('/v2/retailers/') && details.url.includes('/carts/')) {
      // חילוץ הנתיבים מה-URL
      const url = new URL(details.url);
      const pathSegments = url.pathname.split('/');
      
      // מציאת פרמטרי API ושמירתם
      if (pathSegments.length >= 8) {
        const cartDetails = {
          retailerId: pathSegments[3],
          branchId: pathSegments[5],
          cartId: pathSegments[7].split('?')[0],
          appId: url.searchParams.get('appId') || '4'
        };
        
        // חיפוש כותרת Authorization
        let authToken = '';
        for (let i = 0; i < details.requestHeaders.length; i++) {
          if (details.requestHeaders[i].name.toLowerCase() === 'authorization') {
            authToken = details.requestHeaders[i].value.replace('Bearer ', '');
            break;
          }
        }
        
        // שמירת הנתונים לשימוש עתידי
        if (authToken) {
          console.log('נמצא טוקן אימות עבור עגלת Carrefour', cartDetails);
          chrome.storage.local.set({
            'carrefour_auth_token': authToken,
            'carrefour_cart_details': cartDetails
          });
        }
      }
    }
  },
  { urls: ["https://www.carrefour.co.il/*"] },
  ["requestHeaders"]
);

// האזנה להודעות מסקריפט התוכן
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getCartData") {
    // שליפת נתונים שנשמרו
    chrome.storage.local.get(['carrefour_auth_token', 'carrefour_cart_details'], function(data) {
      console.log('שולח נתוני עגלה וטוקן לסקריפט התוכן', data);
      sendResponse(data);
    });
    return true; // לאפשר שליחת תשובה אסינכרונית
  }
}); 