import { validateDeployConfig } from './deploy-config';

try {
  const config = validateDeployConfig(process.env, process.argv.includes('--enabled'));
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== config.projectId) {
    throw new Error('Project Firebase CLI chọn không khớp config build. Truyền --project đúng môi trường.');
  }
  if (process.env.GITHUB_ACTIONS === 'true' && (!process.env.WIF_PROVIDER || !process.env.DEPLOY_SERVICE_ACCOUNT)) {
    throw new Error('Thiếu WIF_PROVIDER hoặc DEPLOY_SERVICE_ACCOUNT trong GitHub Environment.');
  }
  console.log(`Config cloud hợp lệ: ${process.env.FIREBASE_DEPLOY_ENV} / ${config.projectId}. Quyền và billing được Firebase kiểm tra khi deploy.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Config cloud chưa hợp lệ.');
  process.exitCode = 1;
}
