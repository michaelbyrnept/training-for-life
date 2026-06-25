import { useEffect } from 'react';

const DEFAULT_TITLE = 'Personal Trainer in Dublin | Training for Life — Michael Byrne';
const DEFAULT_DESC = '1:1 personal training and online coaching in South Dublin with Michael Byrne. Strength training, weight loss and capability coaching for adults. Book a free consultation today.';

/**
 * SEO — updates document.title, meta description, canonical and OG tags per page.
 * Works with Google's JavaScript rendering without any extra dependencies.
 */
export default function SEO({ title, description, canonical }) {
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE;
    const resolvedDesc = description || DEFAULT_DESC;

    document.title = resolvedTitle;

    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', resolvedDesc);
    setMeta('meta[property="og:title"]', 'content', resolvedTitle);
    setMeta('meta[property="og:description"]', 'content', resolvedDesc);
    setMeta('meta[name="twitter:title"]', 'content', resolvedTitle);
    setMeta('meta[name="twitter:description"]', 'content', resolvedDesc);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
      setMeta('meta[property="og:url"]', 'content', canonical);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', 'content', DEFAULT_DESC);
      setMeta('meta[property="og:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', 'content', DEFAULT_DESC);
      setMeta('meta[name="twitter:title"]', 'content', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', 'content', DEFAULT_DESC);
    };
  }, [title, description, canonical]);

  return null;
}
