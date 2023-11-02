import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  globals: {
    'ts-jest': {
      diagnostics: {
        exclude: ['!**/*.(spec|test).ts?(x)'],
      },
    },
  },
  verbose: true,
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
export default config;