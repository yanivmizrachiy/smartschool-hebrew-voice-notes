const txt=document.getElementById('txt');
const statusBox=document.getElementById('status');
const interimBox=document.getElementById('interim');
const qualityBox=document.getElementById('qualityBox');
const installPanel=document.getElementById('installPanel');
const copyNote=document.getElementById('copyNote');

const DRAFT_KEY='yaniv_tracking_voice_text_v2';
let recognition=null;
let autoPunctuationTimer=null;
let isPunctuating=false;
let deferredInstallPrompt=null;
let swRegistration=null;
let copyNoteTimer=null;

function setBox(el,msg){
  if(!el)return;
  const text=(msg||'').trim();
  if(text){el.hidden=false;el.textContent=text;}else{el.textContent='';el.hidden=true;}
}

function setListening(active){document.body.classList.toggle('listening',!!active);}

function showCopyNote(msg='הטקסט הועתק'){
  if(!copyNote)return;
  copyNote.hidden=false;
  copyNote.textContent=msg;
  clearTimeout(copyNoteTimer);
  copyNoteTimer=setTimeout(()=>setBox(copyNote,''),2800);
}

if(txt){
  txt.value=localStorage.getItem(DRAFT_KEY)||'';
  txt.addEventListener('input',()=>{saveDraft();scheduleAutoPunctuation(850);});
  txt.addEventListener('blur',()=>autoPunctuateNow('blur'));
}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;showInstallUi();});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;markInstalled();});
window.addEventListener('load',()=>{setupServiceWorker();detectInstalledMode();scheduleAutoPunctuation(250);});

function saveDraft(){if(txt)localStorage.setItem(DRAFT_KEY,txt.value||'');}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
function showInstallUi(){if(installPanel)installPanel.hidden=false;document.body.classList.remove('installed');}
function markInstalled(){document.body.classList.add('installed');if(installPanel)installPanel.hidden=true;}
function detectInstalledMode(){if(isStandalone())markInstalled();else setTimeout(()=>{if(!deferredInstallPrompt)showInstallUi();},900);}

async function installApp(){
  if(isStandalone()){markInstalled();return;}
  if(deferredInstallPrompt){
    const promptEvent=deferredInstallPrompt;deferredInstallPrompt=null;
    promptEvent.prompt();
    const choice=await promptEvent.userChoice.catch(()=>null);
    if(choice&&choice.outcome==='accepted')markInstalled();
    return;
  }
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
  if(!swRegistration)return;
  try{
    await swRegistration.update();
    if(swRegistration.waiting){saveDraft();swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}
  }catch(e){}
}

function initRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setBox(statusBox,'הדפדפן לא תומך בהכתבה');return false;}
  recognition=new SR();
  recognition.lang='he-IL';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{setListening(true);setBox(statusBox,'');};
  recognition.onend=()=>{setListening(false);autoPunctuateNow('speech-end');setBox(statusBox,'');};
  recognition.onerror=e=>{
    setListening(false);
    let msg='';
    if(e.error==='not-allowed')msg='המיקרופון חסום';
    else if(e.error==='no-speech')msg='לא נקלט דיבור';
    else if(e.error==='network')msg='בעיית רשת';
    setBox(statusBox,msg);
  };
  recognition.onresult=event=>{
    let interim='',changed=false;
    for(let i=event.resultIndex;i<event.results.length;i++){
      const spoken=event.results[i][0].transcript.trim();
      if(event.results[i].isFinal){
        if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+=' ';
        txt.value+=spoken;
        changed=true;
      }else interim+=spoken+' ';
    }
    if(interimBox)interimBox.textContent=interim;
    if(changed){saveDraft();scheduleAutoPunctuation(260);}
  };
  return true;
}

