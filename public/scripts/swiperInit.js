// swiperInit.js
import Swiper from 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.mjs';

export function initSwiper() {
  new Swiper('.swiper', {
    loop: true,
    autoplay: {
      delay: 3000, // 3 segundos
      disableOnInteraction: false, // continua mesmo após interação
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });
}
