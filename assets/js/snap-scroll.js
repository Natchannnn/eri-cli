(() => {
  'use strict';

  /**
   * Unified Snap Scroller for fullscreen multi-page layouts (Home & About)
   * Handles wheel delta normalization, animating lock, reduced-motion bypass, and keyboard navigation.
   */
  window.initSnapScroller = function initSnapScroller(selector) {
    const pages = [...document.querySelectorAll(selector)];
    if (pages.length <= 1) return null;

    let currentPageIndex = 0;
    let isAnimating = false;

    const updateIndexFromScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight * 0.4;
      for (let i = pages.length - 1; i >= 0; i--) {
        if (scrollPos >= pages[i].offsetTop) {
          currentPageIndex = i;
          break;
        }
      }
    };

    window.addEventListener('scroll', () => {
      if (!isAnimating) updateIndexFromScroll();
    }, { passive: true });

    const goToPage = (index) => {
      if (index < 0 || index >= pages.length || isAnimating) return;
      isAnimating = true;
      currentPageIndex = index;
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      pages[index].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => {
        isAnimating = false;
        updateIndexFromScroll();
      }, 550);
    };

    window.addEventListener('wheel', (e) => {
      if (window.innerWidth <= 820) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (Math.abs(delta) < 4) return;
      if (isAnimating) {
        e.preventDefault();
        return;
      }
      if (delta > 0 && currentPageIndex < pages.length - 1) {
        e.preventDefault();
        goToPage(currentPageIndex + 1);
      } else if (delta < 0 && currentPageIndex > 0) {
        e.preventDefault();
        goToPage(currentPageIndex - 1);
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (window.innerWidth <= 820) return;
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (['input', 'textarea', 'button', 'select'].includes(tag)) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey && currentPageIndex < pages.length - 1) {
        e.preventDefault();
        goToPage(currentPageIndex + 1);
      } else if (['ArrowUp', 'PageUp'].includes(e.key) && currentPageIndex > 0) {
        e.preventDefault();
        goToPage(currentPageIndex - 1);
      }
    });

    updateIndexFromScroll();
    return { goToPage, getIndex: () => currentPageIndex };
  };
})();
