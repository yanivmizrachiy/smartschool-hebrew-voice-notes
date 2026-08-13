# דפי אתגר חזותי — חוזי תוכן

## „כמה חרוטים מסתתרים בתמונה?”
- דף שאלה: `visual-pages/puzzle-1-question.html`
- דף תשובה: `visual-pages/puzzle-1-answer.html`
- סצנה: `visual-assets/count-scene.svg`
- מספר חרוטים מחייב: **15 בדיוק**.
- דף התשובה משתמש באותה סצנה בדיוק ומדגיש את כל 15 החרוטים.
- גם דף השאלה וגם דף התשובה חייבים להופיע בחוברת.

## „איפה מסתתר החרוט?”
- דף שאלה: `visual-pages/puzzle-2-question.html`
- דף תשובה: `visual-pages/puzzle-2-answer.html`
- סצנה: `visual-assets/find-scene.svg`
- מספר חרוטים מחייב: **1 בדיוק**.
- דף התשובה משתמש באותה סצנה בדיוק: הרקע בשחור־לבן ורק החרוט היחיד מודגש בצבע במיקומו המקורי.
- גם דף השאלה וגם דף התשובה חייבים להופיע בחוברת.

## כלל כותרות
בדפי התלמיד מופיעה **רק השאלה עצמה**. אין מספר פנימי, שם סוג פעילות או כותרת מערכתית לפני השאלה.

## QA
`tests/validate.mjs` סופר את מופעי `<use href="#cone">` בכל סצנה ומשווה ל־`verifiedConeCount` שב־`content/workbook.json`.

`tests/visual-pairs.mjs` מחייב לכל זוג:
- `answerSlug`/`questionSlug` הדדיים;
- אותו `sceneAsset` בדיוק;
- אותו `verifiedConeCount`;
- הופעה של שני הדפים ב־`printSequence`;
- שימוש בפועל באותו asset גם ב־HTML של השאלה וגם ב־HTML של התשובה.
