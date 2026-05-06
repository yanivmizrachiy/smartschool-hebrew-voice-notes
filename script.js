const txt=document.getElementById('txt'),statusBox=document.getElementById('status'),interimBox=document.getElementById('interim'),qualityBox=document.getElementById('qualityBox');
const DRAFT_KEY='yaniv_tracking_voice_text_v2';
const COMFORT_KEY='yaniv_tracking_voice_comfort_mode_v1';
let recognition=null;
let autoPunctuationTimer=null;
let isPunctuating=false;

txt.value=localStorage.getItem(DRAFT_KEY)||'';
txt.addEventListener('input',()=>{saveDraft();scheduleAutoPunctuation(1300);});
txt.addEventListener('blur',()=>autoPunctuateNow('blur'));
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
window.addEventListener('load',()=>{runDiagnostics();detectDeviceLayout();restoreComfortMode();scheduleAutoPunctuation(400);});
window.addEventListener('resize',()=>detectDeviceLayout());

function saveDraft(){localStorage.setItem(DRAFT_KEY,txt.value);updateDraftDiag();}
function setDiag(id,cls,text){const el=document.getElementById(id);if(!el)return;el.className='diag-card '+cls;el.textContent=text;}
async function runDiagnostics(){const secure=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';setDiag('diagSecure',secure?'ok':'warn',secure?'חיבור תקין למיקרופון':'מומלץ לפתוח ב־HTTPS');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;setDiag('diagSpeech',SR?'ok':'bad',SR?'הכתבה נתמכת בדפדפן':'הדפדפן לא תומך בהכתבה');updateDraftDiag();try{if(navigator.permissions&&navigator.permissions.query){const p=await navigator.permissions.query({name:'microphone'});const map={granted:'מיקרופון מאושר',prompt:'יידרש אישור מיקרופון',denied:'המיקרופון חסום'};setDiag('diagMic',p.state==='granted'?'ok':p.state==='denied'?'bad':'warn',map[p.state]||'מצב מיקרופון לא ידוע');}else setDiag('diagMic','warn','מיקרופון ייבדק בלחיצה');}catch(e){setDiag('diagMic','warn','מיקרופון ייבדק בלחיצה');}}
function updateDraftDiag(){const hasDraft=(localStorage.getItem(DRAFT_KEY)||'').trim().length>0;setDiag('diagDraft',hasDraft?'ok':'warn',hasDraft?'טיוטה שמורה בדפדפן':'אין טיוטה שמורה');}

function detectDeviceLayout(){
  const w=window.innerWidth||document.documentElement.clientWidth;
  const title=document.getElementById('deviceTitle');
  const text=document.getElementById('deviceText');
  if(!title||!text)return;
  if(w<=720){title.textContent='זוהה טלפון';text.textContent='התצוגה הותאמה אוטומטית. כפתורי דבר, עצור והעתק מופיעים למטה לפתיחה מהירה.';}
  else if(w<=1024){title.textContent='זוהה טאבלט או מסך ביניים';text.textContent='התצוגה הותאמה אוטומטית עם כפתורים גדולים ונוחים.';}
  else{title.textContent='זוהה מחשב';text.textContent='התצוגה הותאמה אוטומטית. מומלץ לעבוד עם הכפתורים העליונים.';}
}
function restoreComfortMode(){if(localStorage.getItem(COMFORT_KEY)==='1'){document.body.classList.add('comfort-mode');updateComfortButton();}}
function toggleComfortMode(){document.body.classList.toggle('comfort-mode');localStorage.setItem(COMFORT_KEY,document.body.classList.contains('comfort-mode')?'1':'0');updateComfortButton();}
function updateComfortButton(){const btn=document.getElementById('comfortBtn');if(btn)btn.textContent=document.body.classList.contains('comfort-mode')?'תצוגה רגילה':'תצוגה גדולה';}

function initRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){statusBox.textContent='הדפדפן הזה לא תומך בהכתבה קולית. מומלץ לפתוח ב־Chrome או Edge.';return false;}recognition=new SR();recognition.lang='he-IL';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;recognition.onstart=()=>{statusBox.textContent='מאזין בעברית... הפיסוק האוטומטי פעיל.';setDiag('diagMic','ok','המיקרופון פעיל עכשיו');};recognition.onend=()=>{autoPunctuateNow('speech-end');statusBox.textContent='ההכתבה נעצרה. הטקסט פוסק אוטומטית ואפשר להעתיק.';};recognition.onerror=(e)=>{let msg='שגיאת הכתבה: '+e.error+'.';if(e.error==='not-allowed')msg='המיקרופון חסום. פתח הרשאות אתר ואשר מיקרופון.';if(e.error==='no-speech')msg='לא נקלט דיבור. נסה לדבר קרוב וברור יותר.';if(e.error==='network')msg='בעיית רשת בזיהוי הדיבור. בדוק אינטרנט ונסה שוב.';statusBox.textContent=msg;};recognition.onresult=(event)=>{let interim='';let changed=false;for(let i=event.resultIndex;i<event.results.length;i++){const spoken=event.results[i][0].transcript.trim();if(event.results[i].isFinal){if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+=' ';txt.value+=spoken;changed=true;}else interim+=spoken+' ';}interimBox.textContent=interim;if(changed){saveDraft();scheduleAutoPunctuation(450);}};return true;}
function startDictation(){if(!recognition&&!initRecognition())return;try{recognition.start();}catch(e){statusBox.textContent='ההכתבה כבר פעילה או שהדפדפן חסם התחלה כפולה.';}}
function stopDictation(){if(recognition)recognition.stop();autoPunctuateNow('manual-stop');}
function addText(s){txt.value+=s;txt.focus();saveDraft();scheduleAutoPunctuation(250);}
function insertTemplate(s){if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+='\n';txt.value+=s;txt.focus();saveDraft();autoPunctuateNow('template');}
function restoreDraft(){txt.value=localStorage.getItem(DRAFT_KEY)||'';autoPunctuateNow('restore');statusBox.textContent=txt.value.trim()?'הטיוטה שוחזרה ופוסקה אוטומטית.':'לא נמצאה טיוטה שמורה.';}
function clearText(){if(confirm('לנקות את כל הטקסט?')){txt.value='';interimBox.textContent='';qualityBox.textContent='פיסוק עברי אוטומטי פעיל: אחרי הכתבה, לפני העתקה, וביציאה מתיבת הטקסט.';localStorage.removeItem(DRAFT_KEY);updateDraftDiag();statusBox.textContent='הטקסט נוקה.';}}

