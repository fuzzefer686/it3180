# PRODUCT BACKLOG — USER STORIES
**Dự án:** MedBook — Hệ thống Đặt lịch khám bệnh viện  
**Tính năng:** Dynamic Appointment Rescheduling & Waiting List Management  
**Người phụ trách:** Hoàng
**Tiêu chuẩn áp dụng:** Agile / INVEST criteria  

---

## I. DANH SÁCH TÁC NHÂN (ACTORS)
1. **Bệnh nhân (Patient):** Người sử dụng dịch vụ khám bệnh; tìm kiếm bác sĩ, đặt lịch, hủy lịch và tham gia danh sách chờ.
2. **Nhân viên y tế (Medical Staff):** Người điều phối phòng khám; quản lý lịch làm việc của bác sĩ, theo dõi danh sách chờ và can thiệp điều phối khi cần.
3. **Bác sĩ (Doctor):** Người trực tiếp khám bệnh (trong hệ thống hiện tại bác sĩ là thực thể dữ liệu, nhận thông báo cập nhật lịch khám).
4. **Hệ thống (System):** Tiến trình nền tự động phát hiện slot trống, tính toán mức độ ưu tiên của bệnh nhân trong danh sách chờ, gửi đề xuất và xử lý timeout.
5. **Quản trị viên (System Admin):** Người cấu hình các thông số vận hành của danh sách chờ. Vai trò này chưa tồn tại trong hệ thống hiện tại (xem US-09).

---

## II. BẢNG PRODUCT BACKLOG (USER STORIES)

| Mã ID | Tác nhân (Actor) | User Story (Là... Tôi muốn... Để...) | Giá trị nghiệp vụ (Business Value) | Phụ thuộc / Giả định (Assumption / Open Question) |
| :---: | :--- | :--- | :--- | :--- |
| **US-01** | Bệnh nhân | **Là** một bệnh nhân,<br>**Tôi muốn** đăng ký vào danh sách chờ khi khung giờ khám mong muốn đã kín chỗ,<br>**Để** tôi có cơ hội được xếp lịch khám sớm nếu có người khác hủy lịch. | Tăng tỷ lệ tiếp cận dịch vụ, giữ chân bệnh nhân không chuyển sang cơ sở y tế khác. | Giả định: Một bệnh nhân chỉ được đăng ký tối đa 1 slot chờ cho cùng 1 chuyên khoa tại một thời điểm. |
| **US-02** | Hệ thống | **Là** hệ thống tự động,<br>**Tôi muốn** tự động quét danh sách chờ và chọn ra bệnh nhân phù hợp nhất ngay khi có một khung giờ khám bị hủy (trở lại trạng thái còn trống),<br>**Để** tối ưu hóa công suất phòng khám và loại bỏ việc nhân viên phải gọi điện thoại thủ công. | Giảm thời gian điều phối từ khoảng 15–30 phút (ước tính) xuống gần như tức thì; giảm tỷ lệ bỏ phí slot khám. | Phụ thuộc: US-01 (phải có bệnh nhân trong danh sách chờ).<br>*Open Question:* Quy tắc ưu tiên bệnh nhân: dựa trên mức độ khẩn cấp y tế hay thời gian đăng ký chờ trước (FIFO)? |
| **US-03** | Bệnh nhân | **Là** bệnh nhân trong danh sách chờ,<br>**Tôi muốn** nhận được thông báo đề xuất slot khám trống kèm thời hạn đếm ngược để xác nhận (ví dụ: 15 phút),<br>**Để** tôi nắm được thông tin kịp thời và chủ động thu xếp thời gian cá nhân. | Minh bạch thông tin, tôn trọng quyền quyết định của bệnh nhân, nâng cao trải nghiệm dịch vụ. | Phụ thuộc: US-02.<br>Giả định: Thông báo hiển thị trên giao diện "Lịch của tôi" hoặc khi bệnh nhân đăng nhập. |
| **US-04** | Bệnh nhân | **Là** bệnh nhân nhận được đề xuất,<br>**Tôi muốn** xác nhận nhận lịch hoặc từ chối đề xuất trực tiếp trên hệ thống,<br>**Để** tôi chốt lịch khám chính thức hoặc nhường cơ hội ngay cho người phía sau. | Tự động hóa giao dịch đặt lịch hai chiều, loại bỏ hoàn toàn các cuộc gọi xác nhận thủ công. | Phụ thuộc: US-03.<br>Giả định: Khi bệnh nhân xác nhận, khung giờ được chốt ngay cho bệnh nhân đó; nếu khung giờ đã được người khác nhận trước thì hệ thống thông báo "Khung giờ không còn khả dụng". |
| **US-05** | Hệ thống | **Là** hệ thống tự động,<br>**Tôi muốn** tự động thu hồi đề xuất và chuyển slot cho bệnh nhân tiếp theo nếu bệnh nhân hiện tại không phản hồi trong thời gian quy định,<br>**Để** khung giờ khám không bị giữ ảo và không bị lãng phí. | Tối đa hóa tỷ lệ lấp đầy lịch khám trước khi giờ khám diễn ra. | Phụ thuộc: US-02, US-03.<br>Giả định: Thời gian chờ phản hồi mặc định là 15 phút.<br>*Open Question:* Nếu bệnh nhân không phản hồi quá 3 lần thì có giữ họ trong danh sách chờ không? |
| **US-06** | Nhân viên y tế | **Là** nhân viên y tế,<br>**Tôi muốn** xem danh sách chờ theo bác sĩ/ngày và trạng thái của các slot đang gửi đề xuất,<br>**Để** tôi giám sát luồng điều phối tự động và kịp thời xử lý các tình huống bất thường. | Đảm bảo tính kiểm soát của con người đối với hệ thống tự động (Human-in-the-loop). | Giả định: Bổ sung mục "Danh sách chờ" trên giao diện điều phối của nhân viên. |
| **US-07** | Bác sĩ | **Là** bác sĩ,<br>**Tôi muốn** nhận thông báo khi có bệnh nhân mới được xếp vào slot vừa bị hủy,<br>**Để** tôi nắm được lịch làm việc chính xác và chuẩn bị hồ sơ bệnh án chu đáo. | Giúp bác sĩ chủ động ca làm việc, giảm gián đoạn công tác khám chữa bệnh. | Phụ thuộc: US-04.<br>Giả định: Bác sĩ nhận thông báo qua danh sách lịch làm việc trong ngày. |
| **US-08** | Bệnh nhân | **Là** bệnh nhân,<br>**Tôi muốn** chủ động hủy yêu cầu trong danh sách chờ khi kế hoạch của tôi thay đổi,<br>**Để** tôi không bị làm phiền bởi các thông báo đề xuất không còn cần thiết. | Làm sạch dữ liệu danh sách chờ, giảm tỷ lệ đề xuất thất bại cho hệ thống. | Phụ thuộc: US-01.<br>Giả định: Bệnh nhân có thể hủy bất kỳ lúc nào khi chưa xác nhận nhận lịch chính thức. |
| **US-09** | Quản trị viên (System Admin) | **Là** quản trị viên hệ thống,<br>**Tôi muốn** cấu hình các thông số vận hành của danh sách chờ (thời gian chờ phản hồi, số lần đề xuất tối đa, quy tắc ưu tiên),<br>**Để** bệnh viện có thể điều chỉnh chính sách phù hợp theo từng giai đoạn hoạt động mà không cần sửa đổi hệ thống. | Tăng tính linh hoạt vận hành, cho phép ban giám đốc thay đổi chính sách mà không phụ thuộc đội kỹ thuật. | *Open Question:* Vai trò Admin hiện chưa tồn tại trong hệ thống (chỉ có Patient và Staff). Admin là vai trò mới hay Staff kiêm nhiệm? |

