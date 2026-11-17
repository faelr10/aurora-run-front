import type { ConfigEnv, PluginOption, UserConfig } from 'vite';

import base from './vite.config';

export default (env: ConfigEnv): UserConfig => {
  const config = (base as (env: ConfigEnv) => UserConfig)(env);
  const plugins = (config.plugins ?? []).flat(Infinity as 1) as PluginOption[];
  return {
    ...config,
    plugins: plugins.filter((plugin) => !(plugin && typeof plugin === 'object' && 'name' in plugin && String(plugin.name).includes('basic-ssl'))),
    server: { port: 5180, host: 'localhost', strictPort: true },
  };
};