function startDictation(){if(!recognition&&!initRecognition())return;try{recognition.start();}catch(e){}}
function stopDictation(){setListening(false);if(recognition)recognition.stop();autoPunctuateNow('manual-stop');}
function restoreDraft(){if(!txt)return;txt.value=localStorage.getItem(DRAFT_KEY)||'';autoPunctuateNow('restore');}
function clearText(){if(!txt)return;if(confirm('לנקות את כל הטקסט?')){txt.value='';if(interimBox)interimBox.textContent='';localStorage.removeItem(DRAFT_KEY);setBox(statusBox,'');setBox(qualityBox,'');setBox(copyNote,'');}}

function scheduleAutoPunctuation(delay=700){clearTimeout(autoPunctuationTimer);autoPunctuationTimer=setTimeout(()=>autoPunctuateNow('auto'),delay);}
function autoPunctuateNow(reason='auto'){
  if(isPunctuating||!txt)return;
  const before=txt.value;if(!before||!before.trim())return;
  isPunctuating=true;
  const cursorAtEnd=txt.selectionStart===txt.value.length&&txt.selectionEnd===txt.value.length;
  const fixed=smartHebrewPunctuation(before);
  if(fixed&&fixed!==before){txt.value=fixed;if(cursorAtEnd)txt.selectionStart=txt.selectionEnd=txt.value.length;saveDraft();}
  setBox(qualityBox,'');
  isPunctuating=false;
}

function normalizeHebrewText(x){
  return (x||'')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/…/g,'...')
    .replace(/[־–—]/g,'-')
    .replace(/\u200f|\u200e/g,'')
    .replace(/[ \t]+/g,' ')
    .replace(/\s+\n/g,'\n')
    .replace(/\n\s+/g,'\n')
    .trim();
}

function replaceWholeWord(x,from,to){
  const re=new RegExp('(^|[^\\u0590-\\u05FF])'+escapeRegExp(from)+'(?=$|[^\\u0590-\\u05FF])','g');
  return x.replace(re,'$1'+to);
}

function replaceManyWords(x,pairs){
  for(const [from,to] of pairs)x=replaceWholeWord(x,from,to);
  return x;
}

function applyCommonHebrewCorrections(x){
  const wordPairs=[
    ['שעור','שיעור'],['שעורים','שיעורים'],['שיעוריםם','שיעורים'],
    ['מתמתיקה','מתמטיקה'],['מטמתיקה','מתמטיקה'],['מתמטיקהה','מתמטיקה'],
    ['מסימה','משימה'],['מסימות','משימות'],['משימותת','משימות'],
    ['תרגולל','תרגול'],['תרגולים','תרגילים'],['תרגילם','תרגילים'],
    ['הקטבה','הכתבה'],['החתבה','הכתבה'],['הכתווה','הכתבה'],
    ['מאקב','מעקב'],['מעתק','העתק'],['טיוטע','טיוטה'],
    ['ניראה','נראה'],['ניקר','ניכר'],['להמשיךך','להמשיך'],
    ['לעקב','לעקוב'],['לעקובב','לעקוב'],['היתקדם','התקדם'],['היתקדמה','התקדמה'],['היתקדמות','התקדמות'],
    ['הישתתף','השתתף'],['הישתתפה','השתתפה'],['הישתתפות','השתתפות'],
    ['מיתקשה','מתקשה'],['מיתקשים','מתקשים'],['מיתקשות','מתקשות'],
    ['הבנתת','הבנת'],['הוראותת','הוראות'],['רצינותת','רצינות'],
    ['סמרטקול','סמארטסקול'],['סמרטסקול','סמארטסקול'],['סמארט סקול','סמארטסקול'],['סמרט סקול','סמארטסקול']
  ];
  x=replaceManyWords(x,wordPairs);

  const phrasePairs=[
    [/יש ליצור קשר אם ההורים/g,'יש ליצור קשר עם ההורים'],
    [/עבד ברצינות/g,'עבד ברצינות'],
    [/עבדה ברצינות/g,'עבדה ברצינות'],
    [/לאורך ה שיעור/g,'לאורך השיעור'],
    [/במהלך ה שיעור/g,'במהלך השיעור'],
    [/במהלך ה עבודה/g,'במהלך העבודה'],
    [/צריך להמשיך לעקוב/g,'יש להמשיך לעקוב'],
    [/חשוב לשים לב ש/g,'חשוב לשים לב כי'],
    [/נראה ש/g,'נראה כי'],
    [/ניכר ש/g,'ניכר כי']
  ];
  for(const [re,to] of phrasePairs)x=x.replace(re,to);
  return x;
}

