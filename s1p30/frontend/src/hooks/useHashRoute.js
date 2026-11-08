import { useCallback, useEffect, useState } from 'react';

export function useHashRoute(defaultRoute, validRoutes) {
  const read = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return validRoutes.includes(hash) ? hash : defaultRoute;
  };
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // validRoutes and defaultRoute are module constants
  }, []);

  const go = useCallback(next => {
    window.location.hash = '/' + next;
  }, []);

  return [route, go];
}
