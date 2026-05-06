const txt=document.getElementById('txt');
const statusBox=document.getElementById('status');
const interimBox=document.getElementById('interim');
const qualityBox=document.getElementById('qualityBox');
const installPanel=document.getElementById('installPanel');

const DRAFT_KEY='yaniv_tracking_voice_text_v2';
let recognition=null;
let autoPunctuationTimer=null;
let isPunctuating=false;
let deferredInstallPrompt=null;
let swRegistration=null;

function setBox(el,msg){
  if(!el)return;
  const text=(msg||'').trim();
  if(text){
    el.hidden=false;
    el.textContent=text;
  }else{
    el.textContent='';
    el.hidden=true;
  }
}

if(txt){
  txt.value=localStorage.getItem(DRAFT_KEY)||'';
  txt.addEventListener('input',()=>{saveDraft();scheduleAutoPunctuation(1100);});
  txt.addEventListener('blur',()=>autoPunctuateNow('blur'));
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  showInstallUi();
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  markInstalled();
  setBox(statusBox,'האפליקציה הותקנה במכשיר.');
});

window.addEventListener('load',()=>{
  setupServiceWorker();
  detectInstalledMode();
  scheduleAutoPunctuation(300);
});

function saveDraft(){
  if(txt)localStorage.setItem(DRAFT_KEY,txt.value||'');
}

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
}

function showInstallUi(){
  if(installPanel)installPanel.hidden=false;
  document.body.classList.remove('installed');
}

function markInstalled(){
  document.body.classList.add('installed');
  if(installPanel)installPanel.hidden=true;
}

function detectInstalledMode(){
  if(isStandalone()){
    markInstalled();
  }else{
    setTimeout(()=>{ if(!deferredInstallPrompt) showInstallUi(); },900);
  }
}

async function installApp(){
  if(isStandalone()){
    markInstalled();
    return;
  }
  if(deferredInstallPrompt){
    const promptEvent=deferredInstallPrompt;
    deferredInstallPrompt=null;
    promptEvent.prompt();
    const choice=await promptEvent.userChoice.catch(()=>null);
    if(choice && choice.outcome==='accepted'){
      markInstalled();
      return;
    }
    setBox(statusBox,'אפשר להתקין מאוחר יותר דרך תפריט הדפדפן.');
    return;
  }
  setBox(statusBox,'אם לא נפתח חלון התקנה, פתח את תפריט הדפדפן ובחר “הוסף למסך הבית” או “Install app”.');
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
    if(manual)setBox(statusBox,'בדיקת עדכונים אינה זמינה בדפדפן הזה.');
    return;
  }
  try{
    await swRegistration.update();
    if(swRegistration.waiting){
      saveDraft();
      swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
      if(manual)setBox(statusBox,'נמצא עדכון. האפליקציה מתרעננת.');
      return;
    }
    if(manual)setBox(statusBox,'האפליקציה מעודכנת.');
  }catch(e){
    if(manual)setBox(statusBox,'לא הצלחתי לבדוק עדכונים כרגע.');
  }
}

function initRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    setBox(statusBox,'הדפדפן הזה לא תומך בהכתבה קולית. מומלץ Chrome או Edge.');
    return false;
  }
  recognition=new SR();
  recognition.lang='he-IL';
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;

  recognition.onstart=()=>{
    setBox(statusBox,'מאזין...');
  };

  recognition.onend=()=>{
    autoPunctuateNow('speech-end');
    setBox(statusBox,'ההכתבה נעצרה.');
  };

  recognition.onerror=e=>{
    let msg='שגיאת הכתבה.';
    if(e.error==='not-allowed')msg='המיקרופון חסום. אשר הרשאת מיקרופון.';
    else if(e.error==='no-speech')msg='לא נקלט דיבור.';
    else if(e.error==='network')msg='בעיית רשת בזיהוי הדיבור.';
    setBox(statusBox,msg);
  };

  recognition.onresult=event=>{
    let interim='';
    let changed=false;
    for(let i=event.resultIndex;i<event.results.length;i++){
      const spoken=event.results[i][0].transcript.trim();
      if(event.results[i].isFinal){
        if(txt.value && !txt.value.endsWith(' ') && !txt.value.endsWith('\n')) txt.value+=' ';
        txt.value+=spoken;
        changed=true;
      }else{
        interim+=spoken+' ';
      }
    }
    if(interimBox)interimBox.textContent=interim;
    if(changed){
      saveDraft();
      scheduleAutoPunctuation(450);
    }
  };
  return true;
}

function startDictation(){
  if(!recognition && !initRecognition()) return;
  try{
    recognition.start();
  }catch(e){
    setBox(statusBox,'ההכתבה כבר פעילה.');
  }
}

function stopDictation(){
  if(recognition) recognition.stop();
  autoPunctuateNow('manual-stop');
}

function addText(s){
  if(!txt)return;
  txt.value+=s;
  txt.focus();
  saveDraft();
  scheduleAutoPunctuation(250);
}

function restoreDraft(){
  if(!txt)return;
  txt.value=localStorage.getItem(DRAFT_KEY)||'';
  autoPunctuateNow('restore');
  if(txt.value.trim()) setBox(statusBox,'הטיוטה שוחזרה.');
}

function clearText(){
  if(!txt)return;
  if(confirm('לנקות את כל הטקסט?')){
    txt.value='';
    if(interimBox)interimBox.textContent='';
    localStorage.removeItem(DRAFT_KEY);
    setBox(statusBox,'');
    setBox(qualityBox,'');
  }
}

function scheduleAutoPunctuation(delay=700){
  clearTimeout(autoPunctuationTimer);
  autoPunctuationTimer=setTimeout(()=>autoPunctuateNow('auto'),delay);
}

