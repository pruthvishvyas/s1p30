import { useData } from './useData.js';
import { useContract } from './useContract.js';
import { DATASETS, resolveDatasetPath } from '../utils/datasets.js';

export function useDataset(name) {
  const def = DATASETS[name];
  const contract = useContract();
  const path = def ? resolveDatasetPath(contract.data, def) : null;
  return useData(path, def ? def.adapt : undefined, !contract.loading);
}

export function useDataFile(path, adapt, enabled = true) {
  return useData(path, adapt, enabled);
}
