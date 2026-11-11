import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReports(userId: string) {
    return this.prisma.reportHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getReportById(userId: string, id: string) {
    const report = await this.prisma.reportHistory.findFirst({
      where: { id, userId },
    });
    if (!report) {
      throw new NotFoundException("Không tìm thấy bản báo cáo.");
    }
    return report;
  }

  async deleteReport(userId: string, id: string) {
    await this.prisma.reportHistory.deleteMany({
      where: { id, userId },
    });
    return { success: true };
  }
}