function applyGenderAgreementFixes(x){
  const pairs=[
    [/התלמידה\s+צריך/g,'התלמידה צריכה'],[/התלמיד\s+צריכה/g,'התלמיד צריך'],
    [/התלמידה\s+זקוק/g,'התלמידה זקוקה'],[/התלמיד\s+זקוקה/g,'התלמיד זקוק'],
    [/התלמידה\s+השתתף/g,'התלמידה השתתפה'],[/התלמיד\s+השתתפה/g,'התלמיד השתתף'],
    [/התלמידה\s+עבד/g,'התלמידה עבדה'],[/התלמיד\s+עבדה/g,'התלמיד עבד'],
    [/התלמידה\s+גילה/g,'התלמידה גילתה'],[/התלמיד\s+גילתה/g,'התלמיד גילה'],
    [/התלמידה\s+הראה/g,'התלמידה הראתה'],[/התלמיד\s+הראתה/g,'התלמיד הראה'],
    [/התלמידה\s+לא\s+הגיע/g,'התלמידה לא הגיעה'],[/התלמיד\s+לא\s+הגיעה/g,'התלמיד לא הגיע'],
    [/התלמידה\s+נדרש/g,'התלמידה נדרשת'],[/התלמיד\s+נדרשת/g,'התלמיד נדרש'],
    [/היא\s+צריך/g,'היא צריכה'],[/הוא\s+צריכה/g,'הוא צריך'],
    [/היא\s+זקוק/g,'היא זקוקה'],[/הוא\s+זקוקה/g,'הוא זקוק']
  ];
  for(const [re,to] of pairs)x=x.replace(re,to);
  return x;
}

function replaceSpokenPunctuation(x){
  const reps=[
    [/[ ]?סימן שאלה[ ]?/g,'? '],[/[ ]?שאלה[ ]?סימן[ ]?/g,'? '],
    [/[ ]?סימן קריאה[ ]?/g,'! '],[/[ ]?נקודה[ ]?/g,'. '],[/[ ]?סוף משפט[ ]?/g,'. '],
    [/[ ]?פסיק[ ]?/g,', '],[/[ ]?נקודתיים[ ]?/g,': '],
    [/[ ]?פתח סוגריים[ ]?/g,' ('],[/[ ]?סוגריים נפתחות[ ]?/g,' ('],[/[ ]?סגור סוגריים[ ]?/g,') '],[/[ ]?סוגריים נסגרות[ ]?/g,') '],
    [/[ ]?מירכאות[ ]?/g,'"'],[/[ ]?מרכאות[ ]?/g,'"'],
    [/[ ]?שורה חדשה[ ]?/g,'\n'],[/[ ]?סעיף חדש[ ]?/g,'\n']
  ];
  reps.forEach(([re,val])=>{x=x.replace(re,val);});
  return x;
}

function addCommasAroundConnectors(x){
  const connectors=['אבל','אולם','עם זאת','בנוסף','כמו כן','לעומת זאת','מצד שני','בכל זאת','למרות זאת','במקביל'];
  connectors.forEach(w=>{x=x.replace(new RegExp('([^.!?\\n,])\\s+'+escapeRegExp(w)+'\\s+','g'),'$1, '+w+' ');});
  x=x.replace(/,\s+(לכן|ולכן)\s+/g,'. $1 ');
  x=x.replace(/([^.!?\n])\s+(לכן|ולכן)\s+/g,'$1. $2 ');
  return x;
}

