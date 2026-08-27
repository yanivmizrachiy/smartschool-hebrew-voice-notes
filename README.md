# מעגל, גליל וחרוט — חוברות עבודה במתמטיקה

הריפו הזה מכיל שלוש חוברות נפרדות: **מעגל, גליל וחרוט**, יחד עם דפי A4, תשתיות הדפסה, QA וכלי build.

## מצב נוכחי

- **מעגל:** 90 דפי A4.
- **גליל:** 38 דפי A4.
- **חרוט:** 38 דפי עבודה + 8 דפים חזותיים = 46 דפי A4 בחוברת המלאה.
- דף 17 בחרוט נשאר source-locked.

## מקור האמת היחיד

**`RULES.md` הוא מקור האמת היחיד והמחייב של כל פרויקט מעגל–גליל–חרוט.**

`content/*.json`, קובצי `research/`, `qa/`, `viewer/`, tests ושאר הקבצים הם נתוני יישום, מקורות, מחקר, תיעוד או בדיקות בלבד. הם אינם מקור דרישות ואינם רשאים לסתור או לגבור על `RULES.md`.

אין להסתמך על זיכרון שיחה במקום `RULES.md` שב־repo.

## מודל הנתונים

`content/catalog.json` הוא קטלוג היישום של שלוש החוברות ומפנה ל־manifest של כל חוברת. הספירות והנתיבים של מעגל וגליל נשמרים ב־`content/circle.json` וב־`content/cylinder.json`; חרוט נשאר ב־`content/workbook.json`. קובצי `content/schemas/` והבדיקה `tests/catalog-contract.mjs` מאמתים את מבנה הנתונים ואת הסכום 174.

## פקודות איכות

- `npm run build` — build לא־הרסני: מאמת שקובצי המקור מסונכרנים עם ה־manifest ואינו משנה אותם.
- `npm run sync:source` — סנכרון מפורש ומכוון של metadata/מספור/קרדיטים לקובצי המקור; יש להריץ רק כאשר רוצים לייצר שינוי source ולסקור את ה־diff.
- `npm run build:print` — בונה את חבילת ההדפסה המאוחדת של החרוט.
- `npm run build:site` — בונה `dist/` נקי שמכיל רק את תוצרי ה־runtime שנועדו לפריסה, ומוסיף fingerprint קנוני.
- `npm run validate:repro` — מוכיח ששתי בניות print רצופות מאותו source מייצרות fingerprint זהה.
- `npm run validate:math-properties` — מריץ invariants גאומטריים דטרמיניסטיים על מאות/אלפי צירופי נתונים.
- `npm run validate:dist` — בודק שה־deployment artifact מכיל את כל 174 הדפים ואינו מדליף קבצי פיתוח/QA.
- `npm run validate` — מפעיל את חוזי הקטלוג, התוכן, המתמטיקה, המספור, המקורות, הדפים החזותיים והיגיינת הריפו.
- `npm run check` — מסלול האימות המלא: build לא־הרסני, print, reproducibility, validation, `dist/` ו־dist contract.
- `npm run render:pages` — מרנדר את רצף A4 דרך Chrome כאשר שרת מקומי פעיל ב־`127.0.0.1:4173`.

## CI

`Workbook quality`, `Textbook layout render` ו־`CodeQL` הם שערי האיכות המרכזיים. סביבת Node נעולה ל־24 LTS, התקנת npm משתמשת ב־`npm ci`, ו־CI בודק בין היתר catalog/manifests, reproducibility, מתמטיקה, browser, mobile, A4, PDF, render fidelity, deployment artifact ו־security analysis.

CI שומר artifacts כגון screenshots, PDFs, visual-asset readiness, `dist/` מאומת ו־`dist/build-manifest.json`, כדי ש־PASS יהיה ניתן להוכחה ולא רק הודעת טקסט.

Dependabot מוגדר למעקב שבועי אחר npm ו־GitHub Actions.

## מבנה הריפו

- `circle/` — דפי המעגל.
- `cylinder/` — דפי הגליל.
- `worksheets/` — דפי worksheet של החרוט.
- `visual-pages/` — דפים חזותיים/תשובות של החרוט.
- `visual-assets/` — נכסים חזותיים מקומיים.
- `content/` — catalog, manifests, schemas ורישום מקורות של המימוש.
- `questions/` — מקורות, מפת שאלות ומפתח תשובות פנימי.
- `research/` — מחקר ופדגוגיה; אינו מקור דרישות.
- `viewer/` — אפליקציית הדפדוף וההדפסה, המונעת מהקטלוג הקנוני.
- `src/` — מנועי build וסנכרון מפורש.
- `tests/` — חוזי איכות קבועים.
- `tools/` — כלי QA/build evidence.
- `qa/` — ביקורות ותיעוד QA; אינו מקור דרישות. תיקיות evidence generated אינן נשמרות כמקור.
- `print/harut-a4.html` — חבילת ההדפסה המאוחדת של החרוט לאחר `build:print`.
- `dist/` — artifact generated לפריסה בלבד; אינו source ונשמר מחוץ ל־Git.

## היגיינת ריפו

קבצי staging, קובצי `*.b64`, workflows חד־פעמיים, קובצי `DO-NOT-MERGE`, סקריפטי `tools/apply-*` ופלט זמני אינם חלק ממקור האמת. `tests/repo-hygiene.mjs` מונע מהם לחזור, חוסם מקור אמת מקביל ומוודא שאין תלות של תוצר התלמיד בקישורי Google Drive פרטיים.

## פער חזותי ידוע — חרוט

ארבעת דפי התמונה המלאים עדיין משתמשים בנכסי JPG שאינם נכסי המקור הסופיים להדפסה. `tools/qa-visual-assets.mjs` מייצר status מכונתי ומסמן אותם `BLOCKED EXTERNAL ASSET` כאשר הם מתחת לרף הרזולוציה. אין להמציא תחליף; המקורות האיכותיים צריכים להיכנס לריפו לפני שניתן לסגור את הפער.

## עיקרון

אין דמו, אין כפילויות מכניות, וכל שינוי צריך לשפר תוכן, דיוק, חוויית למידה, אמינות או תחזוקתיות בלי לבטל עבודה טובה שכבר נעשתה. טכנולוגיה חדשה נכנסת רק כשיש צורך אמיתי ובדיקה שמוכיחה שאין רגרסיה.
