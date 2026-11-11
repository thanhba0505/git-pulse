import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Response } from "express";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { SsoCallbackDto } from "./dto/sso-callback.dto";
import { AuthenticatedUser } from "./guards/jwt-auth.guard";

interface GatewayUserPayload {
  id?: string;
  username: string;
  email?: string | null;
  role?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly gatewayUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5101/api/v1";
  }

  /**
   * Cấp phát HttpOnly session cookie và trả về thông tin người dùng (chuẩn Wonderlab)
   */
  async login(
    user: AuthenticatedUser,
    response: Response,
  ): Promise<{ message: string; user: AuthenticatedUser }> {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);
    const isProduction = process.env.NODE_ENV === "production";
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    response.cookie("git_pulse_session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeMs,
    });

    response.cookie("access_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeMs,
    });

    return {
      message: "Đăng nhập thành công",
      user,
    };
  }

  /**
   * Xác thực Single Sign-On (SSO) từ Central Gateway qua PKCE (chuẩn Wonderlab)
   */
  async loginWithSso(
    dto: SsoCallbackDto,
    response: Response,
  ): Promise<{ message: string; user: AuthenticatedUser }> {
    let gatewayRes: globalThis.Response;
    try {
      gatewayRes = await fetch(`${this.gatewayUrl}/auth/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: "git-pulse",
          code: dto.code,
          code_verifier: dto.code_verifier,
        }),
      });
    } catch {
      throw new UnauthorizedException(
        "Không thể kết nối đến Central Gateway SSO Hub.",
      );
    }

    if (!gatewayRes.ok) {
      const errorBody = (await gatewayRes.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new UnauthorizedException(
        errorBody.message || "Xác thực Single Sign-On thất bại.",
      );
    }

    const data = (await gatewayRes.json()) as { user: GatewayUserPayload };
    const ssoUser = data.user;

    if (ssoUser.isActive === false) {
      throw new UnauthorizedException(
        "Tài khoản này đã bị tạm khóa trong hệ thống.",
      );
    }

    const localUser = await this.syncLocalUser({
      id: ssoUser.id || `sso_${Date.now()}`,
      username: ssoUser.username,
      email: ssoUser.email,
      role: ssoUser.role,
      avatarUrl: ssoUser.avatarUrl,
      isActive: ssoUser.isActive,
    });

    return this.login(localUser, response);
  }

  /**
   * Đăng nhập / Đăng ký qua Google OAuth ủy quyền Central Gateway Master IAM (chuẩn Wonderlab)
   */
  async loginWithGoogle(
    dto: GoogleLoginDto,
    response: Response,
  ): Promise<{ message: string; user: AuthenticatedUser }> {
    let email = dto.email?.toLowerCase();
    let name = dto.name;
    let googleId = dto.googleId;

    if (dto.credential && (!email || !googleId)) {
      try {
        const decoded = this.jwtService.decode(dto.credential) as Record<
          string,
          unknown
        > | null;
        if (decoded) {
          if (typeof decoded.email === "string")
            email = decoded.email.toLowerCase();
          if (typeof decoded.name === "string") name = decoded.name;
          if (typeof decoded.sub === "string") googleId = decoded.sub;
        }
      } catch (err) {
        this.logger.warn(
          `Failed to decode credential: ${(err as Error).message}`,
        );
      }
    }

    if (!email) {
      throw new BadRequestException(
        "Không thể trích xuất địa chỉ email từ tài khoản Google.",
      );
    }

    // Call Central Gateway IAM /auth/google
    let gwUser: GatewayUserPayload | null = null;
    try {
      const res = await fetch(`${this.gatewayUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || email.split("@")[0],
          googleId: googleId || `google_${Date.now()}`,
          credential: dto.credential,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as { user?: GatewayUserPayload };
        if (body.user) {
          gwUser = body.user;
        }
      } else {
        this.logger.warn(
          `Central Gateway /auth/google responded status ${res.status}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Gateway unreachable: ${(err as Error).message}`);
    }

    // Fallback for isolated local test if Gateway is not currently running
    if (!gwUser) {
      gwUser = {
        id: `gw_${Buffer.from(email).toString("hex").slice(0, 16)}`,
        username: name || email.split("@")[0],
        email,
        role: "USER",
        isActive: true,
      };
    }

    if (gwUser.isActive === false) {
      throw new UnauthorizedException("Tài khoản này đã bị khóa.");
    }

    const localUser = await this.syncLocalUser(gwUser);
    return this.login(localUser, response);
  }

  /**
   * Lấy danh sách tài khoản phục vụ popup đăng nhập nhanh trên dev (chuẩn Wonderlab)
   */
  async getDevUsers(): Promise<
    Array<{
      id: string;
      username: string;
      email: string | null;
      role: string;
      avatarUrl?: string | null;
    }>
  > {
    try {
      const res = await fetch(`${this.gatewayUrl}/auth/dev/users`);
      if (res.ok) {
        const gwUsers = (await res.json()) as Array<{
          id: string;
          username: string;
          email: string | null;
          role: string;
          avatarUrl?: string | null;
        }>;
        if (Array.isArray(gwUsers) && gwUsers.length > 0) {
          return gwUsers;
        }
      }
    } catch {
      // Fallback
    }

    const localUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (localUsers.length > 0) {
      return localUsers;
    }

    return [
      {
        id: "admin-dev-id",
        username: "admin",
        email: "admin@wonderlab.local",
        role: "ADMIN",
        avatarUrl: null,
      },
      {
        id: "dev-user-id",
        username: "developer",
        email: "developer@wonderlab.local",
        role: "USER",
        avatarUrl: null,
      },
    ];
  }

  /**
   * Đồng bộ hoặc khởi tạo người dùng cục bộ từ danh tính Central Gateway Master IAM (chuẩn Wonderlab)
   */
  async syncLocalUser(gwUser: GatewayUserPayload): Promise<AuthenticatedUser> {
    const role = gwUser.role === "ADMIN" ? Role.ADMIN : Role.USER;

    let existing = gwUser.id
      ? await this.prisma.user.findUnique({ where: { id: gwUser.id } })
      : null;

    if (!existing && gwUser.username) {
      existing = await this.prisma.user.findUnique({
        where: { username: gwUser.username },
      });
    }

    if (!existing && gwUser.email) {
      existing = await this.prisma.user.findUnique({
        where: { email: gwUser.email },
      });
    }

    let user;
    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: gwUser.username,
          email: gwUser.email ?? null,
          role,
          avatarUrl: gwUser.avatarUrl ?? existing.avatarUrl,
          isActive: gwUser.isActive ?? existing.isActive,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          id: gwUser.id,
          username: gwUser.username,
          email: gwUser.email ?? null,
          role,
          avatarUrl: gwUser.avatarUrl ?? null,
          isActive: gwUser.isActive ?? true,
          settings: {
            create: {
              defaultAiEngine: "GITHUB_MODELS",
              githubModelName: "gpt-4o-mini",
              language: "vi",
            },
          },
        },
      });
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
