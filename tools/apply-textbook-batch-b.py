from pathlib import Path
import re


def clean(path, old_class, new_class):
    p = Path(path)
    s = p.read_text()
    s = re.sub(r'<nav class="preview-nav"[\s\S]*?</nav>\s*', '', s, 1)
    s = s.replace(old_class, new_class)
    s = re.sub(r'<footer class="sheet-footer"[\s\S]*?</footer>', '', s)
    p.write_text(s)


# Page 2: the first pass overflowed. Keep improved scale, remove the extra standalone card.
p = Path('worksheets/page-2.html')
s = p.read_text()
s = re.sub(r'<section class="q-card page-2-transition">[\s\S]*?</section>', '', s, 1)
p.write_text(s)

# Page 21: explain where the two required measurements enter the volume formula.
clean('worksheets/page-21.html', 'class="a4-page dense"', 'class="a4-page page-21-layout"')
p = Path('worksheets/page-21.html')
s = p.read_text()
anchor = '<section class="q-card"><h3>רדיוס או קוטר?</h3>'
block = '''<section class="q-card formula-map"><h3>מה נכנס לכל מקום בנוסחה?</h3><div class="formula-map-grid"><svg viewBox="0 0 300 180" role="img" aria-label="חרוט תלת־ממדי עם רדיוס וגובה מסומנים"><image href="../visual-assets/cone-3d-upright.svg" x="25" y="-5" width="250" height="185" preserveAspectRatio="xMidYMid meet"/><line x1="150" y1="24" x2="150" y2="134" stroke="#667085" stroke-width="1.5" stroke-dasharray="6 4"/><line x1="150" y1="134" x2="225" y2="134" stroke="#667085" stroke-width="1.5"/><text x="121" y="85" font-size="14">גובה</text><text x="178" y="128" font-size="14">רדיוס</text></svg><div><p class="formula-scaffold">נפח = ⅓ × π × <span class="blank bw-8"></span>² × <span class="blank bw-8"></span></p><p>במקום הראשון כותבים את <b>רדיוס הבסיס</b>; במקום השני את <b>גובה החרוט</b>.</p><p>סמנו בציור את שתי המידות שמשתתפות בנוסחה. האם היוצר נכנס ישירות לנוסחה?</p><div class="choice-row"><span class="choice">כן</span><span class="choice">לא</span></div></div></div></section>'''
if 'formula-map' not in s:
    s = s.replace(anchor, block + anchor, 1)
p.write_text(s)

# Page 22: preserve the same calculations, add room and a self-check.
clean('worksheets/page-22.html', 'class="a4-page dense"', 'class="a4-page page-22-layout"')
p = Path('worksheets/page-22.html')
s = p.read_text()
old = '<div class="choice-row"><span class="choice">רדיוס</span><span class="choice">גובה</span><span class="choice">יוצר</span></div></section></div>'
new = '<div class="choice-row"><span class="choice">רדיוס</span><span class="choice">גובה</span><span class="choice">יוצר</span></div><p>הסבירו בקצרה מדוע הנתון שבחרתם אינו נדרש ישירות:</p><div class="answer-line"></div></section><section class="q-card volume-check"><h3>בדיקת עצמי לפני שמסיימים</h3><div class="choice-list"><div class="choice-item"><span class="mark-box"></span><span>בדקתי אם נתון רדיוס או קוטר.</span></div><div class="choice-item"><span class="mark-box"></span><span>השתמשתי בגורם ⅓ בנוסחת נפח החרוט.</span></div><div class="choice-item"><span class="mark-box"></span><span>כתבתי יחידת נפח — סמ״ק.</span></div></div></section></div>'
if 'volume-check' not in s:
    s = s.replace(old, new, 1)
p.write_text(s)

# Page 6: content is already rich; only expand calculation/reasoning space.
clean('worksheets/page-6.html', 'class="a4-page"', 'class="a4-page page-6-layout"')

