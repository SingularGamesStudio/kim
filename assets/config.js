// Здесь нет и не должно быть client_secret. OAuth Client ID — публичный идентификатор SPA.
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: '577883504204-rtbbudqqdga003qh59i52t4fr4gkk6qs.apps.googleusercontent.com',
  PRIVATE_SPREADSHEET_ID: '1CricNZuDzfAEx4CQNh3BFMgkdZ8X3ZnKinqfccM3m00',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby7qg98rbzOSn_bzEe_ZLV3KyrG-gBnvtlJAnPlI21sRTTa_JztDYWJ825mDnmW2eNA0w/exec',
  BASE_URL: 'https://singulargamesstudio.github.io/kim/',
  // Обязательно замените координаты на реальные точки клуба перед публикацией.
  LOCATIONS: {
    '8ка': { name: '8ка', lat: 55.928188, lng: 37.523233 },
    'КПМ': { name: 'КПМ', lat: 55.929108, lng: 37.521375 },
    'Обезьянник': { name: 'Обезьянник', lat: 55.930280, lng: 37.523853 },
    MIPT: { lat: 55.9297, lng: 37.5215 }
  },
  SAFETY_URL: 'https://m.vk.ru/@kimmipt-kratkaya-instrukciya-po-tehnike-bezopasnosti-dlya-zanyatii-p'
};