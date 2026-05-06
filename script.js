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

function setListening(active){
  document.body.classList.toggle('listening',!!active);
}

function showCopyNote(msg='הטקסט הועתק'){
  if(!copyNote)return;
  copyNote.hidden=false;
  copyNote.textContent=msg;
  clearTimeout(copyNoteTimer);
  copyNoteTimer=setTimeout(()=>setBox(copyNote,''),2800);
}

if(txt){
  txt.value=localStorage.getItem(DRAFT_KEY)||'';
  txt.addEventListener('input',()=>{saveDraft();scheduleAutoPunctuation(1100);});
  txt.addEventListener('blur',()=>autoPunctuateNow('blur'));
}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;showInstallUi();});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;markInstalled();});
window.addEventListener('load',()=>{setupServiceWorker();detectInstalledMode();scheduleAutoPunctuation(300);});

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
      if(event.results[i].isFinal){if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+=' ';txt.value+=spoken;changed=true;}else interim+=spoken+' ';
    }
    if(interimBox)interimBox.textContent=interim;
    if(changed){saveDraft();scheduleAutoPunctuation(450);}
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

function normalizeHebrewText(x){return (x||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,'...').replace(/[־–—]/g,'-').replace(/\u200f|\u200e/g,'').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').trim();}
function replaceSpokenPunctuation(x){const reps=[[/[ ]?סימן שאלה[ ]?/g,'? '],[/[ ]?סימן קריאה[ ]?/g,'! '],[/[ ]?נקודה[ ]?/g,'. '],[/[ ]?פסיק[ ]?/g,', '],[/[ ]?נקודתיים[ ]?/g,': '],[/[ ]?סוגריים נפתחות[ ]?/g,' ('],[/[ ]?סוגריים נסגרות[ ]?/g,') '],[/[ ]?מירכאות[ ]?/g,'"'],[/[ ]?שורה חדשה[ ]?/g,'\n'],[/[ ]?סעיף חדש[ ]?/g,'\n']];reps.forEach(([re,val])=>{x=x.replace(re,val);});return x;}
function addCommasAroundConnectors(x){['אבל','אולם','עם זאת','בנוסף','כמו כן','לעומת זאת','מצד שני','בכל זאת','למרות זאת'].forEach(w=>{x=x.replace(new RegExp('([^.!?\\n,])\\s+'+escapeRegExp(w)+'\\s+','g'),'$1, '+w+' ');});return x;}
function breakBeforeRecommendationClauses(x){['יש להמשיך','יש לעקוב','יש ליצור קשר','יש לשים לב','יש לחזק','מומלץ','נדרש','נדרשת','כדאי','חשוב','לסיכום','נראה כי','ניכר כי','בהמשך'].forEach(p=>{x=x.replace(new RegExp('([^.!?\\n])\\s+'+escapeRegExp(p)+'\\s+','g'),'$1. '+p+' ');});return x;}
function breakRepeatedStudentClauses(x){return x.replace(/([^.!?\n])\s+(התלמידה?|הוא|היא)\s+/g,'$1. $2 ');}
function addCommasAfterOpeners(x){['במהלך השיעור','לאורך השיעור','בשיעור היום','בזמן העבודה','במהלך העבודה','בתחילת השיעור','בסוף השיעור'].forEach(p=>{x=x.replace(new RegExp(escapeRegExp(p)+'\\s+(?=[^,\\n])','g'),p+', ');});return x;}
function splitVeryLongSentences(x){const sentences=x.split(/(?<=[.!?])\s+/);const out=[];for(const sentence of sentences){const words=sentence.trim().split(/\s+/).filter(Boolean);if(words.length<=24){out.push(sentence.trim());continue;}let rebuilt=[],count=0;for(let i=0;i<words.length;i++){const w=words[i];rebuilt.push(w);count++;const plain=w.replace(/[,.!?:;]/g,'');if(count>=16&&['אבל','בנוסף','לכן','כדאי','מומלץ','נדרש','חשוב','ובהמשך'].includes(plain)){if(!/[.!?]$/.test(rebuilt[rebuilt.length-1]))rebuilt[rebuilt.length-1]=rebuilt[rebuilt.length-1].replace(/[,]?$/,'.');count=0;}}out.push(rebuilt.join(' '));}return out.join(' ');}
function cleanupPunctuationSpacing(x){return x.replace(/\s+([,.!?;:])/g,'$1').replace(/([,.!?;:])([^\s\n])/g,'$1 $2').replace(/([,.!?])\s*\1+/g,'$1').replace(/,\s*\./g,'.').replace(/\.\s*,/g,'.').replace(/:\s*[.:]/g,': ').replace(/^\s*[,.]\s*/,'').replace(/[ ]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
function smartHebrewPunctuation(raw){let x=normalizeHebrewText(raw);if(!x)return '';x=' '+x+' ';x=replaceSpokenPunctuation(x);x=addCommasAfterOpeners(x);x=addCommasAroundConnectors(x);x=breakBeforeRecommendationClauses(x);x=breakRepeatedStudentClauses(x);x=cleanupPunctuationSpacing(x);x=splitVeryLongSentences(x);x=cleanupPunctuationSpacing(x);if(x&&!/[.!?]$/.test(x)&&!x.endsWith(')'))x+='.';return x;}
async function copyText(){autoPunctuateNow('copy');try{await navigator.clipboard.writeText(txt.value);showCopyNote('הטקסט הועתק');}catch(e){txt.select();document.execCommand('copy');showCopyNote('הטקסט סומן להעתקה');}}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
window.startDictation=startDictation;window.stopDictation=stopDictation;window.copyText=copyText;window.restoreDraft=restoreDraft;window.clearText=clearText;window.installApp=installApp;window.checkForUpdates=checkForUpdates;
