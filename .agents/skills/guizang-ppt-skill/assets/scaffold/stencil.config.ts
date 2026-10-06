import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'deck',
  globalStyle: 'src/global/app.css',
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
    },
    {
      type: 'www',
      serviceWorker: null,
      copy: [
        { src: 'assets', dest: 'assets', keepDirStructure: true }
      ]
    },
  ],
  devServer: {
    reloadStrategy: 'pageReload',
    port: 3333,
  },
};