---

## III. TOP 03 USER STORIES CỐT LÕI ĐƯỢC CHỌN CHO MVP

1. **US-01 (Đăng ký vào danh sách chờ):** Cổng đầu vào bắt buộc để thu thập nhu cầu của bệnh nhân khi hết chỗ.
2. **US-02 (Tự động quét & đề xuất khi slot trống):** Trái tim của tính năng tự động hóa (Dynamic Rescheduling).
3. **US-04 (Bệnh nhân xác nhận hoặc từ chối đề xuất):** Điểm chốt vòng đời giao dịch, giải quyết triệt để bài toán gọi điện thủ công.

---

## IV. HUMAN CHECKPOINT (SINH VIÊN TỰ KIỂM TRA & PHÊ DUYỆT)

### Checklist kiểm tra (theo yêu cầu Workbook trang 8)

| # | Tiêu chí kiểm tra | Đạt? | Ghi chú / Điều chỉnh đã thực hiện |
| :---: | :--- | :---: | :--- |
| 1 | **Actor đã rõ ràng** — Mỗi story xác định rõ ai là người sử dụng | ☑ | Sửa actor của US-06 từ "Nhân viên" thành "Nhân viên y tế" cho thống nhất với danh sách Actors. Bổ sung Quản trị viên vào danh sách Actors ở Mục I. |
| 2 | **Nhu cầu không bị trộn với giải pháp kỹ thuật** — Không nhắc DB, API, endpoint, SQL, mã lỗi HTTP | ☑ | Đã loại thuật ngữ DB và mã lỗi HTTP ở US-04. Thay "available" ở US-02 bằng "còn trống"; thay "banner popup" ở US-03 và "tab" ở US-06 bằng cách diễn đạt trung tính, không ấn định giao diện. |
| 3 | **Giá trị nghiệp vụ đã được thể hiện** — Cột Business Value không trống, không chung chung | ☑ | Cả 9 story đều có giá trị nghiệp vụ. Ở US-02 sửa con số "15-30 phút → < 1 giây" thành "khoảng 15–30 phút (ước tính) → gần như tức thì" vì chưa có số liệu thực tế để chứng minh. |
| 4 | **Không chứa Business Rule chưa được xác nhận** — Nếu có thì đã đánh dấu rõ là Assumption / Open Question | ☑ | Thêm nhãn "Giả định" cho các rule trước đó chưa đánh dấu: thời gian chờ 15 phút (US-05), mục "Danh sách chờ" (US-06), cách bác sĩ nhận thông báo (US-07), quyền hủy của bệnh nhân (US-08). Open Question còn lại: quy tắc ưu tiên (US-02), xử lý khi timeout quá 3 lần (US-05), vai trò Admin (US-09). |
| 5 | **Có thể phát triển và kiểm thử độc lập** — Mỗi story có thể demo/test riêng mà không phụ thuộc story khác | ☑ | Một số story phụ thuộc theo luồng nghiệp vụ (US-02 cần US-01, US-03/US-05 cần US-02, US-04 cần US-03, US-07 cần US-04). Đã ghi rõ cột "Phụ thuộc" để thứ tự phát triển rõ ràng; mỗi story vẫn kiểm thử riêng được bằng dữ liệu mẫu. Không tách/gộp story. |
| 6 | **Không trùng lặp với User Story khác** — Không có 2 story nói cùng 1 việc | ☑ | Không có cặp nào trùng. Hai cặp dễ nhầm đã được phân biệt: US-04 (từ chối một đề xuất cụ thể) khác US-08 (rút khỏi danh sách chờ), US-02 (chọn bệnh nhân) khác US-05 (thu hồi khi quá hạn). |
| 7 | **Phù hợp với phạm vi phiên bản hiện tại** — Không quá to, không ngoài scope | ☑ | MVP gồm US-01, US-02, US-04 (kèm US-03 làm điều kiện để US-04 chạy được). US-09 đề xuất xếp **Won't Have** cho phiên bản này vì vai trò Admin chưa tồn tại; US-06, US-07, US-08 xếp **Should/Could Have**. Lưu ý US-02 tương đối lớn (quét, chọn, gửi đề xuất), cần cân nhắc tách nhỏ khi lập kế hoạch Sprint. |
| 8 | **Đã phê duyệt Backlog** — Chốt xong rồi mới gửi cho Thành viên 4 viết Acceptance Criteria | ☐ | Ngày rà soát: 22/11/2026. Người review trong nhóm: *(điền tên)*. Đánh dấu ☑ sau khi nhóm thống nhất. |

