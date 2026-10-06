#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillRoot = resolve(__dirname, '..');
const scaffoldSrc = resolve(skillRoot, 'assets', 'scaffold');

const targetArg = process.argv[2];

if (!targetArg) {
  console.error('\n❌ 错误: 请指定新课件工程的目标目录！');
  console.log('用法: node create-deck-project.mjs <目标路径>');
  console.log('示例: node create-deck-project.mjs ../../courseware-week2\n');
  process.exit(1);
}

const targetDir = resolve(process.cwd(), targetArg);

console.log(`\n🚀 正在基于 Stencil & Web Components 脚手架初始化高密度培训课件工程...`);
console.log(`📁 目标路径: ${targetDir}`);

if (!existsSync(scaffoldSrc)) {
  console.error(`❌ 脚手架模板目录不存在: ${scaffoldSrc}`);
  process.exit(1);
}

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Copy scaffold excluding node_modules, dist, www
cpSync(scaffoldSrc, targetDir, {
  recursive: true,
  filter: (source) => {
    const rel = source.replace(scaffoldSrc, '');
    if (rel.includes('node_modules') || rel.includes('dist') || rel.includes('www') || rel.includes('.stencil')) {
      return false;
    }
    return true;
  },
});

console.log(`✅ 脚手架模板复制完毕！`);
console.log(`📦 正在使用 pnpm 安装工程依赖...`);

try {
  execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });
  console.log(`\n✨ 依赖安装完成！新课件工程已就绪。\n`);
  console.log(`后续启动命令:`);
  console.log(`  cd "${targetArg}"`);
  console.log(`  pnpm start      # 启动本地实时热重载开发服务器 (默认端口 3333)`);
  console.log(`  pnpm build      # 编译生成生产级静态分发包 (输出至 www/ 和 dist/)\n`);
} catch (err) {
  console.error('❌ pnpm install 执行失败，请手动在目标目录下执行 pnpm install', err);
}
