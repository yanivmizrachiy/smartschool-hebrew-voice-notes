const txt=document.getElementById('txt'),statusBox=document.getElementById('status'),interimBox=document.getElementById('interim'),qualityBox=document.getElementById('qualityBox');
const DRAFT_KEY='yaniv_tracking_voice_text_v2';
let recognition=null,autoPunctuationTimer=null,isPunctuating=false,deferredInstallPrompt=null,swRegistration=null;

txt.value=localStorage.getItem(DRAFT_KEY)||'';
txt.addEventListener('input',()=>{saveDraft();scheduleAutoPunctuation(1200);});
txt.addEventListener('blur',()=>autoPunctuateNow('blur'));

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;showInstallUi();});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;markInstalled();statusBox.textContent='האפליקציה הותקנה במכשיר. מעכשיו פותחים אותה מהמסך הראשי.';});
window.addEventListener('load',()=>{setupServiceWorker();detectInstalledMode();scheduleAutoPunctuation(300);});

function saveDraft(){localStorage.setItem(DRAFT_KEY,txt.value);}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
function detectInstalledMode(){if(isStandalone())markInstalled();else setTimeout(()=>{if(!deferredInstallPrompt)showInstallUi();},900);}
function showInstallUi(){document.body.classList.remove('installed');const panel=document.getElementById('installPanel');if(panel)panel.hidden=false;}
function markInstalled(){document.body.classList.add('installed');const panel=document.getElementById('installPanel');if(panel)panel.hidden=true;}

async function installApp(){
  if(isStandalone()){markInstalled();return;}
  if(deferredInstallPrompt){
    const promptEvent=deferredInstallPrompt;deferredInstallPrompt=null;
    promptEvent.prompt();
    const choice=await promptEvent.userChoice.catch(()=>null);
    if(choice&&choice.outcome==='accepted'){markInstalled();return;}
    statusBox.textContent='ההתקנה לא אושרה. אפשר להתקין מאוחר יותר.';
    return;
  }
  statusBox.textContent='אם לא נפתח חלון התקנה: פתח את תפריט הדפדפן ובחר “הוסף למסך הבית” או “Install app”.';
  showInstallUi();
}

async function setupServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    swRegistration=await navigator.serviceWorker.register('sw.js');
    await checkForUpdates(false);
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(sessionStorage.getItem('yaniv_reloaded_for_update')==='1')return;
      sessionStorage.setItem('yaniv_reloaded_for_update','1');
      location.reload();
    });
  }catch(e){}
}

async function checkForUpdates(manual){
  if(!swRegistration){
    if(manual)statusBox.textContent='בדיקת עדכונים אינה זמינה בדפדפן הזה.';
    return;
  }
  try{
    await swRegistration.update();
    if(swRegistration.waiting){
      localStorage.setItem(DRAFT_KEY,txt.value||'');
      swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
      if(manual)statusBox.textContent='נמצא עדכון. האפליקציה מתרעננת לגרסה החדשה.';
      return;
    }
    if(manual)statusBox.textContent='האפליקציה מעודכנת.';
  }catch(e){
    if(manual)statusBox.textContent='לא הצלחתי לבדוק עדכונים כרגע. בדוק חיבור אינטרנט.';
  }
}

function initRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){statusBox.textContent='הדפדפן הזה לא תומך בהכתבה קולית. מומלץ לפתוח ב־Chrome או Edge.';return false;}
  recognition=new SR();
  recognition.lang='he-IL';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{statusBox.textContent='מאזין בעברית... הפיסוק האוטומטי פעיל.';};
  recognition.onend=()=>{autoPunctuateNow('speech-end');statusBox.textContent='ההכתבה נעצרה. הטקסט פוסק אוטומטית ואפשר להעתיק.';};
  recognition.onerror=e=>{let msg='שגיאת הכתבה: '+e.error+'.';if(e.error==='not-allowed')msg='המיקרופון חסום. אשר מיקרופון בהרשאות האתר.';if(e.error==='no-speech')msg='לא נקלט דיבור. נסה לדבר קרוב וברור יותר.';if(e.error==='network')msg='בעיית רשת בזיהוי הדיבור. בדוק אינטרנט ונסה שוב.';statusBox.textContent=msg;};
  recognition.onresult=event=>{let interim='',changed=false;for(let i=event.resultIndex;i<event.results.length;i++){const spoken=event.results[i][0].transcript.trim();if(event.results[i].isFinal){if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+=' ';txt.value+=spoken;changed=true;}else interim+=spoken+' ';}interimBox.textContent=interim;if(changed){saveDraft();scheduleAutoPunctuation(450);}};
  return true;
}
function startDictation(){if(!recognition&&!initRecognition())return;try{recognition.start();}catch(e){statusBox.textContent='ההכתבה כבר פעילה או שהדפדפן חסם התחלה כפולה.';}}
function stopDictation(){if(recognition)recognition.stop();autoPunctuateNow('manual-stop');}
function addText(s){txt.value+=s;txt.focus();saveDraft();scheduleAutoPunctuation(250);}
function restoreDraft(){txt.value=localStorage.getItem(DRAFT_KEY)||'';autoPunctuateNow('restore');statusBox.textContent=txt.value.trim()?'הטיוטה שוחזרה ופוסקה אוטומטית.':'לא נמצאה טיוטה שמורה.';}
function clearText(){if(confirm('לנקות את כל הטקסט?')){txt.value='';interimBox.textContent='';qualityBox.textContent='פיסוק עברי אוטומטי פעיל תמיד.';localStorage.removeItem(DRAFT_KEY);statusBox.textContent='הטקסט נוקה.';}}

