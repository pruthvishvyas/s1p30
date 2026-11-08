import { useEffect, useState } from 'react';

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = name => cs.getPropertyValue(name).trim();
  return {
    accent: get('--color-accent'),
    grid: get('--color-border'),
    text: get('--color-text-secondary'),
    textPrimary: get('--color-text-primary'),
    surface: get('--color-surface'),
    series: [1, 2, 3, 4, 5, 6].map(i => get('--chart-' + i)),
  };
}

export function useChartColors() {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}
