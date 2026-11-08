import { createContext, useCallback, useContext } from 'react';

const DEFAULTS = { revenue: 'Revenue', customer: 'Customer', product: 'Product', transaction: 'Transaction' };
const TerminologyContext = createContext(DEFAULTS);

export function TerminologyProvider({ terminology, children }) {
  return <TerminologyContext.Provider value={terminology || DEFAULTS}>{children}</TerminologyContext.Provider>;
}

const pluralize = word => (/s$/i.test(word) ? word : /[^aeiou]y$/i.test(word) ? word.slice(0, -1) + 'ies' : word + 's');

export function useTerm() {
  const map = useContext(TerminologyContext);
  return useCallback((key, options = {}) => {
    let word = map[key] || DEFAULTS[key] || key;
    if (options.plural) word = pluralize(word);
    return options.lower ? word.toLowerCase() : word;
  }, [map]);
}
