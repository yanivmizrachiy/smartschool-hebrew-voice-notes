const TOPICS = new Set(['circle', 'cylinder', 'cone']);
const params = new URLSearchParams(location.search);
const requestedTopic = params.get('topic');
const hasTopic = TOPICS.has(requestedTopic);

if (hasTopic) {
  document.body.classList.add('has-topic');
  document.querySelector('#workbook')?.removeAttribute('hidden');
  document.querySelector('#page-jump')?.removeAttribute('hidden');
  document.querySelector('#library')?.setAttribute('hidden', '');
  await import('./app.js');
} else {
  const homeStyles = document.createElement('link');
  homeStyles.rel = 'stylesheet';
  homeStyles.href = 'viewer/home.css';
  document.head.append(homeStyles);

  document.body.classList.add('is-home');
  document.querySelector('#workbook')?.setAttribute('hidden', '');
  document.querySelector('#page-jump')?.setAttribute('hidden', '');
  document.querySelector('#library')?.removeAttribute('hidden');
  document.title = 'דפי עבודה במתמטיקה — מעגל · גליל · חרוט';
}
