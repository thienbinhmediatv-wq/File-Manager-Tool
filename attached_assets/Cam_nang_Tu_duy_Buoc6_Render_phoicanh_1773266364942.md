CẨM NANG TƯ DUY AI: RENDER PHỐI CẢNH ĐA PHƯƠNG THỨC (BƯỚC 6)
1. TƯ DUY NHẤT QUÁN TOÀN DIỆN (TOTAL CONSISTENCY)
Đây là bước "chụp ảnh" thành phẩm trước khi xây. AI phải đối soát 5 tầng dữ liệu trước khi bấm máy:
• Khớp kỹ thuật (Từ Bước 3 & 4): Không được sai lệch một milimet so với khung xương 3D và bản vẽ CAD.
• Khớp nội thất (Từ Bước 5): Vị trí đồ đạc, chủng loại đèn, màu sắc vải/da phải giữ nguyên từ bước thiết kế nội thất.
• Khớp hiện trạng (Từ Bước 1 - Video/Ảnh): Bối cảnh bên ngoài cửa sổ (nhà hàng xóm, cây xanh, cột điện) phải giống ít nhất 80% so với video hiện trạng để khách hàng cảm thấy sự thân thuộc.
2. LOGIC CHIẾU SÁNG VẬT LÝ (PHYSICAL LIGHTING LOGIC)
AI không đặt đèn ngẫu nhiên mà phải tính toán theo hướng nhà trên Sổ đỏ:
• Ánh sáng theo Hướng: * Nhà hướng Tây: Giả lập ánh nắng chiều vàng rực, thể hiện rõ hiệu quả của các giải pháp chắn nắng.
• Nhà hướng Đông: Ánh sáng sáng sớm trong trẻo, mát mẻ.
• Ánh sáng nhân tạo (IES Profiles): Sử dụng các thông số quang học thực tế của đèn (đèn spotlight, đèn led dây, đèn thả) để tạo chiều sâu và điểm nhấn cho vật liệu.
• Tư duy: "Ánh sáng phải lột tả được chất liệu và cảm xúc của không gian."
3. TƯ DUY VẬT LIỆU "THẬT" THEO DỰ TOÁN (SHADERS & BUDGET)
AI truy xuất file Dự toán để cấu hình tính chất bề mặt (Shaders):
• Độ bóng (Glossiness): Nếu dự toán ghi "Gỗ công nghiệp phủ Melamine" -> Độ bóng thấp, vân gỗ mờ. Nếu là "Kính cường lực/Inox mạ" -> Phản xạ cao, sắc nét.
• Độ nhám (Bump): Thể hiện rõ sớ gỗ, độ sần của sơn hiệu ứng hoặc mạch gạch theo đúng bảng mã vật tư.
• Tư duy: "Khách hàng nhìn thấy gì trên Render, họ sẽ nhận được đúng vật liệu đó khi bàn giao nhà."
4. BỐ CỤC CAMERA & THỊ GIÁC (COMPOSITION & CINEMATOGRAPHY)
AI đóng vai trò một nhiếp ảnh gia kiến trúc:
• Góc nhìn (Eye-level): Đặt camera ở độ cao 1.5m - 1.6m để tạo cảm giác thực tế như đang đứng trong nhà.
• Góc rộng (Wide-angle): Sử dụng cho không gian nhỏ nhưng không được làm méo (Distortion) các cạnh tường thẳng đứng.
• Góc đặc tả (Close-up): Render cận cảnh các chi tiết tinh xảo hoặc vật liệu cao cấp (nếu dự toán cho phép) để nâng tầm đẳng cấp BMT Decor.
5. TƯ DUY "SỰ SỐNG" TRONG BẢN VẼ (LIFE-LIKE ELEMENTS)
Để bản vẽ không bị "lạnh", AI thêm các yếu tố sinh động dựa trên thông tin gia đình (Input Bước 1):
• Cây xanh: Chọn loại cây phù hợp với bối cảnh địa phương (xem video hiện trạng).
• Đồ decor: Thêm sách, lọ hoa, hoặc một vài vật dụng sinh hoạt nhỏ để tạo cảm giác nhà đã có người ở.
• Con người: Có thể thêm bóng người mờ (Motion blur) để thể hiện tỉ lệ không gian nhưng không làm xao nhãng kiến trúc chính.
6. QUY TRÌNH KIỂM LỖI HÌNH ẢNH (FINAL RENDER QC)
Trước khi xuất file chất lượng cao (4K), AI tự kiểm tra:
1. Nhiễu hạt (Noise): Hình ảnh có sạch không? Các góc tối có bị loang lổ không?
2. Sai lệch màu: Màu sắc trên Render có khớp với bảng màu (Moodboard) đã duyệt ở Bước 5 không?
3. Pháp lý: Có vô tình vẽ lấn chiếm sang nhà hàng xóm (nhìn từ video hiện trạng) không?