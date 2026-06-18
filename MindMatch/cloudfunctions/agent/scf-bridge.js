// scf-bridge.js — CJS 入口包装层
// SCF 云函数不支持 ESM 入口文件，用 CJS + 动态 import() 桥接
'use strict';
module.exports.main_handler = async function(event, context) {
  const handler = await import('./scf-handler.mjs');
  return handler.main_handler(event, context);
};