function scheduleAutoPunctuation(delay=700){clearTimeout(autoPunctuationTimer);autoPunctuationTimer=setTimeout(()=>autoPunctuateNow('auto'),delay);}
function autoPunctuateNow(reason='auto'){
  if(isPunctuating)return;
  const before=txt.value;
  if(!before||!before.trim())return;
  isPunctuating=true;
  const cursorAtEnd=txt.selectionStart===txt.value.length&&txt.selectionEnd===txt.value.length;
  const fixed=smartHebrewPunctuation(before);
  if(fixed&&fixed!==before){txt.value=fixed;if(cursorAtEnd)txt.selectionStart=txt.selectionEnd=txt.value.length;saveDraft();}
  qualityBox.textContent=qualityCheck(txt.value)+' הפיסוק האוטומטי פעיל תמיד.';
  isPunctuating=false;
}

function normalizeHebrewText(x){return (x||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,'...').replace(/\u200f|\u200e/g,'').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').trim();}
function replaceSpokenPunctuation(x){const reps=[[/[\s,]+סימן שאלה[\s,]+/g,'? '],[/[\s,]+סימן קריאה[\s,]+/g,'! '],[/[\s,]+נקודה[\s,]+/g,'. '],[/[\s,]+פסיק[\s,]+/g,', '],[/[\s,]+נקודתיים[\s,]+/g,': '],[/[\s,]+שורה חדשה[\s,]+/g,'\n'],[/[\s,]+סעיף חדש[\s,]+/g,'\n']];reps.forEach(([re,val])=>x=x.replace(re,val));return x;}
function smartHebrewPunctuation(raw){let x=normalizeHebrewText(raw);if(!x)return '';x=' '+x+' ';x=replaceSpokenPunctuation(x);
  ['אבל','אולם','עם זאת','בנוסף','כמו כן','לכן','ולכן','מצד שני','לעומת זאת','בכל זאת','למרות זאת','במקביל'].forEach(w=>{x=x.replace(new RegExp('\\s+'+escapeRegExp(w)+'\\s+','g'),', '+w+' ');});
  ['יש להמשיך','יש לעקוב','יש ליצור קשר','חשוב להמשיך','מומלץ','נדרש','נדרשת','כדאי','בהמשך','לסיכום','התלמיד זקוק','התלמידה זקוקה','התלמיד מתקשה','התלמידה מתקשה','התלמיד לא הגיע','התלמידה לא הגיעה','ניכר כי','חשוב לציין'].forEach(w=>{x=x.replace(new RegExp('([^.!?\\n])\\s+'+escapeRegExp(w)+'\\s+','g'),'$1. '+w+' ');});
  ['התלמיד השתתף בשיעור','התלמידה השתתפה בשיעור','התלמיד עבד ברצינות','התלמידה עבדה ברצינות','לאורך השיעור','במהלך העבודה','בשיעור היום'].forEach(w=>{x=x.replace(new RegExp(escapeRegExp(w)+'\\s+(?=(עבד|עבדה|שיתף|שיתפה|התקשה|התקשתה|נדרש|נדרשת|הראה|הראתה|גילה|גילתה|השתתף|השתתפה))','g'),w+', ');});
  x=x.replace(/\s+([,.!?;:])/g,'$1').replace(/([,.!?;:])([^\s\n])/g,'$1 $2').replace(/([,.!?])\s*\1+/g,'$1').replace(/\s+,/g,',').replace(/,\s*\./g,'.').replace(/\.\s*,/g,'.').replace(/^\s*[,.]\s*/,'').replace(/\s+/g,' ').trim();
  x=splitVeryLongSentences(x);if(x&&!/[.!?]$/.test(x))x+='.';return x;}
function splitVeryLongSentences(x){const words=x.split(' ');if(words.length<34)return x;const soft=['יש','בנוסף','אבל','לכן','מומלץ','נדרש','חשוב','בהמשך','כדאי','ניכר'];let result=[],count=0;for(let i=0;i<words.length;i++){let w=words[i];count++;if(count>22&&soft.includes(w.replace(/[,.!?]/g,''))){const prev=result[result.length-1]||'';if(prev&&!/[.!?]$/.test(prev))result[result.length-1]=prev.replace(/[,]?$/,'.');count=1;}result.push(w);if(/[.!?]$/.test(w))count=0;}return result.join(' ');}
function qualityCheck(x){const notes=[];const heb=(x.match(/[\u0590-\u05FF]/g)||[]).length;const lat=(x.match(/[A-Za-z]/g)||[]).length;const words=(x.match(/\S+/g)||[]).length;const long=x.split(/[.!?]/).filter(s=>(s.trim().match(/\S+/g)||[]).length>32).length;if(!x.trim())notes.push('אין עדיין טקסט לבדיקה.');if(heb>0)notes.push('זוהתה עברית בטקסט.');if(lat>0)notes.push('יש תווים באנגלית — כדאי לבדוק אם זה מכוון.');if(/[,.!?]{2,}/.test(x))notes.push('נמצאו סימני פיסוק כפולים ותוקנו ככל האפשר.');if(long>0)notes.push('יש משפטים ארוכים מאוד — מומלץ לקרוא לפני הדבקה.');if(words>0&&notes.length<=1)notes.push('הפיסוק נראה תקין לבדיקה מהירה.');return notes.join(' ');}
function smartPunctuateAndCheck(){autoPunctuateNow('manual-or-legacy');statusBox.textContent='הטקסט פוסק אוטומטית. מומלץ לקרוא שנייה לפני העתקה.';}
async function copyText(){autoPunctuateNow('copy');try{await navigator.clipboard.writeText(txt.value);statusBox.textContent='הועתק. עבור למערכת הרצויה והדבק במקום המתאים.';}catch(e){txt.select();document.execCommand('copy');statusBox.textContent='הטקסט סומן להעתקה. אם לא הועתק אוטומטית, לחץ העתק במכשיר.';}}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
window.__smartHebrewPunctuation=smartHebrewPunctuation;window.__qualityCheck=qualityCheck;window.__autoPunctuateNow=autoPunctuateNow;