function scheduleAutoPunctuation(delay=700){clearTimeout(autoPunctuationTimer);autoPunctuationTimer=setTimeout(()=>autoPunctuateNow('auto'),delay);}
function autoPunctuateNow(reason='auto'){
  if(isPunctuating)return;
  const before=txt.value;if(!before||!before.trim())return;
  isPunctuating=true;
  const cursorAtEnd=txt.selectionStart===txt.value.length&&txt.selectionEnd===txt.value.length;
  const fixed=smartHebrewPunctuation(before);
  if(fixed&&fixed!==before){txt.value=fixed;if(cursorAtEnd)txt.selectionStart=txt.selectionEnd=txt.value.length;saveDraft();}
  qualityBox.textContent=qualityCheck(txt.value)+' הפיסוק האוטומטי פעיל תמיד.';
  isPunctuating=false;
}

function normalizeHebrewText(x){return (x||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,'...').replace(/\u200f|\u200e/g,'').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').trim();}
function replaceSpokenPunctuation(x){const reps=[[/[\s,]+סימן שאלה[\s,]+/g,'? '],[/[\s,]+סימן קריאה[\s,]+/g,'! '],[/[\s,]+נקודה[\s,]+/g,'. '],[/[\s,]+פסיק[\s,]+/g,', '],[/[\s,]+נקודתיים[\s,]+/g,': '],[/[\s,]+שורה חדשה[\s,]+/g,'\n'],[/[\s,]+סעיף חדש[\s,]+/g,'\n']];reps.forEach(([re,val])=>x=x.replace(re,val));return x;}
function smartHebrewPunctuation(raw){
  let x=normalizeHebrewText(raw);if(!x)return '';x=' '+x+' ';x=replaceSpokenPunctuation(x);
  ['אבל','אולם','עם זאת','בנוסף','כמו כן','לכן','ולכן','מצד שני','לעומת זאת','בכל זאת','למרות זאת','במקביל'].forEach(w=>{x=x.replace(new RegExp('\\s+'+escapeRegExp(w)+'\\s+','g'),', '+w+' ');});
  ['יש להמשיך','יש לעקוב','יש ליצור קשר','חשוב להמשיך','מומלץ','נדרש','נדרשת','כדאי','בהמשך','לסיכום','ניכר כי','חשוב לציין'].forEach(w=>{x=x.replace(new RegExp('([^.!?\\n])\\s+'+escapeRegExp(w)+'\\s+','g'),'$1. '+w+' ');});
  x=x.replace(/\s+([,.!?;:])/g,'$1').replace(/([,.!?;:])([^\s\n])/g,'$1 $2').replace(/([,.!?])\s*\1+/g,'$1').replace(/\s+,/g,',').replace(/,\s*\./g,'.').replace(/\.\s*,/g,'.').replace(/^\s*[,.]\s*/,'').replace(/\s+/g,' ').trim();
  x=splitVeryLongSentences(x);if(x&&!/[.!?]$/.test(x))x+='.';return x;
}
function splitVeryLongSentences(x){const words=x.split(' ');if(words.length<34)return x;const soft=['יש','בנוסף','אבל','לכן','מומלץ','נדרש','חשוב','בהמשך','כדאי','ניכר'];let result=[],count=0;for(let i=0;i<words.length;i++){let w=words[i];count++;if(count>22&&soft.includes(w.replace(/[,.!?]/g,''))){const prev=result[result.length-1]||'';if(prev&&!/[.!?]$/.test(prev))result[result.length-1]=prev.replace(/[,]?$/,'.');count=1;}result.push(w);if(/[.!?]$/.test(w))count=0;}return result.join(' ');}
function qualityCheck(x){const notes=[];const heb=(x.match(/[\u0590-\u05FF]/g)||[]).length;const lat=(x.match(/[A-Za-z]/g)||[]).length;const words=(x.match(/\S+/g)||[]).length;const long=x.split(/[.!?]/).filter(s=>(s.trim().match(/\S+/g)||[]).length>32).length;if(!x.trim())notes.push('אין עדיין טקסט לבדיקה.');if(heb>0)notes.push('זוהתה עברית בטקסט.');if(lat>0)notes.push('יש תווים באנגלית — כדאי לבדוק אם זה מכוון.');if(long>0)notes.push('יש משפטים ארוכים מאוד — מומלץ לקרוא לפני הדבקה.');if(words>0&&notes.length<=1)notes.push('הפיסוק נראה תקין לבדיקה מהירה.');return notes.join(' ');}
async function copyText(){autoPunctuateNow('copy');try{await navigator.clipboard.writeText(txt.value);statusBox.textContent='הועתק. עבור למערכת הרצויה והדבק במקום המתאים.';}catch(e){txt.select();document.execCommand('copy');statusBox.textContent='הטקסט סומן להעתקה. אם לא הועתק אוטומטית, לחץ העתק במכשיר.';}}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
window.__autoPunctuateNow=autoPunctuateNow;
