# Quản lý chi tiêu – web app cho iPhone

App ghi chép thu chi cá nhân. Cài lên màn hình chính iPhone, dùng được khi không có mạng, dữ liệu chỉ lưu trên máy.

## Tính năng
- **Ghi thu/chi:** số tiền tự định dạng VNĐ, có nút nhanh `000`, `+10k`, `+50k`…; chọn danh mục bằng biểu tượng; ngày; ghi chú.
- **Lịch sử:** xem theo tháng, nhóm theo ngày, lọc theo danh mục hoặc loại, tìm kiếm không cần gõ dấu ("ca phe" ra "Cà phê"). Chạm vào giao dịch để sửa hoặc xoá.
- **Ngân sách:**
  - Đặt hạn mức tháng cho từng danh mục.
  - Thanh tiến độ chuyển vàng khi đã dùng 80%, đỏ khi vượt.
  - Thông báo ngay lúc nhập một khoản chi làm chạm 80% hoặc vượt hạn mức.
  - Gợi ý số tiền nên tiêu mỗi ngày trong phần còn lại của tháng.
- **Báo cáo:** biểu đồ tròn theo danh mục, biểu đồ cột chi tiêu theo ngày (có đường trung bình), so sánh thu/chi 6 tháng gần nhất.
- **Danh mục:** thêm, sửa, xoá; đổi biểu tượng và màu. Khi xoá một danh mục, các giao dịch của nó chuyển sang "Khác".
- **Sao lưu:** xuất file `.json` để sao lưu và khôi phục; xuất `.csv` để mở bằng Excel hoặc Numbers.
- Tự đổi theo chế độ Sáng/Tối của iPhone.

## Cấu trúc
```
index.html            Khung trang
styles.css            Giao diện
app.js                Toàn bộ logic (dữ liệu, các màn hình, biểu đồ, sao lưu)
sw.js                 Service worker: lưu sẵn app để chạy offline
manifest.webmanifest  Thông tin để cài app lên màn hình chính
icons/                Biểu tượng app
```
Không cần cài đặt hay build gì. Chỉ cần đưa cả thư mục này lên một host có HTTPS.

## Đưa app lên mạng (miễn phí)
iPhone chỉ cho cài app lên màn hình chính và chạy offline khi trang có **HTTPS**. Bạn chọn một trong hai cách sau.

### Cách 1: Netlify Drop (nhanh nhất, khoảng 2 phút)
1. Vào https://app.netlify.com/drop và đăng ký tài khoản miễn phí. Nếu không đăng ký, trang sẽ bị xoá sau 1 giờ.
2. Kéo **cả thư mục `quan-ly-chi-tieu`** thả vào trang.
3. Netlify cấp một link dạng `https://ten-ngau-nhien.netlify.app`. Bạn có thể đổi tên trong *Site configuration → Change site name*.

### Cách 2: GitHub Pages
1. Tạo tài khoản tại https://github.com và tạo một repository mới, ví dụ `chi-tieu`.
2. Chọn **Add file → Upload files**, kéo **các file bên trong** thư mục này (cả thư mục `icons`) vào, rồi nhấn **Commit changes**.
3. Vào **Settings → Pages**. Ở mục *Source* chọn **Deploy from a branch**, chọn nhánh `main` và thư mục `/ (root)`, rồi nhấn **Save**.
4. Sau khoảng 1 phút, app có ở địa chỉ `https://<tên-tài-khoản>.github.io/chi-tieu/`.

## Cài lên iPhone
1. Mở link bằng **Safari**. Chrome trên iPhone không cài app kiểu này được.
2. Nhấn nút **Chia sẻ** (hình vuông có mũi tên lên), chọn **"Thêm vào MH chính"**, rồi nhấn **Thêm**.
3. Từ giờ hãy mở app bằng **biểu tượng trên màn hình chính**.

> ⚠️ Trên iPhone, dữ liệu của tab Safari và dữ liệu của app đã cài là **hai nơi riêng**. Những gì bạn nhập trong tab Safari sẽ không có trong app đã cài. Hãy cài app trước rồi mới bắt đầu nhập.

## Về dữ liệu
- Dữ liệu chỉ nằm trong bộ nhớ của app trên iPhone, không gửi đi đâu cả.
- Dữ liệu **sẽ mất** nếu bạn xoá app khỏi màn hình chính, xoá dữ liệu trang web trong Cài đặt Safari, hoặc đổi máy mà không sao lưu.
- Hãy vào **Cài đặt → Xuất file sao lưu** định kỳ và chọn **"Lưu vào Tệp"** (nên để trong iCloud Drive). App sẽ nhắc nếu đã hơn 30 ngày bạn chưa sao lưu.
- Khi đổi máy: cài app trên máy mới, vào **Cài đặt → Khôi phục từ file sao lưu**, rồi chọn file `.json`.

## Khi sửa code và cập nhật app
- Tải các file đã sửa lên host như lúc đầu.
- App đã cài sẽ tải bản mới ở nền khi mở, và áp dụng ở **lần mở kế tiếp**.
- Nếu muốn ép xoá toàn bộ bộ nhớ đệm cũ, đổi `CACHE = 'chitieu-v1'` trong `sw.js` thành `'chitieu-v2'`.

## Chạy thử trên máy tính
Mở PowerShell trong thư mục này và chạy một server tĩnh bất kỳ, ví dụ nếu có Python: `python -m http.server 8000`. Sau đó mở `http://localhost:8000`.