function breakBeforeTeacherActionClauses(x){
  const phrases=[
    'יש להמשיך','יש לעקוב','יש ליצור קשר','יש לשים לב','יש לחזק','יש לבדוק',
    'מומלץ','נדרש','נדרשת','כדאי','חשוב','לסיכום','נראה כי','ניכר כי','בהמשך','בהמשך לכך'
  ];
  phrases.forEach(p=>{x=x.replace(new RegExp('([^.!?\\n])\\s+'+escapeRegExp(p)+'\\s+','g'),'$1. '+p+' ');});
  return x;
}

function breakBeforeNewSubject(x){
  return x.replace(/([^.!?\n]{28,})\s+(התלמידה?|הוא|היא)\s+/g,'$1. $2 ');
}

function addCommasAfterOpeners(x){
  const openers=['במהלך השיעור','לאורך השיעור','בשיעור היום','בזמן העבודה','במהלך העבודה','בתחילת השיעור','בסוף השיעור','לאחר מכן','יחד עם זאת'];
  openers.forEach(p=>{x=x.replace(new RegExp(escapeRegExp(p)+'\\s+(?=[^,\\n])','g'),p+', ');});
  return x;
}

function splitVeryLongSentences(x){
  const sentences=x.split(/(?<=[.!?])\s+/);
  const out=[];
  for(const sentence of sentences){
    const words=sentence.trim().split(/\s+/).filter(Boolean);
    if(words.length<=22){out.push(sentence.trim());continue;}
    let rebuilt=[],count=0;
    for(let i=0;i<words.length;i++){
      const w=words[i];rebuilt.push(w);count++;
      const plain=w.replace(/[,.!?:;]/g,'');
      if(count>=14&&['אבל','בנוסף','לכן','ולכן','כדאי','מומלץ','נדרש','נדרשת','חשוב','בהמשך'].includes(plain)){
        if(!/[.!?]$/.test(rebuilt[rebuilt.length-1]))rebuilt[rebuilt.length-1]=rebuilt[rebuilt.length-1].replace(/[,]?$/,'.');
        count=0;
      }
    }
    out.push(rebuilt.join(' '));
  }
  return out.join(' ');
}

function cleanupPunctuationSpacing(x){
  return x
    .replace(/\s+([,.!?;:])/g,'$1')
    .replace(/([,.!?;:])([^\s\n])/g,'$1 $2')
    .replace(/([,.!?])\s*\1+/g,'$1')
    .replace(/,\s*\./g,'.')
    .replace(/\.\s*,/g,'.')
    .replace(/:\s*[.:]/g,': ')
    .replace(/\(\s+/g,'(')
    .replace(/\s+\)/g,')')
    .replace(/^\s*[,.]\s*/,'')
    .replace(/[ ]{2,}/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function smartHebrewPunctuation(raw){
  let x=normalizeHebrewText(raw);if(!x)return '';
  x=' '+x+' ';
  x=replaceSpokenPunctuation(x);
  x=applyCommonHebrewCorrections(x);
  x=applyGenderAgreementFixes(x);
  x=addCommasAfterOpeners(x);
  x=addCommasAroundConnectors(x);
  x=breakBeforeTeacherActionClauses(x);
  x=breakBeforeNewSubject(x);
  x=cleanupPunctuationSpacing(x);
  x=splitVeryLongSentences(x);
  x=cleanupPunctuationSpacing(x);
  x=applyCommonHebrewCorrections(x);
  x=applyGenderAgreementFixes(x);
  if(x&&!/[.!?]$/.test(x)&&!x.endsWith(')'))x+='.';
  return x;
}

async function copyText(){autoPunctuateNow('copy');try{await navigator.clipboard.writeText(txt.value);showCopyNote('הטקסט הועתק');}catch(e){txt.select();document.execCommand('copy');showCopyNote('הטקסט סומן להעתקה');}}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
window.startDictation=startDictation;window.stopDictation=stopDictation;window.copyText=copyText;window.restoreDraft=restoreDraft;window.clearText=clearText;window.installApp=installApp;window.checkForUpdates=checkForUpdates;
