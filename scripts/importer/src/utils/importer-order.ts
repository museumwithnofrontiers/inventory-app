export interface DependentConfig {
  key: string;
  dependencies?: string[];
  /**
   * Runs after every other selected step, in its own declared order among
   * the steps that also run last. For a post-pass over what many steps write
   * (M16 I5: the collection credits), where listing each writer as a
   * dependency would miss the next one added. No other step may depend on it.
   */
  runsLast?: boolean;
}

/**
 * Order importer configs so declared dependencies run before their dependents.
 * Dependencies outside the selected config set are ignored to preserve CLI
 * selection semantics for --only, --start-at, and --stop-at.
 */
export function orderConfigsByDependencies<T extends DependentConfig>(configs: T[]): T[] {
  const configMap = new Map(configs.map((config) => [config.key, config]));
  const selectedKeys = new Set(configs.map((config) => config.key));
  const inDegree = new Map(configs.map((config) => [config.key, 0]));
  const dependents = new Map<string, string[]>();

  for (const config of configs) {
    for (const dependency of config.dependencies ?? []) {
      if (!selectedKeys.has(dependency)) {
        continue;
      }

      inDegree.set(config.key, (inDegree.get(config.key) ?? 0) + 1);
      const dependencyDependents = dependents.get(dependency) ?? [];
      dependencyDependents.push(config.key);
      dependents.set(dependency, dependencyDependents);
    }
  }

  const readyQueue = configs
    .filter((config) => (inDegree.get(config.key) ?? 0) === 0)
    .map((config) => config.key);
  const orderedKeys: string[] = [];

  while (readyQueue.length > 0) {
    const key = readyQueue.shift();
    if (!key) {
      break;
    }

    orderedKeys.push(key);

    for (const dependentKey of dependents.get(key) ?? []) {
      const nextInDegree = (inDegree.get(dependentKey) ?? 0) - 1;
      inDegree.set(dependentKey, nextInDegree);
      if (nextInDegree === 0) {
        readyQueue.push(dependentKey);
      }
    }
  }

  if (orderedKeys.length !== configs.length) {
    const unresolved = configs
      .filter((config) => !orderedKeys.includes(config.key))
      .map((config) => config.key)
      .join(', ');
    throw new Error(`Circular importer dependencies detected: ${unresolved}`);
  }

  const lastKeys = new Set(configs.filter((config) => config.runsLast).map((config) => config.key));
  for (const config of configs) {
    if (config.runsLast) continue;
    const blocked = (config.dependencies ?? []).filter((dependency) => lastKeys.has(dependency));
    if (blocked.length > 0) {
      throw new Error(`Importer ${config.key} depends on ${blocked.join(', ')}, which runs last`);
    }
  }
  const finalKeys = [
    ...orderedKeys.filter((key) => !lastKeys.has(key)),
    ...orderedKeys.filter((key) => lastKeys.has(key)),
  ];

  return finalKeys.map((key) => {
    const config = configMap.get(key);
    if (!config) {
      throw new Error(`Importer config not found for key: ${key}`);
    }
    return config;
  });
}
