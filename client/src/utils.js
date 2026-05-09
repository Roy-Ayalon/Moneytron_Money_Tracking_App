import dayjs from 'dayjs';

export function fmt2(n){ n=Number(n); if(!isFinite(n)) return '0.00'; return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

export const I18N = {
  en: {
    app_title: 'MoneyTron - Multi-User Money Tracker',
    tabs_transactions: 'Transactions',
    tabs_summary: 'Summary',
    tabs_statistics: 'Statistics',
    tabs_data: 'Data',
    tabs_categories: 'Categories',
    tabs_tutorial: 'Tutorial',
    login: 'Login',
    signup: 'Sign Up',
    welcome: 'Welcome',
    upload_statement: 'Upload your bank statement',
    add_manual: 'Add Manual Row',
    save_all: 'Save All',
    delete_all: 'Delete All',
    help: 'Help',
    lang: 'Language',
    export_data: 'Export Data',
    delete_account: 'Delete Account',
    privacy_signup: 'Your data is private and tied to your account only.',
    privacy_upload: 'We parse your selected files to extract transactions. Nothing is committed until you click Save All.',
    no_transactions: 'No transactions yet. Upload your first bank statement to get started.',
  },
  he: {
    app_title: 'MoneyTron - מעקב כספים',
    tabs_transactions: 'תנועות',
    tabs_summary: 'סיכום',
    tabs_statistics: 'סטטיסטיקות',
    tabs_data: 'נתונים',
    tabs_categories: 'קטגוריות',
    tabs_tutorial: 'מדריך',
    login: 'התחברות',
    signup: 'הרשמה',
    welcome: 'ברוך הבא',
    upload_statement: 'העלה דוח בנק',
    add_manual: 'הוסף ידנית',
    save_all: 'שמור הכל',
    delete_all: 'מחק הכל',
    help: 'עזרה',
    lang: 'שפה',
    export_data: 'ייצוא נתונים',
    delete_account: 'מחיקת חשבון',
    privacy_signup: 'הנתונים שלך פרטיים ומופרדים לכל משתמש.',
    privacy_upload: 'המערכת מנתחת את הקבצים שבחרת. שום דבר לא נשמר קבוע עד שלוחצים "שמור הכל".',
    no_transactions: 'אין תנועות עדיין. העלה דוח ראשון כדי להתחיל.',
  }
};

export function getCookie(name){
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export function makeTranslator(lang){
  const dict = I18N[lang] || I18N.en;
  return function t(key){
    if(Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return I18N.en[key] || key;
  };
}

export function formatDMY(dateInput) {
  if (!dateInput) return '';
  let d;
  if (typeof dateInput === 'string') {
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) return dateInput;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, day] = dateInput.split('-');
      return `${day}-${m}-${y}`;
    }
    d = dayjs(dateInput);
  } else if (dateInput instanceof Date) {
    d = dayjs(dateInput);
  } else {
    d = dayjs(dateInput);
  }
  if (d && d.isValid()) return d.format('DD-MM-YYYY');
  return String(dateInput);
}

export function parseDMYtoISO(dmyStr) {
  if (!dmyStr) return '';
  const match = String(dmyStr).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  const d = dayjs(dmyStr, 'DD-MM-YYYY', true);
  if (d.isValid()) return d.format('YYYY-MM-DD');
  return dmyStr;
}

export function asArray(x){ if(Array.isArray(x)) return x; if(x && Array.isArray(x.items)) return x.items; if(x && Array.isArray(x.data)) return x.data; return []; }
export function asCategories(x){ if(x && typeof x==='object' && !Array.isArray(x)) return x; if(Array.isArray(x)){var o={}; x.forEach(it=>{ if(typeof it==='string') o[it]=[]; else if(it && it.name) o[it.name]=Array.isArray(it.subcategories)?it.subcategories.slice():[]; }); return o;} return {}; }

export function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  var s = String(v).trim();
  var neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^[+\-−–]/.test(s)) {
    if (/^[\-−–]/.test(s)) neg = true;
    s = s.replace(/^[+\-−–]\s*/, '');
  }
  if (/[-−–]\s*$/.test(s)) { neg = true; s = s.replace(/[-−–]\s*$/, ''); }
  s = s.replace(/[₪$€£‏‎ \s]/g, '');
  s = s.replace(/[^0-9,\.\-]/g, '');

  var lastDot = s.lastIndexOf('.');
  var lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '');
      s = s.replace(/,/g, '.');
    }
  } else if (lastComma !== -1) {
    var commaParts = s.split(',');
    var commaTail = commaParts[commaParts.length - 1] || '';
    if (commaParts.length > 2) {
      var allThousandsComma = true;
      for (var ci = 1; ci < commaParts.length; ci++) {
        if ((commaParts[ci] || '').length !== 3) { allThousandsComma = false; break; }
      }
      if (allThousandsComma) s = commaParts.join('');
      else { s = commaParts.slice(0, -1).join('') + '.' + commaTail; }
    } else if (commaTail.length <= 2) {
      s = s.replace(',', '.');
    } else if (commaTail.length === 3) {
      s = commaParts.join('');
    } else {
      s = commaParts.join('');
    }
  } else if (lastDot !== -1) {
    var dotParts = s.split('.');
    var dotTail = dotParts[dotParts.length - 1] || '';
    if (dotParts.length > 2) {
      var allThousandsDot = true;
      for (var di = 1; di < dotParts.length; di++) {
        if ((dotParts[di] || '').length !== 3) { allThousandsDot = false; break; }
      }
      if (allThousandsDot) s = dotParts.join('');
      else { s = dotParts.slice(0, -1).join('') + '.' + dotTail; }
    } else if (dotTail.length === 3 && (dotParts[0] || '').length >= 1) {
      s = dotParts.join('');
    }
  }

  s = s.replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}
