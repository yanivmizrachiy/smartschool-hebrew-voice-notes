from pathlib import Path
import re
p=Path('worksheets/page-37.html')
s=p.read_text()
s=re.sub(r'<nav class="preview-nav"[\s\S]*?</nav>\s*','',s,1)
s=s.replace('class="a4-page dense textbook-fill"','class="a4-page textbook-fill"')
s=re.sub(r'<footer class="sheet-footer"[\s\S]*?</footer>','',s)
s=s.replace('<th>אפשרי?</th></tr>','<th>אפשרי?</th><th>בדיקה</th></tr>')
s=s.replace('<td>10</td><td></td></tr>','<td>10</td><td></td><td></td></tr>')
s=s.replace('<td>17</td><td></td></tr>','<td>17</td><td></td><td></td></tr>')
s=s.replace('<td>9</td><td></td></tr>','<td>9</td><td></td><td></td></tr>')
s=s.replace('<td>13</td><td></td></tr>','<td>13</td><td></td><td></td></tr>')
s=s.replace('<section class="q-card"><h3>בודקים בעזרת קשר</h3><p>כתבו את הקשר שבו השתמשתם: <span class="blank bw-20"></span>.</p></section>','''<section class="q-card"><h3>יוצרים שלשה אפשרית משלכם</h3><p>בחרו רדיוס וגובה שלמים, חשבו יוצר מתאים וכתבו את שלושת הנתונים.</p><div class="answer-row"><span>רדיוס <span class="blank bw-6"></span></span><span>גובה <span class="blank bw-6"></span></span><span>יוצר <span class="blank bw-6"></span></span></div><div class="formula-space"></div><p>בדקו את השלשה בעזרת הקשר המתאים:</p><div class="formula-space"></div></section><section class="q-card"><h3>כלל בדיקה</h3><p>איך אפשר לבדוק אם שלוש מידות נתונות יכולות להשתייך לחרוט ישר?</p><div class="answer-lines"><div class="answer-line"></div><div class="answer-line"></div></div></section>''')
p.write_text(s)
