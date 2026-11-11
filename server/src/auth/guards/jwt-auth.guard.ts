import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token =
      req.cookies?.["git_pulse_session"] ||
      req.cookies?.["access_token"] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      throw new UnauthorizedException(
        "Phiên đăng nhập không tồn tại. Vui lòng đăng nhập qua Gateway.",
      );
    }

    try {
      const decoded = this.jwtService.verify<{ sub: string; username: string }>(
        token,
      );
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException(
          "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.",
        );
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
      );
    }
  }
}
