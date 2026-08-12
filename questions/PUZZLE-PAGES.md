# דפי שעשועון — חוזי תוכן

## שעשועון ראשון — ספירת חרוטים
- דף שאלה: `visual-pages/puzzle-1-question.html`
- דף תשובה: `visual-pages/puzzle-1-answer.html`
- סצנה: `visual-assets/count-scene.svg`
- מספר חרוטים מחייב: **15 בדיוק**.
- דף התשובה מסמן את כל 15 החרוטים במספור 1–15.
- מיקום בחוברת: דף השאלה אחרי דף עבודה 8; דף התשובה בסוף.

## שעשועון שני — איתור חרוט יחיד
- דף שאלה: `visual-pages/puzzle-2-question.html`
- דף תשובה: `visual-pages/puzzle-2-answer.html`
- סצנה: `visual-assets/find-scene.svg`
- מספר חרוטים מחייב: **1 בדיוק**.
- דף התשובה מסמן את החרוט היחיד במקום המדויק שלו.
- מיקום בחוברת: דף השאלה אחרי דף עבודה 12; דף התשובה בסוף.

## QA
`tests/validate.mjs` סופר את מופעי `<use href="#cone">` בכל סצנה ומשווה ל־`verifiedConeCount` שב־`content/workbook.json`. שינוי במספר החרוטים בלי עדכון מכוון של מקור האמת מכשיל CI.
