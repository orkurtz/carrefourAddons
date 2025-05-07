// סקריפט פשוט ליצירת אייקוני קנבס עם האות C בצבע כתום
// ניתן להחליף זאת בתמונות אמיתיות בהמשך

const fs = require('fs');
const { createCanvas } = require('canvas');

// יצירת אייקון בגודל מסוים
function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // רקע לבן מעוגל
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // עיגול כתום
  ctx.fillStyle = '#f39200';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
  ctx.fill();
  
  // האות C בלבן
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size/2, size/2);
  
  return canvas.toBuffer('image/png');
}

// יצירת האייקונים בגדלים השונים
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const iconBuffer = createIcon(size);
  fs.writeFileSync(`images/icon${size}.png`, iconBuffer);
  console.log(`נוצר אייקון בגודל ${size}x${size}`);
});

console.log('כל האייקונים נוצרו בהצלחה'); 