# Page 23: deepen correction of the same already-verified errors.
clean('worksheets/page-23.html', 'class="a4-page dense"', 'class="a4-page page-23-layout"')
p = Path('worksheets/page-23.html')
s = p.read_text()
if '<b>כתבו הצבה וחישוב נכונים:</b>' not in s:
    s = s.replace('</div></section>\n<div class="cols-2">', '</div><p><b>כתבו הצבה וחישוב נכונים:</b></p><div class="formula-space"></div></section>\n<div class="cols-2">', 1)
if '<b>תקנו את החישוב:</b>' not in s:
    s = s.replace('מה חסר? <span class="blank bw-8"></span></p></section>', 'מה חסר? <span class="blank bw-8"></span></p><p><b>תקנו את החישוב:</b></p><div class="formula-space"></div></section>', 1)
if '<b>כתבו את הנפח לאחר ההצבה הנכונה:</b>' not in s:
    s = s.replace('</div></section></div>\n<section class="q-card"><h3>יחידת תשובה</h3>', '</div><p><b>כתבו את הנפח לאחר ההצבה הנכונה:</b></p><div class="answer-line"></div></section></div>\n<section class="q-card"><h3>יחידת תשובה</h3>', 1)
if 'מדוע זו יחידת נפח' not in s:
    s = s.replace('תקנו רק את היחידה: <span class="blank bw-8"></span>.</p></section>', 'תקנו רק את היחידה: <span class="blank bw-8"></span>.</p><p>הסבירו מדוע זו יחידת נפח ולא יחידת שטח:</p><div class="answer-lines"><div class="answer-line"></div><div class="answer-line"></div></div></section>', 1)
p.write_text(s)

css = Path('worksheets/styles.css')
c = css.read_text()
c = c.replace('.page-2-layout .draw-box{height:58px}', '.page-2-layout .draw-box{height:78px}')
marker = '/* textbook layout batch B */'
rules = '''
/* textbook layout batch B */
.page-21-layout{font-size:12.7px}.page-21-layout .sheet-content{gap:10px}.page-21-layout .q-card{padding:11px 13px 12px}.page-21-layout .q-card h3{margin:-11px -13px 9px;padding:8px 12px 8px 32px}.page-21-layout .work-table th,.page-21-layout .work-table td{padding:8px 9px}.page-21-layout .formula-display{font-size:24px}.page-21-layout .formula-map-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:16px;align-items:center}.page-21-layout .formula-map-grid svg{width:100%;height:180px}.page-21-layout .formula-scaffold{font-size:18px;font-weight:800;text-align:center;padding:12px;background:#f2fafc;border-radius:10px}.page-21-layout .answer-line{height:1.8em}
.page-22-layout{font-size:12.7px}.page-22-layout .sheet-content{gap:10px}.page-22-layout .q-card{padding:11px 13px 12px}.page-22-layout .q-card h3{margin:-11px -13px 9px;padding:8px 12px 8px 32px}.page-22-layout .work-table th,.page-22-layout .work-table td{padding:9px}.page-22-layout .work-table td{height:48px}.page-22-layout .formula-space{min-height:78px}.page-22-layout .answer-line{height:1.7em}.page-22-layout .volume-check .choice-list{gap:8px}
.page-6-layout{font-size:12.7px}.page-6-layout .sheet-content{gap:10px}.page-6-layout .q-card{padding:11px 13px 12px}.page-6-layout .q-card h3{margin:-11px -13px 9px;padding:8px 12px 8px 32px}.page-6-layout .work-table th,.page-6-layout .work-table td{padding:8px 9px}.page-6-layout .work-table td{height:42px}.page-6-layout .answer-line{height:1.9em}.page-6-layout .answer-lines .answer-line{height:2em}
.page-23-layout{font-size:12.7px}.page-23-layout .sheet-content{gap:10px}.page-23-layout .q-card{padding:11px 13px 12px}.page-23-layout .q-card h3{margin:-11px -13px 9px;padding:8px 12px 8px 32px}.page-23-layout .formula-space{min-height:82px}.page-23-layout .answer-line{height:1.8em}.page-23-layout .answer-lines .answer-line{height:2em}.page-23-layout .choice-list{gap:7px}
'''
if marker not in c:
    c += rules
css.write_text(c)
