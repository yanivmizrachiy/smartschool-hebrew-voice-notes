import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'worksheets/page-17.html');
const html = fs.readFileSync(file, 'utf8');

const normalize = value => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const text = normalize(html);
const requiredSourceText = [
  "בס'ד",
  'דף מלווה המחשה',
  'ציוד: פלסטלינה, קשיות השוות באורכן, מספרים, שמרדף, דף שבו מצוירים מעגלים.',
  'צרו מהפלסטלינה נחש ,והניחו אותו על היקף המעגל.',
  'הניחו מספר קשיות כך שקצה אחד של הקשית יונח על שפת המעגל',
  'חברו את כל הקצוות האחרות לנקודה אחת, ולאחר מכן חברו אותן עם כדור קטן של פלסטלינה',
  '1. מה קיבלתם?',
  'רשמו בלוח המחיק מה מאפיין את הצורה שקיבלתם?',
  '2. אילו חפצים אתם מכירים שנראים בצורה זו?',
  'הצורה שקיבלתם נקראת חרוט.',
  '2 א. תארו במילים שלכם אך יצרתם את החרוט?',
  'ב. התבוננו בחרוטים שבנו חברי הקבוצה',
  'כתבו אילו צורות הנדסיות בונות את החרוט?',
  'נכתוב בכתיב מתמטי',
  'בסיס החרוט הוא - מעגל',
  'הנקודה שבה נפגשים כל הקטעים (הקשיות) נקראת -קודקוד החרוט',
  'קטע המחבר נקודה על המעגל אל קודקוד החרוט נקרא- הקו היוצר',
  'השלימו את הגדרת החרוט',
  'חרוט הוא גוף תלת מימדי שיש לו בסיס בצורת',
  'לחרוט קודקוד יחיד הנמצא',
  'כאשר כל הקטעים המחברים את שפת הבסיס לקודקוד נקראים',
  'האנך המורד מקודקוד החרוט אל מישור הבסיס נקרא גובה החרוט .'
].map(normalize);

const errors = [];
for (const phrase of requiredSourceText) {
  if (!text.includes(phrase)) errors.push(`missing locked source phrase: ${phrase}`);
}

const forbiddenAdditions = [
  'מחסן מילים',
  'סמנו את כל התכונות',
  'מחברים לעולם שסביבנו',
  'בודקים שהבנו',
  'בחרו את התיאור',
  'מהעיגול אל החרוט'
];
for (const phrase of forbiddenAdditions) {
  if (text.includes(phrase)) errors.push(`page-17 contains project-authored addition: ${phrase}`);
}

if (!html.includes('ayelet-special.css')) errors.push('page-17 must keep isolated special stylesheet');
if (!html.includes('class="a4-page ayelet-page"')) errors.push('page-17 must keep isolated ayelet-page scope');

if (errors.length) {
  console.error(`Ayelet source lock failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: page-17 keeps the locked Google Doc content while allowing isolated visual styling.');
