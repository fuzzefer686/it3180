const project = process.env.FIREBASE_PROJECT_ID ?? '';
if (!project || project.startsWith('demo-') || project.includes('YOUR_')) {
  console.error('Chưa cấu hình FIREBASE_PROJECT_ID cloud hợp lệ; deploy bị chặn.');
  process.exit(1);
}
if (process.env.VITE_USE_EMULATORS !== 'false' || process.env.VITE_FIREBASE_PROJECT_ID !== project) {
  console.error('Config frontend phải là cloud và khớp project deploy.');
  process.exit(1);
}
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID']) {
  if (!process.env[key] || process.env[key].startsWith('demo-')) {
    console.error(`Thiếu cloud config: ${key}`);
    process.exit(1);
  }
}
console.log('Project/config khớp; cần credentials và billing đã được lead cấu hình.');
