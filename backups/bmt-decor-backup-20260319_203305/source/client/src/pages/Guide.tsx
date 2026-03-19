import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList, Layout, Ruler, Box, Paintbrush, Image, FileDown,
  MessageSquare, Upload, Brain, ArrowRight, CheckCircle2
} from "lucide-react";

const steps = [
  {
    num: 1,
    title: "Thu thập dữ liệu",
    icon: ClipboardList,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    description: "Nhập thông tin dự án: tên khách hàng, kích thước đất, số tầng, phong cách, ngân sách. Upload hình ảnh hiện trạng nếu có.",
    tips: [
      "Đo chính xác chiều rộng, chiều dài khu đất (mét)",
      "Chọn phong cách phù hợp: Hiện đại, Tân cổ điển, Wabi Sabi, Indochine...",
      "Upload ảnh hiện trạng giúp AI phân tích chính xác hơn",
    ],
  },
  {
    num: 2,
    title: "Phân tích & Layout",
    icon: Layout,
    color: "text-green-500",
    bg: "bg-green-500/10",
    description: "AI phân tích phong thủy, hướng nhà, bố trí layout tối ưu. Bạn có thể chat để điều chỉnh.",
    tips: [
      "Kiểm tra hướng nhà và yếu tố phong thủy",
      "Yêu cầu AI điều chỉnh bố trí phòng theo ý muốn",
      "Nhấn 'Duyệt' khi hài lòng, hoặc 'Làm lại' để AI tạo phương án mới",
    ],
  },
  {
    num: 3,
    title: "Xuất bản vẽ CAD",
    icon: Ruler,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    description: "AI tạo bản vẽ kỹ thuật CAD dựa trên layout đã duyệt. Bao gồm mặt bằng, mặt cắt, chi tiết.",
    tips: [
      "Kiểm tra kích thước phòng, vị trí cửa, cầu thang",
      "Yêu cầu chỉnh sửa chi tiết qua chat AI",
      "Bản vẽ CAD sẽ được sử dụng cho các bước sau",
    ],
  },
  {
    num: 4,
    title: "Mô hình 3D & Mặt tiền",
    icon: Box,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    description: "Tạo mô hình 3D và thiết kế mặt tiền. AI gợi ý phong cách và tông màu phù hợp.",
    tips: [
      "Chọn phong cách mặt tiền yêu thích",
      "AI sẽ gợi ý vật liệu và tông màu phù hợp",
      "Có thể yêu cầu render nhiều góc nhìn khác nhau",
    ],
  },
  {
    num: 5,
    title: "Thiết kế nội thất",
    icon: Paintbrush,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    description: "Thiết kế nội thất từng phòng: phòng khách, phòng ngủ, bếp, phòng tắm. AI gợi ý nội thất và vật liệu.",
    tips: [
      "Chọn phong cách nội thất phù hợp với ngân sách",
      "AI gợi ý nội thất và vật liệu theo yêu cầu",
      "Có thể upload ảnh mẫu để AI tham khảo",
    ],
  },
  {
    num: 6,
    title: "Render phối cảnh",
    icon: Image,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    description: "AI render hình ảnh phối cảnh chất lượng cao. Bao gồm ngoại thất, nội thất, cảnh quan.",
    tips: [
      "Render các góc nhìn quan trọng: mặt tiền, phòng khách, phòng ngủ master",
      "Yêu cầu render ban ngày/ban đêm nếu cần",
      "Có thể tạo video tour từ render",
    ],
  },
  {
    num: 7,
    title: "Xuất PDF hồ sơ",
    icon: FileDown,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    description: "Tổng hợp toàn bộ dự án thành file PDF chuyên nghiệp. Bao gồm bản vẽ, render, dự toán.",
    tips: [
      "PDF bao gồm tất cả bản vẽ, render và thông tin kỹ thuật",
      "Tải về để gửi cho khách hàng hoặc nhà thầu",
      "PDF có logo và thông tin công ty BMT Decor",
    ],
  },
];

export default function Guide() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8" data-testid="page-guide">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-guide-title">
            Hướng dẫn sử dụng
          </h1>
          <p className="text-muted-foreground mt-1">
            BMT Decor - Hệ thống AI thiết kế kiến trúc & nội thất tự động
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Tổng quan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              BMT Decor sử dụng trí tuệ nhân tạo (AI) để hỗ trợ quy trình thiết kế kiến trúc và nội thất.
              Hệ thống hoạt động theo 7 bước tuần tự, mỗi bước có:
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium">Form nhập liệu</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium">Chat AI hỗ trợ</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium">Duyệt / Làm lại</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Quy trình 7 bước</h2>
          {steps.map((step, idx) => (
            <Card key={step.num} data-testid={`card-step-guide-${step.num}`}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center shrink-0`}>
                    <step.icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${step.color} px-2 py-0.5 rounded-full ${step.bg}`}>
                        Bước {step.num}
                      </span>
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <div className="space-y-1.5">
                      {step.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ArrowRight className="w-3 h-3 text-primary mt-1 shrink-0" />
                          <span className="text-xs text-muted-foreground">{tip}</span>
                        </div>
                      ))}
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/50 pt-1">
                        <span>Sau khi duyệt</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>Bước {step.num + 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Tính năng bổ sung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground mb-1">Chat AI thông minh</h3>
              <p className="text-sm text-muted-foreground">
                Mỗi bước đều có trợ lý AI chat riêng. AI sẽ sử dụng thông tin dự án, file tri thức,
                và instructions tùy chỉnh để đưa ra tư vấn chính xác nhất.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">File tri thức</h3>
              <p className="text-sm text-muted-foreground">
                Upload file tri thức (bảng giá vật liệu, quy chuẩn xây dựng, catalog nội thất...)
                vào trang Cài đặt. AI sẽ tham khảo khi xử lý tất cả dự án.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Xuất PDF chuyên nghiệp</h3>
              <p className="text-sm text-muted-foreground">
                Bước 7 tổng hợp toàn bộ dự án thành file PDF có logo và thông tin
                CÔNG TY TNHH TMDV BMT DECOR, sẵn sàng gửi khách hàng.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
