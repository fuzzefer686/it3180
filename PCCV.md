# Phân công nhóm MedBook

**Tuần 4 · Activity 1 · 5 thành viên** · [Repo MedBook gốc](https://github.com/NgDucLoc/MedBook-Case-Study-Base)

## I. Bối cảnh và mục tiêu

Khi một bệnh nhân hủy lịch khám, nhân viên MedBook phải dò danh sách chờ và gọi từng người để lấp khung giờ vừa trống.

**Tính năng mới cần làm gì?** Khi có khung giờ trống, MedBook tìm bệnh nhân phù hợp với bác sĩ hoặc chuyên khoa, xét mức ưu tiên và thời gian chờ rồi gửi lời mời. Nếu bệnh nhân từ chối hoặc quá hạn trả lời, hệ thống mời người tiếp theo. Mỗi khung giờ chỉ có tối đa một lịch hẹn đang hoạt động.

**Bài tuần 4** là viết rõ tính năng cần làm gì, chọn phần cần có trong phiên bản đầu (MVP) và chuẩn bị 1 slide. Dùng AI để gợi ý và rà soát. Cả nhóm duyệt kết quả và chốt ưu tiên.

## II. Phân công 5 thành viên

### Timeline

1. **TV1 + TV2** chuẩn bị bối cảnh, quy tắc và bảng câu hỏi rồi bàn giao cho TV3.
2. **TV3** viết User Stories. Cả nhóm duyệt 3 story ưu tiên.
3. **TV4** viết tiêu chí nghiệm thu cho 3 story đã duyệt.
4. **TV5 + cả nhóm** rà soát yêu cầu và chốt mức ưu tiên.
5. **TV5** ghép slide. Cả nhóm tập trình bày trong 5 phút.

### TV1 · Tóm tắt bài toán và quy tắc

1. Dựa vào **WB-4 và README**, hãy tóm tắt vấn đề, khó khăn, mục tiêu và lợi ích, ai bị ảnh hưởng, phạm vi, ràng buộc và cách đo thành công vào bảng **Business Problem Canvas**. Ghi thêm các chức năng và API sẵn có, chẳng hạn đặt, xác nhận và hủy lịch. Lưu vào `BusinessProblem.md`. [Danh sách API](README.md#api)
2. Hãy liệt kê các quy tắc trong `BusinessRules.md`, ví dụ mỗi khung giờ chỉ có một lịch hẹn đang hoạt động. Nếu đề và repo mô tả khác nhau, ghi điểm đó để TV2 làm rõ.

> **Prompt.** Dựa vào WB-4 và README MedBook, hãy lập bảng Business Problem Canvas, tóm tắt chức năng và API hiện có, rồi liệt kê các quy tắc cần tuân thủ. Đánh dấu chỗ cần xác nhận.

**Output:**

- `BusinessProblem.md` chứa bảng Business Problem Canvas, tóm tắt hệ thống và danh sách chức năng, API hiện có.
- `BusinessRules.md` chứa phần quy tắc nghiệp vụ do TV1 tổng hợp và các điểm cần xác nhận.

### TV2 · Tìm những câu hỏi nhóm cần trả lời

Dựa vào tài liệu của **TV1**, hãy tìm những chỗ đề còn bỏ ngỏ. Ví dụ, nếu hai bệnh nhân cùng mức ưu tiên thì mời ai trước? Người được mời có bao lâu để trả lời? Nếu khung giờ vừa có người đặt thì xử lý thế nào?

Ghi các câu hỏi vào bảng **Requirement Clarification Log** trong `BusinessRules.md`. Mỗi dòng có mã, thông tin còn thiếu, câu hỏi, người cần xác nhận và câu trả lời. Trao đổi để xác nhận câu trả lời. Đánh dấu `Open` nếu chưa chốt, `Answered` nếu đã xác nhận.

> **Prompt.** Dựa vào bối cảnh và quy tắc của TV1, hãy lập bảng câu hỏi về thứ tự mời, thời hạn, cách xử lý khi từ chối hoặc hết hạn, trùng lịch và quyền xem thông tin. Gợi ý ai nên trả lời từng câu.

**Output:**

- `BusinessRules.md` chứa bảng **Requirement Clarification Log** do TV2 điền, có mã câu hỏi, thông tin còn thiếu, câu hỏi, người cần xác nhận, câu trả lời và trạng thái `Open` hoặc `Answered`.

### TV3 · Viết yêu cầu từ góc nhìn người dùng

Dựa vào bối cảnh của **TV1** và câu trả lời của **TV2**, hãy viết từng yêu cầu theo mẫu **Là [ai], tôi muốn [làm gì] để [đạt mục đích gì]**. Ví dụ, *Là bệnh nhân trong danh sách chờ, tôi muốn nhận lời mời khi có lịch trống để có cơ hội khám sớm hơn.*

Ghi các yêu cầu vào `UserStories.md`. Mỗi yêu cầu có mã `US-xx` và một mục tiêu. Nếu còn phụ thuộc vào câu hỏi chưa chốt, ghi mã câu hỏi bên cạnh. Đề xuất **3 story quan trọng nhất** để nhóm duyệt trước khi chuyển cho TV4.

> **Prompt.** Dựa vào tài liệu của TV1 và TV2, hãy viết User Stories cho các vai trò đã xác nhận. Mỗi story có một mục tiêu. Gắn mã câu hỏi còn mở nếu có và đề xuất 3 story quan trọng nhất.

**Output:**

- `UserStories.md` chứa danh sách User Stories có mã, vai trò, nhu cầu và lý do. Ghi mã câu hỏi còn mở nếu có và đánh dấu 3 story đã được nhóm duyệt.

### TV4 · Viết cách kiểm tra 3 yêu cầu chính

Dựa vào **3 story nhóm đã duyệt**, hãy viết cách kiểm tra từng story vào `AcceptanceCriteria.md`. Với mỗi tình huống, ghi **Given** (ban đầu có gì), **When** (chuyện gì xảy ra), **Then** (kết quả kiểm tra được).

Hãy viết cả tình huống thành công, tình huống thay thế và tình huống lỗi. Ví dụ, **Given** bệnh nhân có lời mời còn hạn, **When** họ từ chối, **Then** hệ thống gửi lời mời cho người phù hợp tiếp theo nếu có. Viết thêm tình huống hết hạn và khung giờ đã có người đặt cho các story liên quan.

> **Prompt.** Dựa vào 3 story và quy tắc đã chốt, hãy viết tiêu chí Given–When–Then có kết quả kiểm tra được. Bao phủ ca thành công, từ chối, hết hạn và khung giờ không còn trống. Đánh dấu hành vi còn chờ xác nhận.

**Output:**

- `AcceptanceCriteria.md` chứa tiêu chí **Given–When–Then** cho cả 3 story, gồm tình huống thành công, thay thế và lỗi. Đánh dấu 1 story có tiêu chí dùng để minh họa trên slide.

### TV5 · Soát bài, chốt ưu tiên và ghép slide

1. Dựa vào tài liệu của **TV1–4**, hãy tìm chỗ còn thiếu, mâu thuẫn, khó làm với hệ thống hiện tại hoặc có rủi ro về dữ liệu và công bằng. Ghi từng vấn đề, ảnh hưởng và cách xử lý vào `RequirementReview.md`.
2. Hãy cùng nhóm xếp từng story vào một trong bốn mức **bắt buộc / nên có / có thể có / để sau** (MoSCoW). Ghi đề xuất của AI, lựa chọn của nhóm và lý do trong `PrioritizedBacklog.md`.
3. Hãy gom nội dung ở mục III thành **1 slide** và tập trình bày cùng nhóm trong 5 phút.

> **Prompt.** Hãy soát tài liệu của TV1–4, chỉ ra vấn đề kèm ảnh hưởng và cách xử lý. Đề xuất mức ưu tiên cho từng story dựa vào giá trị, rủi ro, độ khó và việc nào cần làm trước.

**Output:**

- `RequirementReview.md` chứa danh sách vấn đề phát hiện khi soát bài, ảnh hưởng và cách xử lý từng vấn đề.
- `PrioritizedBacklog.md` chứa mức ưu tiên AI đề xuất, mức nhóm chốt và lý do cho từng story.
- **1 slide thuyết trình** chứa đủ 5 phần ở mục III để cả nhóm trình bày trong 5 phút.

## III. Đầu ra

- **6 file Markdown** theo phân công ở mục II. Bảng làm rõ nằm trong `BusinessRules.md`.
- **1 slide, 5 phút** với 5 phần
  1. **TV1** — Mục tiêu, 2 khó khăn chính và các bên liên quan.
  2. **TV2** — 3 câu hỏi quan trọng và giả định hoặc câu hỏi còn mở.
  3. **TV3–4** — 3 story ưu tiên và tiêu chí minh họa cho 1 story.
  4. **TV5** — 3 thiếu sót AI phát hiện và cách nhóm xử lý từng điểm.
  5. **TV5** — Danh sách Must Have và 1 quyết định nhóm điều chỉnh so với AI, kèm lý do.

## IV. Phối hợp và mốc chốt

- **Khởi động** — Đọc WB-4 và README. Clone và chạy Docker là tùy chọn để kiểm chứng luồng hiện tại.
- **Khi bàn giao** — Gửi kèm mã câu hỏi còn mở để người làm bước sau biết phần nào cần xác nhận.
- **Trước khi trình bày** — Nhóm chốt Must Have và tập trả lời hai câu hỏi. AI hỗ trợ tốt nhất ở đâu? Quyết định nào nhóm phải tự chịu trách nhiệm?
