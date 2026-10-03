# Hosting và cách làm nhóm — bản tối giản

Kế hoạch đề xuất, chưa triển khai account/hosting. Nguồn được kiểm tra 03/10/2026.

## Chọn một nền tảng

Giữ đề xuất Cloudflare Workers + D1: React/Vite ở giao diện, Hono ở API, database D1. Một repo, một app; không microservices. [Hướng dẫn React + API](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)

Repo public nên Vercel Hobby cũng hỗ trợ cộng tác, nhưng nhóm chỉ chọn một nền tảng để học và triển khai. Hobby giới hạn non-commercial. [Vercel](https://vercel.com/docs/limits/fair-use-guidelines)

## Ba môi trường, một workflow

| Nhánh | Môi trường | Dữ liệu |
|---|---|---|
| develop | Dev | DB demo riêng |
| staging | Staging | DB nghiệm thu riêng |
| main | Production-demo | DB demo phát hành riêng |

Mỗi người code local trên feature branch → PR vào develop → reviewer xem → merge. Lead đưa bản ổn sang staging, kiểm thử, rồi merge main. GitHub Actions tự test/build và deploy đúng nhánh. Không cần preview riêng từng PR ở V1.

- Dùng subdomain workers.dev, không mua domain.
- Deploy chỉ khi test/build qua; PR từ fork không có deploy token.
- Không dùng chung DB/secrets giữa các môi trường, không reset prod mỗi deploy.
- Lead giữ account cloud; CI dùng token, không chia sẻ password cho cả nhóm.
- Repo public bật branch protection, yêu cầu một review và CI qua.

Nguồn: [Cloudflare Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [D1 environments](https://developers.cloudflare.com/d1/configuration/environments/), [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).

## Giữ trong free tier

Workers Free có 100.000 request/ngày và 10ms CPU/invocation; D1 có quota riêng. Thử auth/DB sớm trên runtime, không giả định mọi thư viện đều chạy phù hợp. [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/)

GitHub Actions với standard runner cho public repo được miễn phí theo điều kiện hiện hành. Không bật thêm Cloudflare Builds nếu Actions đã deploy để tránh chạy hai pipeline. [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

Hosting free không đồng nghĩa VietMap luôn free. V1 dùng VietMap trong quota tài khoản. Thanh toán dùng điểm demo trong database, không cần PayOS key, webhook hay tài khoản ngân hàng. Hiển thị rõ “Điểm demo — không có giá trị tiền” ở cả dev, staging và production-demo.

## Làm theo thứ tự

1. Ngày04–05: chạy local, deploy dev có trang/login/API đơn giản.
2. Ngày06–07: tạo stage/prod cùng cấu hình app, DB riêng.
3. Ngày08–09: test staging, phát hành demo, lưu commit/version để quay lại bản cũ nếu lỗi.

Migration phải review, ưu tiên thêm trường/bảng để rollback code dễ. Rollback app không tự phục hồi DB. Nếu có lỗi deployment, đọc log cùng owner trước khi sửa ngẫu nhiên bằng AI.