### Những điều chỉnh của sinh viên so với bản AI đề xuất ban đầu

| Vị trí | Nội dung AI sinh ra | Sinh viên sửa thành | Lý do |
| :--- | :--- | :--- | :--- |
| US-04 (cột Assumption) | *"Ràng buộc DB: tạo bản ghi appointments, chuyển slot sang booked, tránh lỗi 409"* | *"Khi bệnh nhân xác nhận, khung giờ được chốt ngay; nếu khung giờ đã được nhận trước thì hệ thống thông báo không còn khả dụng"* | Loại bỏ thuật ngữ kỹ thuật (DB, mã lỗi HTTP) theo yêu cầu Human Checkpoint mục 2. |
| Bổ sung US-09 | Không có story cho System Admin | Thêm US-09: Quản trị viên cấu hình thông số danh sách chờ | Thầy yêu cầu nhóm actor bao gồm System Administrator. |
| US-06 (cột Actor) | "Nhân viên" | "Nhân viên y tế" | Thống nhất tên actor với Mục I. |
| US-02 (cột User Story) | "trạng thái 'available'" | "trạng thái còn trống" | Tránh thuật ngữ kỹ thuật trong nhu cầu nghiệp vụ. |
| US-02 (cột Business Value) | "từ 15-30 phút xuống tức thì (< 1 giây)" | "khoảng 15–30 phút (ước tính) xuống gần như tức thì" | Chưa có số liệu thực tế nên không nêu con số cứng. |
| US-03, US-06 | "banner popup", "tab" | "khi đăng nhập", "mục" | Không ấn định giải pháp giao diện ở mức User Story. |
| US-05, US-06, US-07, US-08 (cột Assumption) | Rule chưa gắn nhãn | Gắn nhãn "Giả định" / "Open Question" | Đáp ứng mục 4: rule chưa xác nhận phải được đánh dấu rõ. |
| US-02 → US-08 (cột Phụ thuộc) | Chưa ghi phụ thuộc giữa các story | Bổ sung "Phụ thuộc: US-xx" | Làm rõ thứ tự phát triển và kiểm thử (mục 5). |
| Mục I (Actors) | Chỉ có 4 actor | Thêm actor thứ 5: Quản trị viên | Đồng bộ với US-09. |
