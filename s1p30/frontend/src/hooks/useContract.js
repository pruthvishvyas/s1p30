import { useData } from './useData.js';
import { adaptContract } from '../utils/adapters.js';

export function useContract() {
  return useData('/data/frontend_contract.json', adaptContract);
}