function autoPunctuateNow(reason='auto'){
  if(isPunctuating || !txt) return;
  const before=txt.value;
  if(!before || !before.trim()) return;

  isPunctuating=true;
  const cursorAtEnd=txt.selectionStart===txt.value.length && txt.selectionEnd===txt.value.length;

  const fixed=smartHebrewPunctuation(before);
  if(fixed && fixed!==before){
    txt.value=fixed;
    if(cursorAtEnd) txt.selectionStart=txt.selectionEnd=txt.value.length;
    saveDraft();
  }

  const note=qualityCheck(txt.value);
  setBox(qualityBox,note);
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

function replaceSpokenPunctuation(x){
  const reps=[
    [/[ ]?סימן שאלה[ ]?/g,'? '],
    [/[ ]?סימן קריאה[ ]?/g,'! '],
    [/[ ]?נקודה[ ]?/g,'. '],
    [/[ ]?פסיק[ ]?/g,', '],
    [/[ ]?נקודתיים[ ]?/g,': '],
    [/[ ]?סוגריים נפתחות[ ]?/g,' ('],
    [/[ ]?סוגריים נסגרות[ ]?/g,') '],
    [/[ ]?מירכאות[ ]?/g,'"'],
    [/[ ]?שורה חדשה[ ]?/g,'\n'],
    [/[ ]?סעיף חדש[ ]?/g,'\n']
  ];
  reps.forEach(([re,val])=>{ x=x.replace(re,val); });
  return x;
}

function addCommasAroundConnectors(x){
  const connectors=['אבל','אולם','עם זאת','בנוסף','כמו כן','לעומת זאת','מצד שני','בכל זאת','למרות זאת'];
  connectors.forEach(w=>{
    x=x.replace(new RegExp('([^.!?\\n,])\\s+'+escapeRegExp(w)+'\\s+','g'),'$1, '+w+' ');
  });
  return x;
}

function breakBeforeRecommendationClauses(x){
  const phrases=[
    'יש להמשיך','יש לעקוב','יש ליצור קשר','יש לשים לב','יש לחזק',
    'מומלץ','נדרש','נדרשת','כדאי','חשוב','לסיכום',
    'נראה כי','ניכר כי','בהמשך'
  ];
  phrases.forEach(p=>{
    x=x.replace(new RegExp('([^.!?\\n])\\s+'+escapeRegExp(p)+'\\s+','g'),'$1. '+p+' ');
  });
  return x;
}

function breakRepeatedStudentClauses(x){
  x=x.replace(/([^.!?\n])\s+(התלמידה?|הוא|היא)\s+/g,'$1. $2 ');
  return x;
}

function addCommasAfterOpeners(x){
  const openers=['במהלך השיעור','לאורך השיעור','בשיעור היום','בזמן העבודה','במהלך העבודה','בתחילת השיעור','בסוף השיעור'];
  openers.forEach(p=>{
    x=x.replace(new RegExp(escapeRegExp(p)+'\\s+(?=[^,\\n])','g'),p+', ');
  });
  return x;
}

function splitVeryLongSentences(x){
  const sentences=x.split(/(?<=[.!?])\s+/);
  const out=[];
  for(const sentence of sentences){
    const words=sentence.trim().split(/\s+/).filter(Boolean);
    if(words.length<=24){
      out.push(sentence.trim());
      continue;
    }
    let rebuilt=[];
    let count=0;
    for(let i=0;i<words.length;i++){
      const w=words[i];
      rebuilt.push(w);
      count++;
      const plain=w.replace(/[,.!?:;]/g,'');
      if(count>=16 && ['אבל','בנוסף','לכן','כדאי','מומלץ','נדרש','חשוב','ובהמשך'].includes(plain)){
        if(!/[.!?]$/.test(rebuilt[rebuilt.length-1])) rebuilt[rebuilt.length-1]=rebuilt[rebuilt.length-1].replace(/[,]?$/,'.');
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
    .replace(/^\s*[,.]\s*/,'')
    .replace(/[ ]{2,}/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function smartHebrewPunctuation(raw){
  let x=normalizeHebrewText(raw);
  if(!x) return '';
  x=' '+x+' ';
  x=replaceSpokenPunctuation(x);
  x=addCommasAfterOpeners(x);
  x=addCommasAroundConnectors(x);
  x=breakBeforeRecommendationClauses(x);
  x=breakRepeatedStudentClauses(x);
  x=cleanupPunctuationSpacing(x);
  x=splitVeryLongSentences(x);
  x=cleanupPunctuationSpacing(x);
  if(x && !/[.!?]$/.test(x) && !x.endsWith(')')) x+='.';
  return x;
}

function qualityCheck(x){
  const warnings=[];
  const hasLatin=(x.match(/[A-Za-z]/g)||[]).length>0;
  const longSentences=x
    .split(/[.!?]/)
    .map(s=>s.trim())
    .filter(Boolean)
    .filter(s=>(s.match(/\S+/g)||[]).length>28);

  if(hasLatin) warnings.push('יש טקסט באנגלית — כדאי לבדוק.');
  if(longSentences.length>0) warnings.push('יש משפט ארוך מאוד — מומלץ לעבור בעין.');
  return warnings.join(' ');
}

async function copyText(){
  autoPunctuateNow('copy');
  try{
    await navigator.clipboard.writeText(txt.value);
    setBox(statusBox,'הועתק.');
  }catch(e){
    txt.select();
    document.execCommand('copy');
    setBox(statusBox,'הטקסט סומן להעתקה.');
  }
}

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

window.startDictation=startDictation;
window.stopDictation=stopDictation;
window.copyText=copyText;
window.addText=addText;
window.restoreDraft=restoreDraft;
window.clearText=clearText;
window.installApp=installApp;
window.checkForUpdates=checkForUpdates;
