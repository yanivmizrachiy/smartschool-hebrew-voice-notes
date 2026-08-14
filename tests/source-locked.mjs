import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'worksheets/page-17.html');
const html = fs.readFileSync(file, 'utf8');

const normalize = value => value
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sourceMatch = html.match(/<!-- SOURCE-LOCK:START -->([\s\S]*?)<!-- SOURCE-LOCK:END -->/);
const errors = [];
if (!sourceMatch) {
  errors.push('page-17 must contain SOURCE-LOCK markers around the exact supplied source content');
}

const expectedSource = `
בס'ד
דף מלווה המחשה
ציוד: פלסטלינה, קשיות השוות באורכן, מספרים, שמרדף, דף שבו מצוירים מעגלים.
* צרו  מהפלסטלינה  נחש ,והניחו אותו על היקף המעגל.
* הניחו מספר קשיות כך שקצה אחד של הקשית יונח על שפת המעגל
* חברו את כל הקצוות האחרות  לנקודה אחת, ולאחר מכן חברו אותן עם כדור קטן של פלסטלינה
1.
1. מה קיבלתם?
________________________
רשמו בלוח המחיק מה מאפיין את הצורה שקיבלתם?
_______________________________________________
2. אילו חפצים  אתם מכירים  שנראים בצורה זו?
__________________________________________
הצורה שקיבלתם נקראת חרוט.
2 א.   תארו במילים שלכם אך יצרתם את החרוט?
_____________________________________________
ב.    התבוננו  בחרוטים שבנו חברי הקבוצה
כתבו  אילו  צורות  הנדסיות  בונות את החרוט?
__________________________________________
נכתוב בכתיב מתמטי
בסיס החרוט הוא  - מעגל
הנקודה שבה נפגשים כל הקטעים (הקשיות) נקראת -קודקוד החרוט
קטע המחבר נקודה על המעגל אל קודקוד החרוט נקרא- הקו היוצר
השלימו את הגדרת החרוט
חרוט הוא גוף תלת מימדי  שיש לו בסיס בצורת _________. לחרוט  קודקוד יחיד הנמצא ___________הבסיס.
כאשר כל הקטעים המחברים את שפת הבסיס לקודקוד  נקראים ___________.
האנך המורד מקודקוד החרוט אל מישור הבסיס נקרא גובה החרוט .
`;

if (sourceMatch && normalize(sourceMatch[1]) !== normalize(expectedSource)) {
  errors.push('page-17 visible source text is not an exact normalized copy of דף מלווה המחשה חרוט. מקוצר (6)');
}

const lockedRegion = sourceMatch?.[1] || '';
const sourceVisuals = lockedRegion.match(/data-source-visual="ayelet-original-cone"/g) || [];
const sourceSvgs = lockedRegion.match(/<svg\b/g) || [];
if (sourceVisuals.length !== 1) errors.push(`page-17 must contain exactly one locked Ayelet cone visual, found ${sourceVisuals.length}`);
if (sourceSvgs.length !== 1) errors.push(`page-17 must contain exactly one source SVG and no invented diagrams, found ${sourceSvgs.length}`);
if (!lockedRegion.includes('M74 16 L8 181 Q74 158 147 181 Z')) errors.push('page-17 source cone geometry changed');
if (!lockedRegion.includes('<ellipse cx="77.5" cy="181" rx="69.5" ry="24"')) errors.push('page-17 source cone base geometry changed');

const forbiddenChanges = [
  'בסיס החרוט הוא - עיגול',
  'בסיס החרוט הוא  - עיגול',
  'נקודה על שפת הבסיס אל קודקוד החרוט',
  'מחסן מילים',
  'סמנו את כל התכונות',
  'מחברים לעולם שסביבנו',
  'בודקים שהבנו',
  'בחרו את התיאור',
  'מהעיגול אל החרוט'
];
for (const phrase of forbiddenChanges) {
  if (normalize(lockedRegion).includes(normalize(phrase))) errors.push(`page-17 contains a source change/addition: ${phrase}`);
}

const forbiddenRedesignHooks = [
  'ayelet-build-grid',
  'ayelet-build-card',
  'ayelet-cone-map',
  'ayelet-mini-check',
  'ay-hero-cone',
  'ay-bg'
];
for (const hook of forbiddenRedesignHooks) {
  if (html.includes(hook)) errors.push(`page-17 contains an invented redesign hook: ${hook}`);
}

if (!html.includes('ayelet-special.css')) errors.push('page-17 must keep isolated special stylesheet');
if (!html.includes('class="a4-page ayelet-page"')) errors.push('page-17 must keep isolated ayelet-page scope');
if (!html.includes('data-origin-source="drive-cone-companion-ayelet"')) errors.push('page-17 must retain the Ayelet source identity');

if (errors.length) {
  console.error(`Ayelet exact source lock failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: page-17 matches the supplied Ayelet text exactly and keeps only the single source cone visual with quality-only styling.');
