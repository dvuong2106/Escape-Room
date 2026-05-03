# Escape Room

Đây là một tựa game giải đố 3D, người chơi bị mắc kẹt trong một căn nhà và phải tìm manh mối để thoát ra ngoài.

## Cách chạy project
1. Cài Node.js
2. Mở terminal tại thư mục project
3. Chạy:
- npm install
- npm run dev
4. Mở local host

# ------------------------------------------------------

# Hướng Dẫn Chơi Game "Escape Room"

Chào mừng bạn đến với dự án Escape Room! Mục tiêu của bạn là khám phá căn nhà, tìm kiếm manh mối, giải các câu đố và tìm cách thoát ra ngoài. Tài liệu này hướng dẫn chi tiết cách thức thao tác và tương tác trong toàn bộ quá trình chơi.

---

## I. Cơ Chế Điều Khiển Cơ Bản

1. **Quan sát (Camera):**
   - Game sử dụng góc nhìn Isometric (chiếu trực giao) để bạn bao quát toàn bộ căn phòng.
   - Nhấn giữ chuột trái (hoặc chạm giữ trên màn hình cảm ứng) và **kéo/vuốt** sang trái hoặc phải để xoay camera quan sát xung quanh phòng.
   - Trong quá trình xoay, các bức tường chắn tầm nhìn sẽ tự động hạ xuống để bạn luôn nhìn rõ không gian bên trong.

2. **Tương tác (Click/Chạm):**
   - Nhấn **Click chuột trái (hoặc chạm)** vào các đồ vật trong phòng để thực hiện thao tác.
   - Nếu click vào **vật phẩm thu thập được** (như chìa khóa, sách), vật phẩm sẽ tự động biến mất khỏi không gian 3D và xuất hiện trong **Túi đồ (Inventory)** của bạn.
   - Nếu click vào **tủ, ngăn kéo, hoặc cửa**, chúng sẽ tự động mở ra hoặc đóng lại bằng một hiệu ứng hoạt ảnh mượt mà.
   - Nếu click vào các **thiết bị đặc biệt** (như TV, Laptop) hoặc **Kệ sách**, camera sẽ tự động phóng to (zoom) trực diện vào khu vực đó và hiển thị giao diện (UI) để bạn giải đố (nhả chuột bất kỳ ở khu vực bên ngoài UI để thoát).

3. **Di chuyển giữa các phòng:**
   - Căn nhà có nhiều không gian khác nhau (phòng khách, phòng ngủ, phòng bếp).
   - Để chuyển từ không gian này sang không gian khác, hãy tìm kiếm các **cánh cửa nối phòng** và click vào đó. Camera sẽ tự động trượt lướt sang phòng mới.

---

## II. Hệ Thống Túi Đồ (Inventory)

Túi đồ (Inventory) là thanh chứa các vật phẩm bạn đã nhặt được trong quá trình khám phá. Nó hoạt động song song trên nền giao diện 2D.

- **Cách sử dụng vật phẩm:** 
  1. Click vào biểu tượng của vật phẩm trong túi đồ để **chọn** nó. Khi được chọn, vật phẩm đó sẽ được đánh dấu làm nổi bật.
  2. Di chuyển chuột vào không gian 3D và **click vào đối tượng** mà bạn muốn sử dụng vật phẩm lên (ví dụ: chọn chìa khóa trong túi đồ rồi click vào một cánh cửa đang bị khóa).
- Để **bỏ chọn** vật phẩm, chỉ cần click lại vào biểu tượng của nó trong túi đồ một lần nữa.

---

## III. Hướng Dẫn Giải Đố & Tương Tác Chi Tiết (Walkthrough)

Để hoàn thành game, bạn cần thực hiện chuỗi các hành động sau:

### 1. Tìm kiếm và thu thập
Hãy lục lọi mọi ngóc ngách của các căn phòng. Mở tất cả các ngăn kéo, tủ đồ, xem dưới gầm bàn... Các vật phẩm đặc biệt quan trọng bao gồm:
- **Chìa khóa (Keys):** Dùng để mở các ngăn tủ bị khóa cứng hoặc cánh cửa qua bàn.
- **Sách (Books):** Bạn sẽ tìm thấy một số cuốn sách nằm rải rác hoặc bị giấu ở đâu đó. Hãy thu thập đủ chúng để dùng cho một câu đố sau này.

### 2. Giải mã thiết bị (Laptop & TV)
- Khi tìm thấy **Laptop** hoặc **TV**, click vào chúng để vào chế độ nhìn cận cảnh.
- Giao diện bàn phím nhập liệu hoặc mật khẩu sẽ hiện lên màn hình. Bạn cần tìm kiếm manh mối xung quanh căn phòng (có thể là các con số được giấu tinh vi, các hình vẽ hoặc một câu đố hóc búa) để suy luận ra **Mật khẩu**.
- Nếu nhập đúng, hệ thống sẽ mở khóa thiết bị và cung cấp cho bạn phần thưởng là một vật phẩm bị giấu hoặc một manh mối mới.

### 3. Câu Đố Kệ Sách (Bookshelf Puzzle)
- Khi bạn click vào **Kệ sách** trong phòng, camera sẽ chuyển sang góc nhìn trực diện vào kệ.
- Bạn sẽ thấy 6 ô trống để đặt sách..
- Mở túi đồ của bạn, chọn lần lượt các cuốn sách đã nhặt được và **click vào vị trí ô trống** trên kệ để xếp sách vào đó.
- **Mục tiêu:** Đặt các cuốn sách theo một trật tự/vị trí chính xác. Bạn có thể tự do lấy sách ra khỏi kệ và xếp lại nếu sai.
- Nếu đặt đúng toàn bộ quy luật, hệ thống cảm biến sẽ kích hoạt: **Hai cánh tủ bí mật sẽ tự động mở ra**, hé lộ phần thưởng vô cùng quan trọng bên trong.

### 4. Kết thúc trò chơi (End Game)
- Đích đến cuối cùng của bạn là tìm được chiếc chìa khóa thoát hiểm cuối cùng: **Được giấu trong ngăn tủ bí mật**.
- Sau khi thu thập được chìa khóa thoát hiểm, hãy di chuyển ra khu vực **Phòng khách** và tiếp cận cánh **cửa chính**.
- Mở túi đồ, **chọn vào chìa khóa**, sau đó **click vào cánh cửa chính**.
- Nếu thao tác đúng, màn hình game sẽ từ từ chuyển hiệu ứng mờ dần thành màu đen (Fade out screen).
- Đoạn video cắt cảnh kết thúc game (End Video) sẽ được phát lên, xác nhận bạn đã phá đảo thành công. 

**Chúc mừng bạn đã thoát khỏi căn phòng!**

---
**Mẹo nhỏ:** Đừng bỏ sót bất kỳ góc nhìn nào bằng cách thường xuyên xoay camera, và hãy kiểm tra Túi đồ của mình thường xuyên xem đã nhặt được những gì và suy luận xem vật phẩm đó dùng để làm gì nhé!
