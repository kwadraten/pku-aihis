import { Config } from '@stencil/core';
export const config: Config = {
 namespace: 'week03', globalStyle: 'src/global/app.css',
 outputTargets: [{type:'www',serviceWorker:null,baseUrl:'/pku-aihis/week03/',copy:[
  {src:'assets',dest:'assets',keepDirStructure:false},
  {src:'coi-serviceworker.js',dest:'coi-serviceworker.js'},
  {src:'bootstrap.js',dest:'bootstrap.js'}]}],
 devServer:{reloadStrategy:'pageReload',port:3333},
};
