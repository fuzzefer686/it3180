import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { cloudProcessEnv, readDeployFile, requireDeployTarget, validateDeployConfig } from './deploy-config';

// Check/build không gọi Firebase cloud. Chỉ thao tác deploy mới cần bật guard.
try {
  const target = requireDeployTarget(process.argv[3]);
  const operation = process.argv[2];
  if (!['check', 'build', 'deploy'].includes(operation) || process.argv.length !== 4) throw new Error('Dùng npm run cloud:check|build:cloud|deploy:cloud -- dev|production-demo.');
  const configEnv = readDeployFile(target);
  const config = validateDeployConfig(configEnv, operation === 'deploy');
  console.log(`Môi trường: ${target}; Firebase project: ${config.projectId}.`);
  if (operation !== 'check') {
    const env = cloudProcessEnv(configEnv);
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('Chạy script qua npm run từ root repo.');
    const run = (args: string[]) => {
      const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    };
    run([npmCli, 'run', 'build']);
    if (operation === 'deploy') {
      const cli = createRequire(resolve('package.json')).resolve('firebase-tools/lib/bin/firebase.js');
      run([cli, 'deploy', '--only', 'firestore,functions,hosting', '--project', config.projectId]);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Không thể chuẩn bị/deploy Firebase.');
  process.exitCode = 1;
}
